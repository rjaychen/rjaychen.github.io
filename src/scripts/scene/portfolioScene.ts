import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { applyAccent, hexToRgb, loadStoredAccent, storeAccent } from './accentTheme';
import torusVertSrc    from './shaders/torusVert';
import torusFragSrc    from './shaders/torusFrag';
import particleVertSrc from './shaders/particleVert';
import particleFragSrc from './shaders/particleFrag';

/** Served from `public/models/`. */
export const PORTFOLIO_GLB_PATH = 'models/duck.glb';

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

/** Morph particle pool size limits (slider in HUD). */
export const PARTICLE_COUNT_MIN = 500;
export const PARTICLE_COUNT_MAX = 30000;

function clampParticleCount(raw: number): number {
  const n = Number.isFinite(raw) ? Math.round(raw) : PARTICLE_COUNT_MIN;
  return THREE.MathUtils.clamp(n, PARTICLE_COUNT_MIN, PARTICLE_COUNT_MAX);
}

/** Wall-clock duration for morph progress 0→1 or 1→0 (symmetric both ways). */
const TRANSITION_DURATION_MS = 2400;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Collect every renderable material on a GLB so we can drive opacity uniformly. */
function collectAllMaterials(root: THREE.Object3D): THREE.Material[] {
  const list: THREE.Material[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) if (mat) list.push(mat);
  });
  return list;
}

/** World-space AABB center of all meshes under `root`, ignoring visibility (for orbit focus). */
function unionBBoxCenterWorld(root: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  let empty = true;
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    tmp.copy(g.boundingBox!);
    tmp.applyMatrix4(m.matrixWorld);
    if (empty) {
      box.copy(tmp);
      empty = false;
    } else {
      box.union(tmp);
    }
  });
  if (empty) return new THREE.Vector3();
  return box.getCenter(new THREE.Vector3());
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
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.setScalar(2.2 / maxDim);
  root.updateWorldMatrix(true, true);
  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  root.position.sub(center);
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

export function mount(options: PortfolioMountOptions): PortfolioMountApi {
  const { canvas, container, reducedMotion = false } = options;

  const metalEl     = container.querySelector<HTMLInputElement>('[data-scene-slider="metalness"]');
  const roughEl     = container.querySelector<HTMLInputElement>('[data-scene-slider="roughness"]');
  const warpEl      = container.querySelector<HTMLInputElement>('[data-scene-slider="warp"]');
  const particlesEl = container.querySelector<HTMLInputElement>('[data-scene-slider="particles"]');
  const particlesOutEl = container.querySelector<HTMLOutputElement>('[data-scene-particles-value]');
  const fpsEl       = container.querySelector<HTMLElement>('[data-scene-fps]');
  const accentEl    = container.querySelector<HTMLInputElement>('[data-scene-accent]');

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
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.06;
  controls.minDistance    = 1.2;
  controls.maxDistance    = 12;
  controls.maxPolarAngle  = Math.PI * 0.95;
  controls.target.set(0, 0, 0);

  const mobileFriendly = isCoarsePointer() || isNarrowViewport();
  controls.enableZoom = !mobileFriendly;
  if (mobileFriendly) controls.rotateSpeed = 0.85;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRt = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRt.texture;

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  const key     = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 6, 4);
  scene.add(ambient, key);

  let raf            = 0;
  let disposed       = false;
  let proceduralMesh: THREE.Mesh | null = null;
  let shaderMat:      THREE.ShaderMaterial | null = null;
  let cachedGlbRoot:  THREE.Object3D | null = null;
  /** All materials on the GLB — used to drive opacity in tick(). */
  let glbMaterials:   THREE.Material[] = [];
  /** Physical subset — used by applyHud() for metalness / roughness / emissive. */
  let physicalMaterials: THREE.MeshPhysicalMaterial[] = [];
  let displayMode:    'torus' | 'glb' = 'torus';
  let loadGeneration = 0;

  // ── Two-phase morph transition state ────────────────────────────────────
  /** Current visual state: 0 = torus, 1 = GLB (drives shaders / fades). */
  let transitionProgress = 0.0;
  /** Desired endpoint (0 or 1); kept for API parity with handlers. */
  let targetTransition = 0.0;
  /** Fixed-duration animation: value when the current transition began. */
  let transitionAnimStartProgress = 0.0;
  /** Fixed-duration animation: endpoint (0 or 1). */
  let transitionAnimTarget = 0.0;
  /** performance.now() when the current transition began. */
  let transitionAnimStartTime = performance.now();
  let morphPoints:      THREE.Points | null = null;
  let morphParticleMat: THREE.ShaderMaterial | null = null;
  /** Throttle heavy torus particle refreshes during phase 1. */
  let torusOriginRefreshDivider = 0;

  let particleCount = clampParticleCount(Number.parseInt(particlesEl?.value ?? '12000', 10));
  /** Exponential moving average for HUD FPS (Hz). */
  let fpsEma = 0;

  const particlesFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

  const clock    = new THREE.Clock();
  const loader   = new GLTFLoader();
  const modelUrl = resolvePortfolioGlbUrl();

  container.dataset.portfolioModel = 'torus';

  const storedAccent = loadStoredAccent();
  let currentAccent  = storedAccent;
  applyAccent(currentAccent);
  if (accentEl) accentEl.value = currentAccent;
  applyLightAccent();

  function syncParticlesHud(): void {
    particleCount = clampParticleCount(particleCount);
    if (particlesEl) particlesEl.value = String(particleCount);
    if (particlesOutEl) particlesOutEl.textContent = particlesFmt.format(particleCount);
  }

  syncParticlesHud();

  function accentRgb(): [number, number, number] {
    return hexToRgb(currentAccent);
  }

  function applyLightAccent(): void {
    const [ar, ag, ab] = accentRgb();
    key.color.setRGB(0.72 + ar * 0.28, 0.72 + ag * 0.28, 0.72 + ab * 0.28);
    ambient.color.setRGB(0.94 + ar * 0.06, 0.94 + ag * 0.06, 0.94 + ab * 0.06);
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

    applyLightAccent();
  }

  function applyWarp(): void {
    if (!shaderMat || !warpEl) return;
    shaderMat.uniforms.uWarp.value = Number.parseFloat(warpEl.value);
  }

  function onHudInput():    void { applyHud();  }
  function onWarpInput():   void { applyWarp(); }
  function onAccentInput(): void {
    if (!accentEl) return;
    currentAccent = accentEl.value;
    applyAccent(currentAccent);
    storeAccent(currentAccent);
    applyHud();
  }

  function onParticlesInput(): void {
    particleCount = clampParticleCount(Number.parseInt(particlesEl?.value ?? String(particleCount), 10));
    syncParticlesHud();
    if (!cachedGlbRoot || !proceduralMesh || !shaderMat) return;
    proceduralMesh.updateWorldMatrix(true, false);
    cachedGlbRoot.updateWorldMatrix(true, true);
    setupMorphParticles(cachedGlbRoot);
  }

  metalEl?.addEventListener('input', onHudInput);
  roughEl?.addEventListener('input', onHudInput);
  warpEl?.addEventListener('input', onWarpInput);
  accentEl?.addEventListener('input', onAccentInput);
  particlesEl?.addEventListener('input', onParticlesInput);

  function setSize(): void {
    const w = canvas.clientWidth  || 1;
    const h = canvas.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = Math.min(globalThis.devicePixelRatio ?? 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
  }

  const ro = new ResizeObserver(() => { if (!disposed) setSize(); });
  ro.observe(canvas);

  /** Zoom/orbit pivot follows the blended centroid of torus vs GLB so dollying stays visually centered. */
  function syncOrbitTarget(delta: number): void {
    const blended = new THREE.Vector3();
    let wSum = 0;
    const wGlb = THREE.MathUtils.clamp(transitionProgress, 0, 1);
    const wTor = THREE.MathUtils.clamp(1 - transitionProgress, 0, 1);

    if (proceduralMesh && wTor > 1e-6) {
      blended.addScaledVector(unionBBoxCenterWorld(proceduralMesh), wTor);
      wSum += wTor;
    }
    if (cachedGlbRoot && wGlb > 1e-6) {
      blended.addScaledVector(unionBBoxCenterWorld(cachedGlbRoot), wGlb);
      wSum += wGlb;
    }

    if (wSum < 1e-6) return;

    blended.multiplyScalar(1 / wSum);
    const smooth = 1 - Math.exp(-12 * delta);
    controls.target.lerp(blended, smooth);
  }

  function buildProcedural(): void {
    if (proceduralMesh) return;
    const [ar, ag, ab] = accentRgb();
    const geometry = new THREE.TorusKnotGeometry(0.75, 0.24, 140, 16);
    shaderMat = new THREE.ShaderMaterial({
      vertexShader:   torusVertSrc,
      fragmentShader: torusFragSrc,
      uniforms: {
        uTime:      { value: 0 },
        uWarp:      { value: Number.parseFloat(warpEl?.value ?? '1') },
        uMetalness: { value: Number.parseFloat(metalEl?.value ?? '0.72') },
        uRoughness: { value: Number.parseFloat(roughEl?.value ?? '0.28') },
        uAccent:    { value: new THREE.Vector3(ar, ag, ab) },
        uFade:      { value: 1.0 },
      },
      transparent: true,
    });
    proceduralMesh = new THREE.Mesh(geometry, shaderMat);
    scene.add(proceduralMesh);
    applyWarp();
    applyHud();
  }

  // ── Particle helpers ─────────────────────────────────────────────────────

  /**
   * Build a temporary, CPU-side "deformed torus" geometry that matches what
   * the torus vertex-shader is currently rendering (the normal-displacement
   * warp).  The caller is responsible for disposing it.
   *
   * Issue 3: without this, sampled positions come from the flat geometry data
   * while the visible torus has sine-warped surfaces — causing the particle
   * cloud to misalign at the start of the transition.
   */
  function buildDeformedTorusGeom(): THREE.BufferGeometry {
    const src      = proceduralMesh!.geometry as THREE.BufferGeometry;
    const posAttr  = src.attributes.position as THREE.BufferAttribute;
    const normAttr = src.attributes.normal   as THREE.BufferAttribute;
    const uTime    = shaderMat!.uniforms.uTime.value;
    const uWarp    = shaderMat!.uniforms.uWarp.value;

    const deformed = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      const px = posAttr.getX(i),  py = posAttr.getY(i),  pz = posAttr.getZ(i);
      const nx = normAttr.getX(i), ny = normAttr.getY(i), nz = normAttr.getZ(i);
      // Replicate: pos = position + normal * sin(position.y * 4 + uTime * uWarp) * 0.1
      const d = Math.sin(py * 4.0 + uTime * uWarp) * 0.1;
      deformed[i * 3]     = px + nx * d;
      deformed[i * 3 + 1] = py + ny * d;
      deformed[i * 3 + 2] = pz + nz * d;
    }

    const geom = new THREE.BufferGeometry();
    if (src.index) geom.setIndex(src.index);
    geom.setAttribute('position', new THREE.BufferAttribute(deformed, 3));
    return geom;
  }

  /**
   * First-time setup of the morph particle system.
   *
   * Position pools live in GLB root-local space (`inverse(glb.matrixWorld) × world`).
   * Torus world samples use `proceduralMesh.matrixWorld × deformedLocal`.
   * `morphPoints` copies `glbRoot` position / scale / rotation so rendered particles match both endpoints.
   */
  function setupMorphParticles(glbRoot: THREE.Object3D): void {
    if (morphPoints) {
      scene.remove(morphPoints);
      morphPoints.geometry.dispose();
      morphParticleMat?.dispose();
      morphPoints     = null;
      morphParticleMat = null;
    }

    glbRoot.updateWorldMatrix(true, true);
    const rootWorldInv = new THREE.Matrix4().copy(glbRoot.matrixWorld).invert();

    proceduralMesh!.updateWorldMatrix(true, false);

    const count = particleCount;

    // ── Torus samples — GLB root-local space ──────────────────────────────
    const deformedGeom = buildDeformedTorusGeom();
    const torusMesh    = new THREE.Mesh(deformedGeom);
    const torusSampler = new MeshSurfaceSampler(torusMesh).build();

    const torusPositions = new Float32Array(count * 3);
    const _pos = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      torusSampler.sample(_pos);
      // Deformed sample is in torus geometry space → world via procedural mesh pose.
      _pos.applyMatrix4(proceduralMesh!.matrixWorld);
      _pos.applyMatrix4(rootWorldInv);
      torusPositions[i * 3]     = _pos.x;
      torusPositions[i * 3 + 1] = _pos.y;
      torusPositions[i * 3 + 2] = _pos.z;
    }
    deformedGeom.dispose();

    // ── GLB samples — GLB root-local space ───────────────────────────────
    const glbMeshes: THREE.Mesh[] = [];
    glbRoot.traverse((o) => { if ((o as THREE.Mesh).isMesh) glbMeshes.push(o as THREE.Mesh); });

    const glbPositions = new Float32Array(count * 3);
    if (glbMeshes.length > 0) {
      const nMesh = glbMeshes.length;
      const base = Math.floor(count / nMesh);
      let remainder = count % nMesh;
      let sampleIdx = 0;
      for (let mi = 0; mi < nMesh; mi++) {
        const mesh = glbMeshes[mi]!;
        const sampler = new MeshSurfaceSampler(mesh).build();
        const take = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        for (let i = 0; i < take && sampleIdx < count; i++) {
          sampler.sample(_pos);
          _pos.applyMatrix4(mesh.matrixWorld); // mesh → world
          _pos.applyMatrix4(rootWorldInv);     // world → GLB root-local
          glbPositions[sampleIdx * 3]     = _pos.x;
          glbPositions[sampleIdx * 3 + 1] = _pos.y;
          glbPositions[sampleIdx * 3 + 2] = _pos.z;
          sampleIdx++;
        }
      }
    }

    // ── Build geometry + material ─────────────────────────────────────────
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position',        new THREE.BufferAttribute(torusPositions, 3));
    particleGeom.setAttribute('aTargetPosition', new THREE.BufferAttribute(glbPositions,   3));

    const [ar, ag, ab] = accentRgb();
    morphParticleMat = new THREE.ShaderMaterial({
      vertexShader:   particleVertSrc,
      fragmentShader: particleFragSrc,
      uniforms: {
        uProgress: { value: transitionProgress },
        uTime:     { value: 0.0 },
        uAccent:   { value: new THREE.Vector3(ar, ag, ab) },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    morphPoints = new THREE.Points(particleGeom, morphParticleMat);

    // ── Critical: morphPoints MUST share the GLB root's transform ────────
    // The position pools are in GLB root-local space.  Applying the same
    // world transform (position + scale + rotation) makes the rendered
    // particle world positions match both the torus and the GLB surface.
    morphPoints.position.copy(glbRoot.position);
    morphPoints.scale.copy(glbRoot.scale);
    morphPoints.rotation.copy(glbRoot.rotation);

    morphPoints.visible = false;
    scene.add(morphPoints);
  }

  /**
   * Refresh particle geometry `position` (torus endpoint) from the current
   * deformed torus + full procedural mesh world matrix. Call when starting
   * torus ↔ GLB transitions so endpoints match vertex rhythm and rotation.
   */
  function refreshTorusParticleOrigin(): void {
    if (!morphPoints || !shaderMat || !proceduralMesh || !cachedGlbRoot) return;

    proceduralMesh.updateWorldMatrix(true, false);
    cachedGlbRoot.updateWorldMatrix(true, true);
    const rootWorldInv = new THREE.Matrix4().copy(cachedGlbRoot.matrixWorld).invert();

    const deformedGeom = buildDeformedTorusGeom();
    const torusMesh    = new THREE.Mesh(deformedGeom);
    const sampler      = new MeshSurfaceSampler(torusMesh).build();

    const torusAttr = morphPoints.geometry.attributes.position as THREE.BufferAttribute;
    const nVerts = torusAttr.count;
    const _pos = new THREE.Vector3();
    for (let i = 0; i < nVerts; i++) {
      sampler.sample(_pos);
      _pos.applyMatrix4(proceduralMesh.matrixWorld);
      _pos.applyMatrix4(rootWorldInv);
      torusAttr.setXYZ(i, _pos.x, _pos.y, _pos.z);
    }
    torusAttr.needsUpdate = true;

    deformedGeom.dispose();
  }

  /** Default view: procedural torus only (GLB loads on demand). */
  buildProcedural();
  setSize();

  // ── setShowGlb ───────────────────────────────────────────────────────────

  async function setShowGlb(show: boolean): Promise<void> {
    if (disposed) return;

    targetTransition = show ? 1.0 : 0.0;
    transitionAnimTarget       = targetTransition;
    transitionAnimStartProgress = transitionProgress;
    transitionAnimStartTime     = performance.now();

    displayMode = show ? 'glb' : 'torus';
    container.dataset.portfolioModel = show ? 'glb' : 'torus';

    // Torus must always be in the scene — it is the phase-1 departure point.
    buildProcedural();

    if (!show) {
      // Duck → torus: refresh torus particle endpoints (fixes stale samples +
      // rotation vs procedural mesh).
      if (cachedGlbRoot && morphPoints && proceduralMesh && shaderMat) {
        proceduralMesh.updateWorldMatrix(true, false);
        cachedGlbRoot.updateWorldMatrix(true, true);
        refreshTorusParticleOrigin();
        morphPoints.position.copy(cachedGlbRoot.position);
        morphPoints.scale.copy(cachedGlbRoot.scale);
        morphPoints.rotation.copy(cachedGlbRoot.rotation);
      }
      return;
    }

    // ── GLB + particles already set up ─────────────────────────────────
    if (cachedGlbRoot && morphPoints && proceduralMesh) {
      proceduralMesh.updateWorldMatrix(true, false);
      cachedGlbRoot.updateWorldMatrix(true, true);
      cachedGlbRoot.rotation.copy(proceduralMesh.rotation);
      morphPoints.position.copy(cachedGlbRoot.position);
      morphPoints.scale.copy(cachedGlbRoot.scale);
      morphPoints.rotation.copy(cachedGlbRoot.rotation);
      refreshTorusParticleOrigin();
      return;
    }

    // ── GLB loaded but particles missing (e.g. hot-reload) ─────────────
    if (cachedGlbRoot && !morphPoints) {
      glbMaterials      = collectAllMaterials(cachedGlbRoot);
      physicalMaterials = collectPhysicalMaterials(cachedGlbRoot);
      applyHud();
      cachedGlbRoot.updateWorldMatrix(true, true);
      setupMorphParticles(cachedGlbRoot);
      return;
    }

    // ── First load ──────────────────────────────────────────────────────
    const gen = ++loadGeneration;

    await new Promise<void>((resolve, reject) => {
      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed || gen !== loadGeneration) { resolve(); return; }

          const root = gltf.scene;
          prepareGlbRoot(root);
          cachedGlbRoot = root;

          // All GLB materials begin fully transparent for phase-2 fade-in.
          glbMaterials = collectAllMaterials(cachedGlbRoot);
          for (const mat of glbMaterials) {
            mat.transparent = true;
            mat.opacity     = 0.0;
          }
          physicalMaterials = collectPhysicalMaterials(cachedGlbRoot);
          applyHud();

          if (proceduralMesh) {
            proceduralMesh.updateWorldMatrix(true, false);
            cachedGlbRoot.rotation.copy(proceduralMesh.rotation);
          }

          scene.add(cachedGlbRoot);
          // matrixWorld must be current before MeshSurfaceSampler walks the tree.
          cachedGlbRoot.updateWorldMatrix(true, true);
          setupMorphParticles(cachedGlbRoot);

          resolve();
        },
        undefined,
        (err) => {
          if (disposed || gen !== loadGeneration) { resolve(); return; }
          if (import.meta.env.DEV) {
            console.warn('[portfolioScene] GLB load failed — staying on torus.', modelUrl, err);
          }
          targetTransition = 0.0;
          transitionAnimTarget       = 0.0;
          transitionAnimStartProgress = transitionProgress;
          transitionAnimStartTime     = performance.now();
          displayMode      = 'torus';
          container.dataset.portfolioModel = 'torus';
          buildProcedural();
          applyWarp();
          applyHud();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      );
    });
  }

  // ── tick ─────────────────────────────────────────────────────────────────

  function tick(): void {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const delta = clock.getDelta();

    if (fpsEl && delta > 1e-6) {
      const inst = 1 / delta;
      fpsEma = fpsEma <= 1e-6 ? inst : fpsEma * 0.9 + inst * 0.1;
      const rounded = Math.round(fpsEma);
      fpsEl.textContent = String(rounded);
      fpsEl.dataset.low = rounded < 45 ? 'true' : 'false';
    }

    // Fixed-duration morph (symmetric wall-clock time torus↔duck)
    const rawT = THREE.MathUtils.clamp(
      (performance.now() - transitionAnimStartTime) / TRANSITION_DURATION_MS,
      0,
      1
    );
    const easedT = rawT * rawT * (3 - 2 * rawT);
    transitionProgress = THREE.MathUtils.lerp(
      transitionAnimStartProgress,
      transitionAnimTarget,
      easedT
    );

    // ── Particle uniforms ────────────────────────────────────────────────
    if (morphParticleMat) {
      morphParticleMat.uniforms.uProgress.value = transitionProgress;
      morphParticleMat.uniforms.uTime.value    += delta;
      const [ar, ag, ab] = accentRgb();
      morphParticleMat.uniforms.uAccent.value.set(ar, ag, ab);
    }

    // ── Phase 1: torus fades out (progress 0.0 → 0.5) ──────────────────
    if (proceduralMesh && shaderMat) {
      if (!reducedMotion) shaderMat.uniforms.uTime.value += delta * 0.9;
      const torusFade = transitionProgress <= 0.5
        ? 1.0 - transitionProgress * 2.0
        : 0.0;
      shaderMat.uniforms.uFade.value = torusFade;
      proceduralMesh.visible = torusFade > 0.001;
    }

    // ── Phase 2: GLB fades in (progress 0.5 → 1.0) ─────────────────────
    if (cachedGlbRoot) {
      const glbOpacity = transitionProgress > 0.5
        ? (transitionProgress - 0.5) * 2.0
        : 0.0;
      cachedGlbRoot.visible = glbOpacity > 0.001;
      for (const mat of glbMaterials) {
        mat.opacity = glbOpacity;
      }
    }

    // Particles only visible during the active transition window
    if (morphPoints) {
      morphPoints.visible = transitionProgress > 0.001 && transitionProgress < 0.999;
    }

    // ── Rotations (maintained throughout transition) ─────────────────────
    if (!reducedMotion) {
      // Keep torus pose advancing even while invisible (duck-only view) so
      // refreshTorusParticleOrigin sees a live matrixWorld + consistent uTime.
      if (proceduralMesh) {
        proceduralMesh.rotation.y += delta * 0.12;
        proceduralMesh.rotation.x += delta * 0.05;
      }
      // GLB and particle cloud share the same rotation so the solid model
      // materialises perfectly over the particle shell (issues 1 & 2).
      if (cachedGlbRoot) {
        cachedGlbRoot.rotation.y += delta * 0.08;
      }
      if (morphPoints && cachedGlbRoot) {
        morphPoints.rotation.copy(cachedGlbRoot.rotation);
      } else if (morphPoints) {
        morphPoints.rotation.y += delta * 0.08;
      }
    }

    // Phase 1 (progress ≤ 0.5): particle vertex shader mixes toward torus
    // `position`. Torus mesh + time keep moving during long phase-2 waits
    // (e.g. duck→torus: progress 1 → 0.5), so re-sample torus endpoints at a
    // throttled rate while particles are visible.
    if (
      morphPoints?.visible &&
      morphParticleMat &&
      proceduralMesh &&
      shaderMat &&
      cachedGlbRoot &&
      transitionProgress <= 0.5
    ) {
      torusOriginRefreshDivider += 1;
      if (torusOriginRefreshDivider % 2 === 0) {
        proceduralMesh.updateWorldMatrix(true, false);
        cachedGlbRoot.updateWorldMatrix(true, true);
        refreshTorusParticleOrigin();
        morphPoints.position.copy(cachedGlbRoot.position);
        morphPoints.scale.copy(cachedGlbRoot.scale);
        morphPoints.rotation.copy(cachedGlbRoot.rotation);
      }
    }

    syncOrbitTarget(delta);
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
      particlesEl?.removeEventListener('input', onParticlesInput);
      controls.dispose();

      if (proceduralMesh) {
        scene.remove(proceduralMesh);
        proceduralMesh.geometry.dispose();
        shaderMat?.dispose();
        proceduralMesh = null;
        shaderMat      = null;
      }

      if (morphPoints) {
        scene.remove(morphPoints);
        morphPoints.geometry.dispose();
        morphParticleMat?.dispose();
        morphPoints      = null;
        morphParticleMat = null;
      }

      if (cachedGlbRoot) {
        if (cachedGlbRoot.parent) scene.remove(cachedGlbRoot);
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

      envRt.texture.dispose();
      pmrem.dispose();
      renderer.dispose();

      glbMaterials      = [];
      physicalMaterials = [];
      delete container.dataset.portfolioModel;
    },
    getShowGlb: () => displayMode === 'glb',
    setShowGlb,
  };
}
