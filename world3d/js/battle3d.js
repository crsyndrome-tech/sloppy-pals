/* Stages a Rage Brawl battle right where the encounter happened in the 3D world.
   All rules come from engine.js (window.ENGINE); this file only implements its HOOKS visually. */
import * as THREE from 'three';
import { Actor, loadCard } from './assets.js';
const V = THREE.Vector3;
const E = () => window.ENGINE;
const ELEM = { fire: 0xff7a1a, electric: 0xffe040, water: 0x4ab0ff, none: 0x9be03a };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export class Battle3D {
 constructor(app) {
  this.app = app; this.scene = app.scene; this.fx = []; this.actors = new Map(); this.puddles = [[], []];
  this.geoSph = new THREE.IcosahedronGeometry(1, 1); this.geoRing = new THREE.RingGeometry(0.85, 1, 40); this.geoDisc = new THREE.CircleGeometry(1, 20);
  this.hud = document.getElementById('bhud'); this.fxLayer = document.getElementById('fxLayer'); this.labels = [];
  this.peeled = new Set();
 }
 /* ---------- setup ---------- */
 async begin({ team, cmdr, oppTeam, oppCmdr, level, wild, oppName, center, dir, rivalActor, playerActor, title }) {
  const app = this.app; this.wild = wild; this.center = center.clone();
  this.dir = this.chooseAxis(this.center, dir.clone().setY(0).normalize()); this.perp = new V(-this.dir.z, 0, this.dir.x);
  // hide tall slop grass around the arena so it doesn't bury the Pals
  this.hidden = []; app.world.root.traverse(o => { if (o.isMesh && /^Slop(Grass|Drops)/.test(o.name) && o.visible) { o.geometry.computeBoundingSphere(); const bs = o.geometry.boundingSphere; if (bs.center.distanceTo(this.center) < bs.radius + 14) { o.visible = false; this.hidden.push(o); } } }); this.rivalActor = rivalActor; this.playerActor = playerActor;
  const cards = [...team, ...oppTeam, ...(cmdr ? [cmdr] : []), ...(oppCmdr && !rivalActor ? [oppCmdr] : [])];
  const glbs = new Map(await Promise.all(cards.map(async c => [c.id, await loadCard(c)])));
  this.glbs = glbs; this.slots = this.computeSlots();
  // ground ring + battle circle
  const ring = new THREE.Mesh(new THREE.RingGeometry(9.6, 10, 64), new THREE.MeshBasicMaterial({ color: 0xc6e14b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(this.center).setY(this.app.world.height(this.center.x, this.center.z) + 0.08); this.scene.add(ring); this.ring = ring;
  this.curRing = new THREE.Mesh(this.geoRing, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  this.curRing.rotation.x = -Math.PI / 2; this.scene.add(this.curRing);
  // move the people into place
  if (playerActor) this.moveTo(playerActor, this.slots.player, this.center, 0.6);
  if (rivalActor) this.moveTo(rivalActor, this.slots.cmdr[1], this.center, 0.6);
  // title card + camera swoop
  app.ui.flash(title);
  AUD.sfx('swoosh');
  const cam = this.battleCam();
  await app.swoop(cam.pos, cam.tgt, 1.3);
  return glbs;
 }
 /* pick a battle axis whose slots and camera line are clear of trees, posts and houses (prefers the encounter direction) */
 chooseAxis(c, d0) {
  const W = this.app.world, L = W.L, base = Math.atan2(d0.x, d0.z); let best = d0, bs = 1e9;
  const segHits = (a, b) => { let n = 0; const ab = b.clone().sub(a); const l2 = ab.lengthSq();
   for (const [x, z, r] of L.colliders) { const t = Math.max(0, Math.min(1, ((x - a.x) * ab.x + (z - a.z) * ab.z) / l2)); const px = a.x + ab.x * t - x, pz = a.z + ab.z * t - z; if (px * px + pz * pz < (r + 0.9) ** 2) n++; }
   for (const bx of L.boxes) { for (let t = 0; t <= 1; t += 0.1) { const px = a.x + ab.x * t, pz = a.z + ab.z * t; if (Math.abs(px - bx.x) < bx.hw + 0.5 && Math.abs(pz - bx.z) < bx.hd + 0.5) { n++; break; } } }
   for (let t = 0.1; t < 0.95; t += 0.1) { const px = a.x + ab.x * t, pz = a.z + ab.z * t; if (W.height(px, pz) > a.y + ab.y * t - 0.3) { n++; break; } }
   return n; };
  for (let i = 0; i < 24; i++) {
   const ang = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12;
   const d = new V(Math.sin(ang), 0, Math.cos(ang)), p = new V(-d.z, 0, d.x);
   let pen = Math.abs(Math.ceil(i / 2)) * 0.35;
   for (const k of [-8.2, -5.6, -3.3, 3.3, 5.6, 8.2]) for (const sdx of (Math.abs(k) === 5.6 ? [-2.2, 2.2] : [0])) {
    const q = c.clone().addScaledVector(d, k).addScaledVector(p, sdx);
    for (const [x, z, r] of L.colliders) if ((q.x - x) ** 2 + (q.z - z) ** 2 < (r + 1.0) ** 2) pen += 6;
    for (const bx of L.boxes) if (Math.abs(q.x - bx.x) < bx.hw + 1 && Math.abs(q.z - bx.z) < bx.hd + 1) pen += 6;
    if (W.inWater(q.x, q.z)) pen += 1.5;
   }
   const cam = c.clone().addScaledVector(p, 12.5).addScaledVector(d, -1.2); cam.y = Math.max(W.height(cam.x, cam.z) + 1.5, W.height(c.x, c.z) + 6);
   const tg = c.clone(); tg.y = W.height(c.x, c.z) + 1;
   pen += 4 * (segHits(cam, tg) + segHits(cam, c.clone().addScaledVector(d, -3.3).setY(tg.y)) + segHits(cam, c.clone().addScaledVector(d, 3.3).setY(tg.y)));
   if (pen < bs) { bs = pen; best = d; }
  }
  this.axisPenalty = bs; return best;
 }
 computeSlots() {
  const c = this.center, d = this.dir, p = this.perp; const at = (k, s = 0) => c.clone().addScaledVector(d, k).addScaledVector(p, s);
  return { active: [at(-3.3), at(3.3)], bench: [[at(-5.6, -2.2), at(-5.6, 2.2)], [at(5.6, -2.2), at(5.6, 2.2)]], cmdr: [at(-8.2, 0.3), at(8.2, -0.3)], player: at(-8.4, 2.2) };
 }
 ground(v) { v.y = this.app.world.height(v.x, v.z); return v; }
 moveTo(actor, pos, look, dur = 0.5) {
  const from = actor.obj.position.clone(), to = this.ground(pos.clone());
  const ry0 = actor.obj.rotation.y, ry1 = Math.atan2(look.x - to.x, look.z - to.z);
  this.tween(dur, t => { actor.obj.position.lerpVectors(from, to, ease(t)); actor.obj.position.y = this.app.world.height(actor.obj.position.x, actor.obj.position.z) + Math.sin(t * Math.PI) * 0.4 * (dur > 0.3 ? 1 : 0); let dd = ry1 - ry0; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); actor.obj.rotation.y = ry0 + dd * ease(t); });
  if (actor.has('run') && dur > 0.3) { actor.play('run'); setTimeout(() => actor.play('idle'), dur * 1000); } else if (actor.has('walk') && dur > 0.3) { actor.play('walk'); setTimeout(() => actor.play('idle'), dur * 1000); }
 }
 battleCam() {
  const c = this.center.clone(); c.y = this.app.world.height(c.x, c.z);
  const pos = c.clone().addScaledVector(this.perp, 12.5).addScaledVector(this.dir, -1.2); pos.y = Math.max(this.app.world.height(pos.x, pos.z) + 1.5, c.y + 6);
  return { pos, tgt: c.clone().add(new V(0, 1.1, 0)) };
 }
 /* spawn unit actors once the engine has built G */
 spawnUnits(G) {
  for (const s of G.sides) {
   s.team.forEach((u, i) => {
    const a = new Actor(this.glbs.get(u.card.id)); this.actors.set(E().uid(u), a); a.unit = u;
    const pos = i === s.act ? this.slots.active[s.i] : this.benchSlot(s, u);
    a.obj.position.copy(this.ground(pos.clone())); a.obj.rotation.y = Math.atan2(this.center.x - pos.x, this.center.z - pos.z);
    a.obj.scale.setScalar(0.01); this.scene.add(a.obj);
    const k = i === s.act ? 1 : 0.8; const delay = (s.i * 3 + i) * 0.12;
    this.tween(0.45, t => a.obj.scale.setScalar(Math.max(0.01, k * (t < 1 ? 1 + Math.sin(t * Math.PI) * 0.25 : 1) * ease(t))), delay);
    setTimeout(() => this.burst(a.obj.position.clone().add(new V(0, 0.4, 0)), 0x9be03a, 14, 3), delay * 1000);
   });
   if (s.cmdr) {
    let a;
    if (s.i === 1 && this.rivalActor) a = this.rivalActor; else { a = new Actor(this.glbs.get(s.cmdr.card.id)); const pos = this.ground(this.slots.cmdr[s.i].clone()); a.obj.position.copy(pos); a.obj.rotation.y = Math.atan2(this.center.x - pos.x, this.center.z - pos.z); this.scene.add(a.obj); a.spawned = true; }
    this.actors.set(E().uid(s.cmdr), a); a.unit = s.cmdr;
   }
  }
 }
 benchSlot(s, u) { const b = s.team.filter((x, i) => i !== s.act); const k = Math.max(0, b.indexOf(u)); return this.slots.bench[s.i][k % 2]; }
 actorOf(u) { return this.actors.get(E().uid(u)); }

 /* ---------- engine hooks ---------- */
 hooks() {
  const self = this;
  return {
   render: G => self.render(G),
   log: () => self.renderLog(),
   fx: (u, text, cls) => self.floatText(u, text, cls),
   hit: u => self.onHit(u),
   splat: side => self.onSplat(side),
   banner: u => self.onBanner(u),
   hideBanner: () => self.hideBanner(),
   lunge: (u, o) => self.onLunge(u, o || {}),
   ko: u => self.onKO(u),
   swap: (side, u, old) => self.onSwap(side, u, old),
   command: (u, act) => self.onCommand(u, act),
   end: G => self.done && self.done(G),
   choose: (title, units) => self.app.ui.choosePal(title, units),
  };
 }
 onLunge(u, o) {
  const a = this.actorOf(u); if (!a) return; const G = E().game(); const foe = E().active(G.sides[1 - u.side]); const t = foe && this.actorOf(foe);
  if (u.cmdr) { a.play('point', { once: true }); }
  else {
   a.play('attack', { once: true, speed: 1.2 });
   const p0 = a.obj.position.clone(); const tgt = t ? t.obj.position.clone() : this.center.clone(); const dir = tgt.clone().sub(p0).setY(0).normalize();
   this.tween(0.55, k => { const f = k < 0.3 ? ease(k / 0.3) : 1 - ease((k - 0.3) / 0.7); a.obj.position.copy(p0).addScaledVector(dir, f * 2.1); a.obj.position.y = this.app.world.height(a.obj.position.x, a.obj.position.z) + Math.sin(Math.min(1, k / 0.3) * Math.PI) * 0.5; });
  }
  if (t) {
   const col = ELEM[u.card.element_inferred] || ELEM.none; const big = !!o.over;
   setTimeout(() => this.projectile(a.obj.position.clone().add(new V(0, a.height * 0.6, 0)), t.obj.position.clone().add(new V(0, t.height * 0.5, 0)), big ? 0xff4fc8 : col, big), 90);
   if (big) { this.app.ui.callout('OVERCHARGE!', '#ff4fc8'); this.shock(a.obj.position.clone(), 0xff4fc8, 4); this.app.shake = 0.5; }
  }
 }
 onHit(u) {
  const a = this.actorOf(u); if (!a) return;
  if (!u.ko) a.play('hit', { once: true });
  a.flash(0xffffff, 0.28); this.burst(a.obj.position.clone().add(new V(0, a.height * 0.55, 0)), 0xfff3b0, 16, 4.5); this.app.shake = Math.max(this.app.shake, u.cmdr ? 0.05 : 0.18);
 }
 onKO(u) {
  const a = this.actorOf(u); if (!a) return;
  a.play('ko', { once: true, hold: true }); this.burst(a.obj.position.clone().add(new V(0, 0.5, 0)), 0x777777, 26, 3); this.app.shake = 0.35;
  if (!u.cmdr || a.spawned) setTimeout(() => this.tween(0.8, t => { a.setOpacity(1 - t); }), 1200);
 }
 onSwap(side, u, old) {
  const nu = this.actorOf(u); if (nu) { this.moveTo(nu, this.slots.active[side.i], this.center, 0.45); this.tween(0.45, t => nu.obj.scale.setScalar(0.8 + 0.2 * t)); this.burst(this.slots.active[side.i].clone().add(new V(0, 0.6, 0)), 0x9be03a, 12, 3); }
  if (old && !old.ko) { const oa = this.actorOf(old); if (oa) { const slot = this.slots.bench[side.i][side.team.filter((x, i) => i !== side.act).indexOf(old) % 2 || 0]; this.moveTo(oa, slot, this.center, 0.45); this.tween(0.45, t => oa.obj.scale.setScalar(1 - 0.2 * t)); } }
 }
 onCommand(u, act) {
  const a = this.actorOf(u); if (!a) return; a.play(act === 'rally' ? 'cheer' : 'point', { once: true });
  if (act === 'rally') { const G = E().game(); const p = E().active(G.sides[u.side]); const pa = p && this.actorOf(p); if (pa) this.spiral(pa.obj.position.clone(), 0xff8be0, 1.2); }
 }
 onSplat(side) {
  const G = E().game(); const u = E().active(side); const base = (u && this.actorOf(u)) ? this.actorOf(u).obj.position.clone() : this.slots.active[side.i].clone();
  const ang = Math.random() * 6.28, r = 0.8 + Math.random() * 1.8; const p = base.clone().add(new V(Math.cos(ang) * r, 0, Math.sin(ang) * r)); this.ground(p);
  const m = new THREE.Mesh(this.geoDisc, new THREE.MeshStandardMaterial({ color: 0x8fc21a, emissive: 0x4a7a08, emissiveIntensity: 0.5, roughness: 0.15, transparent: true, opacity: 0.9, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.copy(p).add(new V(0, 0.06 + this.puddles[side.i].length * 0.01, 0)); m.scale.set(0.01, 0.01, 1); m.renderOrder = 2; this.scene.add(m);
  const sx = 0.9 + Math.random() * 0.6, sy = 0.7 + Math.random() * 0.5;
  this.tween(0.35, t => m.scale.set(sx * ease(t) * (1 + 0.3 * Math.sin(t * Math.PI)), sy * ease(t), 1));
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(this.geoSph, m.material); b.scale.setScalar(0.12 + Math.random() * 0.1); b.position.copy(p).add(new V((Math.random() - 0.5) * sx * 1.4, 0.07, (Math.random() - 0.5) * sy * 1.2)); m.parent.add(b); m.userData.blobs = (m.userData.blobs || []).concat(b); }
  this.burst(p.clone().add(new V(0, 0.3, 0)), 0x9be03a, 22, 5, 0.18);
  this.puddles[side.i].push(m); this.app.ui.callout('SPLAT!', '#c6e14b');
 }
 syncPuddles(G) {
  for (const s of G.sides) { const arr = this.puddles[s.i]; while (arr.length > s.slop) { const m = arr.shift(); this.tween(0.4, t => m.scale.multiplyScalar(0.9), 0, () => { m.removeFromParent(); (m.userData.blobs || []).forEach(b => b.removeFromParent()); }); } }
 }
 onBanner(u) {
  const a = this.actorOf(u); const app = this.app;
  const b = document.getElementById('spBanner'); b.className = 'show';
  document.getElementById('spName').textContent = E().spName(u); document.getElementById('spWho').textContent = u.card.name + (u.cmdr ? ' (Commander)' : '');
  document.getElementById('spText').textContent = u.card.secretPower.text; document.getElementById('spArt').src = u.card.art;
  if (!a) return;
  a.play(a.has('cheer') ? 'cheer' : 'attack', { once: true });
  const p = a.obj.position.clone(); const toCam = this.battleCam().pos.clone().sub(p).setY(0).normalize();
  const camPos = p.clone().addScaledVector(toCam, 4.2 + a.height).add(new V(0, 1.2 + a.height * 0.6, 0));
  app.camOverride = { pos: camPos, tgt: p.clone().add(new V(0, a.height * 0.6, 0)), until: performance.now() + Math.max(1200, 1500 * (window.__SPEED || 1)) };
  // aura column + shockwave + spiral
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fc8, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.copy(p).add(new V(0, 3.5, 0)); this.scene.add(beam);
  this.tween(1.5, t => { beam.material.opacity = Math.sin(t * Math.PI) * 0.55; beam.rotation.y += 0.08; beam.scale.set(1 + t * 0.4, 1, 1 + t * 0.4); }, 0, () => { beam.removeFromParent(); beam.geometry.dispose(); });
  this.shock(p.clone(), 0xff4fc8, 5); setTimeout(() => this.shock(p.clone(), 0xf2c14e, 3.5), 250); this.spiral(p.clone(), 0xff8be0, 2.2); this.spiral(p.clone(), 0xf2c14e, 1.6);
  a.flash(0xff4fc8, 0.9); app.ui.tint('#ff4fc8');
  this.peeled.delete('force');
 }
 hideBanner() { document.getElementById('spBanner').className = ''; }

 /* ---------- VFX primitives ---------- */
 tween(dur, fn, delay = 0, done) { this.fx.push({ t: -delay, dur: dur * (window.__SPEED || 1), fn, done }); }
 burst(pos, color, n = 14, speed = 4, size = 0.1) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
   const m = new THREE.Mesh(this.geoSph, mat); m.scale.setScalar(size * (0.6 + Math.random())); m.position.copy(pos); this.scene.add(m);
   const v = new V(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
   this.tween(0.7, t => { m.position.addScaledVector(v, 0.016); v.y -= 0.16; mat.opacity = 1 - t; }, 0, () => m.removeFromParent());
  }
 }
 shock(pos, color, r = 4) {
  const m = new THREE.Mesh(this.geoRing, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.copy(pos).add(new V(0, 0.15, 0)); this.scene.add(m);
  this.tween(0.6, t => { m.scale.setScalar(0.2 + r * ease(t)); m.material.opacity = 1 - t; }, 0, () => { m.removeFromParent(); m.material.dispose(); });
 }
 spiral(pos, color, h = 2) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 18; i++) {
   const m = new THREE.Mesh(this.geoSph, mat); m.scale.setScalar(0.08); this.scene.add(m); const ph = i / 18 * 6.28;
   this.tween(1.1, t => { const a = ph + t * 9, r = 1.1 * (1 - t * 0.5); m.position.set(pos.x + Math.cos(a) * r, pos.y + t * h * 1.6, pos.z + Math.sin(a) * r); mat.opacity = 1 - t; }, i * 0.02, () => m.removeFromParent());
  }
 }
 projectile(from, to, color, big) {
  const m = new THREE.Mesh(this.geoSph, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending })); m.scale.setScalar(big ? 0.45 : 0.25); this.scene.add(m);
  this.tween(0.16, t => { m.position.lerpVectors(from, to, t); m.position.y += Math.sin(t * Math.PI) * 0.6; if (Math.random() < 0.7) this.burst(m.position.clone(), color, 1, 0.6, 0.07); }, 0, () => { m.removeFromParent(); this.burst(to, color, big ? 30 : 16, big ? 6 : 4, big ? 0.16 : 0.11); this.shock(to.clone().setY(to.y - 0.6), color, big ? 3 : 1.6); });
 }
 floatText(u, text, cls) {
  const a = this.actorOf(u); if (!a) return;
  const d = document.createElement('div'); d.className = 'dmg3 ' + (cls || ''); d.textContent = text; this.fxLayer.appendChild(d);
  const p = a.obj.position.clone().add(new V((Math.random() - 0.5) * 0.6, a.height + 0.3, 0));
  this.labels.push({ el: d, p, t: 0 });
 }
 /* ---------- per-frame ---------- */
 update(dt) {
  for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; if (f.t < 0) continue; const k = Math.min(1, f.t / f.dur); f.fn(k); if (k >= 1) { this.fx.splice(i, 1); f.done && f.done(); } }
  for (const a of this.actors.values()) if (a !== this.rivalActor) a.update(dt);
  if (this.playerActor && this.app.mode === 'battle') this.playerActor.update(dt);
  const cam = this.app.camera;
  for (let i = this.labels.length - 1; i >= 0; i--) {
   const l = this.labels[i]; l.t += dt; const v = l.p.clone().add(new V(0, l.t * 1.2, 0)).project(cam);
   l.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px,${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%) scale(${l.t < 0.15 ? 0.6 + l.t * 4 : 1.2 - l.t * 0.2})`;
   l.el.style.opacity = l.t < 0.8 ? 1 : 1 - (l.t - 0.8) * 4; if (l.t > 1.05) { l.el.remove(); this.labels.splice(i, 1); }
  }
  const G = E().game();
  if (G && this.curRing && G.cur) { const a = this.actorOf(G.cur); if (a) { this.curRing.visible = true; this.curRing.position.copy(a.obj.position).add(new V(0, 0.07, 0)); const s = 0.9 + (a.radius || 0.6) + Math.sin(performance.now() / 150) * 0.06; this.curRing.scale.set(s, s, s); this.curRing.material.color.set(G.cur.side === 0 ? 0x5fb0ff : 0xff6a5a); } }
  // rage auras
  for (const a of this.actors.values()) {
   const u = a.unit; if (!u) continue;
   if (u.rage >= 100 && !u.ko) {
    if (!a.aura) { a.aura = new THREE.Mesh(this.geoRing, new THREE.MeshBasicMaterial({ color: 0xff4fc8, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); a.aura.rotation.x = -Math.PI / 2; this.scene.add(a.aura); }
    const k = (performance.now() / 600) % 1; a.aura.position.copy(a.obj.position).add(new V(0, 0.1 + k * 1.5, 0)); a.aura.scale.setScalar((a.radius || 0.6) + 0.5 - k * 0.3); a.aura.material.opacity = 1 - k;
    if (Math.random() < 0.15) this.burst(a.obj.position.clone().add(new V((Math.random() - 0.5), 0.2, (Math.random() - 0.5))), 0xff4fc8, 1, 1.2, 0.06);
   } else if (a.aura) { a.aura.removeFromParent(); a.aura = null; }
  }
 }
 /* ---------- HUD ---------- */
 render(G) {
  this.syncPuddles(G);
  const [p, e] = G.sides, a0 = E().active(p), a1 = E().active(e);
  const pan = (side, u, foe) => {
   if (!u) return `<div class="bp-empty">—</div>`;
   const c = u.card, seen = E().isSeen(u, 0), d = E().SP[E().spName(u)]; const st = d.once && u.used ? ' (spent)' : d.kind === 'passive' ? ' (passive)' : '';
   let stk = '';
   if (foe && !seen) stk = `<div class="stk"><span>SECRET<br>???</span></div>`;
   else if (foe && seen && !this.peeled.has(c.id)) { this.peeled.add(c.id); stk = `<div class="stk peel"><span>SECRET<br>???</span></div>`; AUD.sfx('peel'); }
   const bench = side.team.map((b, i) => i === side.act ? '' : `<div class="bb ${b.ko ? 'ko' : ''}" title="${b.card.name}"><img src="${b.card.art}"><i style="width:${b.hp / b.max * 100}%"></i></div>`).join('');
   const cm = side.cmdr ? `<div class="bcm ${G.cur === side.cmdr ? 'turn' : ''} ${side.cmdr.ko ? 'dead' : ''}"><img src="${side.cmdr.card.art}"><div><b>${side.cmdr.card.name}</b> <small>Commander</small><div class="bar hp sm"><i style="width:${side.cmdr.hp / side.cmdr.max * 100}%"></i></div><div class="bar rg sm ${side.cmdr.rage >= 100 ? 'full' : ''}"><i style="width:${side.cmdr.rage}%"></i></div></div></div>` : (G.wild && foe ? `<div class="bcm wildtag">🌿 Wild Pals — no Commander</div>` : '');
   return `<div class="bcard ${G.cur === u ? 'turn' : ''}"><img src="${c.art}" alt="${c.name}">${stk}</div>
    <div class="binfo"><div class="nm">${c.name} <small>${c.rarity}</small></div>
    <div class="bar hp"><i style="width:${u.hp / u.max * 100}%"></i><span>HP ${u.hp}/${u.max}</span></div>
    <div class="bar rg ${u.rage >= 100 ? 'full' : ''}"><i style="width:${u.rage}%"></i><span>NERD RAGE ${Math.round(u.rage)}%</span></div>
    <div class="stats">ATK ${c.attack} · DEF ${E().effDef(u)} · SPD ${Math.round(E().effSpd(u))} · ⚔ ${c.move.name} ${c.move.damage}</div>
    <div class="sp">${seen ? `✦ <b>${E().spName(u)}</b>${st}: ${c.secretPower.text}` : '✦ <b>???</b> secret power hidden'}</div>
    <div class="tags">${E().tags(u)}</div><div class="bbench">${bench}<span class="slopc">${side.slop ? '🟢'.repeat(side.slop) + ' slop' : ''}</span></div>${cm}</div>`;
  };
  const fc = E().forecast(9);
  let actions = ''; const u = G.cur;
  if (E().waiting() && u && u.side === 0) {
   const me = G.sides[0];
   if (u.cmdr) {
    actions = (!G.pendingFree && E().canSP(u) ? `<button class="rage" data-a="sp">✦ ${E().spName(u)}</button>` : '') + `<button data-a="heckle">📣 Heckle (${u.card.move.name})</button>` + (G.pendingFree ? '' : `<button data-a="rally">🔥 Rally (+rage)</button>`);
   } else {
    const ca = !(u.s.cantAttack > 0);
    actions = (!G.pendingFree && E().canSP(u) ? `<button class="rage" data-a="sp">✦ ${E().spName(u)}</button>` : '') + (!G.pendingFree && u.rage >= 100 && ca ? `<button class="rage" data-a="over">💥 OVERCHARGE</button>` : '') +
     `<button data-a="attack" ${ca ? '' : 'disabled'}>⚔ ${u.card.move.name}</button><button class="slop" data-a="guard">🛡 Guard${me.slop ? ' & Mop' : ''}</button>` +
     (E().canRetreat(me, u) ? me.team.map((b, i) => i !== me.act && !b.ko ? `<button data-a="retreat" data-arg="${i}">↩ ${b.card.name}</button>` : '').join('') : '');
   }
   if (G.pendingFree) actions = `<div class="free">Secret power used — now take your action!</div>` + actions;
   if (G.wild) actions += `<button class="run" data-a="flee">🏃 Run</button>`;
  } else actions = `<div class="thinking">${u ? (u.side === 0 && !E().isAuto() ? '' : u.card.name + ' is thinking…') : ''}</div>`;
  this.hud.querySelector('#bpFoe').innerHTML = pan(e, a1, true);
  this.hud.querySelector('#bpMe').innerHTML = pan(p, a0, false);
  this.hud.querySelector('#btl').innerHTML = fc.map(x => `<div class="t ${x.side === 1 ? 'foe' : ''}" title="${x.card.name}"><img src="${x.card.art}"></div>`).join('');
  const ac = this.hud.querySelector('#bact'); ac.innerHTML = actions;
  ac.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a; if (a === 'flee') E().flee(); else E().act(a, b.dataset.arg !== undefined ? +b.dataset.arg : undefined); });
  this.renderLog();
 }
 renderLog() { const G = E().game(); if (!G) return; const el = document.getElementById('blog'); el.innerHTML = G.log.slice(-40).map(l => `<div class="${l.cls || ''}">${l.html}</div>`).join(''); el.scrollTop = 1e9; }

 /* ---------- teardown ---------- */
 async end() {
  for (const [k, a] of this.actors) { if (a === this.rivalActor) continue; if (a.aura) a.aura.removeFromParent(); a.dispose(); }
  if (this.rivalActor && this.rivalActor.aura) { this.rivalActor.aura.removeFromParent(); this.rivalActor.aura = null; }
  this.actors.clear(); for (const arr of this.puddles) { arr.forEach(m => { m.removeFromParent(); (m.userData.blobs || []).forEach(b => b.removeFromParent()); }); arr.length = 0; }
  this.ring && this.ring.removeFromParent(); this.curRing && this.curRing.removeFromParent(); (this.hidden || []).forEach(o => o.visible = true); this.hidden = [];
  this.labels.forEach(l => l.el.remove()); this.labels = []; this.fx = []; this.peeled = new Set();
 }
}
