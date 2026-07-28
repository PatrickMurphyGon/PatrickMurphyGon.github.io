import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

// ==========================================================================
// 1. ESCENA, CÁMARA, RENDERIZADOR Y CONTROLES
// ==========================================================================
const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a); // Fondo oscuro mate

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4, 9);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// HABILITAR MAPA DE SOMBRAS REALISTAS
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves

// Controles de cámara con ratón
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Movimiento inercial suave

// ==========================================================================
// 2. SUELO (RECEPTOR DE SOMBRAS)
// ==========================================================================
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({ 
  color: 0x1e293b, 
  roughness: 0.4, 
  metalness: 0.1 
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true; // Permite recibir sombras proyectadas
scene.add(floor);

// Rejilla decorativa para contexto visual
const grid = new THREE.GridHelper(20, 20, 0x38bdf8, 0x334155);
grid.position.y = 0.01;
scene.add(grid);

// ==========================================================================
// 3. 4 OBJETOS CON MATERIALES TOTALMENTE DIFERENTES
// ==========================================================================
const objects = [];

// OBJETIVO 1: Esfera de Metal Cromo / Espejo
const sphereGeo = new THREE.SphereGeometry(0.8, 64, 64);
const chromeMat = new THREE.MeshStandardMaterial({ 
  color: 0xffffff, 
  metalness: 1.0, 
  roughness: 0.05 
});
const sphere = new THREE.Mesh(sphereGeo, chromeMat);
sphere.position.set(-4.5, 1, 0);
sphere.castShadow = true;
sphere.receiveShadow = true;
scene.add(sphere);
objects.push(sphere);

// OBJETIVO 2: Nudo Toroidal de Oro Pulido
const torusGeo = new THREE.TorusKnotGeometry(0.6, 0.2, 128, 32);
const goldMat = new THREE.MeshStandardMaterial({ 
  color: 0xf59e0b, 
  metalness: 0.8, 
  roughness: 0.2 
});
const torusKnot = new THREE.Mesh(torusGeo, goldMat);
torusKnot.position.set(-1.5, 1.2, 0);
torusKnot.castShadow = true;
torusKnot.receiveShadow = true;
scene.add(torusKnot);
objects.push(torusKnot);

// OBJETIVO 3: Cubo de Cristal Físico (Glass)
const boxGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
const glassMat = new THREE.MeshPhysicalMaterial({ 
  color: 0x38bdf8, 
  metalness: 0.0, 
  roughness: 0.1, 
  transmission: 0.9, // Efecto refractivo de cristal
  opacity: 1, 
  transparent: true, 
  ior: 1.5 
});
const box = new THREE.Mesh(boxGeo, glassMat);
box.position.set(1.5, 1, 0);
box.castShadow = true;
box.receiveShadow = true;
scene.add(box);
objects.push(box);

// OBJETIVO 4: Dodecaedro de Goma Mateo Neón con Emisión
const dodecaGeo = new THREE.DodecahedronGeometry(0.9);
const neonMat = new THREE.MeshStandardMaterial({ 
  color: 0xf43f5e, 
  roughness: 0.9, 
  metalness: 0.0, 
  emissive: 0x880022 // Emite luz propia tenue
});
const dodeca = new THREE.Mesh(dodecaGeo, neonMat);
dodeca.position.set(4.5, 1, 0);
dodeca.castShadow = true;
dodeca.receiveShadow = true;

scene.add(dodeca);
objects.push(dodeca);

objects.forEach(obj => {
  obj.userData.initialY = obj.position.y;
});

// ==========================================================================
// 4. SISTEMA DE ILUMINACIÓN
// ==========================================================================
// 1. Luz Ambiental
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// 2. Luz Direccional (Luz Principal con Sombras)
const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(5, 8, 5);
dirLight.castShadow = true;

// Optimización de la calidad de sombra de la luz direccional
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 25;
dirLight.shadow.camera.left = -8;
dirLight.shadow.camera.right = 8;
dirLight.shadow.camera.top = 8;
dirLight.shadow.camera.bottom = -8;
scene.add(dirLight);

// Helper visual de la luz direccional
const dirHelper = new THREE.DirectionalLightHelper(dirLight, 1, 0xf59e0b);
scene.add(dirHelper);

// 3. Luz Puntual Coloreada (Cian)
const pointLight = new THREE.PointLight(0x06b6d4, 15, 12);
pointLight.position.set(-2, 3, -2);
pointLight.castShadow = true;
scene.add(pointLight);

const pointHelper = new THREE.PointLightHelper(pointLight, 0.3);
scene.add(pointHelper);

// ==========================================================================
// 5. MENÚ INTERACTIVO LIL-GUI
// ==========================================================================

// 1. PRIMERO INICIALIZAMOS LA INTERFAZ
const gui = new GUI({ title: '🎛️ Control de Iluminación' });

// 2. Carpeta: Luz Direccional (Sol)
const fDir = gui.addFolder('Luz Principal (Sol)');
fDir.add(dirLight, 'intensity', 0, 10, 0.1).name('Intensidad');
fDir.addColor({ color: dirLight.color.getHex() }, 'color').name('Color').onChange(c => dirLight.color.setHex(c));
fDir.add(dirLight.position, 'x', -10, 10, 0.1).name('Posición X');
fDir.add(dirLight.position, 'y', 1, 15, 0.1).name('Posición Y');
fDir.add(dirLight.position, 'z', -10, 10, 0.1).name('Posición Z');
fDir.add(dirLight, 'castShadow').name('Activar Sombras');
fDir.add(dirHelper, 'visible').name('Mostrar Guía');

// 3. Carpeta: Luz Puntual
const fPoint = gui.addFolder('Luz Puntual (Cian)');
fPoint.add(pointLight, 'intensity', 0, 50, 1).name('Intensidad');
fPoint.addColor({ color: pointLight.color.getHex() }, 'color').name('Color').onChange(c => pointLight.color.setHex(c));
fPoint.add(pointLight.position, 'x', -8, 8, 0.1);
fPoint.add(pointLight.position, 'y', 0.5, 8, 0.1);
fPoint.add(pointLight.position, 'z', -8, 8, 0.1);

// 4. Carpeta: Animaciones GSAP (Doble Salto)
const fAnim = gui.addFolder('Animaciones GSAP');
fAnim.add({ 
  bounce: () => {
    objects.forEach((obj, index) => {
      // Detenemos animaciones activas en este objeto
      gsap.killTweensOf(obj.position);

      // Si por alguna razón no se guardó initialY, toma la posición actual
      if (obj.userData.initialY === undefined) {
        obj.userData.initialY = obj.position.y;
      }

      const baseFloor = obj.userData.initialY; // Suelo base seguro
      const currentY = obj.position.y;          // Posición actual
      const jumpImpulse = 1.5;                  // Fuerza de impulso
      const peakY = Math.min(currentY + jumpImpulse, baseFloor + 6.0); // Límite de altura

      const totalFallDistance = peakY - baseFloor;
      const jumpDuration = 0.35;
      const fallDuration = 0.35 + (totalFallDistance * 0.08);

      // Secuencia de animación
      const tl = gsap.timeline({ delay: index * 0.08 });

      // Subida
      tl.to(obj.position, {
        y: peakY,
        duration: jumpDuration,
        ease: 'power2.out'
      })
      // Caída libre hasta el suelo base
      .to(obj.position, {
        y: baseFloor,
        duration: fallDuration,
        ease: 'power2.in'
      });
    });
  } 
}, 'bounce').name('💥 Doble Salto / Rebotar');

// ==========================================================================
// 6. BUCLE DE ANIMACIÓN Y RESIZE
// ==========================================================================
function animate() {
  requestAnimationFrame(animate);

  // Rotaciones sutiles continuas
  torusKnot.rotation.x += 0.005;
  torusKnot.rotation.y += 0.005;

  box.rotation.y += 0.005;
  dodeca.rotation.x += 0.005;

  controls.update();
  renderer.render(scene, camera);
}
animate();

// Ajuste Responsive
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});