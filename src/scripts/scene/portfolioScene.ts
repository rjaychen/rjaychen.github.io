import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { applyAccent, hexToRgb, loadStoredAccent, storeAccent } from './accentTheme';

/** Served from `public/models/portfolio.glb`. */
export const PORTFOLIO_GLB_PATH = 'models/portfolio.glb';

export interface PortfolioMountOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  reducedMotion?: boolean;
}

export interface PortfolioMountApi {
  dispose: () => void;
  /** `true` when the GLB mesh is shown; `false` when the procedural torus is shown. */
  getShowGlb: () => boolean;
  /** Swap between procedural torus and `portfolio.glb`. Resolves when the visible mesh matches `show`. */
  setShowGlb: (show: boolean) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Procedural torus shaders — support uMetalness, uRoughness, uAccent uniforms
// ---------------------------------------------------------------------------

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uWarp;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position + normal * sin(position.y * 4.0 + uTime * uWarp) * 0.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vNormal;
  uniform float uMetalness;
  uniform float uRoughness;
  uniform vec3 uAccent;

  void main() {
    float rimPower = mix(6.0, 1.5, uRoughness);
    float rim = 1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
    rim = pow(rim, rimPower);

    vec3 core = vec3(0.06, 0.06, 0.08);
    vec3 highlight = mix(core, uAccent, max(uMetalness, 0.25));
    vec3 finalColor = mix(core, highlight, rim);

    gl_FragColor = vec4(finalColor, 0.92);
  }
`;

function isCoarsePointer(): boolean {
  return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
}

function isNarrowViewport(): boolean {
  return globalThis.matchMedia?.('(max-width: 768px)').matches ?? false;
}

function upgradeToPhysical(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => {
      if (mat instanceof THREE.MeshStandardMaterial && !(mat instanceof THREE.MeshPhysicalMaterial)) {
        const p = new THREE.MeshPhysicalMaterial();
        // Use the standard prototype's copy to avoid accessing physical-only
        // vector properties (e.g. sheenColor, specularColor) that don't exist
        // on a plain MeshStandardMaterial, which causes "v is undefined" crashes.
        THREE.MeshStandardMaterial.prototype.copy.call(p, mat);
        return p;
      }
      return mat;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
  });
}

function collectPhysicalMaterials(root: THREE.Object3D): THREE.MeshPhysicalMaterial[] {
  const list: THREE.MeshPhysicalMaterial[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat instanceof THREE.MeshPhysicalMaterial) list.push(mat);
    }
  });
  return list;
}

/** Relative URL for `portfolio.glb`, respecting Astro's BASE_URL. */
export function resolvePortfolioGlbUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return `${base}${PORTFOLIO_GLB_PATH}`;
}

function prepareGlbRoot(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.frustumCulled = true;
  });
  upgradeToPhysical(root);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.setScalar(2.2 / maxDim);
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

export function mount(options: PortfolioMountOptions): PortfolioMountApi {
  const { canvas, container, reducedMotion = false } = options;

  const metalEl = container.querySelector<HTMLInputElement>('[data-scene-slider="metalness"]');
  const roughEl = container.querySelector<HTMLInputElement>('[data-scene-slider="roughness"]');
  const warpEl = container.querySelector<HTMLInputElement>('[data-scene-slider="warp"]');
  const accentEl = container.querySelector<HTMLInputElement>('[data-scene-accent]');

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.5, 4);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.95;

  const mobileFriendly = isCoarsePointer() || isNarrowViewport();
  controls.enableZoom = !mobileFriendly;
  if (mobileFriendly) controls.rotateSpeed = 0.85;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRt = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRt.texture;

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 6, 4);
  scene.add(ambient, key);

  let raf = 0;
  let disposed = false;
  let proceduralMesh: THREE.Mesh | null = null;
  let shaderMat: THREE.ShaderMaterial | null = null;
  /** Cached prepared GLB root (removed from scene when showing torus). */
  let cachedGlbRoot: THREE.Object3D | null = null;
  let physicalMaterials: THREE.MeshPhysicalMaterial[] = [];
  let displayMode: 'torus' | 'glb' = 'torus';
  let loadGeneration = 0;

  const clock = new THREE.Clock();
  const loader = new GLTFLoader();
  const modelUrl = resolvePortfolioGlbUrl();

  container.dataset.portfolioModel = 'torus';

  const storedAccent = loadStoredAccent();
  let currentAccent = storedAccent;
  applyAccent(currentAccent);
  if (accentEl) accentEl.value = currentAccent;

  function accentRgb(): [number, number, number] {
    return hexToRgb(currentAccent);
  }

  function applyHud(): void {
    const metal = Number.parseFloat(metalEl?.value ?? '0.72');
    const rough = Number.parseFloat(roughEl?.value ?? '0.28');
    const [ar, ag, ab] = accentRgb();

    if (shaderMat) {
      shaderMat.uniforms.uMetalness.value = metal;
      shaderMat.uniforms.uRoughness.value = rough;
      shaderMat.uniforms.uAccent.value.set(ar, ag, ab);
    }

    for (const mat of physicalMaterials) {
      mat.metalness = metal;
      mat.roughness = rough;
      mat.emissive.set(ar * 0.08, ag * 0.08, ab * 0.12);
      mat.needsUpdate = true;
    }
  }

  function applyWarp(): void {
    if (!shaderMat || !warpEl) return;
    shaderMat.uniforms.uWarp.value = Number.parseFloat(warpEl.value);
  }

  function onHudInput(): void {
    applyHud();
  }

  function onWarpInput(): void {
    applyWarp();
  }

  function onAccentInput(): void {
    if (!accentEl) return;
    currentAccent = accentEl.value;
    applyAccent(currentAccent);
    storeAccent(currentAccent);
    applyHud();
  }

  metalEl?.addEventListener('input', onHudInput);
  roughEl?.addEventListener('input', onHudInput);
  warpEl?.addEventListener('input', onWarpInput);
  accentEl?.addEventListener('input', onAccentInput);

  function setSize(): void {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = Math.min(globalThis.devicePixelRatio ?? 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
  }

  const ro = new ResizeObserver(() => {
    if (disposed) return;
    setSize();
  });
  ro.observe(container);

  function disposeProcedural(): void {
    if (!proceduralMesh) return;
    scene.remove(proceduralMesh);
    proceduralMesh.geometry.dispose();
    shaderMat?.dispose();
    proceduralMesh = null;
    shaderMat = null;
  }

  function buildProcedural(): void {
    if (proceduralMesh) return;
    const [ar, ag, ab] = accentRgb();
    const geometry = new THREE.TorusKnotGeometry(0.75, 0.24, 140, 16);
    shaderMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWarp: { value: Number.parseFloat(warpEl?.value ?? '1') },
        uMetalness: { value: Number.parseFloat(metalEl?.value ?? '0.72') },
        uRoughness: { value: Number.parseFloat(roughEl?.value ?? '0.28') },
        uAccent: { value: new THREE.Vector3(ar, ag, ab) },
      },
      transparent: true,
    });
    proceduralMesh = new THREE.Mesh(geometry, shaderMat);
    scene.add(proceduralMesh);
    applyWarp();
    applyHud();
  }

  function detachGlb(): void {
    if (cachedGlbRoot?.parent) scene.remove(cachedGlbRoot);
    physicalMaterials = [];
  }

  function attachGlb(): void {
    if (!cachedGlbRoot) return;
    scene.add(cachedGlbRoot);
    physicalMaterials = collectPhysicalMaterials(cachedGlbRoot);
    applyHud();
  }

  function disposeCachedGlb(): void {
    detachGlb();
    if (!cachedGlbRoot) return;
    cachedGlbRoot.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat?.dispose();
      }
    });
    cachedGlbRoot = null;
  }

  /** Default view: procedural torus only (GLB loads on demand). */
  buildProcedural();

  setSize();

  async function setShowGlb(show: boolean): Promise<void> {
    if (disposed) return;

    if (!show) {
      detachGlb();
      buildProcedural();
      applyWarp();
      applyHud();
      displayMode = 'torus';
      container.dataset.portfolioModel = 'torus';
      return;
    }

    if (displayMode === 'glb' && cachedGlbRoot?.parent === scene) return;

    if (cachedGlbRoot) {
      disposeProcedural();
      attachGlb();
      displayMode = 'glb';
      container.dataset.portfolioModel = 'glb';
      return;
    }

    const gen = ++loadGeneration;

    await new Promise<void>((resolve, reject) => {
      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed || gen !== loadGeneration) {
            resolve();
            return;
          }
          const root = gltf.scene;
          prepareGlbRoot(root);
          cachedGlbRoot = root;
          disposeProcedural();
          attachGlb();
          displayMode = 'glb';
          container.dataset.portfolioModel = 'glb';
          resolve();
        },
        undefined,
        (err) => {
          if (disposed || gen !== loadGeneration) {
            resolve();
            return;
          }
          if (import.meta.env.DEV) {
            console.warn('[portfolioScene] portfolio.glb load failed — staying on torus.', modelUrl, err);
          }
          displayMode = 'torus';
          container.dataset.portfolioModel = 'torus';
          buildProcedural();
          applyWarp();
          applyHud();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      );
    });
  }

  function tick(): void {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const delta = clock.getDelta();

    if (!reducedMotion) {
      if (shaderMat) shaderMat.uniforms.uTime.value += delta * 0.9;
      if (proceduralMesh) {
        proceduralMesh.rotation.y += delta * 0.12;
        proceduralMesh.rotation.x += delta * 0.05;
      }
      if (cachedGlbRoot?.parent === scene) {
        cachedGlbRoot.rotation.y += delta * 0.08;
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  raf = requestAnimationFrame(tick);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      loadGeneration += 1;
      cancelAnimationFrame(raf);
      ro.disconnect();
      metalEl?.removeEventListener('input', onHudInput);
      roughEl?.removeEventListener('input', onHudInput);
      warpEl?.removeEventListener('input', onWarpInput);
      accentEl?.removeEventListener('input', onAccentInput);
      controls.dispose();

      disposeProcedural();
      disposeCachedGlb();

      envRt.texture.dispose();
      pmrem.dispose();
      renderer.dispose();

      proceduralMesh = null;
      shaderMat = null;
      physicalMaterials = [];
      delete container.dataset.portfolioModel;
    },
    getShowGlb: () => displayMode === 'glb',
    setShowGlb,
  };
}
