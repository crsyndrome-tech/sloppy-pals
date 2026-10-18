# Sloppy Pals: Rage Brawl — Rules

## The 1-minute version
- **Teams:** 3 Sloppy Pals (creatures) + 1 Human **Commander**. One Pal fights at a time, the other two wait on the bench. Knock out all 3 enemy Pals to win.
- **Speed Timeline, not turns:** the strip in the middle shows who moves next. After acting, a fighter waits `1000 / (Speed + 40)` ticks. Fast Pals get more actions; slow tanks hit harder but less often.
- **On your Pal's action:** ⚔ **Attack** (its printed move), 🛡 **Guard** (halve the next hit, +rage, mop up a slop puddle), or ↩ **Retreat** (swap in a benched Pal, uses your action).
- **Damage** = printed move damage × 0.42 × (ATK+50)/(DEF+50), ±10%.
- **Nerd Rage meter (the signature mechanic):** fills when you get hit (bigger hits = more), when you act, and every turn you stand in slop. The **Nerd Rage stat sets how fast it fills** (fill rate × 0.3 + NR/100). At 100% choose one:
  - ✦ **Secret Power**: fire the card's printed power, then *still* take your normal action, or
  - 💥 **Overcharge**: an attack at ×1.6 damage that always splatters slop on the enemy.
- **Secret powers are hidden** from your opponent until used or revealed (Prismsight, Public Record). *Passive* powers (Rise Again, Mire Memory, Last Word…) are always on; for those Pals, full rage means Overcharge. "Once per battle" powers can be used once.
- **Slop:** hits have an 18% chance (Overcharge: 100%) to splat a puddle on the target's side (max 3). Each puddle gives that side −10% Speed, +rage each turn, and a 7% chance per puddle to **slip** (half damage). Guard mops one up.
- **Commanders (Humans)** never take the field. They act on the timeline too (at 1.7× the wait) and can 📣 **Heckle** (chip damage with their move), 🔥 **Rally** (+25 rage to your active Pal), or fire their Secret Power when *their* rage fills. They take 15% splash from hits on your Pal; if they get KO'd you lose their help.
- **All stats matter:** HP = durability, Attack/Defense = the damage ratio, Speed = how often you act on the timeline, Nerd Rage = how fast your power comes online.

## Secret power notes
Every power on all 60 cards works as printed. A few calls had to be interpreted:
- "Next target"/"target" means the enemy's active Pal. "For one/two turns" means the affected unit's own next 1/2 actions.
- Cards don't print elements, so for Static Reversal (electric), Mire Memory (water) and Flashfire (fire), elements were **inferred** from the name/art: electric = Thunderrunt, Voltrunt, Glitchick; water = Tiderunt, Puddlebrow, Tattletide, Snottopus, Fumblefin, Meltdown 1; fire = Cinderrunt, Grinwick, Kettleback, Rotcap Rex, Scorch. That's in `cards.json` as `element_inferred`.
- Powers that block or cancel secret powers (Prismsight, Pressure Valve, Panic Flare, Old-School Read, Perfect Alibi) cancel the next enemy secret power, whether a Pal or a Commander uses it.
- Defensive powers (dodges, damage reduction, decoys, Objection, Wrong Door) get ignored by Unclogged Fury / Burrow Ambush.
- Twin Freeze only works while Meltdown 1 is on your team and not KO'd.
- Receipts copies the enemy active Pal's power; Collector's Clause copies the most recent active power of a Pal you KO'd.

## v2 additions
- **Hidden powers on the art:** a purple "SECRET ???" sticker covers the Secret Power box on enemy cards. When that power gets used or revealed, the sticker peels off.
- **Difficulty:** Easy, Normal or Hard (pick it on the title screen). Hard tries each move it could make, plays the battle out 16 times per move in its head, then picks the move that won most often.
- **Balance:** printed card stats are never changed. To even out win rates, each card has a hidden damage dealt/taken modifier in the game logic (`CARD_TUNE` in game.js), set from 10,000-battle AI simulations. Rarer cards still have an edge. Commanders get a modifier on their Heckle damage.
- **Audio:** every sound is synthesized live in the browser, with no sound files. Sound/music/volume settings are saved in your browser, and audio only starts after your first tap or click.
