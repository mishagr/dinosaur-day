import * as THREE from 'three';

// Builds the static environment: ground, sky, fog, lighting, foliage & rocks.
// Returns helpers the rest of the game needs (e.g. obstacle list for collision).
export function buildWorld(scene) {
  const obstacles = []; // { position, radius } cylinders for player/dino avoidance

  // ---- Sky & atmosphere ----
  scene.background = new THREE.Color(0x9fb6c9);
  scene.fog = new THREE.FogExp2(0x9fb6c9, 0.0085);

  // ---- Lighting ----
  const hemi = new THREE.HemisphereLight(0xcfe3f2, 0x4a5238, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  const s = 120;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // ---- Ground ----
  const groundGeo = new THREE.PlaneGeometry(600, 600, 64, 64);
  // gentle rolling displacement so it isn't a flat plane
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const h = Math.sin(x * 0.03) * Math.cos(y * 0.035) * 1.6
            + Math.sin(x * 0.11 + y * 0.07) * 0.5;
    pos.setZ(i, h);
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x5f7a3e, roughness: 1, metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // subtle dirt patches
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3c, roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const r = 3 + Math.random() * 7;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(r, 12), dirtMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(rand(220), 0.05, rand(220));
    patch.receiveShadow = true;
    scene.add(patch);
  }

  // ---- Trees ----
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x3a7d3f, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x4f8a42, roughness: 1 }),
  ];
  for (let i = 0; i < 90; i++) {
    const x = rand(240), z = rand(240);
    if (Math.hypot(x, z) < 16) continue; // keep spawn area clear
    const tree = makeTree(trunkMat, leafMats[i % leafMats.length]);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    const sc = 0.8 + Math.random() * 1.1;
    tree.scale.setScalar(sc);
    scene.add(tree);
    obstacles.push({ x, z, radius: 1.3 * sc });
  }

  // ---- Rocks ----
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7c7b74, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const x = rand(230), z = rand(230);
    if (Math.hypot(x, z) < 14) continue;
    const r = 1 + Math.random() * 2.4;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
    rock.position.set(x, r * 0.45, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.y = 0.7;
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    obstacles.push({ x, z, radius: r * 0.9 });
  }

  // ---- Ferns / grass tufts (cheap instanced-ish billboards via cones) ----
  const fernMat = new THREE.MeshStandardMaterial({ color: 0x3c7a36, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 260; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 4), fernMat);
    blade.position.set(rand(250), 0.6, rand(250));
    blade.rotation.y = Math.random() * Math.PI;
    blade.castShadow = false;
    scene.add(blade);
  }

  return { obstacles, sun };
}

function makeTree(trunkMat, leafMat) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 5, 7), trunkMat);
  trunk.position.y = 2.5;
  trunk.castShadow = true;
  g.add(trunk);
  // layered canopy
  for (let i = 0; i < 3; i++) {
    const r = 2.6 - i * 0.6;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 2.6, 8), leafMat);
    cone.position.y = 4.6 + i * 1.6;
    cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

const WORLD_HALF = 248; // play boundary

export function clampToWorld(v) {
  v.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, v.x));
  v.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, v.z));
}

function rand(spread) {
  return (Math.random() * 2 - 1) * spread;
}
