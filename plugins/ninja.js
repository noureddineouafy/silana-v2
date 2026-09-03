let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;box-sizing:border-box">
<div style="position:relative;width:100%;aspect-ratio:16/9;background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<canvas id="game" width="480" height="270" style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"></canvas>
<div style="position:absolute;top:8px;left:12px;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div style="font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.65)">NIXEL NINJA</div>
<div style="font-size:14px;font-weight:bold;color:#fff">Fruit Slice</div>
</div>
<div style="position:absolute;top:8px;right:12px;text-align:right;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div id="score" style="font-size:15px;font-weight:bold;color:#fff;transition:transform .15s">0</div>
<div id="best" style="font-size:9px;color:rgba(255,255,255,.75);margin-top:1px">BEST 0</div>
</div>
<div id="status" style="position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:9px;color:rgba(255,255,255,.75);pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">3 ❤️ · قطع الفواكه، تجنب البومب</div>
</div></div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),statusEl=document.getElementById('status');
const W=c.width,H=c.height;
function loadBest(){
let vals=[];
try{let v=localStorage.getItem('ninja_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let v=sessionStorage.getItem('ninja_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let mm=document.cookie.match(/(?:^|;\\s*)ninja_best=(\\d+)/);if(mm)vals.push(parseInt(mm[1],10))}catch(e){}
return vals.length?Math.max(...vals.filter(v=>!isNaN(v))):0
}
function saveBest(v){
let val=String(Math.floor(v));
try{localStorage.setItem('ninja_best',val)}catch(e){}
try{sessionStorage.setItem('ninja_best',val)}catch(e){}
try{document.cookie='ninja_best='+val+';max-age=31536000;path=/'}catch(e){}
try{
let rq=indexedDB.open('ninja_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{try{rq.result.transaction('kv','readwrite').objectStore('kv').put(val,'ninja_best')}catch(e){}}
}catch(e){}
}
function loadBestAsync(cb){
try{
let rq=indexedDB.open('ninja_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{
try{
let gr=rq.result.transaction('kv','readonly').objectStore('kv').get('ninja_best');
gr.onsuccess=()=>{if(gr.result)cb(parseInt(gr.result,10))}
}catch(e){}
}
}catch(e){}
}
let best=loadBest();
loadBestAsync(v=>{if(!isNaN(v)&&v>best){best=v;bestEl.textContent='BEST '+best}});
const FRUITS=[{col:'#e6483c',col2:'#a8291f',name:'apple'},{col:'#f6c945',col2:'#c99a1e',name:'lemon'},{col:'#7ec850',col2:'#4f8a2f',name:'lime'},{col:'#f28c28',col2:'#c96a12',name:'orange'},{col:'#c04cf2',col2:'#7e2ba3',name:'grape'},{col:'#f9c9d4',col2:'#e0728f',name:'melon'}];
let objects,particles,slices,trail,score,lives,gameOver,spawnTimer,runT,shake,flash,combo,comboT,started;
function reset(){
objects=[];particles=[];slices=[];trail=[];
score=0;lives=3;gameOver=false;spawnTimer=0;runT=0;shake=0;flash=0;combo=0;comboT=0;started=false;
scoreEl.textContent='0';
bestEl.textContent='BEST '+best;
statusEl.textContent='3 ❤️ · Swipe باش تقطع، تجنب البومب'
}
function burst(px,py,n,col,spd){for(let i=0;i<n;i++)particles.push({x:px,y:py,vx:(Math.random()-.5)*spd,vy:-Math.random()*spd*.8,life:1,col,size:2+Math.random()*3,grav:.15})}
function spawnObject(){
const isBomb=Math.random()<.14;
const fromLeft=Math.random()<.5;
const startX=fromLeft?30+Math.random()*80:W-30-Math.random()*80;
const vx=(fromLeft?1:-1)*(.6+Math.random()*1.2);
const vy=-(6.5+Math.random()*2.2);
const f=FRUITS[Math.floor(Math.random()*FRUITS.length)];
objects.push({x:startX,y:H+20,vx,vy,r:isBomb?16:20,bomb:isBomb,sliced:false,rot:Math.random()*7,vr:(Math.random()-.5)*.15,fruit:f,fallT:0});
}
function hitTest(o,x1,y1,x2,y2){
const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
if(len<1)return Math.hypot(o.x-x1,o.y-y1)<o.r+8;
const t=Math.max(0,Math.min(1,((o.x-x1)*dx+(o.y-y1)*dy)/(len*len)));
const px=x1+dx*t,py=y1+dy*t;
return Math.hypot(o.x-px,o.y-py)<o.r+8;
}
function sliceCheck(){
if(trail.length<2)return;
const [x2,y2]=trail[trail.length-1],[x1,y1]=trail[trail.length-2];
for(const o of objects){
if(o.sliced)continue;
if(hitTest(o,x1,y1,x2,y2)){
o.sliced=true;o.sliceAngle=Math.atan2(y2-y1,x2-x1);
if(o.bomb){
lives=0;gameOver=true;shake=16;flash=1;
burst(o.x,o.y,26,'80,80,80',6);
}else{
comboT=18;combo++;
const gain=10*Math.min(combo,5);
score+=gain;
if(score>best){best=score;saveBest(best)}
burst(o.x,o.y,16,hexToRgb(o.fruit.col),5);
scoreEl.style.transform='scale(1.3)';
setTimeout(()=>scoreEl.style.transform='scale(1)',120)
}
}
}
}
function hexToRgb(hex){
const v=parseInt(hex.slice(1),16);
return ((v>>16)&255)+','+((v>>8)&255)+','+(v&255)
}
function missCheck(){
for(const o of objects){
if(!o.sliced&&!o.bomb&&o.y>H+60&&o.vy>0){
o.missed=true;
lives--;shake=Math.max(shake,6);
if(lives<=0)gameOver=true
}
}
}
function drawFruit(o){
x.save();
x.translate(o.x,o.y);
x.rotate(o.rot);
if(o.sliced){
x.translate(-6,0);x.rotate(-.15);
x.fillStyle=o.fruit.col;x.beginPath();x.arc(0,0,o.r,Math.PI*.5,Math.PI*1.5);x.fill();
x.restore();x.save();x.translate(o.x,o.y);x.rotate(o.rot);
x.translate(6,0);x.rotate(.15);
x.fillStyle=o.fruit.col2;x.beginPath();x.arc(0,0,o.r,-Math.PI*.5,Math.PI*.5);x.fill();
}else{
x.fillStyle=o.fruit.col;
x.beginPath();x.arc(0,0,o.r,0,7);x.fill();
x.fillStyle='rgba(255,255,255,.35)';
x.beginPath();x.arc(-o.r*.3,-o.r*.3,o.r*.28,0,7);x.fill()
}
x.restore()
}
function drawBomb(o){
x.save();
x.translate(o.x,o.y);
x.rotate(o.rot);
x.fillStyle='#222';
x.beginPath();x.arc(0,0,o.r,0,7);x.fill();
x.strokeStyle='rgba(255,255,255,.15)';x.lineWidth=1;x.stroke();
x.fillStyle='#666';x.fillRect(-2,-o.r-6,4,6);
if(Math.floor(runT/6)%2===0){x.fillStyle='#ffb703';x.beginPath();x.arc(0,-o.r-8,3,0,7);x.fill()}
x.restore()
}
function drawTrail(){
if(trail.length<2)return;
x.save();
x.lineCap='round';x.lineJoin='round';
for(let i=1;i<trail.length;i++){
const t=i/trail.length;
x.strokeStyle='rgba(255,255,255,'+(t*.85)+')';
x.lineWidth=6*t;
x.beginPath();x.moveTo(trail[i-1][0],trail[i-1][1]);x.lineTo(trail[i][0],trail[i][1]);x.stroke()
}
x.restore()
}
function drawParticles(){particles.forEach(p=>{x.fillStyle='rgba('+p.col+','+Math.max(p.life,0)+')';x.fillRect(p.x,p.y,p.size,p.size)})}
function drawHearts(){
for(let i=0;i<3;i++){
x.fillStyle=i<lives?'#e6483c':'rgba(255,255,255,.2)';
x.font='14px Arial';
x.fillText('❤',14+i*16,H-10)
}
}
function draw(){
const g=x.createLinearGradient(0,0,0,H);
g.addColorStop(0,'#1a1030');g.addColorStop(1,'#2c1a45');
x.fillStyle=g;x.fillRect(0,0,W,H);
x.save();
if(shake>0)x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
objects.forEach(o=>o.bomb?drawBomb(o):drawFruit(o));
drawParticles();
drawTrail();
drawHearts();
if(combo>1&&comboT>0){
x.fillStyle='rgba(255,255,255,'+Math.min(1,comboT/18)+')';
x.font='bold 16px Arial';x.textAlign='center';
x.fillText('COMBO x'+combo,W/2,40);
x.textAlign='left'
}
if(flash>0){x.fillStyle='rgba(255,60,60,'+(flash*.4)+')';x.fillRect(0,0,W,H)}
x.restore();
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
if(comboT>0){comboT--;if(comboT===0)combo=0}
if(!gameOver){
spawnTimer--;
if(spawnTimer<=0){
spawnObject();
if(Math.random()<.3)spawnObject();
spawnTimer=Math.max(28,55-Math.floor(score/150))+Math.random()*20
}
objects.forEach(o=>{
o.x+=o.vx;o.y+=o.vy;o.vy+=.135;o.rot+=o.vr
});
missCheck();
objects=objects.filter(o=>!o.missed&&o.y<H+80&&!(o.sliced&&o.y>H+80));
}
particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.life-=.025});
particles=particles.filter(p=>p.life>0);
if(trail.length>0)trail.forEach((t,i)=>{});
scoreEl.textContent=Math.floor(score);
bestEl.textContent='BEST '+best;
statusEl.textContent=gameOver?'خسرتي - Tap باش تعاود':lives+' ❤️ · Combo x'+Math.max(1,combo);
}
function loop(){update();draw();requestAnimationFrame(loop)}
function getPos(e,rectScaleX,rectScaleY,rect){
const cx=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
const cy=(e.touches?e.touches[0].clientY:e.clientY)-rect.top;
return [cx*rectScaleX,cy*rectScaleY]
}
let dragging=false;
function pointerDown(e){
if(gameOver){reset();return}
e.preventDefault();
const rect=c.getBoundingClientRect();
const sx=W/rect.width,sy=H/rect.height;
dragging=true;
trail=[getPos(e,sx,sy,rect)]
}
function pointerMove(e){
if(!dragging)return;
e.preventDefault();
const rect=c.getBoundingClientRect();
const sx=W/rect.width,sy=H/rect.height;
trail.push(getPos(e,sx,sy,rect));
if(trail.length>10)trail.shift();
sliceCheck()
}
function pointerUp(e){dragging=false;trail=[]}
c.addEventListener('touchstart',pointerDown,{passive:false});
c.addEventListener('touchmove',pointerMove,{passive:false});
c.addEventListener('touchend',pointerUp,{passive:false});
c.addEventListener('mousedown',pointerDown);
c.addEventListener('mousemove',pointerMove);
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

handler.help = handler.command = ["ninja"];
handler.tags = ['games'];
handler.owner = false;

export default handler;
