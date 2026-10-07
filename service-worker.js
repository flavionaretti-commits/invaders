const CACHE='maritano-invaders-v1.0.1';
const ASSETS=[
  './','./index.html','./style.css','./app.js','./manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png',
  './assets/title.svg','./assets/game-over.svg',
  './assets/alien1-a.png','./assets/alien1-b.png','./assets/alien2-a.png','./assets/alien2-b.png','./assets/alien3-a.png','./assets/alien3-b.png',
  './assets/cannon.png','./assets/cannon-hit.png','./assets/laser.png','./assets/laser-hit.png','./assets/mystery.png','./assets/mystery-hit.png',
  './assets/enemy-shot-a.png','./assets/enemy-shot-b.png',
  './assets/bass-c.mp3','./assets/bass-d.mp3','./assets/pop.mp3','./assets/destroyed.mp3','./assets/pew.mp3','./assets/whoop.mp3','./assets/explosion.mp3'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match('./index.html'))));
});
