# Sloppy Pals: Rage Brawl 3D (Open World)

A third-person open-world take on the Sloppy Pals card battler. Every model is a Blender-authored glTF, all 60 cards are in the game, and the battle rules are the same as in the 2D game.

## Run it
The browser has to load ES modules and `.glb` files over HTTP, so **opening `index.html` straight from disk (file://) will not work** (Chrome and Edge block it, and the page shows a notice explaining this). Use any static server instead:
```
cd world3d
python3 -m http.server 8000      # then open http://localhost:8000
```
The folder works as-is on **GitHub Pages** or any static host. It needs no build step and loads nothing from a CDN: three.js r180 and GLTFLoader are vendored under `vendor/`.
`lineup.html` is a gallery that shows all 60 models at once.

## Controls
| | Desktop | Touch |
|---|---|---|
| Move | WASD / arrow keys (hold Shift to run) | left joystick (push it all the way to run) |
| Camera | drag the mouse to orbit, wheel to zoom | drag the screen |
| Talk / interact | E | action button |
| Team & Commander | Tab | Team button |
| Battle | click Attack / Secret / Swap / Run (Run is for wild battles only) | tap |

## Flow
Title screen → draft a starter team (3 rounds of picks) or take random Commons → pick a Commander → explore. The town has the Professor (team manager), a healer and Scorch. Six rival trainers stand along the paths through the bog, the muck pits, the mushroom grove and the trash heap. Each one spots you (!) and runs over to challenge you, and they get harder in order. Beating a rival earns a badge, unlocks that rival as a Commander and gives you a reward Pal. Wild Pals lurk in the slop-grass patches; beat one to catch it. With all 6 badges the gate to the Villain's Tower opens, and the Young Villain waits inside as the final boss. Progress autosaves to localStorage (`sp3d_save_v1`).

Battles take place right where you are in the world. The camera swoops in, the Pals face off with their Commanders behind them, and you get slop puddles, attack/hit/KO animations, rage auras and Secret Power cut-ins.

## Files
- `js/cards.js`: the 60 cards, an exact copy from the 2D game.
- `js/engine.js`: the 2D battle rules and AI with the DOM calls replaced by hooks. The rules are unchanged.
- `js/audio.js`: the 2D synth audio plus world music and footstep, encounter and catch sounds.
- `js/main.js`, `world.js`, `battle3d.js`, `ui.js`, `assets.js`, `data.js`: the 3D game.
- `assets/models/`: glbs exported from Blender. The sources are in `sloppy-pals-blender.zip`.
- `tools/test3d.py`: headless Playwright end-to-end test (needs a server on :8123).

Debug URL flags: `?fast=1` speeds up battles, `?auto=1` lets the AI play your side, `?test=1` exposes test hooks.
