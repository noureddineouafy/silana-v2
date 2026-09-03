let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;box-sizing:border-box">
<div style="position:relative;width:100%;aspect-ratio:16/9;background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<canvas id="game" width="480" height="270" style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"></canvas>
<div style="position:absolute;top:8px;left:12px;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div style="font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,.65)">NIXEL ARCADE</div>
<div style="font-size:14px;font-weight:bold;color:#fff">Brick Smash</div>
</div>
<div style="position:absolute;top:8px;right:12px;text-align:right;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">
<div id="score" style="font-size:15px;font-weight:bold;color:#fff;transition:transform .15s">0</div>
<div id="best" style="font-size:9px;color:rgba(255,255,255,.75);margin-top:1px">BEST 0</div>
</div>
<div id="status" style="position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:9px;color:rgba(255,255,255,.75);pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.9)">حرك اللوح، دوس باش تطلق الكرة</div>
</div></div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),statusEl=document.getElementById('status');
const W=c.width,H=c.height;
function loadBest(){
let vals=[];
try{let v=localStorage.getItem('brick_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let v=sessionStorage.getItem('brick_best');if(v)vals.push(parseInt(v,10))}catch(e){}
try{let mm=document.cookie.match(/(?:^|;\\s*)brick_best=(\\d+)/);if(mm)vals.push(parseInt(mm[1],10))}catch(e){}
return vals.length?Math.max(...vals.filter(v=>!isNaN(v))):0
}
function saveBest(v){
let val=String(Math.floor(v));
try{localStorage.setItem('brick_best',val)}catch(e){}
try{sessionStorage.setItem('brick_best',val)}catch(e){}
try{document.cookie='brick_best='+val+';max-age=31536000;path=/'}catch(e){}
try{
let rq=indexedDB.open('brick_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{try{rq.result.transaction('kv','readwrite').objectStore('kv').put(val,'brick_best')}catch(e){}}
}catch(e){}
}
function loadBestAsync(cb){
try{
let rq=indexedDB.open('brick_db',1);
rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv')};
rq.onsuccess=()=>{
try{
let gr=rq.result.transaction('kv','readonly').objectStore('kv').get('brick_best');
gr.onsuccess=()=>{if(gr.result)cb(parseInt(gr.result,10))}
}catch(e){}
}
}catch(e){}
}
let best=loadBest();
loadBestAsync(v=>{if(!isNaN(v)&&v>best){best=v;bestEl.textContent='BEST '+best}});

function hexToRgb(hex){
const v=parseInt(hex.slice(1),16);
return ((v>>16)&255)+','+((v>>8)&255)+','+(v&255)
}
const PADDLE_W=64,PADDLE_H=8,BALL_R=5;
const ROWS=4,COLS=8,PAD=3,TOP=30;
const COLORS=['#e6483c','#f6c945','#7ec850','#c04cf2'];
let paddle,ball,bricks,particles,trail,score,lives,level,gameOver,launched,shake,flash,runT;

function buildBricks(){
const bw=(W-16)/COLS-PAD;
const bh=12;
const arr=[];
for(let r=0;r<ROWS;r++){
for(let cx=0;cx<COLS;cx++){
arr.push({x:8+cx*(bw+PAD),y:TOP+r*(bh+PAD),w:bw,h:bh,col:COLORS[r%COLORS.length],alive:true})
}
}
return arr
}
function reset(){
paddle={x:W/2-PADDLE_W/2,y:H-18};
ball={x:W/2,y:H-18-BALL_R-1,vx:0,vy:0};
bricks=buildBricks();
particles=[];trail=[];score=0;lives=3;level=1;gameOver=false;launched=false;shake=0;flash=0;runT=0;
scoreEl.textContent='0';
bestEl.textContent='BEST '+best;
statusEl.textContent='حرك اللوح، دوس باش تطلق الكرة'
}
function burst(px,py,n,col,spd){for(let i=0;i<n;i++)particles.push({x:px,y:py,vx:(Math.random()-.5)*spd,vy:-Math.random()*spd*.8,life:1,col,size:2+Math.random()*3,grav:.15})}
function ballAtRest(){ball.x=paddle.x+PADDLE_W/2;ball.y=paddle.y-BALL_R-1;ball.vx=0;ball.vy=0}
function movePaddle(e){
const rect=c.getBoundingClientRect();
const sx=W/rect.width;
const cx=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
const px=cx*sx;
paddle.x=Math.max(4,Math.min(W-PADDLE_W-4,px-PADDLE_W/2));
if(!launched)ballAtRest()
}
function drawPaddle(){
x.save();
x.shadowColor='rgba(120,190,255,.8)';x.shadowBlur=8;
x.fillStyle='#9fd3ff';
x.beginPath();x.roundRect(paddle.x,paddle.y,PADDLE_W,PADDLE_H,4);x.fill();
x.restore()
}
function drawBall(){
x.save();
x.shadowColor='rgba(255,255,255,.9)';x.shadowBlur=6;
x.fillStyle='#fff';
x.beginPath();x.arc(ball.x,ball.y,BALL_R,0,7);x.fill();
x.restore()
}
function drawBricks(){
bricks.forEach(b=>{
if(!b.alive)return;
x.fillStyle=b.col;
x.beginPath();x.roundRect(b.x,b.y,b.w,b.h,2);x.fill();
x.fillStyle='rgba(255,255,255,.3)';
x.fillRect(b.x+1,b.y+1,b.w-2,3)
})
}
function drawTrail(){
if(trail.length<2)return;
x.save();
x.lineCap='round';
for(let i=1;i<trail.length;i++){
const t=i/trail.length;
x.strokeStyle='rgba(159,211,255,'+(t*.5)+')';
x.lineWidth=BALL_R*1.4*t;
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
drawBricks();
drawTrail();
drawBall();
drawPaddle();
drawParticles();
drawHearts();
x.fillStyle='rgba(255,255,255,.85)';
x.font='bold 11px Arial';x.textAlign='center';
x.fillText('LEVEL '+level,W/2,20);
x.textAlign='left';
if(flash>0){x.fillStyle='rgba(255,60,60,'+(flash*.4)+')';x.fillRect(0,0,W,H)}
x.restore();
if(!launched&&!gameOver){
x.fillStyle='rgba(255,255,255,.9)';x.textAlign='center';
x.font='bold 12px Arial';x.fillText('دوس باش تطلق الكرة',W/2,H/2+40);
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
if(launched&&!gameOver){
ball.x+=ball.vx;ball.y+=ball.vy;
trail.push([ball.x,ball.y]);
if(trail.length>8)trail.shift();
if(ball.x<BALL_R){ball.x=BALL_R;ball.vx*=-1}
if(ball.x>W-BALL_R){ball.x=W-BALL_R;ball.vx*=-1}
if(ball.y<BALL_R){ball.y=BALL_R;ball.vy*=-1}
if(ball.vy>0&&ball.y+BALL_R>paddle.y&&ball.y+BALL_R<paddle.y+PADDLE_H+8&&ball.x>paddle.x-4&&ball.x<paddle.x+PADDLE_W+4){
const hit=(ball.x-(paddle.x+PADDLE_W/2))/(PADDLE_W/2);
ball.vx=hit*4.4;
ball.vy=-Math.abs(ball.vy);
ball.y=paddle.y-BALL_R-1
}
for(const b of bricks){
if(!b.alive)continue;
if(ball.x+BALL_R>b.x&&ball.x-BALL_R<b.x+b.w&&ball.y+BALL_R>b.y&&ball.y-BALL_R<b.y+b.h){
b.alive=false;
score+=10;
if(score>best){best=score;saveBest(best)}
burst(b.x+b.w/2,b.y+b.h/2,12,hexToRgb(b.col),4);
ball.vy*=-1;
scoreEl.style.transform='scale(1.3)';
setTimeout(()=>scoreEl.style.transform='scale(1)',120);
break
}
}
if(ball.y>H+20){
lives--;shake=10;launched=false;
ballAtRest();
if(lives<=0){gameOver=true;flash=1}
}
if(bricks.every(b=>!b.alive)){
level++;
bricks=buildBricks();
launched=false;
ballAtRest()
}
}
particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav;p.life-=.025});
particles=particles.filter(p=>p.life>0);
scoreEl.textContent=Math.floor(score);
bestEl.textContent='BEST '+best;
statusEl.textContent=gameOver?'خسرتي - Tap باش تعاود':(launched?lives+' ❤️ · Level '+level:'حرك اللوح، دوس باش تطلق الكرة')
}
function loop(){update();draw();requestAnimationFrame(loop)}
let dragging=false;
function pointerDown(e){
if(gameOver){reset();return}
e.preventDefault();
dragging=true;
movePaddle(e);
if(!launched){launched=true;ball.vx=(Math.random()-.5)*3;ball.vy=-(4.2+level*.3)}
}
function pointerMove(e){if(!dragging)return;e.preventDefault();movePaddle(e)}
function pointerUp(e){dragging=false}
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

handler.help = handler.command = ["brick"];
handler.tags = ['games'];

export default handler;
