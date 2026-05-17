/**
 * Particle fragment shader.
 * Soft circular point sprites coloured by uAccent.
 * Phase 2 (uProgress > 0.5): fades alpha from 1 → 0.15 as the solid GLB
 * materialises over the particle cloud.
 */
export default /* glsl */ `
  uniform vec3  uAccent;
  uniform float uProgress;
  varying vec3  vPosition;

  void main() {
    // Fade out as solid GLB fades in (phase 2)
    float particleAlpha = 1.0;
    if (uProgress > 0.5) {
      particleAlpha = mix(1.0, 0.0, (uProgress - 0.5) * 2.0);
    }

    // Soft circular falloff instead of hard squares
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float intensity = smoothstep(0.5, 0.1, dist);
    gl_FragColor = vec4(uAccent, intensity * particleAlpha);
  }
`;
