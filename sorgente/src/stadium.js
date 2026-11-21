// Lo Stadio Olimpico in 3D: catino, posti, copertura, campo, luci. Nessuna foto: tutto generato.
import * as THREE from 'three';
import { buildLandscape, buildArchitecture, buildTerrain, buildPlaza, measuredRadius, grassTexture } from './environment.js';
import { createGoogleContext, googleKey } from './google3d.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SECTORS, HOSP_BLOCKS, GOOGLE_3D } from './config.js';

// misure in metri. Rettilinei della pista 84,39 m, curve a raggio crescente.
export const G = { L: 84.4, R0: 50, ROWS: 46, RD: 0.86, RISE: 0.43, BASE: 2.6, SP: 0.52, AISLE: 1.3 };
G.DEPTH = G.ROWS * G.RD; G.TOP = G.BASE + G.ROWS * G.RISE;
G.ROOF_IN = G.R0 + 3; G.ROOF_OUT = G.R0 + G.DEPTH + 8; G.ROOF_Y0 = 31; G.ROOF_Y1 = 37;

const mod4 = u => ((u % 4) + 4) % 4;
// punto dell'anello a distanza d dal "centro" della forma, posizione u in [0,4)
function basePoint(d, u, out = new THREE.Vector3()) {
  u = mod4(u); const p = Math.min(3, Math.floor(u)), f = u - p, h = G.L / 2;
  if (p === 0) return out.set(h - f * G.L, 0, -d);                       // Monte Mario (nord -> sud)
  if (p === 1) { const t = f * Math.PI; return out.set(-h - d * Math.sin(t), 0, -d * Math.cos(t)); } // Curva Sud
  if (p === 2) return out.set(-h + f * G.L, 0, d);                        // Tevere (sud -> nord)
  const t = f * Math.PI; return out.set(h + d * Math.sin(t), 0, d * Math.cos(t));                  // Curva Nord
}
const guide = new THREE.Vector3();
export function pt(d,u,out=new THREE.Vector3()){
  basePoint(d,u,out);
  if(d>G.R0){
    basePoint(G.ROOF_OUT,u,guide);
    const factor=measuredRadius(guide.x,guide.z)/guide.length();
    out.multiplyScalar(1+(factor-1)*((d-G.R0)/(G.ROOF_OUT-G.R0)));
  }
  return out;
}
export function inward(u, out = new THREE.Vector3()) {
  u = mod4(u); const p = Math.min(3, Math.floor(u)), t = (u - p) * Math.PI;
  if (p === 0) return out.set(0, 0, 1);
  if (p === 2) return out.set(0, 0, -1);
  if (p === 1) return out.set(Math.sin(t), 0, Math.cos(t));
  return out.set(-Math.sin(t), 0, -Math.cos(t));
}
const dsdu = (d, u) => { const p = Math.min(3, Math.floor(mod4(u))); return (p === 0 || p === 2) ? G.L : Math.PI * d; };
export function arcLen(d, ua, ub) { let s = 0; const n = 80; for (let i = 0; i < n; i++) { const u = ua + (ub - ua) * (i + 0.5) / n; s += dsdu(d, u) * (ub - ua) / n; } return s; }

function hash(n) { n = n >>> 0; n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
// soglia per avere in media una quota "t" di posti occupati con mix = (a+b)/2 (distribuzione triangolare)
const thr = t => t > 0.5 ? 1 - Math.sqrt((1 - t) / 2) : Math.sqrt(t / 2);

// ---------------- posti ----------------
export function buildSeats() {
  const P = [], YAW = [], BLK = [], ROW = [], NUM = [], SEC = [], OCC = [], U = [];
  const blocks = new Map();
  SECTORS.forEach((sec, si) => {
    const [u0, u1] = sec.u, nb = sec.blocks.length, du = (u1 - u0) / nb;
    sec.blocks.forEach((no, bi) => {
      const ua = u0 + bi * du, ub = ua + du, hosp = HOSP_BLOCKS.includes(no);
      const blk = { no, si, sector: sec, ua, ub, uMid: (ua + ub) / 2, rows: [], free: 0, total: 0, hosp };
      const occT = hosp ? 0.55 : sec.occ;
      for (let r = 0; r < G.ROWS; r++) {
        const d = G.R0 + 0.5 + r * G.RD, y = G.BASE + r * G.RISE;
        const n = 120, us = new Float32Array(n + 1), ss = new Float32Array(n + 1);
        for (let i = 0; i <= n; i++) { us[i] = ua + (ub - ua) * i / n; if (i) ss[i] = ss[i - 1] + dsdu(d, (us[i] + us[i - 1]) / 2) * (us[i] - us[i - 1]); }
        const len = ss[n], sp = hosp ? 0.62 : G.SP, cnt = Math.max(0, Math.floor((len - G.AISLE) / sp) + 1), start = (len - (cnt - 1) * sp) / 2;
        const rowIdx = [];
        // posto 1 a sinistra guardando dal campo = u decrescente
        for (let k = cnt - 1; k >= 0; k--) {
          const s = start + k * sp; let j = 1; while (j < n && ss[j] < s) j++;
          const f = (s - ss[j - 1]) / (ss[j] - ss[j - 1] || 1), u = us[j - 1] + (us[j] - us[j - 1]) * f;
          const p = pt(d, u), inn = inward(u), idx = P.length / 3, num = rowIdx.length + 1;
          P.push(p.x, y, p.z); YAW.push(Math.atan2(inn.x, inn.z)); BLK.push(no); ROW.push(r + 1); NUM.push(num); SEC.push(si); U.push(u);
          // chi compra in gruppo: occupazione a grappoli di 3-4 posti
          const a = hash(no * 7919 + r * 131 + Math.floor(num / 3.5) * 977), b = hash(idx * 2654435761);
          const bias = sec.tier === 'E' ? (r < 18 ? 0.04 : -0.02) : (r > 34 ? -0.06 : 0.02);
          const portal = Math.abs(p.x)<2.9 && p.z>0 && r>=12 && r<=23;
          const occ = portal || (a + b) / 2 < thr(Math.min(0.995, occT + bias)) ? 1 : 0;
          OCC.push(occ); rowIdx.push(idx);
          blk.total++; if (!occ) blk.free++;
        }
        blk.rows.push(rowIdx);
      }
      blocks.set(no, blk);
    });
  });
  return { n: P.length / 3, P: new Float32Array(P), YAW: new Float32Array(YAW), BLK: new Int16Array(BLK), ROW: new Int16Array(ROW), NUM: new Int16Array(NUM), SEC: new Uint8Array(SEC), OCC: new Uint8Array(OCC), U: new Float32Array(U), blocks };
}

// ---------------- geometrie dell'anello ----------------
function loopUs(curveN = 72, straightN = 1) {
  const s = [];
  for (let i = 0; i < straightN; i++) s.push(i / straightN);
  for (let i = 0; i < curveN; i++) s.push(1 + i / curveN);
  for (let i = 0; i < straightN; i++) s.push(2 + i / straightN);
  for (let i = 0; i < curveN; i++) s.push(3 + i / curveN);
  s.push(4); return s;
}
function strip(us, dA, yA, dB, yB, pos, idx) {
  const base = pos.length / 3, a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const u of us) { pt(dA, u, a); pt(dB, u, b); pos.push(a.x, yA, a.z, b.x, yB, b.z); }
  for (let i = 0; i < us.length - 1; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
}
function meshFrom(pos, idx, mat) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return new THREE.Mesh(g, mat); }
function shapeAt(d, n = 96) { const sh = new THREE.Shape(), v = new THREE.Vector3(); loopUs(n, 1).forEach((u, i) => { pt(d, u, v); i ? sh.lineTo(v.x, -v.z) : sh.moveTo(v.x, -v.z); }); return sh; }
function ringShape(dIn, dOut) { const sh = shapeAt(dOut); sh.holes.push(new THREE.Path(shapeAt(dIn).getPoints())); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; }

function pitchTexture() {
  const W = 2100, H = 1360, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), m = W / 105;
  for (let i = 0; i < 18; i++) { x.fillStyle = i % 2 ? '#507c39' : '#56843e'; x.fillRect(i * W / 18, 0, W / 18 + 1, H); }
  const g = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7); g.addColorStop(0, 'rgba(255,255,230,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(245,245,240,0.92)'; x.lineWidth = 0.14 * m; const P = v => v * m;
  const o = .5 * x.lineWidth, w = W - 2 * o, h = H - 2 * o; x.strokeRect(o, o, w, h);
  x.beginPath(); x.moveTo(W / 2, o); x.lineTo(W / 2, H - o); x.stroke();
  x.beginPath(); x.arc(W / 2, H / 2, P(9.15), 0, 7); x.stroke();
  x.fillStyle = 'rgba(245,245,240,0.92)'; x.beginPath(); x.arc(W / 2, H / 2, P(0.25), 0, 7); x.fill();
  for (const side of [0, 1]) {
    const sx = side ? W - o : o, dir = side ? -1 : 1;
    x.strokeRect(side ? sx - P(16.5) : sx, H / 2 - P(20.16), P(16.5), P(40.32));
    x.strokeRect(side ? sx - P(5.5) : sx, H / 2 - P(9.16), P(5.5), P(18.32));
    x.beginPath(); x.arc(sx + dir * P(11), H / 2, P(0.25), 0, 7); x.fill();
    x.beginPath(); const a = Math.acos(5.5 / 9.15); side ? x.arc(sx - P(11), H / 2, P(9.15), Math.PI - a, Math.PI + a) : x.arc(sx + P(11), H / 2, P(9.15), -a, a); x.stroke();
    for (const cy of [o, H - o]) { x.beginPath(); x.arc(sx, cy, P(1), 0, 7); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------------- scena ----------------
export function createStadium(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .91;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#bccedc'); scene.fog = new THREE.FogExp2('#bdceda',.00047);
  const gkey = googleKey(GOOGLE_3D);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.18, gkey ? 6000 : 3200);

  let assetsDirty=true;
  THREE.DefaultLoadingManager.onLoad=()=>{assetsDirty=true;renderer.shadowMap.needsUpdate=true;};
  buildLandscape(scene,renderer,opts.lowPower,!gkey);
  // Con la chiave Google il paesaggio arriva dalle Photorealistic 3D Tiles; altrimenti resta quello cartografato incluso.
  let google=null,plaza=null;
  if(gkey){
    plaza=buildPlaza(scene,GOOGLE_3D.flattenMargin-4);
    google=createGoogleContext({scene,camera,renderer,cfg:GOOGLE_3D,key:gkey,low:opts.lowPower,
      dirty:()=>{assetsDirty=true;},
      fail:()=>{google=null;scene.remove(plaza);buildTerrain(scene,opts.lowPower);camera.far=3200;camera.updateProjectionMatrix();assetsDirty=true;renderer.shadowMap.needsUpdate=true;}});
  }

  // pista, prato, campo, porte
  scene.add(new THREE.Mesh(ringShape(G.R0 - 3.8, G.R0 + 0.01), new THREE.MeshLambertMaterial({ color: '#2b2023' })));
  const track = new THREE.Mesh(ringShape(36.5, 46.3), new THREE.MeshStandardMaterial({ color: '#a86455', roughness: .97 })); track.position.y = 0.04; scene.add(track);
  for (let i = 1; i < 8; i++) { const g = new THREE.BufferGeometry().setFromPoints(loopUs(64, 1).map(u => pt(36.5 + i * 1.22, u).setY(0.07))); scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#d8b7a8', transparent: true, opacity: 0.35 }))); }
  const inf = new THREE.Mesh(new THREE.ShapeGeometry(shapeAt(36.5)).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#496c3c' })); inf.position.y = 0.09; scene.add(inf);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 68).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: pitchTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); pitch.position.y = 0.16; pitch.receiveShadow=true; track.receiveShadow=true;
  const turf=grassTexture();
  pitch.material.onBeforeCompile = shader => {
    shader.uniforms.turfDetail={value:turf};
    shader.fragmentShader='uniform sampler2D turfDetail;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb *= .73 + 1.28*texture2D(turfDetail,vMapUv*vec2(14.,9.)).g + .62*texture2D(turfDetail,vMapUv*vec2(3.,2.)).g;');
  };scene.add(pitch);
  {
    const mat = new THREE.MeshStandardMaterial({color:'#e0e3df',roughness:.58}), post = new THREE.BoxGeometry(0.12, 2.44, 0.12), bar = new THREE.BoxGeometry(0.12, 0.12, 7.44);
    for (const sx of [-52.5, 52.5]) { for (const z of [-3.66, 3.66]) { const p = new THREE.Mesh(post, mat); p.position.set(sx, 1.22, z); scene.add(p); } const b = new THREE.Mesh(bar, mat); b.position.set(sx, 2.44, 0); scene.add(b); }
  }

  const net=[];
  for(const side of [-1,1]){
    const front=side*52.5, back=side*54.4;
    for(let i=0;i<=36;i++){const z=-3.66+7.32*i/36;net.push(front,2.49,z,back,2.18,z,back,2.18,z,back,.18,z);}
    for(let j=0;j<=12;j++){const y=.18+2*j/12;net.push(back,y,-3.66,back,y,3.66);
      for(const z of [-3.66,3.66])net.push(front,y,z,back,y,z);}
    for(const z of [-3.66,3.66])for(let i=1;i<=9;i++){const x=front+(back-front)*i/9;net.push(x,.18,z,x,2.49-.31*i/9,z);}
  }
  const netGeo=new THREE.BufferGeometry();netGeo.setAttribute('position',new THREE.Float32BufferAttribute(net,3));scene.add(new THREE.LineSegments(netGeo,new THREE.LineBasicMaterial({color:'#c8d1ca',transparent:true,opacity:.50})));
  for(const x of [-52.5,52.5])for(const z of [-34,34]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1.5,6),new THREE.MeshStandardMaterial({color:'#f3f0df'}));pole.position.set(x,.89,z);scene.add(pole);
    const flag=new THREE.BufferGeometry();flag.setAttribute('position',new THREE.Float32BufferAttribute([x,1.62,z,x+.34,1.52,z+.08,x,1.31,z],3));flag.computeVertexNormals();scene.add(new THREE.Mesh(flag,new THREE.MeshStandardMaterial({color:'#e9a339',side:THREE.DoubleSide})));
  }

  // catino: gradoni in cemento
  {
    const pos = [], idx = [], us = loopUs(96, 40);
    const left=us.filter(u=>u<=2.45),right=us.filter(u=>u>=2.55);
    strip(us, G.R0 - 0.02, 0, G.R0 - 0.02, G.BASE, pos, idx);                                   // muretto davanti alla prima fila
    for (let r = 0; r < G.ROWS; r++) {
      const d0 = G.R0 + r * G.RD, d1 = d0 + G.RD, y = G.BASE + r * G.RISE;
      for(const span of r>=12 && r<=23 ? [left,right] : [us]){strip(span,d0,y,d1,y,pos,idx);strip(span,d1,y,d1,y+G.RISE,pos,idx);}
    }
    strip(us, G.R0 + G.DEPTH, G.TOP, G.R0 + G.DEPTH + 3, G.TOP, pos, idx);                        // passeggiata in cima
    strip(us, G.R0 + G.DEPTH + 3, G.TOP, G.R0 + G.DEPTH + 3, G.TOP + 1.3, pos, idx);
    for(const span of [left,right])strip(span, G.R0 + G.DEPTH + 3.6, 0, G.R0 + G.DEPTH + 3.6, G.TOP + 1.3, pos, idx);               // facciata
    const bowl=meshFrom(pos,idx,new THREE.MeshStandardMaterial({color:'#9b9c96',roughness:.92,side:THREE.DoubleSide}));bowl.receiveShadow=true;bowl.castShadow=true;scene.add(bowl);
  }
  // corridoi: scalinate tra i blocchi, un filo più chiare
  {
    const pos = [], idx = [];
    for (const sec of SECTORS) { const nb = sec.blocks.length, du = (sec.u[1] - sec.u[0]) / nb; for (let b = 0; b <= nb; b++) { const u = sec.u[0] + b * du; for (let r = 0; r < G.ROWS; r++) { const d0 = G.R0 + r * G.RD, y = G.BASE + r * G.RISE + 0.02, ww = 0.55 / (Math.PI * d0 / 1); const half = (Math.floor(mod4(u)) % 2 ? 0.55 / (Math.PI * d0) : 0.55 / G.L); strip([u - half, u + half], d0, y, d0 + G.RD, y, pos, idx); } } }
    scene.add(meshFrom(pos, idx, new THREE.MeshLambertMaterial({ color: '#d6cdbc', side: THREE.DoubleSide })));
  }

  // posti
  const S = buildSeats();
  // Scocca continua, con seduta concava e schienale rastremato.
  const seatPos=[],seatIdx=[];
  const sections=[[.20,.445,.203],[.12,.408,.217],[-.075,.404,.218],[-.16,.447,.213],[-.19,.58,.209],[-.23,.795,.189],[-.231,.825,.166]];
  sections.forEach(([z,y,w],r)=>{
    for(let k=0;k<5;k++){const a=(k-2)/2;seatPos.push(a*w,y+.03*a*a,z+.016*a*a);
      if(r&&k){const n=r*5+k;seatIdx.push(n-6,n,n-1,n-6,n-5,n);}}
  });
  const seatGeo=new THREE.BufferGeometry();seatGeo.setAttribute('position',new THREE.Float32BufferAttribute(seatPos,3));seatGeo.setIndex(seatIdx);seatGeo.computeVertexNormals();
  const seatMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.52,metalness:.025,side:THREE.DoubleSide});
  const seats = new THREE.InstancedMesh(seatGeo, seatMat, S.n);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1),hidden=new THREE.Vector3(0,0,0);
    for (let i = 0; i < S.n; i++) { q.setFromEuler(e.set(0, S.YAW[i], 0)); m.compose(p.set(S.P[i * 3], S.P[i * 3 + 1], S.P[i * 3 + 2]), q, Math.abs(p.x)<2.9 && p.z>0 && S.ROW[i]>=13 && S.ROW[i]<=24 ? hidden : one); seats.setMatrixAt(i, m); }
    seats.instanceMatrix.needsUpdate = true;
  }
  const base = new Float32Array(S.n*3), col=new THREE.Color();
  for(let i=0;i<S.n;i++){
    col.set(HOSP_BLOCKS.includes(S.BLK[i])?'#315174':'#27659a').multiplyScalar(.82+.30*hash(i*91));
    col.toArray(base,i*3);
  }
  seats.receiveShadow=true;
  const cArr = new Float32Array(base); seats.instanceColor = new THREE.InstancedBufferAttribute(cArr, 3); scene.add(seats);

  const {roofGroup,rampEnd,rampRise}=buildArchitecture(scene,G,pt);
  // aree cliccabili: una superficie inclinata per blocco (invisibile)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }), hits = [];
  for (const [no, b] of S.blocks) {
    const pos = [], idx = [], us = []; for (let i = 0; i <= 10; i++) us.push(b.ua + (b.ub - b.ua) * i / 10);
    strip(us, G.R0, G.BASE, G.R0 + G.DEPTH, G.TOP, pos, idx);
    const h = meshFrom(pos, idx, hitMat); h.userData.block = no; hits.push(h); scene.add(h);
  }

  // segnaposto dei posti scelti: fascio di luce oro
  const pinGroup = new THREE.Group(); scene.add(pinGroup);
  const beamGeo = new THREE.CylinderGeometry(0.22, 0.22, 16, 10, 1, true).translate(0, 8, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.45), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 0.6), toneMapped: false });

  // post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.09, 0.32, 1.45); if (!opts.noBloom) composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------------- camera ----------------
  const cam = { pos: new THREE.Vector3(260, 120, 0), tgt: new THREE.Vector3(0, 6, 0), fov: 36, offX: 0, offY: 0, mode: 'orbit', orbitA: 1.48, look: { yaw: 0, pitch: 0 } };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let anim = null;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function flyTo(to, dur = 1.8, arc = 0) {
    if(anim)anim.res();
    const from = { pos: cam.pos.clone(), tgt: cam.tgt.clone(), fov: cam.fov, offX: cam.offX, offY: cam.offY }; to.offY = to.offY || 0;
    const via = arc ? from.pos.clone().lerp(to.pos, 0.5).add(new THREE.Vector3(0, arc, 0)) : null;
    return new Promise(res => { anim = { from, to, via, t0: performance.now(), dur: opts.instant || reduceMotion.matches ? 0.001 : dur * 1000, res }; });
  }
  function size() { assetsDirty=true;const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', size); size();

  // inquadrature
  const views = {
    orbit(a = cam.orbitA) { return { pos: new THREE.Vector3(Math.cos(a) * 380, 148, Math.sin(a) * 390), tgt: new THREE.Vector3(0, 10, 10), fov: 43, offX: 0 }; },
    plan(panelL = 0, panelB = 0) {
      const w = window.innerWidth, h = window.innerHeight - panelB, fov = 34, tv = Math.tan(THREE.MathUtils.degToRad(fov / 2)), aspect = Math.max(0.4, (w - panelL) / h), k = h / window.innerHeight;
      const portrait = aspect < 1, fa = w / window.innerHeight;
      const D = portrait ? Math.max(112 / (tv * fa), 168 / (tv * k)) : Math.max(158 / (tv * aspect), 128 / (tv * k)) * 1.02;
      const dir = portrait ? new THREE.Vector3(0.4, 1, 0).normalize() : new THREE.Vector3(0, 1, 0.4).normalize();
      return { pos: dir.multiplyScalar(D), tgt: new THREE.Vector3(0, 0, 6), fov, offX: -panelL / 2, offY: panelB / 2 };
    },
    block(no, panelR = 0, panelB = 0) {
      const b = S.blocks.get(no), u = b.uMid, dm = G.R0 + G.DEPTH * 0.45, c = pt(dm, u).setY(G.BASE + G.ROWS * G.RISE * 0.45), n = inward(u);
      const width = arcLen(dm, b.ua, b.ub), w = window.innerWidth, h = window.innerHeight, fov = 38, tv = Math.tan(THREE.MathUtils.degToRad(fov / 2)), aspect = Math.max(0.7, (w - panelR) / h);
      const D = THREE.MathUtils.clamp(Math.max((width * 2.4 + 16) / 2 / (tv * aspect), 30 / tv), 62, 125);
      const pos = c.clone().addScaledVector(n, D); pos.y = 27; return { pos, tgt: c.clone().add(new THREE.Vector3(0, -1, 0)), fov, offX: panelR / 2, offY: panelB / 2 };
    },
    seat(i) {
      const p = new THREE.Vector3(S.P[i * 3], S.P[i * 3 + 1], S.P[i * 3 + 2]), n = inward(S.U[i]);
      const eye = p.clone().add(new THREE.Vector3(0, 1.22, 0)).addScaledVector(n, -0.05);
      const tgt = new THREE.Vector3(p.x * 0.16, 0, p.z * 0.06);
      return { pos: eye, tgt, fov: 58, offX: 0 };
    },
  };

  // ---------------- colori e evidenziazioni ----------------
  const state = { hover: null, focusSector: null, focusBlock: null, sel: new Set(), dimOthers: false };
  function paint() {
    const hs = state.hover, fs = state.focusSector, fb = state.focusBlock;
    for (let i = 0; i < S.n; i++) {
      const k = i * 3, si = S.SEC[i], no = S.BLK[i], occ = S.OCC[i];
      let r = base[k], g = base[k + 1], b = base[k + 2];
      if (state.sel.has(i)) { r = 3.2; g = 2.3; b = 0.55; }
      else if (hs !== null && no >= 0 && (hs.type === 'sector' ? si === hs.si : no === hs.no) && !SECTORS[si].away) {
        if (!occ) { r = 2.4; g = 1.7; b = 0.38; } else { r = 0.5 + r * 0.25; g = 0.3 + g * 0.2; b = 0.1 + b * 0.15; }
      } else if (fs !== null && si !== fs && state.dimOthers) { r *= 0.32; g *= 0.3; b *= 0.32; }
      else if (fb !== null && no !== fb && state.dimOthers) { r *= 0.7; g *= 0.68; b *= 0.68; }
      else if (fb !== null && no === fb) { if (!occ) { r = 1.5; g = 1.3; b = 0.9; } else { r = 0.35 + r * 0.5; g = 0.22 + g * 0.4; b = 0.1 + b * 0.35; } }
      cArr[k] = r; cArr[k + 1] = g; cArr[k + 2] = b;
    }
    seats.instanceColor.needsUpdate = true;
  }
  function setPins(list) {
    pinGroup.clear();
    for (const i of list) {
      const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(S.P[i * 3], S.P[i * 3 + 1] + 0.7, S.P[i * 3 + 2]);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), headMat); head.position.set(0, 16, 0); beam.add(head); pinGroup.add(beam);
    }
  }

  // ---------------- picking ----------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickBlock(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(hits, false)[0]; return h ? h.object.userData.block : null;
  }
  function project(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, behind: p.z > 1 }; }

  // ---------------- ciclo ----------------
  const lastVisitMatrix=new THREE.Matrix4();let lastVisitFov=0;
  let last = performance.now(), roofTarget = 0.9, roofOp = 0.9, frameHook = null;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden || document.body.dataset.view==='intro') return;
    if (anim) {
      const t = Math.min(1, (now - anim.t0) / anim.dur), e = ease(t), A = anim.from, B = anim.to;
      if (anim.via) { const p = A.pos.clone().multiplyScalar((1 - e) ** 2).addScaledVector(anim.via, 2 * (1 - e) * e).addScaledVector(B.pos, e * e); cam.pos.copy(p); } else cam.pos.lerpVectors(A.pos, B.pos, e);
      cam.tgt.lerpVectors(A.tgt, B.tgt, e); cam.fov = A.fov + (B.fov - A.fov) * e; cam.offX = A.offX + (B.offX - A.offX) * e; cam.offY = A.offY + (B.offY - A.offY) * e;
      if (t >= 1) { const r = anim.res; anim = null; r(); }
    } else if (cam.mode === 'orbit') {
      if (!reduceMotion.matches) cam.orbitA += dt * 0.035; const v = views.orbit(cam.orbitA); cam.pos.copy(v.pos); cam.tgt.copy(v.tgt);
    }
    camera.position.copy(cam.pos);
    if (cam.mode === 'seat' && !anim) { const dir = cam.tgt.clone().sub(cam.pos); const yaw = Math.atan2(dir.x, dir.z) + cam.look.yaw, len = Math.hypot(dir.x, dir.z), pitch = Math.atan2(dir.y, len) + cam.look.pitch; camera.lookAt(cam.pos.x + Math.sin(yaw) * Math.cos(pitch), cam.pos.y + Math.sin(pitch), cam.pos.z + Math.cos(yaw) * Math.cos(pitch)); }
    else camera.lookAt(cam.tgt);
    if (camera.fov !== cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(cam.offX) > 0.5 || Math.abs(cam.offY) > 0.5) camera.setViewOffset(w, h, cam.offX, cam.offY, w, h); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    roofOp += (roofTarget - roofOp) * Math.min(1, dt * 4); const showRoof=roofOp>.45;
    if(roofGroup.visible!==showRoof){roofGroup.visible=showRoof;renderer.shadowMap.needsUpdate=true;}
    pinGroup.children.forEach((b, k) => { b.material.opacity = 0.4 + 0.2 * Math.sin(now / 300 + k); });
    if(frameHook)frameHook();
    if(google)google.update();
    if(document.body.dataset.view==='visit'){
      camera.updateMatrixWorld();
      if(!assetsDirty && !renderer.shadowMap.needsUpdate && lastVisitFov===camera.fov && lastVisitMatrix.equals(camera.matrixWorld))return;
      lastVisitMatrix.copy(camera.matrixWorld);lastVisitFov=camera.fov;
    }else lastVisitFov=0;
    assetsDirty=false;
    if(document.body.dataset.view==='visit' || opts.noBloom || opts.lowPower)renderer.render(scene,camera);else composer.render();

  }
  requestAnimationFrame(tick);

  return {
    S, G, cam, views, state, camera, rampEnd, rampRise, resize: size, flyTo, paint, setPins, pickBlock, project, pt, inward,
    setRoof(v) { roofTarget = v; },
    setMode(m) { cam.mode = m; if (m === 'seat') { cam.look.yaw = 0; cam.look.pitch = 0; } },
    onFrame(f) { frameHook = f; },
    isAnimating: () => !!anim,
  };
}
