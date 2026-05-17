/**
 * Torus fragment shader.
 * Rim-lit metallic look driven by uMetalness / uRoughness / uAccent.
 * uFade controls overall alpha so the mesh can dissolve during transition.
 */
export default /* glsl */ `
  varying vec3 vNormal;
  uniform float uMetalness;
  uniform float uRoughness;
  uniform vec3 uAccent;
  uniform float uFade;

  void main() {
    float rimPower = mix(6.0, 1.5, uRoughness);
    float rim = 1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
    rim = pow(rim, rimPower);

    vec3 core      = vec3(0.06, 0.06, 0.08);
    vec3 highlight = mix(core, uAccent, max(uMetalness, 0.25));
    vec3 finalColor = mix(core, highlight, rim);

    gl_FragColor = vec4(finalColor, 0.92 * uFade);
  }
`;
