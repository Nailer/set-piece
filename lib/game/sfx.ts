/** Synthesised wooden board sounds, so the game ships with no audio files. */
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** A short filtered click, like a felted piece landing on wood. */
function knock(freq: number, gain: number, dur = 0.09, at = 0) {
  const a = ac();
  if (!a || muted) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 6;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 2.5;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + at);
}

function tone(freq: number, at: number, dur: number, gain: number) {
  const a = ac();
  if (!a || muted) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.05);
}

export const sfx = {
  setMuted(m: boolean) {
    muted = m;
  },
  unlock() {
    ac();
  },
  select() {
    knock(2400, 0.25, 0.04);
  },
  move() {
    knock(900, 0.9);
  },
  capture() {
    knock(700, 1.1);
    knock(420, 0.8, 0.14, 0.08);
  },
  check() {
    knock(900, 0.8);
    tone(880, 0.04, 0.25, 0.08);
  },
  illegal() {
    tone(180, 0, 0.12, 0.06);
  },
  end(win: boolean) {
    (win ? [523, 659, 784, 1047] : [440, 392, 349]).forEach((f, i) => tone(f, i * 0.12, 0.45, 0.1));
  },
};
