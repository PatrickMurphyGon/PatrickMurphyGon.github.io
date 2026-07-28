import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ================================================
// 1. ESCENA, CÁMARA Y RENDERIZADOR
// ================================================
const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e17);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 5, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Sombras
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Controles
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ================================================
// 2. ILUMINACIÓN
// ================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

// Luz puntual en movimiento
const pointLight = new THREE.PointLight(0xffaa44, 25, 20);
pointLight.castShadow = true;

// Calidad de la sombra
pointLight.shadow.mapSize.width = 1024;
pointLight.shadow.mapSize.height = 1024;
scene.add(pointLight);

// Indicador visual de la bombilla/luz
const lightSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffefce })
);
scene.add(lightSphere);

// ================================================
// 3. CARGA DE TEXTURAS Y MODELO 3D
// ================================================
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

// A. Textura de Césped para el Suelo
const grassTexture = textureLoader.load('../../assets/textures/grass.jpg');

// Habilita la repetición
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;

// Ajusta cuántas veces se repite el patrón en el suelo (puedes probar con 4x4, 8x8, etc.)
grassTexture.repeat.set(6, 6);

const floorMat = new THREE.MeshStandardMaterial({ 
  map: grassTexture,
  roughness: 0.8
});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// B. Textura de Roca/Ladrillo para el Cubo
const brickTexture = textureLoader.load('https://threejs.org/examples/textures/brick_diffuse.jpg');
const cubeMat = new THREE.MeshStandardMaterial({ 
  map: brickTexture,
  roughness: 0.4 
});
const cube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), cubeMat);
cube.position.set(-2, 0.75, 0);
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);

// C. Carga del Modelo 3D Local (.glb / .gltf)
// Cargar el modelo
let importedModel = null;

gltfLoader.load(
  '../../assets/models/Cubone.glb', // 👈 REEMPLAZA ESTO por la ruta real a tu archivo .glb
  (gltf) => {
    importedModel = gltf.scene;

    // 1. Habilitar proyectar/recibir sombras en todas las mallas del modelo
    importedModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // 2. Posicionar el modelo sobre el suelo (y = 0.7) y a la derecha (x = 2)
    // para que no choque con el cubo que tienes en x = -2
    importedModel.position.set(2, 0.83, 0);

    // 3. Si necesitas cambiar el tamaño, puedes descomentar esto:
    importedModel.scale.set(2, 2, 2);

    // 4. Añadir a la escena
    scene.add(importedModel);

    console.log('¡Modelo GLB cargado correctamente!');
  },
  (progress) => {
    if (progress.total > 0) {
      console.log(`Cargando modelo: ${Math.round((progress.loaded / progress.total) * 100)}%`);
    }
  },
  (error) => {
    console.error('Error al cargar el modelo GLB:', error);
  }
);


// ================================================
// 4. BUCLE DE ANIMACIÓN
// ================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // A. Rotar la luz en un círculo alrededor de la escena
  const radius = 4;
  const speed = 0.3;
  const lightX = Math.cos(elapsedTime * speed) * radius;
  const lightZ = Math.sin(elapsedTime * speed) * radius;
  const lightY = 3 + Math.sin(elapsedTime * (speed * 2)) * 0.5;

  pointLight.position.set(lightX, lightY, lightZ);
  lightSphere.position.set(lightX, lightY, lightZ); // La esfera sigue a la luz

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