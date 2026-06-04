import * as THREE from 'three';

// A lightweight low-poly raptor-style dinosaur with simple walk animation and
// chase AI. Built from primitive meshes so it needs no external assets — keeps
// the whole game self-contained for local play.

const SKINS = [
  { body: 0x6f7d3a, belly: 0xc9b27a, stripe: 0x3f4a1f }, // olive
  { body: 0x8a4b2a, belly: 0xd0a26a, stripe: 0x5a2f18 }, // rust
  { body: 0x4a6470, belly: 0x9fb0b6, stripe: 0x2a3a42 }, // slate
  { body: 0x7a4a6a, belly: 0xc99fb6, stripe: 0x4a2a3f }, // mauve
];

export class Dino {
  constructor(scene, position, opts = {}) {
    this.scene = scene;
    this.alive = true;
    this.maxHealth = opts.health ?? 30;
    this.health = this.maxHealth;
    this.speed = opts.speed ?? 5.5;
    this.damage = opts.damage ?? 12;
    this.scoreValue = opts.scoreValue ?? 100;
    this.scale = opts.scale ?? 1;
    this.attackCooldown = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.radius = 0.9 * this.scale;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this._build(SKINS[Math.floor(Math.random() * SKINS.length)]);
    this.group.scale.setScalar(this.scale);
    scene.add(this.group);

    this._tmp = new THREE.Vector3();
  }

  _build(skin) {
    const bodyMat = new THREE.MeshStandardMaterial({ color: skin.body, roughness: 0.85, flatShading: true });
    const bellyMat = new THREE.MeshStandardMaterial({ color: skin.belly, roughness: 0.85, flatShading: true });
    const darkMat = new THREE.MeshStandardMaterial({ color: skin.stripe, roughness: 0.7, flatShading: true });
    this._bodyMat = bodyMat;

    // torso (tilted forward, raptor posture)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.1, 4, 8), bodyMat);
    torso.rotation.z = Math.PI / 2;
    torso.position.set(0, 1.5, 0);
    torso.castShadow = true;
    this.group.add(torso);

    // belly accent
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), bellyMat);
    belly.rotation.z = Math.PI / 2;
    belly.position.set(0, 1.32, 0);
    this.group.add(belly);

    // neck + head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.9, 7), bodyMat);
    neck.position.set(0.85, 1.95, 0);
    neck.rotation.z = -0.7;
    neck.castShadow = true;
    this.group.add(neck);

    const head = new THREE.Group();
    head.position.set(1.35, 2.25, 0);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.45), bodyMat);
    skull.castShadow = true;
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.36), bodyMat);
    snout.position.set(0.6, -0.05, 0);
    head.add(snout);
    // jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.32), darkMat);
    jaw.position.set(0.6, -0.22, 0);
    head.add(jaw);
    // eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffd23b, emissive: 0xc98a00, emissiveIntensity: 0.6 });
    for (const dz of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
      eye.position.set(0.18, 0.12, dz);
      head.add(eye);
    }
    this.group.add(head);
    this.head = head;

    // tail
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 7), bodyMat);
    tail.rotation.z = Math.PI / 2 + 0.25;
    tail.position.set(-1.25, 1.55, 0);
    tail.castShadow = true;
    this.group.add(tail);
    this.tail = tail;

    // legs
    this.legs = [];
    for (const dz of [-0.32, 0.32]) {
      const leg = new THREE.Group();
      leg.position.set(-0.1, 1.0, dz);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 6), bodyMat);
      thigh.position.y = -0.2;
      thigh.castShadow = true;
      leg.add(thigh);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 4, 6), darkMat);
      shin.position.set(0.12, -0.75, 0);
      leg.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.3), darkMat);
      foot.position.set(0.28, -1.05, 0);
      leg.add(foot);
      this.group.add(leg);
      this.legs.push(leg);
    }

    // little arms
    for (const dz of [-0.3, 0.3]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 5), bodyMat);
      arm.position.set(0.55, 1.45, dz);
      arm.rotation.z = 0.9;
      this.group.add(arm);
    }
  }

  // Returns true and the damage dealt if the dino reaches & bites the player.
  update(dt, playerPos, obstacles) {
    if (!this.alive) {
      // death sink animation
      this.group.position.y -= dt * 2.5;
      this.group.rotation.z += dt * 1.6;
      this._fade -= dt;
      if (this._fade <= 0) this._cleanup();
      return null;
    }

    const g = this.group;
    this._tmp.set(playerPos.x - g.position.x, 0, playerPos.z - g.position.z);
    const dist = this._tmp.length();

    // face the player
    const targetAngle = Math.atan2(this._tmp.x, this._tmp.z);
    g.rotation.y = lerpAngle(g.rotation.y, targetAngle - Math.PI / 2, 1 - Math.pow(0.001, dt));

    let bite = null;
    const reach = 2.4 * this.scale;
    if (dist > reach) {
      // move toward player with simple obstacle avoidance
      this._tmp.normalize();
      let mx = this._tmp.x, mz = this._tmp.z;
      for (const o of obstacles) {
        const ox = g.position.x - o.x, oz = g.position.z - o.z;
        const od = Math.hypot(ox, oz);
        const pad = o.radius + this.radius + 0.5;
        if (od < pad && od > 0.001) {
          mx += (ox / od) * (pad - od) * 0.8;
          mz += (oz / od) * (pad - od) * 0.8;
        }
      }
      const ml = Math.hypot(mx, mz) || 1;
      g.position.x += (mx / ml) * this.speed * dt;
      g.position.z += (mz / ml) * this.speed * dt;
      this._animateWalk(dt, 1);
    } else {
      // in range: attack on cooldown
      this._animateWalk(dt, 0.3);
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.attackCooldown = 1.1;
        bite = this.damage;
        // lunge
        this.head.position.x = 1.6;
        setTimeout(() => { if (this.head) this.head.position.x = 1.35; }, 120);
      }
    }
    return bite;
  }

  _animateWalk(dt, intensity) {
    this.walkPhase += dt * this.speed * 1.4 * intensity;
    const s = Math.sin(this.walkPhase);
    if (this.legs[0]) this.legs[0].rotation.z = s * 0.6 * intensity;
    if (this.legs[1]) this.legs[1].rotation.z = -s * 0.6 * intensity;
    this.tail.rotation.y = Math.sin(this.walkPhase * 0.5) * 0.25;
    // bob
    this.group.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.08 * intensity;
  }

  // Apply damage. Returns true if this shot killed the dino.
  hit(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    // flash white
    this._bodyMat.emissive.setHex(0xffffff);
    this._bodyMat.emissiveIntensity = 0.8;
    setTimeout(() => {
      if (this._bodyMat) this._bodyMat.emissiveIntensity = 0;
    }, 70);
    if (this.health <= 0) {
      this.alive = false;
      this._fade = 1.4;
      return true;
    }
    return false;
  }

  // Approx hit test: ray vs vertical capsule around the dino body.
  intersectsRay(raycaster) {
    const c = this.group.position;
    // build a box around the torso/head area for the test
    if (!this._hitBox) {
      this._hitBox = new THREE.Box3();
    }
    const half = 1.6 * this.scale;
    this._hitBox.min.set(c.x - half, c.y + 0.4, c.z - half);
    this._hitBox.max.set(c.x + half, c.y + 3.2 * this.scale, c.z + half);
    const pt = raycaster.ray.intersectBox(this._hitBox, new THREE.Vector3());
    return pt ? pt.distanceTo(raycaster.ray.origin) : null;
  }

  _cleanup() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this._dead = true;
  }
}

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
