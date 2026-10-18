import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { fileOf } from './data.js';

const loader = new GLTFLoader();
const cache = new Map();
export function loadGLB(url) {
 if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, res, undefined, e => rej(new Error('load ' + url + ': ' + (e.message || e))))));
 return cache.get(url);
}
export const modelURL = c => (c.type === 'Human' ? 'assets/models/humans/' : 'assets/models/pals/') + fileOf(c) + '.glb';
export const loadCard = c => loadGLB(modelURL(c));

/* An animated model instance (Blender NLA clips: idle/walk/attack/hit/ko for Pals; idle/walk/run/cheer/point/ko for humans). */
export class Actor {
 constructor(gltf, { shadow = true } = {}) {
  this.obj = new THREE.Group();
  this.model = skClone(gltf.scene);
  this.obj.add(this.model);
  this.mats = [];
  this.model.traverse(o => {
   if (o.isMesh) {
    o.castShadow = shadow; o.receiveShadow = false;
    o.material = o.material.clone();
    if (o.material.transparent) o.material.depthWrite = false;
    this.mats.push({ m: o.material, e: o.material.emissive.clone(), ei: o.material.emissiveIntensity, op: o.material.opacity, tr: o.material.transparent });
   }
  });
  this.mixer = new THREE.AnimationMixer(this.model);
  this.clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
  this.cur = null; this.curName = ''; this.flashT = 0; this.base = 'idle';
  this.mixer.addEventListener('finished', e => { if (e.action === this.cur && !this.cur._hold) this.play(this.base); });
  const bb = new THREE.Box3().setFromObject(this.model); this.height = bb.max.y - bb.min.y; this.radius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
  this.play('idle');
 }
 has(n) { return !!this.clips[n]; }
 play(name, { once = false, hold = false, fade = 0.18, speed = 1 } = {}) {
  if (!this.clips[name]) return;
  if (this.curName === name && !once) { this.cur.timeScale = speed; return; }
  const a = this.mixer.clipAction(this.clips[name]);
  a.reset(); a.timeScale = speed; a._hold = hold;
  a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
  if (this.cur && this.cur !== a) { a.crossFadeFrom(this.cur, fade, false); }
  a.play(); this.cur = a; this.curName = name;
 }
 setBase(name) { this.base = name; if (!this.cur || this.cur.loop === THREE.LoopRepeat) this.play(name); }
 flash(col = 0xffffff, t = 0.25) { this.flashT = t; this.flashCol = new THREE.Color(col); }
 setOpacity(v) { for (const x of this.mats) { x.m.transparent = v < 1 || x.tr; x.m.opacity = x.op * v; x.m.depthWrite = v >= 1 && !x.tr; } }
 update(dt) {
  this.mixer.update(dt);
  if (this.flashT > 0 || this._flashing) {
   this.flashT -= dt; const k = Math.max(0, this.flashT) * 4;
   for (const x of this.mats) { x.m.emissive.copy(x.e).lerp(this.flashCol, Math.min(0.5, k)); x.m.emissiveIntensity = x.ei + Math.min(1, k) * 0.6; }
   this._flashing = this.flashT > 0;
  }
 }
 dispose() { this.mixer.stopAllAction(); this.obj.removeFromParent(); for (const x of this.mats) x.m.dispose(); }
}

/* Text sprite (names, "!" marks) */
export function textSprite(text, { color = '#fff', bg = 'rgba(0,0,0,.55)', size = 48, scale = 1 } = {}) {
 const c = document.createElement('canvas'); const g = c.getContext('2d');
 g.font = `bold ${size}px system-ui, sans-serif`; const w = Math.ceil(g.measureText(text).width) + size; c.width = w; c.height = size * 1.6;
 g.font = `bold ${size}px system-ui, sans-serif`;
 if (bg) { g.fillStyle = bg; const r = size * 0.5; g.beginPath(); g.roundRect(0, 0, w, c.height, r); g.fill(); }
 g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, c.height / 2 + 2);
 const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
 const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
 s.scale.set(w / c.height * 0.5 * scale, 0.5 * scale, 1); s.renderOrder = 10; return s;
}
