/**
 * Torus vertex shader.
 * Applies a normal-direction sine warp controlled by uTime and uWarp.
 */
export default /* glsl */ `
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
