import * as THREE from 'three';

/* ============================================================
   陀螺儀賽車 3D · Gyro Racer
   一台車 / 一條賽道 / 手機陀螺儀轉向
   ============================================================ */

// ---------- 錯誤收集（headless 驗證用） ----------
const errBox = document.getElementById('errlog');
const params = new URLSearchParams(location.search);
function logErr(msg) {
  errBox.textContent += msg + '\n';
  errBox.classList.add('show');
}
window.addEventListener('error', e => logErr(`[error] ${e.message} @${e.lineno}`));
window.addEventListener('unhandledrejection', e => logErr(`[reject] ${e.reason}`));
if (params.get('debug') === '1') errBox.classList.add('show');

// ---------- 小工具 ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

// ---------- 程序化紋理 ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function makeAsphaltTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3b3f49'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.10)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}
function makeGrassTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4c9a5f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,70,0,0.09)' : 'rgba(190,255,190,0.07)';
      const r = 2 + Math.random() * 4;
      g.fillRect(Math.random() * w, Math.random() * h, r, r);
    }
  });
}
function makeCurbTexture() {
  // 路緣石：沿行進方向紅白相間
  const t = canvasTex(64, 16, (g, w, h) => {
    g.fillStyle = '#d23c3c'; g.fillRect(0, 0, w / 2, h);
    g.fillStyle = '#f0f0f0'; g.fillRect(w / 2, 0, w / 2, h);
  });
  return t;
}
function makeBannerTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#c22026'; g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) { g.fillRect(i * 32, 0, 16, 10); g.fillRect(i * 32 + 16, 86, 16, 10); }
  g.font = '900 50px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText('GYRO RACER 3D', 256, 52);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

// ---------- 參數 ----------
const ROAD_HALF = 7;          // 路面半寬
const CAR_HALF = 1.15;        // 車身半寬（撞牆判定用）
const ACCEL = 20, DRAG = 0.42, ROLL = 1.2, BRAKE_F = 34;
const GYRO_FULL = 30;         // 幾度傾斜 = 滿舵

// ---------- 賽道：控制點 -> 封閉曲線 -> 密集採樣 ----------
const CONTROL = [
  [0, -78], [52, -74], [84, -52], [93, -12], [93, 16], [89, 44],
  [66, 62], [30, 60], [0, 70], [-32, 64], [-62, 66], [-86, 48],
  [-92, 18], [-86, -12], [-68, -36], [-38, -48], [-16, -64],
].map(([x, z]) => new THREE.Vector3(x, 0, z));
const curve = new THREE.CatmullRomCurve3(CONTROL, true, 'centripetal');

const SAMPLES = 1024;
const samples = [];
for (let i = 0; i < SAMPLES; i++) {
  const u = i / SAMPLES;
  const pos = curve.getPointAt(u); pos.y = 0;
  const tan = curve.getTangentAt(u); tan.y = 0; tan.normalize();
  const side = new THREE.Vector3(-tan.z, 0, tan.x); // 右向量 = forward × up
  samples.push({ pos, tan, side });
}
const trackLen = curve.getLength();

// 最近採樣點（每幀在上次索引附近視窗搜尋）
let segIdx = 0;
function nearestSample(p, full = false) {
  let best = segIdx, bestD = Infinity;
  const W = full ? SAMPLES : 48;
  const step = full ? 4 : 1;
  for (let k = -W; k <= W; k += step) {
    const i = (((segIdx + k) % SAMPLES) + SAMPLES) % SAMPLES;
    const s = samples[i];
    const dx = p.x - s.pos.x, dz = p.z - s.pos.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  segIdx = best;
  return samples[best];
}

// ---------- 場景 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87bfe8);
scene.fog = new THREE.Fog(0x87bfe8, 140, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a6b3f, 0.95));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
sun.position.set(80, 120, 40);
scene.add(sun);

// ---------- 地面 ----------
{
  const grassTex = makeGrassTexture();
  grassTex.repeat.set(60, 60);
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(500, 48),
    new THREE.MeshLambertMaterial({ map: grassTex })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = -0.05;
  scene.add(g);
}

// ---------- 路面 / 邊線 / 護欄：緞帶幾何 ----------
function buildRibbon(offA, offB, y, material, uRepeat = 1) {
  const SEG = 600;
  const posArr = new Float32Array((SEG + 1) * 2 * 3);
  const uvArr = new Float32Array((SEG + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= SEG; i++) {
    const s = samples[Math.floor(i / SEG * SAMPLES) % SAMPLES];
    const u = i / SEG * uRepeat;
    posArr[i * 6 + 0] = s.pos.x + s.side.x * offA;
    posArr[i * 6 + 1] = y;
    posArr[i * 6 + 2] = s.pos.z + s.side.z * offA;
    posArr[i * 6 + 3] = s.pos.x + s.side.x * offB;
    posArr[i * 6 + 4] = y;
    posArr[i * 6 + 5] = s.pos.z + s.side.z * offB;
    uvArr[i * 4 + 0] = u; uvArr[i * 4 + 1] = 0;
    uvArr[i * 4 + 2] = u; uvArr[i * 4 + 3] = 1;
    if (i < SEG) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function buildRail(off, y0, y1, material) {
  const SEG = 600;
  const posArr = new Float32Array((SEG + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i <= SEG; i++) {
    const s = samples[Math.floor(i / SEG * SAMPLES) % SAMPLES];
    const x = s.pos.x + s.side.x * off, z = s.pos.z + s.side.z * off;
    posArr[i * 6 + 0] = x; posArr[i * 6 + 1] = y0; posArr[i * 6 + 2] = z;
    posArr[i * 6 + 3] = x; posArr[i * 6 + 4] = y1; posArr[i * 6 + 5] = z;
    if (i < SEG) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// ---------- 賽道鋪面：瀝青紋理 + 紅白路緣石 + 金屬護欄 ----------
scene.add(buildRibbon(-ROAD_HALF, ROAD_HALF, 0.05,
  new THREE.MeshLambertMaterial({ map: makeAsphaltTexture(), side: THREE.DoubleSide }),
  trackLen / 14));
{
  const curbMat = new THREE.MeshLambertMaterial({ map: makeCurbTexture(), side: THREE.DoubleSide });
  const rep = trackLen / 5; // 每 2.5m 一格紅白
  scene.add(buildRibbon(-ROAD_HALF - 1.1, -ROAD_HALF, 0.06, curbMat, rep));
  scene.add(buildRibbon(ROAD_HALF, ROAD_HALF + 1.1, 0.06, curbMat, rep));
}
{
  const railMat = new THREE.MeshPhongMaterial({
    color: 0xb9c1cd, shininess: 70, specular: 0x555555, side: THREE.DoubleSide,
  });
  scene.add(buildRail(-ROAD_HALF - 1.9, -0.1, 0.75, railMat));
  scene.add(buildRail(ROAD_HALF + 1.9, -0.1, 0.75, railMat));
  // 護欄立柱
  const per = Math.floor(trackLen / 7);
  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.85, 0.16),
    new THREE.MeshLambertMaterial({ color: 0x4a4f58 }),
    per * 2
  );
  const m = new THREE.Matrix4();
  let n = 0;
  for (const sd of [-1, 1]) {
    for (let i = 0; i < per; i++) {
      const s = samples[Math.floor(i / per * SAMPLES) % SAMPLES];
      m.makeTranslation(
        s.pos.x + s.side.x * sd * (ROAD_HALF + 1.9), 0.42,
        s.pos.z + s.side.z * sd * (ROAD_HALF + 1.9)
      );
      posts.setMatrixAt(n++, m);
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  scene.add(posts);
}
// 輪胎牆（彎道外側）
{
  const tireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.42, 14);
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x1b1d23 });
  for (const u of [0.1, 0.28, 0.46, 0.64, 0.82]) {
    const s = samples[Math.floor(u * SAMPLES) % SAMPLES];
    for (const sd of [-1, 1]) {
      const x = s.pos.x + s.side.x * sd * (ROAD_HALF + 4.5);
      const z = s.pos.z + s.side.z * sd * (ROAD_HALF + 4.5);
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(tireGeo, tireMat);
        t.position.set(x, 0.21 + k * 0.42, z);
        t.rotation.y = Math.random() * Math.PI;
        scene.add(t);
      }
    }
  }
}

// ---------- 中央虛線 ----------
{
  const dashGeo = new THREE.PlaneGeometry(0.35, 2.2);
  dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd75e });
  const count = Math.floor(trackLen / 9);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const s = samples[Math.floor(i / count * SAMPLES) % SAMPLES];
    p.set(s.pos.x, 0.07, s.pos.z);
    q.setFromAxisAngle(up, Math.atan2(s.tan.x, s.tan.z));
    m.compose(p, q, sc);
    dashes.setMatrixAt(i, m);
  }
  dashes.instanceMatrix.needsUpdate = true;
  scene.add(dashes);
}

// ---------- 起跑線（黑白格） + 起跑拱門 ----------
function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = (i + j) % 2 ? '#141414' : '#ffffff';
    g.fillRect(i * 8, j * 8, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}
{
  const s0 = samples[0];
  const geo = new THREE.PlaneGeometry(ROAD_HALF * 2, 2);
  geo.rotateX(-Math.PI / 2);
  const line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: checkerTexture() }));
  line.position.set(s0.pos.x, 0.08, s0.pos.z);
  line.lookAt(s0.pos.x + s0.tan.x, 0.08, s0.pos.z + s0.tan.z);
  scene.add(line);

  // 拱門
  const gate = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x223148 });
  const postGeo = new THREE.CylinderGeometry(0.35, 0.35, 6.5, 10);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(sx * (ROAD_HALF + 1.6), 3.25, 0);
    gate.add(post);
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry((ROAD_HALF + 1.6) * 2, 1.4, 0.4),
    new THREE.MeshLambertMaterial({ map: makeBannerTexture() })
  );
  banner.position.y = 6.2;
  gate.add(banner);
  gate.position.set(s0.pos.x, 0, s0.pos.z);
  gate.lookAt(s0.pos.x + s0.tan.x, 0, s0.pos.z + s0.tan.z);
  scene.add(gate);
}

// ---------- 樹（InstancedMesh） ----------
{
  const spots = [];
  let guard = 0;
  while (spots.length < 70 && guard++ < 2000) {
    const x = (Math.random() - 0.5) * 260, z = (Math.random() - 0.5) * 260;
    let minD = Infinity;
    for (let i = 0; i < SAMPLES; i += 8) {
      const s = samples[i];
      const dx = x - s.pos.x, dz = z - s.pos.z;
      const d = dx * dx + dz * dz;
      if (d < minD) minD = d;
    }
    minD = Math.sqrt(minD);
    if (minD > 15 && minD < 140) spots.push([x, z]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.6, 8);
  const leafGeo = new THREE.ConeGeometry(2.0, 5.5, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d43 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  spots.forEach(([x, z], i) => {
    const s = 0.8 + Math.random() * 0.7;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
    p.set(x, 0.8 * s, z); sc.set(s, s, s);
    m.compose(p, q, sc); trunks.setMatrixAt(i, m);
    p.set(x, (1.6 + 2.4) * s, z);
    m.compose(p, q, sc); leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, new THREE.Color().setHSL(0.32 + Math.random() * 0.04, 0.5, 0.26 + Math.random() * 0.12));
  });
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  scene.add(trunks, leaves);
}

// ---------- 賽車（烤漆跑車造型） ----------
function buildCar() {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color: 0xd21f26, shininess: 90, specular: 0x777777 });
  const darkTrim = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const glass = new THREE.MeshPhongMaterial({ color: 0x101c2a, shininess: 140, specular: 0xaaddff });
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xc9d2dd, shininess: 80, specular: 0x888888 });
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x101114 });

  // 車體下部（車頭朝 +z）
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.52, 4.4), paint);
  body.position.y = 0.58;
  g.add(body);
  // 引擎蓋斜面
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.14, 1.5), paint);
  hood.position.set(0, 0.84, 1.5);
  hood.rotation.x = 0.1;
  g.add(hood);
  // 前保桿 / 後保桿
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.34, 0.5), darkTrim);
  bumperF.position.set(0, 0.42, 2.02);
  g.add(bumperF);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.4, 0.4), darkTrim);
  bumperR.position.set(0, 0.45, -2.08);
  g.add(bumperR);
  // 座艙（深色玻璃）+ 車頂
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 1.9), glass);
  cabin.position.set(0, 1.06, -0.35);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), paint);
  roof.position.set(0, 1.34, -0.4);
  g.add(roof);
  // 側裙 + 後視鏡
  for (const sx of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 2.6), darkTrim);
    skirt.position.set(sx * 1.0, 0.32, 0);
    g.add(skirt);
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.14), paint);
    mir.position.set(sx * 1.08, 1.05, 0.55);
    g.add(mir);
  }
  // 尾翼
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.09, 0.5), paint);
  wing.position.set(0, 1.42, -1.95);
  g.add(wing);
  for (const sx of [-1, 1]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.55), darkTrim);
    ep.position.set(sx * 0.92, 1.28, -1.95);
    g.add(ep);
    const sup = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.24), darkTrim);
    sup.position.set(sx * 0.6, 1.2, -1.95);
    g.add(sup);
  }
  // 頭燈 / 尾燈條
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hlMat);
    hl.position.set(sx * 0.62, 0.68, 2.21);
    g.add(hl);
  }
  const tl = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.12, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a })
  );
  tl.position.set(0, 0.72, -2.29);
  g.add(tl);

  // 輪胎 + 輪框（前輪可轉向）
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.38, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const wheels = [], pivots = [];
  for (const [sx, sz, front] of [[-1, 1.45, 1], [1, 1.45, 1], [-1, -1.45, 0], [1, -1.45, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 1.02, 0.42, sz);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tireGeo, tireMat));
    spin.add(new THREE.Mesh(rimGeo, rimMat));
    pivot.add(spin);
    g.add(pivot);
    wheels.push(spin);
    if (front) pivots.push(pivot);
  }
  // 車底假陰影
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.scale.set(0.85, 1.6, 1);
  blob.position.y = 0.02;
  g.add(blob);

  scene.add(g);
  return { group: g, wheels, pivots };
}
const car = buildCar();

// ---------- 遊戲狀態 ----------
const S = {
  phase: 'overlay',      // overlay | countdown | race
  pos: new THREE.Vector3(),
  heading: 0,
  speed: 0,
  lap: 1,
  raceTime: 0,
  lapStart: 0,
  best: null,
  uPrev: 0,
  passedMid: false,
  steerSm: 0,
  autoAccel: true,
  invert: false,
  muted: false,
};

function placeOnTrack(u = 0, lateral = 0) {
  const i = Math.floor(u * SAMPLES) % SAMPLES;
  segIdx = i;
  const s = samples[i];
  S.pos.set(
    s.pos.x + s.side.x * lateral,
    0,
    s.pos.z + s.side.z * lateral
  );
  S.heading = Math.atan2(s.tan.x, s.tan.z);
  S.speed = 0;
  S.uPrev = u;
  S.passedMid = false;
  syncCarMesh(0);
}
function syncCarMesh(dt) {
  car.group.position.set(S.pos.x, 0.06, S.pos.z);
  car.group.rotation.y = S.heading;
  const spin = S.speed * dt / 0.42;
  for (const w of car.wheels) w.rotation.x += spin;
  for (const p of car.pivots) p.rotation.y = S.steerSm * 0.42;
}
placeOnTrack(0, 0);

// ---------- 輸入：陀螺儀 / 觸控 / 鍵盤 ----------
let gyroSteer = 0, gyroActive = false;
// 依螢幕方向取左右傾斜：直向用 gamma，橫向用 beta（右傾為正）
function tiltFromEvent(e) {
  if (e.gamma == null && e.beta == null) return null;
  const so = window.screen && window.screen.orientation;
  const ang = (so && typeof so.angle === 'number') ? so.angle : (window.orientation || 0);
  let t;
  if (ang === 90) t = e.beta;                        // 橫向（頂部朝左）
  else if (ang === -90 || ang === 270) t = -e.beta;  // 橫向（頂部朝右）
  else t = e.gamma;                                  // 直向
  if (t == null) return null;
  return clamp(t / GYRO_FULL, -1, 1) * (S.invert ? -1 : 1);
}
function onOrient(e) {
  const v = tiltFromEvent(e);
  if (v == null) return;
  gyroActive = true;
  gyroSteer = v;
  $('steer-fallback').classList.remove('show');
}
async function requestGyro() {
  try {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      const r = await DOE.requestPermission();
      if (r === 'granted') window.addEventListener('deviceorientation', onOrient);
    } else if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', onOrient);
    }
  } catch (err) { /* 無陀螺儀就用備用按鈕 */ }
}

const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

let touchSteer = 0, brakeHeld = false;
function bindHold(el, on, off) {
  const start = e => { e.preventDefault(); on(); };
  const end = e => { e.preventDefault(); off(); };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', end);
}
bindHold($('btn-left'),
  () => { touchSteer = -1; $('btn-left').classList.add('held'); },
  () => { if (touchSteer < 0) touchSteer = 0; $('btn-left').classList.remove('held'); });
bindHold($('btn-right'),
  () => { touchSteer = 1; $('btn-right').classList.add('held'); },
  () => { if (touchSteer > 0) touchSteer = 0; $('btn-right').classList.remove('held'); });
bindHold($('btn-brake'),
  () => { brakeHeld = true; $('btn-brake').classList.add('held'); },
  () => { brakeHeld = false; $('btn-brake').classList.remove('held'); });

function readSteer() {
  if (gyroActive) return gyroSteer;
  let s = touchSteer;
  if (keys['ArrowLeft'] || keys['KeyA']) s -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) s += 1;
  return clamp(s, -1, 1);
}
function readBrake() {
  return brakeHeld || keys['ArrowDown'] || keys['KeyS'];
}

// 無陀螺儀一段時間後顯示備用轉向鈕
setInterval(() => {
  if (S.phase === 'race' && !gyroActive && !('ontouchstart' in window && navigator.maxTouchPoints > 0)) {
    // 桌機：鍵盤提示即可，不顯示按鈕
    return;
  }
  if (S.phase === 'race' && !gyroActive && performance.now() - raceStartWall > 3000) {
    $('steer-fallback').classList.add('show');
  }
}, 1000);
let raceStartWall = 0;

// ---------- 音效：引擎聲（WebAudio 合成） ----------
let AC = null, engOsc = null, engGain = null;
function initAudio() {
  try {
    if (AC) { AC.resume(); return; }
    AC = new (window.AudioContext || window.webkitAudioContext)();
    engOsc = AC.createOscillator();
    engOsc.type = 'sawtooth';
    const filt = AC.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 850;
    engGain = AC.createGain(); engGain.gain.value = 0;
    engOsc.connect(filt); filt.connect(engGain); engGain.connect(AC.destination);
    engOsc.start();
  } catch (err) { /* 無音效也照玩 */ }
}
function updateAudio() {
  if (!AC || !engOsc) return;
  const t = AC.currentTime;
  const target = (!S.muted && S.phase === 'race') ? 0.045 : 0;
  engGain.gain.setTargetAtTime(target, t, 0.1);
  engOsc.frequency.setTargetAtTime(62 + S.speed * 3.4, t, 0.05);
}
$('btn-sound').addEventListener('click', () => {
  S.muted = !S.muted;
  $('btn-sound').textContent = S.muted ? '🔇' : '🔊';
});
$('btn-reset').addEventListener('click', () => {
  const s = nearestSample(S.pos, true);
  placeOnTrack(samples.indexOf(s) / SAMPLES, 0);
  flashMsg('已重置回賽道');
});

// ---------- HUD / 小地圖 ----------
const mm = $('minimap').getContext('2d');
let mmBounds = null;
{
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const s of samples) {
    minX = Math.min(minX, s.pos.x); maxX = Math.max(maxX, s.pos.x);
    minZ = Math.min(minZ, s.pos.z); maxZ = Math.max(maxZ, s.pos.z);
  }
  mmBounds = { minX, maxX, minZ, maxZ };
}
function mmXY(x, z) {
  const W = 240, pad = 24;
  const sx = (W - pad * 2) / (mmBounds.maxX - mmBounds.minX);
  const sz = (W - pad * 2) / (mmBounds.maxZ - mmBounds.minZ);
  const sc = Math.min(sx, sz);
  const ox = (W - (mmBounds.maxX - mmBounds.minX) * sc) / 2;
  const oz = (W - (mmBounds.maxZ - mmBounds.minZ) * sc) / 2;
  return [ox + (x - mmBounds.minX) * sc, oz + (z - mmBounds.minZ) * sc];
}
{
  // 預畫賽道
  mm.strokeStyle = '#8fa0c8'; mm.lineWidth = 7; mm.lineJoin = 'round';
  mm.beginPath();
  samples.forEach((s, i) => {
    const [x, y] = mmXY(s.pos.x, s.pos.z);
    if (i === 0) mm.moveTo(x, y); else mm.lineTo(x, y);
  });
  mm.closePath(); mm.stroke();
  mm.strokeStyle = '#3a3f4a'; mm.lineWidth = 3; mm.stroke();
}
function drawMinimap() {
  mm.clearRect(0, 0, 240, 240);
  mm.strokeStyle = '#8fa0c8'; mm.lineWidth = 7; mm.lineJoin = 'round';
  mm.beginPath();
  samples.forEach((s, i) => {
    const [x, y] = mmXY(s.pos.x, s.pos.z);
    if (i === 0) mm.moveTo(x, y); else mm.lineTo(x, y);
  });
  mm.closePath(); mm.stroke();
  const [cx, cy] = mmXY(S.pos.x, S.pos.z);
  mm.fillStyle = '#ff3b3b';
  mm.strokeStyle = '#fff'; mm.lineWidth = 2;
  mm.beginPath(); mm.arc(cx, cy, 7, 0, Math.PI * 2); mm.fill(); mm.stroke();
  // 車頭方向
  const fx = Math.sin(S.heading), fz = Math.cos(S.heading);
  mm.beginPath(); mm.moveTo(cx, cy); mm.lineTo(cx + fx * 13, cy + fz * 13); mm.stroke();
}

function fmt(t) {
  if (t == null) return '--:--.-';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
function updateHUD() {
  $('hud-lap').textContent = S.lap;
  $('hud-time').textContent = fmt(S.raceTime - S.lapStart);
  $('hud-best').textContent = fmt(S.best);
  $('speed-num').textContent = Math.round(S.speed * 3.6);
}

let msgTimer = null;
function flashMsg(t, ms = 1800) {
  const el = $('msg');
  el.textContent = t; el.style.display = 'block';
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => el.style.display = 'none', ms);
}

// ---------- 流程：開始 -> 倒數 -> 比賽 ----------
$('btn-start').addEventListener('click', async () => {
  S.autoAccel = $('opt-auto').checked;
  S.invert = $('opt-invert').checked;
  $('overlay').classList.add('hide');
  $('hud').classList.add('on');
  initAudio();
  await requestGyro();
  startCountdown();
});

function startCountdown() {
  S.phase = 'countdown';
  const cd = $('countdown'), num = $('cd-num');
  cd.classList.add('show');
  const seq = ['3', '2', '1', 'GO!'];
  let i = 0;
  num.textContent = seq[0];
  const tick = () => {
    i++;
    if (i < seq.length) {
      num.textContent = seq[i];
      setTimeout(tick, i === seq.length - 1 ? 600 : 750);
    } else {
      cd.classList.remove('show');
      S.phase = 'race';
      S.raceTime = 0; S.lapStart = 0; S.lap = 1; S.best = null;
      S.passedMid = false;
      raceStartWall = performance.now();
      placeOnTrack(0, 0);
      updateHUD();
    }
  };
  setTimeout(tick, 750);
}

if (params.get('autostart') === '1') {
  // headless 驗證用：跳過開始畫面
  setTimeout(() => {
    $('overlay').classList.add('hide');
    $('hud').classList.add('on');
    startCountdown();
  }, 400);
}

// ---------- 物理更新 ----------
function step(dt) {
  // 轉向
  const steerTarget = readSteer();
  S.steerSm += (steerTarget - S.steerSm) * Math.min(1, 12 * dt);

  // 油門 / 煞車
  const throttle = (S.phase === 'race')
    ? (S.autoAccel ? 1 : (keys['ArrowUp'] || keys['KeyW'] ? 1 : 0))
    : 0;
  const brake = S.phase === 'race' && readBrake();
  let acc = throttle * ACCEL - DRAG * S.speed - ROLL;
  if (brake) acc -= BRAKE_F;
  S.speed = Math.max(0, S.speed + acc * dt);

  // 轉向率（高速衰減）
  const turnRate = S.steerSm * 2.6 / (1 + S.speed * 0.055);
  S.heading -= turnRate * dt;   // 右傾（steer>0）= 右轉

  // 前進
  S.pos.x += Math.sin(S.heading) * S.speed * dt;
  S.pos.z += Math.cos(S.heading) * S.speed * dt;

  // 賽道約束：投影到中心線，夾住橫向偏移
  const s = nearestSample(S.pos);
  const dx = S.pos.x - s.pos.x, dz = S.pos.z - s.pos.z;
  let d = dx * s.side.x + dz * s.side.z;
  const lim = ROAD_HALF - CAR_HALF;
  if (Math.abs(d) > lim) {
    d = clamp(d, -lim, lim);
    S.pos.x = s.pos.x + s.side.x * d;
    S.pos.z = s.pos.z + s.side.z * d;
    S.speed *= Math.max(0, 1 - 2.2 * dt); // 擦牆減速
    // 輕微導正，避免卡牆
    const tanA = Math.atan2(s.tan.x, s.tan.z);
    let diff = tanA - S.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    S.heading += diff * Math.min(1, 1.6 * dt);
  }

  // 計圈：u 0..1，跨過起點線且中途經過半圈才算
  const u = segIdx / SAMPLES;
  if (S.phase === 'race') {
    if (u > 0.35 && u < 0.65) S.passedMid = true;
    if (S.uPrev > 0.92 && u < 0.08 && S.passedMid) {
      const lt = S.raceTime - S.lapStart;
      if (lt > 5) { // 防止抖動誤觸
        S.lap++;
        S.lapStart = S.raceTime;
        if (S.best == null || lt < S.best) {
          S.best = lt;
          flashMsg(`🏁 最速單圈 ${fmt(lt)}！`);
        } else {
          flashMsg(`單圈 ${fmt(lt)}`);
        }
        S.passedMid = false;
      }
    }
    S.raceTime += dt;
  }
  S.uPrev = u;

  syncCarMesh(dt);
}

// ---------- 鏡頭 ----------
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let camInit = false;
function updateCamera(dt) {
  const fx = Math.sin(S.heading), fz = Math.cos(S.heading);
  camPos.set(S.pos.x - fx * 9.5, 4.1, S.pos.z - fz * 9.5);
  camLook.set(S.pos.x + fx * 7, 1.1, S.pos.z + fz * 7);
  if (!camInit) {
    camera.position.copy(camPos);
    camInit = true;
  } else {
    const k = 1 - Math.exp(-5 * dt);
    camera.position.lerp(camPos, k);
  }
  camera.lookAt(camLook);
}

// ---------- 主迴圈 ----------
let lastT = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (S.phase === 'countdown' || S.phase === 'race') {
    step(dt);
    updateCamera(dt);
    updateHUD();
    drawMinimap();
    updateAudio();
  }
  renderer.render(scene, camera);
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
