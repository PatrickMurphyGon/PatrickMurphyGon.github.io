export const VignetteShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'darkness': { value: 1.2 },
    'offset': { value: 0.0 },
    'maxBrightness': { value: 100.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    uniform float maxBrightness;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 clampedColor = min(texel.rgb, vec3(maxBrightness));
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vecDist = dot(uv, uv);
      gl_FragColor = vec4(clampedColor * (1.0 - vecDist * darkness), texel.a);
    }
  `
};