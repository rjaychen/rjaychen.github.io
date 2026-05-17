/**
 * Particle vertex shader.
 *
 * Positions are stored in GLB root-local space for both the torus origin
 * (attribute: position) and the GLB target (attribute: aTargetPosition).
 *
 * Phase 1 (uProgress 0 → 0.5): remapped to a smooth 0 → 1 posProgress that
 * drives the mix() migration.  Phase 2 (0.5 → 1.0): positions are locked at
 * the GLB surface while the fragment shader fades the particles out.
 */
export default /* glsl */ `
  attribute vec3 aTargetPosition;
  uniform float uProgress;
  uniform float uTime;
  varying vec3 vPosition;

  void main() {
    // Remap 0→0.5 into 0→1 for position interpolation (phase 1 only)
    float posProgress = clamp(uProgress * 2.0, 0.0, 1.0);
    posProgress = smoothstep(0.0, 1.0, posProgress);

    vec3 mixedPosition = mix(position, aTargetPosition, posProgress);

    // Micro-vibration mid-transit for a floating transit feel
    if (uProgress > 0.0 && uProgress < 1.0) {
      mixedPosition.x += sin(position.y * 10.0 + uTime) * 0.02 * (1.0 - posProgress) * posProgress;
      mixedPosition.y += cos(position.x * 10.0 + uTime) * 0.02 * (1.0 - posProgress) * posProgress;
    }

    vPosition = mixedPosition;
    vec4 mvPosition = modelViewMatrix * vec4(mixedPosition, 1.0);
    gl_PointSize = (6.0 / -mvPosition.z);
    gl_Position  = projectionMatrix * mvPosition;
  }
`;
