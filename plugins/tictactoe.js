let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;padding:16px;box-sizing:border-box">
<div style="background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<div style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.45)">✦ REDOOX</div><div style="font-size:21px;font-weight:bold;color:#fff">vs Robot</div></div>
<div style="text-align:right"><div style="font-size:18px;font-weight:bold;color:#fff;text-shadow:0 0 10px rgba(108,92,231,.85)"><span id="turnLabel">Turn</span> <span id="turnBadge" style="display:inline-block;background:rgba(255,255,255,.1);border-radius:30px;padding:0 10px;margin-left:4px">X</span></div></div>
</div>
<div style="padding:18px">
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:420px;margin:0 auto;aspect-ratio:1/1">
${[0,1,2,3,4,5,6,7,8].map(i => `<div id="cell${i}" class="cell" data-index="${i}" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:700;color:#fff;transition:all .18s;box-shadow:0 4px 12px rgba(0,0,0,.2);cursor:pointer;touch-action:manipulation;aspect-ratio:1/1;text-shadow:0 0 16px rgba(108,92,231,.3)"></div>`).join('')}
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:0 4px">
<span id="statusMsg" style="font-size:15px;color:rgba(255,255,255,.7)">Your turn (X)</span>
<button id="resetBtn" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:40px;padding:8px 22px;font-size:14px;font-weight:600;color:#eee;cursor:pointer;transition:all .15s;backdrop-filter:blur(6px);touch-action:manipulation">↻ New Game</button>
</div>
<div style="text-align:center;margin-top:14px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.25);border-top:1px solid rgba(255,255,255,.06);padding-top:14px;font-weight:300"><span style="color:rgba(255,255,255,.5);font-weight:600;background:linear-gradient(135deg,#f093fb,#f5576c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">REDOOX</span> · you vs AI</div>
</div></div></div>
<script>
(function(){
let board=Array(9).fill(null),currentPlayer='X',gameActive=true,winCombo=null,isRobotTurn=false,robotTimeout=null;
const statusMsg=document.getElementById('statusMsg'),turnBadge=document.getElementById('turnBadge'),turnLabel=document.getElementById('turnLabel'),resetBtn=document.getElementById('resetBtn');
const winPatterns=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function minimax(board,depth,isMaximizing){const r=checkWinnerOnBoard(board);if(r==='O')return 10-depth;if(r==='X')return depth-10;if(board.every(c=>c!==null))return 0;if(isMaximizing){let b=-Infinity;for(let i=0;i<9;i++){if(board[i]===null){board[i]='O';const s=minimax(board,depth+1,false);board[i]=null;b=Math.max(b,s)}}return b}else{let b=Infinity;for(let i=0;i<9;i++){if(board[i]===null){board[i]='X';const s=minimax(board,depth+1,true);board[i]=null;b=Math.min(b,s)}}return b}}
function checkWinnerOnBoard(b){for(const p of winPatterns){const[a,_,c]=p;if(b[a]&&b[a]===b[p[1]]&&b[a]===b[c])return b[a]}return null}
function getBestMove(){let bs=-Infinity,bm=-1;for(let i=0;i<9;i++){if(board[i]===null){board[i]='O';const s=minimax(board,0,false);board[i]=null;if(s>bs){bs=s;bm=i}}}return bm}
function robotMove(){if(!gameActive||isRobotTurn||currentPlayer!=='O'||board.every(c=>c!==null))return;isRobotTurn=true;statusMsg.textContent='🤖 Robot thinking...';turnLabel.textContent='🤖';turnBadge.textContent='O';if(robotTimeout)clearTimeout(robotTimeout);robotTimeout=setTimeout(()=>{const mi=getBestMove();if(mi===-1||!gameActive){isRobotTurn=false;return}board[mi]='O';renderBoard();const w=checkWinnerOnBoard(board);if(w){winCombo=findWinningCombo(board,w);gameActive=false;renderBoard();isRobotTurn=false;return}if(board.every(c=>c!==null)){gameActive=false;renderBoard();isRobotTurn=false;return}currentPlayer='X';isRobotTurn=false;renderBoard();statusMsg.textContent='Your turn (X)';turnLabel.textContent='Turn';turnBadge.textContent='X'},280)}
function findWinningCombo(b,p){for(const pattern of winPatterns){const[a,_,c]=pattern;if(b[a]===p&&b[pattern[1]]===p&&b[c]===p)return pattern}return null}
function renderBoard(){for(let i=0;i<9;i++){const cell=document.getElementById('cell'+i);if(!cell)continue;const val=board[i];cell.textContent=val==='X'?'✕':val==='O'?'◯':'';cell.className='cell';if(val==='X')cell.classList.add('x-move');if(val==='O')cell.classList.add('o-move');if(winCombo&&winCombo.includes(i))cell.classList.add('win-highlight')}updateStatusAndTurn()}
function updateStatusAndTurn(){if(!gameActive){if(winCombo){const w=board[winCombo[0]];statusMsg.textContent=w==='X'?'🎉 You win!':'🤖 Robot wins!';turnBadge.textContent=w;turnLabel.textContent=w==='X'?'You':'Robot'}else{statusMsg.textContent='🤝 Draw!';turnBadge.textContent='—';turnLabel.textContent='Draw'}return}if(isRobotTurn){statusMsg.textContent='🤖 Robot thinking...';turnLabel.textContent='🤖';turnBadge.textContent='O';return}statusMsg.textContent=currentPlayer==='X'?'Your turn (X)':'Robot turn (O)';turnBadge.textContent=currentPlayer;turnLabel.textContent=currentPlayer==='X'?'You':'Robot'}
function handleCellClick(index){if(!gameActive||isRobotTurn||currentPlayer!=='X'||board[index]!==null)return;board[index]='X';renderBoard();const w=checkWinnerOnBoard(board);if(w){winCombo=findWinningCombo(board,w);gameActive=false;renderBoard();return}if(board.every(c=>c!==null)){gameActive=false;renderBoard();return}currentPlayer='O';renderBoard();robotMove()}
function resetGame(){if(robotTimeout){clearTimeout(robotTimeout);robotTimeout=null}board=Array(9).fill(null);currentPlayer='X';gameActive=true;winCombo=null;isRobotTurn=false;renderBoard();statusMsg.textContent='Your turn (X)';turnLabel.textContent='Turn';turnBadge.textContent='X'}
for(let i=0;i<9;i++){const cell=document.getElementById('cell'+i);if(cell){cell.addEventListener('click',()=>handleCellClick(i));cell.addEventListener('pointerdown',e=>e.preventDefault())}}
resetBtn.addEventListener('click',resetGame);
resetGame();
})();
</script>
<style>
.x-move{color:#a78bfa;text-shadow:0 0 30px rgba(167,139,250,.6)}
.o-move{color:#fb7185;text-shadow:0 0 30px rgba(251,113,133,.5)}
.win-highlight{background:rgba(251,191,36,.20);border-color:#fbbf24;box-shadow:0 0 24px rgba(251,191,36,.25);transform:scale(1.02)}
.cell:active{transform:scale(.94);background:rgba(255,255,255,.10)}
</style>
</body>`;

	const item = {
		__typename: "GenAIaeacdsnwHtmlPrimitive",
		payload: html,
		trusted_sources: ["nixel.dev"]
	}

	await new AIRich(conn)
		.addSection(AIRich.newLayout('Single', item))
		.send(m.chat, { bypassDownload: false })
};

handler.help = handler.command = ["xo", "tictactoe"];
handler.tags = ['games'];
handler.owner = false;

export default handler;
