import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function init3D() {
  const canvas = document.getElementById('webgl');
  if (!canvas) return;

  // 1. Escena, cámara y renderizador (Fondo transparente)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // 2. Figura 3D (Icosaedro)
  const geometry = new THREE.IcosahedronGeometry(1.5, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xff781e, wireframe: true });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  camera.position.z = 4;

  // 3. Bucle de animación continuo
  function animate() {
    requestAnimationFrame(animate);
    mesh.rotation.x += 0.003;
    mesh.rotation.y += 0.003;
    renderer.render(scene, camera);
  }
  animate();

  // 4. Adaptar si la ventana cambia de tamaño
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Retornamos la malla 3D por si queremos animarla con GSAP desde main.js
  return { mesh };
}