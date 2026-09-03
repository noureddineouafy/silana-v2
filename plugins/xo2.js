let handler = async (m, { conn, command }) => {
	const html = `<style>
* { -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; box-sizing: border-box; }
body { margin: 0; background: transparent; font-family: 'Segoe UI', Roboto, sans-serif; color: #fff; touch-action: manipulation; }
.game-box { width: 100%; max-width: 480px; margin: auto; box-sizing: border-box; }

/* IG Border Container */
.ig-border-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 3/4;
    border-radius: 24px;
    padding: 3px;
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    box-shadow: 0 10px 30px rgba(220, 39, 67, 0.3);
}

.game-card { position: relative; width: 100%; height: 100%; background: #0f172a; border-radius: 21px; overflow: hidden; }
canvas { width: 100%; height: 100%; display: block; cursor: pointer; }

/* Top Bars */
.header-left { position: absolute; top: 14px; left: 16px; pointer-events: none; z-index: 5; }
.header-sub { font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 20px; backdrop-filter: blur(4px); }
.ig-text { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: bold; }
.header-title { font-size: 16px; font-weight: 900; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,0.8); margin-top: 4px; letter-spacing: 0.5px; }
.header-right { position: absolute; top: 14px; right: 16px; text-align: right; pointer-events: none; text-shadow: 0 2px 6px rgba(0,0,0,0.8); z-index: 5; }
#score { font-size: 15px; font-weight: 800; color: #00f2fe; }
#best { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 2px; }
#status { position: absolute; bottom: 16px; left: 0; right: 0; text-align: center; font-size: 14px; font-weight: bold; color: #ff007f; pointer-events: none; text-shadow: 0 2px 6px rgba(0,0,0,0.9); z-index: 5; }

/* Modern UI Overlay */
.overlay { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; z-index: 20; transition: all 0.3s ease; }
.overlay.hidden { opacity: 0; pointer-events: none; }
.overlay-title { font-size: 22px; font-weight: 900; color: #fff; text-shadow: 0 0 12px rgba(0,242,254,0.4); text-align: center; margin-bottom: 5px; }

.overlay-btns { display: flex; flex-direction: column; gap: 14px; width: 80%; }
.menu-btn { position: relative; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); color: #e2e8f0; font-size: 16px; font-weight: 700; padding: 15px 20px; border-radius: 16px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); text-align: center; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
.menu-btn:hover, .menu-btn:active { background: linear-gradient(135deg, #00c6ff, #0072ff); border-color: #00f2fe; color: #fff; box-shadow: 0 0 20px rgba(0,242,254,0.6); transform: translateY(-2px); }
</style>
<body>
<div class="game-box">
<div class="ig-border-wrap">
<div class="game-card">
<canvas id="game" width="600" height="800"></canvas>

<div class="header-left">
<div class="header-sub">
<svg width="14" height="14" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle">
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
<div class="header-title">TIC TAC TOE</div>
</div>

<div class="header-right">
<div id="score">X: 0 | O: 0</div>
<div id="best">الانتصارات: 0</div>
</div>

<div id="status">اختر نمط اللعب للبدء</div>

<!-- Overlay Screen -->
<div id="overlay" class="overlay">
<div class="overlay-title" id="overlayTitle">اختر نمط اللعب</div>
<div class="overlay-btns">
<button id="btnBot" class="menu-btn">🤖 ضد البوت</button>
<button id="btnPvp" class="menu-btn">👥 2 لاعبين</button>
</div>
</div>

</div>
</div>
</div>

<script>
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const btnBot = document.getElementById('btnBot');
const btnPvp = document.getElementById('btnPvp');

const W = canvas.width, H = canvas.height;
let gameMode = 'BOT';

const gridOffsetTop = 120;
const gridOffsetBottom = 80;
const gridSize = Math.min(W - 40, H - gridOffsetTop - gridOffsetBottom);
const startX = (W - gridSize) / 2;
const startY = gridOffsetTop + ((H - gridOffsetTop - gridOffsetBottom) - gridSize) / 2;
const cellSize = gridSize / 3;

let board = Array(9).fill(null);
let xScore = 0, oScore = 0, winStreak = 0;
let isGameOver = false;
let turn = 'X';

function startGame(mode) {
    gameMode = mode;
    overlay.classList.add('hidden');
    resetGame();
}

btnBot.addEventListener('click', () => startGame('BOT'));
btnPvp.addEventListener('click', () => startGame('PVP'));

function checkWin(b) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let l of lines) {
        if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) {
            return { winner: b[l[0]], line: l };
        }
    }
    if (b.every(cell => cell !== null)) return { winner: 'DRAW' };
    return null;
}

function botMove() {
    if (isGameOver || turn !== 'O') return;
    
    let available = board.map((v, i) => v === null ? i : null).filter(v => v !== null);
    if (available.length === 0) return;

    let move = null;

    for (let i of available) {
        let temp = [...board]; temp[i] = 'O';
        if (checkWin(temp)?.winner === 'O') { move = i; break; }
    }

    if (move === null) {
        for (let i of available) {
            let temp = [...board]; temp[i] = 'X';
            if (checkWin(temp)?.winner === 'X') { move = i; break; }
        }
    }

    if (move === null && available.includes(4)) move = 4;
    if (move === null) {
        let corners = [0, 2, 6, 8].filter(c => available.includes(c));
        if (corners.length > 0) move = corners[Math.floor(Math.random() * corners.length)];
    }

    if (move === null) move = available[Math.floor(Math.random() * available.length)];

    board[move] = 'O';
    let res = checkWin(board);
    if (res) {
        handleEndGame(res);
    } else {
        turn = 'X';
        statusEl.textContent = 'دور اللاعب X';
    }
}

function handleEndGame(res) {
    isGameOver = true;
    let msg = '';
    if (res.winner === 'X') {
        xScore++;
        winStreak++;
        msg = '🎉 فاز اللاعب (X)!';
    } else if (res.winner === 'O') {
        oScore++;
        winStreak = 0;
        msg = gameMode === 'BOT' ? '🤖 فاز البوت (O)!' : '🎉 فاز اللاعب (O)!';
    } else {
        msg = '🤝 تعادل!';
    }
    
    scoreEl.textContent = 'X: ' + xScore + ' | O: ' + oScore;
    bestEl.textContent = 'الانتصارات: ' + winStreak;
    statusEl.textContent = msg;

    setTimeout(() => {
        overlayTitle.textContent = msg;
        overlay.classList.remove('hidden');
    }, 900);
}

function resetGame() {
    board = Array(9).fill(null);
    isGameOver = false;
    turn = 'X';
    statusEl.textContent = 'دور اللاعب X';
}

function handleClick(e) {
    if (!overlay.classList.contains('hidden')) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);

    if (isGameOver) return;
    if (gameMode === 'BOT' && turn === 'O') return;

    if (x >= startX && x <= startX + gridSize && y >= startY && y <= startY + gridSize) {
        const col = Math.floor((x - startX) / cellSize);
        const row = Math.floor((y - startY) / cellSize);
        const idx = row * 3 + col;

        if (board[idx] === null) {
            board[idx] = turn;
            let res = checkWin(board);
            if (res) {
                handleEndGame(res);
            } else {
                turn = turn === 'X' ? 'O' : 'X';
                statusEl.textContent = 'دور اللاعب ' + turn;
                if (gameMode === 'BOT' && turn === 'O') {
                    statusEl.textContent = 'البوت يفكر...';
                    setTimeout(botMove, 350);
                }
            }
        }
    }
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(startX + i * cellSize, startY);
        ctx.lineTo(startX + i * cellSize, startY + gridSize);
        ctx.stroke();
    }

    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(startX, startY + i * cellSize);
        ctx.lineTo(startX + gridSize, startY + i * cellSize);
        ctx.stroke();
    }
}

function drawMarks() {
    for (let i = 0; i < 9; i++) {
        const mark = board[i];
        if (!mark) continue;

        const row = Math.floor(i / 3);
        const col = i % 3;
        const cx = startX + col * cellSize + cellSize / 2;
        const cy = startY + row * cellSize + cellSize / 2;
        const r = cellSize * 0.28;

        if (mark === 'X') {
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 9;
            ctx.beginPath();
            ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
            ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (mark === 'O') {
            ctx.shadowColor = '#ff007f';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 9;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }
}

function drawWinningLine(line) {
    const startIdx = line[0], endIdx = line[2];
    const sRow = Math.floor(startIdx / 3), sCol = startIdx % 3;
    const eRow = Math.floor(endIdx / 3), eCol = endIdx % 3;

    const sx = startX + sCol * cellSize + cellSize / 2;
    const sy = startY + sRow * cellSize + cellSize / 2;
    const ex = startX + eCol * cellSize + cellSize / 2;
    const ey = startY + eRow * cellSize + cellSize / 2;

    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function draw() {
    ctx.clearRect(0, 0, W, H);
    
    let bg = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, H/2);
    bg.addColorStop(0, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    drawMarks();

    let winState = checkWin(board);
    if (winState && winState.line) {
        drawWinningLine(winState.line);
    }

    requestAnimationFrame(draw);
}

canvas.addEventListener('click', handleClick);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleClick(e.touches[0]);
}, { passive: false });

draw();
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

handler.help = handler.command = ["xo2"];
handler.tags = ['games'];
export default handler;
