/**
 * ============================================================================
 * MÓDULO: RadioController.js
 * Funcionalidad: Gestión de Radio Online en Streaming conectada a Web Audio API
 * ============================================================================
 */

export class RadioController {
  /**
   * @param {Object} config Configuración inicial del controlador
   * @param {THREE.Audio} config.sound Instancia del reproductor THREE.Audio
   * @param {THREE.AudioListener} config.listener Escuchador de cámara de Three.js
   * @param {Function} config.onStatusChange Callback para notificar mensajes de estado a la UI
   */
  constructor({ sound, listener, onStatusChange }) {
    this.sound = sound;
    this.listener = listener;
    this.onStatusChange = onStatusChange || (() => {});

    // Elemento HTML Audio nativo con CORS habilitado para evitar bloqueos del navegador
    this.radioAudioElement = new Audio();
    this.radioAudioElement.crossOrigin = 'anonymous';

    // Creamos el nodo de Web Audio API UNA SOLA VEZ para no saturar el contexto de audio
    this.mediaSourceNode = this.listener.context.createMediaElementSource(this.radioAudioElement);

    this.currentMode = null; // 'mp3' | 'radio' | null
    this.isRadioPlaying = false;

    // Referencias a los elementos del DOM
    this.radioSelect = document.getElementById('radio-select');
    this.btnRadioToggle = document.getElementById('btn-radio-toggle');
    this.btnPlay = document.getElementById('btn-play');
    this.volumeSlider = document.getElementById('volume-slider');

    this.initEvents();
  }

  /**
   * Inicializa los listeners del DOM y los eventos nativos del objeto Audio
   */
  initEvents() {
    // 1. Evento al pulsar "Conectar Radio"
    if (this.btnRadioToggle) {
      this.btnRadioToggle.addEventListener('click', () => this.toggleRadio());
    }

    // 2. Evento al cambiar la emisora en el selector desplegable
    if (this.radioSelect) {
      this.radioSelect.addEventListener('change', () => {
        if (this.currentMode === 'radio' && this.isRadioPlaying) {
          this.connectAndPlay();
        }
      });
    }

    // 3. Evento nativo: Esperando datos del buffer de red
    this.radioAudioElement.addEventListener('waiting', () => {
      if (this.currentMode === 'radio') {
        this.onStatusChange('📻 Sintonizando emisora...');
      }
    });

    // 4. Evento nativo: Audio transmitiendo activamente
    this.radioAudioElement.addEventListener('playing', () => {
      if (this.currentMode === 'radio') {
        this.isRadioPlaying = true;
        this.updateUI();
        this.onStatusChange(`📻 Radio en directo: ${this.getStationName()}`);
      }
    });

    // 5. Evento nativo: Transmisión pausada
    this.radioAudioElement.addEventListener('pause', () => {
      if (this.currentMode === 'radio') {
        this.isRadioPlaying = false;
        this.updateUI();
      }
    });

    // 6. Evento nativo: Captura de errores de streaming o permisos CORS
    this.radioAudioElement.addEventListener('error', (e) => {
      if (this.currentMode === 'radio') {
        console.error('Error en el stream de radio:', e);
        this.isRadioPlaying = false;
        this.updateUI();
        this.onStatusChange('❌ Error de conexión (Bloqueo CORS o emisión caída)');
      }
    });
  }

  /**
   * Obtiene el nombre visible de la emisora seleccionada
   */
  getStationName() {
    if (!this.radioSelect || this.radioSelect.selectedIndex < 0) return 'Radio';
    return this.radioSelect.options[this.radioSelect.selectedIndex].text;
  }

  /**
   * Obtiene la URL del stream de radio seleccionado
   */
  getStationUrl() {
    return this.radioSelect ? this.radioSelect.value : '';
  }

  /**
   * Alterna entre conectar/desconectar la radio
   */
  async toggleRadio() {
    // Reanudar el AudioContext si el navegador lo dejó en suspensión
    if (this.listener.context.state === 'suspended') {
      await this.listener.context.resume();
    }

    const url = this.getStationUrl();
    if (!url) {
      this.onStatusChange('⚠️ Por favor, selecciona una radio del desplegable');
      return;
    }

    if (this.currentMode === 'radio' && this.isRadioPlaying) {
      this.pauseRadio();
      this.onStatusChange('Radio en pausa');
    } else {
      this.connectAndPlay();
    }
  }

  /**
   * Conecta el stream de radio al sistema Web Audio API de Three.js
   */
  connectAndPlay() {
    const url = this.getStationUrl();
    if (!url) return;

    // Detener MP3 local si estaba reproduciéndose previamente
    if (this.sound.isPlaying) {
      this.sound.stop();
    }

    this.currentMode = 'radio';

    // Vincular la fuente del MediaElement al Three.Audio mediante NodeSource
    this.sound.setNodeSource(this.mediaSourceNode);

    // Sincronizar el volumen actual con el slider
    if (this.volumeSlider) {
      this.sound.setVolume(parseFloat(this.volumeSlider.value));
    }

    this.radioAudioElement.src = url;
    this.onStatusChange(`📻 Sintonizando ${this.getStationName()}...`);

    this.radioAudioElement.play()
      .then(() => {
        this.isRadioPlaying = true;
        this.updateUI();
      })
      .catch((err) => {
        console.error('Error al iniciar radio:', err);
        this.isRadioPlaying = false;
        this.updateUI();
        this.onStatusChange('❌ No se pudo conectar a la emisora');
      });
  }

  /**
   * Pausa la radio actual
   */
  pauseRadio() {
    this.radioAudioElement.pause();
    this.isRadioPlaying = false;
    this.updateUI();
  }

  /**
   * Método invocado cuando el usuario decide cargar y reproducir un archivo MP3 local
   */
  onLocalMp3Active() {
    this.pauseRadio();
    this.currentMode = 'mp3';
    this.updateUI();
  }

  /**
   * Retorna 'true' si hay audio activo sonando (ya sea MP3 local o Radio)
   */
  isAudioActive() {
    if (this.currentMode === 'radio') {
      return this.isRadioPlaying;
    }
    if (this.currentMode === 'mp3') {
      return this.sound.isPlaying;
    }
    return false;
  }

  /**
   * Gestiona la lógica unificada del botón principal Play/Pausa
   */
  togglePlayPause() {
    if (this.currentMode === 'radio') {
      if (this.isRadioPlaying) {
        this.pauseRadio();
        this.onStatusChange('Radio en pausa');
      } else {
        this.connectAndPlay();
      }
    } else if (this.currentMode === 'mp3') {
      if (this.sound.isPlaying) {
        this.sound.pause();
        this.onStatusChange('Audio en pausa');
      } else {
        this.sound.play();
        this.onStatusChange('Reproduciendo MP3');
      }
      this.updateUI();
    }
  }

  /**
   * Actualiza el estado visual de los botones de la interfaz
   */
  updateUI() {
    // Estado del botón de radio
    if (this.btnRadioToggle) {
      if (this.currentMode === 'radio' && this.isRadioPlaying) {
        this.btnRadioToggle.classList.add('active');
        this.btnRadioToggle.innerText = '⏸️ Detener Radio';
      } else {
        this.btnRadioToggle.classList.remove('active');
        this.btnRadioToggle.innerText = '📻 Conectar Radio';
      }
    }

    // Estado del botón unificado Play/Pausa
    if (this.btnPlay) {
      this.btnPlay.disabled = !this.currentMode;
      const active = this.isAudioActive();
      this.btnPlay.innerText = active ? '⏸️ Pausa' : '▶️ Play';
    }
  }
}