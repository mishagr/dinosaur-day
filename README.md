# 🦖 Dinosaur Day

A quick **first-person survival shooter** set in a world ruled by dinosaurs.
Hold the line against escalating waves of raptors — move, aim, shoot, reload,
and stay alive as long as you can.

![FPV survival shooter](https://img.shields.io/badge/engine-Three.js-black) ![local play](https://img.shields.io/badge/play-local%20%7C%20single--player-success)

## Framework

Built with **[Three.js](https://threejs.org/) (WebGL)** — chosen because it:

- Runs **100% locally in the browser** — no install, no account, no backend.
- Delivers nice graphics out of the box: real-time **shadows**, soft lighting,
  exponential fog, tone mapping, and particle effects.
- Ships with **PointerLock** controls, ideal for an FPV / first-person shooter.
- Keeps everything **self-contained** — the dinosaurs, weapon, world, and even
  the sound effects are generated procedurally in code, so there are **no asset
  files to download**.

## How to play

### Easiest: a local web server (recommended)

Browsers restrict ES modules over `file://`, so serve the folder:

```bash
# Option A — Node (no global install needed)
npm start            # serves on http://localhost:8080

# Option B — Python
python3 -m http.server 8080
```

Then open **http://localhost:8080** and click **CLICK TO PLAY**.

> Opening `index.html` directly may work in some Chromium browsers, but a local
> server is the reliable path.

### Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Look | Mouse |
| Shoot | Left Click |
| Sprint | `Shift` |
| Jump | `Space` |
| Reload | `R` |
| Pause | `Esc` |

## Gameplay

- **Wave-based survival.** Each wave spawns more dinosaurs, and they get faster,
  tougher, and hit harder.
- **Headshots** (top of the dino) deal bonus damage and score.
- Clear a wave to earn a **survival bonus**, **+ammo**, and a **heal**.
- The run ends when your health hits zero — then **try again** and beat your
  score.

## Project layout

```
index.html        # entry point, HUD markup, import map
src/style.css     # HUD, crosshair, menus
src/main.js       # renderer, controls, game loop, waves, shooting
src/world.js      # terrain, trees, rocks, lighting, fog
src/dino.js       # procedural dinosaur model + chase/attack AI
src/audio.js      # procedural Web Audio sound effects
```

## Requirements

A modern desktop browser with WebGL2 (Chrome, Edge, Firefox, Safari). The CDN
import map fetches Three.js from `unpkg.com` on first load, so an internet
connection is needed the first time you run it.
