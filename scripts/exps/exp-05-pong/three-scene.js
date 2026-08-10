import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 1. ESCENA, CÁMARA Y RENDERIZADOR BASE
const canvas = document.getElementById('webgl');
export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 20, 0);
camera.lookAt(0, 0, 0);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 2. POST-PROCESADO (BLOOM NEÓN)
export const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.4, // Intensidad del brillo
  0.9, // Radio de dispersión
  0.1  // Umbral
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// 3. ILUMINACIÓN
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

// 4. DIMENSIONES VISIBLES Y SUELO NEÓN
export function getVisibleDimensions() {
  const aspect = window.innerWidth / window.innerHeight;
  const vFOV = THREE.MathUtils.degToRad(camera.fov);
  const distance = camera.position.y;

  const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
  const visibleWidth = visibleHeight * aspect;

  return { width: visibleWidth, height: visibleHeight };
}

const floorDims = getVisibleDimensions();
const floorGeometry = new THREE.PlaneGeometry(floorDims.width, floorDims.height, 40, 24);
const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x002222, wireframe: true });

export const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// 5. CREACIÓN DE PALAS Y BOLA (GEOMETRÍAS Y MATERIALES NEÓN)
const paddleGeo = new THREE.BoxGeometry(0.6, 0.5, 3.5);
const ballGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);

const matLeft = new THREE.MeshBasicMaterial({ color: 0xff0055 });  // Rosa Neón
const matRight = new THREE.MeshBasicMaterial({ color: 0x00ff88 }); // Verde Neón
const matBall = new THREE.MeshBasicMaterial({ color: 0xffee00 });  // Amarillo Neón

export const paddleLeft = new THREE.Mesh(paddleGeo, matLeft);
export const paddleRight = new THREE.Mesh(paddleGeo, matRight);
export const ball = new THREE.Mesh(ballGeo, matBall);

scene.add(paddleLeft, paddleRight, ball);

// Resetea las posiciones de las palas y la bola según la pantalla
export function resetPositions() {
  const dims = getVisibleDimensions();
  const margin = 2;

  paddleLeft.position.set(-dims.width / 2 + margin, 0.3, 0);
  paddleRight.position.set(dims.width / 2 - margin, 0.3, 0);
  ball.position.set(0, 0.3, 0);
}

// Inicializar posiciones al cargar
resetPositions();

// 🛠️ FUNCIÓN DE REDIMENSIÓN Y REAJUSTE DE POSICIÓN DE PALAS
export function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  const newDims = getVisibleDimensions();
  floor.geometry.dispose();
  floor.geometry = new THREE.PlaneGeometry(newDims.width, newDims.height, 40, 24);

  // Reajustar la posición X de las palas a los nuevos bordes de la pantalla
  const margin = 2;
  paddleLeft.position.x = -newDims.width / 2 + margin;
  paddleRight.position.x = newDims.width / 2 - margin;
}

// Evento al cambiar el tamaño de ventana
window.addEventListener('resize', handleResize);

// Evento específico para giros en móviles (con un pequeño retardo para asegurar las nuevas dimensiones)
window.addEventListener('orientationchange', () => {
  setTimeout(handleResize, 150);
});