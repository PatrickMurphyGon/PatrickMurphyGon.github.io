import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// IMPORTS DE POSTPROCESADO
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// SHADERS EXTERNOS Y CONTROLADOR DE RADIO
import { GodRaysShader, setGodRaysParams } from '../../assets/shaders/GodRaysShader.js';
import { RadioController } from '../radioController.js';

// ================================================
// 1. ESCENA, CÁMARA Y RENDERIZADOR BASE
// ================================================
const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
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
    0.5,    // Intensidad del resplandor
    0.5,    // Radio de dispersión
    0.2     // Umbral
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
// 3. SISTEMA DE AUDIO Y CONTROLADOR DE RADIO
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

// Inicialización del controlador de Radio en JS independiente
const radioController = new RadioController({
    sound: sound,
    listener: listener,
    onStatusChange: (message) => {
        if (audioStatus) audioStatus.innerText = message;
    }
});

// Eventos de Subida de MP3 Local
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
            // Notificar al radioController de que cambiamos a modo MP3
            radioController.onLocalMp3Active();

            if (sound.isPlaying) sound.stop();
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setVolume(volumeSlider ? parseFloat(volumeSlider.value) : 0.5);
            sound.play();

            audioStatus.innerText = `Sonando: ${file.name}`;
            radioController.updateUI();
        });
    });
}

// Botón de reproducción/pausa unificado
if (btnPlay) {
    btnPlay.addEventListener('click', () => {
        radioController.togglePlayPause();
    });
}

// Control único de volumen para MP3 y Radio
if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        sound.setVolume(parseFloat(e.target.value));
    });
}

// ================================================
// 4. TEXTURAS PARA LAS PARTÍCULAS
// ================================================

// Cargador de particulas
const textureLoader = new THREE.TextureLoader();
const customTextureHeart = textureLoader.load('../../assets/textures/heart.png');
customTextureHeart.flipY = false;

// Crear particula desde 0
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
// 5. SHADERS GLSL EN GPU
// ================================================
const vertexShader = `
  attribute float aBand;          
  attribute vec3 aSphereDir;      
  attribute vec3 aOscPos;         
  attribute vec3 aGroundPos;      

  uniform float uMode;            
  uniform float uWavePhase;       
  uniform float uWaveFreq;        
  uniform float uBaseRadius;
  uniform float uParticleSize;

  // 4 Bandas de audio
  uniform float uBassAmp, uMidAmp, uHighMidAmp, uTrebleAmp;
  uniform float uBassPunch, uMidPunch, uHighMidPunch, uTreblePunch;
  uniform float uBassVal, uMidVal, uHighMidVal, uTrebleVal;
  uniform vec3 uBassColor, uMidColor, uHighMidColor, uTrebleColor;

  varying vec3 vColor;

  void main() {
    float rawVal = 0.0;
    float amp = 1.0;
    float punchExp = 1.0;
    vec3 bandColor = vec3(1.0);

    if (aBand < 0.5) {            // Grupo 0: Graves
      rawVal = uBassVal; amp = uBassAmp; punchExp = uBassPunch; bandColor = uBassColor;
    } else if (aBand < 1.5) {     // Grupo 1: Medios
      rawVal = uMidVal; amp = uMidAmp; punchExp = uMidPunch; bandColor = uMidColor;
    } else if (aBand < 2.5) {     // Grupo 2: Agudos
      rawVal = uHighMidVal; amp = uHighMidAmp; punchExp = uHighMidPunch; bandColor = uHighMidColor;
    } else {                      // Grupo 3: Super Agudos
      rawVal = uTrebleVal; amp = uTrebleAmp; punchExp = uTreblePunch; bandColor = uTrebleColor;
    }

    float audioVal = pow(rawVal, punchExp);
    vColor = bandColor * (0.4 + audioVal * 3.0);

    vec3 targetPos = vec3(0.0);

    if (uMode < 0.5) {
      float radius = uBaseRadius + (audioVal * amp);
      targetPos = aSphereDir * radius;
    } else if (uMode < 1.5) {
      targetPos = aOscPos;
      float wave = sin(aOscPos.x * uWaveFreq + uWavePhase);
      targetPos.y += (audioVal * amp * 1.0) * wave;
    } else {
      targetPos = aGroundPos;
      float dist = length(aGroundPos.xz);
      float wave = cos(dist * uWaveFreq - uWavePhase);
      targetPos.y += (audioVal * amp * 1.0) * wave;
    }

    vec4 mvPosition = modelViewMatrix * vec4(targetPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

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

const particleCount = 10000;                           // Nº total de puntos a renderizar
const particleGeometry = new THREE.BufferGeometry();  // Contenedor de geometría rápida optimizada para GPU

// Buffers numéricos para almacenar datos individuales de cada partícula
const bands = new Float32Array(particleCount);                // Tipo de frecuencia (0=Graves, 1=Medios, 2=Agudos)        
const sphereDirs = new Float32Array(particleCount * 3);       // Vectores de dirección para el modo Esfera
const oscPositions = new Float32Array(particleCount * 3);     // Posiciones para el modo Osciloscopio (línea/espiral)
const groundPositions = new Float32Array(particleCount * 3);  // Posiciones para el modo Suelo (malla plana)
const dummyPositions = new Float32Array(particleCount * 3);   // Buffer vacío necesario por requisito de Three.js

// Colores iniciales (Hex)
const colorBass = '#6600ff';
const colorMid = '#ff8800';
const colorHighMid = '#ff55c6';
const colorTreble = '#00d2ff';
// Objetos de color nativos de Three.js
const initialColorBass = new THREE.Color(colorBass);
const initialColorMid = new THREE.Color(colorMid);
const initialColorHighMid = new THREE.Color(colorHighMid);
const initialColorTreble = new THREE.Color(colorTreble);

// Dimensiones del plano
const planeWidth    = 50.0;  // Eje X: Aumenta este valor para hacerlo más ancho
const planeDepth    = 30.0;  // Eje Z: Modifica este valor para la profundidad
const planeHeight   = -2.5;  // Eje Y: Altura a la que flota el suelo

// CALCULO DE GEOMETRÍAS ===========
for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3; // Índice base para coordenadas 3D (X, Y, Z)
    bands[i] = i % 4; // Asigna a cada partícula un grupo de audio rotativo (0, 1 o 2)

    // A) MODO ESFERA: Calcula una dirección aleatoria uniforme hacia afuera
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    sphereDirs[i3] = Math.sin(phi) * Math.cos(theta);
    sphereDirs[i3 + 1] = Math.sin(phi) * Math.sin(theta);
    sphereDirs[i3 + 2] = Math.cos(phi);

    // B) MODO OSCILOSCOPIO: Modela una espiral/onda a lo largo del eje X
    const progress = i / particleCount;
    oscPositions[i3]     = (progress - 0.5) * 18.0;
    oscPositions[i3 + 1] = Math.sin(progress * Math.PI * 8) * 1.5;
    oscPositions[i3 + 2] = Math.cos(progress * Math.PI * 8) * 1.5;

    // C) MODO SUELO: Distribuye los puntos en una cuadrícula plana (plano XZ)
    const gridSize = Math.sqrt(particleCount);
    const gx = (i % gridSize) / gridSize - 0.5;
    const gz = Math.floor(i / gridSize) / gridSize - 0.5;
    groundPositions[i3]     = gx * planeWidth;
    groundPositions[i3 + 1] = planeHeight;
    groundPositions[i3 + 2] = gz * planeDepth;
}

// Envía los arrays a la tarjeta gráfica para que los Shaders puedan usarlos
particleGeometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));
particleGeometry.setAttribute('aBand', new THREE.BufferAttribute(bands, 1));
particleGeometry.setAttribute('aSphereDir', new THREE.BufferAttribute(sphereDirs, 3));
particleGeometry.setAttribute('aOscPos', new THREE.BufferAttribute(oscPositions, 3));
particleGeometry.setAttribute('aGroundPos', new THREE.BufferAttribute(groundPositions, 3));

// 4. UNIFORMS (VARIABLES GLOBALES ENVIADAS AL SHADER)
const particleUniforms = {
    // Ajustes de animación y forma
    uWavePhase: { value: 0.0 },       // Fase actual de movimiento de ol
    uWaveFreq: { value: 0.8 },        // Frecuencia/densidad de la ola
    uMode: { value: 0.0 },            // Modo visual activo (0 = Esfera, 1 = Osciloscopio, 2 = Suelo)
    uBaseRadius: { value: 3.5 },      // Radio base para la esfera
    uParticleSize: { value: 0.22 },   // Escala inicial de cada partícula (0.22)

    // Multiplicadores de expansión por frecuencia
    uBassAmp: { value: 5.0 },
    uMidAmp: { value: 4.0 },
    uHighMidAmp: { value: 2.5 },
    uTrebleAmp: { value: 1.8 },

    // Sensibilidad a los golpes (exponente para acentuar beats fuertes)
    uBassPunch: { value: 3.0 },
    uMidPunch: { value: 1.8 },
    uHighMidPunch: { value: 2.5 },
    uTreblePunch: { value: 2.5 },

    // Nivel de audio en tiempo real desde el analizador (rango 0.0 a 1.0)
    uBassVal: { value: 0.0 },
    uMidVal: { value: 0.0 },
    uHighMidVal: { value: 0.0 },
    uTrebleVal: { value: 0.0 },

    // Colores dinámicos por banda
    uBassColor: { value: initialColorBass.clone() },
    uMidColor: { value: initialColorMid.clone() },
    uHighMidColor: { value: initialColorHighMid.clone() },
    uTrebleColor: { value: initialColorTreble.clone() },

    // Textura asignada a cada partícula
    uTexture: { value: customTextureHeart }
};

// Material de las partículas
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

const waveControls = { speedMultiplier: 6.0 };

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
// 8. PANEL DE CONTROL INTERACTIVO (LIL-GUI)
// ================================================
const gui = new GUI({ title: '🎛️ Moduladores de Audio GPU' });

const modes = { 'Esfera Reactiva': 0, 'Osciloscopio 3D': 1, 'Suelo de Ondas': 2 };
gui.add(particleUniforms.uMode, 'value', modes).name('📐 Modo Visual');

const fAmp = gui.addFolder('🎚️ Respuesta Frecuencial');
fAmp.add(particleUniforms.uBassAmp, 'value', 0.0, 8.0).name('Amp. Graves');
fAmp.add(particleUniforms.uBassPunch, 'value', 1.0, 5.0).name('💥 Impacto/Punch Graves');

fAmp.add(particleUniforms.uMidAmp, 'value', 0.0, 8.0).name('Amp. Medios');
fAmp.add(particleUniforms.uMidPunch, 'value', 1.0, 5.0).name('💥 Impacto/Punch Medios');

fAmp.add(particleUniforms.uHighMidAmp, 'value', 0.0, 8.0).name('Amp. Agudos');
fAmp.add(particleUniforms.uHighMidPunch, 'value', 1.0, 5.0).name('💥 Impacto Agudos');

fAmp.add(particleUniforms.uTrebleAmp, 'value', 0.0, 8.0).name('Amp. Super Agudos');
fAmp.add(particleUniforms.uTreblePunch, 'value', 1.0, 5.0).name('💥 Impacto Super Ag.');

const fWaves = gui.addFolder('🌊 Comportamiento de Olas');
fWaves.add(particleUniforms.uWaveFreq, 'value', 0.2, 2.5).name('Frecuencia/Ruptura');
fWaves.add(waveControls, 'speedMultiplier', 1.0, 15.0).name('Velocidad al Golpear');

const fColors = gui.addFolder('🎨 Colores por Banda');
const colorParams = { bass: colorBass, mids: colorMid, highMid: colorHighMid, treble: colorTreble };
fColors.addColor(colorParams, 'bass').name('Color Graves').onChange(c => particleUniforms.uBassColor.value.set(c));
fColors.addColor(colorParams, 'mids').name('Color Medios').onChange(c => particleUniforms.uMidColor.value.set(c));
fColors.addColor(colorParams, 'highMid').name('Color Agudos').onChange(c => particleUniforms.uHighMidColor.value.set(c));
fColors.addColor(colorParams, 'treble').name('Color Super Ag.').onChange(c => particleUniforms.uTrebleColor.value.set(c));

const fShake = gui.addFolder('📳 Sacudida de Cámara');
fShake.add(shakeConfig, 'enabled').name('Activar Shake');
fShake.add(shakeConfig, 'threshold', 0.3, 0.95).name('Umbral Golpe (Bass)');
fShake.add(shakeConfig, 'maxIntensity', 0.05, 1.0).name('Intensidad Máx');

const fPost = gui.addFolder('✨ Post-Procesado');
fPost.add(postProcessingConfig, 'enableBloom').name('Activar Bloom').onChange(v => bloomPass.enabled = v);
fPost.add(postProcessingConfig, 'enableGodRays').name('Activar GodRays').onChange(v => godRaysPass.enabled = v);

// ================================================
// 9. BUCLE DE ANIMACIÓN Y RENDER // Configuración de Audio
// ================================================

// CONFIGURACIÓN CENTRALIZADA DE CANALES Y SENSIBILIDAD
// Rango disponible de canales FFT: 0 a 63
const audioBandsConfig = {
  bass:     { startBin: 0,  endBin: 1,  boost: 1.0 }, // 0: Graves (Bombo / Sub)
  mid:      { startBin: 1,  endBin: 9, boost: 1.0 }, // 1: Medios (Voces / Bajos)
  highMid:  { startBin: 9, endBin: 24, boost: 1.8 }, // 2: Agudos (Cajas / Platillos)
  treble:   { startBin: 24, endBin: 50, boost: 3.5 }  // 3: Super Agudos (Brillo / Aire)
};

// Calcula el volumen promedio normalizado (0.0 a 1.0) para un rango de canales FFT
function getBandValue(freqData, config) {
    const { startBin, endBin, boost } = config;
    const count = endBin - startBin;
    if (count <= 0) return 0.0;

    let sum = 0;
    for (let i = startBin; i < endBin; i++) {
        sum += freqData[i];
    }

    const average = (sum / count) / 255.0;
    return Math.min(1.0, average * boost); // Clampeamos el valor máximo a 1.0
}

// Bucle de animación =========================
const clock = new THREE.Clock();

let currentWaveSpeed = 0.3;

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // Evaluamos si la fuente de audio está activa mediante nuestro radioController
    if (radioController.isAudioActive()) {
        const freqData = analyser.getFrequencyData();

        // Obtenemos los valores usando nuestra nueva función modular
        const bassVal = getBandValue(freqData, audioBandsConfig.bass);
        const midVal = getBandValue(freqData, audioBandsConfig.mid);
        const highMidVal = getBandValue(freqData, audioBandsConfig.highMid);
        const trebleVal = getBandValue(freqData, audioBandsConfig.treble);

        // Actualizamos los uniforms del shader
        particleUniforms.uBassVal.value = bassVal;
        particleUniforms.uMidVal.value = midVal;
        particleUniforms.uHighMidVal.value = highMidVal;
        particleUniforms.uTrebleVal.value = trebleVal;

        // Configuraciones de las ondas (Olas)
        const targetSpeed = 0.3 + Math.pow(bassVal, 2.0) * (waveControls.speedMultiplier * 0.3);    // 1. Aceleración atenuada exponencialmente (multiplicador reducido de 6.0 a ~1.8)
        currentWaveSpeed += (targetSpeed - currentWaveSpeed) * 0.1;                                 // 2. Interpolar (LERP) la velocidad para que no dé tirones bruscos
        particleUniforms.uWavePhase.value += currentWaveSpeed * deltaTime;                          // 3. Aplicar el avance de fase fluido

        // Sacudida de cámara con los golpes de bombo
        if (shakeConfig.enabled && bassVal > shakeConfig.threshold) {
            shakeConfig.currentIntensity = bassVal * shakeConfig.maxIntensity;
        }
    } else {
        // Si la música está pausada, la animación en reposo desacelera
        particleUniforms.uWavePhase.value += 0.5 * deltaTime;
    }

    particleSystem.rotation.y = elapsedTime * 0.05;

    controls.update();

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