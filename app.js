'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = canvas.width, H = canvas.height;
const loading = document.getElementById('loading');
const levelBanner = document.getElementById('levelBanner');
const soundBtn = document.getElementById('soundBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const infoBtn = document.getElementById('infoBtn');
const infoDialog = document.getElementById('infoDialog');

const ASSET_PATHS = {
  title:'assets/title.svg', gameOver:'assets/game-over.svg',
  alien1a:'assets/alien1-a.png', alien1b:'assets/alien1-b.png',
  alien2a:'assets/alien2-a.png', alien2b:'assets/alien2-b.png',
  alien3a:'assets/alien3-a.png', alien3b:'assets/alien3-b.png',
  cannon:'assets/cannon.png', cannonHit:'assets/cannon-hit.png', laser:'assets/laser.png', laserHit:'assets/laser-hit.png',
  mystery:'assets/mystery.png', mysteryHit:'assets/mystery-hit.png',
  enemyShotA:'assets/enemy-shot-a.png', enemyShotB:'assets/enemy-shot-b.png'
};
const SOUND_PATHS = {bassC:'assets/bass-c.mp3',bassD:'assets/bass-d.mp3',pop:'assets/pop.mp3',destroyed:'assets/destroyed.mp3',pew:'assets/pew.mp3',whoop:'assets/whoop.mp3',explosion:'assets/explosion.mp3'};
const images = {};
const sounds = {};
let soundOn = localStorage.getItem('invaders-sound') !== 'off';
let audioUnlocked = false;

function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
async function loadAll(){
  await Promise.all(Object.entries(ASSET_PATHS).map(async ([k,p])=>images[k]=await loadImage(p)));
  for(const [k,p] of Object.entries(SOUND_PATHS)){ const a=new Audio(p); a.preload='auto'; a.volume=(k==='bassC'||k==='bassD')?.42:.72; sounds[k]=a; }
  loading.classList.add('hidden');
  draw();
}
function unlockAudio(){
  if(audioUnlocked) return; audioUnlocked=true;
  const a=sounds.pew; if(a){a.volume=0; a.play().then(()=>{a.pause();a.currentTime=0;a.volume=.72;}).catch(()=>{a.volume=.72;});}
}
function playSound(name){ if(!soundOn||!audioUnlocked||!sounds[name]) return; const a=sounds[name].cloneNode(); a.volume=sounds[name].volume; a.play().catch(()=>{}); }
function updateSoundButton(){ soundBtn.textContent=soundOn?'🔊':'🔇'; soundBtn.setAttribute('aria-pressed',String(soundOn)); }
updateSoundButton();

const state = {
  mode:'menu', score:0, high:Number(localStorage.getItem('maritano-invaders-high')||0), level:1,
  player:{x:240,y:332,w:22,h:14,dead:false},
  aliens:[], playerShot:null, enemyShots:[], shields:[], mystery:null,
  enemyFrame:0, enemyPhase:0, enemyClock:0, animClock:0, animFrame:0,
  enemyFireClock:0, mysteryClock:0, nextMystery:12,
  levelPauseUntil:0, deathUntil:0
};

const keys = {left:false,right:false,fire:false};
let last = performance.now();

function logicalImageSize(img){ return {w:img.naturalWidth/2,h:img.naturalHeight/2}; }
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rects(a,b){return a.x-a.w/2 < b.x+b.w/2 && a.x+a.w/2 > b.x-b.w/2 && a.y-a.h/2 < b.y+b.h/2 && a.y+a.h/2 > b.y-b.h/2;}
function levelParams(){
  const n=state.level-1;
  return {
    stepInterval:Math.max(.20,.95-n*.075),
    fireInterval:Math.max(.38,2.1-n*.14),
    maxShots:Math.min(9,1+Math.floor(n/2)),
    shotSpeed:Math.min(175,92+n*7),
    mysteryMin:Math.max(5,10-n*.35),
    mysteryMax:Math.max(8,15-n*.4)
  };
}

function newGame(){
  unlockAudio(); state.score=0; state.level=1; state.player.dead=false; state.player.x=240; state.mode='level';
  prepareLevel(); showLevelBanner(`LIVELLO ${state.level}`,1200,()=>state.mode='playing');
}
function prepareLevel(){
  state.aliens=[]; state.playerShot=null; state.enemyShots=[]; state.shields=[]; state.mystery=null;
  state.enemyPhase=0; state.enemyClock=0; state.animClock=0; state.animFrame=0; state.enemyFireClock=0; state.mysteryClock=0;
  const p=levelParams(); state.nextMystery=p.mysteryMin+Math.random()*(p.mysteryMax-p.mysteryMin);
  // Formazione esatta del progetto Scratch: 22 + 20 + 20 + 20 + 20 = 102 invasori.
  addRow(1,22,24,20,12); addRow(2,20,24,22,42); addRow(2,20,24,22,72); addRow(3,20,28,22,102); addRow(3,20,28,22,132);
  makeMaritanoShield(); state.player.x=240; state.player.y=332; state.player.dead=false;
}
function addRow(type,count,startX,spacing,y){ for(let i=0;i<count;i++) state.aliens.push({type,x:startX+i*spacing,y,alive:true}); }

// Coordinate dei cloni della barriera ricavate direttamente dal progetto Scratch originale.
const MARITANO_CLONES=[[-200,-140],[-200,-136],[-200,-132],[-200,-128],[-200,-124],[-200,-120],[-200,-116],[-200,-112],[-200,-108],[-196,-108],[-192,-112],[-192,-116],[-188,-120],[-188,-124],[-184,-128],[-184,-132],[-180,-124],[-180,-120],[-176,-116],[-176,-112],[-172,-108],[-168,-108],[-168,-112],[-168,-116],[-168,-120],[-168,-124],[-168,-128],[-168,-132],[-168,-136],[-168,-140],[-140,-140],[-140,-136],[-140,-132],[-136,-128],[-136,-124],[-136,-120],[-132,-116],[-132,-112],[-128,-108],[-124,-112],[-124,-116],[-120,-120],[-120,-124],[-120,-128],[-124,-128],[-128,-128],[-132,-128],[-116,-132],[-116,-132],[-116,-136],[-116,-140],[-80,-140],[-80,-136],[-80,-132],[-80,-128],[-80,-124],[-80,-120],[-80,-116],[-80,-112],[-80,-108],[-76,-108],[-72,-108],[-68,-108],[-64,-108],[-60,-112],[-60,-116],[-60,-120],[-64,-124],[-68,-124],[-72,-124],[-76,-124],[-72,-128],[-68,-132],[-64,-136],[-60,-140],[-20,-140],[-20,-136],[-20,-132],[-20,-128],[-20,-124],[-20,-120],[-20,-116],[-20,-112],[-20,-108],[20,-140],[20,-136],[20,-132],[20,-128],[20,-124],[20,-120],[20,-116],[20,-112],[20,-108],[8,-108],[12,-108],[16,-108],[20,-108],[24,-108],[28,-108],[32,-108],[60,-140],[60,-136],[60,-132],[64,-128],[64,-124],[64,-120],[68,-116],[68,-112],[72,-108],[76,-112],[76,-116],[80,-120],[80,-124],[80,-128],[76,-128],[72,-128],[68,-128],[84,-132],[84,-132],[84,-136],[84,-140],[120,-140],[120,-136],[120,-132],[120,-128],[120,-124],[120,-120],[120,-116],[120,-112],[120,-108],[124,-108],[128,-112],[128,-116],[132,-120],[132,-124],[136,-128],[136,-132],[140,-136],[144,-140],[144,-136],[144,-132],[144,-128],[144,-124],[144,-120],[144,-116],[144,-112],[144,-108],[180,-132],[180,-128],[180,-124],[180,-120],[180,-116],[184,-112],[188,-108],[188,-108],[192,-108],[196,-108],[200,-108],[200,-108],[204,-112],[208,-116],[208,-120],[208,-124],[208,-128],[208,-132],[208,-132],[204,-136],[200,-140],[200,-140],[196,-140],[192,-140],[188,-140],[184,-136],[180,-132]];
function makeMaritanoShield(){
  // Scratch usa coordinate con origine al centro: x + 240, y invertita rispetto al canvas.
  // Ogni clone è un quadratino logico 4×4, come nel costume originale 8×8 a risoluzione 2.
  for(const [sx,sy] of MARITANO_CLONES){
    state.shields.push({x:sx+240,y:180-sy,w:4,h:4,alive:true});
  }
}
function showLevelBanner(text,ms,done){
  levelBanner.textContent=text; levelBanner.classList.add('show');
  setTimeout(()=>{levelBanner.classList.remove('show'); if(done) setTimeout(done,120);},ms);
}
function completeLevel(){
  if(state.mode!=='playing') return; state.mode='level'; state.level++;
  showLevelBanner(`LIVELLO ${state.level}`,1250,()=>{prepareLevel();state.mode='playing';});
}
function endGame(){
  if(state.mode==='gameover'||state.mode==='dying') return; state.player.dead=true; state.mode='dying'; playSound('destroyed');
  state.high=Math.max(state.high,state.score); localStorage.setItem('maritano-invaders-high',String(state.high));
  state.deathUntil=performance.now()+900;
}

function firePlayer(){
  if(state.mode==='menu'){newGame();return;}
  if(state.mode==='gameover'){state.mode='menu';draw();return;}
  if(state.mode!=='playing'||state.playerShot||state.player.dead) return;
  state.playerShot={x:state.player.x,y:state.player.y-13,w:3,h:10,hit:false}; playSound('pew');
}
function fireEnemy(){
  const alive=state.aliens.filter(a=>a.alive); if(!alive.length) return;
  const sample=alive[Math.floor(Math.random()*alive.length)];
  const near=alive.filter(a=>Math.abs(a.x-sample.x)<7).sort((a,b)=>b.y-a.y);
  const a=near[0]||sample; state.enemyShots.push({x:a.x,y:a.y+10,w:4,h:9,frame:Math.random()<.5?0:1}); playSound('pew');
}
function spawnMystery(){
  // Nel progetto Scratch l'astronave misteriosa passa a y=173:
  // nel canvas equivale a y=7, quindi resta sopra la prima fila di invasori.
  state.mystery={x:W+22,y:7,w:32,h:14,hit:false}; playSound('whoop');
}

function update(dt,now){
  if(state.mode==='dying'){ if(now>=state.deathUntil){state.mode='gameover';} return; }
  if(state.mode!=='playing') return;
  const p=levelParams();
  const speed=150;
  if(keys.left) state.player.x-=speed*dt;
  if(keys.right) state.player.x+=speed*dt;
  state.player.x=clamp(state.player.x,13,W-13);

  state.animClock+=dt; if(state.animClock>=.5){state.animClock-=.5;state.animFrame^=1;}
  state.enemyClock+=dt;
  while(state.enemyClock>=p.stepInterval){
    state.enemyClock-=p.stepInterval;
    const phase=state.enemyPhase%10;
    if(phase<4) for(const a of state.aliens) if(a.alive) a.x+=4;
    else if(phase===4) for(const a of state.aliens) if(a.alive) a.y+=12;
    else if(phase<9) for(const a of state.aliens) if(a.alive) a.x-=4;
    else for(const a of state.aliens) if(a.alive) a.y+=12;
    state.enemyPhase=(state.enemyPhase+1)%10;
    playSound(state.enemyPhase%2?'bassC':'bassD');
  }

  state.enemyFireClock+=dt;
  if(state.enemyFireClock>=p.fireInterval){state.enemyFireClock=0;if(state.enemyShots.length<p.maxShots)fireEnemy();}

  state.mysteryClock+=dt;
  if(!state.mystery && state.mysteryClock>=state.nextMystery){state.mysteryClock=0;state.nextMystery=p.mysteryMin+Math.random()*(p.mysteryMax-p.mysteryMin);spawnMystery();}
  if(state.mystery){state.mystery.x-=62*dt;if(state.mystery.x<-30)state.mystery=null;}

  if(state.playerShot){
    state.playerShot.y-=260*dt;
    if(state.playerShot.y<-10){state.playerShot=null;}
    else{
      for(const s of state.shields){if(s.alive&&rects(state.playerShot,s)){s.alive=false;state.playerShot=null;break;}}
      if(state.playerShot){
        for(const a of state.aliens){
          if(!a.alive)continue; const sz=alienSize(a.type); const ar={x:a.x,y:a.y,w:sz.w,h:sz.h};
          if(rects(state.playerShot,ar)){a.alive=false;state.score+=a.type===1?30:a.type===2?20:10;state.playerShot=null;playSound('pop');break;}
        }
      }
      if(state.playerShot&&state.mystery&&rects(state.playerShot,state.mystery)){
        state.score+=100+Math.floor(Math.random()*201); state.mystery.hit=true; playSound('explosion'); const m=state.mystery; state.playerShot=null; setTimeout(()=>{if(state.mystery===m)state.mystery=null;},160);
      }
    }
  }

  for(const b of state.enemyShots){
    b.y+=p.shotSpeed*dt;
    for(const s of state.shields){if(s.alive&&rects(b,s)){s.alive=false;b.dead=true;break;}}
    if(!b.dead&&rects(b,state.player)){b.dead=true;endGame();}
    if(b.y>H+12)b.dead=true;
  }
  state.enemyShots=state.enemyShots.filter(b=>!b.dead);

  for(const a of state.aliens){
    if(a.alive && a.y>state.player.y-18){endGame();break;}
    if(a.alive){const sz=alienSize(a.type);for(const s of state.shields){if(s.alive&&Math.abs(a.x-s.x)<sz.w/2+2&&Math.abs(a.y-s.y)<sz.h/2+2)s.alive=false;}}
  }
  if(state.mode==='playing'&&!state.aliens.some(a=>a.alive)) completeLevel();
  if(state.score>state.high){state.high=state.score;localStorage.setItem('maritano-invaders-high',String(state.high));}
}

function alienSize(type){const img=images[`alien${type}a`];return logicalImageSize(img);}
function drawSprite(img,x,y,scale=.5){ctx.drawImage(img,Math.round(x-img.naturalWidth*scale/2),Math.round(y-img.naturalHeight*scale/2),img.naturalWidth*scale,img.naturalHeight*scale);}
function drawRotatedSprite(img,x,y,angle=Math.PI/2,scale=.5){
  ctx.save();
  ctx.translate(Math.round(x),Math.round(y));
  ctx.rotate(angle);
  ctx.drawImage(img,-img.naturalWidth*scale/2,-img.naturalHeight*scale/2,img.naturalWidth*scale,img.naturalHeight*scale);
  ctx.restore();
}
function drawHud(){
  ctx.save();ctx.fillStyle='#fff';ctx.font='12px "Courier New",monospace';ctx.textBaseline='top';
  ctx.fillText(`SCORE ${String(state.score).padStart(5,'0')}`,8,5);
  const center=`LIVELLO ${state.level}`;ctx.fillText(center,(W-ctx.measureText(center).width)/2,5);
  const hi=`RECORD ${String(state.high).padStart(5,'0')}`;ctx.fillText(hi,W-8-ctx.measureText(hi).width,5);ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  if(state.mode==='menu'){
    if(images.title)ctx.drawImage(images.title,0,0,W,H);
    ctx.save();ctx.fillStyle='#aaa';ctx.font='10px "Courier New",monospace';ctx.textAlign='center';ctx.fillText(`RECORD ${String(state.high).padStart(5,'0')}`,W/2,348);ctx.restore();return;
  }
  if(state.mode==='gameover'){
    if(images.gameOver)ctx.drawImage(images.gameOver,0,0,W,H);
    ctx.save();ctx.textAlign='center';ctx.font='13px "Courier New",monospace';ctx.fillStyle='#fff';ctx.fillText(`SCORE ${state.score}   RECORD ${state.high}`,W/2,266);ctx.fillStyle='#aaa';ctx.font='10px "Courier New",monospace';ctx.fillText('SPAZIO / TOCCA PER TORNARE',W/2,300);ctx.restore();return;
  }
  drawHud();
  for(const s of state.shields) if(s.alive){ctx.fillStyle='#fff';ctx.fillRect(Math.round(s.x-s.w/2),Math.round(s.y-s.h/2),s.w,s.h);}
  for(const a of state.aliens) if(a.alive){const img=images[`alien${a.type}${state.animFrame?'b':'a'}`];drawSprite(img,a.x,a.y,.5);}
  if(state.mystery){drawSprite(images[state.mystery.hit?'mysteryHit':'mystery'],state.mystery.x,state.mystery.y,.5);}
  // I costumi originali sono bitmap orizzontali; in Scratch vengono ruotati
  // dalla direzione dello sprite. Sul canvas replichiamo la stessa rotazione di 90°.
  for(const b of state.enemyShots){drawRotatedSprite(images[b.frame?'enemyShotB':'enemyShotA'],b.x,b.y,Math.PI/2,.5);}
  if(state.playerShot){drawRotatedSprite(images.laser,state.playerShot.x,state.playerShot.y,Math.PI/2,.5);}
  if(state.player.dead){drawSprite(images.cannonHit,state.player.x,state.player.y,.5);} else drawSprite(images.cannon,state.player.x,state.player.y,.5);
}

function loop(now){const dt=Math.min(.04,(now-last)/1000);last=now;update(dt,now);draw();requestAnimationFrame(loop);} requestAnimationFrame(loop);

function setKey(code,on){if(code==='ArrowLeft'||code==='KeyA')keys.left=on;if(code==='ArrowRight'||code==='KeyD')keys.right=on;if(code==='Space'&&on)firePlayer();}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space','Enter'].includes(e.code))e.preventDefault();unlockAudio();if(e.code==='Enter'&&state.mode==='menu')newGame();else if(e.code==='Enter'&&state.mode==='gameover'){state.mode='menu';}setKey(e.code,true);},{passive:false});
window.addEventListener('keyup',e=>setKey(e.code,false));
canvas.addEventListener('pointerdown',()=>{unlockAudio();if(state.mode==='menu')newGame();else if(state.mode==='gameover')state.mode='menu';else firePlayer();});

function bindHold(id,key){const el=document.getElementById(id);const down=e=>{e.preventDefault();unlockAudio();keys[key]=true;el.classList.add('active');};const up=e=>{e.preventDefault();keys[key]=false;el.classList.remove('active');};el.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(n=>el.addEventListener(n,up));}
bindHold('leftBtn','left');bindHold('rightBtn','right');
document.getElementById('fireBtn').addEventListener('pointerdown',e=>{e.preventDefault();unlockAudio();e.currentTarget.classList.add('active');firePlayer();});
document.getElementById('fireBtn').addEventListener('pointerup',e=>e.currentTarget.classList.remove('active'));

soundBtn.addEventListener('click',()=>{unlockAudio();soundOn=!soundOn;localStorage.setItem('invaders-sound',soundOn?'on':'off');updateSoundButton();});
infoBtn.addEventListener('click',()=>infoDialog.showModal());
fullscreenBtn.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{}});

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
loadAll().catch(err=>{console.error(err);loading.textContent='ERRORE NEL CARICAMENTO';});
