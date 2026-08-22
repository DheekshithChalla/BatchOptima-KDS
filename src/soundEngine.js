// Web Audio API Sound Engine (Zero external audio asset dependencies)
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initContext();
  }

  initContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext && !this.ctx) {
        this.ctx = new AudioContext();
      }
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playChime(type = 'newOrder') {
    if (!this.enabled) return;
    this.initContext();
    this.resume();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'newOrder') {
      // Pleasant high double chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, t); // D5
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.1); // A5
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    } else if (type === 'split') {
      // Urgent sci-fi double frequency pop for split
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(784, t + 0.12);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(880, t + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(1174, t + 0.25);
      gain2.gain.setValueAtTime(0.12, t + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.start(t);
      osc.stop(t + 0.28);
      osc2.start(t + 0.1);
      osc2.stop(t + 0.35);
    } else if (type === 'cook') {
      // Kitchen sizzle/whistle lock tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, t); // E4
      osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.2); // E5
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    } else if (type === 'dispatch') {
      // Ascending triumphant chord
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t + i * 0.06);
        g.gain.setValueAtTime(0.1, t + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.3);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(t + i * 0.06);
        o.stop(t + i * 0.06 + 0.3);
      });
    } else if (type === 'warning') {
      // Low attention tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.setValueAtTime(180, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  }
}

window.soundEngine = new SoundEngine();
