// Every sound in Porto Verde is synthesized with WebAudio.
// No audio files, no network — just oscillators, noise and a bassline.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // One short oscillator note, optionally sliding down/up in pitch.
  function blip(freq, dur, type = 'square', vol = 0.2, slideTo = null) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur);
  }

  // Filtered noise burst (gunshots, crashes, punches).
  function noiseBurst(dur, vol = 0.3, cutoff = 400) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  function setEngine(level, on) {
    if (!ensure()) return;
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    if (engineOsc) {
      engineOsc.frequency.setTargetAtTime(55 + level * 130, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(on ? 0.03 + level * 0.05 : 0, ctx.currentTime, 0.1);
    }
  }

  function setSiren(on) {
    if (!ensure()) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 850;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      lfo.start();
      sirenOsc._lfo = lfo;
    }
    if (sirenOsc) sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
  }

  // Slow A-minor bassline, ~100 BPM, while playing.
  const BASSLINE = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const f = BASSLINE[musicStep % BASSLINE.length];
      musicStep += 1;
      if (f > 0) blip(f, 0.28, 'triangle', 0.12);
    }, 300);
  }
  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock,
    gunshot() { noiseBurst(0.12, 0.5, 1800); blip(160, 0.09, 'square', 0.25, 60); },
    punch() { noiseBurst(0.08, 0.3, 600); },
    crash() { noiseBurst(0.35, 0.5, 500); blip(90, 0.25, 'sawtooth', 0.2, 40); },
    hurt() { blip(220, 0.15, 'sawtooth', 0.2, 110); },
    pickup() { blip(660, 0.1, 'sine', 0.2); window.setTimeout(() => blip(880, 0.14, 'sine', 0.2), 90); },
    missionDone() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        window.setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110);
      });
    },
    wantedUp() { blip(440, 0.12, 'square', 0.15); window.setTimeout(() => blip(330, 0.18, 'square', 0.15), 120); },
    busted() { [392, 311, 233].forEach((f, i) => window.setTimeout(() => blip(f, 0.3, 'sawtooth', 0.18), i * 160)); },
    setEngine,
    setSiren,
    startMusic,
    stopMusic,
  };
}
