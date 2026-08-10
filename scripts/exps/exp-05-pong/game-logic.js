import * as THREE from 'three';
import {
    composer,
    paddleLeft,
    paddleRight,
    ball,
    getVisibleDimensions,
    resetPositions
} from './three-scene.js';

// 1. CONFIGURACIÓN Y ESTADO DEL JUEGO
const GAME_CONFIG = {
    maxScore: 5,
    basePaddleSpeed: 18,
    baseBallSpeed: 16,
    acceleration: 1.1,
    maxBallSpeed: 45,
    maxPaddleSpeed: 40,
    serveDelay: 1500 // Delay en milisegundos (1.5s)
};

let gameState = {
    isPlaying: false,
    isWaitingForServe: false, // Variable de control para la pausa de saque
    scoreLeft: 0,
    scoreRight: 0,
    ballDir: new THREE.Vector3(1, 0, 0.5).normalize(),
    currentBallSpeed: GAME_CONFIG.baseBallSpeed,
    currentPaddleSpeed: GAME_CONFIG.basePaddleSpeed
};

const keys = {};

function resetRoundSpeed() {
    gameState.currentBallSpeed = GAME_CONFIG.baseBallSpeed;
    gameState.currentPaddleSpeed = GAME_CONFIG.basePaddleSpeed;
}

// 2. CAPTURA DE TECLAS (TECLADO)
window.addEventListener('keydown', (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

// 3. ELEMENTOS INTERFAZ UI Y EVENTOS
const btnBack = document.querySelector('.btn-back');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const winnerModal = document.getElementById('winner-modal');

btnStart.addEventListener('click', async () => {
    // Intentar forzar pantalla horizontal en móviles soportados (Android/Chrome)
    if (screen.orientation && screen.orientation.lock) {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
            await screen.orientation.lock('landscape');
        } catch (e) {
            // Si el navegador no lo permite (ej. iOS Safari), continúa normalmente
        }
    }

    btnStart.style.display = 'none';
    if (btnBack) btnBack.classList.add('hidden');
    resetRoundSpeed();
    resetPositions();
    gameState.isPlaying = true;
});

btnRestart.addEventListener('click', () => {
    if (btnBack) btnBack.classList.add('hidden');
    gameState.scoreLeft = 0;
    gameState.scoreRight = 0;
    document.getElementById('score-left').textContent = '0';
    document.getElementById('score-right').textContent = '0';
    winnerModal.classList.add('hidden');
    resetPositions();
    resetRoundSpeed();
    gameState.isPlaying = true;
});

function endGame(text) {
    gameState.isPlaying = false;
    gameState.isWaitingForServe = false;
    document.getElementById('winner-text').textContent = text;
    winnerModal.classList.remove('hidden');
    if (btnBack) btnBack.classList.remove('hidden');
}

function scorePoint(winner) {
    if (winner === 'left') gameState.scoreLeft++;
    else gameState.scoreRight++;

    document.getElementById('score-left').textContent = gameState.scoreLeft;
    document.getElementById('score-right').textContent = gameState.scoreRight;

    if (gameState.scoreLeft >= GAME_CONFIG.maxScore || gameState.scoreRight >= GAME_CONFIG.maxScore) {
        endGame(gameState.scoreLeft >= GAME_CONFIG.maxScore ? '¡JUGADOR 1 GANA!' : '¡JUGADOR 2 GANA!');
    } else {
        resetRoundSpeed();
        resetPositions(); // Teletransporta las palas y la bola al centro

        // Activa la pausa antes de reanudar la bola
        gameState.isWaitingForServe = true;

        setTimeout(() => {
            gameState.ballDir.set(winner === 'left' ? -1 : 1, 0, Math.random() - 0.5).normalize();
            gameState.isWaitingForServe = false;
        }, GAME_CONFIG.serveDelay);
    }
}

// 4. ACTUALIZACIÓN DE FÍSICAS Y MOVIMIENTO
function updateGame(delta) {
    // Si no se está jugando o se está esperando el saque, frena la lógica
    if (!gameState.isPlaying || gameState.isWaitingForServe) return;

    // Aceleración Progresiva
    gameState.currentBallSpeed = Math.min(
        gameState.currentBallSpeed + GAME_CONFIG.acceleration * delta,
        GAME_CONFIG.maxBallSpeed
    );
    gameState.currentPaddleSpeed = Math.min(
        gameState.currentPaddleSpeed + (GAME_CONFIG.acceleration * 0.8) * delta,
        GAME_CONFIG.maxPaddleSpeed
    );

    const dims = getVisibleDimensions();
    const limitZ = dims.height / 2 - 2;

    // Movimiento Pala Izquierda (W / S)
    if (keys['w'] && paddleLeft.position.z > -limitZ) {
        paddleLeft.position.z -= gameState.currentPaddleSpeed * delta;
    }
    if (keys['s'] && paddleLeft.position.z < limitZ) {
        paddleLeft.position.z += gameState.currentPaddleSpeed * delta;
    }

    // Movimiento Pala Derecha (Flechas)
    if (keys['arrowup'] && paddleRight.position.z > -limitZ) {
        paddleRight.position.z -= gameState.currentPaddleSpeed * delta;
    }
    if (keys['arrowdown'] && paddleRight.position.z < limitZ) {
        paddleRight.position.z += gameState.currentPaddleSpeed * delta;
    }

    // Movimiento Pelota
    ball.position.x += gameState.ballDir.x * gameState.currentBallSpeed * delta;
    ball.position.z += gameState.ballDir.z * gameState.currentBallSpeed * delta;

    // REBOTE PAREDES SUPERIOR E INFERIOR
    const topBottomLimit = dims.height / 2 - 0.5;

    if (ball.position.z > topBottomLimit) {
        ball.position.z = topBottomLimit;
        gameState.ballDir.z = -Math.abs(gameState.ballDir.z);
    } else if (ball.position.z < -topBottomLimit) {
        ball.position.z = -topBottomLimit;
        gameState.ballDir.z = Math.abs(gameState.ballDir.z);
    }

    // Colisiones con Palas usando Box3
    const ballBox = new THREE.Box3().setFromObject(ball);
    const pLeftBox = new THREE.Box3().setFromObject(paddleLeft);
    const pRightBox = new THREE.Box3().setFromObject(paddleRight);

    if (ballBox.intersectsBox(pLeftBox)) {
        gameState.ballDir.x = Math.abs(gameState.ballDir.x);
        gameState.ballDir.z += (ball.position.z - paddleLeft.position.z) * 0.4;
        gameState.ballDir.normalize();
    }

    if (ballBox.intersectsBox(pRightBox)) {
        gameState.ballDir.x = -Math.abs(gameState.ballDir.x);
        gameState.ballDir.z += (ball.position.z - paddleRight.position.z) * 0.4;
        gameState.ballDir.normalize();
    }

    // Comprobar Puntos
    const limitX = dims.width / 2;
    if (ball.position.x < -limitX) scorePoint('right');
    if (ball.position.x > limitX) scorePoint('left');
}

// 5. CONTROLES TÁCTILES PARA DISPOSITIVOS MÓVILES
function handleTouchControls(e) {
    if (!gameState.isPlaying || gameState.isWaitingForServe) return;

    const dims = getVisibleDimensions();
    const limitZ = dims.height / 2 - 2;

    let touchP1 = null;
    let touchP2 = null;

    // Identificar el primer toque registrado en cada mitad de la pantalla
    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.clientX < window.innerWidth / 2) {
            if (!touchP1) touchP1 = touch;
        } else {
            if (!touchP2) touchP2 = touch;
        }
    }

    // Actualizar Pala Izquierda (Jugador 1)
    if (touchP1) {
        const normalizedY = (touchP1.clientY / window.innerHeight) - 0.5;
        const targetZ = normalizedY * dims.height;
        paddleLeft.position.z = Math.max(-limitZ, Math.min(limitZ, targetZ));
    }

    // Actualizar Pala Derecha (Jugador 2)
    if (touchP2) {
        const normalizedY = (touchP2.clientY / window.innerHeight) - 0.5;
        const targetZ = normalizedY * dims.height;
        paddleRight.position.z = Math.max(-limitZ, Math.min(limitZ, targetZ));
    }
}

// Registrar eventos táctiles bloqueando scroll/gestos del navegador ({ passive: false })
window.addEventListener('touchstart', (e) => {
    if (gameState.isPlaying) handleTouchControls(e);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (gameState.isPlaying) {
        e.preventDefault();
        handleTouchControls(e);
    }
}, { passive: false });

// 6. BUCLE DE ANIMACIÓN
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    updateGame(delta);

    composer.render();
}

// Iniciar bucle
animate();