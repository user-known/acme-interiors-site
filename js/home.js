/* Acme Interiors — home page: interactive 3D office (Three.js), scroll story, stats counter */
import * as THREE from 'three';


const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ACC = new THREE.Color('#FE7F2D');
const C = { navy:0x233D4D, orange:0xFE7F2D, sky:0x7FB3D5, sun:0xF6C453, sage:0x9CC3A6, clay:0xC96A4B, peach:0xF7C9A6, plum:0x8E7CC3 };

/* ---------- shared kit ---------- */
const std = (c, o={}) => new THREE.MeshStandardMaterial({color:c, roughness:.82, metalness:0, ...o});
const M = {
  white: std(0xffffff), light: std(0xEEECE8), mid: std(0xD4D2CE), dark: std(0x27313A, {roughness:.5}),
  wood: std(0xE6D2B5), plant: std(0x7DAE8A, {flatShading:true}), plant2: std(0x5E9170, {flatShading:true}),
  acc: std(C.orange, {roughness:.6}), navy: std(C.navy), sky: std(C.sky), sun: std(C.sun),
  glass: new THREE.MeshStandardMaterial({color:0xBFD8EA, transparent:true, opacity:.28, roughness:.1, depthWrite:false}),
  glow: new THREE.MeshBasicMaterial({color:0xFFF1D6}),
};
const edgeMat = new THREE.LineBasicMaterial({color:0x13202A, transparent:true, opacity:.34});

function addEdges(mesh, mat=edgeMat, thr=20){ const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, thr), mat); mesh.add(e); return e; }
function box(p, w,h,d, mat, x,y,z, o={}){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z); if(o.ry) m.rotation.y = o.ry;
  m.castShadow = o.cast !== false; m.receiveShadow = true;
  p.add(m); if(o.edges !== false) addEdges(m, o.edgeMat); return m;
}
function cyl(p, rt,rb,h, mat, x,y,z, o={}){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,o.seg||28), mat);
  m.position.set(x,y,z); m.castShadow = o.cast !== false; m.receiveShadow = true;
  p.add(m); if(o.edges !== false) addEdges(m, o.edgeMat, 40); return m;
}
function grp(p, x=0,y=0,z=0, ry=0){ const g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y = ry; p.add(g); return g; }
function kitSet(o={}){
  const s = {white:M.white.clone(), light:M.light.clone(), mid:M.mid.clone(), wood:M.wood.clone(), soft:M.mid.clone(), dark:M.dark, plant:M.plant, plant2:M.plant2, acc:M.acc, glow:M.glow};
  for(const k in o) s[k].color.set(o[k]);
  s._tint = ['white','light','mid','wood','soft'].map(k => ({m:s[k], base:s[k].color.clone()}));
  return s;
}
function chair(p, x,z, ry, s){
  const g = grp(p, x,0,z, ry);
  box(g, .48,.07,.46, s.mid, 0,.46,0); box(g, .48,.44,.06, s.mid, 0,.75,.22);
  cyl(g, .03,.03,.38, s.dark, 0,.24,0, {edges:false, seg:8}); cyl(g, .25,.25,.04, s.dark, 0,.03,0, {edges:false});
}
function desk(p, x,z, ry, s){
  const g = grp(p, x,0,z, ry);
  box(g, 1.38,.04,.7, s.wood, 0,.74,0);
  box(g, .04,.72,.64, s.white, -.66,.36,0); box(g, .04,.72,.64, s.white, .66,.36,0);
  box(g, .56,.34,.03, s.dark, 0,1.03,-.24); box(g, .05,.2,.05, s.dark, 0,.84,-.25, {edges:false});
  box(g, .4,.36,.5, s.light, .4,.2,-.05);
}
function plant(p, x,z, s, scale=1){
  const g = grp(p, x,0,z); g.scale.setScalar(scale);
  cyl(g, .3,.24,.55, s.white, 0,.275,0);
  const f1 = new THREE.Mesh(new THREE.IcosahedronGeometry(.55,0), s.plant); f1.position.set(0,1.0,0); f1.castShadow = true; g.add(f1);
  const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.36,0), s.plant2); f2.position.set(.22,1.4,.1); f2.castShadow = true; g.add(f2);
}
function armchair(p, x,z, ry, s, mat){
  const g = grp(p, x,0,z, ry); const m = mat || s.soft;
  box(g, .86,.4,.8, m, 0,.2,0); box(g, .86,.42,.16, m, 0,.61,.32);
  box(g, .14,.24,.8, m, -.36,.52,0); box(g, .14,.24,.8, m, .36,.52,0);
}
function stool(p, x,z, s, mat){ cyl(p, .2,.2,.06, mat||s.mid, x,.72,z); cyl(p,.025,.025,.7,s.dark,x,.36,z,{edges:false,seg:8}); cyl(p,.18,.18,.03,s.dark,x,.015,z,{edges:false}); }

/* logo texture: loads assets/logo.svg and recolours the wordmark white for the navy reception wall */
function logoTexture(textColor='#ffffff'){
  const cv = document.createElement('canvas'); cv.width = 1205; cv.height = 421;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  fetch('assets/logo.svg').then(r => r.text()).then(src => {
    const svg = src.slice(src.indexOf('<svg')).replace(/rgb\(35,61,77\)/g, textColor).replace('width="100%" height="100%"','width="1205" height="421"');
    const img = new Image();
    img.onload = () => { cv.getContext('2d').drawImage(img, 0, 0, 1205, 421); tex.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }).catch(() => {});
  return tex;
}
const logoTex = logoTexture('#ffffff');
const logoMat = new THREE.MeshBasicMaterial({map:logoTex, transparent:true});

/* ================= MAIN SCENE ================= */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1,1,1,-1,-300,500);
const camDir = new THREE.Vector3(1, 0.86, 1).normalize();
scene.add(new THREE.HemisphereLight(0xffffff, 0xdcd6cc, 1.9));
const sun = new THREE.DirectionalLight(0xfff6ec, 2.2);
sun.position.set(-10, 34, 22); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left:-22, right:22, top:22, bottom:-22, near:1, far:90});
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.ShadowMaterial({opacity:.07}));
ground.rotation.x = -Math.PI/2; ground.position.y = -3.2; ground.receiveShadow = true; scene.add(ground);

const model = new THREE.Group(); scene.add(model);
const L = { floor:grp(model), walls:grp(model), furn:grp(model), ceil:grp(model) };
const W = 24, D = 16, H = 3;

// Floor (navy slab edge for colour)
box(L.floor, W+.6, .4, D+.6, M.navy, 0,-.2,0);
box(L.floor, W+.2, .02, D+.2, M.white, 0,.01,0, {edges:false, cast:false});
{
  const pts = []; const t = .6;
  for(let x=-W/2; x<=W/2+.001; x+=t*2){ pts.push(x,.03,-D/2, x,.03,D/2); }
  for(let z=-D/2; z<=D/2+.001; z+=t*2){ pts.push(-W/2,.03,z, W/2,.03,z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
  L.floor.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0x233D4D, transparent:true, opacity:.08})));
}
box(L.floor, W-1, .1, .14, M.acc, 0,-.47,-2, {edges:false});
box(L.floor, .14, .1, D-1, M.sun, -1,-.47,0, {edges:false});

// Walls
box(L.walls, W, 1, .25, M.white, 0,.5,-D/2);
box(L.walls, W, .4, .25, M.white, 0,H-.2,-D/2);
box(L.walls, W, 1.6, .06, M.glass, 0,1.8,-D/2, {cast:false});
for(let x=-W/2+2; x<W/2; x+=2) box(L.walls, .08,1.6,.27, M.navy, x,1.8,-D/2, {edges:false});
box(L.walls, .25, H, D+.25, M.white, -W/2,H/2,0);
box(L.walls, .04, H-.4, 5.6, std(C.sky), -W/2+.15,(H-.4)/2+.2, 4.6, {edges:false}); // sky feature wall
const meetX = -3, meetZ = -1;
box(L.walls, .06, H-.1, 7, M.glass, meetX,(H-.1)/2,-4.5, {cast:false});
box(L.walls, 6.6, H-.1, .06, M.glass, -8.7,(H-.1)/2,meetZ, {cast:false});
box(L.walls, 1.1, .5, .06, M.glass, -4.55, H-.35, meetZ, {cast:false});
[[meetX,-7.95],[meetX,-1],[-12,meetZ],[-5.1,meetZ],[-4.0,meetZ]].forEach(([x,z])=>box(L.walls,.08,H-.1,.08,M.navy,x,(H-.1)/2,z,{edges:false}));
box(L.walls, .08,.06,7, M.navy, meetX,H-.13,-4.5, {edges:false});
box(L.walls, 8.9,.06,.08, M.navy, -7.5,H-.13,meetZ, {edges:false});
box(L.walls, 6.5,.12,.07, M.acc, -8.5,1.1,meetZ+.02, {edges:false, cast:false}); // manifestation band
box(L.walls, .06,1.35,2.4, M.dark, -11.85,1.55,-4.4);

// Zones
const zones = {};
function zone(key, label, cx, cz, w, d, colors){
  const s = kitSet(colors); const g = grp(L.furn);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshBasicMaterial({color:ACC, transparent:true, opacity:0, depthWrite:false}));
  pad.rotation.x = -Math.PI/2; pad.position.set(cx,.04,cz); L.floor.add(pad);
  zones[key] = {s, g, pad, label, c:new THREE.Vector3(cx,1.4,cz), w:0};
  return {s, g};
}
{ // workstations — navy chairs
  const {s,g} = zone('ws', 'Focus floor · 20 desks', 6, -2.9, 9.8, 8.4, {mid:C.navy});
  [-5.1, -0.9].forEach(cz => {
    for(let i=0;i<5;i++){
      const x = 3.1 + i*1.45;
      desk(g, x, cz+.36, 0, s); chair(g, x, cz+1.05, 0, s);
      desk(g, x, cz-.36, Math.PI, s); chair(g, x, cz-1.05, Math.PI, s);
    }
    box(g, 7.25, .42, .04, s.light, 6, .96, cz);
  });
  s.light.color.set(C.sky); s._tint[1].base.set(C.sky);
  plant(g, 10.8, -7.2, s, .9); plant(g, 1.4, -7.2, s, .8);
}
{ // meeting — orange chairs
  const {s,g} = zone('meet', 'Boardroom · 10 seats', -7.5, -4.5, 8.8, 6.8, {mid:C.orange});
  const cx=-7.4, cz=-4.4;
  box(g, 5.2,.06,1.5, s.wood, cx,.75,cz);
  box(g, .5,.72,.8, s.white, cx-1.6,.36,cz); box(g, .5,.72,.8, s.white, cx+1.6,.36,cz);
  [-1.95,-.65,.65,1.95].forEach(dx => { chair(g, cx+dx, cz+1.15, 0, s); chair(g, cx+dx, cz-1.15, Math.PI, s); });
  chair(g, cx+3.05, cz, Math.PI/2, s); chair(g, cx-3.05, cz, -Math.PI/2, s);
  box(g, .5,.9,2.6, s.light, -3.5,.45,-6.2);
  plant(g, -3.6, -1.6, s, .7);
}
{ // lounge — navy sofa, sun armchairs, peach rug
  const {s,g} = zone('lounge', 'Breakout lounge', 6.6, 5.2, 9, 5.6, {soft:C.navy, light:C.peach, mid:C.sun});
  cyl(g, 2.5,2.5,.03, s.light, 6.6,.015,5.4, {cast:false, seg:48});
  box(g, 3.4,.42,.95, s.soft, 6.4,.21,7.0); box(g, 3.4,.5,.24, s.soft, 6.4,.66,7.4);
  box(g, .95,.42,2.2, s.soft, 4.2,.21,5.4); box(g, .24,.5,2.2, s.soft, 3.85,.66,5.4);
  box(g, .2,.3,.95, s.soft, 8.0,.55,7.0);
  [5.4,6.4,7.4].forEach(x=>box(g,.5,.4,.14,s.mid,x,.62,7.2,{ry:.1}));
  cyl(g, .6,.6,.06, s.wood, 6.6,.4,5.4); cyl(g, .08,.08,.38, s.dark, 6.6,.19,5.4, {edges:false, seg:10});
  armchair(g, 8.8, 5.6, -Math.PI/2, s, s.mid); armchair(g, 8.8, 4.3, -Math.PI/2, s, s.mid);
  cyl(g, .3,.3,.5, s.wood, 8.9,.25,3.1);
  plant(g, 10.6, 7.2, s, 1.1); plant(g, 2.9, 7.3, s, .9); plant(g, 10.6, 3.0, s, .8);
}
{ // reception — navy brand wall with logo
  const {s,g} = zone('rec', 'Reception & arrival', -7.6, 4.5, 8.4, 6.6, {soft:C.orange, light:C.navy});
  const cx=-7.6, cz=3.9, r=1.7, n=9, a0=-1.25, a1=1.25;
  for(let i=0;i<n;i++){
    const a = a0 + (i+.5)*(a1-a0)/n, seg = 2*r*Math.sin((a1-a0)/n/2)+.03;
    box(g, seg,1.02,.3, s.white, cx+r*Math.sin(a),.51,cz+r*Math.cos(a), {ry:a});
    box(g, seg+.02,.05,.46, s.wood, cx+(r-.06)*Math.sin(a),1.05,cz+(r-.06)*Math.cos(a), {ry:a, edges:false});
  }
  chair(g, cx, cz+.6, Math.PI, s);
  box(g, 4.2,2.6,.22, s.light, cx,1.3,1.5);
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(3.3,1.15), logoMat); lp.position.set(cx,1.45,1.62); g.add(lp);
  armchair(g, -10.9, 6.6, Math.PI/2, s); armchair(g, -10.9, 5.3, Math.PI/2, s);
  cyl(g, .3,.3,.45, s.wood, -10.9,.225,4.2);
  plant(g, -11.2, 7.4, s, 1); plant(g, -4.3, 2.0, s, .8);
}

// Ceiling
const ceilMats = [];
{
  const bm = std(0xffffff, {transparent:true}); const em = edgeMat.clone();
  const lm = M.glow.clone(); lm.transparent = true; const dm = M.dark.clone(); dm.transparent = true;
  const om = std(C.sun, {transparent:true});
  ceilMats.push(bm, em, lm, dm, om);
  let i=0;
  for(let z=-D/2+.6; z<D/2; z+=.9) box(L.ceil, W-.4,.32,.08, (i++%5===2)?om:bm, 0,0,z, {edgeMat:em, cast:false});
  box(L.ceil, W, .06, .5, bm, 0,.2,-D/2+.1, {edgeMat:em, cast:false});
  [-5.1,-0.9].forEach(cz => box(L.ceil, 7.4,.06,.14, lm, 6,-.4,cz, {edgeMat:em, cast:false}));
  [[-7.4,-4.4,1.2],[6.6,5.4,.9]].forEach(([x,z,r])=>{
    const t = new THREE.Mesh(new THREE.TorusGeometry(r,.05,8,64), lm); t.rotation.x = Math.PI/2; t.position.set(x,-1.1,z); L.ceil.add(t);
    for(let k=0;k<3;k++){ const a = k*2.094; box(L.ceil,.012,1.1,.012,dm, x+r*Math.cos(a),-.55,z+r*Math.sin(a),{edges:false,cast:false}); }
  });
}
L.ceil.traverse(o => { if(o.isMesh) o.castShadow = false; });

/* labels */
const labelsEl = document.getElementById('labels');
function mkLabel(html, cls=''){ const d = document.createElement('div'); d.className = 'lbl ' + cls; d.innerHTML = html; labelsEl.appendChild(d); return d; }
const layerLabels = [
  {g:L.ceil,  y:0,   el:mkLabel('<b><em>L4</em>Ceiling &amp; lighting</b><s></s><u></u>')},
  {g:L.furn,  y:.9,  el:mkLabel('<b><em>L3</em>Furniture &amp; FF&amp;E</b><s></s><u></u>')},
  {g:L.walls, y:1.6, el:mkLabel('<b><em>L2</em>Partitions &amp; glazing</b><s></s><u></u>')},
  {g:L.floor, y:0,   el:mkLabel('<b><em>L1</em>Floor &amp; services</b><s></s><u></u>')},
];
Object.values(zones).forEach(z => z.el = mkLabel('<u></u><s></s><b>'+z.label+'</b>', 'z'));
const tmpV = new THREE.Vector3();

/* states */
const S = (o) => Object.assign({e:0,c:0,ws:0,meet:0,lounge:0,rec:0,zoom:1,tx:0,ty:0,tz:0,rot:-.35,idle:0,ox:.17,dy:0,my:.14,mzf:1}, o);
const states = [
  S({idle:1, zoom:.84, ox:.25, my:-.2}),
  S({idle:1, zoom:.66, rot:-.9, ox:0, dy:.2, my:.12, mzf:1.55}),
  S({e:1, c:1, zoom:.54, ty:4.6, rot:-.15, ox:.29, my:.02}),
  S({ws:1, zoom:1.75, tx:6, tz:-3, rot:-.05}),
  S({meet:1, zoom:1.95, tx:-7.4, tz:-4.4, rot:.2}),
  S({lounge:1, zoom:1.95, tx:6.6, tz:5.3, rot:-.25}),
  S({rec:1, zoom:1.95, tx:-7.6, tz:4.2, rot:.15}),
  S({zoom:.92, rot:-.75, idle:1, ox:.2}),
];
const keys = Object.keys(states[0]);
const cur = {...states[0]}; const tgt = {...states[0]};

const story = document.querySelector('.story');
const stepEls = [...document.querySelectorAll('.step')];
const numEl = document.getElementById('num'), barEl = document.getElementById('bar');
const smooth = (a,b,x) => { const t = Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
let lastStep = -1;
function onScroll(){
  const r = story.getBoundingClientRect();
  const s = Math.min(states.length-1, Math.max(0, -r.top / innerHeight));
  const i = Math.min(states.length-2, Math.floor(s)), f = smooth(.2,.8, s-i);
  for(const k of keys) tgt[k] = states[i][k] + (states[i+1][k]-states[i][k])*f;
  const active = Math.round(s);
  if(active !== lastStep){
    stepEls.forEach((el,j)=>el.classList.toggle('on', j===active));
    numEl.textContent = String(active+1).padStart(2,'0'); lastStep = active;
    if(active === 1) countUp();
  }
  barEl.style.width = (s/(states.length-1)*100)+'%';
  let curSec = '';
  for(const id of ['services','process','sectors','contact']){ const el = document.getElementById(id); if(el.getBoundingClientRect().top < innerHeight*.5) curSec = id; }
  document.querySelectorAll('.navlinks a').forEach(a => a.classList.toggle('cur', a.dataset.nav === curSec));
}
addEventListener('scroll', onScroll, {passive:true});

/* stats count-up */
let counted = false;
function countUp(){
  if(counted) return; counted = true;
  document.querySelectorAll('.stat strong').forEach(el => {
    const to = parseFloat(el.dataset.to), dec = +(el.dataset.dec||0), b = el.querySelector('b'); const t0 = performance.now();
    (function tick(now){
      const p = Math.min(1, (now-t0)/1600), v = to * (1 - Math.pow(1-p, 3));
      b.textContent = v.toFixed(dec); if(p<1) requestAnimationFrame(tick);
    })(t0);
  });
}

let vw=0, vh=0, mobile=false;
function resize(){
  vw = canvas.clientWidth; vh = canvas.clientHeight; if(!vw) return; mobile = vw < 860;
  renderer.setSize(vw, vh, false);
  const aspect = vw/vh, viewH = mobile ? Math.max(22, 30/aspect) : 21;
  cam.left = -viewH*aspect/2; cam.right = viewH*aspect/2; cam.top = viewH/2; cam.bottom = -viewH/2;
}
addEventListener('resize', resize);
let px=0, py=0, ppx=0, ppy=0;
addEventListener('pointermove', e => { px = e.clientX/innerWidth-.5; py = e.clientY/innerHeight-.5; });

const clock = new THREE.Clock(); const Y = new THREE.Vector3(0,1,0);
function frame(){
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  const k = 1 - Math.exp(-dt*4.2);
  for(const key of keys) cur[key] += (tgt[key]-cur[key])*k;
  ppx += (px-ppx)*k; ppy += (py-ppy)*k;
  const e = cur.e;
  L.floor.position.y = -2.8*e; L.furn.position.y = 5.2*e; L.ceil.position.y = H + .1 + 10.4*e;
  const co = cur.c; L.ceil.visible = co > .01;
  ceilMats.forEach(m => m.opacity = m === ceilMats[1] ? .38*co : .9*co);
  const rot = cur.rot + (reduce ? 0 : cur.idle*Math.sin(t*.25)*.18) + ppx*.12;
  model.rotation.y = rot;
  Object.entries(zones).forEach(([key,z]) => {
    const w = cur[key]; z.w = w;
    z.s._tint.forEach(({m,base}) => m.color.copy(base).lerp(ACC, w*.85));
    z.pad.material.opacity = w*.16;
  });
  const target = new THREE.Vector3(cur.tx, cur.ty, cur.tz).applyAxisAngle(Y, rot);
  target.y += ppy*.6;
  cam.position.copy(target).addScaledVector(camDir, 120); cam.lookAt(target);
  if(mobile) cam.setViewOffset(vw, vh, 0, vh*cur.my, vw, vh); else cam.setViewOffset(vw, vh, -vw*cur.ox, vh*cur.dy, vw, vh);
  cam.zoom = cur.zoom * (mobile ? cur.mzf : 1); cam.updateProjectionMatrix();
  sun.target.position.copy(target); sun.target.updateMatrixWorld();
  renderer.render(scene, cam);
  model.updateMatrixWorld();
  layerLabels.forEach(l => {
    tmpV.set(-W/2-.4, l.y, D/2+.4); l.g.localToWorld(tmpV); tmpV.project(cam);
    l.el.style.left = ((tmpV.x+1)/2*vw - 6)+'px'; l.el.style.top = ((1-tmpV.y)/2*vh)+'px';
    l.el.style.opacity = Math.max(0, (e-.55)/.45) * (l.g === L.ceil ? co : 1);
  });
  Object.values(zones).forEach(z => {
    tmpV.copy(z.c); L.furn.localToWorld(tmpV); tmpV.project(cam);
    z.el.style.left = ((tmpV.x+1)/2*vw)+'px'; z.el.style.top = ((1-tmpV.y)/2*vh - 40)+'px';
    z.el.style.opacity = Math.max(0, (z.w-.6)/.4);
  });
}
resize(); onScroll(); frame();


/* Arriving from another page with a section hash (e.g. index.html#services): jump there once layout is ready */
if(location.hash){
  const target = document.getElementById(location.hash.slice(1));
  if(target) addEventListener('load', () => requestAnimationFrame(() => {
    document.documentElement.style.scrollBehavior = 'auto'; target.scrollIntoView(); document.documentElement.style.scrollBehavior = ''; onScroll();
  }));
}
