import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// IMPORTS DE POSTPROCESADO
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// SHADERS EXTERNOS
import { GodRaysShader, setGodRaysParams } from '../../assets/shaders/GodRaysShader.js';

// ================================================
// 1. ESCENA, CÁMARA Y RENDERIZADOR BASE
// ================================================
const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ================================================
// 2. POST-PROCESADO (BLOOM & GOD RAYS CON TOGGLES)
// ================================================
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8, // Intensidad inicial del bloom
  0.5, // Radio
  0.2  // Umbral
);
composer.addPass(bloomPass);

const godRaysPass = new ShaderPass(GodRaysShader);
setGodRaysParams(godRaysPass, {
  density: 0.6,
  weight: 0.15,
  decay: 0.92,
  exposure: 0.3,
  numSamples: 40
});
composer.addPass(godRaysPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

const postProcessingConfig = {
  enableBloom: true,
  enableGodRays: true
};

// ================================================
// 3. SISTEMA DE AUDIO Y ANALIZADOR DE FRECUENCIAS
// ================================================
const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

const fftSize = 128;
const analyser = new THREE.AudioAnalyser(sound, fftSize);

// Elementos del DOM
const fileInput = document.getElementById('audio-file-input');
const btnUpload = document.getElementById('btn-upload');
const btnPlay = document.getElementById('btn-play');
const volumeSlider = document.getElementById('volume-slider');
const audioStatus = document.getElementById('audio-status');

let isAudioLoaded = false;

if (btnUpload) {
  btnUpload.addEventListener('click', () => {
    if (listener.context.state === 'suspended') listener.context.resume();
    fileInput.click();
  });
}

if (fileInput) {
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    audioStatus.innerText = `Cargando: ${file.name}...`;
    const fileUrl = URL.createObjectURL(file);

    audioLoader.load(fileUrl, (buffer) => {
      if (sound.isPlaying) sound.stop();
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(volumeSlider ? parseFloat(volumeSlider.value) : 0.5);
      sound.play();

      isAudioLoaded = true;
      btnPlay.disabled = false;
      btnPlay.innerText = '⏸️ Pausa';
      audioStatus.innerText = `Sonando: ${file.name}`;
    });
  });
}

if (btnPlay) {
  btnPlay.addEventListener('click', () => {
    if (!isAudioLoaded) return;
    if (sound.isPlaying) {
      sound.pause();
      btnPlay.innerText = '▶️ Play';
      audioStatus.innerText = 'Audio en pausa';
    } else {
      sound.play();
      btnPlay.innerText = '⏸️ Pausa';
      audioStatus.innerText = 'Reproduciendo audio';
    }
  });
}

if (volumeSlider) {
  volumeSlider.addEventListener('input', (e) => sound.setVolume(parseFloat(e.target.value)));
}

// ================================================
// 4. GENERACIÓN DE TEXTURA RADIAL PARA PARTÍCULAS
// ================================================
function createParticleTexture() {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 64;
  canvasTexture.height = 64;
  const ctx = canvasTexture.getContext('2d');

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  return new THREE.CanvasTexture(canvasTexture);
}

// ================================================
// 5. SHADERS GLSL (CON EXPONENTES Y FASE DINÁMICA DE OLA)
// ================================================

const vertexShader = `
  attribute float aBand;          // 0.0 = Graves, 1.0 = Medios, 2.0 = Agudos
  attribute vec3 aSphereDir;      
  attribute vec3 aOscPos;         
  attribute vec3 aGroundPos;      

  uniform float uMode;            // 0.0 = Esfera, 1.0 = Osciloscopio, 2.0 = Suelo
  uniform float uWavePhase;       // Fase de ola impulsada por el bajo
  uniform float uWaveFreq;        // Frecuencia espacial de las olas
  uniform float uBaseRadius;
  uniform float uParticleSize;

  // Amplitudes
  uniform float uBassAmp;
  uniform float uMidAmp;
  uniform float uTrebleAmp;

  // Exponentes de Contraste / Punch (Acentúa golpes)
  uniform float uBassPunch;
  uniform float uMidPunch;
  uniform float uTreblePunch;

  // Valores de Frecuencia (0.0 a 1.0)
  uniform float uBassVal;
  uniform float uMidVal;
  uniform float uTrebleVal;

  // Colores por Banda
  uniform vec3 uBassColor;
  uniform vec3 uMidColor;
  uniform vec3 uTrebleColor;

  varying vec3 vColor;

  void main() {
    float rawVal = 0.0;
    float amp = 1.0;
    float punchExp = 1.0;
    vec3 bandColor = vec3(1.0);

    // Selección de banda
    if (aBand < 0.5) {
      rawVal = uBassVal;
      amp = uBassAmp;
      punchExp = uBassPunch;
      bandColor = uBassColor;
    } else if (aBand < 1.5) {
      rawVal = uMidVal;
      amp = uMidAmp;
      punchExp = uMidPunch;
      bandColor = uMidColor;
    } else {
      rawVal = uTrebleVal;
      amp = uTrebleAmp;
      punchExp = uTreblePunch;
      bandColor = uTrebleColor;
    }

    // APLICACIÓN DE LA CURVA DE CONTRASTE (PUNCH)
    // pow(rawVal, punchExp) aplana ruidos suaves y multiplica golpes fuertes
    float audioVal = pow(rawVal, punchExp);

    // Intensidad visual modulada
    vColor = bandColor * (0.2 + audioVal * 1.5);

    vec3 targetPos = vec3(0.0);

    if (uMode < 0.5) {
      // MODO 0: ESFERA REACTIVA
      float radius = uBaseRadius + (audioVal * amp);
      targetPos = aSphereDir * radius;
    } else if (uMode < 1.5) {
      // MODO 1: OSCILOSCOPIO 3D (La ola responde al valor de Punch)
      targetPos = aOscPos;
      float wave = sin(aOscPos.x * uWaveFreq + uWavePhase);
      targetPos.y += (audioVal * amp * 3.0) * wave;
    } else {
      // MODO 2: SUELO DE ONDAS (Propagación concéntrica por impacto)
      targetPos = aGroundPos;
      float dist = length(aGroundPos.xz);
      float wave = cos(dist * uWaveFreq - uWavePhase);
      targetPos.y += (audioVal * amp * 3.5) * wave;
    }

    vec4 mvPosition = modelViewMatrix * vec4(targetPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Escala dinámica del tamaño según impacto del golpe
    gl_PointSize = uParticleSize * (300.0 / -mvPosition.z) * (0.8 + audioVal * 1.2);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  varying vec3 vColor;

  void main() {
    vec4 texColor = texture2D(uTexture, gl_PointCoord);
    if (texColor.a < 0.05) discard;

    gl_FragColor = vec4(vColor, texColor.a);
  }
`;

// ================================================
// 6. GEOMETRÍA Y MATERIAL SHADER
// ================================================
const particleCount = 6000;
const particleGeometry = new THREE.BufferGeometry();

const bands = new Float32Array(particleCount);
const sphereDirs = new Float32Array(particleCount * 3);
const oscPositions = new Float32Array(particleCount * 3);
const groundPositions = new Float32Array(particleCount * 3);
const dummyPositions = new Float32Array(particleCount * 3);

const initialColor = new THREE.Color('#00d2ff');

for (let i = 0; i < particleCount; i++) {
  const i3 = i * 3;

  bands[i] = i % 3;

  // Esfera
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos((Math.random() * 2) - 1);
  sphereDirs[i3]     = Math.sin(phi) * Math.cos(theta);
  sphereDirs[i3 + 1] = Math.sin(phi) * Math.sin(theta);
  sphereDirs[i3 + 2] = Math.cos(phi);

  // Osciloscopio
  const progress = i / particleCount;
  oscPositions[i3]     = (progress - 0.5) * 18.0;
  oscPositions[i3 + 1] = Math.sin(progress * Math.PI * 8) * 1.5;
  oscPositions[i3 + 2] = Math.cos(progress * Math.PI * 8) * 1.5;

  // Suelo
  const gridSize = Math.sqrt(particleCount);
  const gx = (i % gridSize) / gridSize - 0.5;
  const gz = Math.floor(i / gridSize) / gridSize - 0.5;
  groundPositions[i3]     = gx * 22.0;
  groundPositions[i3 + 1] = -2.5;
  groundPositions[i3 + 2] = gz * 22.0;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));
particleGeometry.setAttribute('aBand', new THREE.BufferAttribute(bands, 1));
particleGeometry.setAttribute('aSphereDir', new THREE.BufferAttribute(sphereDirs, 3));
particleGeometry.setAttribute('aOscPos', new THREE.BufferAttribute(oscPositions, 3));
particleGeometry.setAttribute('aGroundPos', new THREE.BufferAttribute(groundPositions, 3));

// Uniforms con nuevos parámetros
const particleUniforms = {
  uWavePhase: { value: 0.0 },
  uWaveFreq: { value: 0.8 },
  uMode: { value: 0.0 }, 
  uBaseRadius: { value: 3.5 },
  uParticleSize: { value: 0.22 },

  // Amplitudes
  uBassAmp: { value: 3.0 },
  uMidAmp: { value: 2.2 },
  uTrebleAmp: { value: 1.8 },

  // Exponentes de Impacto (Exponentes > 1.0 aumentan la diferencia entre graves suaves y golpes)
  uBassPunch: { value: 2.5 },
  uMidPunch: { value: 2.0 },
  uTreblePunch: { value: 1.8 },

  // Frecuencias
  uBassVal: { value: 0.0 },
  uMidVal: { value: 0.0 },
  uTrebleVal: { value: 0.0 },

  // Colores
  uBassColor: { value: initialColor.clone() },
  uMidColor: { value: initialColor.clone() },
  uTrebleColor: { value: initialColor.clone() },

  uTexture: { value: createParticleTexture() }
};

const particleMaterial = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms: particleUniforms,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particleSystem);

// Configuración adicional de velocidad de propagación de ola
const waveControls = {
  speedMultiplier: 6.0 // Sensibilidad del avance de la ola por golpe de bajo
};

// ================================================
// 7. CONFIGURACIÓN DE CAMERA SHAKE
// ================================================
const shakeConfig = {
  enabled: true,
  threshold: 0.70,      
  maxIntensity: 0.45,    
  currentIntensity: 0.0
};

// ================================================
// 8. GUI INTERACTIVO COMPLETO
// ================================================
const gui = new GUI({ title: '🎛️ Moduladores de Audio GPU' });

// Modo Visual
const modes = { 'Esfera Reactiva': 0, 'Osciloscopio 3D': 1, 'Suelo de Ondas': 2 };
gui.add(particleUniforms.uMode, 'value', modes).name('📐 Modo Visual');

// Carpeta: Amplitudes y Sensibilidad al Golpe (Punch)
const fAmp = gui.addFolder('🎚️ Respuesta Frecuencial');
fAmp.add(particleUniforms.uBassAmp, 'value', 0.0, 8.0).name('Amp. Graves');
fAmp.add(particleUniforms.uBassPunch, 'value', 1.0, 5.0).name('💥 Impacto/Punch Graves');

fAmp.add(particleUniforms.uMidAmp, 'value', 0.0, 8.0).name('Amp. Medios');
fAmp.add(particleUniforms.uMidPunch, 'value', 1.0, 5.0).name('💥 Impacto/Punch Medios');

fAmp.add(particleUniforms.uTrebleAmp, 'value', 0.0, 8.0).name('Amp. Agudos');
fAmp.add(particleUniforms.uTreblePunch, 'value', 1.0, 5.0).name('💥 Impacto/Punch Agudos');

// Carpeta: Dinámica de Olas
const fWaves = gui.addFolder('🌊 Comportamiento de Olas');
fWaves.add(particleUniforms.uWaveFreq, 'value', 0.2, 2.5).name('Frecuencia/Ruptura');
fWaves.add(waveControls, 'speedMultiplier', 1.0, 15.0).name('Velocidad al Golpear');

// Carpeta: Colores por Banda
const fColors = gui.addFolder('🎨 Colores por Banda');
const colorParams = { bass: '#00d2ff', mids: '#00d2ff', treble: '#00d2ff' };
fColors.addColor(colorParams, 'bass').name('Color Graves').onChange(c => particleUniforms.uBassColor.value.set(c));
fColors.addColor(colorParams, 'mids').name('Color Medios').onChange(c => particleUniforms.uMidColor.value.set(c));
fColors.addColor(colorParams, 'treble').name('Color Agudos').onChange(c => particleUniforms.uTrebleColor.value.set(c));

// Carpeta: Camera Shake
const fShake = gui.addFolder('📳 Sacudida de Cámara');
fShake.add(shakeConfig, 'enabled').name('Activar Shake');
fShake.add(shakeConfig, 'threshold', 0.3, 0.95).name('Umbral Golpe (Bass)');
fShake.add(shakeConfig, 'maxIntensity', 0.05, 1.0).name('Intensidad Máx');

// Carpeta: Post-Procesado
const fPost = gui.addFolder('✨ Post-Procesado');
fPost.add(postProcessingConfig, 'enableBloom').name('Activar Bloom').onChange(v => bloomPass.enabled = v);
fPost.add(postProcessingConfig, 'enableGodRays').name('Activar GodRays').onChange(v => godRaysPass.enabled = v);

// ================================================
// 9. BUCLE DE ANIMACIÓN
// ================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  if (isAudioLoaded && sound.isPlaying) {
    const freqData = analyser.getFrequencyData();

    // 1. Graves (0-7)
    let bassSum = 0;
    for (let i = 0; i < 8; i++) bassSum += freqData[i];
    const bassVal = (bassSum / 8) / 255.0;

    // 2. Medios (8-31)
    let midSum = 0;
    for (let i = 8; i < 32; i++) midSum += freqData[i];
    const midVal = (midSum / 24) / 255.0;

    // 3. Agudos (32-63)
    let trebleSum = 0;
    for (let i = 32; i < 64; i++) trebleSum += freqData[i];
    const trebleVal = (trebleSum / 32) / 255.0;

    // Enviar a los uniforms
    particleUniforms.uBassVal.value = bassVal;
    particleUniforms.uMidVal.value = midVal;
    particleUniforms.uTrebleVal.value = trebleVal;

    // PROPAGACIÓN DINÁMICA DE LA OLA:
    // La fase se incrementa solo según la intensidad del golpe de bajo.
    particleUniforms.uWavePhase.value += (0.4 + bassVal * waveControls.speedMultiplier) * deltaTime;

    // Camera Shake
    if (shakeConfig.enabled && bassVal > shakeConfig.threshold) {
      shakeConfig.currentIntensity = bassVal * shakeConfig.maxIntensity;
    }
  } else {
    // Si no hay música sonando, las olas avanzan muy despacio en reposo
    particleUniforms.uWavePhase.value += 0.5 * deltaTime;
  }

  // Rotación pasiva constante de la escena
  particleSystem.rotation.y = elapsedTime * 0.05;

  controls.update();

  // Temblor de cámara
  if (shakeConfig.currentIntensity > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeConfig.currentIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeConfig.currentIntensity;
    camera.position.z += (Math.random() - 0.5) * shakeConfig.currentIntensity;

    shakeConfig.currentIntensity *= 0.88;
  }

  composer.render();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});