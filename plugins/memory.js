let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;padding:16px;box-sizing:border-box">
<div style="background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<div style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.45)">✦ REDOOX</div><div style="font-size:21px;font-weight:bold;color:#fff">Memory Cards</div></div>
<div style="display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.06);padding:4px 14px;border-radius:30px;border:1px solid rgba(255,255,255,.08)">
<div style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,.7);font-size:13px;font-weight:500">🎯 <span id="moves" style="color:#fff;font-weight:700;font-size:15px;min-width:20px;text-align:center">0</span></div>
<div style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,.7);font-size:13px;font-weight:500">🏆 <span id="matches" style="color:#fff;font-weight:700;font-size:15px;min-width:20px;text-align:center">0</span>/8</div>
</div>
</div>
<div style="padding:18px">
<div style="position:relative">
<div id="board" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 auto;aspect-ratio:1/1;max-width:420px"></div>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:0 2px">
<span id="statusMsg" style="font-size:14px;color:rgba(255,255,255,.7)">Flip a card to start</span>
<button id="resetBtn" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:40px;padding:8px 22px;font-size:14px;font-weight:600;color:#eee;cursor:pointer;transition:all .15s;backdrop-filter:blur(6px);touch-action:manipulation">↻ New Game</button>
</div>
<div style="text-align:center;margin-top:14px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.25);border-top:1px solid rgba(255,255,255,.06);padding-top:14px;font-weight:300"><span style="color:rgba(255,255,255,.5);font-weight:600;background:linear-gradient(135deg,#f093fb,#f5576c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">REDOOX</span> · match & remember</div>
</div></div></div>
<script>
(function(){
const emojis=['🎮','🚀','🌟','⭐','🎯','🎨','🔥','💎'];
let cards=[],flippedIndices=[],matchedPairs=0,moves=0,lockBoard=false,timeout=null,gameComplete=false;
const boardEl=document.getElementById('board'),movesEl=document.getElementById('moves'),matchesEl=document.getElementById('matches'),statusMsg=document.getElementById('statusMsg'),resetBtn=document.getElementById('resetBtn');
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function initGame(){if(timeout){clearTimeout(timeout);timeout=null}const deck=[...emojis,...emojis];shuffle(deck);cards=deck.map((emoji,index)=>({id:index,emoji,flipped:false,matched:false}));flippedIndices=[];matchedPairs=0;moves=0;lockBoard=false;gameComplete=false;updateStats();statusMsg.textContent='Flip a card to start';renderBoard()}
function renderBoard(){boardEl.innerHTML='';cards.forEach((card,index)=>{const cell=document.createElement('div');cell.className='cell';cell.dataset.index=index;if(card.flipped)cell.classList.add('flipped');if(card.matched)cell.classList.add('matched');cell.style.cssText='background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#fff;transition:all .25s;cursor:pointer;touch-action:manipulation;aspect-ratio:1/1;box-shadow:0 4px 12px rgba(0,0,0,.2);text-shadow:0 0 20px rgba(108,92,231,.3);position:relative;transform-style:preserve-3d';
const back=document.createElement('div');back.className='card-back';back.textContent='?';back.style.cssText='position:absolute;width:100%;height:100%;background:radial-gradient(circle at 30% 30%,rgba(108,92,231,.2),rgba(255,255,255,.05));border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;color:rgba(255,255,255,.15);backface-visibility:hidden';
const front=document.createElement('div');front.className='card-front';front.textContent=card.emoji;front.style.cssText='backface-visibility:hidden;position:absolute;width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:16px;font-size:36px';
cell.appendChild(back);cell.appendChild(front);
if(card.matched){back.style.display='none';front.style.display='flex';cell.style.background='rgba(167,139,250,.15)';cell.style.borderColor='rgba(167,139,250,.4)';cell.style.boxShadow='0 0 20px rgba(167,139,250,.15)';cell.style.cursor='default';cell.style.opacity='0.85';cell.style.transform='scale(0.95)'}
else if(card.flipped){back.style.display='none';front.style.display='flex';cell.style.background='rgba(255,255,255,.12)';cell.style.borderColor='rgba(167,139,250,.3)';cell.style.transform='scale(1.02)'}
else{back.style.display='flex';front.style.display='none'}
cell.addEventListener('click',()=>handleCardClick(index));cell.addEventListener('pointerdown',e=>e.preventDefault());boardEl.appendChild(cell)})}
function updateStats(){movesEl.textContent=moves;matchesEl.textContent=matchedPairs}
function checkWin(){if(matchedPairs===emojis.length){gameComplete=true;statusMsg.textContent='🎉 You win! Perfect memory!';return true}return false}
function handleCardClick(index){if(lockBoard||gameComplete)return;const card=cards[index];if(card.flipped||card.matched||flippedIndices.length===2)return;card.flipped=true;flippedIndices.push(index);renderBoard();if(flippedIndices.length===2){moves++;updateStats();lockBoard=true;statusMsg.textContent='Checking...';const[i1,i2]=flippedIndices;const card1=cards[i1],card2=cards[i2];if(card1.emoji===card2.emoji){card1.matched=true;card2.matched=true;matchedPairs++;updateStats();flippedIndices=[];lockBoard=false;renderBoard();statusMsg.textContent='✅ Match found!';if(checkWin())renderBoard()}else{timeout=setTimeout(()=>{card1.flipped=false;card2.flipped=false;flippedIndices=[];lockBoard=false;renderBoard();statusMsg.textContent='❌ Try again';timeout=null},600)}}else{statusMsg.textContent='Pick another card'}}
function resetGame(){if(timeout){clearTimeout(timeout);timeout=null}initGame()}
resetBtn.addEventListener('click',resetGame);
initGame();
})();
</script>
<style>
.cell.flipped{background:rgba(255,255,255,.12);border-color:rgba(167,139,250,.3);transform:scale(1.02)}
.cell.matched{background:rgba(167,139,250,.15);border-color:rgba(167,139,250,.4);box-shadow:0 0 20px rgba(167,139,250,.15);cursor:default;opacity:.85;transform:scale(.95)}
.cell:active:not(.matched):not(.flipped){transform:scale(.92)}
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

handler.help = handler.command = ["memory"];
handler.tags = ['games'];
handler.owner = false;

export default handler;
