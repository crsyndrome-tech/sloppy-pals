import * as THREE from 'three';
import { loadGLB, Actor, textSprite, loadCard } from './assets.js';
import { card, RIVALS, BOSS, NPCS, AREAS, RARITY_W, RARITY_BADGES } from './data.js';

const V = THREE.Vector3;
export class World {
 constructor(app) { this.app = app; this.scene = app.scene; }
 async load(onProgress) {
  const [layout, gltf] = await Promise.all([fetch('assets/models/world_layout.json').then(r => r.json()), loadGLB('assets/models/world.glb')]);
  onProgress && onProgress(0.5);
  this.L = layout; this.root = gltf.scene; this.scene.add(this.root);
  this.root.traverse(o => {
   if (!o.isMesh) return;
   const terrain = o.name.startsWith('Terrain');
   o.receiveShadow = true; o.castShadow = !terrain && !/Water|Muck|Grass|Drops|Puddle/.test(o.name);
   if (terrain && o.material) { o.material.vertexColors = true; o.material.flatShading = true; o.material.needsUpdate = true; }
   if (/Water|SlopPuddle|SlopDrops|Fountain/.test(o.name) && o.material && o.material.transparent) o.material.depthWrite = false;
  });
  this.gate = this.root.getObjectByName('BossGate');
  this.water = []; this.root.traverse(o => { if (o.isMesh && /BogWater|Water/.test(o.name)) this.water.push(o); });
  return this;
 }
 height(x, z) {
  const L = this.L, n = L.n, S = L.size; const bx = x, by = -z;
  let i = (bx + S / 2) / S * n, j = (by + S / 2) / S * n; i = Math.max(0, Math.min(n - 0.001, i)); j = Math.max(0, Math.min(n - 0.001, j));
  const i0 = Math.floor(i), j0 = Math.floor(j), fx = i - i0, fy = j - j0, h = L.heights;
  // match the terrain's triangle split (quad v00,v10,v11,v01)
  const a = h[j0][i0], b = h[j0][i0 + 1], c = h[j0 + 1][i0 + 1], d = h[j0 + 1][i0];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + c * fx) * fy;
 }
 groundY(x, z) { return this.height(x, z); }
 inWater(x, z) { const w = this.L.water.bog; return Math.hypot(x - w.x, z - w.z) < w.r && this.height(x, z) < w.level - 0.15; }
 gateOpen(v) { if (this.gate) this.gate.visible = !v; this._gateOpen = v; }
 collide(p, r = 0.45) {
  for (const [x, z, cr] of this.L.colliders) {
   const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), m = cr + r;
   if (d < m && d > 1e-4) { p.x = x + dx / d * m; p.z = z + dz / d * m; }
  }
  for (const b of this.L.boxes) {
   if (b.tag === 'gate' && this._gateOpen) continue;
   const hw = b.hw + r, hd = b.hd + r, dx = p.x - b.x, dz = p.z - b.z;
   if (Math.abs(dx) < hw && Math.abs(dz) < hd) { const ox = hw - Math.abs(dx), oz = hd - Math.abs(dz); if (ox < oz) p.x = b.x + Math.sign(dx || 1) * hw; else p.z = b.z + Math.sign(dz || 1) * hd; }
  }
  const lim = 106; p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z));
 }
 areaAt(x, z) {
  const A = this.L.areas; const d = k => Math.hypot(x - A[k][0], z - A[k][1]);
  if (d('town') < 38) return 'Slopville (Town & Lab)'; if (d('bog') < 34) return 'The Bog'; if (d('muck') < 32) return 'Muck Pits';
  if (d('grove') < 30) return 'Mushroom Grove'; if (d('trash') < 30) return 'Trash Heap'; if (d('boss') < 26) return "Villain's Tower"; return 'Sloppy Meadow';
 }
 spawn(k) { const s = this.L.spawns[k]; return new V(s.x, this.height(s.x, s.z), s.z); }
 update(t) { for (const w of this.water) { w.position.y = Math.sin(t * 0.8) * 0.03; } }
}

/* ---------------- player + third-person camera ---------------- */
export class Player {
 constructor(app, actor) {
  this.app = app; this.actor = actor; this.obj = actor.obj; this.pos = new V(); this.yaw = Math.PI; this.camYaw = 0; this.camPitch = 0.42; this.dist = 9;
  this.keys = new Set(); this.joy = new THREE.Vector2(); this.moving = false; this.stepT = 0; this.frozen = false; this.speedMul = 1;
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; this.keys.add(e.code); });
  addEventListener('keyup', e => this.keys.delete(e.code));
  addEventListener('blur', () => this.keys.clear());
  const cv = app.renderer.domElement; let drag = null;
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.35) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; this.camYaw -= (e.clientX - drag.x) * 0.006; this.camPitch = Math.max(0.08, Math.min(1.25, this.camPitch + (e.clientY - drag.y) * 0.004)); drag.x = e.clientX; drag.y = e.clientY; });
  addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) drag = null; });
  cv.addEventListener('wheel', e => { this.dist = Math.max(4, Math.min(18, this.dist + Math.sign(e.deltaY) * 0.8)); }, { passive: true });
  this.setupJoystick();
 }
 setupJoystick() {
  const base = document.getElementById('joy'), knob = document.getElementById('joyKnob'); let id = null, cx = 0, cy = 0;
  addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (id === null && t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.35 && this.app.mode === 'world' && !e.target.closest('button,.panel,.modal')) { id = t.identifier; cx = t.clientX; cy = t.clientY; base.style.display = 'block'; base.style.left = cx - 60 + 'px'; base.style.top = cy - 60 + 'px'; knob.style.transform = 'translate(0,0)'; } } }, { passive: true });
  addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === id) { let dx = t.clientX - cx, dy = t.clientY - cy; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; this.joy.set(dx / m, -dy / m); } }, { passive: true });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; this.joy.set(0, 0); base.style.display = 'none'; } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
 }
 place(p, yaw) { this.pos.copy(p); if (yaw !== undefined) { this.yaw = yaw; this.camYaw = yaw + Math.PI; } this.sync(); }
 sync() { this.obj.position.copy(this.pos); this.obj.rotation.y = this.yaw; }
 update(dt, world) {
  let ix = 0, iy = 0; const k = this.keys;
  if (!this.frozen) {
   if (k.has('KeyW') || k.has('ArrowUp')) iy += 1; if (k.has('KeyS') || k.has('ArrowDown')) iy -= 1;
   if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1; if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
   ix += this.joy.x; iy += this.joy.y;
  }
  const l = Math.hypot(ix, iy); let run = k.has('ShiftLeft') || k.has('ShiftRight') || l > 0.92 && this.joy.lengthSq() > 0.8;
  if (l > 0.1) {
   ix /= Math.max(1, l); iy /= Math.max(1, l);
   const fw = new V(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)), rt = new V(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
   const dir = fw.multiplyScalar(iy).add(rt.multiplyScalar(ix));
   const wet = world.inWater(this.pos.x, this.pos.z);
   const sp = (run ? 10 : 5.2) * (wet ? 0.6 : 1) * this.speedMul;
   this.pos.addScaledVector(dir, sp * dt);
   const ty = Math.atan2(dir.x, dir.z); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 12);
   this.actor.play(run ? 'run' : 'walk', { speed: run ? 1.1 : 1.15 });
   this.stepT -= dt; if (this.stepT <= 0) { this.stepT = run ? 0.3 : 0.45; window.AUD && AUD.sfx('step'); }
   this.moving = true;
  } else { if (this.moving) this.actor.play('idle'); this.moving = false; }
  world.collide(this.pos, 0.45);
  this.pos.y = world.height(this.pos.x, this.pos.z);
  this.sync();
 }
 cameraGoal(world, out = {}) {
  const tgt = this.pos.clone().add(new V(0, 1.6, 0));
  const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
  const pos = tgt.clone().add(new V(Math.sin(this.camYaw) * cp * this.dist, sp * this.dist, Math.cos(this.camYaw) * cp * this.dist));
  const g = world.height(pos.x, pos.z) + 0.8; if (pos.y < g) pos.y = g;
  out.pos = pos; out.tgt = tgt; return out;
 }
}

/* ---------------- NPCs: rivals, helpers, boss ---------------- */
export class People {
 constructor(app, world) { this.app = app; this.world = world; this.list = []; }
 async load() {
  const defs = [...RIVALS.map(r => ({ kind: 'rival', def: r })), { kind: 'boss', def: BOSS }, ...NPCS.map(n => ({ kind: 'npc', def: n }))];
  await Promise.all(defs.map(async d => {
   const c = card(d.def.card); const g = await loadCard(c); const a = new Actor(g);
   const p = this.world.spawn(d.def.spawn); a.obj.position.copy(p);
   const tw = this.world.L.areas.town; a.home = p.clone(); a.obj.rotation.y = d.def.face !== undefined ? d.def.face : Math.atan2(tw[0] - p.x, tw[1] - p.z);
   if (d.kind === 'npc') a.obj.rotation.y = Math.atan2(-p.x * 0 + (this.world.spawn('player').x - p.x), this.world.spawn('player').z - p.z);
   const label = textSprite(d.kind === 'npc' ? d.def.name : (d.kind === 'boss' ? '☠ ' + c.name : `Rival ${d.def.n}: ${c.name}`), { color: d.kind === 'npc' ? '#c6e14b' : d.kind === 'boss' ? '#ff6bd6' : '#f2c14e', size: 40, scale: 0.9 });
   label.position.y = a.height + 0.55; a.obj.add(label); a.label = label;
   const mark = textSprite('!', { color: '#ffef3a', bg: 'rgba(160,0,40,.85)', size: 64, scale: 1.1 }); mark.position.y = a.height + 1.3; mark.visible = false; a.obj.add(mark); a.mark = mark;
   const chk = textSprite('✔ beaten', { color: '#9fff8a', size: 34, scale: 0.7 }); chk.position.y = a.height + 1.05; chk.visible = false; a.obj.add(chk); a.chk = chk;
   this.app.scene.add(a.obj);
   this.list.push({ ...d, card: c, actor: a, state: 'idle', t: Math.random() * 5 });
  }));
 }
 refresh(save) {
  for (const p of this.list) {
   const beaten = p.kind === 'rival' ? save.beaten.includes(p.def.n) : p.kind === 'boss' ? save.bossBeaten : false;
   p.beaten = beaten; p.actor.chk.visible = beaten; if (beaten) { p.state = 'idle'; p.actor.mark.visible = false; }
  }
 }
 update(dt, player, onEncounter, canBattle) {
  let near = null;
  for (const p of this.list) {
   const a = p.actor; a.update(dt);
   const d = a.obj.position.distanceTo(player.pos);
   a.label.visible = d < 30 && this.app.mode !== 'battle';
   if (p.state === 'battle') continue;
   if (p.kind === 'npc' || p.beaten || !canBattle) {
    if (d < 3.2) { near = p; a.obj.rotation.y = lerpAngle(a.obj.rotation.y, Math.atan2(player.pos.x - a.obj.position.x, player.pos.z - a.obj.position.z), dt * 5); }
    if (p.kind === 'npc' && p.def.id === 'scorch') this.wander(p, dt);
    continue;
   }
   if (p.kind === 'boss' && !this.world._gateOpen) { if (d < 3.2) near = p; continue; }
   const spot = p.kind === 'boss' ? 9 : 7.5;
   if (p.state === 'idle' && d < spot) { p.state = 'spotted'; p.t = 0.7; a.mark.visible = true; a.play('point', { once: true }); window.AUD && AUD.sfx('encounter'); this.app.ui.toast(`${p.card.name} spotted you!`); }
   if (p.state === 'spotted') { p.t -= dt; a.obj.rotation.y = Math.atan2(player.pos.x - a.obj.position.x, player.pos.z - a.obj.position.z); if (p.t <= 0) p.state = 'approach'; }
   if (p.state === 'approach') {
    const dir = player.pos.clone().sub(a.obj.position); dir.y = 0; const l = dir.length();
    a.obj.rotation.y = Math.atan2(dir.x, dir.z); a.play('run');
    if (l > 1.6) { a.obj.position.addScaledVector(dir.normalize(), Math.min(l, 6.5 * dt)); a.obj.position.y = this.world.height(a.obj.position.x, a.obj.position.z); }
    if (l < 1.9) { p.state = 'battle'; a.mark.visible = false; onEncounter({ kind: p.kind, person: p }); }
   }
  }
  return near;
 }
 wander(p, dt) {
  const a = p.actor; p.t -= dt;
  if (!p.goal || p.t < 0) { p.goal = a.home.clone().add(new V((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)); p.t = 3 + Math.random() * 4; }
  const dir = p.goal.clone().sub(a.obj.position); dir.y = 0; const l = dir.length();
  if (l > 0.4 && p.t < 2.5) { a.obj.position.addScaledVector(dir.normalize(), Math.min(l, 1.8 * dt)); a.obj.rotation.y = lerpAngle(a.obj.rotation.y, Math.atan2(dir.x, dir.z), dt * 6); a.play('walk'); a.obj.position.y = this.world.height(a.obj.position.x, a.obj.position.z); }
  else a.play('idle');
 }
 home(p) { const a = p.actor; a.obj.position.copy(a.home); a.play('idle'); p.state = 'idle'; a.mark.visible = false; }
}
export const lerpAngle = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * Math.min(1, t); };

/* ---------------- wild Pals lurking in slop grass ---------------- */
export class Wilds {
 constructor(app, world) { this.app = app; this.world = world; this.slots = world.L.patches.map((p, i) => ({ i, patch: p, actor: null, loading: false, cool: Math.random() * 2 })); }
 pick(area, save) {
  const pool = AREAS[area].pool.map(card).filter(c => save.badges >= RARITY_BADGES[c.rarity]);
  const unowned = pool.filter(c => !save.collection.includes(c.id)); const src = unowned.length && Math.random() < 0.8 ? unowned : pool;
  const tot = src.reduce((a, c) => a + RARITY_W[c.rarity], 0); let r = Math.random() * tot;
  for (const c of src) { r -= RARITY_W[c.rarity]; if (r <= 0) return c; } return src[0];
 }
 update(dt, player, save, onEncounter, canBattle) {
  for (const s of this.slots) {
   const P = s.patch; const d = Math.hypot(player.pos.x - P.x, player.pos.z - P.z);
   if (!s.actor && !s.loading && d < 70 && (s.cool -= dt) <= 0) {
    s.loading = true; const c = this.pick(P.area, save);
    loadCard(c).then(g => { const a = new Actor(g); a.card = c; const ang = Math.random() * 6.28, rr = Math.random() * P.r * 0.6; a.obj.position.set(P.x + Math.cos(ang) * rr, 0, P.z + Math.sin(ang) * rr); a.obj.position.y = this.world.height(a.obj.position.x, a.obj.position.z);
     const lb = textSprite('wild ' + c.name, { color: '#b8ff6a', size: 32, scale: 0.6 }); lb.position.y = a.height / a.obj.scale.y + 0.4; a.obj.add(lb); a.lb = lb;
     this.app.scene.add(a.obj); s.actor = a; s.loading = false; s.t = 0; }).catch(e => { console.error(e); s.loading = false; s.cool = 10; });
   }
   const a = s.actor; if (!a) continue;
   if (d > 95) { a.dispose(); s.actor = null; s.cool = 1; continue; }
   a.update(dt); a.lb.visible = a.obj.position.distanceTo(player.pos) < 22;
   s.t -= dt;
   if (!s.goal || s.t <= 0) { const ang = Math.random() * 6.28, rr = Math.random() * P.r * 0.85; s.goal = new V(P.x + Math.cos(ang) * rr, 0, P.z + Math.sin(ang) * rr); s.t = 2 + Math.random() * 4; }
   const dir = s.goal.clone().sub(a.obj.position); dir.y = 0; const l = dir.length();
   if (l > 0.3 && s.t < 3) { a.obj.position.addScaledVector(dir.normalize(), Math.min(l, 1.6 * dt)); a.obj.rotation.y = lerpAngle(a.obj.rotation.y, Math.atan2(dir.x, dir.z), dt * 5); a.play('walk'); }
   else a.play('idle');
   a.obj.position.y = this.world.height(a.obj.position.x, a.obj.position.z);
   if (canBattle && a.obj.position.distanceTo(player.pos) < 1.2 + a.radius * 0.6) { const act = a; s.actor = null; s.cool = 8; onEncounter({ kind: 'wild', actor: act, area: P.area }); }
  }
 }
 clearNear(p, r = 8) { for (const s of this.slots) if (s.actor && s.actor.obj.position.distanceTo(p) < r) { s.actor.dispose(); s.actor = null; s.cool = 6; } }
}
