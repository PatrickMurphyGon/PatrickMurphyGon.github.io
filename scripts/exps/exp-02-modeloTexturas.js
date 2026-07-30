import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// IMPORTS DE POSTPROCESADO (SHADERS DE ESCENA)
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Importar el Shader externo desde su archivo propio
import { VignetteShader } from '../../assets/shaders/VignetteShader.js';
import { GodRaysShader, setGodRaysParams } from '../../assets/shaders/GodRaysShader.js';

// ================================================
// 1. ESCENA, CÁMARA Y RENDERIZADOR
// ================================================
const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();

//scene.background = new THREE.Color(0x9cd4ec);
scene.backgroundIntensity = 1;      // Brillo de la imagen del fondo (No afecta la luz)
scene.environmentIntensity = 1.0;   // Aumentar o reducir la luz/reflejos que el EXR proyecta sobre los modelos
scene.backgroundBlurriness = 0.0;   // Difuminado del fondo (entre 0.0 y 1.0)

// NIEBLA: Cambia el color (0xcce0ff) según el tono del horizonte de tu skybox
//scene.fog = new THREE.Fog(0xdcae72, 12, 35);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 5, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Sombras
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Tone Mapping: Crucial para renderizar archivos HDR sin que los colores se quemen
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // Estandar (Contraste realista)
// renderer.toneMapping = THREE.AgXToneMapping;        // Evita colores muy saturados
// renderer.toneMapping = THREE.ReinhardToneMapping;   // Suave en luces altas
renderer.toneMappingExposure = 0.5; // Ajusta según qué tan clara/oscura sea la skybox

// Controles
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;


// ================================================
// 1.5. CONFIGURACIÓN DEL COMPOSITOR DE SHADERS (POSTPROCESADO)
// ================================================
const composer = new EffectComposer(renderer);

// RenderPass: Renderiza la escena 3D base
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// UnrealBloomPass: Hace que los objetos brillantes y la luz tengan destello
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.1,  // Intensidad del resplandor
  0.8,  // Radio de dispersión
  0.9  // Umbral
);
composer.addPass(bloomPass);

// GODRAYS
const godRaysPass = new ShaderPass(GodRaysShader);
setGodRaysParams(godRaysPass, {
  density: 0.5,
  weight: 0.1,
  decay: 0.90,
  exposure: 0.4,
  numSamples: 60
});
//composer.addPass(godRaysPass);

// ShaderPass: Usamos el Shader importado del archivo externo
const vignettePass = new ShaderPass(VignetteShader);
// composer.addPass(vignettePass);

// OutputPass: Corrige el color y espacio cromático de salida
const outputPass = new OutputPass();
composer.addPass(outputPass);


// ================================================
// 2. ILUMINACIÓN
// ================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

// Luz solar principal (la que proyecta las sombras)
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 10, 5);
sunLight.castShadow = true;

// Calidad y alcance de la sombra del sol
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

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
  new THREE.MeshStandardMaterial({
    color: 0xffefce,
    emissive: 0xffaa44,          // Color de la luz emitida
    emissiveIntensity: 10.0,     // ¡Intensidad alta para activar el Bloom!
    toneMapped: false            // EVITA que ACESFilmic reduzca el brillo de la esfera
  })
);
scene.add(lightSphere);

// ================================================
// 3. CARGA DE TEXTURAS Y MODELO 3D
// ================================================
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const exrLoader = new EXRLoader(); 

// CARGAR SKYBOX (.EXR) ---------------------------
exrLoader.load(
  '../../assets/textures/autumn_field_4k.exr', // 👈 REEMPLAZA ESTO por la ruta real a tu archivo .exr
  (texture) => {
    // Para reflejos en objetos
    texture.mapping = THREE.EquirectangularReflectionMapping;
    
    // Para efectos de cristal / refracción:
    // texture.mapping = THREE.EquirectangularRefractionMapping;

    scene.background = texture;  // Asigna el EXR como fondo 360°
    scene.environment = texture; // Ilumina el Cubone, el cubo y el suelo con los reflejos del EXR

    console.log('¡Skybox EXR cargado correctamente!');
  },
  undefined,
  (error) => {
    console.error('Error al cargar el archivo EXR:', error);
  }
);


// A. Textura de Césped para el Suelo ------------------------
const grassTexture = textureLoader.load('../../assets/textures/grass.jpg');

// Habilita la repetición
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;

// Ajusta cuántas veces se repite el patrón en el suelo (puedes probar con 4x4, 8x8, etc.)
grassTexture.repeat.set(12, 12);

const floorMat = new THREE.MeshStandardMaterial({ 
  map: grassTexture,
  roughness: 0.8
});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);


// B. Textura de Roca/Ladrillo para el Cubo ------------------------
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


// C. Carga del Modelo 3D Local (.glb / .gltf) ------------------------
// Cargar el modelo
let importedModel = null;

gltfLoader.load(
  '../../assets/models/Cubone.glb', // archivo .glb
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


// D. Esfera de cristal ------------------------

// 1. Geometría de la esfera (radio: 0.8, segmentos: 64x64 para máxima suavidad)
const glassGeometry = new THREE.SphereGeometry(0.8, 64, 64);

// 2. Material físico para simular cristal (MeshPhysicalMaterial)
const glassMaterial = new THREE.MeshPhysicalMaterial({
  roughness: 0.01,          // Casi 0 para que sea cristal pulido y transparente
  transmission: 0.95,       // 0.98 = Altísima transparencia con refracción física
  ior: 1.1,                 // Índice de refracción real del cristal (Glass IOR = 1.5)
  thickness: 1.2,           // Grosor interno para deformar la vista del fondo (efecto lupa)
  specularIntensity: 2.0,   // Brillo de los reflejos
  clearcoat: 1.0,           // Capa de barniz/brillo extra en la superficie
  clearcoatRoughness: 0.05,
  color: 0xffffff,          // Color base (puedes teñirlo, ej: 0x90e0ef para cristal azulado)
  transparent: true,
  opacity: 1
});

// 3. Creación de la malla
const glassSphere = new THREE.Mesh(glassGeometry, glassMaterial);

// 4. Posición: A la derecha de Cubone (x = 4.5) y flotando sutilmente sobre el suelo (y = 1.0)
glassSphere.position.set(0, 1.0, -3.5);
glassSphere.castShadow = true;

// 5. Añadir a la escena
scene.add(glassSphere);


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
  //renderer.render(scene, camera);
  composer.render();
}

animate();

// Ajuste al redimensionar ventana
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  composer.setSize(window.innerWidth, window.innerHeight);
});