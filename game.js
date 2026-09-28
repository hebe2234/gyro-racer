import * as THREE from 'three';

/* ============================================================
   陀螺儀賽車 3D · 摩納哥街道賽
   真實摩納哥賽道中心線 (3.337 km) + F1 風格賽車 / 手機陀螺儀轉向
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

// ---------- i18n：繁體中文 / 英文 ----------
const I18N = {
  zh: {
    title: '陀螺儀賽車 3D · 摩納哥街道賽',
    brake: '煞車',
    title_h1: '🏎️ <span class="em">摩納哥</span>街道賽',
    subtitle: 'MONACO STREET CIRCUIT · 3.337 km · F1 風格賽車',
    howto: '📱 <b>左右傾斜手機</b>＝ 轉方向盤（直向 / 橫向皆可，建議橫向）<br>' +
      '🚀 自動加速，右下角 <b>煞車</b> 過彎用<br>' +
      '🏁 真實摩納哥賽道：Sainte Dévote → 賭場 → 髮夾彎 → 隧道 → 游泳池<br>' +
      '⚠️ 街道賽很窄，髮夾彎記得煞車！',
    opt_auto: '自動加速',
    opt_invert: '反轉轉向',
    opt_invert_note: '如果傾斜方向跟轉彎相反，勾這個',
    start: '開始遊戲',
    perm_note: 'iPhone 點開始後會跳出陀螺儀權限要求，請按「允許」。<br>' +
      '直向橫向皆可（建議橫向）；沒有陀螺儀的裝置會自動顯示 ◀ ▶ 觸控按鈕；電腦可用 ← → 方向鍵。',
    msg_reset: '已重置回賽道',
    msg_fastest: lt => `🏁 最速單圈 ${lt}！`,
    msg_lap: lt => `單圈 ${lt}`,
  },
  en: {
    title: 'Gyro Racer 3D · Monaco Street Circuit',
    brake: 'BRAKE',
    title_h1: '🏎️ <span class="em">Monaco</span> Street Race',
    subtitle: 'MONACO STREET CIRCUIT · 3.337 km · F1-Style Car',
    howto: '📱 <b>Tilt your phone left / right</b> to steer (portrait or landscape, landscape recommended)<br>' +
      '🚀 Auto-accelerate; use <b>BRAKE</b> (bottom right) for corners<br>' +
      '🏁 Real Monaco circuit: Sainte Dévote → Casino → Hairpin → Tunnel → Swimming Pool<br>' +
      '⚠️ Narrow street circuit — brake for the hairpin!',
    opt_auto: 'Auto-accelerate',
    opt_invert: 'Invert steering',
    opt_invert_note: 'Check this if tilting feels reversed',
    start: 'START RACE',
    perm_note: 'On iPhone, tap Start and allow the gyroscope permission when prompted.<br>' +
      'Portrait or landscape both work (landscape recommended); devices without a gyroscope get ◀ ▶ touch buttons automatically; on desktop use the ← → arrow keys.',
    msg_reset: 'Reset to track',
    msg_fastest: lt => `🏁 Fastest lap ${lt}!`,
    msg_lap: lt => `Lap ${lt}`,
  },
};

let lang = 'en';
try {
  lang = localStorage.getItem('gr_lang') ||
    ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
} catch (e) { /* localStorage 不可用就用預設英文 */ }
if (lang !== 'zh') lang = 'en';

function tr(key, arg) {
  const v = I18N[lang][key];
  return typeof v === 'function' ? v(arg) : v;
}
function setLang(l) {
  lang = l === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem('gr_lang', lang); } catch (e) {}
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.title = I18N[lang].title;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = I18N[lang][el.getAttribute('data-i18n')];
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const v = I18N[lang][el.getAttribute('data-i18n-html')];
    if (typeof v === 'string') el.innerHTML = v;
  });
  document.querySelectorAll('#btn-lang [data-langbtn]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-langbtn') === lang);
  });
}
$('btn-lang').addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh'));
setLang(lang);

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
function makeCityTexture() {
  // 城市地面：暖灰 + 細噪點
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9a978e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      const r = 1 + Math.random() * 3;
      g.fillRect(Math.random() * w, Math.random() * h, r, r);
    }
  });
}
function makeCurbTexture() {
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
  g.fillStyle = '#14213d'; g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) { g.fillRect(i * 32, 0, 16, 10); g.fillRect(i * 32 + 16, 86, 16, 10); }
  g.font = '900 56px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffd75e';
  g.fillText('MONACO', 256, 52);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
function makeBuildingTexture(base) {
  // 建築立面：窗戶格
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 10; y += 22) {
      for (let x = 10; x < w - 10; x += 20) {
        const lit = Math.random() < 0.25;
        g.fillStyle = lit ? '#ffe9a8' : 'rgba(30,40,60,0.85)';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
}

// ---------- 參數 ----------
const ROAD_HALF = 5;          // 路面半寬（摩納哥街道較窄）
const CAR_HALF = 1.0;         // 車身半寬（撞牆判定用）
const ACCEL = 26, DRAG = 0.40, ROLL = 1.2, BRAKE_F = 46;
const GYRO_FULL = 30;         // 幾度傾斜 = 滿舵

// ---------- 賽道：摩納哥真實中心線 -> 封閉曲線 -> 密集採樣 ----------
const CONTROL = MONACO_CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z));
const curve = new THREE.CatmullRomCurve3(CONTROL, true, 'centripetal');
curve.arcLengthDivisions = 12000; // 3.3km 賽道需要高精度弧長參數化，否則採樣點不均勻

const SAMPLES = 2048;
const samples = [];
for (let i = 0; i < SAMPLES; i++) {
  const u = i / SAMPLES;
  const pos = curve.getPointAt(u); pos.y = 0;
  const tan = curve.getTangentAt(u); tan.y = 0; tan.normalize();
  const side = new THREE.Vector3(-tan.z, 0, tan.x); // 右向量
  samples.push({ pos, tan, side });
}
const trackLen = curve.getLength();
const RIB_SEGS = Math.ceil(trackLen / 3); // 緞帶分段（約每 3m 一段）

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
// u（0..1）對應的採樣點
function sampleAt(u) {
  const i = (((Math.floor(u * SAMPLES) % SAMPLES) + SAMPLES) % SAMPLES);
  return samples[i];
}

// ---------- 場景 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87bfe8);
scene.fog = new THREE.Fog(0x87bfe8, 220, 750);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x8a8a7a, 0.95));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
sun.position.set(300, 420, 150);
scene.add(sun);

// ---------- 地面（城市） ----------
{
  const cityTex = makeCityTexture();
  cityTex.repeat.set(140, 140);
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(850, 48),
    new THREE.MeshLambertMaterial({ map: cityTex })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = -0.08;
  scene.add(g);
}
// ---------- 港口海水（賽道南側） ----------
{
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 420),
    new THREE.MeshPhongMaterial({ color: 0x1e6f9e, shininess: 120, specular: 0x99ccff })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-420, -0.03, 560); // 世界座標：南側海域
  scene.add(water);
}

// ---------- 路面 / 邊線 / 護欄：緞帶幾何 ----------
function buildRibbon(offA, offB, y, material, uRepeat = 1, u0 = 0, u1 = 1) {
  const SEG = Math.max(8, Math.ceil(RIB_SEGS * (u1 - u0)));
  const posArr = new Float32Array((SEG + 1) * 2 * 3);
  const uvArr = new Float32Array((SEG + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= SEG; i++) {
    const s = sampleAt(u0 + (i / SEG) * (u1 - u0));
    const u = (u0 + (i / SEG) * (u1 - u0)) * uRepeat;
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

function buildRail(off, y0, y1, material, u0 = 0, u1 = 1) {
  const SEG = Math.max(8, Math.ceil(RIB_SEGS * (u1 - u0)));
  const posArr = new Float32Array((SEG + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i <= SEG; i++) {
    const s = sampleAt(u0 + (i / SEG) * (u1 - u0));
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

// ---------- 賽道鋪面：瀝青 + 紅白路緣石 + 金屬護欄 ----------
scene.add(buildRibbon(-ROAD_HALF, ROAD_HALF, 0.05,
  new THREE.MeshLambertMaterial({ map: makeAsphaltTexture(), side: THREE.DoubleSide }),
  trackLen / 14));
{
  const curbMat = new THREE.MeshLambertMaterial({ map: makeCurbTexture(), side: THREE.DoubleSide });
  const rep = trackLen / 5;
  scene.add(buildRibbon(-ROAD_HALF - 1.1, -ROAD_HALF, 0.06, curbMat, rep));
  scene.add(buildRibbon(ROAD_HALF, ROAD_HALF + 1.1, 0.06, curbMat, rep));
}
{
  const railMat = new THREE.MeshPhongMaterial({
    color: 0xb9c1cd, shininess: 70, specular: 0x555555, side: THREE.DoubleSide,
  });
  scene.add(buildRail(-ROAD_HALF - 1.9, -0.1, 0.75, railMat));
  scene.add(buildRail(ROAD_HALF + 1.9, -0.1, 0.75, railMat));
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
      const s = sampleAt(i / per);
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

// ---------- 隧道（Portier 之後直線段，約 1480m–1830m） ----------
const TUN_U0 = 1480 / trackLen, TUN_U1 = 1830 / trackLen;
{
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8d8d94, side: THREE.DoubleSide });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6f6f76, side: THREE.DoubleSide });
  const wOff = ROAD_HALF + 1.4, hTop = 6.2;
  scene.add(buildRail(-wOff, 0, hTop, wallMat, TUN_U0, TUN_U1));
  scene.add(buildRail(wOff, 0, hTop, wallMat, TUN_U0, TUN_U1));
  scene.add(buildRibbon(-wOff, wOff, hTop, roofMat, 40, TUN_U0, TUN_U1));
  // 隧道內燈帶
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, side: THREE.DoubleSide });
  scene.add(buildRibbon(-1.6, -1.2, hTop - 0.25, lightMat, 30, TUN_U0, TUN_U1));
  scene.add(buildRibbon(1.2, 1.6, hTop - 0.25, lightMat, 30, TUN_U0, TUN_U1));
  // 出入口門框
  const portalMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  for (const u of [TUN_U0, TUN_U1]) {
    const s = sampleAt(u);
    const grp = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry((wOff + 1.2) * 2, 1.2, 1.4), portalMat);
    top.position.y = hTop + 0.6;
    grp.add(top);
    for (const sd of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.2, hTop + 1.2, 1.4), portalMat);
      pil.position.set(sd * (wOff + 0.6), (hTop + 1.2) / 2, 0);
      grp.add(pil);
    }
    grp.position.set(s.pos.x, 0, s.pos.z);
    grp.rotation.y = Math.atan2(s.tan.x, s.tan.z);
    scene.add(grp);
  }
}

// ---------- 輪胎牆（高曲率彎道外側） ----------
{
  // 先算每段曲率
  const curv = [];
  for (let i = 0; i < SAMPLES; i += 8) {
    const a = samples[i], b = samples[(i + 24) % SAMPLES];
    let d = Math.atan2(b.tan.x, b.tan.z) - Math.atan2(a.tan.x, a.tan.z);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    curv.push({ i, d });
  }
  const tireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.42, 14);
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x1b1d23 });
  const spots = [];
  for (const c of curv) {
    if (Math.abs(c.d) > 0.35 && spots.every(s => Math.abs(s - c.i) > 60)) spots.push(c.i);
    if (spots.length >= 14) break;
  }
  const m4 = new THREE.Matrix4();
  const tires = new THREE.InstancedMesh(tireGeo, tireMat, spots.length * 2 * 4 * 3);
  let tn = 0;
  for (const i of spots) {
    const s = samples[i];
    const c = curv.find(k => k.i === i);
    const sd = c.d > 0 ? 1 : -1; // 彎道外側
    for (let row = 0; row < 4; row++) {
      const si = samples[(i + row * 3) % SAMPLES];
      for (let col = -1; col <= 1; col++) {
        const x = si.pos.x + si.side.x * sd * (ROAD_HALF + 3.6) + si.tan.x * col * 1.25;
        const z = si.pos.z + si.side.z * sd * (ROAD_HALF + 3.6) + si.tan.z * col * 1.25;
        for (let k = 0; k < 3; k++) {
          m4.makeTranslation(x, 0.21 + k * 0.42, z);
          tires.setMatrixAt(tn++, m4);
        }
      }
    }
  }
  tires.count = tn;
  tires.instanceMatrix.needsUpdate = true;
  scene.add(tires);
}

// ---------- 中央虛線 ----------
{
  const dashGeo = new THREE.PlaneGeometry(0.3, 2.0);
  dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const count = Math.floor(trackLen / 12);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const s = sampleAt(i / count);
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
  return new THREE.CanvasTexture(c);
}
{
  const s0 = samples[0];
  const geo = new THREE.PlaneGeometry(ROAD_HALF * 2, 1.6);
  geo.rotateX(-Math.PI / 2);
  const line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: checkerTexture() }));
  line.position.set(s0.pos.x, 0.08, s0.pos.z);
  line.lookAt(s0.pos.x + s0.tan.x, 0.08, s0.pos.z + s0.tan.z);
  scene.add(line);

  const gate = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x223148 });
  const postGeo = new THREE.CylinderGeometry(0.35, 0.35, 7, 10);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(sx * (ROAD_HALF + 1.6), 3.5, 0);
    gate.add(post);
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry((ROAD_HALF + 1.6) * 2, 1.5, 0.4),
    new THREE.MeshLambertMaterial({ map: makeBannerTexture() })
  );
  banner.position.y = 6.8;
  gate.add(banner);
  gate.position.set(s0.pos.x, 0, s0.pos.z);
  gate.lookAt(s0.pos.x + s0.tan.x, 0, s0.pos.z + s0.tan.z);
  scene.add(gate);
}

// ---------- 建築群（街道兩側公寓，避開隧道與海） ----------
{
  const palette = ['#e8e0d0', '#f2ede2', '#d9c9a8', '#e5d5c0', '#cfd8dc', '#f5f5f5'];
  const texs = palette.map(c => makeBuildingTexture(c));
  const spots = [];
  let guard = 0;
  while (spots.length < 260 && guard++ < 6000) {
    const u = Math.random();
    if (u > TUN_U0 - 0.01 && u < TUN_U1 + 0.01) continue; // 隧道段不放
    const s = sampleAt(u);
    const sd = Math.random() < 0.5 ? -1 : 1;
    const off = 16 + Math.random() * 30;
    const x = s.pos.x + s.side.x * sd * off;
    const z = s.pos.z + s.side.z * sd * off;
    if (x > -770 && x < -70 && z > 140) continue; // 海域不放
    // 離賽道夠遠（整圈檢查）
    let ok = true;
    for (let i = 0; i < SAMPLES; i += 16) {
      const t = samples[i];
      const dx = x - t.pos.x, dz = z - t.pos.z;
      if (dx * dx + dz * dz < 15 * 15) { ok = false; break; }
    }
    if (ok) spots.push({ x, z, w: 10 + Math.random() * 14, h: 14 + Math.random() * 42, d: 10 + Math.random() * 12, t: (Math.random() * texs.length) | 0, ry: Math.random() * Math.PI });
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const mats = texs.map(t => new THREE.MeshLambertMaterial({ map: t }));
  const perTex = mats.map(() => []);
  spots.forEach(sp => perTex[sp.t].push(sp));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), sc = new THREE.Vector3();
  perTex.forEach((list, ti) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(boxGeo, mats[ti], list.length);
    list.forEach((sp, i) => {
      q.setFromAxisAngle(up, sp.ry);
      p.set(sp.x, 0, sp.z); sc.set(sp.w, sp.h, sp.d);
      m.compose(p, q, sc);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  });
  // 屋頂水箱點綴
  const tankGeo = new THREE.CylinderGeometry(1.2, 1.2, 2, 8);
  const tankMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const tanks = new THREE.InstancedMesh(tankGeo, tankMat, Math.min(60, spots.length));
  let ntn = 0;
  for (const sp of spots) {
    if (ntn >= 60 || Math.random() > 0.25) continue;
    m.makeTranslation(sp.x, sp.h + 1, sp.z);
    tanks.setMatrixAt(ntn++, m);
  }
  tanks.count = ntn;
  tanks.instanceMatrix.needsUpdate = true;
  scene.add(tanks);
}

// ---------- 遊艇（港口） ----------
{
  const hullMat = new THREE.MeshPhongMaterial({ color: 0xf5f7fa, shininess: 60 });
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 120 });
  const spots = [[-480, 420], [-380, 480], [-560, 520], [-300, 560], [-450, 620], [-620, 430]];
  for (const [x, z] of spots) {
    const y = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 20), hullMat);
    hull.position.y = 0.6; y.add(hull);
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 3.5, 2.2, 4, 1), hullMat);
    bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 1.4);
    bow.position.set(0, 0.6, 12); y.add(bow);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 9), hullMat);
    cab.position.set(0, 2.8, -2); y.add(cab);
    const win = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.0, 8), glassMat);
    win.position.set(0, 3.4, -2); y.add(win);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), deckMat);
    mast.position.set(0, 7, -4); y.add(mast);
    y.position.set(x, 0, z);
    y.rotation.y = Math.random() * Math.PI * 2;
    scene.add(y);
  }
}

// ---------- 看台（起點附近） ----------
{
  const seatTex = canvasTex(128, 64, (g, w, h) => {
    const cols = ['#d23c3c', '#ffffff', '#2456a8', '#ffd75e'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
      g.fillStyle = cols[(x + y) % 4];
      g.fillRect(x * 8, y * 8, 7, 7);
    }
  });
  seatTex.repeat.set(4, 1);
  for (const u of [0.015, 0.975]) {
    const s = sampleAt(u);
    const st = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(26, 5, 10),
      new THREE.MeshLambertMaterial({ color: 0x707a88 }));
    base.position.y = 2.5; st.add(base);
    const seats = new THREE.Mesh(new THREE.PlaneGeometry(26, 7),
      new THREE.MeshLambertMaterial({ map: seatTex }));
    seats.position.set(0, 6.4, 1.2); seats.rotation.x = -0.5;
    st.add(seats);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(28, 0.5, 12),
      new THREE.MeshLambertMaterial({ color: 0xd23c3c }));
    roof.position.y = 10.5; st.add(roof);
    for (const px of [-12, 12]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10.5, 8),
        new THREE.MeshLambertMaterial({ color: 0x4a4f58 }));
      pole.position.set(px, 5.25, 4); st.add(pole);
    }
    st.position.set(s.pos.x - s.side.x * 22, 0, s.pos.z - s.side.z * 22);
    st.rotation.y = Math.atan2(s.tan.x, s.tan.z);
    scene.add(st);
  }
}

// ---------- 樹（賭場廣場一帶點綴） ----------
{
  const spots = [];
  let guard = 0;
  while (spots.length < 40 && guard++ < 3000) {
    const u = Math.random();
    const s = sampleAt(u);
    const sd = Math.random() < 0.5 ? -1 : 1;
    const off = 14 + Math.random() * 26;
    const x = s.pos.x + s.side.x * sd * off;
    const z = s.pos.z + s.side.z * sd * off;
    if (x > -770 && x < -70 && z > 140) continue;
    let ok = true;
    for (let i = 0; i < SAMPLES; i += 32) {
      const t = samples[i];
      const dx = x - t.pos.x, dz = z - t.pos.z;
      if (dx * dx + dz * dz < 13 * 13) { ok = false; break; }
    }
    if (ok) spots.push([x, z]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.8, 8);
  const leafGeo = new THREE.SphereGeometry(2.2, 10, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d43 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  spots.forEach(([x, z], i) => {
    const s = 0.8 + Math.random() * 0.7;
    q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
    p.set(x, 0.9 * s, z); sc.set(s, s, s);
    m.compose(p, q, sc); trunks.setMatrixAt(i, m);
    p.set(x, (1.8 + 1.8) * s, z);
    m.compose(p, q, sc); leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, new THREE.Color().setHSL(0.32 + Math.random() * 0.05, 0.5, 0.28 + Math.random() * 0.1));
  });
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  scene.add(trunks, leaves);
}

// ---------- F1 風格賽車（車頭朝 +z） ----------
function buildCar() {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color: 0xc22026, shininess: 110, specular: 0x999999 });
  const paint2 = new THREE.MeshPhongMaterial({ color: 0xf2f2f2, shininess: 90, specular: 0x777777 });
  const carbon = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x0e0f12 });
  const rimMat = new THREE.MeshPhongMaterial({ color: 0x2a2d33, shininess: 70, specular: 0x666666 });

  // 地板
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 4.6), carbon);
  floor.position.y = 0.18;
  g.add(floor);
  // 單體殼（座艙本體）
  const mono = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 2.6), paint);
  mono.position.set(0, 0.55, -0.3);
  g.add(mono);
  // 車鼻（向前收窄）
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 1.9), paint);
  nose.position.set(0, 0.5, 1.75);
  nose.rotation.x = -0.06;
  g.add(nose);
  // 前翼
  const fwing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.55), carbon);
  fwing.position.set(0, 0.22, 2.75);
  g.add(fwing);
  const fwing2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.3), paint2);
  fwing2.position.set(0, 0.32, 2.7);
  g.add(fwing2);
  for (const sx of [-1, 1]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.62), paint);
    ep.position.set(sx * 1.0, 0.4, 2.75);
    g.add(ep);
  }
  // 側箱
  for (const sx of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.7), paint);
    pod.position.set(sx * 0.82, 0.5, -0.5);
    g.add(pod);
    const inlet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.1), carbon);
    inlet.position.set(sx * 0.82, 0.62, 0.36);
    g.add(inlet);
  }
  // 座艙開口 + 車手頭盔
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 1.1), carbon);
  cockpit.position.set(0, 0.86, -0.45);
  g.add(cockpit);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12),
    new THREE.MeshPhongMaterial({ color: 0xffd75e, shininess: 100 }));
  helmet.position.set(0, 1.0, -0.35);
  g.add(helmet);
  // Halo（座艙保護裝置）
  const haloMat = new THREE.MeshPhongMaterial({ color: 0x1c1e24, shininess: 60 });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 10, 24, Math.PI * 1.55), haloMat);
  halo.position.set(0, 1.08, -0.35);
  halo.rotation.x = Math.PI / 2;
  halo.rotation.z = Math.PI * 0.72;
  g.add(halo);
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), haloMat);
  pylon.position.set(0, 0.95, 0.12);
  pylon.rotation.x = 0.25;
  g.add(pylon);
  // 引擎蓋 + 鯊魚鰭
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.6), paint);
  cover.position.set(0, 0.72, -1.55);
  g.add(cover);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 1.5), paint2);
  fin.position.set(0, 1.15, -1.6);
  g.add(fin);
  // 尾翼
  for (const sx of [-1, 1]) {
    const rwEp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 1.0), carbon);
    rwEp.position.set(sx * 0.55, 1.45, -2.45);
    g.add(rwEp);
  }
  const rwing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.08), paint);
  rwing.position.set(0, 1.55, -2.45);
  rwing.rotation.x = -0.18;
  g.add(rwing);
  const rwing2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 0.06), paint2);
  rwing2.position.set(0, 1.18, -2.42);
  rwing2.rotation.x = -0.18;
  g.add(rwing2);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.5), carbon);
  beam.position.set(0, 0.95, -2.35);
  g.add(beam);
  // 擴散器
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.28, 0.5), carbon);
  diffuser.position.set(0, 0.3, -2.3);
  diffuser.rotation.x = 0.35;
  g.add(diffuser);
  // 雨燈
  const rain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  rain.position.set(0, 1.0, -2.42);
  g.add(rain);

  // 輪胎（外露式，前窄後寬，前輪可轉向）
  const wheels = [], pivots = [];
  const mkWheel = (r, wdt) => {
    const grp = new THREE.Group();
    const tg = new THREE.CylinderGeometry(r, r, wdt, 20);
    tg.rotateZ(Math.PI / 2);
    grp.add(new THREE.Mesh(tg, tireMat));
    const rg = new THREE.CylinderGeometry(r * 0.55, r * 0.55, wdt + 0.02, 14);
    rg.rotateZ(Math.PI / 2);
    grp.add(new THREE.Mesh(rg, rimMat));
    const stripeG = new THREE.CylinderGeometry(r * 0.58, r * 0.58, wdt + 0.04, 14, 1, true);
    stripeG.rotateZ(Math.PI / 2);
    grp.add(new THREE.Mesh(stripeG, new THREE.MeshBasicMaterial({ color: 0xc22026 })));
    return grp;
  };
  for (const [sx, sz, front, r, wdt] of
    [[-1, 1.55, 1, 0.36, 0.42], [1, 1.55, 1, 0.36, 0.42],
     [-1, -1.55, 0, 0.38, 0.5], [1, -1.55, 0, 0.38, 0.5]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.98, r, sz);
    const spin = new THREE.Group();
    spin.add(mkWheel(r, wdt));
    // 懸吊臂
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.08), carbon);
    arm.position.set(-sx * 0.3, 0.15, 0);
    pivot.add(arm);
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
  blob.scale.set(0.85, 1.7, 1);
  blob.position.y = 0.02;
  g.add(blob);

  scene.add(g);
  return { group: g, wheels, pivots };
}
const car = buildCar();

// ---------- 遊戲狀態 ----------
const S = {
  phase: 'overlay',
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
  S.pos.set(s.pos.x + s.side.x * lateral, 0, s.pos.z + s.side.z * lateral);
  S.heading = Math.atan2(s.tan.x, s.tan.z);
  S.speed = 0;
  S.uPrev = u;
  S.passedMid = false;
  syncCarMesh(0);
}
function syncCarMesh(dt) {
  car.group.position.set(S.pos.x, 0.06, S.pos.z);
  car.group.rotation.y = S.heading;
  const spin = S.speed * dt / 0.37;
  for (const w of car.wheels) w.rotation.x += spin;
  for (const p of car.pivots) p.rotation.y = S.steerSm * 0.42;
}
placeOnTrack(0, 0);

// ---------- 輸入：陀螺儀 / 觸控 / 鍵盤 ----------
let gyroSteer = 0, gyroActive = false;
function tiltFromEvent(e) {
  if (e.gamma == null && e.beta == null) return null;
  const so = window.screen && window.screen.orientation;
  const ang = (so && typeof so.angle === 'number') ? so.angle : (window.orientation || 0);
  let t;
  if (ang === 90) t = e.beta;
  else if (ang === -90 || ang === 270) t = -e.beta;
  else t = e.gamma;
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

setInterval(() => {
  if (S.phase === 'race' && !gyroActive && !('ontouchstart' in window && navigator.maxTouchPoints > 0)) return;
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
    filt.type = 'lowpass'; filt.frequency.value = 900;
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
  engOsc.frequency.setTargetAtTime(70 + S.speed * 4.2, t, 0.05);
}
$('btn-sound').addEventListener('click', () => {
  S.muted = !S.muted;
  $('btn-sound').textContent = S.muted ? '🔇' : '🔊';
});
$('btn-reset').addEventListener('click', () => {
  const s = nearestSample(S.pos, true);
  placeOnTrack(samples.indexOf(s) / SAMPLES, 0);
  flashMsg(tr('msg_reset'));
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
  const W = 240, pad = 20;
  const sx = (W - pad * 2) / (mmBounds.maxX - mmBounds.minX);
  const sz = (W - pad * 2) / (mmBounds.maxZ - mmBounds.minZ);
  const sc = Math.min(sx, sz);
  const ox = (W - (mmBounds.maxX - mmBounds.minX) * sc) / 2;
  const oz = (W - (mmBounds.maxZ - mmBounds.minZ) * sc) / 2;
  return [ox + (x - mmBounds.minX) * sc, oz + (z - mmBounds.minZ) * sc];
}
function strokeTrack() {
  mm.strokeStyle = '#c8d2ea'; mm.lineWidth = 5; mm.lineJoin = 'round';
  mm.beginPath();
  samples.forEach((s, i) => {
    const [x, y] = mmXY(s.pos.x, s.pos.z);
    if (i === 0) mm.moveTo(x, y); else mm.lineTo(x, y);
  });
  mm.closePath(); mm.stroke();
  mm.strokeStyle = '#3a3f4a'; mm.lineWidth = 2; mm.stroke();
}
function drawMinimap() {
  mm.clearRect(0, 0, 240, 240);
  strokeTrack();
  const [cx, cy] = mmXY(S.pos.x, S.pos.z);
  mm.fillStyle = '#ff3b3b';
  mm.strokeStyle = '#fff'; mm.lineWidth = 2;
  mm.beginPath(); mm.arc(cx, cy, 6, 0, Math.PI * 2); mm.fill(); mm.stroke();
  const fx = Math.sin(S.heading), fz = Math.cos(S.heading);
  mm.beginPath(); mm.moveTo(cx, cy); mm.lineTo(cx + fx * 11, cy + fz * 11); mm.stroke();
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
  setTimeout(() => {
    $('overlay').classList.add('hide');
    $('hud').classList.add('on');
    startCountdown();
  }, 400);
}

// ---------- 物理更新 ----------
function step(dt) {
  const steerTarget = readSteer();
  S.steerSm += (steerTarget - S.steerSm) * Math.min(1, 12 * dt);

  const throttle = (S.phase === 'race')
    ? (S.autoAccel ? 1 : (keys['ArrowUp'] || keys['KeyW'] ? 1 : 0))
    : 0;
  const brake = S.phase === 'race' && readBrake();
  let acc = throttle * ACCEL - DRAG * S.speed - ROLL;
  if (brake) acc -= BRAKE_F;
  S.speed = Math.max(0, S.speed + acc * dt);

  const turnRate = S.steerSm * 2.6 / (1 + S.speed * 0.055);
  S.heading -= turnRate * dt;

  S.pos.x += Math.sin(S.heading) * S.speed * dt;
  S.pos.z += Math.cos(S.heading) * S.speed * dt;

  const s = nearestSample(S.pos);
  const dx = S.pos.x - s.pos.x, dz = S.pos.z - s.pos.z;
  const lat = dx * s.side.x + dz * s.side.z;
  const fwd = dx * s.tan.x + dz * s.tan.z;
  const lim = ROAD_HALF - CAR_HALF;
  if (Math.abs(lat) > lim) {
    // 只夾擠側向，保留前進分量（否則車會被釘在牆上）
    const cl = clamp(lat, -lim, lim);
    S.pos.x = s.pos.x + s.side.x * cl + s.tan.x * fwd;
    S.pos.z = s.pos.z + s.side.z * cl + s.tan.z * fwd;
    S.speed *= Math.max(0, 1 - 2.2 * dt);
    const tanA = Math.atan2(s.tan.x, s.tan.z);
    let diff = tanA - S.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    S.heading += diff * Math.min(1, 1.6 * dt);
  }

  const u = segIdx / SAMPLES;
  if (S.phase === 'race') {
    if (u > 0.35 && u < 0.65) S.passedMid = true;
    if (S.uPrev > 0.92 && u < 0.08 && S.passedMid) {
      const lt = S.raceTime - S.lapStart;
      if (lt > 5) {
        S.lap++;
        S.lapStart = S.raceTime;
        if (S.best == null || lt < S.best) {
          S.best = lt;
          flashMsg(tr('msg_fastest', fmt(lt)));
        } else {
          flashMsg(tr('msg_lap', fmt(lt)));
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
  camPos.set(S.pos.x - fx * 10.5, 4.6, S.pos.z - fz * 10.5);
  camLook.set(S.pos.x + fx * 7, 1.0, S.pos.z + fz * 7);
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
