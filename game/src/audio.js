// audio.js — synthesized WebAudio sound effects for Porto Verde.
// No audio files, no network: every sound is an oscillator + noise burst.
// Safe to construct in Node (no AudioContext there): every method no-ops.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let sirenTimer = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', gain = 0.15, slideTo = null) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  function noise(dur, gain = 0.2, lowpass = 1200) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ac.destination);
    src.start(t0);
  }

  return {
    unlock() {
      const ac = ensure();
      if (ac && ac.state === 'suspended') ac.resume();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopSiren();
      return muted;
    },
    shot() {
      noise(0.12, 0.35, 2500);
      tone(180, 0.08, 'square', 0.12, 60);
    },
    punch() {
      noise(0.08, 0.2, 500);
    },
    reload() {
      tone(600, 0.06, 'square', 0.08);
      setTimeout(() => tone(900, 0.06, 'square', 0.08), 120);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.15);
      setTimeout(() => tone(990, 0.14, 'sine', 0.15), 100);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.16), i * 130));
    },
    busted() {
      tone(220, 0.5, 'sawtooth', 0.14, 110);
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.16), i * 150));
    },
    engine() {
      tone(70, 0.3, 'sawtooth', 0.07, 120);
    },
    skid() {
      noise(0.18, 0.1, 900);
    },
    startSiren() {
      if (muted || sirenTimer) return;
      const ac = ensure();
      if (!ac) return;
      let high = true;
      sirenTimer = setInterval(() => {
        if (muted) return;
        tone(high ? 950 : 700, 0.32, 'sine', 0.05);
        high = !high;
      }, 340);
    },
    stopSiren() {
      if (sirenTimer) {
        clearInterval(sirenTimer);
        sirenTimer = null;
      }
    },
  };
}
