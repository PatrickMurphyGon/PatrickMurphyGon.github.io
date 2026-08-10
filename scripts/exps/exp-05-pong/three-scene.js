import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 1. ESCENA, CÁMARA Y RENDERIZADOR BASE
const canvas = document.getElementById('webgl');
export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
const baseCameraPos = new THREE.Vector3(0, 20, 0);
camera.position.copy(baseCameraPos);
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
  0.5,
  0.5,
  0.1
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// 3. ILUMINACIÓN
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// 4. DIMENSIONES VISIBLES
export function getVisibleDimensions() {
  const aspect = window.innerWidth / window.innerHeight;
  const vFOV = THREE.MathUtils.degToRad(camera.fov);
  const distance = camera.position.y;

  const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
  const visibleWidth = visibleHeight * aspect;

  return { width: visibleWidth, height: visibleHeight };
}

// 5. FONDO DINÁMICO NEÓN (LÍNEAS DE CAMPO Y POLVO ESTELAR)
const fieldGroup = new THREE.Group();
scene.add(fieldGroup);

let topWall, bottomWall, centerLine, bgParticles;

function createNeonField() {
  while (fieldGroup.children.length > 0) {
    const child = fieldGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
    fieldGroup.remove(child);
  }

  const dims = getVisibleDimensions();
  const topBottomLimit = dims.height / 2 - 0.1;

  const wallGeo = new THREE.BoxGeometry(dims.width, 0.1, 0.1);
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x00a8cc });

  topWall = new THREE.Mesh(wallGeo, wallMat);
  topWall.position.set(0, 0.1, -topBottomLimit);

  bottomWall = new THREE.Mesh(wallGeo, wallMat);
  bottomWall.position.set(0, 0.1, topBottomLimit);

  fieldGroup.add(topWall, bottomWall);

  const points = [];
  const segments = 25;
  const step = dims.height / segments;
  for (let i = 0; i < segments; i += 2) {
    const z1 = -dims.height / 2 + i * step;
    const z2 = -dims.height / 2 + (i + 1) * step;
    points.push(new THREE.Vector3(0, 0.05, z1));
    points.push(new THREE.Vector3(0, 0.05, z2));
  }
  const centerGeo = new THREE.BufferGeometry().setFromPoints(points);
  const centerMat = new THREE.LineBasicMaterial({ color: 0x00a8cc, transparent: true, opacity: 0.35 });
  centerLine = new THREE.LineSegments(centerGeo, centerMat);
  fieldGroup.add(centerLine);

  const particleCount = 120;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    particlePositions[i] = (Math.random() - 0.5) * dims.width * 1.2;
    particlePositions[i + 1] = -1.5 - Math.random() * 2;
    particlePositions[i + 2] = (Math.random() - 0.5) * dims.height * 1.2;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x00a8cc,
    size: 0.15,
    transparent: true,
    opacity: 0.3
  });
  bgParticles = new THREE.Points(particleGeo, particleMat);
  fieldGroup.add(bgParticles);
}

createNeonField();

// 🎨 PALETA DE TRANSICIÓN DE COLOR
const colorBase = new THREE.Color(0x00a8cc);
const colorWarning = new THREE.Color(0xd48800);
const colorDanger = new THREE.Color(0xd00028);
const colorWhite = new THREE.Color(0xffffff);
const colorIntenseRed = new THREE.Color(0xff0000);

const tempColor = new THREE.Color();

let baseColorLeft = null;
let baseColorRight = null;
let baseColorBall = null;

export function updateFieldColor(currentSpeed, minSpeed, maxSpeed, isHyperActive = false) {
  if (!topWall || !centerLine || !bgParticles) return;

  if (!baseColorLeft) {
    baseColorLeft = paddleLeft.material.color.clone();
    baseColorRight = paddleRight.material.color.clone();
    baseColorBall = ball.material.color.clone();
  }

  // 🚨 MODO HIPER MÁXIMA VELOCIDAD (MATCH POINT)
  if (isHyperActive) {
    topWall.material.color.copy(colorWhite);
    bottomWall.material.color.copy(colorWhite);
    centerLine.material.color.copy(colorWhite);
    bgParticles.material.color.copy(colorWhite);

    paddleLeft.material.color.copy(colorIntenseRed);
    paddleRight.material.color.copy(colorIntenseRed);
    ball.material.color.copy(colorIntenseRed);
    return;
  }

  // RESTAURAR COLORES BASE
  paddleLeft.material.color.copy(baseColorLeft);
  paddleRight.material.color.copy(baseColorRight);
  ball.material.color.copy(baseColorBall);

  // GRADIENTE NORMAL SEGÚN VELOCIDAD
  const factor = THREE.MathUtils.clamp((currentSpeed - minSpeed) / (maxSpeed - minSpeed), 0, 1);

  if (factor < 0.5) {
    const t = Math.pow(factor / 0.5, 2) * 0.2;
    tempColor.copy(colorBase).lerp(colorWarning, t);
  } else if (factor < 0.8) {
    const t = (factor - 0.5) / 0.3;
    const startColor = colorBase.clone().lerp(colorWarning, 0.2);
    tempColor.copy(startColor).lerp(colorWarning, t);
  } else {
    const t = (factor - 0.8) / 0.2;
    tempColor.copy(colorWarning).lerp(colorDanger, t);
  }

  topWall.material.color.copy(tempColor);
  bottomWall.material.color.copy(tempColor);
  centerLine.material.color.copy(tempColor);
  bgParticles.material.color.copy(tempColor);
}

// 6. CREACIÓN DE PALAS Y BOLA NEÓN (CON ESCALA PROPORCIONAL)
// La profundidad base es 1 unidad para poder escalarla mediante scale.z
const paddleGeo = new THREE.BoxGeometry(0.6, 0.5, 1);
const ballGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);

const matLeft = new THREE.MeshBasicMaterial({ color: 0xff0055 });
const matRight = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
const matBall = new THREE.MeshBasicMaterial({ color: 0xffee00 });

/** @type {THREE.Mesh} */
export const paddleLeft = new THREE.Mesh(paddleGeo, matLeft);
/** @type {THREE.Mesh} */
export const paddleRight = new THREE.Mesh(paddleGeo, matRight);
/** @type {THREE.Mesh} */
export const ball = new THREE.Mesh(ballGeo, matBall);

scene.add(paddleLeft, paddleRight, ball);

// PORCENTAJE DEL CAMPO VISIBLE QUE OCUPARÁN LAS PALAS (22%)
export const PADDLE_HEIGHT_RATIO = 0.22;

export function updatePaddleSizes() {
  const dims = getVisibleDimensions();
  const paddleHeight = dims.height * PADDLE_HEIGHT_RATIO;

  paddleLeft.scale.z = paddleHeight;
  paddleRight.scale.z = paddleHeight;
}

export function resetPositions() {
  const dims = getVisibleDimensions();
  const margin = 2;

  updatePaddleSizes(); // Actualiza escala de las palas al resetear

  paddleLeft.position.set(-dims.width / 2 + margin, 0.3, 0);
  paddleRight.position.set(dims.width / 2 - margin, 0.3, 0);
  ball.position.set(0, 0.3, 0);
}

resetPositions();

// 7. OVERLAY DE SOMBRA OSCURA EN BORDES (VIGNETTE)
let vignetteElem = document.getElementById('vignette-overlay');
if (!vignetteElem) {
  vignetteElem = document.createElement('div');
  vignetteElem.id = 'vignette-overlay';
  vignetteElem.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 10;
    background: radial-gradient(circle, transparent 40%, rgba(0, 0, 0, 0.95) 100%);
    opacity: 0;
    transition: opacity 0.2s ease;
  `;
  document.body.appendChild(vignetteElem);
}

export function toggleVignette(active) {
  if (vignetteElem) {
    vignetteElem.style.opacity = active ? '1' : '0';
  }
}

// 8. SHAKE DE CÁMARA
let shakeTimer = 0;
let shakeIntensity = 0;

export function startCameraShake(duration = 2.0, intensity = 0.6) {
  shakeTimer = duration;
  shakeIntensity = intensity;
}

// 9. EFECTOS VISUALES Y ANIMACIÓN FX
const activeEffects = [];
const sparkGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const fragmentGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);

export function createImpact(pos, colorHex) {
  const count = 16;
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
    const p = new THREE.Mesh(sparkGeo, mat);
    p.position.copy(pos);

    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;

    scene.add(p);
    activeEffects.push({
      mesh: p,
      vx, vy: (Math.random() - 0.5) * 3, vz,
      life: 0.25, maxLife: 0.25
    });
  }
}

export function createGoalExplosion(pos, colorHex) {
  const ringGeo = new THREE.RingGeometry(0.2, 0.5, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 1 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.1, pos.z);
  scene.add(ring);

  activeEffects.push({
    mesh: ring, isRing: true, scaleSpeed: 25, life: 0.5, maxLife: 0.5
  });

  const fragmentCount = 70;
  for (let i = 0; i < fragmentCount; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
    const p = new THREE.Mesh(fragmentGeo, mat);
    p.position.copy(pos);

    const angle = Math.random() * Math.PI * 2;
    const speed = 8 + Math.random() * 22;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;
    const vy = 2 + Math.random() * 10;

    scene.add(p);
    activeEffects.push({
      mesh: p, vx, vy, vz,
      rotX: (Math.random() - 0.5) * 10,
      rotY: (Math.random() - 0.5) * 10,
      life: 0.8 + Math.random() * 0.4,
      maxLife: 1.2
    });
  }
}

export function updateFX(delta, rawDelta, time) {
  // Shake de cámara
  if (shakeTimer > 0) {
    shakeTimer -= rawDelta;
    const currentIntensity = shakeIntensity * (shakeTimer / 2.0);
    camera.position.x = baseCameraPos.x + (Math.random() - 0.5) * currentIntensity;
    camera.position.z = baseCameraPos.z + (Math.random() - 0.5) * currentIntensity;

    if (shakeTimer <= 0) {
      camera.position.copy(baseCameraPos);
    }
  }

  if (bgParticles) {
    bgParticles.rotation.y = time * 0.05;
  }

  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const fx = activeEffects[i];
    fx.life -= delta;

    if (fx.life <= 0) {
      scene.remove(fx.mesh);
      fx.mesh.geometry.dispose();
      fx.mesh.material.dispose();
      activeEffects.splice(i, 1);
      continue;
    }

    const progress = fx.life / fx.maxLife;

    if (fx.isRing) {
      fx.mesh.scale.addScalar(fx.scaleSpeed * delta);
      fx.mesh.material.opacity = progress;
    } else {
      fx.mesh.position.x += fx.vx * delta;
      fx.mesh.position.y += fx.vy * delta;
      fx.mesh.position.z += fx.vz * delta;

      fx.vx *= 0.94;
      fx.vy *= 0.94;
      fx.vz *= 0.94;

      if (fx.rotX) fx.mesh.rotation.x += fx.rotX * delta;
      if (fx.rotY) fx.mesh.rotation.y += fx.rotY * delta;

      fx.mesh.material.opacity = progress;
      fx.mesh.scale.setScalar(progress);
    }
  }
}

// 10. REDIMENSIÓN DE PANTALLA Y EVENTOS
export function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  createNeonField();
  updatePaddleSizes(); // Recalcular tamaño proporcional de palas al cambiar de resolución

  const newDims = getVisibleDimensions();
  const margin = 2;
  paddleLeft.position.x = -newDims.width / 2 + margin;
  paddleRight.position.x = newDims.width / 2 - margin;
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
  setTimeout(handleResize, 150);
});