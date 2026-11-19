// Synthesized sound: every effect and the music are made with WebAudio, no audio files.
// The context is created on the first user gesture (title screen), never before.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let musicStep = 0;

  // A minor-key bassline for the Porto Verde streets (A minor, 100 BPM, 8 steps a bar).
  const BASSLINE = [55, 0, 55, 65.41, 55, 0, 49, 58.27];
  const STEP_SECONDS = 60 / 100 / 2;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type = 'lowpass', when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      this.startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) this.setSiren(false);
    },
    isMuted() { return muted; },
    click() { blip(660, 0.06, 'square', 0.12); },
    pickup() { blip(880, 0.09, 'sine', 0.2); blip(1318, 0.14, 'sine', 0.18, 0.07); },
    gunshot() { noise(0.16, 0.5, 900); blip(160, 0.1, 'square', 0.25, 0, 60); },
    punch() { noise(0.1, 0.4, 300); },
    crash() { noise(0.35, 0.5, 500); blip(90, 0.25, 'sawtooth', 0.3, 0, 40); },
    hurt() { blip(220, 0.15, 'sawtooth', 0.2, 0, 110); },
    wantedUp() { blip(440, 0.12, 'square', 0.2); blip(587, 0.18, 'square', 0.2, 0.1); },
    missionDone() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, 0.22, 'triangle', 0.22, i * 0.09));
    },
    busted() { [392, 311, 233].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.2, i * 0.16)); },
    setEngine(speed01, on) {
      if (!ctx || muted) return;
      if (!on) {
        if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass'; engineFilter.frequency.value = 500;
        engineGain = ctx.createGain(); engineGain.gain.value = 0;
        engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx) return;
      if (!on) {
        if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        return;
      }
      if (muted) return;
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
        sirenLfo = ctx.createOscillator();
        sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.9;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
        sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); sirenLfo.start();
      }
      sirenGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.3);
    },
    startMusic() {
      if (!ctx || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted || !ctx) return;
        const bass = BASSLINE[musicStep % BASSLINE.length];
        if (bass) blip(bass, STEP_SECONDS * 0.9, 'triangle', 0.16);
        if (musicStep % 2 === 0) noise(0.03, 0.05, 6000, 'highpass');
        musicStep += 1;
      }, STEP_SECONDS * 1000);
    },
  };
}
