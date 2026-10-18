/* HTML overlays: title, starter draft, team menu, dialogs, toasts, battle results, minimap. */
import { card, START_CMDRS, RIVALS } from './data.js';
const $ = id => document.getElementById(id);
const CRE = () => window.CARDS.filter(c => c.type === 'Creature');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cardTile = (c, extra = '') => `<div class="pick" data-id="${c.id}"><img src="${c.art}" loading="lazy"><b>${c.name}</b><small>${c.rarity}</small>${extra}</div>`;
const statLine = c => `<div class="st">HP${c.hp} ATK${c.attack} DEF${c.defense} SPD${c.speed} NR${c.nerdRage}</div><i>${c.secretPower.name}</i>`;

export class UI {
 constructor(app) { this.app = app; this.modal = $('modal'); }
 show(html, cls = '') { this.modal.className = 'modal ' + cls; this.modal.innerHTML = `<div class="box">${html}</div>`; return this.modal; }
 hide() { this.modal.className = 'modal hidden'; this.modal.innerHTML = ''; }
 toast(t, ms = 2200) { const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = t; $('toasts').appendChild(d); setTimeout(() => d.remove(), ms); }
 flash(title) { const f = $('flash'); f.innerHTML = `<span>${title}</span>`; f.className = 'go'; setTimeout(() => f.className = '', 1500); }
 callout(t, col) { const d = document.createElement('div'); d.className = 'callout'; d.style.color = col; d.textContent = t; $('fxLayer').appendChild(d); setTimeout(() => d.remove(), 900); }
 tint(col) { const t = $('tint'); t.style.background = `radial-gradient(circle, transparent 30%, ${col}66 100%)`; t.className = 'on'; setTimeout(() => t.className = '', 1300); }
 loading(p, msg) { $('loadbar').style.width = (p * 100).toFixed(0) + '%'; if (msg) $('loadmsg').textContent = msg; }

 title(hasSave, diff) {
  const f = shuffle(CRE()).slice(0, 3);
  return new Promise(res => {
   const m = this.show(`<h1>SLOPPY PALS</h1><div class="sub2">RAGE BRAWL · <b>OPEN WORLD</b></div>
   <div class="fan">${f.map((c, i) => `<img src="${c.art}" style="transform:translateX(${(i - 1) * 90}px) rotate(${(i - 1) * 10}deg) translateY(${Math.abs(i - 1) * 14}px);z-index:${i === 1 ? 2 : 1}">`).join('')}</div>
   ${hasSave ? '<button class="big rage" data-r="continue">▶ Continue</button>' : ''}<button class="big ${hasSave ? '' : 'rage'}" data-r="new">🌱 New Adventure</button>
   <button class="big slop" data-r="how">📜 How to Play</button>
   <div class="sub">Rival difficulty: ${['easy', 'normal', 'hard'].map(d => `<button class="sm ${diff === d ? 'rage' : ''}" data-d="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div>
   <div class="sub" style="font-size:12px">Explore the swamp · beat 6 rivals · catch all 50 Pals · topple the Young Villain</div>`, 'title');
   m.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { AUD.sfx('click'); if (b.dataset.r === 'how') this.howTo().then(() => this.title(hasSave, diff).then(res)); else res({ act: b.dataset.r, diff }); });
   m.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { AUD.sfx('click'); diff = b.dataset.d; localStorage.setItem('sp3d_diff', diff); m.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('rage', x.dataset.d === diff)); });
  });
 }
 howTo() {
  return new Promise(res => {
   const m = this.show(`<h2>How to Play</h2><div class="howto">
   <p><b>Explore:</b> WASD / arrows to move, <b>Shift</b> to run, drag the mouse to turn the camera, wheel to zoom. On phones: left thumb joystick, drag the right side to look. <b>E</b> talks, <b>Tab</b> opens your team.</p>
   <p><b>Encounters:</b> Walk into a wild Pal in the tall slop grass, or get spotted by a rival trainer. The brawl kicks off right there in the swamp.</p>
   <p><b>Brawls</b> use the Rage Brawl rules: 3 Pals + 1 Human <b>Commander</b>. The <b>speed timeline</b> decides who moves next. Getting hit fills <b>Nerd Rage</b> — at 100% fire your <b>Secret Power</b> (then still act) or an <b>OVERCHARGE</b>. Big hits splat <b>slop puddles</b> that slow you down. Enemy Secret Powers stay hidden until used.</p>
   <p><b>Progress:</b> Beat a wild Pal to catch it. Beat a rival to earn a badge, one of their Pals and their Commander. Six badges open the Villain's gate.</p></div>
   <button class="big" data-x>Back</button>`);
   m.querySelector('[data-x]').onclick = () => { AUD.sfx('click'); res(); };
  });
 }
 /* starter: draft 3 Pals (Commons/Rares) or random, then a Commander */
 starter() {
  return new Promise(res => {
   const m = this.show(`<h2>Choose your starter team</h2><div class="sub">Professor (Scorch's Father): "Every trainer starts with three Pals and a Commander."</div>
    <button class="big rage" data-s="draft">🃏 Draft my Pals</button><button class="big" data-s="random">🎲 Random team</button>`);
   m.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
    AUD.sfx('click'); const pool = CRE().filter(c => c.rarity === 'Common' || c.rarity === 'Rare'); let team = [];
    if (b.dataset.s === 'random') team = shuffle(CRE().filter(c => c.rarity === 'Common')).slice(0, 3);
    else { const used = new Set(); for (let r = 0; r < 3; r++) { const opts = shuffle(pool.filter(c => !used.has(c.id))).slice(0, 3); const c = await this.pickOne(`Pick Pal ${r + 1}/3`, opts, team.map(x => x.name).join(' · ')); used.add(c.id); team.push(c); } }
    const cm = await this.pickOne('Pick your Commander', START_CMDRS.map(card), team.map(x => x.name).join(' · '));
    res({ team: team.map(c => c.id), cmdr: cm.id });
   });
  });
 }
 pickOne(title, cards, sub = '') {
  return new Promise(res => {
   const m = this.show(`<h2>${title}</h2><div class="sub">${sub || 'Tap a card'}</div><div class="grid">${cards.map(c => cardTile(c, statLine(c))).join('')}</div>`);
   m.querySelectorAll('.pick').forEach(p => p.onclick = () => { AUD.sfx('click'); res(card(+p.dataset.id)); });
  });
 }
 /* engine 'who jumps in?' */
 choosePal(title, units) {
  return new Promise(res => {
   const m = this.show(`<h2>${title}</h2><div class="grid">${units.map((u, i) => `<div class="pick" data-i="${i}"><img src="${u.card.art}"><b>${u.card.name}</b><small>${u.hp}/${u.max} HP</small></div>`).join('')}</div>`, 'battle');
   m.querySelectorAll('.pick').forEach(p => p.onclick = () => { this.hide(); res(units[+p.dataset.i]); });
  });
 }
 /* team management */
 team(save, onSave) {
  const render = () => {
   const col = save.collection.slice().sort((a, b) => a - b).map(card);
   const m = this.show(`<h2>Your Pals <small>(${save.collection.length}/50 caught · ${save.badges}/6 badges)</small></h2>
    <div class="sub">Tap Pals to set your brawl team (3). Current: <b>${save.team.map(id => card(id).name).join(' · ')}</b></div>
    <div class="grid g4">${col.map(c => cardTile(c, save.team.includes(c.id) ? '<em class="in">IN TEAM</em>' : '')).join('')}</div>
    <h3>Commander</h3><div class="grid g5 cm">${save.cmdrs.map(card).map(c => cardTile(c, save.cmdr === c.id ? '<em class="in">CMDR</em>' : '')).join('')}</div>
    <button class="big" data-x>Done</button>`, 'team');
   m.querySelectorAll('.grid:not(.cm) .pick').forEach(p => p.onclick = () => {
    const id = +p.dataset.id; AUD.sfx('click');
    if (save.team.includes(id)) { if (save.team.length > 1) save.team = save.team.filter(x => x !== id); }
    else { save.team.push(id); if (save.team.length > 3) save.team.shift(); }
    render();
   });
   m.querySelectorAll('.cm .pick').forEach(p => p.onclick = () => { save.cmdr = +p.dataset.id; AUD.sfx('click'); render(); });
   m.querySelector('[data-x]').onclick = () => { if (save.team.length < 3) { this.toast('Pick 3 Pals for your team!'); return; } AUD.sfx('click'); this.hide(); onSave(); };
  };
  render();
 }
 dialog(who, lines, extraBtn) {
  return new Promise(res => {
   let i = 0;
   const step = () => {
    AUD.sfx('talk');
    const m = this.show(`<div class="dlg"><img src="${who.art}"><div><b>${who.name}</b><p>${lines[i]}</p></div></div>
     <button class="big" data-n>${i < lines.length - 1 ? 'Next ▶' : 'OK'}</button>${extraBtn && i === lines.length - 1 ? `<button class="big rage" data-e>${extraBtn}</button>` : ''}`, 'dialog');
    m.querySelector('[data-n]').onclick = () => { if (++i < lines.length) step(); else { this.hide(); res(false); } };
    const e = m.querySelector('[data-e]'); if (e) e.onclick = () => { this.hide(); res(true); };
   };
   step();
  });
 }
 result(html, btn = 'Continue') {
  return new Promise(res => { const m = this.show(html + `<button class="big rage" data-x>${btn}</button>`, 'result'); m.querySelector('[data-x]').onclick = () => { AUD.sfx('click'); this.hide(); res(); }; });
 }
 /* world HUD */
 hud(save, area, prompt) {
  $('badges').innerHTML = RIVALS.map(r => `<span class="badge ${save.beaten.includes(r.n) ? 'on' : ''}" title="${r.area}">${save.beaten.includes(r.n) ? '★' : '☆'}</span>`).join('') + `<span class="caught">🐸 ${save.collection.length}/50</span>`;
  $('area').textContent = area;
  const pr = $('prompt'); if (prompt) { pr.style.display = 'block'; pr.innerHTML = prompt; } else pr.style.display = 'none';
 }
 minimap(world, player, people, wilds) {
  const c = $('minimap'), g = c.getContext('2d'), W = c.width, S = world.L.size, k = W / S;
  const P = (x, z) => [(x + S / 2) * k, (z + S / 2) * k];
  if (!this._mmBg) {
   const b = document.createElement('canvas'); b.width = b.height = W; const h = b.getContext('2d'); const L = world.L;
   h.fillStyle = '#4c6e2c'; h.fillRect(0, 0, W, W);
   const blob = (k2, col, r) => { const [x, y] = P(L.areas[k2][0], L.areas[k2][1]); h.fillStyle = col; h.beginPath(); h.arc(x, y, r * k, 0, 7); h.fill(); };
   blob('bog', '#3a6a62', 27); blob('muck', '#6a4a2a', 22); blob('grove', '#6a4a8a', 22); blob('trash', '#7a7466', 20); blob('town', '#b8b08a', 26); blob('boss', '#3a2a44', 22);
   h.strokeStyle = '#d8b878'; h.lineWidth = 2; const cr = P(L.areas.cross[0], L.areas.cross[1]);
   for (const a of ['bog', 'muck', 'grove', 'trash', 'boss', 'town']) { const [x, y] = P(L.areas[a][0], L.areas[a][1]); h.beginPath(); h.moveTo(cr[0], cr[1]); h.lineTo(x, y); h.stroke(); }
   for (const p of L.patches) { const [x, y] = P(p.x, p.z); h.fillStyle = '#9be03a'; h.globalAlpha = 0.6; h.beginPath(); h.arc(x, y, p.r * k, 0, 7); h.fill(); h.globalAlpha = 1; }
   this._mmBg = b;
  }
  g.drawImage(this._mmBg, 0, 0);
  for (const p of people.list) { const [x, y] = P(p.actor.obj.position.x, p.actor.obj.position.z); g.fillStyle = p.kind === 'npc' ? '#c6e14b' : p.beaten ? '#888' : p.kind === 'boss' ? '#ff4fc8' : '#ff5a4a'; g.beginPath(); g.arc(x, y, p.kind === 'boss' ? 4 : 3, 0, 7); g.fill(); }
  for (const s of wilds.slots) if (s.actor) { const [x, y] = P(s.actor.obj.position.x, s.actor.obj.position.z); g.fillStyle = '#fff'; g.fillRect(x - 1, y - 1, 2, 2); }
  const [x, y] = P(player.pos.x, player.pos.z); g.save(); g.translate(x, y); g.rotate(-player.yaw + Math.PI); g.fillStyle = '#4ab0ff'; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
 }
}
