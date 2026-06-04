// Tiny procedural sound engine built on the Web Audio API — no asset files, so
// the game stays fully self-contained for local play.
let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const Audio = {
  resume() { ac(); },

  shoot() {
    const c = ac();
    const t = c.currentTime;
    // punchy noise burst
    const buf = c.createBuffer(1, 2048, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
    // low thump
    tone(60, 'sine', 0.4, 0.12, t);
  },

  reload() {
    const t = ac().currentTime;
    tone(220, 'square', 0.12, 0.05, t);
    tone(180, 'square', 0.12, 0.05, t + 0.18);
    tone(320, 'square', 0.12, 0.05, t + 0.42);
  },

  empty() {
    tone(150, 'square', 0.1, 0.04, ac().currentTime);
  },

  hitmarker() {
    tone(900, 'triangle', 0.12, 0.04, ac().currentTime);
  },

  roar() {
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.5);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(f).connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.75);
  },

  hurt() {
    const t = ac().currentTime;
    tone(140, 'sawtooth', 0.35, 0.12, t);
  },

  waveStart() {
    const t = ac().currentTime;
    tone(440, 'triangle', 0.18, 0.07, t);
    tone(660, 'triangle', 0.18, 0.07, t + 0.12);
    tone(880, 'triangle', 0.25, 0.07, t + 0.24);
  },

  gameOver() {
    const t = ac().currentTime;
    tone(330, 'sawtooth', 0.3, 0.12, t);
    tone(247, 'sawtooth', 0.3, 0.12, t + 0.25);
    tone(165, 'sawtooth', 0.6, 0.12, t + 0.5);
  },
};

function tone(freq, type, dur, vol, t) {
  const c = ac();
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur);
}
