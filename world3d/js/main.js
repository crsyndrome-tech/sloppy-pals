/* Sloppy Pals: Rage Brawl — 3D open world. Boot, game loop, progression, encounters, save. */
import * as THREE from 'three';
import { loadGLB, Actor } from './assets.js';
import { World, Player, People, Wilds } from './world.js';
import { Battle3D } from './battle3d.js';
import { UI } from './ui.js';
import { card, RIVALS, BOSS, NPCS, LEVEL_SHIFT, START_CMDRS, AREAS } from './data.js';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1', FAST = Q.get('fast') === '1', AUTOQ = Q.get('auto') === '1';
window.__errors = window.__errors || [];
window.__SPEED = FAST ? 0.25 : 1;
const V = THREE.Vector3;
const SAVE_KEY = 'sp3d_save_v1';

class App {
 constructor() {
  this.mode = 'boot'; this.shake = 0; this.camOverride = null; this.clock = new THREE.Clock();
  const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.6)); r.setSize(innerWidth, innerHeight); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  document.getElementById('view').appendChild(r.domElement);
  const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x9fc6d8); s.fog = new THREE.Fog(0x9fc6d8, 60, 190);
  this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500); this.camera.position.set(0, 30, 40);
  this.camTgt = new V(); this.camPos = new V(0, 30, 40);
  s.add(new THREE.HemisphereLight(0xdff2ff, 0x3a4a20, 1.15));
  const sun = this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 160 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; s.add(sun); s.add(sun.target);
  addEventListener('resize', () => { r.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); });
  this.ui = new UI(this); window.__app = this;
 }
 async boot() {
  this.ui.loading(0.05, 'Loading the swamp…');
  this.world = await new World(this).load(p => this.ui.loading(0.1 + p * 0.4));
  this.ui.loading(0.55, 'Waking up the locals…');
  const pg = await loadGLB('assets/models/player.glb');
  this.player = new Player(this, new Actor(pg)); this.scene.add(this.player.obj);
  this.people = new People(this, this.world); await this.people.load();
  this.ui.loading(0.9, 'Spilling slop…');
  this.wilds = new Wilds(this, this.world); this.battle = new Battle3D(this);
  this.player.place(this.world.spawn('player'), Math.PI);
  this.ui.loading(1, ''); document.getElementById('loading').style.display = 'none';
  this.renderer.setAnimationLoop(() => this.frame());
  this.diff = localStorage.getItem('sp3d_diff') || 'normal';
  if (TEST) this.testHooks();
  this.menu();
 }
 /* ---------- save ---------- */
 load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
 store() { if (!this.save) return; this.save.pos = { x: +this.player.pos.x.toFixed(2), z: +this.player.pos.z.toFixed(2), yaw: +this.player.yaw.toFixed(2) }; localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); }
 newSave(team, cmdr) { return { v: 1, collection: team.slice(), team: team.slice(), cmdr, cmdrs: START_CMDRS.slice(), beaten: [], badges: 0, bossBeaten: false, diff: this.diff, pos: null, wins: 0, losses: 0, started: Date.now() }; }
 /* ---------- menus ---------- */
 async menu() {
  this.mode = 'menu'; AUD.music(false); document.body.classList.add('inmenu');
  const ex = this.load();
  const r = await this.ui.title(!!ex, this.diff); this.diff = r.diff;
  if (r.act === 'continue' && ex) this.save = ex;
  else { const s = await this.ui.starter(); this.save = this.newSave(s.team, s.cmdr); this.save.pos = null; }
  this.save.diff = this.diff; this.ui.hide();
  if (this.save.pos) this.player.place(new V(this.save.pos.x, this.world.height(this.save.pos.x, this.save.pos.z), this.save.pos.z), this.save.pos.yaw);
  else { this.player.place(this.world.spawn('player'), Math.PI); this.ui.toast('Welcome to Slopville! Rivals guard every corner of the swamp.', 4000); setTimeout(() => this.ui.toast('Walk into wild Pals in the glowing slop grass to brawl & catch them.', 4000), 1500); }
  document.body.classList.remove('inmenu'); this.store(); this.enterWorld();
 }
 enterWorld() {
  this.mode = 'world'; this.player.frozen = false; document.body.classList.remove('inbattle'); document.body.classList.add('inworld');
  this.world.gateOpen(this.save.badges >= 6); this.people.refresh(this.save); this.safeT = 2.5;
  AUD.music(true, 'world');
 }
 /* ---------- main loop ---------- */
 frame() {
  const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime; this.t = t;
  const w = this.world, p = this.player;
  w.update(t);
  if (this.mode === 'world' || this.mode === 'menu') {
   if (this.mode === 'world') p.update(dt, w); p.actor.update(dt);
   this.safeT = Math.max(0, (this.safeT || 0) - dt);
   const can = this.mode === 'world' && this.safeT <= 0 && !TEST_FREEZE.v;
   const near = this.people.update(dt, p, e => this.encounter(e), can);
   this.wilds.update(dt, p, this.save || { collection: [], badges: 0 }, e => this.encounter(e), can);
   if (this.mode === 'world') {
    this.near = near;
    const area = w.areaAt(p.pos.x, p.pos.z); if (area !== this.lastArea) { this.lastArea = area; if (this.save) this.ui.toast(`📍 ${area}`); }
    let prompt = near ? `<b>E</b> / tap — talk to ${near.def.name || near.card.name}` : '';
    if (!prompt && Math.hypot(p.pos.x - w.L.fountain.x, p.pos.z - w.L.fountain.z) < 5.5) prompt = 'The healing fountain bubbles. Your Pals feel fresh!';
    if (near && near.kind === 'boss' && !w._gateOpen) prompt = 'The gate is sealed — earn all 6 rival badges.';
    this.ui.hud(this.save, area, prompt);
    if ((this._mm = (this._mm || 0) + dt) > 0.1) { this._mm = 0; this.ui.minimap(w, p, this.people, this.wilds); }
    if ((this._sv = (this._sv || 0) + dt) > 8) { this._sv = 0; this.store(); }
    if (p.keys.has('KeyE')) { p.keys.delete('KeyE'); this.interact(); }
    if (p.keys.has('Tab')) { p.keys.delete('Tab'); this.openTeam(); }
   }
   const goal = this.mode === 'menu' ? { pos: new V(Math.sin(t * 0.05) * 60, 38, Math.cos(t * 0.05) * 60 + 10), tgt: new V(0, 0, 0) } : p.cameraGoal(w);
   this.camPos.lerp(goal.pos, this.mode === 'menu' ? 1 : Math.min(1, dt * 7)); this.camTgt.lerp(goal.tgt, Math.min(1, dt * 10));
  } else if (this.mode === 'battle') {
   this.battle.update(dt); this.people.update(dt, p, () => {}, false);
   if (!this.swooping) {
    let goal = this.battleCamGoal;
    if (this.camOverride && performance.now() < this.camOverride.until) goal = this.camOverride; else this.camOverride = null;
    if (goal) { const drift = new V(Math.sin(t * 0.3) * 0.6, Math.sin(t * 0.45) * 0.2, 0); this.camPos.lerp(goal.pos.clone().add(drift), Math.min(1, dt * 3.5)); this.camTgt.lerp(goal.tgt, Math.min(1, dt * 4)); }
   }
  }
  this.camera.position.copy(this.camPos);
  if (this.shake > 0) { this.camera.position.add(new V((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake)); this.shake = Math.max(0, this.shake - dt * 1.5); }
  this.camera.lookAt(this.camTgt);
  const fp = this.mode === 'battle' && this.battle.center ? this.battle.center : p.pos;
  this.sun.position.set(fp.x + 30, fp.y + 60, fp.z + 22); this.sun.target.position.copy(fp);
  this.renderer.render(this.scene, this.camera);
 }
 swoop(pos, tgt, dur) {
  return new Promise(res => {
   this.swooping = true; const p0 = this.camPos.clone(), t0 = this.camTgt.clone(); const st = performance.now(); dur *= 1000 * Math.max(0.3, window.__SPEED);
   const mid = p0.clone().lerp(pos, 0.5).add(new V(0, 6, 0));
   const step = () => { const k = Math.min(1, (performance.now() - st) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const a = p0.clone().lerp(mid, e), b = mid.clone().lerp(pos, e); this.camPos.copy(a.lerp(b, e)); this.camTgt.copy(t0.clone().lerp(tgt, e));
    if (k < 1) requestAnimationFrame(step); else { this.swooping = false; res(); } };
   step();
  });
 }
 /* ---------- interactions ---------- */
 async interact() {
  const n = this.near; if (!n || this.mode !== 'world') return;
  this.mode = 'dialog'; this.player.frozen = true;
  if (n.kind === 'npc') {
   const team = await this.ui.dialog({ name: n.def.name, art: n.card.art }, n.def.lines, n.def.team ? '🧪 Manage team' : null);
   if (team) { await new Promise(r => this.ui.team(this.save, () => { this.store(); r(); })); }
  } else if (n.kind === 'rival') {
   await this.ui.dialog({ name: n.card.name, art: n.card.art }, [n.def.lose + ' (Rematches coming soon — go explore!)']);
  } else if (n.kind === 'boss') {
   await this.ui.dialog({ name: n.card.name, art: n.card.art }, this.save.bossBeaten ? [n.def.lose] : ["Hah. Come back when that gate opens, nobody."]);
  }
  this.mode = 'world'; this.player.frozen = false;
 }
 openTeam() { if (this.mode !== 'world') return; this.mode = 'dialog'; this.player.frozen = true; this.ui.team(this.save, () => { this.store(); this.mode = 'world'; this.player.frozen = false; }); }
 /* ---------- encounters ---------- */
 async encounter(e) {
  if (this.mode !== 'world') return;
  this.mode = 'battle'; this.player.frozen = true; this.player.actor.play('idle'); document.body.classList.add('inbattle'); document.body.classList.remove('inworld');
  AUD.sfx('encounter');
  const s = this.save, me = this.player;
  const team = s.team.map(card), cmdr = card(s.cmdr);
  let opts, oppActor = null, title, center, dir, person = null, wildActor = null;
  if (e.kind === 'wild') {
   wildActor = e.actor; const lead = wildActor.card; const pool = AREAS[e.area].pool.map(card).filter(c => c !== lead && !team.includes(c) && s.badges >= ({ 'Common': 0, 'Rare': 0, 'Epic': 2, 'Uber Rare': 4, 'Celestial': 5 })[c.rarity]);
   const extra = s.badges >= 4 ? 2 : s.badges >= 2 ? 1 : 0; const oppTeam = [lead, ...pool.sort(() => Math.random() - 0.5).slice(0, extra)];
   const lvl = s.badges < 2 ? 'easy' : s.badges < 5 ? 'normal' : 'hard';
   opts = { oppTeam, oppCmdr: null, level: LEVEL_SHIFT[s.diff][lvl], wild: true, oppName: 'the wild' };
   title = `A wild ${lead.name} appears!`; center = me.pos.clone().lerp(wildActor.obj.position, 0.5); dir = wildActor.obj.position.clone().sub(me.pos);
   wildActor.dispose();
  } else {
   person = e.person; const d = person.def; oppActor = person.actor;
   await this.ui.dialog({ name: person.card.name, art: person.card.art }, [d.hi]);
   const oppTeam = d.team.map(card);
   opts = { oppTeam, oppCmdr: person.card, level: LEVEL_SHIFT[s.diff][d.level], oppName: `${person.card.name}'s` };
   title = e.kind === 'boss' ? `☠ FINAL BOSS: ${person.card.name}!` : `Rival ${d.n}: ${person.card.name} wants to brawl!`;
   center = me.pos.clone().lerp(oppActor.obj.position, 0.5); dir = oppActor.obj.position.clone().sub(me.pos);
  }
  if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
  // find a battle spot clear of trees/houses: nudge the centre out of colliders
  this.world.collide(center, 6); center.y = this.world.height(center.x, center.z);
  if (AUTOQ) opts.playerAI = true;
  const B = this.battle;
  await B.begin({ team, cmdr, oppTeam: opts.oppTeam, oppCmdr: opts.oppCmdr, wild: !!opts.wild, center, dir, rivalActor: oppActor, playerActor: me.actor, title });
  this.battleCamGoal = B.battleCam();
  Object.assign(ENGINE.HOOKS, B.hooks());
  ENGINE.setSpeed(window.__SPEED);
  const done = new Promise(r => B.done = r);
  document.getElementById('bhud').className = 'on'; document.getElementById('blog').innerHTML = '';
  const p = ENGINE.start(team, cmdr, opts);
  B.spawnUnits(ENGINE.game()); ENGINE.HOOKS.render(ENGINE.game());
  const G = await done; await p;
  await new Promise(r => setTimeout(r, 600 * window.__SPEED));
  await this.finishBattle(G, e, person, opts);
 }
 async finishBattle(G, e, person, opts) {
  const s = this.save, B = this.battle, win = G.winner === 0;
  AUD.sfx(win ? 'victory' : G.fled ? 'swoosh' : 'defeat');
  document.getElementById('bhud').className = '';
  window.__lastResult = { winner: G.winner, turns: G.turns, kind: e.kind, fled: !!G.fled };
  let html;
  if (G.fled) html = `<h2>🏃 Got away safely!</h2>`;
  else if (!win) html = `<h2>💀 SLOPPED.</h2><div class="sub">${G.turns} actions. Your Pals are whisked back to the healing fountain.</div>` + (person ? `<p class="quote">“${person.def.win}”</p>` : '');
  else if (e.kind === 'wild') {
   const c = opts.oppTeam[0]; const isNew = !s.collection.includes(c.id); if (isNew) s.collection.push(c.id);
   if (s.team.length < 3 && isNew) s.team.push(c.id); s.wins++;
   AUD.sfx('catch');
   html = `<h2>${isNew ? '🎉 Caught ' + c.name + '!' : c.name + ' scampers off…'}</h2><div class="reward"><img src="${c.art}"><div><b>${c.name}</b> · ${c.rarity}<br>HP ${c.hp} · ATK ${c.attack} · DEF ${c.defense} · SPD ${c.speed} · NR ${c.nerdRage}<br>⚔ ${c.move.name} (${c.move.damage})<br><i>✦ ${c.secretPower.name}: ${c.secretPower.text}</i></div></div>
    <div class="sub">${isNew ? `Added to your collection (${s.collection.length}/50). Swap it into your team from the Team menu (Tab).` : 'You already have one.'}</div>`;
  } else {
   const d = person.def; s.wins++;
   if (e.kind === 'boss') { s.bossBeaten = true; if (!s.cmdrs.includes(d.card)) s.cmdrs.push(d.card); }
   else if (!s.beaten.includes(d.n)) { s.beaten.push(d.n); s.badges = s.beaten.length; if (!s.cmdrs.includes(d.card)) s.cmdrs.push(d.card); }
   AUD.sfx('badge');
   const choices = d.team.map(card).filter(c => !s.collection.includes(c.id));
   html = `<h2>${e.kind === 'boss' ? '👑 YOU TOPPLED THE YOUNG VILLAIN!' : '★ Badge earned! (' + s.badges + '/6)'}</h2><p class="quote">“${d.lose}”</p><div class="sub">${person.card.name} can now be your Commander.</div>`;
   if (choices.length) {
    await this.ui.result(html, 'Choose a reward Pal');
    const pick = await this.ui.pickOne(`${person.card.name} offers you one of their Pals`, choices, 'Pick one to keep');
    s.collection.push(pick.id); AUD.sfx('catch'); html = `<h2>🎉 ${pick.name} joined you!</h2><div class="reward"><img src="${pick.art}"><div><b>${pick.name}</b> · ${pick.rarity}<br><i>✦ ${pick.secretPower.name}: ${pick.secretPower.text}</i></div></div>`;
   }
   if (s.badges >= 6 && !this.world._gateOpen) html += `<div class="sub big2">🔓 The Villain's gate has opened! Head north to the tower.</div>`;
   if (e.kind === 'boss') html += `<div class="sub big2">You beat Sloppy Pals: Rage Brawl! Keep exploring to catch all 50 Pals.</div>`;
  }
  if (!win && !G.fled) s.losses++;
  this.store();
  await this.ui.result(html);
  // tear down + swoop back
  await B.end();
  if (person) this.people.home(person);
  if (!win && !G.fled) { const f = this.world.L.fountain; this.player.place(new V(f.x + 5, this.world.height(f.x + 5, f.z + 2), f.z + 2), Math.PI); }
  else this.wilds.clearNear(this.player.pos, 6);
  this.player.actor.play('idle');
  const goal = this.player.cameraGoal(this.world); await this.swoop(goal.pos, goal.tgt, 1.0);
  this.battleCamGoal = null; this.camOverride = null;
  this.store(); this.enterWorld();
 }
 /* ---------- test hooks (?test=1) ---------- */
 testHooks() {
  const app = this;
  window.__T = {
   mode: () => app.mode, save: () => app.save, pos: () => app.player.pos.toArray(),
   teleport(x, z, yaw = 0) { app.player.place(new V(x, app.world.height(x, z), z), yaw); app.camPos.copy(app.player.cameraGoal(app.world).pos); },
   spawnOf: k => app.world.L.spawns[k],
   faceTo(x, z) { const p = app.player.pos; const yaw = Math.atan2(x - p.x, z - p.z); app.player.yaw = yaw; app.player.camYaw = yaw + Math.PI; },
   freeze(v) { TEST_FREEZE.v = v; },
   speed(v) { window.__SPEED = v; ENGINE.setSpeed(v); },
   rage(side = 0) { const G = ENGINE.game(); if (G) G.sides[side].team.forEach(u => u.rage = 100); },
   battle: () => ENGINE.game(),
   clickResult() { const b = document.querySelector('#modal [data-x], #modal [data-n], #modal .pick'); if (b) { b.click(); return true; } return false; },
   wildsNear: () => app.wilds.slots.filter(s => s.actor).map(s => ({ name: s.actor.card.name, p: s.actor.obj.position.toArray() })),
   camLook(px, py, pz, tx, ty, tz) { app.camPos.set(px, py, pz); app.camTgt.set(tx, ty, tz); app._camLock = true; },
  };
 }
}
const TEST_FREEZE = { v: false };
const app = new App();
app.boot().catch(e => { console.error(e); window.__errors.push(String(e.stack || e)); document.getElementById('loadmsg').textContent = 'Error: ' + e.message; });
document.getElementById('bTeam').onclick = () => app.openTeam();
document.getElementById('bTalk').onclick = () => app.interact();
document.getElementById('bHelp').onclick = () => { if (app.mode !== 'world') return; app.mode = 'dialog'; app.ui.howTo().then(() => { app.ui.hide(); app.mode = 'world'; }); };
document.getElementById('bLog').onclick = () => document.getElementById('blog').classList.toggle('open');
function audioBar() { const el = document.getElementById('audioBar'); el.innerHTML = `<button title="Sound" id="aM">${AUD.st.mute ? '🔇' : '🔊'}</button><button title="Music" id="aU" style="${AUD.st.musicOn ? '' : 'opacity:.45'}">🎵</button><input type="range" min="0" max="1" step="0.05" value="${AUD.st.vol}" aria-label="Volume">`;
 el.querySelector('#aM').onclick = () => { AUD.toggleMute(); audioBar(); }; el.querySelector('#aU').onclick = () => { AUD.toggleMusic(); audioBar(); }; el.querySelector('input').oninput = e => AUD.setVol(+e.target.value); }
audioBar();
