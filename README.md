# PatrickMurphyGon.github.io
Web for this account


---

# Visualizador de Partículas Reactivo al Audio (Three.js + Web Audio API)

Este proyecto consiste en un sistema de visualización 3D interactivo e inmersivo en tiempo real. Combina el renderizado de gráficos por tarjeta de vídeo (GPU) mediante **Three.js** y **Shaders GLSL**, procesando señales de sonido digital provenientes tanto de **archivos locales (MP3)** como de **emisoras de Radio Online en Streaming** a través de la **Web Audio API**.

---

## Arquitectura del Sistema

El proyecto se divide modularmente en 3 áreas fundamentales:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTERFAZ DE USUARIO (DOM)                         │
│       - Subida de archivos MP3   - Selector de Radio    - Controles         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MOTOR DE AUDIO & STREAMING                          │
│   ┌───────────────────────────┐         ┌───────────────────────────────┐   │
│   │   RadioController.js      │         │   THREE.Audio & Analyser      │   │
│   │ (Gestión de Streams CORS) │         │ (FFT: Separación de 4 bandas) │   │
│   └───────────────────────────┘         └───────────────┬───────────────┘   │
└─────────────────────────────────────────────────────────┼───────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GRÁFICOS 3D & SHADERS EN GPU                          │
│  - Vertex Shader (Deformación de 10.000 partículas según frecuencias de audio) │
│  - Fragment Shader (Texturizado de partículas y blending aditivo)            │
│  - Pipeline de Post-Procesado (Bloom Pass + God Rays Pass)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Módulos y Funcionalidad del Código

### 1. Gestión de Radio y Streaming (`RadioController.js`)

El archivo `RadioController.js` encapsula toda la interacción con las emisoras de radio en directo y su integración con el sistema Web Audio API.

#### **Explicación detallada del código:**
* **Constructor y Nodos Reutilizables:** En lugar de destruir y recrear el nodo de audio en cada cambio de emisora (lo que agotaría el `AudioContext` del navegador), se crea una única instancia del elemento `<audio>` con CORS habilitado (`crossOrigin = 'anonymous'`) y se vincula mediante `createMediaElementSource`:
  ```javascript
  this.radioAudioElement = new Audio();
  this.radioAudioElement.crossOrigin = 'anonymous';
  this.mediaSourceNode = this.listener.context.createMediaElementSource(this.radioAudioElement);
  ```
* **Conexión al grafo de Three.js (`connectAndPlay`):** Sustituye la fuente activa del reproductor `THREE.Audio` asignándole el `mediaSourceNode` mediante `this.sound.setNodeSource(this.mediaSourceNode)`.
* **Manejo de Estados y Eventos del Stream:** Captura eventos nativos de HTML5 Audio (`waiting`, `playing`, `pause`, `error`) para proporcionar feedback visual inmediato en la UI (ej. notificando sintonización, reconexiones o fallos CORS).
* **Control Unificado Play/Pausa (`togglePlayPause`):** Detecta el modo actual (`'radio'` o `'mp3'`) para pausar o reanudar la fuente correspondiente sin interferir entre ambas.

---

### 2. Procesamiento de Audio en Tiempo Real (`exp-04-ritmo.js`)

#### **Captura y Análisis espectral (FFT)**
Se utiliza un `THREE.AudioAnalyser` configurado con un tamaño de ventana de Fourier (`fftSize`) de 128, dividiendo la señal en **64 canales o bins de frecuencia**.

#### **Algoritmo de Separación en 4 Bandas Frecuenciales (`getBandValue`)**
Para lograr que la animación reaccione con precisión a instrumentos específicos, la función `getBandValue()` agrupa y promedia los bins en 4 bandas:

| Banda | Bins FFT | Rango / Instrumentos | Efecto en la Visualización 3D |
| :--- | :--- | :--- | :--- |
| **Graves (Bass)** | `0 - 1` | Bombos, Sub-bajos | Expansión radial de la esfera y sacudida de cámara (*Camera Shake*) |
| **Medios (Mid)** | `1 - 9` | Voces, Bajos, Sintetizadores | Amplitud del osciloscopio y deformación de la onda |
| **Agudos (High-Mid)** | `9 - 24` | Cajas, Guitarras | Modulación de color y pulso de ondas secundarias |
| **Super Agudos (Treble)** | `24 - 50` | Platillos, Brillo, Aire | Destellos de color e incremento de tamaño de partícula |

---

### 3. Motor de Partículas 3D y Shaders GLSL Customizados

El sistema renderiza **10.000 partículas** eficientemente mediante `THREE.Points` y `THREE.BufferGeometry`.

#### **A) Atributos Precargados en la GPU (`BufferAttributes`)**
Para evitar cálculos pesados en la CPU durante el bucle de render, las posiciones objetivo para los tres modos visuales se precargan en arreglos `Float32Array`:
1. `aSphereDir`: Vector unitario tridimensional con dirección radial esférica.
2. `aOscPos`: Coordenadas ordenadas en forma de espiral/resorte helicoidal a lo largo del eje X.
3. `aGroundPos`: Distribución en cuadrícula sobre el plano $XZ$ ($50 	imes 30$).

#### **B) Vertex Shader (Deformación Geométrica en GPU)**
El vertex shader calcula en tiempo real la posición de cada partícula según el valor de audio recibido en los `uniforms`:
* **Modo 0 (Esfera Reactiva):** Se deforma expandiendo su radio: $P =  ec{D} \cdot (R_{	ext{base}} + 	ext{audioVal} \cdot 	ext{amp})$.
* **Modo 1 (Osciloscopio 3D):** Desplaza verticalmente el respiro espiral combinando ondas senoidales con la frecuencia del canal.
* **Modo 2 (Suelo de Ondas):** Calcula distancias radiales $\sqrt{x^2 + z^2}$ y genera oleajes mediante ondas cosenoidales fluidas.
* **Escalado por Perspectiva (`gl_PointSize`):** Ajusta dinámicamente el tamaño de la partícula según su distancia a la cámara y el volumen de la banda.

#### **C) Fragment Shader (Texturizado y Blending)**
* Mapea la textura del punto (corazón o gradiente radial creado mediante Canvas 2D).
* Aplica transparencia y descarte de píxeles alpha bajos (`discard`).
* La escena utiliza mezcla aditiva (`THREE.AdditiveBlending`) para generar puntos súper brillantes al superponerse.

---

### 4. Tubería de Post-Procesado (`EffectComposer`)

El resultado renderizado pasa por 4 pases encadenados:
1. **`RenderPass`:** Renderiza la escena base de partículas.
2. **`UnrealBloomPass`:** Agrega un resplandor o efecto neón (glow) intenso alrededor de los puntos.
3. **`ShaderPass(GodRaysShader)`:** Añade rayos de luz volumétrica centralizados.
4. **`OutputPass`:** Ajusta la codificación de color nativa para la pantalla.

---

### 5. Sacudida Dinámica de Cámara (*Camera Shake*)

Cuando la intensidad del bombo/graves supera un umbral configurable (`shakeConfig.threshold`), la cámara experimenta una desviación aleatoria rápida que se disipa exponencialmente ($* 0.88$), simulando el impacto de un subwoofer físico.

---

## Panel de Control Interactivo (lil-gui)

El proyecto incluye un menú interactivo en la esquina superior que permite manipular en tiempo real:
* **Modo Visual:** Alternar entre Esfera, Osciloscopio y Suelo.
* **Respuesta Frecuencial:** Ajustar ganancia (`Amp`) y potencia exponencial (`Punch`) por cada banda.
* **Comportamiento de Olas:** Controlar la frecuencia y velocidad de propagación.
* **Colores por Banda:** Personalizar los colores hexadecimales asignados a Graves, Medios y Agudos.
* **Sacudida de Cámara:** Activar/desactivar y definir sensibilidad del golpe.
* **Post-Procesado:** Activar/desactivar Bloom y GodRays al vuelo.

---

## Requisitos e Instalación

1. Clona el repositorio.
2. Abre la carpeta del proyecto en un servidor web local (como **Live Server** de VS Code, Python `python -m http.server`, o Node `npx serve`).
3. Abre `exp-04-ritmo.html` en tu navegador.