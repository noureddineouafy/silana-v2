let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;box-sizing:border-box">
<div style="position:relative;width:100%;aspect-ratio:16/9;background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<canvas id="game" width="480" height="270" style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"></canvas>
<div style="position:absolute;top:8px;left:12px;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div style="font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.65)">NIXEL ARCADE</div>
<div style="font-size:14px;font-weight:bold;color:#fff">Turbo Dash</div>
</div>
<div style="position:absolute;top:8px;right:12px;text-align:right;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div id="score" style="font-size:15px;font-weight:bold;color:#fff;transition:transform .15s">0</div>
<div id="best" style="font-size:9px;color:rgba(255,255,255,.75);margin-top:1px">BEST 0</div>
</div>
<div id="status" style="position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:9px;color:rgba(255,255,255,.75);pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">دوس وخلي مضغوط باش تعلا كثر، تفادى الصناديق</div>
</div></div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),statusEl=document.getElementById('status');
const W=c.width,H=c.height;
function loadBest(){
let vals=[];
try{let v=localStorage.getItem('turbodash_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let v=sessionStorage.getItem('turbodash_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let mm=document.cookie.match(/(?:^|;\\s*)turbodash_best=(\\d+)/);if(mm)vals.push(parseInt(mm[1],10))}catch(e){}
return vals.length?Math.max(...vals.filter(v=>!isNaN(v))):0
}
function saveBest(v){
let val=String(Math.floor(v));
try{localStorage.setItem('turbodash_best',val)}catch(e){}
try{sessionStorage.setItem('turbodash_best',val)}catch(e){}
try{document.cookie='turbodash_best='+val+';max-age=31536000;path=/'}catch(e){}
try{
let rq=indexedDB.open('turbodash_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{try{rq.result.transaction('kv','readwrite').objectStore('kv').put(val,'turbodash_best')}catch(e){}}
}catch(e){}
}
function loadBestAsync(cb){
try{
let rq=indexedDB.open('turbodash_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{
try{
let gr=rq.result.transaction('kv','readonly').objectStore('kv').get('turbodash_best');
gr.onsuccess=()=>{if(gr.result)cb(parseInt(gr.result,10))}
}catch(e){}
}
}catch(e){}
}
let best=loadBest();
loadBestAsync(v=>{if(!isNaN(v)&&v>best){best=v;bestEl.textContent='BEST '+best}});

const GROUND_Y=H-40,GRAV=.55,JUMP_V=-10.5,HOLD_LIFT=.32,MAX_HOLD=14;
let hero,obstacles,coins,particles,dust,hills,distance,coinCount,gameOver,started,holding,holdT,spawnTimer,coinTimer,runT,shake,flash;

function reset(){
hero={x:90,y:GROUND_Y,vy:0,grounded:true,legPhase:0};
obstacles=[];coins=[];particles=[];dust=[];
distance=0;coinCount=0;gameOver=false;started=false;holding=false;holdT=0;
spawnTimer=60;coinTimer=40;runT=0;shake=0;flash=0;
hills=[];
for(let i=0;i<5;i++)hills.push({x:i*140,h:30+Math.random()*40});
scoreEl.textContent='0';
bestEl.textContent='BEST '+best;
statusEl.textContent='دوس وخلي مضغوط باش تعلا كثر، تفادى الصناديق'
}
function burst(px,py,n,col,spd){for(let i=0;i<n;i++)particles.push({x:px,y:py,vx:(Math.random()-.5)*spd,vy:-Math.random()*spd*.8,life:1,col,size:2+Math.random()*3,grav:.15})}
function speedNow(){return 3.2+Math.min(3.5,distance*.0025)}
function spawnObstacle(){
const h=18+Math.random()*22;
const w=16+Math.random()*14;
obstacles.push({x:W+20,y:GROUND_Y-h,w,h});
}
function spawnCoin(){
const y=GROUND_Y-30-Math.random()*60;
coins.push({x:W+20,y,r:6,taken:false});
}
function drawHills(){
x.fillStyle='rgba(120,90,170,.35)';
hills.forEach(hh=>{
x.beginPath();
x.moveTo(hh.x-70,GROUND_Y);
x.lineTo(hh.x,GROUND_Y-hh.h);
x.lineTo(hh.x+70,GROUND_Y);
x.closePath();x.fill()
})
}
function drawGround(){
x.fillStyle='#2c2440';
x.fillRect(0,GROUND_Y,W,H-GROUND_Y);
x.fillStyle='rgba(255,255,255,.08)';
const off=Math.floor(runT*speedNow())%24;
for(let gx=-off;gx<W;gx+=24)x.fillRect(gx,GROUND_Y,12,4)
}
function drawDust(){
dust.forEach(p=>{
x.fillStyle='rgba(200,200,220,'+(Math.max(p.life,0)*.5)+')';
x.beginPath();x.arc(p.x,p.y,2,0,7);x.fill()
})
}
function drawHero(){
x.save();
x.translate(hero.x,hero.y);
const squash=hero.grounded?1:0.9;
x.fillStyle='#38bdf8';
x.beginPath();x.roundRect(-10,-30*squash,20,30*squash,6);x.fill();
x.fillStyle='#0ea5e9';
x.beginPath();x.arc(0,-32*squash,9,0,7);x.fill();
x.fillStyle='#0c4a6e';
x.fillRect(-6,-34*squash,12,3);
if(hero.grounded){
const lp=Math.sin(hero.legPhase)*4;
x.fillStyle='#0ea5e9';
x.fillRect(-8,0,6,6+lp);
x.fillRect(2,0,6,6-lp)
}else{
x.fillStyle='rgba(255,140,0,'+(.5+Math.random()*.4)+')';
x.beginPath();x.moveTo(-5,4);x.lineTo(0,14+Math.random()*6);x.lineTo(5,4);x.fill()
}
x.restore()
}
function drawObstacle(o){
x.fillStyle='#7c5cff';
x.beginPath();x.roundRect(o.x,o.y,o.w,o.h,3);x.fill();
x.fillStyle='rgba(255,255,255,.18)';
x.fillRect(o.x+2,o.y+2,o.w-4,3)
}
function drawCoin(o){
x.save();
x.translate(o.x,o.y);
const sq=Math.abs(Math.cos(runT*.15+o.x*.05));
x.fillStyle='#ffd93d';
x.beginPath();x.ellipse(0,0,o.r*sq+1,o.r,0,0,7);x.fill();
x.fillStyle='#c99a1e';
x.beginPath();x.ellipse(0,0,(o.r*sq+1)*.4,o.r*.5,0,0,7);x.fill();
x.restore()
}
function drawParticles(){particles.forEach(p=>{x.fillStyle='rgba('+p.col+','+Math.max(p.life,0)+')';x.fillRect(p.x,p.y,p.size,p.size)})}
function draw(){
const g=x.createLinearGradient(0,0,0,H);
g.addColorStop(0,'#1a1030');g.addColorStop(1,'#3b2a5c');
x.fillStyle=g;x.fillRect(0,0,W,H);
drawHills();
x.save();
if(shake>0)x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
drawGround();
drawDust();
coins.forEach(cn=>{if(!cn.taken)drawCoin(cn)});
obstacles.forEach(drawObstacle);
drawHero();
drawParticles();
if(flash>0){x.fillStyle='rgba(255,60,60,'+(flash*.4)+')';x.fillRect(0,0,W,H)}
x.restore();
if(!started&&!gameOver){
x.fillStyle='rgba(255,255,255,.9)';x.textAlign='center';
x.font='bold 13px Arial';x.fillText('دوس باش تبدا',W/2,H/2);
x.textAlign='left'
}
if(gameOver){
x.fillStyle='rgba(15,15,25,.6)';x.fillRect(0,0,W,H);
x.fillStyle='#fff';x.textAlign='center';
x.font='bold 22px Arial';x.fillText('GAME OVER',W/2,H/2-8);
x.font='12px Arial';x.fillText('Skor '+Math.floor(distance/10+coinCount*5)+' · Tap باش تبدا من جديد',W/2,H/2+16);
x.textAlign='left'
}
}
function update(){
runT++;
if(shake>0)shake=Math.max(0,shake-.6);
if(flash>0)flash=Math.max(0,flash-.04);
if(started&&!gameOver){
const sp=speedNow();
distance+=sp;
hills.forEach(hh=>{hh.x-=sp*.3;if(hh.x<-70)hh.x+=700});
hero.vy+=GRAV;
if(holding&&hero.vy<0&&holdT<MAX_HOLD){hero.vy-=HOLD_LIFT;holdT++}
hero.y+=hero.vy;
if(hero.y>=GROUND_Y){hero.y=GROUND_Y;hero.vy=0;hero.grounded=true;hero.legPhase+=.35*sp*.3}
else hero.grounded=false;
if(hero.grounded&&runT%6===0){dust.push({x:hero.x-6,y:GROUND_Y-1,vx:-1-sp*.2,vy:-.3,life:1})}
spawnTimer--;
if(spawnTimer<=0){spawnObstacle();spawnTimer=Math.max(38,70-Math.floor(distance*.03))}
coinTimer--;
if(coinTimer<=0){spawnCoin();coinTimer=Math.max(40,80-Math.floor(distance*.02))}
obstacles.forEach(o=>{o.x-=sp});
obstacles=obstacles.filter(o=>o.x>-40);
coins.forEach(cn=>{cn.x-=sp});
coins=coins.filter(cn=>cn.x>-20&&!cn.taken);
for(const o of obstacles){
const hx=hero.x+8>o.x&&hero.x-8<o.x+o.w;
const hy=hero.y>o.y&&hero.y-30<o.y+o.h;
if(hx&&hy){
gameOver=true;shake=14;flash=1;
burst(hero.x,hero.y-16,22,'56,189,248',5)
}
}
for(const cn of coins){
if(!cn.taken&&Math.hypot(hero.x-cn.x,(hero.y-16)-cn.y)<16){
cn.taken=true;coinCount++;
burst(cn.x,cn.y,10,'255,217,61',4);
scoreEl.style.transform='scale(1.3)';
setTimeout(()=>scoreEl.style.transform='scale(1)',120)
}
}
}
dust.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=.05});
dust=dust.filter(p=>p.life>0);
particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.life-=.025});
particles=particles.filter(p=>p.life>0);
const score=Math.floor(distance/10+coinCount*5);
if(score>best){best=score;saveBest(best)}
scoreEl.textContent=score;
bestEl.textContent='BEST '+best;
statusEl.textContent=gameOver?'خسرتي - Tap باش تعاود':(started?'Coins '+coinCount:'دوس وخلي مضغوط باش تعلا كثر، تفادى الصناديق')
}
function loop(){update();draw();requestAnimationFrame(loop)}
function pointerDown(e){
if(gameOver){reset();return}
e.preventDefault();
if(!started)started=true;
holding=true;holdT=0;
if(hero.grounded){hero.vy=JUMP_V;hero.grounded=false}
}
function pointerUp(e){
holding=false;
if(hero.vy<0)hero.vy*=.45
}
c.addEventListener('touchstart',pointerDown,{passive:false});
c.addEventListener('touchend',pointerUp,{passive:false});
c.addEventListener('mousedown',pointerDown);
c.addEventListener('mouseup',pointerUp);
c.addEventListener('mouseleave',pointerUp);
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

handler.help = handler.command = ["turbodash"];
handler.tags = ['games'];

export default handler;
