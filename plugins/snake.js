let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;box-sizing:border-box">
<div style="position:relative;width:100%;aspect-ratio:16/9;background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<canvas id="game" width="480" height="270" style="position:absolute;inset:0;width:100%;height:100%;display:block;background:rgba(255,255,255,.03)"></canvas>
<div style="position:absolute;top:8px;left:12px;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div style="font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.65)">NIXEL SNAKE</div>
<div style="font-size:14px;font-weight:bold;color:#fff">Snake</div>
</div>
<div style="position:absolute;top:8px;right:12px;text-align:right;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div id="score" style="font-size:15px;font-weight:bold;color:#fff;transition:transform .15s">000</div>
<div id="best" style="font-size:9px;color:rgba(255,255,255,.75);margin-top:1px">BEST 000</div>
</div>
<div id="status" style="position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:9px;color:rgba(255,255,255,.75);pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">Tap panah untuk mulai</div>
<div style="position:absolute;bottom:6px;right:6px;display:grid;grid-template-columns:repeat(3,26px);gap:3px">
<div></div><button id="up" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">▲</button><div></div>
<button id="left" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">◀</button>
<button id="down" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">▼</button>
<button id="right" style="width:26px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(0,0,0,.4);color:#fff;font-size:12px;padding:0">▶</button>
</div>
</div></div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),statusEl=document.getElementById('status');
const NX=32,NY=18,cell=c.width/NX;
function loadBest(){
let vals=[];
try{let v=localStorage.getItem('snake_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let v=sessionStorage.getItem('snake_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let m=document.cookie.match(/(?:^|;\\s*)snake_best=(\\d+)/);if(m)vals.push(parseInt(m[1],10))}catch(e){}
return vals.length?Math.max(...vals.filter(v=>!isNaN(v))):0
}
function saveBest(v){
let val=String(Math.floor(v));
try{localStorage.setItem('snake_best',val)}catch(e){}
try{sessionStorage.setItem('snake_best',val)}catch(e){}
try{document.cookie='snake_best='+val+';max-age=31536000;path=/'}catch(e){}
try{
let rq=indexedDB.open('snake_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{try{rq.result.transaction('kv','readwrite').objectStore('kv').put(val,'snake_best')}catch(e){}}
}catch(e){}
}
function loadBestAsync(cb){
try{
let rq=indexedDB.open('snake_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{
try{
let gr=rq.result.transaction('kv','readonly').objectStore('kv').get('snake_best');
gr.onsuccess=()=>{if(gr.result)cb(parseInt(gr.result,10))}
}catch(e){}
}
}catch(e){}
}
let best=loadBest();
loadBestAsync(v=>{if(!isNaN(v)&&v>best){best=v;bestEl.textContent='BEST '+String(best).padStart(3,'0')}});
let snake,dir,nextDir,food,particles,score,gameOver,started,tick,speed,shake,runT,foodPulse;
bestEl.textContent='BEST '+String(best).padStart(3,'0');
function reset(){
snake=[{x:8,y:7},{x:7,y:7},{x:6,y:7}];
dir={x:1,y:0};nextDir={x:1,y:0};
food=spawnFood();
particles=[];
score=0;gameOver=false;started=false;tick=0;speed=8;shake=0;runT=0;foodPulse=0;
scoreEl.textContent='000';
statusEl.textContent='Tap panah untuk mulai'
}
function spawnFood(){
let f;
do{f={x:Math.floor(Math.random()*NX),y:Math.floor(Math.random()*NY)}}
while(snake.some(s=>s.x===f.x&&s.y===f.y));
return f
}
function burst(px,py,n,col){for(let i=0;i<n;i++)particles.push({x:px,y:py,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4,life:1,col,size:2+Math.random()*2})}
function setDir(nx,ny){
if(nextDir.x===-nx&&nextDir.y===-ny)return;
nextDir={x:nx,y:ny};
started=true
}
function step(){
dir=nextDir;
const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
if(head.x<0||head.y<0||head.x>=NX||head.y>=NY||snake.some(s=>s.x===head.x&&s.y===head.y)){
gameOver=true;shake=10;
burst(head.x*cell+cell/2,head.y*cell+cell/2,20,'255,80,80');
if(score>best){best=score;saveBest(best)}
return
}
snake.unshift(head);
if(head.x===food.x&&head.y===food.y){
score++;
burst(food.x*cell+cell/2,food.y*cell+cell/2,14,'246,201,69');
scoreEl.style.transform='scale(1.35)';
setTimeout(()=>scoreEl.style.transform='scale(1)',150);
food=spawnFood();
speed=Math.min(18,8+score*.25)
}else{
snake.pop()
}
}
function drawGrid(){
x.strokeStyle='rgba(255,255,255,.05)';
x.lineWidth=1;
for(let i=0;i<=NX;i++){x.beginPath();x.moveTo(i*cell,0);x.lineTo(i*cell,c.height);x.stroke()}
for(let j=0;j<=NY;j++){x.beginPath();x.moveTo(0,j*cell);x.lineTo(c.width,j*cell);x.stroke()}
}
function drawSnake(){
snake.forEach((s,i)=>{
const t=i/Math.max(1,snake.length-1);
const g=Math.floor(197-t*90);
x.fillStyle=i===0?'#4ade80':'rgb('+Math.floor(33+t*20)+','+g+',93)';
x.save();
x.shadowColor='rgba(74,222,128,.4)';
x.shadowBlur=i===0?8:2;
x.fillRect(s.x*cell+1,s.y*cell+1,cell-2,cell-2);
x.restore()
})
}
function drawFood(){
foodPulse+=.12;
const pulse=1+.15*Math.sin(foodPulse);
const size=(cell-4)*pulse;
x.save();
x.shadowColor='rgba(246,201,69,.7)';
x.shadowBlur=10;
x.fillStyle='#f6c945';
x.fillRect(food.x*cell+(cell-size)/2,food.y*cell+(cell-size)/2,size,size);
x.restore()
}
function drawParticles(){
particles.forEach(p=>{x.fillStyle='rgba('+p.col+','+Math.max(p.life,0)+')';x.fillRect(p.x,p.y,p.size,p.size)})
}
function draw(){
x.clearRect(0,0,c.width,c.height);
x.save();
if(shake>0)x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
drawGrid();
drawFood();
drawSnake();
drawParticles();
x.restore();
if(gameOver){
x.fillStyle='rgba(15,15,25,.55)';x.fillRect(0,0,c.width,c.height);
x.fillStyle='#fff';x.textAlign='center';
x.font='bold 20px Arial';x.fillText('GAME OVER',c.width/2,c.height/2-8);
x.font='11px Arial';x.fillText('Skor '+score+' · Tap layar untuk main lagi',c.width/2,c.height/2+14);
x.textAlign='left'
}
}
function loop(t){
runT++;
if(shake>0)shake=Math.max(0,shake-.6);
if(started&&!gameOver){
tick++;
if(tick>=Math.max(4,17-speed)){tick=0;step()}
particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=.03});
particles=particles.filter(p=>p.life>0);
bestEl.textContent='BEST '+String(best).padStart(3,'0');
statusEl.textContent='Speed '+speed.toFixed(1)+'x'
}else if(!started){
particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=.03});
particles=particles.filter(p=>p.life>0)
}
draw();
requestAnimationFrame(loop)
}
function bindDir(id,nx,ny){
const b=document.getElementById(id);
const go=e=>{e.preventDefault();setDir(nx,ny)};
b.addEventListener('touchstart',go,{passive:false});
b.addEventListener('mousedown',go)
}
bindDir('up',0,-1);bindDir('down',0,1);bindDir('left',-1,0);bindDir('right',1,0);
c.addEventListener('pointerdown',()=>{if(gameOver)reset()});
window.addEventListener('keydown',e=>{
const k=e.key.toLowerCase();
if(k==='arrowup'||k==='w')setDir(0,-1);
if(k==='arrowdown'||k==='s')setDir(0,1);
if(k==='arrowleft'||k==='a')setDir(-1,0);
if(k==='arrowright'||k==='d')setDir(1,0)
});
reset();
requestAnimationFrame(loop);
</script></body>`;

const item = {
  __typename: "GenAIaeacdsnwHtmlPrimitive",
  payload: html,
  trusted_sources: ["nixel.dev"]
}

await new AIRich(conn)
.addSection(AIRich.newLayout('Single', item))
.send(m.chat, { bypassDownload: false })
};

handler.help = handler.command = ["snake"];
handler.tags = ['games'];
handler.owner = false;

export default handler;
