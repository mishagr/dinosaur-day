import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildWorld, clampToWorld } from './world.js';
import { Dino } from './dino.js';
import { Audio } from './audio.js';

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 600);

const { obstacles } = buildWorld(scene);

// ---------------------------------------------------------------------------
// Controls (FPV)
// ---------------------------------------------------------------------------
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const PLAYER_HEIGHT = 1.8;
const player = {
  velocity: new THREE.Vector3(),
  onGround: true,
  health: 100,
  maxHealth: 100,
};
controls.getObject().position.set(0, PLAYER_HEIGHT, 0);

// ---------------------------------------------------------------------------
// Weapon (viewmodel + shooting)
// ---------------------------------------------------------------------------
const weapon = buildWeaponModel();
camera.add(weapon.group);
scene.add(camera);
weapon.group.position.set(0.32, -0.32, -0.7);

const gunState = {
  mag: 12, magSize: 12, reserve: 48, reloading: false,
  fireCooldown: 0, recoil: 0,
};

const raycaster = new THREE.Raycaster();

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const dinos = [];
const game = {
  running: false,
  wave: 0,
  score: 0,
  toSpawn: 0,
  spawnTimer: 0,
  betweenWaves: false,
  betweenTimer: 0,
  kills: 0,
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = {};
document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') reload();
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0 && game.running) shoot();
});

// Start / pause UI
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const overlayStats = document.getElementById('overlay-stats');

startBtn.addEventListener('click', () => {
  Audio.resume();
  if (!game.running && game.health <= 0) resetGame();
  controls.lock();
});

controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('crosshair').classList.remove('hidden');
  if (!game.running) startGame();
});

controls.addEventListener('unlock', () => {
  if (player.health > 0) {
    // pause
    document.getElementById('overlay-stats').classList.remove('hidden');
    overlayStats.innerHTML = `<div>Paused</div>`;
    startBtn.textContent = 'RESUME';
    overlay.classList.remove('hidden');
  }
});

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
function startGame() {
  game.running = true;
  game.wave = 0;
  game.score = 0;
  game.kills = 0;
  player.health = player.maxHealth;
  nextWave();
}

function resetGame() {
  for (const d of dinos) d._cleanup?.();
  dinos.length = 0;
  controls.getObject().position.set(0, PLAYER_HEIGHT, 0);
  player.velocity.set(0, 0, 0);
  gunState.mag = gunState.magSize;
  gunState.reserve = 48;
  startBtn.textContent = 'CLICK TO PLAY';
}

function nextWave() {
  game.wave++;
  game.toSpawn = 3 + Math.floor(game.wave * 1.7);
  game.spawnTimer = 0;
  game.betweenWaves = false;
  Audio.waveStart();
  document.getElementById('wave').textContent = game.wave;
  flashCenter(`WAVE ${game.wave}`);
}

function spawnDino() {
  // spawn on a ring around the player
  const p = controls.getObject().position;
  const ang = Math.random() * Math.PI * 2;
  const r = 40 + Math.random() * 25;
  const pos = new THREE.Vector3(p.x + Math.cos(ang) * r, 0, p.z + Math.sin(ang) * r);
  clampToWorld(pos);

  const w = game.wave;
  const d = new Dino(scene, pos, {
    health: 26 + w * 6,
    speed: 4.8 + Math.min(w * 0.25, 4),
    damage: 9 + Math.min(w, 12),
    scoreValue: 100,
    scale: 0.85 + Math.random() * 0.5,
  });
  dinos.push(d);
  if (Math.random() < 0.5) Audio.roar();
}

// ---------------------------------------------------------------------------
// Shooting
// ---------------------------------------------------------------------------
function shoot() {
  if (gunState.reloading || gunState.fireCooldown > 0) return;
  if (gunState.mag <= 0) {
    Audio.empty();
    return;
  }
  gunState.mag--;
  gunState.fireCooldown = 0.12;
  gunState.recoil = 1;
  Audio.shoot();
  muzzleFlash();
  updateAmmoHUD();

  // ray from screen center
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);

  let closest = null, closestDist = Infinity;
  for (const d of dinos) {
    if (!d.alive) continue;
    const dist = d.intersectsRay(raycaster);
    if (dist != null && dist < closestDist) {
      closestDist = dist;
      closest = d;
    }
  }

  if (closest) {
    // headshots (upper portion) deal bonus damage
    const hitPoint = raycaster.ray.at(closestDist, new THREE.Vector3());
    const headY = closest.group.position.y + 2.0 * closest.scale;
    const isHead = hitPoint.y > headY;
    const dmg = isHead ? 45 : 22;
    const killed = closest.hit(dmg);
    showHitmarker(isHead);
    Audio.hitmarker();
    spawnBloodHit(hitPoint, closest._bodyMat?.color);
    if (killed) {
      game.score += closest.scoreValue + (isHead ? 50 : 0);
      game.kills++;
      updateHUD();
    }
  }

  if (gunState.mag === 0) reload();
}

function reload() {
  if (gunState.reloading || gunState.mag === gunState.magSize || gunState.reserve <= 0) return;
  gunState.reloading = true;
  document.getElementById('reloading').classList.remove('hidden');
  Audio.reload();
  setTimeout(() => {
    const need = gunState.magSize - gunState.mag;
    const take = Math.min(need, gunState.reserve);
    gunState.mag += take;
    gunState.reserve -= take;
    gunState.reloading = false;
    document.getElementById('reloading').classList.add('hidden');
    updateAmmoHUD();
  }, 900);
}

// ---------------------------------------------------------------------------
// Damage to player
// ---------------------------------------------------------------------------
function damagePlayer(amount) {
  if (player.health <= 0) return;
  player.health -= amount;
  Audio.hurt();
  const v = document.getElementById('damage-vignette');
  v.classList.add('hit');
  setTimeout(() => v.classList.remove('hit'), 120);
  updateHealthHUD();
  if (player.health <= 0) gameOver();
}

function gameOver() {
  game.running = false;
  Audio.gameOver();
  controls.unlock();
  document.getElementById('overlay-stats').classList.remove('hidden');
  overlayStats.innerHTML = `
    <div>You were overrun on <span class="big">Wave ${game.wave}</span></div>
    <div>Kills: <span class="big">${game.kills}</span> &nbsp; Score: <span class="big">${game.score}</span></div>`;
  startBtn.textContent = 'TRY AGAIN';
  document.querySelector('.tagline').textContent = 'The dinosaurs win this round…';
  overlay.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const GRAVITY = 22;

function updateMovement(dt) {
  const obj = controls.getObject();
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = sprint ? 11 : 6.5;

  const forward = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

  // damp horizontal velocity
  player.velocity.x -= player.velocity.x * 10 * dt;
  player.velocity.z -= player.velocity.z * 10 * dt;

  const dir = new THREE.Vector3();
  controls.getDirection(dir);
  dir.y = 0; dir.normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));

  player.velocity.addScaledVector(dir, forward * speed * 10 * dt);
  player.velocity.addScaledVector(right, strafe * speed * 10 * dt);

  // jump + gravity
  if (keys['Space'] && player.onGround) {
    player.velocity.y = 8.5;
    player.onGround = false;
  }
  player.velocity.y -= GRAVITY * dt;

  obj.position.addScaledVector(player.velocity, dt);

  if (obj.position.y <= PLAYER_HEIGHT) {
    obj.position.y = PLAYER_HEIGHT;
    player.velocity.y = 0;
    player.onGround = true;
  }

  // obstacle collision (push out of trees/rocks)
  for (const o of obstacles) {
    const dx = obj.position.x - o.x;
    const dz = obj.position.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.radius + 0.6;
    if (d < min && d > 0.0001) {
      const push = (min - d);
      obj.position.x += (dx / d) * push;
      obj.position.z += (dz / d) * push;
    }
  }

  clampToWorld(obj.position);

  // view bob
  const moving = Math.abs(forward) + Math.abs(strafe) > 0 && player.onGround;
  weapon.bobTime += dt * (sprint ? 14 : 9) * (moving ? 1 : 0);
}

function updateWaves(dt) {
  if (game.betweenWaves) {
    game.betweenTimer -= dt;
    if (game.betweenTimer <= 0) nextWave();
    return;
  }

  // spawn pending dinos gradually
  if (game.toSpawn > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnDino();
      game.toSpawn--;
      game.spawnTimer = 0.6 + Math.random() * 0.6;
    }
  }

  const aliveCount = dinos.filter((d) => d.alive).length;
  document.getElementById('enemies').textContent = aliveCount + game.toSpawn;

  // wave cleared?
  if (game.toSpawn === 0 && aliveCount === 0) {
    game.betweenWaves = true;
    game.betweenTimer = 4;
    game.score += 250; // survival bonus
    // small ammo + heal reward
    gunState.reserve += 24;
    player.health = Math.min(player.maxHealth, player.health + 20);
    updateHUD();
    flashCenter('WAVE CLEARED  +250');
  }
}

function updateDinos(dt) {
  const ppos = controls.getObject().position;
  for (let i = dinos.length - 1; i >= 0; i--) {
    const d = dinos[i];
    const bite = d.update(dt, ppos, obstacles);
    if (bite) damagePlayer(bite);
    if (d._dead) dinos.splice(i, 1);
  }
}

function updateWeaponView(dt) {
  // recoil recovers
  gunState.recoil -= gunState.recoil * 12 * dt;
  gunState.fireCooldown = Math.max(0, gunState.fireCooldown - dt);

  const bobX = Math.cos(weapon.bobTime) * 0.012;
  const bobY = Math.abs(Math.sin(weapon.bobTime)) * 0.018;
  weapon.group.position.set(0.32 + bobX, -0.32 + bobY - gunState.recoil * 0.04, -0.7 + gunState.recoil * 0.06);
  weapon.group.rotation.x = gunState.recoil * 0.25;
  if (weapon.flash) weapon.flash.material.opacity *= 0.8;
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------
function buildWeaponModel() {
  const group = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.6, metalness: 0.7 });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0x444450, roughness: 0.4, metalness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5), matBody);
  group.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 12), matAccent);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.45);
  group.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), matAccent);
  mag.position.set(0, -0.16, 0.05);
  group.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), matBody);
  grip.position.set(0, -0.14, 0.22);
  grip.rotation.x = 0.3;
  group.add(grip);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.12), matAccent);
  sight.position.set(0, 0.11, -0.1);
  group.add(sight);

  // muzzle flash sprite
  const flashMat = new THREE.SpriteMaterial({ color: 0xffd070, transparent: true, opacity: 0, depthTest: false });
  const flash = new THREE.Sprite(flashMat);
  flash.scale.set(0.5, 0.5, 0.5);
  flash.position.set(0, 0.03, -0.78);
  group.add(flash);

  group.traverse((o) => { o.renderOrder = 999; if (o.material) o.material.depthTest = true; });
  return { group, flash, bobTime: 0 };
}

function muzzleFlash() {
  if (!weapon.flash) return;
  weapon.flash.material.opacity = 1;
  weapon.flash.scale.set(0.4 + Math.random() * 0.3, 0.4 + Math.random() * 0.3, 1);
  weapon.flash.material.rotation = Math.random() * Math.PI;
}

// small particle puff at impact
const bloodPool = [];
function spawnBloodHit(pos, color) {
  const mat = new THREE.SpriteMaterial({ color: color ? color.clone().offsetHSL(0, 0, -0.1) : 0xaa3322, transparent: true, opacity: 1, depthTest: true });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(mat.clone());
    s.position.copy(pos);
    s.scale.setScalar(0.12 + Math.random() * 0.12);
    s.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3);
    s.userData.life = 0.5;
    scene.add(s);
    bloodPool.push(s);
  }
}
function updateParticles(dt) {
  for (let i = bloodPool.length - 1; i >= 0; i--) {
    const s = bloodPool[i];
    s.userData.life -= dt;
    s.userData.vel.y -= 9 * dt;
    s.position.addScaledVector(s.userData.vel, dt);
    s.material.opacity = Math.max(0, s.userData.life * 2);
    if (s.userData.life <= 0) {
      scene.remove(s);
      s.material.dispose();
      bloodPool.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function updateHUD() {
  document.getElementById('score').textContent = game.score;
  document.getElementById('wave').textContent = game.wave;
  updateHealthHUD();
  updateAmmoHUD();
}
function updateHealthHUD() {
  const pct = Math.max(0, player.health) / player.maxHealth * 100;
  const fill = document.getElementById('health-fill');
  fill.style.width = pct + '%';
  fill.style.background = pct > 50
    ? 'linear-gradient(90deg,#6fd36f,#3aa83a)'
    : pct > 25
      ? 'linear-gradient(90deg,#e8c14b,#c79a23)'
      : 'linear-gradient(90deg,#e8654b,#c23b2e)';
}
function updateAmmoHUD() {
  document.getElementById('ammo').textContent = gunState.mag;
  document.getElementById('reserve').textContent = gunState.reserve;
}

function showHitmarker(isHead) {
  const h = document.getElementById('hitmarker');
  h.classList.remove('hidden');
  h.style.color = isHead ? '#ff5a4b' : '#ffffff';
  clearTimeout(h._t);
  h._t = setTimeout(() => h.classList.add('hidden'), 90);
}

function flashCenter(text) {
  let el = document.getElementById('center-flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'center-flash';
    el.style.cssText = `position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);
      font-size:46px;font-weight:bold;letter-spacing:6px;color:#e8b04b;z-index:18;
      pointer-events:none;text-shadow:0 3px 12px rgba(0,0,0,.8);transition:opacity .4s;`;
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 1400);
}

// main render loop
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (game.running && controls.isLocked) {
    updateMovement(dt);
    updateWaves(dt);
    updateDinos(dt);
    updateWeaponView(dt);
  }
  updateParticles(dt);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Resize + boot
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updateHUD();
loop();
