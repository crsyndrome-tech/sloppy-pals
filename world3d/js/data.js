/* Progression data: rivals, boss, wild areas. Card stats come from cards.js (unchanged). */
export const CARD_BY_ID = Object.fromEntries(window.CARDS.map(c => [c.id, c]));
export const card = id => CARD_BY_ID[id];
export const fileOf = c => String(c.id).padStart(2, '0') + '_' + c.name.replace(/'/g, '').replace(/ /g, '_');

export const START_CMDRS = [51, 57, 53]; // Scorch, Adventure Trainer, Scorch's Father
export const RIVALS = [
 { n: 1, card: 54, spawn: 'rival1', team: [7, 14, 10], level: 'easy', area: 'Town Road', face: Math.PI,
   hi: "Yo cuz! Everyone's got Pals now. Let me test mine on you!", lose: "Wrong place, wrong time... again.", win: "Ha! Even I got lucky." },
 { n: 2, card: 52, spawn: 'rival2', team: [15, 37, 33], level: 'easy', area: 'The Bog',
   hi: "Before you wander into that bog, sweetie, show me you can handle yourself.", lose: "That's my kid's friend! So proud.", win: "Go wash up and try again, dear." },
 { n: 3, card: 55, spawn: 'rival3', team: [28, 32, 34], level: 'normal', area: 'Muck Pits',
   hi: "Milo Vault, collector of rare and sloppy things. Your Pals look... appraisable.", lose: "A fine specimen of a trainer. Take my badge.", win: "Into the vault with your pride!" },
 { n: 4, card: 59, spawn: 'rival4', team: [17, 42, 22], level: 'normal', area: 'Mushroom Grove',
   hi: "Fascinating! Spore counts are off the charts. Let's calibrate with a brawl.", lose: "Data recorded: you are excellent.", win: "Hypothesis confirmed: I win." },
 { n: 5, card: 58, spawn: 'rival5', team: [8, 9, 48], level: 'hard', area: 'Trash Heap',
   hi: "Cold out here in the junk. My Pals run colder. Let's go.", lose: "...Respect. You hunt well.", win: "Too slow. The cold takes everyone." },
 { n: 6, card: 56, spawn: 'rival6', team: [23, 24, 50], level: 'hard', area: 'Villain Gate',
   hi: "Vera Vault, gatekeeper. Nobody reaches the tower without going through me.", lose: "Fine. The gate is yours when you hold all six badges.", win: "Paperwork says: denied." },
];
export const BOSS = { n: 7, card: 60, spawn: 'boss', team: [5, 3, 47], level: 'hard', area: "Villain's Tower",
  hi: "So you're the slop-covered nobody beating my vault twins. My Pals are Celestial. Yours are... sloppy.", lose: "Impossible! This was RIGGED!", win: "Perfect alibi, perfect win. Get out of my tower." };
export const NPCS = [
 { id: 'professor', card: 53, spawn: 'professor', name: "Prof. (Scorch's Father)", lines: ["Welcome to the lab! I can swap your team and Commander any time.", "Rivals guard every area. Beat all six and the Villain's gate opens."], team: true },
 { id: 'healer', card: 57, spawn: 'healer', name: 'Adventure Trainer', lines: ["The healing fountain keeps your Pals fresh — every brawl starts at full HP.", "Tall slop grass hides wild Pals. Beat one and it joins you!", "Nerd Rage fills when you get hit. Full rage = Secret Power or OVERCHARGE."] },
 { id: 'scorch', card: 51, spawn: 'scorch', name: 'Scorch', lines: ["Speed matters! Fast Pals get more turns on the timeline.", "Slop puddles slow you down but build rage. Guard to mop them up.", "Enemy Secret Powers stay hidden until they use them. Watch for the sticker!"] },
];
export const AREAS = {
 bog: { name: 'The Bog', pool: [2, 3, 12, 15, 20, 33, 35, 37, 39, 44, 45, 50] },
 muck: { name: 'Muck Pits', pool: [10, 16, 23, 24, 28, 29, 32, 34, 46, 47, 49] },
 grove: { name: 'Mushroom Grove', pool: [4, 6, 13, 17, 22, 25, 26, 31, 36, 38, 41, 42] },
 trash: { name: 'Trash Heap', pool: [1, 8, 9, 11, 14, 18, 19, 21, 40, 43, 48] },
 meadow: { name: 'Sloppy Meadow', pool: [5, 7, 10, 13, 14, 20, 27, 30, 31, 35, 40] },
};
export const RARITY_W = { 'Common': 1, 'Rare': 0.6, 'Epic': 0.32, 'Uber Rare': 0.12, 'Celestial': 0.05 };
export const RARITY_BADGES = { 'Common': 0, 'Rare': 0, 'Epic': 2, 'Uber Rare': 4, 'Celestial': 5 };
export const LEVEL_SHIFT = { easy: { easy: 'easy', normal: 'easy', hard: 'normal' }, normal: { easy: 'easy', normal: 'normal', hard: 'hard' }, hard: { easy: 'normal', normal: 'hard', hard: 'hard' } };
