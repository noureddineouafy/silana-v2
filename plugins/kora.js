let handler = async (m, { conn, command }) => {
	const html = `<style>
* { -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; box-sizing: border-box; }
body { margin: 0; background: transparent; font-family: Arial, sans-serif; color: #eee; touch-action: manipulation; cursor: pointer; }
.game-box { width: 100%; max-width: 620px; margin: auto; box-sizing: border-box; }
.game-card { position: relative; width: 100%; aspect-ratio: 16/9; background: rgba(255,255,255,.06); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.15); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,.35); }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; background: #1a5c32; }
.header-left { position: absolute; top: 4px; left: 10px; pointer-events: none; filter: drop-shadow(0 1px 3px rgba(0,0,0,.9)); z-index: 5; }
.header-sub { font-size: 10px; font-weight: 800; display: flex; align-items: center; gap: 3px; }
.ig-text { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.5px; }
.header-title { font-size: 13px; font-weight: bold; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,.9); margin-top: -1px; }
.header-right { position: absolute; top: 4px; right: 10px; text-align: right; pointer-events: none; text-shadow: 0 1px 4px rgba(0,0,0,.9); z-index: 5; }
#score { font-size: 15px; font-weight: bold; color: #fff; transition: transform .15s; }
#best { font-size: 9px; color: rgba(255,255,255,.75); margin-top: 1px; }
#status { position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font-size: 9px; color: rgba(255,255,255,.75); pointer-events: none; text-shadow: 0 1px 4px rgba(0,0,0,.9); }
.controls { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; }
.btn { width: 28px; height: 28px; border: 1px solid rgba(255,255,255,.3); border-radius: 7px; background: rgba(0,0,0,.45); color: #fff; font-size: 13px; padding: 0; cursor: pointer; }
</style>
<body>
<div class="game-box">
<div class="game-card">
<canvas id="game" width="480" height="270"></canvas>
<div class="header-left">
<div class="header-sub">
<svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle">
<defs>
<linearGradient id="igG" x1="0%" y1="100%" x2="100%" y2="0%">
<stop offset="0%" stop-color="#f09433"/>
<stop offset="25%" stop-color="#e6683c"/>
<stop offset="50%" stop-color="#dc2743"/>
<stop offset="75%" stop-color="#cc2366"/>
<stop offset="100%" stop-color="#bc1888"/>
</linearGradient>
</defs>
<path fill="url(#igG)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
</svg>
<span class="ig-text">@saad_bk_2008</span>
</div>
<div class="header-title">Penalty Kora</div>
</div>
<div class="header-right">
<div id="score">000</div>
<div id="best">BEST 000</div>
</div>
<div id="status">Tap panah untuk menendang</div>
<div class="controls">
<button id="left" class="btn">◀</button>
<button id="mid" class="btn">▲</button>
<button id="right" class="btn">▶</button>
</div>
</div>
</div>
<script>
const c = document.getElementById('game');
const x = c.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');
const W = c.width, H = c.height, GOAL_Y = 78;
const POS = { L: 130, C: 240, R: 350 };
const OWNER_IG = '@saad_bk_2008';

function loadBest() {
    let vals = [];
    try { let v = localStorage.getItem('kora_best'); if (v) vals.push(parseInt(v, 10)); } catch (e) {}
    try { let v = sessionStorage.getItem('kora_best'); if (v) vals.push(parseInt(v, 10)); } catch (e) {}
    return vals.length ? Math.max(...vals.filter(v => !isNaN(v))) : 0;
}

function saveBest(v) {
    let val = String(Math.floor(v));
    try { localStorage.setItem('kora_best', val); } catch (e) {}
    try { sessionStorage.setItem('kora_best', val); } catch (e) {}
}

let best = loadBest();
bestEl.textContent = 'BEST ' + String(best).padStart(3, '0');

let state, score, timer, shake, runT, particles, flashMsg, flashCol, flashLife;
let ball, gk;

function reset() {
    state = 'IDLE';
    score = 0; timer = 0; shake = 0; runT = 0; particles = [];
    flashMsg = ''; flashCol = ''; flashLife = 0;
    ball = { x: W / 2, y: 230, tx: W / 2, ty: 230, scale: 1, ts: 1, spin: 0 };
    gk = { x: W / 2, y: GOAL_Y + 12, tx: W / 2, w: 42, h: 54 };
    scoreEl.textContent = '000';
    statusEl.textContent = 'Tap panah untuk menendang';
}

function burst(px, py, n, col) {
    for (let i = 0; i < n; i++) {
        particles.push({
            x: px, y: py,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5 - 1,
            life: 1, col: col, size: 2 + Math.random() * 2.5
        });
    }
}

function showFlash(msg, col) {
    flashMsg = msg; flashCol = col; flashLife = 1;
}

function shoot(dir) {
    if (state === 'GAME_OVER') { reset(); return; }
    if (state !== 'IDLE') return;

    ball.tx = POS[dir];
    ball.ty = GOAL_Y + 16;
    ball.ts = 0.55;
    ball.spin = 0;

    const dirs = ['L', 'C', 'R'];
    gk.tx = POS[dirs[Math.floor(Math.random() * 3)]];
    state = 'SHOOTING';
    statusEl.textContent = 'Menendang...';
}

function update() {
    runT++;
    if (shake > 0) shake = Math.max(0, shake - 0.55);
    if (flashLife > 0) flashLife = Math.max(0, flashLife - 0.02);

    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.03; });
    particles = particles.filter(p => p.life > 0);

    if (state === 'SHOOTING') {
        ball.x += (ball.tx - ball.x) * 0.16;
        ball.y += (ball.ty - ball.y) * 0.16;
        ball.scale += (ball.ts - ball.scale) * 0.16;
        ball.spin += 0.35;

        gk.x += (gk.tx - gk.x) * 0.13;
        gk.y = GOAL_Y + 12 - Math.sin(Math.abs(gk.tx - W / 2) * 0.018) * 24;

        if (Math.abs(ball.y - ball.ty) < 2.2) {
            const saved = Math.abs(ball.tx - gk.tx) < 42;
            if (saved) {
                showFlash('SAVE!', '#ff6b6b');
                burst(ball.x, ball.y, 18, '255,100,100');
                shake = 10;
                state = 'RESULT_LOSE';
                timer = 45;
                statusEl.textContent = 'Terselamatkan';
            } else {
                score++;
                scoreEl.textContent = String(score).padStart(3, '0');
                scoreEl.style.transform = 'scale(1.35)';
                setTimeout(() => scoreEl.style.transform = 'scale(1)', 150);
                showFlash('GOAL!', '#f6c945');
                burst(ball.x, ball.y, 20, '246,201,69');
                shake = 6;
                state = 'RESULT_WIN';
                timer = 45;
                statusEl.textContent = 'GOOLL!';
            }
        }
    } else if (state === 'RESULT_WIN' || state === 'RESULT_LOSE') {
        timer--;
        if (timer <= 0) {
            if (state === 'RESULT_LOSE') {
                if (score > best) {
                    best = score;
                    saveBest(best);
                    bestEl.textContent = 'BEST ' + String(best).padStart(3, '0');
                }
                state = 'GAME_OVER';
                statusEl.textContent = 'Tap layar untuk main lagi';
            } else {
                ball = { x: W / 2, y: 230, tx: W / 2, ty: 230, scale: 1, ts: 1, spin: 0 };
                gk = { x: W / 2, y: GOAL_Y + 12, tx: W / 2, w: 42, h: 54 };
                flashLife = 0;
                state = 'IDLE';
                statusEl.textContent = 'Tap panah untuk menendang';
            }
        }
    }
}

function drawPitch() {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#145a32'); g.addColorStop(1, '#1e8449');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,.07)';
    for (let i = 0; i < W; i += 50) x.fillRect(i, 0, 25, H);

    x.strokeStyle = 'rgba(255,255,255,.85)'; x.fillStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 3;
    x.fillRect(0, GOAL_Y + 32, W, 3);
    x.strokeRect(55, GOAL_Y + 32, W - 110, 95);
    x.beginPath(); x.arc(W / 2, GOAL_Y + 127, 42, 0, Math.PI); x.stroke();
    x.beginPath(); x.arc(W / 2, 230, 4.5, 0, Math.PI * 2); x.fill();

    x.strokeStyle = '#ecf0f1'; x.lineWidth = 7;
    x.strokeRect(95, 28, 290, GOAL_Y + 4);
    x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 1;
    for (let i = 100; i <= 380; i += 12) { x.beginPath(); x.moveTo(i, 32); x.lineTo(i, GOAL_Y + 32); x.stroke(); }
    for (let i = 32; i <= GOAL_Y + 32; i += 12) { x.beginPath(); x.moveTo(100, i); x.lineTo(380, i); x.stroke(); }
}

function drawGK() {
    x.fillStyle = 'rgba(0,0,0,.28)';
    x.beginPath(); x.ellipse(gk.x, gk.y + gk.h / 2 + 4, 18, 5, 0, 0, Math.PI * 2); x.fill();

    x.fillStyle = '#111'; x.fillRect(gk.x - gk.w / 2, gk.y + 6, gk.w, 16);
    x.fillStyle = '#c0392b'; x.fillRect(gk.x - gk.w / 2, gk.y - gk.h / 2 + 6, gk.w, 32);

    x.fillStyle = '#e0b080';
    x.beginPath(); x.arc(gk.x, gk.y - gk.h / 2 + 2, 13, 0, Math.PI * 2); x.fill();

    const hand = state === 'SHOOTING' ? 28 : 16;
    const tilt = (gk.x - W / 2) * 0.22;
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(gk.x - 22 - (tilt < 0 ? -tilt : 0), gk.y - hand, 9, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(gk.x + 22 + (tilt > 0 ? tilt : 0), gk.y - hand, 9, 0, Math.PI * 2); x.fill();
}

function drawBall() {
    const r = 17 * ball.scale;
    x.fillStyle = 'rgba(0,0,0,.35)';
    x.beginPath(); x.ellipse(ball.x, ball.y + r + 3 * ball.scale, r * 0.95, r * 0.35, 0, 0, Math.PI * 2); x.fill();

    x.save();
    x.translate(ball.x, ball.y);
    x.rotate(ball.spin);
    x.fillStyle = '#f5f6fa';
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2c3e50';
    x.beginPath(); x.arc(0, 0, r * 0.32, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#2c3e50'; x.lineWidth = 2 * ball.scale;
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); x.stroke();
    }
    x.restore();
}

function drawParticles() {
    particles.forEach(p => {
        x.fillStyle = 'rgba(' + p.col + ',' + Math.max(p.life, 0) + ')';
        x.fillRect(p.x, p.y, p.size, p.size);
    });
}

function drawFlash() {
    if (flashLife <= 0 || !flashMsg) return;
    x.save();
    x.globalAlpha = Math.min(1, flashLife * 1.4);
    x.fillStyle = flashCol; x.textAlign = 'center';
    x.font = 'bold 28px Arial';
    x.fillText(flashMsg, W / 2, H / 2 - 20);
    x.restore();
}

function drawGameOver() {
    x.fillStyle = 'rgba(15,15,25,.55)';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff'; x.textAlign = 'center';
    x.font = 'bold 20px Arial';
    x.fillText('GAME OVER', W / 2, H / 2 - 10);
    x.font = '11px Arial';
    x.fillText('Skor ' + score + ' · Tap layar untuk main lagi', W / 2, H / 2 + 10);
    
    let igGrad = x.createLinearGradient(W / 2 - 50, 0, W / 2 + 50, 0);
    igGrad.addColorStop(0, '#f09433');
    igGrad.addColorStop(0.3, '#e6683c');
    igGrad.addColorStop(0.6, '#dc2743');
    igGrad.addColorStop(1, '#bc1888');
    x.fillStyle = igGrad;
    x.font = 'bold 11px Arial';
    x.fillText('Dev: ' + OWNER_IG, W / 2, H / 2 + 28);
    x.textAlign = 'left';
}

function draw() {
    x.clearRect(0, 0, W, H);
    x.save();
    if (shake > 0) x.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawPitch();
    drawGK();
    drawBall();
    drawParticles();
    drawFlash();
    x.restore();
    if (state === 'GAME_OVER') drawGameOver();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function bind(id, dir) {
    const b = document.getElementById(id);
    const go = e => { e.preventDefault(); shoot(dir); };
    b.addEventListener('touchstart', go, { passive: false });
    b.addEventListener('mousedown', go);
}
bind('left', 'L'); bind('mid', 'C'); bind('right', 'R');

c.addEventListener('pointerdown', () => { if (state === 'GAME_OVER') reset(); });

window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') shoot('L');
    if (k === 'arrowup' || k === 'w') shoot('C');
    if (k === 'arrowright' || k === 'd') shoot('R');
});

reset();
requestAnimationFrame(loop);
</script></body>`;

	const item = {
		__typename: "GenAIaeacdsnwHtmlPrimitive",
		payload: html,
		trusted_sources: ["instagram.com/saad_bk_2008"]
	};

	await new AIRich(conn)
		.addSection(AIRich.newLayout('Single', item))
		.send(m.chat, { bypassDownload: false });
};

handler.help = handler.command = ["kora"];
handler.tags = ['games'];
export default handler;
