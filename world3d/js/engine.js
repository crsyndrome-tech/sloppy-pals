'use strict';
/* Sloppy Pals: Rage Brawl — all game logic. No build step. */
/* Shared copy of the Rage Brawl battle engine for the 3D world build.
   Rules, numbers, Secret Powers, CARD_TUNE and the Easy/Normal/Hard AI are unchanged from ../game/game.js;
   only the DOM rendering was swapped for HOOKS that the 3D layer (main.js) implements. */
let AUTO = false;   // AI plays the player's side too (demo / headless tests)
let SPEED = 1;      // animation-wait multiplier
const CREATURES = CARDS.filter(c => c.type === 'Creature');
const HUMANS = CARDS.filter(c => c.type === 'Human');
let SIM = false; // headless batch mode: no DOM, no waits
const sleep = ms => SIM ? Promise.resolve() : new Promise(r => setTimeout(r, ms * SPEED));
/* Tunable balance constants (printed card stats are never changed) */
const TUNE = { atkMult: 0.42, defPad: 50, overMult: 1.6, rageHit: 1.2, rageAct: 10, rageBase: 0.3, splatChance: 0.18, slopSpd: 0.1, slipChance: 0.07, cmdrDelay: 1.7, cmdrSplash: 0.15, heckle: 0.15, rally: 25, spdPad: 40 };
const CARD_TUNE = {"Adventure Trainer": {"dmg": 0.676}, "Bickerbeak": {"dmg": 1.223, "taken": 0.804}, "Blinkroot": {"dmg": 1.415, "taken": 0.682}, "Bloatnote": {"dmg": 1.435, "taken": 0.668}, "Bogslugger": {"dmg": 0.903, "taken": 1.087}, "Chugbug": {"dmg": 0.965, "taken": 1.025}, "Cinderrunt": {"dmg": 0.661, "taken": 1.428}, "Cousin Dan": {"dmg": 1.356}, "Cringill": {"dmg": 1.634, "taken": 0.579}, "Crumbust": {"dmg": 1.298, "taken": 0.755}, "Dreadonk": {"dmg": 0.794, "taken": 1.226}, "Field Scientist": {"dmg": 1.602}, "Flinchwick": {"dmg": 2.164, "taken": 0.455}, "Fumblefin": {"dmg": 1.706, "taken": 0.548}, "Fuzzjury": {"dmg": 1.308, "taken": 0.749}, "Glassmoth": {"dmg": 1.114, "taken": 0.883}, "Glitchick": {"dmg": 1.785, "taken": 0.513}, "Gloomaw": {"dmg": 0.634, "taken": 1.465}, "Gossipod": {"dmg": 1.55, "taken": 0.618}, "Grinwick": {"dmg": 0.919, "taken": 1.072}, "Grubbo": {"dmg": 1.535, "taken": 0.622}, "Hissler": {"dmg": 1.546, "taken": 0.618}, "Honkrot": {"dmg": 1.148, "taken": 0.867}, "Kettleback": {"dmg": 0.788, "taken": 1.245}, "Knockrot": {"dmg": 0.673, "taken": 1.419}, "Latchling": {"dmg": 1.216, "taken": 0.813}, "Meltdown 1": {"dmg": 1.661, "taken": 0.565}, "Meltdown 2": {"dmg": 1.351, "taken": 0.718}, "Milo Vault": {"dmg": 1.001}, "Moodusa": {"dmg": 0.554, "taken": 1.661}, "Muckmiser": {"dmg": 1.508, "taken": 0.641}, "Panicone": {"dmg": 0.907, "taken": 1.091}, "Ploumer": {"dmg": 0.909, "taken": 1.084}, "Prismhart": {"dmg": 0.412, "taken": 2.385}, "Puddlebrow": {"dmg": 1.345, "taken": 0.721}, "Rotcap Rex": {"dmg": 0.522, "taken": 1.803}, "Rummuzzle": {"dmg": 1.163, "taken": 0.849}, "Saint Bloom": {"dmg": 0.557, "taken": 1.612}, "Scorch": {"dmg": 0.756}, "Scorch's Father": {"dmg": 0.439}, "Scorch's Mother": {"dmg": 2.544}, "Slopgator": {"dmg": 0.662, "taken": 1.403}, "Snorequake": {"dmg": 0.868, "taken": 1.126}, "Snottopus": {"dmg": 1.382, "taken": 0.706}, "Spindlegrump": {"dmg": 0.911, "taken": 1.089}, "Spitebulb": {"dmg": 1.287, "taken": 0.764}, "Sulkloom": {"dmg": 1.383, "taken": 0.702}, "Tattletide": {"dmg": 1.673, "taken": 0.563}, "Thunderrunt": {"dmg": 1.153, "taken": 0.858}, "Tiderunt": {"dmg": 0.747, "taken": 1.279}, "Trashoot": {"dmg": 0.992, "taken": 0.998}, "Undermaw": {"dmg": 0.554, "taken": 1.608}, "Velcrab": {"dmg": 1.235, "taken": 0.797}, "Venomrunt": {"dmg": 0.857, "taken": 1.145}, "Vera Vault": {"dmg": 0.662}, "Voltrunt": {"dmg": 0.937, "taken": 1.053}, "Wheezerang": {"dmg": 0.84, "taken": 1.173}, "Winter Hunter": {"dmg": 0.389}, "Wobbloaf": {"dmg": 1.078, "taken": 0.918}, "Young Villain": {"dmg": 0.819}}; // per-card game-logic multipliers: {name:{dmg:x, rage:x}}
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
window.__errors = [];

/* ---------------- SECRET POWERS ----------------
 kind 'active': fires when the owner spends a full Nerd Rage meter.
 kind 'passive': always on (triggers on its condition) — owner's full rage is used for Overcharge instead.
 once: usable once per battle (as printed). ctx: {u, me, foe, tgt}  */
const SP = {
 'Static Reversal': { kind: 'passive', once: true },
 'Mire Memory': { kind: 'passive' },
 'Swamp Lock': { kind: 'active', hostile: true, use: c => { c.tgt.s.noRetreat = 1; return `${c.tgt.card.name} is stuck in the swamp — can't retreat next turn.`; } },
 'Veilshift': { kind: 'active', once: true, use: c => { c.u.s.dodge = 'veil'; return `${c.u.card.name} will dodge the next attack.`; } },
 'Prismsight': { kind: 'active', use: c => { c.foe.revealed = 99; c.me.spBlock++; return `Enemy secret powers revealed! The next one will be cancelled.`; } },
 'Lifebloom': { kind: 'active', once: true, useful: c => hurtAlly(c.me, 50), use: c => heal(lowestAlly(c.me), 50) },
 'Sweet-Face Scam': { kind: 'active', hostile: true, use: c => { c.tgt.s.weakNext = (c.tgt.s.weakNext || 0) + 15; return `${c.tgt.card.name}'s next attack deals 15 less.`; } },
 'Cold Shoulder': { kind: 'active', hostile: true, use: c => { c.tgt.s.weakNext = (c.tgt.s.weakNext || 0) + 20; return `${c.tgt.card.name}'s next attack deals 20 less.`; } },
 'Twin Freeze': { kind: 'active', useful: c => c.me.team.some(x => x.card.name === 'Meltdown 1' && !x.ko), use: c => { const m1 = c.me.team.find(x => x.card.name === 'Meltdown 1' && !x.ko); if (!m1) return `...but Meltdown 1 isn't here. Nothing happens.`; [c.u, m1].forEach(x => x.s.defMods.push({ v: 15, t: 1 })); return `Meltdown 1 & 2 gain +15 Defense!`; } },
 'Volume Violation': { kind: 'active', hostile: true, use: c => { c.tgt.s.silenced = Math.max(c.tgt.s.silenced || 0, 1); return `${c.tgt.card.name}'s secret power is disabled for a turn.`; } },
 'Scrap Insurance': { kind: 'active', use: c => { c.u.s.reduceNext = 20; return `${c.u.card.name} will take 20 less from the next hit.`; } },
 'Unanimous Disaster': { kind: 'active', once: true, hostile: true, use: c => { aoe(c, 20); return `Everybody argues! 20 damage to each enemy.`; } },
 'Panic Exit': { kind: 'active', use: c => { c.u.s.dodge = 'panic'; return `${c.u.card.name} is ready to bolt from the next hit.`; } },
 'Emergency Crumbs': { kind: 'passive', once: true },
 'Sticky Situation': { kind: 'active', hostile: true, use: c => { c.tgt.s.spdMods.push({ v: -25, t: 2 }); return `${c.tgt.card.name} is snotted up: -25 Speed for two turns.`; } },
 'Rise Again': { kind: 'passive', once: true },
 'Onion Grudge': { kind: 'passive' },
 'Pressure Valve': { kind: 'active', once: true, use: c => { c.me.spBlock++; return `Pressure valve set — the next enemy secret power will be blocked.`; } },
 'Frame Skip': { kind: 'active', once: true, hostile: true, attack: true, use: async c => { await attack(c.u, c.me, c.foe, { mult: 0.5, label: 'Frame Skip' }); return null; } },
 'Sourdough Squeeze': { kind: 'active', hostile: true, use: c => { c.tgt.s.noRetreat = 1; return `${c.tgt.card.name} is squeezed — can't retreat next turn.`; } },
 'Unclogged Fury': { kind: 'active', use: c => { c.u.s.pierce = true; return `${c.u.card.name}'s next attack ignores defensive secret powers.`; } },
 'Fungal Rebirth': { kind: 'passive', once: true },
 'Blackout Hide': { kind: 'active', use: c => { c.u.s.reduceTurn = { v: 25, t: 1 }; return `${c.u.card.name} hides in the dark: -25 incoming damage for a turn.`; } },
 'Burrow Ambush': { kind: 'active', use: c => { c.u.s.pierce = true; return `${c.u.card.name} burrows — next attack bypasses defensive secret powers.`; } },
 'Wrong Door': { kind: 'active', once: true, useful: c => c.foe.team.filter(x => !x.ko).length > 1, use: c => { c.u.s.redirect = true; return `The next hit on ${c.u.card.name} goes to the wrong door...`; } },
 'False Welcome': { kind: 'active', hostile: true, useful: c => bench(c.foe).length > 0, use: c => { const b = bench(c.foe).sort((a, b) => a.hp - b.hp)[0]; if (!b) return 'No one to lure.'; setActive(c.foe, b); return `${b.card.name} is lured into the fight!`; } },
 'Rare Agreement': { kind: 'active', once: true, use: c => { c.u.s.bonus += 25; return `Both mouths agree: next attack +25!`; } },
 'Decoy Deposit': { kind: 'active', use: c => { c.u.s.decoy = 30; return `An amber double will soak the next 30 damage.`; } },
 'Sleep Fault': { kind: 'active', once: true, hostile: true, use: c => { aoe(c, 15); return `The ground cracks: 15 damage to each enemy.`; } },
 'Panic Flare': { kind: 'active', use: c => { c.me.spBlock++; return `A flare is lit — it will cancel one enemy secret power.`; } },
 'Receipts': { kind: 'active', once: true, useful: c => !!copyable(c.tgt), use: async c => copyPower(c, c.tgt.card.secretPower.name) },
 'Compliment Trap': { kind: 'active', hostile: true, use: c => { c.tgt.s.weakNext = (c.tgt.s.weakNext || 0) + 20; return `${c.tgt.card.name} is flattered: next attack -20.`; } },
 'Footstep Bank': { kind: 'active', useful: c => c.u.lastHit > 10, use: c => { const b = Math.round(c.u.lastHit / 2); c.u.s.bonus += b; return `Banked ${b} bonus damage for the next attack.`; } },
 'Boiling Point': { kind: 'passive', once: true },
 'Secondhand Shame': { kind: 'active', hostile: true, use: c => { c.foe.team.forEach(x => x.s.spdMods.push({ v: -20, t: 1 })); return `So cringe. All enemies -20 Speed for a turn.`; } },
 'Silent Treatment': { kind: 'active', hostile: true, use: c => { c.tgt.s.silenced = Math.max(c.tgt.s.silenced || 0, 2); return `${c.tgt.card.name} gets the silent treatment — secret power disabled for two turns.`; } },
 'Accidental Swap': { kind: 'active', hostile: true, useful: c => bench(c.foe).length > 0, use: c => { const b = rnd(bench(c.foe)); if (!b) return 'Nobody to swap.'; setActive(c.foe, b); return `Oops! ${b.card.name} got swapped in.`; } },
 'Road Rage': { kind: 'passive' },
 'Hold That Note': { kind: 'active', hostile: true, use: c => { c.tgt.s.cantAttack = 1; return `${c.tgt.card.name} can't attack on its next turn.`; } },
 'Safety Lock': { kind: 'active', hostile: true, use: c => { c.foe.noSwap = 1; return `Enemy team can't swap next turn.`; } },
 'Objection': { kind: 'active', once: true, use: c => { c.me.objection = true; return `OBJECTION! The next enemy attack will be thrown out.`; } },
 'Now You Don\'t': { kind: 'active', useful: c => bench(c.me).length > 0, use: c => { c.u.s.dodge = 'blink'; return `${c.u.card.name} will blink away from the next hit.`; } },
 'Wrong Item Right Time': { kind: 'active', once: true, useful: c => hurtAlly(c.me, 25), use: c => heal(rnd(c.me.team.filter(x => !x.ko)), 25) },
 'Last Word': { kind: 'passive' },
 'Public Record': { kind: 'active', use: c => { c.foe.revealed = Math.max(c.foe.revealed, 2); return `All enemy secret powers are public record for two turns.`; } },
 'Heavy Forecast': { kind: 'active', hostile: true, use: c => { c.foe.team.forEach(x => x.s.spdMods.push({ mult: 0.5, t: 2 })); return `Heavy forecast: enemy Speed halved for two turns.`; } },
 'Flashfire': { kind: 'passive' },
 'Overclock': { kind: 'active', once: true, hostile: true, attack: true, use: async c => { await attack(c.u, c.me, c.foe, { mult: 0.5, label: 'Overclock 1' }); if (!c.u.ko && active(c.foe)) await attack(c.u, c.me, c.foe, { mult: 0.5, label: 'Overclock 2' }); return null; } },
 'Toxic Aftertaste': { kind: 'active', hostile: true, use: c => { c.tgt.s.toxic = 3; return `${c.tgt.card.name} tastes something awful — loses 10 HP after each of its next three turns.`; } },
 'Undertow': { kind: 'active', hostile: true, use: c => { const h = heal(c.u, 20); const b = rnd(bench(c.foe)); if (b) { setActive(c.foe, b); return h + ` ${b.card.name} is dragged in by the undertow!`; } return h; } },
 // Humans (Commanders)
 'Accidental Genius': { kind: 'active', use: c => { const a = active(c.me); a.s.bonus += 25; return `${a.card.name} gets a genius idea: +25 damage next attack.`; } },
 'Lasting Hope': { kind: 'active', once: true, useful: c => hurtAlly(c.me, 30), use: c => heal(lowestAlly(c.me), 30) },
 'Old-School Read': { kind: 'active', use: c => { c.me.spBlock++; return `Dad saw it coming — the next enemy secret power is blocked.`; } },
 'Wrong Place Right Time': { kind: 'active', once: true, use: c => { c.me.decoy = true; return `Cousin Dan stumbles in — the next hit lands on a decoy.`; } },
 'Rigged Outcome': { kind: 'active', once: true, hostile: true, use: c => { c.tgt.s.cantAttack = 1; return `Rigged! ${c.tgt.card.name} can't attack next turn.`; } },
 'Collector\'s Clause': { kind: 'active', once: true, useful: c => c.me.graveyard.some(n => SP[n] && SP[n].kind === 'active' && SP[n].use), use: async c => { const n = c.me.graveyard.filter(n => SP[n] && SP[n].kind === 'active').pop(); return copyPower({ ...c, u: active(c.me) }, n); } },
 'Quick Thinking': { kind: 'active', useful: c => bench(c.me).length > 0, use: c => { c.me.freeRetreat = 1; return `Quick thinking — your next retreat won't cost a turn.`; } },
 'Cold Ambush': { kind: 'passive' },
 'Field Calibration': { kind: 'active', use: c => { const a = active(c.me); a.s.defMods.push({ v: 20, t: 2 }); return `${a.card.name} gains +20 Defense for two turns.`; } },
 'Perfect Alibi': { kind: 'active', use: c => { c.me.spBlock++; return `Perfect alibi — the next enemy secret power slides right off.`; } },
};

/* ---------------- STATE ---------------- */
let G = null; // battle state
function mkUnit(card, sideIdx, isCmdr) {
 return { card, side: sideIdx, cmdr: !!isCmdr, hp: card.hp, max: card.hp, rage: 0, ct: 0, ko: false, used: false, lastHit: 0, copied: null,
  s: { spdMods: [], defMods: [], bonus: 0 }, flags: {} };
}
function mkSide(i, cards, cmdr, name) {
 return { i, name, team: cards.map(c => mkUnit(c, i)), act: 0, cmdr: cmdr ? mkUnit(cmdr, i, true) : null, slop: 0, spBlock: 0, noSwap: 0,
  objection: false, decoy: false, freeRetreat: 0, revealed: 0, graveyard: [], firstAttack: true, ai: true };
}
const active = side => side.team[side.act] && !side.team[side.act].ko ? side.team[side.act] : null;
const bench = side => side.team.filter((x, i) => i !== side.act && !x.ko);
const other = side => G.sides[1 - side.i];
const sideOf = u => G.sides[u.side];
const hurtAlly = (side, n) => side.team.some(x => !x.ko && x.max - x.hp >= n * 0.6);
const lowestAlly = side => side.team.filter(x => !x.ko).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
const spName = u => u.card.secretPower.name;
const hasPassive = (u, n) => !u.ko && !(u.s.silenced > 0) && (spName(u) === n || u.copied === n);
const copyable = u => u && SP[spName(u)] && SP[spName(u)].kind === 'active' && spName(u) !== 'Receipts' ? spName(u) : null;
function effSpd(u) {
 let v = u.card.speed; let m = 1;
 u.s.spdMods.forEach(x => { if (x.v) v += x.v; if (x.mult) m *= x.mult; });
 if (!u.cmdr) m *= 1 - TUNE.slopSpd * sideOf(u).slop;
 return Math.max(5, v * m);
}
const effDef = u => u.card.defense + u.s.defMods.reduce((a, x) => a + x.v, 0);
const delay = u => (1000 / (effSpd(u) + TUNE.spdPad)) * (u.cmdr ? TUNE.cmdrDelay : 1);
const rageMult = u => (TUNE.rageBase + u.card.nerdRage / 100) * ((CARD_TUNE[u.card.name] || {}).rage || 1);
function addRage(u, n) { if (u.ko) return; const was = u.rage; u.rage = clamp(u.rage + n * rageMult(u), 0, 100); if (!SIM && was < 100 && u.rage >= 100) AUD.sfx('rage'); }

function log(html, cls) { G.log.push({ html, cls }); if (SIM) return; HOOKS.log(html, cls); }

function heal(u, n) { if (!u) return 'No one to heal.'; const h = Math.min(n, u.max - u.hp); u.hp += h; fx(u, '+' + h, 'heal'); return `${u.card.name} heals ${h} HP.`; }
function setActive(side, u) { const idx = side.team.indexOf(u); if (idx < 0 || u.ko) return; const old = active(side); side.act = idx; u.ct = G.time + delay(u) * 0.5; if (old) old.s.noRetreat = 0; if (!SIM) HOOKS.swap(side, u, old); render(); }
function aoe(c, n) { c.foe.team.filter(x => !x.ko).forEach(x => damage(x, n, null, { flat: true })); }
async function copyPower(c, name) { if (!name || !SP[name]) return 'Nothing to copy.'; const d = SP[name]; if (d.kind === 'passive') { c.u.copied = name; return `${c.u.card.name} copies ${name}!`; } log(`<span class="sp">↳ copying <b>${name}</b></span>`); const r = await d.use({ ...c, tgt: active(c.foe) || c.tgt }); return r; }

/* ---------------- DAMAGE PIPELINE ---------------- */
function damage(t, amt, src, o = {}) {
 // raw HP loss + all on-damage triggers. returns dealt
 if (t.ko) return 0;
 amt = Math.max(0, Math.round(amt));
 if (!t.cmdr && hasPassive(t, 'Rise Again') && !t.used && amt >= t.hp && t.hp > 1) { amt = t.hp - 1; t.used = true; log(`<span class="sp">✦ Rise Again! ${t.card.name} hangs on with 1 HP.</span>`); banner(t); }
 t.hp -= amt; t.lastHit = amt; fx(t, amt ? '-' + amt : '0');
 addRage(t, (amt / t.max) * 100 * TUNE.rageHit);
 if (t.hp <= 0) { t.hp = 0; ko(t, src); return amt; }
 const half = t.hp < t.max / 2;
 if (half && hasPassive(t, 'Emergency Crumbs') && !t.used) { t.used = true; log(`<span class="sp">✦ Emergency Crumbs! ${heal(t, 20)}</span>`); }
 if (half && hasPassive(t, 'Fungal Rebirth') && !t.used) { t.used = true; log(`<span class="sp">✦ Fungal Rebirth! ${heal(t, 30)}</span>`); }
 if (half && hasPassive(t, 'Boiling Point') && !t.used) { t.used = true; t.s.bonus += 30; log(`<span class="sp">✦ Boiling Point! ${t.card.name}'s next attack +30.</span>`); }
 if (src && !o.flat && amt > 0) {
  if (hasPassive(t, 'Onion Grudge') && !t.flags.grudge) { t.flags.grudge = true; t.s.bonus += 20; log(`<span class="sp">✦ Onion Grudge: next attack +20.</span>`); }
  if (hasPassive(t, 'Flashfire') && src.card.element_inferred === 'fire') { t.s.bonus += 25; log(`<span class="sp">✦ Flashfire: fire fuels ${t.card.name}! Next attack +25.</span>`); }
  if (hasPassive(t, 'Mire Memory') && src.card.element_inferred === 'water') log(`<span class="sp">✦ Mire Memory: ${heal(t, 25)}</span>`);
 }
 return amt;
}
function ko(t, src) {
 t.ko = true; const side = sideOf(t);
 log(`<span class="ko">💀 ${t.card.name} is knocked out!</span>`, 'ko'); if (!SIM) { AUD.sfx('ko'); HOOKS.ko(t); }
 other(side).graveyard.push(spName(t));
 if (t.cmdr) return;
 if (hasPassive({ ...t, ko: false }, 'Last Word') && src && !src.ko) { log(`<span class="sp">✦ Last Word! ${t.card.name} gets one more jab in.</span>`); damage(src, 25, null, { flat: true }); }
}

async function attack(u, me, foe, o = {}) {
 let tgt = active(foe); if (!tgt) return;
 const mv = u.card.move; const over = !!o.over;
 if (!SIM) HOOKS.lunge(u, o);
 await sleep(200);
 // cancellers
 const pierce = u.s.pierce; if (pierce) u.s.pierce = false;
 if (foe.objection && !pierce) { foe.objection = false; log(`<span class="sp">✦ OBJECTION! ${u.card.name}'s attack is thrown out of court.</span>`); fx(tgt, 'OBJECTION!', 'txt'); return; }
 let base = mv.damage * (o.mult || 1);
 let bonus = u.s.bonus; u.s.bonus = 0; u.flags.grudge = false;
 if (me.firstAttack) { me.firstAttack = false; if (me.cmdr && hasPassive(me.cmdr, 'Cold Ambush')) { bonus += 20; log(`<span class="sp">✦ Cold Ambush: first strike +20!</span>`); } }
 let weak = u.s.weakNext || 0; u.s.weakNext = 0;
 let dmg = (base * TUNE.atkMult * ((CARD_TUNE[u.card.name] || {}).dmg || 1) + bonus) * (u.card.attack + TUNE.defPad) / (effDef(tgt) + TUNE.defPad) * (0.9 + Math.random() * 0.2);
 if (over) dmg *= TUNE.overMult;
 dmg *= (CARD_TUNE[tgt.card.name] || {}).taken || 1;
 dmg -= weak;
 const slipped = !u.cmdr && Math.random() < TUNE.slipChance * me.slop;
 if (slipped) { AUD.sfx('slip'); dmg *= 0.5; log(`<span class="sl">🟢 ${u.card.name} slips in the slop! Half damage.</span>`); }
 // defensive powers (skipped by pierce)
 if (!pierce) {
  if (tgt.s.dodge) { const d = tgt.s.dodge; tgt.s.dodge = null; fx(tgt, 'DODGE!', 'txt');
   log(`<span class="sp">✦ ${tgt.card.name} ${d === 'veil' ? 'veilshifts' : d === 'panic' ? 'panics and bolts' : 'blinks'} out of the way!</span>`);
   if (d === 'panic') tgt.s.spdMods.push({ v: 20, t: 1 });
   if (hasPassive(tgt, 'Road Rage')) { tgt.s.bonus += 20; log(`<span class="sp">✦ Road Rage: next attack +20.</span>`); }
   if (d === 'blink') { const b = rnd(bench(foe)); if (b) { setActive(foe, b); log(`${b.card.name} swaps in.`); } }
   return; }
  if (foe.decoy) { foe.decoy = false; log(`<span class="sp">✦ The hit lands on Cousin Dan's decoy instead!</span>`); fx(tgt, 'DECOY', 'txt'); return; }
  if (tgt.s.redirect) { const others = bench(me).length ? bench(me) : null; tgt.s.redirect = false; if (others) { const r = rnd(others); log(`<span class="sp">✦ Wrong Door! The hit swings into ${r.card.name} instead.</span>`); damage(r, dmg, null); return; } }
  if (hasPassive(tgt, 'Static Reversal') && !tgt.used && u.card.element_inferred === 'electric') { tgt.used = true; log(`<span class="sp">✦ Static Reversal! The shock goes back to ${u.card.name}.</span>`); damage(u, dmg, null); return; }
  if (tgt.s.reduceNext) { dmg -= tgt.s.reduceNext; tgt.s.reduceNext = 0; log(`<span class="sp">✦ Scrap Insurance soaks 20.</span>`); }
  if (tgt.s.reduceTurn) dmg -= tgt.s.reduceTurn.v;
  if (tgt.s.decoy) { const a = Math.min(tgt.s.decoy, dmg); dmg -= a; tgt.s.decoy = 0; log(`<span class="sp">✦ The amber double absorbs ${Math.round(a)}.</span>`); }
 }
 if (tgt.s.guard) { dmg *= 0.5; tgt.s.guard = false; }
 dmg = Math.max(over ? 10 : 5, dmg);
 const dealt = damage(tgt, dmg, u);
 log(`${u.card.name} uses <b>${o.label || mv.name}</b>${over ? ' <b style="color:#ff4fc8">OVERCHARGED</b>' : ''} → ${tgt.card.name} takes <b>${dealt}</b>.`);
 shake(tgt); if (!SIM) AUD.sfx(over ? 'bigHit' : dealt ? 'hit' : 'whiff');
 addRage(u, TUNE.rageAct);
 if (foe.cmdr && !foe.cmdr.ko) { const sp = Math.round(dealt * TUNE.cmdrSplash); if (sp > 0) damage(foe.cmdr, sp, null, { flat: true }); }
 if ((over || Math.random() < TUNE.splatChance) && foe.slop < 3) { foe.slop++; log(`<span class="sl">🟢 SPLAT! Slop puddle on ${foe.name} side (${foe.slop}/3).</span>`); splat(foe); }
 render();
 await sleep(450);
}

/* ---------------- TURN FLOW ---------------- */
function actors() { const a = []; G.sides.forEach(s => { const x = active(s); if (x) a.push(x); if (s.cmdr && !s.cmdr.ko) a.push(s.cmdr); }); return a; }
function nextActor() { return actors().sort((a, b) => a.ct - b.ct)[0]; }
function forecast(n = 8) { const sim = actors().map(u => ({ u, ct: u.ct })); const out = []; for (let i = 0; i < n; i++) { sim.sort((a, b) => a.ct - b.ct); out.push(sim[0].u); sim[0].ct += delay(sim[0].u); } return out; }

async function useSP(u, me, foe) {
 const name = spName(u); const d = SP[name];
 u.rage = 0; if (d.once) u.used = true;
 const tgt = active(foe);
 banner(u); await sleep(1300); hideBanner();
 log(`<span class="sp">✦ ${u.card.name} unleashes <b>${name}</b>!</span>`);
 me.revealedNames = me.revealedNames || new Set(); me.revealedNames.add(u.card.id);
 if (foe.spBlock > 0) { foe.spBlock--; foe.revealedNames = foe.revealedNames || new Set(); log(`<span class="sp">✖ …but it's blocked by the other side!</span>`); render(); return; }
 if (u.s.silenced > 0) { log('…but it is silenced.'); return; }
 const msg = await d.use({ u, me, foe, tgt });
 if (msg) log(`<span class="sp">${msg}</span>`);
 render(); await sleep(350);
}

function canSP(u) { const d = SP[spName(u)]; return u.rage >= 100 && d && d.kind === 'active' && !(d.once && u.used) && !(u.s.silenced > 0); }
function canRetreat(side, u) { return !u.cmdr && bench(side).length > 0 && !(u.s.noRetreat > 0) && !(side.noSwap > 0); }

async function doAction(u, act, arg) {
 const me = sideOf(u), foe = other(me);
 let endsTurn = true;
 if (act === 'sp') { await useSP(u, me, foe); if (!SP[spName(u)].attack && !u.ko && !G.over && (u.cmdr || active(me) === u)) { G.pendingFree = true; render(); return false; } }
 else if (act === 'attack') await attack(u, me, foe);
 else if (act === 'over') { u.rage = 0; await attack(u, me, foe, { over: true }); }
 else if (act === 'guard') { u.s.guard = true; addRage(u, 10); if (me.slop > 0) { me.slop--; log(`<span class="sl">🧽 ${u.card.name} guards and mops up a puddle.</span>`); } else log(`${u.card.name} braces for impact.`); }
 else if (act === 'retreat') { const t = me.team[arg]; log(`${u.card.name} retreats — ${t.card.name} jumps in!`); if (me.freeRetreat) { me.freeRetreat = 0; endsTurn = false; setActive(me, t); t.ct = G.time; log(`<span class="sp">(Quick Thinking: no turn spent)</span>`); } else setActive(me, t); }
 else if (act === 'heckle' || act === 'rally') { if (!SIM) HOOKS.command(u, act); }
 if (act === 'heckle') { const t = active(foe); const d = damage(t, u.card.move.damage * TUNE.heckle * ((CARD_TUNE[u.card.name] || {}).dmg || 1) * (u.card.attack + 50) / (effDef(t) + 50), u); shake(t); log(`📣 ${u.card.name} heckles with <b>${u.card.move.name}</b> → ${t.card.name} takes ${d}.`); addRage(u, 12); }
 else if (act === 'rally') { const a = active(me); a.rage = clamp(a.rage + TUNE.rally, 0, 100); u.rage = clamp(u.rage + 10, 0, 100); log(`📣 ${u.card.name} hypes up ${a.card.name} (+25 Nerd Rage).`); fx(a, 'HYPED', 'txt'); }
 return endsTurn;
}

function endTurn(u) {
 const me = sideOf(u);
 if (!u.ko) {
  u.ct += delay(u);
  if (u.s.toxic > 0) { u.s.toxic--; log(`<span class="sl">🤢 Toxic aftertaste: ${u.card.name} loses 10.</span>`); damage(u, 10, null, { flat: true }); }
  ['noRetreat', 'silenced', 'cantAttack'].forEach(k => { if (u.s[k] > 0) u.s[k]--; });
  if (u.s.reduceTurn && --u.s.reduceTurn.t <= 0) u.s.reduceTurn = null;
  u.s.spdMods = u.s.spdMods.filter(x => --x.t > 0); u.s.defMods = u.s.defMods.filter(x => --x.t > 0);
 }
 if (!u.cmdr && me.noSwap > 0) me.noSwap--;
 if (me.revealed > 0 && me.revealed < 99) me.revealed--;
}

function checkWin() { for (const s of G.sides) if (s.team.every(x => x.ko)) { G.over = true; G.winner = 1 - s.i; return true; } return false; }

async function ensureActives() {
 for (const s of G.sides) if (!active(s) && bench(s).length) {
  let pick;
  if (!s.ai) pick = await choose('Who jumps in?', bench(s)); else if (s.aiLevel === 'hard' && HARD.pick) { const fa = active(other(s)); pick = bench(s).sort((a, b) => matchup(b, fa, s) + b.hp / b.max * 0.3 - matchup(a, fa, s) - a.hp / a.max * 0.3)[0]; } else pick = bench(s).sort((a, b) => b.hp - a.hp)[0];
  setActive(s, pick); log(`${pick.card.name} enters the brawl!`);
 }
}

async function loop() { await loopCore(); render(); await sleep(400); if (!SIM) { AUD.music(false); HOOKS.end(G); } return G; }
async function loopCore() {
 while (!G.over) {
  await ensureActives(); if (checkWin()) break;
  const u = nextActor(); G.time = u.ct; G.cur = u; G.pendingFree = false;
  const me = sideOf(u);
  if (!u.cmdr) addRage(u, 4 * me.slop);
  render();
  let ends = true;
  for (let guard = 0; guard < 3; guard++) {
   const act = me.ai ? await aiChoose(u) : await playerChoose(u);
   ends = await doAction(u, act.a, act.arg);
   if (checkWin()) break; await ensureActives();
   if (ends !== false || u.ko || G.over) break;
   if (!G.pendingFree && ends === false) { ends = true; break; } // free retreat consumed the turn sans cost
  }
  G.pendingFree = false;
  if (G.over) break;
  if (ends !== false || u.ko) endTurn(u); else { /* free retreat: incoming acts next */ }
  if (checkWin()) break;
  G.turns++; if (G.turns > (G.cap || 600)) { G.over = true; G.winner = hpPct(G.sides[0]) >= hpPct(G.sides[1]) ? 0 : 1; }
  render(); await sleep(250);
 }
}
const hpPct = s => s.team.reduce((a, x) => a + x.hp / x.max, 0);

/* ---------------- AI ---------------- */
function spUseful(u) {
 const d = SP[spName(u)]; const me = sideOf(u), foe = other(me); const c = { u, me, foe, tgt: active(foe) };
 if (d.useful && !d.useful(c)) return false;
 if (d.hostile && foe.spBlock > 0) return false;
 return true;
}
async function aiChoose(u) {
 await sleep(AUTO ? 150 : 550);
 const lv = sideOf(u).aiLevel || 'normal';
 if (lv === 'hard') return aiHard(u);
 if (lv === 'easy' && Math.random() < 0.45) return aiRandom(u);
 return aiNormal(u);
}
async function aiNormal(u) {
 const me = sideOf(u), foe = other(me), t = active(foe);
 if (u.cmdr) {
  if (!G.pendingFree && canSP(u) && spUseful(u)) return { a: 'sp' };
  if (G.pendingFree) return { a: 'heckle' };
  const a = active(me); if (a && a.rage >= 60 && a.rage < 100) return { a: 'rally' };
  return { a: 'heckle' };
 }
 if (!G.pendingFree && canSP(u) && spUseful(u)) return { a: 'sp' };
 const canAtk = !(u.s.cantAttack > 0);
 if (u.rage >= 100 && canAtk && !G.pendingFree) return { a: 'over' };
 if (canRetreat(me, u) && u.hp / u.max < 0.3 && Math.random() < 0.45 && !G.pendingFree) {
  const b = bench(me).sort((a, b) => b.hp - a.hp)[0]; if (b.hp / b.max > 0.6) return { a: 'retreat', arg: me.team.indexOf(b) };
 }
 if (!canAtk || (me.slop >= 2 && Math.random() < 0.4) ) return { a: 'guard' };
 return { a: 'attack' };
}


/* ---------------- UI HOOKS (implemented by the 3D layer) ---------------- */
const NOOP = () => {};
const HOOKS = { render: NOOP, log: NOOP, fx: NOOP, hit: NOOP, splat: NOOP, banner: NOOP, hideBanner: NOOP, lunge: NOOP, ko: NOOP, swap: NOOP, command: NOOP, end: NOOP, choose: null };
let resolver = null;
function playerChoose(u) { return new Promise(r => { resolver = r; render(); }); }
function act(a, arg) { if (!resolver) return; AUD.sfx('click'); const r = resolver; resolver = null; r({ a, arg }); }
function choose(title, units) { return HOOKS.choose ? HOOKS.choose(title, units) : Promise.resolve(units.slice().sort((a, b) => b.hp - a.hp)[0]); }
const uid = u => `${u.side}-${u.cmdr ? 'c' : u.card.id}`;
function fx(u, text, cls) { if (SIM) return; HOOKS.fx(u, text, cls); }
function shake(u) { if (SIM) return; HOOKS.hit(u); }
function splat(side) { if (SIM) return; AUD.sfx('splat'); HOOKS.splat(side); }
function banner(u) { if (SIM) return; AUD.sfx('secret'); HOOKS.banner(u); }
function hideBanner() { if (SIM) return; HOOKS.hideBanner(); }
function render() { if (!G || SIM) return; HOOKS.render(G); }
function tags(u) { const s = u.s, t = [];
 if (s.guard) t.push('🛡guard'); if (s.dodge) t.push('💨dodge'); if (s.bonus) t.push(`⚔+${s.bonus}`); if (s.weakNext) t.push(`🥴-${s.weakNext}`);
 if (s.noRetreat > 0) t.push('⛓no-retreat'); if (s.silenced > 0) t.push('🤐silenced'); if (s.cantAttack > 0) t.push('🎵no-attack'); if (s.toxic > 0) t.push(`🤢x${s.toxic}`);
 if (s.pierce) t.push('🗡pierce'); if (s.decoy) t.push('🍯decoy'); if (s.reduceNext || s.reduceTurn) t.push('🧱armor'); if (s.redirect) t.push('🚪door');
 if (s.spdMods.length) t.push('🐌spd'); if (s.defMods.length) t.push('🛡+def'); if (u.copied) t.push('📋' + u.copied); return t.join(' '); }
function isSeen(u, viewer) { const side = sideOf(u); return viewer === side.i || AUTO || side.revealed > 0 || (side.revealedNames && side.revealedNames.has(u.card.id)); }

/* start a battle. o: {oppTeam, oppCmdr (null = no commander, e.g. wild Pals), ai:[lvl0,lvl1], level, oppName, playerAI} -> Promise<G> */
function start(team, cmdr, o = {}) {
 const ot = o.oppTeam || shuffle(CREATURES.filter(c => !team.includes(c))).slice(0, 3);
 const oc = o.oppCmdr !== undefined ? o.oppCmdr : rnd(HUMANS.filter(h => h !== cmdr));
 G = { screen: 'battle', sides: [mkSide(0, team, cmdr, 'Your'), mkSide(1, ot, oc, 'Enemy')], time: 0, log: [], turns: 0, over: false, cur: null, wild: !!o.wild };
 G.sides[0].ai = AUTO || SIM || !!o.playerAI; G.sides[0].name = (AUTO || SIM) ? "Blue's" : 'your'; G.sides[1].name = o.oppName || ((AUTO || SIM) ? "Red's" : "the enemy's");
 G.sides[0].aiLevel = o.ai ? o.ai[0] : 'hard'; G.sides[1].aiLevel = o.ai ? o.ai[1] : (o.level || 'normal');
 G.sides.forEach(s => { s.team.forEach(u => u.ct = delay(u) * Math.random() * 0.5); if (s.cmdr) s.cmdr.ct = delay(s.cmdr) * 0.6; });
 log(`⚔ Brawl begins! ${team.map(c => c.name).join(', ')} vs ${ot.map(c => c.name).join(', ')}.`);
 if (!SIM) AUD.music(true, 'battle');
 render(); return loop().catch(e => { window.__errors.push(String(e.stack || e)); console.error(e); });
}
function flee() { if (!G || G.over) return; G.over = true; G.winner = -1; G.fled = true; if (resolver) act('guard'); }

/* Batch simulator: window.simBatch(2000,'hard','normal') */
window.simBatch = async (n, a = 'normal', b = 'normal', tune) => {
 SIM = true; if (tune) Object.assign(TUNE, tune);
 const card = {}, mech = { sp: {}, over: 0 }, res = { wins: [0, 0], turns: 0, n };
 const bump = (k, w) => { card[k] = card[k] || [0, 0]; card[k][1]++; if (w) card[k][0]++; };
 for (let i = 0; i < n; i++) {
  const swap = i % 2; // alternate seats to cancel side bias
  const pool = shuffle(CREATURES); const hs = shuffle(HUMANS);
  await start(pool.slice(0, 3), hs[0], { oppTeam: pool.slice(3, 6), oppCmdr: hs[1], ai: swap ? [b, a] : [a, b] });
  const aWon = (G.winner === 0) !== !!swap; res.wins[aWon ? 0 : 1]++; res.turns += G.turns;
  G.sides.forEach((s, si) => { const w = G.winner === si; s.team.forEach(u => bump(u.card.name, w)); bump(s.cmdr.card.name, w); });
 }
 SIM = false; res.turns /= n; res.card = card; return res;
};
function aiRandom(u) {
 const me = sideOf(u); const opts = u.cmdr ? ['heckle', 'rally'] : ['attack', 'attack', 'guard'];
 if (!u.cmdr && u.s.cantAttack > 0) return { a: 'guard' };
 if (canSP(u) && !G.pendingFree) opts.push('sp'); if (!u.cmdr && u.rage >= 100 && !G.pendingFree && !(u.s.cantAttack > 0)) opts.push('over');
 if (G.pendingFree) return { a: u.cmdr ? 'heckle' : (u.s.cantAttack > 0 ? 'guard' : 'attack') };
 return { a: rnd(opts) };
}
/* ---- Hard AI: expected-value scoring with timeline lookahead ---- */
function estDmg(a, t, mult = 1, o = {}) {
 if (!a || !t) return 0;
 let d = (a.card.move.damage * mult * TUNE.atkMult * ((CARD_TUNE[a.card.name] || {}).dmg || 1) + (o.noBonus ? 0 : a.s.bonus)) * (a.card.attack + TUNE.defPad) / (effDef(t) + TUNE.defPad);
 if (o.over) d *= TUNE.overMult; d *= (CARD_TUNE[t.card.name] || {}).taken || 1; d -= a.s.weakNext || 0;
 if (t.s.reduceTurn) d -= t.s.reduceTurn.v; if (t.s.reduceNext) d -= t.s.reduceNext; if (t.s.decoy) d -= t.s.decoy; if (t.s.guard) d *= 0.5;
 d *= 1 - 0.5 * TUNE.slipChance * sideOf(a).slop;
 return Math.max(5, d);
}
function foeActsBefore(u, me) {
 // how many times the enemy active acts before u acts again (timeline lookahead)
 const foe = other(me), fa = active(foe); if (!fa) return 0;
 const myNext = u.ct + delay(u); let ct = fa.ct, n = 0;
 while (ct < myNext && n < 6) { n++; ct += delay(fa); } return n;
}
function threat(x, me) { // expected damage x will take before acting again
 const fa = active(other(me)); if (!fa) return 0; const n = foeActsBefore(x, me);
 let d = n * estDmg(fa, x, 1, { noBonus: true }) + (n ? fa.s.bonus : 0);
 if (n && fa.rage >= 80) d += estDmg(fa, x) * (TUNE.overMult - 1);
 return d;
}
function matchup(x, foeA, me) { if (!foeA) return 0; const mine = estDmg(x, foeA, 1, { noBonus: true }) * (effSpd(x) + 40) / 100; const theirs = estDmg(foeA, x, 1, { noBonus: true }) * (effSpd(foeA) + 40) / 100; return mine / foeA.hp - theirs / Math.max(1, x.hp); }
const SP_ROLE = { heal: ['Lifebloom', 'Lasting Hope', 'Wrong Item Right Time'], def: ['Veilshift', 'Scrap Insurance', 'Panic Exit', 'Blackout Hide', 'Decoy Deposit', 'Now You Don\'t', 'Wrong Door', 'Objection', 'Wrong Place Right Time', 'Twin Freeze', 'Field Calibration'],
 block: ['Prismsight', 'Pressure Valve', 'Panic Flare', 'Old-School Read', 'Perfect Alibi'], weaken: ['Sweet-Face Scam', 'Cold Shoulder', 'Compliment Trap', 'Hold That Note', 'Rigged Outcome'],
 buff: ['Rare Agreement', 'Footstep Bank', 'Accidental Genius', 'Unclogged Fury', 'Burrow Ambush'], aoe: ['Unanimous Disaster', 'Sleep Fault'], silence: ['Volume Violation', 'Silent Treatment'],
 speed: ['Sticky Situation', 'Secondhand Shame', 'Heavy Forecast'], swap: ['False Welcome', 'Accidental Swap', 'Undertow'], trap: ['Swamp Lock', 'Sourdough Squeeze', 'Safety Lock'] };
function spScore(u, me, name) {
 const foe = other(me), fa = active(foe), d = SP[name]; const c = { u, me, foe, tgt: fa };
 if (!d || d.kind !== 'active' || (d.useful && !d.useful(c))) return -1;
 if (d.hostile && foe.spBlock > 0) return -1; if (me.spBlock > 0 && SP_ROLE.block.includes(name)) return -1;
 const role = Object.keys(SP_ROLE).find(k => SP_ROLE[k].includes(name));
 const a = active(me) || u; const th = threat(a, me);
 switch (role) {
  case 'heal': { const l = lowestAlly(me); return Math.min(l.max - l.hp, name === 'Lifebloom' ? 50 : 30) / l.max * 120; }
  case 'def': return a.s.dodge || a.s.decoy || me.objection ? -1 : 15 + th / a.hp * 60;
  case 'block': return foe.team.concat(foe.cmdr || []).some(x => !x.ko && x.rage > 60 && SP[spName(x)].kind === 'active') ? 40 : 12;
  case 'weaken': return fa ? 15 + estDmg(fa, a) / a.hp * 50 : -1;
  case 'buff': return name === 'Footstep Bank' ? u.lastHit / 2 : 30;
  case 'aoe': return foe.team.filter(x => !x.ko).length * 14 + (foe.team.some(x => !x.ko && x.hp <= (name === 'Sleep Fault' ? 15 : 20)) ? 40 : 0);
  case 'silence': return fa && (SP[spName(fa)].kind === 'passive' && !fa.used || fa.rage > 50) ? 35 : 10;
  case 'speed': return 28;
  case 'swap': return name === 'Undertow' ? 30 : 22;
  case 'trap': return fa && fa.hp / fa.max < 0.5 ? 30 : 12;
 }
 if (d.attack) return 45;
 if (name === 'Receipts' || name === "Collector's Clause") return 35;
 if (name === 'Toxic Aftertaste') return fa && fa.hp > 30 ? 38 : 5;
 if (name === 'Quick Thinking') { const x = active(me); return x && x.hp / x.max < 0.35 ? 30 : 5; }
 if (name === 'Public Record') return 15;
 return 20;
}
const HARD = { retreat: 0, guard: 1, guardBias: -20, spBias: 35, retreatCost: 100, rallyAt: 60, pick: 1, mc: 1, rollouts: 16 };
/* Monte-Carlo lookahead: try each legal action in cloned battles, play them out with the Normal policy, pick the best average result. */
function legalActions(u) {
 const me = sideOf(u), out = [];
 if (u.cmdr) { out.push({ a: 'heckle' }); if (!G.pendingFree) out.push({ a: 'rally' }); if (!G.pendingFree && canSP(u) && spUseful(u)) out.push({ a: 'sp' }); return out; }
 const ca = !(u.s.cantAttack > 0);
 if (ca) out.push({ a: 'attack' }); out.push({ a: 'guard' });
 if (!G.pendingFree && ca && u.rage >= 100) out.push({ a: 'over' });
 if (!G.pendingFree && canSP(u) && spUseful(u)) out.push({ a: 'sp' });
 if (!G.pendingFree && canRetreat(me, u)) bench(me).forEach(b => out.push({ a: 'retreat', arg: me.team.indexOf(b) }));
 return out;
}
async function rollout(choice, n) {
 const saved = G, wasSim = SIM; const si = saved.cur.side; let score = 0;
 SIM = true;
 try {
  for (let k = 0; k < n; k++) {
   G = structuredClone({ ...saved, log: [] }); G.rollout = true; G.cap = G.turns + 80;
   G.sides.forEach(s => { s.ai = true; s.aiLevel = 'normal'; });
   const u = G.cur; const ends = await doAction(u, choice.a, choice.arg);
   if (!checkWin()) { await ensureActives(); if (ends === false && G.pendingFree && !u.ko) { const c2 = await aiNormal(u); await doAction(u, c2.a, c2.arg); } G.pendingFree = false; if (!checkWin()) { endTurn(u); checkWin(); } }
   if (!G.over) await loopCore();
   score += (G.winner === si ? 1 : 0) + 0.15 * (hpPct(G.sides[si]) - hpPct(G.sides[1 - si])) / 3;
  }
 } finally { G = saved; SIM = wasSim; }
 return score / n;
}
async function aiMC(u) {
 const acts = legalActions(u); if (acts.length === 1) return acts[0];
 const heur = await aiHeur(u); let best = null, bv = -1e9;
 for (const c of acts) { let v = await rollout(c, HARD.rollouts); if (c.a === heur.a && c.arg === heur.arg) v += 0.03; if (v > bv) { bv = v; best = c; } }
 return best;
}
async function aiHard(u) { return HARD.mc ? aiMC(u) : aiHeur(u); }
async function aiHeur(u) {
 const me = sideOf(u), foe = other(me), fa = active(foe);
 if (u.cmdr) {
  const a = active(me);
  if (!G.pendingFree && canSP(u)) { const sc = spScore(u, me, spName(u)); if (sc >= 25) return { a: 'sp' }; }
  if (fa && fa.hp <= estDmg(u, fa, TUNE.heckle / TUNE.atkMult)) return { a: 'heckle' };
  if (!G.pendingFree && a && a.rage < 100 && a.rage + TUNE.rally >= 100) return { a: 'rally' };
  if (!G.pendingFree && a && a.rage >= HARD.rallyAt && a.rage < 100) return { a: 'rally' };
  return { a: 'heckle' };
 }
 const ca = !(u.s.cantAttack > 0); const sc = {};
 const tgtShield = fa && (fa.s.dodge || foe.objection || foe.decoy || fa.s.redirect);
 const atk = ca && fa ? estDmg(u, fa) : 0;
 if (ca) sc.attack = atk / fa.hp * 100 + (atk >= fa.hp ? 120 : 0) + (tgtShield ? 30 : 0);
 if (ca && !G.pendingFree && u.rage >= 100) { const ov = estDmg(u, fa, 1, { over: true }); sc.over = tgtShield ? -50 : ov / fa.hp * 100 + (ov >= fa.hp ? 120 : 0) - (atk >= fa.hp ? 200 : 0) + 6; }
 if (!G.pendingFree && canSP(u)) { const s = spScore(u, me, spName(u)); if (s >= 0) sc.sp = s + HARD.spBias; }
 const th = threat(u, me);
 sc.guard = Math.min(th, u.hp) * 0.5 / u.max * 100 + me.slop * 9 + (ca ? 0 : 60) + HARD.guardBias; if (!HARD.guard && ca) delete sc.guard;
 if (HARD.retreat && canRetreat(me, u) && (!G.pendingFree)) {
  const cur = matchup(u, fa, me); const dying = th >= u.hp;
  bench(me).forEach(b => { const v = (matchup(b, fa, me) - cur) * 60 + (dying ? 30 * (b.hp / b.max) : 0) - HARD.retreatCost - threat(b, me) / b.hp * 30; sc['r' + me.team.indexOf(b)] = v; });
 }
 window.__dbg && window.__dbg(sc);
 const best = Object.entries(sc).sort((x, y) => y[1] - x[1])[0][0];
 if (best[0] === 'r') return { a: 'retreat', arg: +best.slice(1) };
 return { a: best };
}

window.addEventListener('error', e => window.__errors.push(e.message));
window.ENGINE = { start, act, flee, HOOKS, SP, TUNE, CARD_TUNE, CREATURES, HUMANS, active, bench, canSP, canRetreat, spName, effSpd, effDef, forecast, isSeen, tags, uid,
 game: () => G, waiting: () => !!resolver, setAuto: v => { AUTO = !!v; }, isAuto: () => AUTO, setSpeed: v => { SPEED = v; }, simBatch: window.simBatch };
