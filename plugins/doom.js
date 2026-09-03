let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;box-sizing:border-box">
<div style="position:relative;width:100%;aspect-ratio:16/9;background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<canvas id="game" width="480" height="270" style="position:absolute;inset:0;width:100%;height:100%;display:block;background:#000"></canvas>
<div style="position:absolute;top:8px;left:12px;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div style="font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.65)">NIXEL DOOM</div>
<div style="font-size:14px;font-weight:bold;color:#fff">Mini Doom FPS</div>
</div>
<div style="position:absolute;top:8px;right:12px;text-align:right;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div id="hp" style="font-size:13px;font-weight:bold;color:#fff;transition:transform .15s">HP 100</div>
<div id="ammo" style="font-size:9px;color:rgba(255,255,255,.75);margin-top:1px">AMMO 30 · SCORE 0</div>
</div>
<div id="status" style="position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:9px;color:rgba(255,255,255,.75);pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">5 musuh tersisa</div>
<div style="position:absolute;bottom:6px;left:6px;display:grid;grid-template-columns:repeat(3,26px);gap:4px">
<button id="turnL" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">↶</button>
<button id="forward" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">▲</button>
<button id="turnR" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">↷</button>
</div>
<div style="position:absolute;bottom:6px;right:6px;display:grid;grid-template-columns:repeat(3,26px);gap:4px">
<button id="strafeL" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">◀</button>
<button id="fire" style="width:26px;height:26px;border:1px solid rgba(230,60,60,.5);border-radius:7px;background:rgba(230,60,60,.35);color:#fff;font-size:12px;padding:0">🔥</button>
<button id="strafeR" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">▶</button>
</div>
</div></div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),hpEl=document.getElementById('hp'),ammoEl=document.getElementById('ammo'),statusEl=document.getElementById('status');
x.imageSmoothingEnabled=false;
const W=c.width,H=c.height;
const map=["################","#..............#","#..##....##....#","#..#..........##","#..#..####.....#","#.....#........#","###...#..####..#","#.....#........#","#..####........#","#........####..#","#........#.....#","#..##....#.....#","#..##..........#","#..............#","#..............#","################"];
const player={x:2.5,y:2.5,angle:0,hp:100,ammo:30,score:0,fireCooldown:0,muzzle:0,hurt:0};
let enemies,pickups,particles,ambient,shake,bobT,runT,endT,gameOver,win;
const keys=Object.create(null);
const FOV=Math.PI/3,MOVE=.052,ROT=.055;
let zBuffer=new Float32Array(W);
function initEnemies(){return [{x:11.5,y:2.5,hp:60,max:60,dead:false,flash:0},{x:7.5,y:5.5,hp:60,max:60,dead:false,flash:0},{x:13.5,y:8.5,hp:60,max:60,dead:false,flash:0},{x:5.5,y:10.5,hp:60,max:60,dead:false,flash:0},{x:11.5,y:12.5,hp:60,max:60,dead:false,flash:0}]}
function initPickups(){return [{x:4.5,y:1.5,type:"ammo",taken:false},{x:14.5,y:5.5,type:"health",taken:false},{x:3.5,y:13.5,type:"ammo",taken:false}]}
function reset(){
player.x=2.5;player.y=2.5;player.angle=0;player.hp=100;player.ammo=30;player.score=0;player.fireCooldown=0;player.muzzle=0;player.hurt=0;
enemies=initEnemies();pickups=initPickups();particles=[];
if(!ambient){ambient=[];for(let i=0;i<16;i++)ambient.push({x:Math.random()*W,y:Math.random()*H,r:.6+Math.random()*1.2,vx:.15+Math.random()*.25,ph:Math.random()*10})}
shake=0;bobT=0;runT=0;endT=0;gameOver=false;win=false
}
function burst(px,py,n,col,spd,grav){for(let i=0;i<n;i++)particles.push({x:px,y:py,vx:(Math.random()-.5)*spd,vy:-Math.random()*spd,life:1,col,size:2+Math.random()*2.5,grav:grav||0})}
function isWall(px,py){const mx=Math.floor(px),my=Math.floor(py);if(mx<0||my<0||my>=map.length||mx>=map[0].length)return true;return map[my][mx]==="#"}
function canWalk(px,py){const r=.18;return !isWall(px-r,py-r)&&!isWall(px+r,py-r)&&!isWall(px-r,py+r)&&!isWall(px+r,py+r)}
function move(dx,dy){const nx=player.x+dx,ny=player.y+dy;if(canWalk(nx,player.y))player.x=nx;if(canWalk(player.x,ny))player.y=ny}
function normAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function lineClear(x1,y1,x2,y2){const d=Math.hypot(x2-x1,y2-y1),steps=Math.ceil(d/.08);for(let i=1;i<steps;i++){const t=i/steps,px=x1+(x2-x1)*t,py=y1+(y2-y1)*t;if(isWall(px,py))return false}return true}
function castRay(a){const ca=Math.cos(a),sa=Math.sin(a);let d=0;while(d<30){d+=.025;if(isWall(player.x+ca*d,player.y+sa*d))break}return d}
function screenPos(ex,ey){const dx=ex-player.x,dy=ey-player.y,d=Math.hypot(dx,dy);const a=normAngle(Math.atan2(dy,dx)-player.angle);const sx=W/2+Math.tan(a)*(W/2)/Math.tan(FOV/2);return {sx,d,a}}
function shoot(){
if(player.fireCooldown>0||player.ammo<=0||gameOver||win)return;
player.fireCooldown=13;player.ammo--;player.muzzle=4;
burst(W/2,H-88,7,'255,210,80',3,.1);
let best=null,bestDist=Infinity;
for(const e of enemies){
if(e.dead)continue;
const {sx,d,a}=screenPos(e.x,e.y);
if(d>10)continue;
const tol=.055+.16/d;
if(Math.abs(a)<tol&&d<bestDist&&lineClear(player.x,player.y,e.x,e.y)){best=e;bestDist=d}
}
if(best){
const dmg=25+Math.floor(Math.random()*12);
best.hp-=dmg;best.flash=6;
const {sx,d}=screenPos(best.x,best.y);
const size=Math.min(H*1.8,H/d*.72);
if(best.hp<=0){best.dead=true;player.score+=100;burst(sx,H/2,22,'220,40,40',4.5,.25)}
else{player.score+=10;burst(sx,H/2,10,'220,40,40',3.5,.2)}
}
}
function updateEnemies(){
for(const e of enemies){
if(e.dead)continue;
if(e.flash>0)e.flash--;
const d=dist(player,e);
if(d<1){
player.hp-=.18;player.hurt=6;shake=Math.max(shake,7);
const a=Math.atan2(e.y-player.y,e.x-player.x);
player.x-=Math.cos(a)*.015;player.y-=Math.sin(a)*.015;
continue
}
if(d<7&&lineClear(e.x,e.y,player.x,player.y)){
const a=Math.atan2(player.y-e.y,player.x-e.x),spd=.0085;
const nx=e.x+Math.cos(a)*spd,ny=e.y+Math.sin(a)*spd;
if(canWalk(nx,ny)){e.x=nx;e.y=ny}
if(Math.random()<.006&&d<6){player.hp-=2.5;player.hurt=10;shake=Math.max(shake,5)}
}
}
}
function updatePickups(){
for(const p of pickups){
if(p.taken)continue;
if(Math.hypot(player.x-p.x,player.y-p.y)<.55){
p.taken=true;
if(p.type==="ammo")player.ammo=Math.min(99,player.ammo+15);
if(p.type==="health")player.hp=Math.min(100,player.hp+25)
}
}
}
function update(){
runT++;
if(gameOver||win){endT++;return}
if(player.fireCooldown>0)player.fireCooldown--;
if(player.muzzle>0)player.muzzle--;
if(player.hurt>0)player.hurt--;
if(shake>0)shake=Math.max(0,shake-.6);
if(keys.turnL)player.angle-=ROT;
if(keys.turnR)player.angle+=ROT;
let dx=0,dy=0;
const moving=keys.forward||keys.strafeL||keys.strafeR;
if(moving)bobT++;else bobT+=.15;
if(keys.forward){dx+=Math.cos(player.angle)*MOVE;dy+=Math.sin(player.angle)*MOVE}
if(keys.strafeL){dx+=Math.cos(player.angle-Math.PI/2)*MOVE;dy+=Math.sin(player.angle-Math.PI/2)*MOVE}
if(keys.strafeR){dx+=Math.cos(player.angle+Math.PI/2)*MOVE;dy+=Math.sin(player.angle+Math.PI/2)*MOVE}
move(dx,dy);
updateEnemies();updatePickups();
if(keys.fire)shoot();
particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.life-=.035});
particles=particles.filter(p=>p.life>0);
ambient.forEach(p=>{p.x-=p.vx;if(p.x<-4)p.x=W+4});
if(enemies.filter(e=>!e.dead).length===0)win=true;
if(player.hp<=0)gameOver=true
}
function wallColor(d,side){let l=230-d*18;if(side)l*=.76;l=Math.max(25,Math.min(220,l));return 'rgb('+Math.floor(l)+','+Math.floor(l*.62)+','+Math.floor(l*.48)+')'}
function drawWalls(bob){
const half=H/2+bob,halfFov=FOV/2;
const sky=x.createLinearGradient(0,0,0,half);sky.addColorStop(0,'#12151a');sky.addColorStop(1,'#34302b');
x.fillStyle=sky;x.fillRect(0,0,W,half);
const floor=x.createLinearGradient(0,half,0,H);floor.addColorStop(0,'#4a4540');floor.addColorStop(1,'#111');
x.fillStyle=floor;x.fillRect(0,half,W,H-half);
for(let px=0;px<W;px++){
const a=player.angle-halfFov+(px/W)*FOV;
let raw=castRay(a);
const corrected=raw*Math.cos(a-player.angle);
zBuffer[px]=corrected;
const wallH=Math.min(H*3,H/corrected),top=half-wallH/2;
const cellX=player.x+Math.cos(a)*raw,cellY=player.y+Math.sin(a)*raw;
const wx=cellX-Math.floor(cellX),wy=cellY-Math.floor(cellY);
const side=wx<.035||wx>.965;
x.fillStyle=wallColor(corrected,side);
x.fillRect(px,top,1,wallH)
}
}
function drawEnemySprite(e,bob){
if(e.dead)return;
const {sx,d,a}=screenPos(e.x,e.y);
if(Math.abs(a)>FOV*.7||d<.2)return;
const size=Math.min(H*1.8,H/d*.72);
const left=Math.floor(sx-size*.3),top=Math.floor(H/2+bob-size*.48),bottom=Math.floor(H/2+bob+size*.52);
const zi=Math.max(0,Math.min(W-1,Math.floor(sx)));
if(d>zBuffer[zi]+.25)return;
const hit=e.flash>0;
const wob=Math.sin(runT*.08+e.x*3)*2;
x.fillStyle=hit?'#fff':'#991b1b';
x.fillRect(left+size*.12+wob,top+size*.28,size*.36,size*.48);
x.fillRect(left+size*.16+wob,top,size*.28,size*.22);
if(size>25){
x.fillStyle='#ffd000';
x.fillRect(left+size*.22+wob,top+size*.09,Math.max(2,size*.035),Math.max(2,size*.045));
x.fillRect(left+size*.38+wob,top+size*.09,Math.max(2,size*.035),Math.max(2,size*.045))
}
x.fillStyle=hit?'#fff':'#741414';
x.fillRect(left-size*.03+wob,top+size*.28,size*.15,size*.11);
x.fillRect(left+size*.6-size*.12+wob,top+size*.28,size*.15,size*.11);
x.fillRect(left+size*.13+wob,bottom-size*.23,size*.14,size*.25);
x.fillRect(left+size*.35+wob,bottom-size*.23,size*.14,size*.25);
if(size>35){
const barW=size*.55;
x.fillStyle='#111';x.fillRect(sx-barW/2,top-size*.07,barW,4);
x.fillStyle='#e33';x.fillRect(sx-barW/2,top-size*.07,barW*Math.max(0,e.hp/e.max),4)
}
}
function drawPickup(p,bob){
if(p.taken)return;
const {sx,d,a}=screenPos(p.x,p.y);
if(Math.abs(a)>FOV*.6)return;
const pulse=1+.12*Math.sin(runT*.12+p.x*4);
const size=Math.min(45,H/d*.2)*pulse;
const zi=Math.max(0,Math.min(W-1,Math.floor(sx)));
if(d>zBuffer[zi]+.15)return;
x.save();
x.shadowColor=p.type==='health'?'rgba(33,197,93,.7)':'rgba(246,201,69,.7)';
x.shadowBlur=10;
x.fillStyle=p.type==='health'?'#21c55d':'#f6c945';
x.fillRect(sx-size/2,H/2+bob-size/2,size,size);
x.restore()
}
function drawWeapon(bob){
const cx=W/2,base=H+bob*1.5;
x.fillStyle='#282828';x.fillRect(cx-44,base-64,88,50);
x.fillStyle='#555';x.fillRect(cx-32,base-80,64,24);
if(player.muzzle>0){
x.fillStyle=player.muzzle%2?'#fff':'#ffd43b';
x.beginPath();x.moveTo(cx,base-96);x.lineTo(cx-20,base-68);x.lineTo(cx,base-74);x.lineTo(cx+20,base-68);x.closePath();x.fill()
}
}
function drawAmbient(){ambient.forEach(p=>{const a=.12+Math.sin(runT*.04+p.ph)*.08;x.fillStyle='rgba(200,190,255,'+a+')';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill()})}
function drawParticles(){particles.forEach(p=>{x.fillStyle='rgba('+p.col+','+Math.max(p.life,0)+')';x.fillRect(p.x,p.y,p.size,p.size)})}
function drawCrosshair(){
const cx=W/2,cy=H/2;
x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=2;
x.beginPath();x.moveTo(cx-5,cy);x.lineTo(cx-1,cy);x.moveTo(cx+1,cy);x.lineTo(cx+5,cy);x.moveTo(cx,cy-5);x.lineTo(cx,cy-1);x.moveTo(cx,cy+1);x.lineTo(cx,cy+5);x.stroke()
}
function drawVignette(){
const g=x.createRadialGradient(W/2,H/2,H*.25,W/2,H/2,H*.75);
g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.45)');
x.fillStyle=g;x.fillRect(0,0,W,H)
}
function drawEndScreen(){
if(!gameOver&&!win)return;
const a=Math.min(1,endT*.04);
x.fillStyle='rgba(0,0,0,'+(a*.75)+')';x.fillRect(0,0,W,H);
x.globalAlpha=a;
x.textAlign='center';x.fillStyle=win?'#ffd43b':'#f33';x.font='bold 22px Arial';
x.fillText(win?'LEVEL CLEAR':'YOU DIED',W/2,H/2-10);
x.fillStyle='#fff';x.font='12px Arial';x.fillText('Skor '+player.score+' · Tap untuk ulang',W/2,H/2+14);
x.textAlign='left';x.globalAlpha=1
}
function draw(){
x.clearRect(0,0,W,H);
x.save();
if(shake>0)x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
const bob=Math.sin(bobT*.3)*(keys.forward||keys.strafeL||keys.strafeR?3:.8);
drawWalls(bob);
drawAmbient();
const sprites=[...enemies.filter(e=>!e.dead).map(e=>({t:'e',o:e})),...pickups.filter(p=>!p.taken).map(p=>({t:'p',o:p}))];
sprites.sort((a,b)=>dist(player,b.o)-dist(player,a.o));
for(const s of sprites)s.t==='e'?drawEnemySprite(s.o,bob):drawPickup(s.o,bob);
drawParticles();
drawWeapon(bob);
drawCrosshair();
drawVignette();
if(player.hurt>0){x.fillStyle='rgba(255,0,0,'+(player.hurt/45)+')';x.fillRect(0,0,W,H)}
x.restore();
drawEndScreen();
hpEl.textContent='HP '+Math.max(0,Math.floor(player.hp));
ammoEl.textContent='AMMO '+player.ammo+' · SCORE '+player.score;
statusEl.textContent=win?'Level clear!':gameOver?'Kamu tewas':enemies.filter(e=>!e.dead).length+' musuh tersisa'
}
function loop(){update();draw();requestAnimationFrame(loop)}
function bind(id,key){
const b=document.getElementById(id);
const down=e=>{e.preventDefault();keys[key]=true};
const up=e=>{e.preventDefault();keys[key]=false};
b.addEventListener('touchstart',down,{passive:false});
b.addEventListener('touchend',up,{passive:false});
b.addEventListener('touchcancel',up,{passive:false});
b.addEventListener('mousedown',down);
b.addEventListener('mouseup',up);
b.addEventListener('mouseleave',up)
}
bind('forward','forward');bind('strafeL','strafeL');bind('strafeR','strafeR');bind('turnL','turnL');bind('turnR','turnR');bind('fire','fire');
c.addEventListener('pointerdown',()=>{if(gameOver||win)reset()});
window.addEventListener('keydown',e=>{
const k=e.key.toLowerCase();
if(k==='w')keys.forward=true;
if(k==='a')keys.strafeL=true;
if(k==='d')keys.strafeR=true;
if(k==='arrowleft')keys.turnL=true;
if(k==='arrowright')keys.turnR=true;
if(k===' ')keys.fire=true
});
window.addEventListener('keyup',e=>{
const k=e.key.toLowerCase();
if(k==='w')keys.forward=false;
if(k==='a')keys.strafeL=false;
if(k==='d')keys.strafeR=false;
if(k==='arrowleft')keys.turnL=false;
if(k==='arrowright')keys.turnR=false;
if(k===' ')keys.fire=false
});
reset();
requestAnimationFrame(loop);
</script></body>
`;

const item = {
  __typename: "GenAIaeacdsnwHtmlPrimitive",
  payload: html,
  trusted_sources: ["nixel.dev"]
}

await new AIRich(conn)
.addSection(AIRich.newLayout('Single', item))
.send(m.chat, { bypassDownload: false })
};

handler.help = handler.command = ["doom"];
handler.tags = ['games'];
handler.owner = false;

export default handler;
