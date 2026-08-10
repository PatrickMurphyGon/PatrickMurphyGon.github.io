import * as THREE from 'three';
import {
    composer,
    paddleLeft,
    paddleRight,
    ball,
    getVisibleDimensions,
    resetPositions,
    createImpact,
    createGoalExplosion,
    updateFX,
    updateFieldColor,
    toggleVignette,
    startCameraShake
} from './three-scene.js';

// 1. CONFIGURACIÓN Y ESTADO DEL JUEGO
const GAME_CONFIG = {
    maxScore: 1,            // 5
    basePaddleSpeed: 18,    // 18
    baseBallSpeed: 16,      // 16
    acceleration: 1.1,      // 1.1
    maxBallSpeed: 50,       // 45
    maxPaddleSpeed: 40,     // 40
    serveDelay: 1500        // 1.5 segundos
};

let gameState = {
    isPlaying: false,
    isWaitingForServe: false,
    scoreLeft: 0,
    scoreRight: 0,
    ballDir: new THREE.Vector3(1, 0, 0.5).normalize(),
    currentBallSpeed: GAME_CONFIG.baseBallSpeed,
    currentPaddleSpeed: GAME_CONFIG.basePaddleSpeed,
    timeScale: 1.0
};

// Control del Evento Hiper-Crítico
let hyperState = {
    triggeredThisRally: false,
    isActive: false,
    phase: 'idle', // 'idle', 'slow', 'speedup'
    timer: 0
};

const keys = {};

// Restringe el ángulo vertical de la bola (máximo 50 grados)
function clampBallDirection(dir, maxAngleDegrees = 50) {
    const maxZ = Math.sin(THREE.MathUtils.degToRad(maxAngleDegrees));
    
    if (Math.abs(dir.z) > maxZ) {
        const signX = dir.x >= 0 ? 1 : -1;
        const signZ = dir.z >= 0 ? 1 : -1;

        dir.z = signZ * maxZ;
        dir.x = signX * Math.sqrt(1 - maxZ * maxZ);
        dir.normalize();
    }
}

function resetRoundSpeed() {
    gameState.currentBallSpeed = GAME_CONFIG.baseBallSpeed;
    gameState.currentPaddleSpeed = GAME_CONFIG.basePaddleSpeed;
    gameState.timeScale = 1.0;
    
    hyperState.triggeredThisRally = false;
    hyperState.isActive = false;
    hyperState.phase = 'idle';
    hyperState.timer = 0;

    toggleVignette(false);

    // Restablecer el color por defecto del marcador completo
    const scoreLeftEl = document.getElementById('score-left');
    const scoreRightEl = document.getElementById('score-right');
    const scoreSeparatorEl = document.getElementById('score-separator'); // 🟢 Capturamos los ':'

    if (scoreLeftEl) {
        scoreLeftEl.style.color = '';
        scoreLeftEl.style.textShadow = '';
    }
    if (scoreRightEl) {
        scoreRightEl.style.color = '';
        scoreRightEl.style.textShadow = '';
    }
    if (scoreSeparatorEl) {
        scoreSeparatorEl.style.color = '';
        scoreSeparatorEl.style.textShadow = '';
    }
}

// 2. CAPTURA DE TECLAS
window.addEventListener('keydown', (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

// 3. ELEMENTOS INTERFAZ UI Y EVENTOS
const btnBack = document.querySelector('.btn-back');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const winnerModal = document.getElementById('winner-modal');

btnStart.addEventListener('click', async () => {
    if (screen.orientation && screen.orientation.lock) {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
            await screen.orientation.lock('landscape');
        } catch (e) {}
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
    toggleVignette(false);
    document.getElementById('winner-text').textContent = text;
    winnerModal.classList.remove('hidden');
    if (btnBack) btnBack.classList.remove('hidden');
}

function scorePoint(winner) {
    if (winner === 'left') gameState.scoreLeft++;
    else gameState.scoreRight++;

    document.getElementById('score-left').textContent = gameState.scoreLeft;
    document.getElementById('score-right').textContent = gameState.scoreRight;

    const explosionColor = winner === 'left' 
        ? paddleLeft.material.color.getHex() 
        : paddleRight.material.color.getHex();

    createGoalExplosion(ball.position, explosionColor);

    if (gameState.scoreLeft >= GAME_CONFIG.maxScore || gameState.scoreRight >= GAME_CONFIG.maxScore) {
        endGame(gameState.scoreLeft >= GAME_CONFIG.maxScore ? '¡JUGADOR 1 GANA!' : '¡JUGADOR 2 GANA!');
    } else {
        resetRoundSpeed();
        resetPositions();

        gameState.isWaitingForServe = true;

        setTimeout(() => {
            gameState.ballDir.set(winner === 'left' ? -1 : 1, 0, (Math.random() - 0.5) * 0.8).normalize();
            clampBallDirection(gameState.ballDir);
            gameState.isWaitingForServe = false;
        }, GAME_CONFIG.serveDelay);
    }
}

// 4. MÁQUINA DE ESTADOS HIPER-CRÍTICA (SLOW-MO, SHAKE & RECOVERY)
// 4. MÁQUINA DE ESTADOS HIPER-CRÍTICA (SLOW-MO, SHAKE & RECOVERY)
function updateHyperLogic(rawDelta) {
    if (!gameState.isPlaying || gameState.isWaitingForServe) return;

    // Verificar si alguno está a 1 punto de ganar (Punto de Match)
    const isMatchPoint = (gameState.scoreLeft === GAME_CONFIG.maxScore - 1) || 
                         (gameState.scoreRight === GAME_CONFIG.maxScore - 1);

    const isAtMaxSpeed = gameState.currentBallSpeed >= GAME_CONFIG.maxBallSpeed - 0.2;

    // ⚡ DISPARO DEL EFECTO
    if (isMatchPoint && isAtMaxSpeed && !hyperState.triggeredThisRally) {
        hyperState.triggeredThisRally = true;
        hyperState.isActive = true;
        hyperState.phase = 'slow';
        hyperState.timer = 0;

        gameState.timeScale = 0.15; // Ralentización drástica de golpe
        startCameraShake(2.7, 0.7);  // Shake durante 2 segundos reales
        toggleVignette(true);        // Sombra oscura en bordes de pantalla

        // Poner el marcador completo en rojo hiper con resplandor neón
        const scoreLeftEl = document.getElementById('score-left');
        const scoreRightEl = document.getElementById('score-right');
        const scoreSeparatorEl = document.getElementById('score-separator'); // Capturamos los ':'

        const hyperColor = '#ff0055';
        const hyperShadow = '0 0 15px #ff0055, 0 0 30px #ff0055';

        if (scoreLeftEl) {
            scoreLeftEl.style.color = hyperColor;
            scoreLeftEl.style.textShadow = hyperShadow;
        }
        if (scoreRightEl) {
            scoreRightEl.style.color = hyperColor;
            scoreRightEl.style.textShadow = hyperShadow;
        }
        if (scoreSeparatorEl) {
            scoreSeparatorEl.style.color = hyperColor;
            scoreSeparatorEl.style.textShadow = hyperShadow;
        }
    }

    if (!hyperState.isActive) return;

    hyperState.timer += rawDelta;

    if (hyperState.phase === 'slow') {
        if (hyperState.timer >= 3.5) {
            hyperState.phase = 'speedup';
            hyperState.timer = 0;
            toggleVignette(false); 
        }
    } else if (hyperState.phase === 'speedup') {
        const speedupDuration = 6.5;
        const progress = Math.min(1.0, hyperState.timer / speedupDuration);

        gameState.timeScale = THREE.MathUtils.lerp(0.15, 1.0, progress);

        if (progress >= 1.0) {
            gameState.timeScale = 1.0;
            hyperState.phase = 'idle';
        }
    }
}

// 5. ACTUALIZACIÓN DE FÍSICAS Y MOVIMIENTO
function updateGame(scaledDelta) {
    if (!gameState.isPlaying || gameState.isWaitingForServe) return;

    // Límite dinámico: Si se activa el evento hiper-crítico, el tope sube +10
    const maxBallSpd = hyperState.triggeredThisRally 
        ? GAME_CONFIG.maxBallSpeed + 10 
        : GAME_CONFIG.maxBallSpeed;

    const maxPaddleSpd = hyperState.triggeredThisRally 
        ? GAME_CONFIG.maxPaddleSpeed + 10 
        : GAME_CONFIG.maxPaddleSpeed;

    // Aceleración continua hasta el nuevo tope permitido
    gameState.currentBallSpeed = Math.min(
        gameState.currentBallSpeed + GAME_CONFIG.acceleration * scaledDelta,
        maxBallSpd
    );
    gameState.currentPaddleSpeed = Math.min(
        gameState.currentPaddleSpeed + (GAME_CONFIG.acceleration * 0.8) * scaledDelta,
        maxPaddleSpd
    );

    const dims = getVisibleDimensions();
    const limitZ = dims.height / 2 - 2;

    // Movimiento Jugador 1
    if (keys['w'] && paddleLeft.position.z > -limitZ) {
        paddleLeft.position.z -= gameState.currentPaddleSpeed * scaledDelta;
    }
    if (keys['s'] && paddleLeft.position.z < limitZ) {
        paddleLeft.position.z += gameState.currentPaddleSpeed * scaledDelta;
    }

    // Movimiento Jugador 2
    if (keys['arrowup'] && paddleRight.position.z > -limitZ) {
        paddleRight.position.z -= gameState.currentPaddleSpeed * scaledDelta;
    }
    if (keys['arrowdown'] && paddleRight.position.z < limitZ) {
        paddleRight.position.z += gameState.currentPaddleSpeed * scaledDelta;
    }

    // Movimiento Bola
    ball.position.x += gameState.ballDir.x * gameState.currentBallSpeed * scaledDelta;
    ball.position.z += gameState.ballDir.z * gameState.currentBallSpeed * scaledDelta;

    const topBottomLimit = dims.height / 2 - 0.5;

    // Rebote superior e inferior
    if (ball.position.z > topBottomLimit) {
        ball.position.z = topBottomLimit;
        gameState.ballDir.z = -Math.abs(gameState.ballDir.z);
    } else if (ball.position.z < -topBottomLimit) {
        ball.position.z = -topBottomLimit;
        gameState.ballDir.z = Math.abs(gameState.ballDir.z);
    }

    // Colisiones con Palas
    const ballBox = new THREE.Box3().setFromObject(ball);
    const pLeftBox = new THREE.Box3().setFromObject(paddleLeft);
    const pRightBox = new THREE.Box3().setFromObject(paddleRight);

    if (ballBox.intersectsBox(pLeftBox)) {
        gameState.ballDir.x = Math.abs(gameState.ballDir.x);
        gameState.ballDir.z += (ball.position.z - paddleLeft.position.z) * 0.4;
        
        // Limitar ángulo tras la colisión
        clampBallDirection(gameState.ballDir);
        
        createImpact(ball.position, paddleLeft.material.color.getHex());
    }

    if (ballBox.intersectsBox(pRightBox)) {
        gameState.ballDir.x = -Math.abs(gameState.ballDir.x);
        gameState.ballDir.z += (ball.position.z - paddleRight.position.z) * 0.4;
        
        // Limitar ángulo tras la colisión
        clampBallDirection(gameState.ballDir);
        
        createImpact(ball.position, paddleRight.material.color.getHex());
    }

    // Detección de Gol
    const limitX = dims.width / 2;
    if (ball.position.x < -limitX) scorePoint('right');
    if (ball.position.x > limitX) scorePoint('left');

    // Bot Mode
    // paddleLeft.position.z = ball.position.z;
    // paddleRight.position.z = ball.position.z;
}

// 6. CONTROLES TÁCTILES
function handleTouchControls(e) {
    if (!gameState.isPlaying || gameState.isWaitingForServe) return;

    const dims = getVisibleDimensions();
    const limitZ = dims.height / 2 - 2;

    let touchP1 = null;
    let touchP2 = null;

    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.clientX < window.innerWidth / 2) {
            if (!touchP1) touchP1 = touch;
        } else {
            if (!touchP2) touchP2 = touch;
        }
    }

    if (touchP1) {
        const normalizedY = (touchP1.clientY / window.innerHeight) - 0.5;
        const targetZ = normalizedY * dims.height;
        paddleLeft.position.z = Math.max(-limitZ, Math.min(limitZ, targetZ));
    }

    if (touchP2) {
        const normalizedY = (touchP2.clientY / window.innerHeight) - 0.5;
        const targetZ = normalizedY * dims.height;
        paddleRight.position.z = Math.max(-limitZ, Math.min(limitZ, targetZ));
    }
}

window.addEventListener('touchstart', (e) => {
    if (gameState.isPlaying) handleTouchControls(e);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (gameState.isPlaying) {
        e.preventDefault();
        handleTouchControls(e);
    }
}, { passive: false });

// 7. BUCLE DE ANIMACIÓN
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const rawDelta = clock.getDelta(); // Delta real para temporizadores
    const scaledDelta = rawDelta * gameState.timeScale; // Delta para el movimiento del juego
    const elapsedTime = clock.getElapsedTime();

    updateHyperLogic(rawDelta);
    updateGame(scaledDelta);
    updateFX(scaledDelta, rawDelta, elapsedTime);

    updateFieldColor(
        gameState.currentBallSpeed,
        GAME_CONFIG.baseBallSpeed,
        GAME_CONFIG.maxBallSpeed,
        hyperState.isActive
    );

    composer.render();
}

animate();