let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;box-sizing:border-box">
<div style="position:relative;width:100%;aspect-ratio:16/9;background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<canvas id="game" width="480" height="270" style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"></canvas>
<div style="position:absolute;top:8px;left:12px;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div style="font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.65)">NIXEL ARCADE</div>
<div style="font-size:14px;font-weight:bold;color:#fff">Sky Hop</div>
</div>
<div style="position:absolute;top:8px;right:12px;text-align:right;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div id="score" style="font-size:15px;font-weight:bold;color:#fff;transition:transform .15s">0</div>
<div id="best" style="font-size:9px;color:rgba(255,255,255,.75);margin-top:1px">BEST 0</div>
</div>
<div id="status" style="position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:9px;color:rgba(255,255,255,.75);pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">دوس باش تطير، تفادى الأعمدة</div>
</div></div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),statusEl=document.getElementById('status');
const W=c.width,H=c.height;
function loadBest(){
let vals=[];
try{let v=localStorage.getItem('skyhop_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let v=sessionStorage.getItem('skyhop_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let mm=document.cookie.match(/(?:^|;\\s*)skyhop_best=(\\d+)/);if(mm)vals.push(parseInt(mm[1],10))}catch(e){}
return vals.length?Math.max(...vals.filter(v=>!isNaN(v))):0
}
function saveBest(v){
let val=String(Math.floor(v));
try{localStorage.setItem('skyhop_best',val)}catch(e){}
try{sessionStorage.setItem('skyhop_best',val)}catch(e){}
try{document.cookie='skyhop_best='+val+';max-age=31536000;path=/'}catch(e){}
try{
let rq=indexedDB.open('skyhop_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{try{rq.result.transaction('kv','readwrite').objectStore('kv').put(val,'skyhop_best')}catch(e){}}
}catch(e){}
}
function loadBestAsync(cb){
try{
let rq=indexedDB.open('skyhop_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{
try{
let gr=rq.result.transaction('kv','readonly').objectStore('kv').get('skyhop_best');
gr.onsuccess=()=>{if(gr.result)cb(parseInt(gr.result,10))}
}catch(e){}
}
}catch(e){}
}
let best=loadBest();
loadBestAsync(v=>{if(!isNaN(v)&&v>best){best=v;bestEl.textContent='BEST '+best}});

let bird,pillars,particles,clouds,score,gameOver,started,spawnTimer,runT,shake,flash;
const GRAV=.32,FLAP=-6.4,GAPH=90,PW=34;

function reset(){
bird={x:120,y:H/2,vy:0,rot:0};
pillars=[];particles=[];score=0;gameOver=false;started=false;spawnTimer=0;runT=0;shake=0;flash=0;
clouds=[];
for(let i=0;i<4;i++)clouds.push({x:Math.random()*W,y:20+Math.random()*70,s:.5+Math.random()*.8,sp:.15+Math.random()*.15});
scoreEl.textContent='0';
bestEl.textContent='BEST '+best;
statusEl.textContent='دوس باش تطير، تفادى الأعمدة'
}
function burst(px,py,n,col,spd){for(let i=0;i<n;i++)particles.push({x:px,y:py,vx:(Math.random()-.5)*spd,vy:-Math.random()*spd*.8,life:1,col,size:2+Math.random()*3,grav:.15})}
function spawnPillar(){
const gapY=40+Math.random()*(H-GAPH-80);
pillars.push({x:W+PW,gapY,passed:false});
}
function drawBird(){
x.save();
x.translate(bird.x,bird.y);
x.rotate(bird.rot);
x.fillStyle='#f6c945';
x.beginPath();x.arc(0,0,11,0,7);x.fill();
x.fillStyle='#e6483c';
x.beginPath();x.moveTo(9,-2);x.lineTo(18,0);x.lineTo(9,4);x.fill();
const wingY=Math.sin(runT*.4)*6;
x.fillStyle='#c99a1e';
x.beginPath();x.ellipse(-3,wingY,8,4,.3,0,7);x.fill();
x.fillStyle='#222';
x.beginPath();x.arc(4,-3,1.6,0,7);x.fill();
x.restore()
}
function drawPillar(p){
x.fillStyle='#4f8a2f';
x.fillRect(p.x,0,PW,p.gapY);
x.fillRect(p.x,p.gapY+GAPH,PW,H-(p.gapY+GAPH));
x.fillStyle='#3a6b21';
x.fillRect(p.x,p.gapY-10,PW,10);
x.fillRect(p.x,p.gapY+GAPH,PW,10);
x.fillStyle='rgba(255,255,255,.12)';
x.fillRect(p.x+3,0,4,p.gapY);
x.fillRect(p.x+3,p.gapY+GAPH,4,H-(p.gapY+GAPH))
}
function drawClouds(){
x.fillStyle='rgba(255,255,255,.25)';
clouds.forEach(cl=>{
x.beginPath();
x.ellipse(cl.x,cl.y,18*cl.s,9*cl.s,0,0,7);
x.ellipse(cl.x+14*cl.s,cl.y+3*cl.s,12*cl.s,7*cl.s,0,0,7);
x.fill()
})
}
function drawParticles(){particles.forEach(p=>{x.fillStyle='rgba('+p.col+','+Math.max(p.life,0)+')';x.fillRect(p.x,p.y,p.size,p.size)})}
function draw(){
const g=x.createLinearGradient(0,0,0,H);
g.addColorStop(0,'#1e3a5f');g.addColorStop(1,'#4a7fa8');
x.fillStyle=g;x.fillRect(0,0,W,H);
drawClouds();
x.save();
if(shake>0)x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
pillars.forEach(drawPillar);
drawBird();
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
x.font='12px Arial';x.fillText('Skor '+Math.floor(score)+' · Tap باش تبدا من جديد',W/2,H/2+16);
x.textAlign='left'
}
}
function update(){
runT++;
if(shake>0)shake=Math.max(0,shake-.6);
if(flash>0)flash=Math.max(0,flash-.04);
clouds.forEach(cl=>{cl.x-=cl.sp;if(cl.x<-30)cl.x=W+30});
if(started&&!gameOver){
bird.vy+=GRAV;
bird.y+=bird.vy;
bird.rot=Math.max(-.5,Math.min(1.1,bird.vy*.08));
spawnTimer--;
if(spawnTimer<=0){spawnPillar();spawnTimer=Math.max(70,95-Math.floor(score*1.5))}
const speed=2.1+Math.min(2,score*.03);
pillars.forEach(p=>{
p.x-=speed;
if(!p.passed&&p.x+PW<bird.x){
p.passed=true;score+=1;
if(score>best){best=score;saveBest(best)}
scoreEl.style.transform='scale(1.3)';
setTimeout(()=>scoreEl.style.transform='scale(1)',120)
}
});
pillars=pillars.filter(p=>p.x>-PW);
for(const p of pillars){
const hitX=bird.x+9>p.x&&bird.x-9<p.x+PW;
const hitY=bird.y-9<p.gapY||bird.y+9>p.gapY+GAPH;
if(hitX&&hitY&&!gameOver){
gameOver=true;shake=14;flash=1;
burst(bird.x,bird.y,20,'246,201,69',5)
}
}
if(bird.y>H-6||bird.y<6){
if(!gameOver){gameOver=true;shake=14;flash=1;burst(bird.x,bird.y,20,'246,201,69',5)}
}
}
particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.life-=.025});
particles=particles.filter(p=>p.life>0);
scoreEl.textContent=Math.floor(score);
bestEl.textContent='BEST '+best;
statusEl.textContent=gameOver?'خسرتي - Tap باش تعاود':(started?'Score '+Math.floor(score):'دوس باش تطير، تفادى الأعمدة')
}
function loop(){update();draw();requestAnimationFrame(loop)}
function flap(){
if(gameOver){reset();return}
if(!started)started=true;
bird.vy=FLAP
}
function pointerDown(e){e.preventDefault();flap()}
c.addEventListener('touchstart',pointerDown,{passive:false});
c.addEventListener('mousedown',pointerDown);
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

handler.help = handler.command = ["skyhop"];
handler.tags = ['games'];
export default handler;
