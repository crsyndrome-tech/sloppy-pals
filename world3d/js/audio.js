'use strict';
/* (3D build copy, adds overworld music mode + world SFX) Procedural Web Audio: all sounds synthesized at runtime (no samples, no copyright). */
window.AUD = (() => {
 let ctx = null, master, sfxBus, musBus, noiseBuf, musicWanted = false, musicTimer = null, step = 0, nextT = 0;
 const st = { vol: +(localStorage.getItem('sp_vol') ?? 0.6), mute: localStorage.getItem('sp_mute') === '1', musicOn: localStorage.getItem('sp_music') !== '0' };
 function init() {
  if (ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master); musBus = ctx.createGain(); musBus.gain.value = 0.32; musBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  apply(); if (musicWanted) startMusic();
 }
 // audio only after a user gesture
 ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }, { capture: true }));
 function apply() { if (!master) return; master.gain.value = st.mute ? 0 : st.vol; musBus.gain.value = st.musicOn ? 0.32 : 0; }
 function tone(f, t0, dur, type = 'square', vol = 0.3, f2, bus = sfxBus) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.02);
 }
 function noise(t0, dur, vol = 0.3, freq = 1200, q = 1, type = 'lowpass', bus = sfxBus) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t0); s.stop(t0 + dur + 0.02);
 }
 const SFX = {
  peel: t => { noise(t, 0.35, 0.3, 2500, 3, 'bandpass'); tone(600, t + 0.25, 0.15, 'square', 0.12, 1200); },
  click: t => tone(880, t, 0.05, 'square', 0.12, 660),
  hit: t => { noise(t, 0.12, 0.4, 900); tone(160, t, 0.12, 'triangle', 0.4, 60); },
  bigHit: t => { noise(t, 0.35, 0.55, 600); tone(120, t, 0.35, 'sawtooth', 0.35, 35); tone(240, t + 0.05, 0.2, 'square', 0.15, 80); },
  whiff: t => noise(t, 0.2, 0.2, 3000, 2, 'bandpass'),
  splat: t => { noise(t, 0.25, 0.5, 400, 4); tone(90, t, 0.18, 'sine', 0.4, 40); tone(300, t + 0.04, 0.12, 'sine', 0.2, 900); },
  slip: t => { tone(300, t, 0.35, 'sine', 0.3, 1400); tone(1400, t + 0.3, 0.2, 'sine', 0.2, 200); },
  rage: t => [0, 1, 2, 3].forEach(i => tone(220 * Math.pow(1.26, i), t + i * 0.06, 0.12, 'sawtooth', 0.18)),
  secret: t => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.07, 0.4, 'triangle', 0.22)); noise(t, 0.6, 0.15, 6000, 1, 'highpass'); },
  ko: t => { tone(440, t, 0.7, 'square', 0.25, 55); noise(t + 0.1, 0.5, 0.25, 300); },
  victory: t => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.13, i === 5 ? 0.7 : 0.15, 'square', 0.2)),
  encounter: t => { [880, 660, 880, 660, 1175].forEach((f, i) => tone(f, t + i * 0.06, 0.09, 'square', 0.16)); noise(t + 0.3, 0.5, 0.25, 1800, 2, 'bandpass'); tone(110, t + 0.3, 0.6, 'sawtooth', 0.3, 55); },
  swoosh: t => noise(t, 0.45, 0.3, 900, 1.5, 'bandpass'),
  step: t => noise(t, 0.05, 0.06, 500, 1),
  catch: t => [523, 784, 1047, 1568].forEach((f, i) => tone(f, t + i * 0.09, 0.25, 'triangle', 0.22)),
  badge: t => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.1, i === 5 ? 0.9 : 0.18, 'square', 0.18)),
  talk: t => { for (let i = 0; i < 4; i++) tone(300 + Math.random() * 300, t + i * 0.05, 0.04, 'square', 0.06); },
  defeat: t => [392, 370, 349, 262].forEach((f, i) => tone(f, t + i * 0.25, 0.3, 'triangle', 0.25, i === 3 ? 130 : undefined)),
 };
 function sfx(n) { if (!ctx || st.mute || !SFX[n]) return; try { SFX[n](ctx.currentTime + 0.01); } catch (e) {} }
 // ---- goofy swampy chiptune loop (original, 16-step pattern, 4 chords) ----
 let BPM = 112, S16 = 60 / BPM / 4, mode = 'battle';
 const chords = [[0, 3, 7], [5, 8, 12], [-2, 2, 5], [7, 11, 14]]; // Am-ish swamp bounce
 const lead = [12, -1, 15, 12, -1, 10, 7, -1, 12, 15, 17, -1, 15, 12, 10, 7];
 const root = 220;
 const hz = s => root * Math.pow(2, s / 12);
 function schedule() {
  while (nextT < ctx.currentTime + 0.25) {
   const bar = Math.floor(step / 16) % 4, s = step % 16, ch = chords[bar];
   if (s % 4 === 0) tone(hz(ch[0] - 24), nextT, S16 * 3, 'triangle', 0.5, undefined, musBus);           // bouncy bass
   if (s % 4 === 2) tone(hz(ch[0] - 12), nextT, S16, 'triangle', 0.3, undefined, musBus);
   if (s % 2 === 1) tone(hz(ch[s % 3] + 12), nextT, S16 * 0.6, 'square', 0.05, undefined, musBus);      // arp blips
   const l = lead[(s + bar * 3) % 16]; if (l >= 0 && bar % 2 === 1) tone(hz(l + (bar === 3 ? 2 : 0)), nextT, S16 * 1.6, 'square', 0.07, undefined, musBus);
   if (s % 8 === 4 && mode === 'battle') noise(nextT, 0.08, 0.2, 2500, 1, 'highpass', musBus);                                // snare-ish
   if (s % 4 === 0 && (mode === 'battle' || s % 8 === 0)) tone(140, nextT, 0.08, 'sine', 0.5, 45, musBus);                                     // kick
   if (s === 14 && bar === 3) tone(hz(0), nextT, S16 * 2, 'sine', 0.15, hz(-12), musBus);                // swampy bloop
   nextT += S16; step++;
  }
 }
 function startMusic() { if (!ctx || musicTimer) return; nextT = ctx.currentTime + 0.05; step = 0; musicTimer = setInterval(schedule, 60); }
 function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
 function music(on, m) { if (m && m !== mode) { mode = m; BPM = m === 'battle' ? 112 : 88; S16 = 60 / BPM / 4; } musicWanted = on; if (!ctx) return; on ? startMusic() : stopMusic(); }
 function save() { localStorage.setItem('sp_vol', st.vol); localStorage.setItem('sp_mute', st.mute ? '1' : '0'); localStorage.setItem('sp_music', st.musicOn ? '1' : '0'); apply(); }
 return { sfx, music, st, toggleMute() { st.mute = !st.mute; save(); }, toggleMusic() { st.musicOn = !st.musicOn; save(); }, setVol(v) { st.vol = v; save(); } };
})();
