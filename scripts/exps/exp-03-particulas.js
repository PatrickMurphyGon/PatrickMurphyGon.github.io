import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// ================================================
// 1. ESCENA, CÁMARA Y RENDERIZADOR
// ================================================
const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 8, 18);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const gui = new GUI({ title: '🎛️ Panel de Partículas' });

// ================================================
// 2. TEXTURA SUAVE PARA LAS PARTÍCULAS
// ================================================
function createParticleTexture() {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 64;
  canvasTexture.height = 64;
  const ctx = canvasTexture.getContext('2d');

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  return new THREE.CanvasTexture(canvasTexture);
}
const particleTexture = createParticleTexture();

// ================================================
// 3. TIPO 1: NUBE GALÁCTICA (Esférica)
// ================================================
const galaxyConfig = {
  count: 3000,
  size: 0.18,
  color: '#38bdf8',
  speed: 0.2,
  visible: false
};

const galaxyGeometry = new THREE.BufferGeometry();
const galaxyPositions = new Float32Array(galaxyConfig.count * 3);

for (let i = 0; i < galaxyConfig.count * 3; i += 3) {
  const radius = Math.random() * 8;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos((Math.random() * 2) - 1);

  galaxyPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
  galaxyPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
  galaxyPositions[i + 2] = radius * Math.cos(phi);
}

galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3));

const galaxyMaterial = new THREE.PointsMaterial({
  size: galaxyConfig.size,
  color: galaxyConfig.color,
  map: particleTexture,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
galaxyPoints.visible = galaxyConfig.visible;
scene.add(galaxyPoints);

// ================================================
// 4. TIPO 2: LLUVIA DE METEORITOS (Caída Vertical)
// ================================================
const rainConfig = {
  count: 1500,
  size: 0.12,
  color: '#818cf8',
  speed: 0.15,
  visible: false
};

const rainGeometry = new THREE.BufferGeometry();
const rainPositions = new Float32Array(rainConfig.count * 3);

for (let i = 0; i < rainConfig.count * 3; i += 3) {
  rainPositions[i] = (Math.random() - 0.5) * 20;
  rainPositions[i + 1] = Math.random() * 20;
  rainPositions[i + 2] = (Math.random() - 0.5) * 20;
}

rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

const rainMaterial = new THREE.PointsMaterial({
  size: rainConfig.size,
  color: rainConfig.color,
  map: particleTexture,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const rainPoints = new THREE.Points(rainGeometry, rainMaterial);
rainPoints.visible = rainConfig.visible;
scene.add(rainPoints);

// ================================================
// 5. TIPO 3: ASCUAS DE FUEGO (Ascendentes)
// ================================================
const fireConfig = {
  count: 1000,
  size: 0.25,
  color: '#f89538',
  speed: 0.05,
  visible: false
};

const fireGeometry = new THREE.BufferGeometry();
const firePositions = new Float32Array(fireConfig.count * 3);

for (let i = 0; i < fireConfig.count * 3; i += 3) {
  firePositions[i] = (Math.random() - 0.5) * 2;
  firePositions[i + 1] = Math.random() * 6;
  firePositions[i + 2] = (Math.random() - 0.5) * 2;
}

fireGeometry.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));

const fireMaterial = new THREE.PointsMaterial({
  size: fireConfig.size,
  color: fireConfig.color,
  map: particleTexture,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const firePoints = new THREE.Points(fireGeometry, fireMaterial);
firePoints.visible = fireConfig.visible;
scene.add(firePoints);


// ================================================
// 6. TIPO 4: ANILLO ORBITAL (Toroide)
// ================================================

const textureLoader = new THREE.TextureLoader();
const customTextureHeart = textureLoader.load('../../assets/textures/heart.png');

const ringConfig = {
  count: 20000,
  size: 0.9,
  colors: ['#0dff21', '#ff9af7'],
  speed: 0.4,
  innerRadius: 5,
  outerRadius: 10,
  thicknessY: 0.5,
  visible: true
};

const ringGeometry = new THREE.BufferGeometry();
const ringPositions = new Float32Array(ringConfig.count * 3);
const ringColors = new Float32Array(ringConfig.count * 3);

ringGeometry.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
ringGeometry.setAttribute('color', new THREE.BufferAttribute(ringColors, 3));

function updateRingPositions() {
  const positions = ringGeometry.attributes.position.array;

  for (let i = 0; i < ringConfig.count * 3; i += 3) {
    const angle = Math.random() * Math.PI * 2;
    const radius = ringConfig.innerRadius + Math.random() * (ringConfig.outerRadius - ringConfig.innerRadius);

    positions[i]     = Math.cos(angle) * radius;
    positions[i + 1] = (Math.random() - 0.5) * ringConfig.thicknessY;
    positions[i + 2] = Math.sin(angle) * radius;
  }

  ringGeometry.attributes.position.needsUpdate = true;
}

// La ejecutamos una vez al arrancar para crear la forma inicial
updateRingPositions();

// 2. Función para pintar las partículas leyendo directamente desde ringConfig.colors
const tempColor = new THREE.Color();

function updateRingColors() {
  const colors = ringGeometry.attributes.color.array;

  for (let i = 0; i < ringConfig.count; i++) {
    const i3 = i * 3;

    // Selecciona un color aleatorio de tu lista en cada iteración
    const randomHex = ringConfig.colors[Math.floor(Math.random() * ringConfig.colors.length)];
    tempColor.set(randomHex);

    colors[i3]     = tempColor.r;
    colors[i3 + 1] = tempColor.g;
    colors[i3 + 2] = tempColor.b;
  }
  
  // Notificar actualización a Three.js
  ringGeometry.attributes.color.needsUpdate = true;
}

// Generamos los colores iniciales
updateRingColors();

// 2. Asignamos tanto posiciones como colores a la geometría
ringGeometry.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
ringGeometry.setAttribute('color', new THREE.BufferAttribute(ringColors, 3));

const ringMaterial = new THREE.PointsMaterial({
  size: ringConfig.size,
  map: customTextureHeart,
  transparent: true,
  vertexColors: true, // Le dice al material que lea los colores de la geometría
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const ringPoints = new THREE.Points(ringGeometry, ringMaterial);
ringPoints.visible = ringConfig.visible;
scene.add(ringPoints);

// ================================================
// 6.5. TIPO 5: ONDA DE PARTÍCULAS CUSTOM
// ================================================

// 1. Cargador de texturas de Three.js
const customTexture = textureLoader.load('../../assets/textures/apple.png');

// 2. Configuración para el menú LIL-GUI
const waveConfig = {
  count: 50,          // Cantidad de partículas en la línea
  size: 0.4,           // Tamaño del sprite
  color: '#ff0000',    // Color Turquesa/Neón
  speed: 3.0,          // Velocidad del desplazamiento de la onda
  frequency: 0.4,      // Cantidad de crestas/valles
  amplitude: 1.5,      // Altura máxima de la onda (subida/bajada)
  visible: true
};

const waveGeometry = new THREE.BufferGeometry();
const wavePositions = new Float32Array(waveConfig.count * 3);

// 3. Posicionar partículas en una LÍNEA RECTA a lo largo del eje X
const lineLength = 20; // La línea mide 20 unidades (de X = -10 a X = 10)

for (let i = 0; i < waveConfig.count; i++) {
  // Calculamos la posición X equitativamente repartida
  const x = - (lineLength / 2) + (i / waveConfig.count) * lineLength;
  
  wavePositions[i * 3]     = x; // Posición X
  wavePositions[i * 3 + 1] = 0; // Posición Y inicial
  wavePositions[i * 3 + 2] = 0; // Posición Z inicial (Línea recta en el centro)
}

waveGeometry.setAttribute('position', new THREE.BufferAttribute(wavePositions, 3));

// 4. Material usando tu textura custom
const waveMaterial = new THREE.PointsMaterial({
  size: waveConfig.size,
  color: waveConfig.color,
  map: customTexture,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const wavePoints = new THREE.Points(waveGeometry, waveMaterial);
wavePoints.visible = waveConfig.visible;
scene.add(wavePoints);


// ================================================
// 7. CONTROLES DEL MENÚ (LIL-GUI)
// ================================================

// Galaxia
const fGalaxy = gui.addFolder('1. Galaxia');
fGalaxy.add(galaxyConfig, 'visible').onChange(v => galaxyPoints.visible = v);
fGalaxy.add(galaxyConfig, 'size', 0.01, 1).onChange(s => galaxyMaterial.size = s);
fGalaxy.add(galaxyConfig, 'speed', 0, 100);
fGalaxy.addColor(galaxyConfig, 'color').onChange(c => galaxyMaterial.color.set(c));

// LLuvia
const fRain = gui.addFolder('2. Lluvia');
fRain.add(rainConfig, 'visible').onChange(v => rainPoints.visible = v);
fRain.add(rainConfig, 'size', 0.01, 1).onChange(s => rainMaterial.size = s);
fRain.add(rainConfig, 'speed', 0, 10);
fRain.addColor(rainConfig, 'color').onChange(c => rainMaterial.color.set(c));

// Fuego
const fFire = gui.addFolder('3. Fuego');
fFire.add(fireConfig, 'visible').onChange(v => firePoints.visible = v);
fFire.add(fireConfig, 'size', 0.01, 1).onChange(s => fireMaterial.size = s);
fFire.add(fireConfig, 'speed', 0, 10);
fFire.addColor(fireConfig, 'color').onChange(c => fireMaterial.color.set(c));

// Anillo
const fRing = gui.addFolder('4. Anillo Orbital');
fRing.add(ringConfig, 'visible').onChange(v => ringPoints.visible = v);
fRing.add(ringConfig, 'size', 0.01, 1).onChange(s => ringMaterial.size = s);
fRing.add(ringConfig, 'speed', 0, 2);
fRing.add(ringConfig, 'innerRadius', 1, 10).name('Radio Interior').onChange(updateRingPositions);
fRing.add(ringConfig, 'outerRadius', 1, 20).name('Radio Exterior').onChange(updateRingPositions);
fRing.add(ringConfig, 'thicknessY', 0.1, 10).name('Grosor Y').onChange(updateRingPositions);                                                        
fRing.addColor(ringConfig.colors, 0).name('Color 1').onChange(() => updateRingColors()); // Apuntamos al Array (ringConfig.colors) pasando la posición del índice (0 y 1)
fRing.addColor(ringConfig.colors, 1).name('Color 2').onChange(() => updateRingColors());

// Carpeta 5: Onda Custom
const fWave = gui.addFolder('5. Onda Custom');
fWave.add(waveConfig, 'visible').onChange(v => wavePoints.visible = v);
fWave.add(waveConfig, 'size', 0.05, 1.2).onChange(s => waveMaterial.size = s);
fWave.add(waveConfig, 'speed', 0.5, 8.0);
fWave.add(waveConfig, 'frequency', 0.1, 2.0);
fWave.add(waveConfig, 'amplitude', 0.1, 4.0);
fWave.addColor(waveConfig, 'color').onChange(c => waveMaterial.color.set(c));


// ================================================
// 8. BUCLE DE ANIMACIÓN
// ================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  // 1. Galaxia
  if (galaxyPoints.visible) {
    galaxyPoints.rotation.y = elapsedTime * galaxyConfig.speed * 0.2;
  }

  // 2. Lluvia
  if (rainPoints.visible) {
    const positions = rainGeometry.attributes.position.array;
    for (let i = 1; i < rainPositions.length; i += 3) {
      positions[i] -= rainConfig.speed;
      if (positions[i] < 0) positions[i] = 20;
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }

  // 3. Fuego
  if (firePoints.visible) {
    const positions = fireGeometry.attributes.position.array;
    for (let i = 0; i < firePositions.length; i += 3) {
      positions[i + 1] += fireConfig.speed;
      positions[i] += Math.sin(elapsedTime * 3 + positions[i + 1]) * 0.01;

      if (positions[i + 1] > 6) {
        positions[i + 1] = 0;
        positions[i] = (Math.random() - 0.5) * 2;
      }
    }
    fireGeometry.attributes.position.needsUpdate = true;
  }

  // 4. Anillo Orbital
  if (ringPoints.visible) {
    ringPoints.rotation.y = -elapsedTime * ringConfig.speed * 0.3;
    ringPoints.position.y = Math.sin(elapsedTime * 2) * 0.3;
  }

  // 5. Animación: Onda Senoidal en línea recta
  if (wavePoints.visible) {
    const positions = waveGeometry.attributes.position.array;

    for (let i = 0; i < waveConfig.count; i++) {
      const x = positions[i * 3]; // Leemos la coordenada X constante
      
      // Cálculo de la onda: Y = Seno( Tiempo * Velocidad + X * Frecuencia ) * Amplitud
      positions[i * 3 + 1] = Math.sin(elapsedTime * waveConfig.speed + x * waveConfig.frequency) * waveConfig.amplitude;
    }

    // Indicar a Three.js que hemos modificado la posición Y de los puntos
    waveGeometry.attributes.position.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Ajuste al redimensionar ventana
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});