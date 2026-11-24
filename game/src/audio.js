// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, police siren, gunshots, crashes, punches and a bassline.
// Round 2: mute now ramps smoothly instead of cutting, and there is a
// short uiClick() for menu buttons. Notes, volumes and timing unchanged.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: a low sawtooth whose pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    // Siren: a sine that sweeps up and down while wanted.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 750;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
    this.startMusic();
  }

  setEngine(speed01, driving) {
    if (!this.ctx || this.muted) return;
    const target = driving ? 0.05 + speed01 * 0.09 : 0.015;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.1);
  }

  setSiren(on, wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on && !this.muted ? 0.03 + wanted * 0.008 : 0, t, 0.2);
    // Two-tone sweep driven by the caller's update tick.
    this.sirenOsc.frequency.setTargetAtTime(700 + 180 * Math.sin(t * 3.2), t, 0.05);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = type || 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start();
  }

  shoot() { this.noise(0.14, 0.28, 2400); this.blip(180, 0.08, 'square', 0.08); }
  punch() { this.noise(0.08, 0.18, 900); }
  crash() { this.noise(0.3, 0.3, 700); this.blip(70, 0.25, 'sawtooth', 0.15); }
  pickup() { this.blip(660, 0.1, 'sine', 0.12); setTimeout(() => this.blip(880, 0.14, 'sine', 0.12), 90); }
  busted() { this.blip(220, 0.4, 'sawtooth', 0.14); this.blip(165, 0.5, 'sawtooth', 0.14); }
  missionDone() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'sine', 0.14), i * 120)); }
  uiClick() { this.blip(520, 0.06, 'sine', 0.1); }

  // A slow minor-key bassline, one note per beat, looping while playing.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const notes = [55, 55, 65.4, 49, 55, 82.4, 73.4, 65.4];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = notes[this.step % notes.length]; this.step++;
      this.blip(f, 0.5, 'triangle', 0.05);
    }, 520);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      // Ramp instead of an abrupt cut so muting never pops.
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.02, t, 0.08);
      this.sirenGain.gain.setTargetAtTime(0, t, 0.08);
    }
    return this.muted;
  }
}
