/**
 * Audio Engine using Web Audio API
 * Generates procedural ambient sounds (Rain, Ocean, Zen Meditation Bell, 432Hz Drone)
 * Completely self-contained: No external audio assets required.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.volume = 0.5;
    this.currentTrack = null; // 'rain' | 'ocean' | 'drone' | null
    this.activeNodes = [];
    this.masterGain = null;
  }

  /**
   * Initializes the AudioContext upon first user interaction
   */
  initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Set overall volume (0.0 to 1.0)
   */
  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volume,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    this.setVolume(this.volume);
    return this.isMuted;
  }

  /**
   * Stop all playing ambient sounds
   */
  stopAmbient() {
    this.activeNodes.forEach(item => {
      try {
        if (item.stop) item.stop();
        if (item.disconnect) item.disconnect();
      } catch (e) {
        // Ignore if already disconnected
      }
    });
    this.activeNodes = [];
    this.currentTrack = null;
  }

  /**
   * Generates a noise buffer (Brown / Pink / White)
   */
  createNoiseBuffer(type = 'brown', seconds = 4) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;

      if (type === 'brown') {
        // Brown noise: Integrate white noise
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      } else if (type === 'pink') {
        // Pink noise approximation (Paul Kellet's filter)
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        data[i] = white * 0.2;
      }
    }
    return buffer;
  }

  /**
   * Play procedural Rain sound
   */
  playRain() {
    this.initContext();
    this.stopAmbient();
    this.currentTrack = 'rain';

    const buffer = this.createNoiseBuffer('pink', 4);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // Lowpass filter for deep soothing rain rumble
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);

    // Highpass filter to eliminate mud
    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(hpFilter);
    hpFilter.connect(gain);
    gain.connect(this.masterGain);

    noiseSource.start();
    this.activeNodes.push(noiseSource, filter, hpFilter, gain);
  }

  /**
   * Play procedural Ocean waves
   */
  playOcean() {
    this.initContext();
    this.stopAmbient();
    this.currentTrack = 'ocean';

    const buffer = this.createNoiseBuffer('brown', 5);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // Filter modulated by LFO to simulate wave crashing
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    // LFO for wave cycle (approx 10-second period)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(320, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const waveGain = this.ctx.createGain();
    waveGain.gain.setValueAtTime(0.5, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(this.masterGain);

    noiseSource.start();
    lfo.start();
    this.activeNodes.push(noiseSource, lfo, lfoGain, filter, waveGain);
  }

  /**
   * Play 432Hz Zen Meditation Drone
   */
  playDrone() {
    this.initContext();
    this.stopAmbient();
    this.currentTrack = 'drone';

    // 432Hz fundamental + harmonic warmth
    const freqs = [108, 216, 432, 648];
    const gains = [0.25, 0.2, 0.15, 0.05];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      // Subtle detune for shimmer
      osc.detune.setValueAtTime(idx * 1.5 - 2, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gains[idx], this.ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();

      this.activeNodes.push(osc, gain);
    });
  }

  /**
   * Play Zen Bell (Tibetan Singing Bowl) sound on demand
   */
  playBell(fundamental = 300) {
    this.initContext();
    const now = this.ctx.currentTime;

    // Frequencies of a metallic bell bowl (non-harmonic ratios)
    const partials = [
      { ratio: 1.0, gain: 0.4, decay: 4.5 },
      { ratio: 2.76, gain: 0.25, decay: 3.2 },
      { ratio: 5.4, gain: 0.15, decay: 2.0 },
      { ratio: 8.93, gain: 0.08, decay: 1.2 }
    ];

    partials.forEach(p => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * p.ratio, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(p.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + p.decay);
    });
  }

  /**
   * Play subtle success chime
   */
  playChime() {
    this.initContext();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.8);
    });
  }
}

// Global singleton
window.soundEngine = new SoundEngine();
