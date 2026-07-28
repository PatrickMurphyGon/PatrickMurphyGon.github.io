import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';
import { init3D } from './threeScene.js';

// Iniciar 3D
const { mesh } = init3D();

// Animación de entrada UI
gsap.to('.title', { opacity: 1, y: -10, duration: 1, delay: 0.2 });
gsap.to('.subtitle', { opacity: 1, y: -10, duration: 1, delay: 0.4 });
gsap.to('button', { opacity: 1, y: -10, duration: 1, delay: 0.6 });

// Animación de entrada del Dock de navegación
gsap.to('.bottom-dock-wrapper', { opacity: 1, y: 0, duration: 1, delay: 0.8, ease: 'power2.out' });

// Interacción del botón con el objeto 3D
const btn = document.getElementById('btn-action');
btn.addEventListener('click', () => {
  gsap.to(mesh.rotation, {
    y: mesh.rotation.y + Math.PI * 2,
    x: mesh.rotation.x + Math.PI,
    duration: 1.5,
    ease: 'back.out(1.7)'
  });
});


// ==========================================================================
// DESPLAZAMIENTO CON RUEDA DEL RATÓN (VERTICAL -> HORIZONTAL)
// ==========================================================================
const dock = document.querySelector('.bottom-dock');

if (dock) {
  dock.addEventListener('wheel', (e) => {
    // Bloqueamos el scroll vertical global de la página mientras el ratón esté sobre el menú
    e.preventDefault();
    
    // Convertimos el movimiento de la rueda (deltaY) o trackpad (deltaX) en scroll horizontal
    dock.scrollLeft += e.deltaY + e.deltaX;
  }, { passive: false }); // { passive: false } es obligatorio para poder usar e.preventDefault()
}