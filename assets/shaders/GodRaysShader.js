// GodRaysShader.js
import * as THREE from 'three';

export const GodRaysShader = {
  // Valores por defecto / ajustables
  params: {
    density: 1.0,
    weight: 0.3,
    decay: 0.95,
    exposure: 0.4,
    numSamples: 60
  },

  uniforms: {
    tDiffuse: { value: null },
    screenSpaceLightPos: { value: new THREE.Vector2(0.5, 0.5) },
    density: { value: 1.0 },
    weight: { value: 0.3 },
    decay: { value: 0.95 },
    exposure: { value: 0.4 },
    numSamples: { value: 60 }
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
    uniform vec2 screenSpaceLightPos;
    uniform float density;
    uniform float weight;
    uniform float decay;
    uniform float exposure;
    uniform int numSamples;

    varying vec2 vUv;

    vec3 godrays(
        float density,
        float weight,
        float decay,
        float exposure,
        int numSamples,
        sampler2D occlusionTexture,
        vec2 screenSpaceLightPos,
        vec2 uv
    ) {
        vec3 fragColor = vec3(0.0, 0.0, 0.0);
        vec2 deltaTextCoord = vec2(uv - screenSpaceLightPos.xy);
        vec2 textCoo = uv.xy;
        deltaTextCoord *= (1.0 / float(numSamples)) * density;
        float illuminationDecay = 1.0;

        for(int i = 0; i < 100; i++) {
            if(numSamples < i) {
                break;
            }
            textCoo -= deltaTextCoord;
            vec3 samp = texture2D(occlusionTexture, textCoo).xyz;
            samp *= illuminationDecay * weight;
            fragColor += samp;
            illuminationDecay *= decay;
        }
        fragColor *= exposure;
        return fragColor;
    }

    void main() {
      vec4 baseColor = texture2D(tDiffuse, vUv);
      
      vec3 rays = godrays(
        density,
        weight,
        decay,
        exposure,
        numSamples,
        tDiffuse,
        screenSpaceLightPos,
        vUv
      );

      gl_FragColor = vec4(baseColor.rgb + rays, baseColor.a);
    }
  `
};

/**
 * Función auxiliar para actualizar los parámetros del ShaderPass fácilmente.
 * @param {ShaderPass} pass - El pass donde está instanciado el GodRaysShader
 * @param {Object} options - Parámetros a cambiar: { density, weight, decay, exposure, numSamples }
 */
export function setGodRaysParams(pass, options = {}) {
  if (!pass || !pass.uniforms) return;

  if (options.density !== undefined) pass.uniforms.density.value = options.density;
  if (options.weight !== undefined) pass.uniforms.weight.value = options.weight;
  if (options.decay !== undefined) pass.uniforms.decay.value = options.decay;
  if (options.exposure !== undefined) pass.uniforms.exposure.value = options.exposure;
  if (options.numSamples !== undefined) pass.uniforms.numSamples.value = options.numSamples;
}