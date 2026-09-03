let handler = async (m, { conn, command }) => {
	const html = `<style>*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation;cursor:pointer">
<div style="width:100%;max-width:620px;margin:auto;padding:16px;box-sizing:border-box">
<div style="background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35)">
<div style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;align-items:center">
<div><div style="font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,.45)">✦ REDOOX</div><div style="font-size:21px;font-weight:bold;color:#fff">RPS Arena</div></div>
<div style="font-size:13px;color:rgba(255,255,255,.4);font-weight:500">vs AI</div>
</div>
<div style="padding:18px">
<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.05);border-radius:16px;padding:12px 18px;margin-bottom:20px;border:1px solid rgba(255,255,255,.08)">
<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px">You</span><span id="playerScore" style="font-size:28px;font-weight:700;color:#a78bfa">0</span></div>
<span style="color:rgba(255,255,255,.2);font-size:24px;font-weight:300">⚔️</span>
<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px">Robot</span><span id="robotScore" style="font-size:28px;font-weight:700;color:#fb7185">0</span></div>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin:16px 0 20px;padding:16px;background:rgba(255,255,255,.03);border-radius:20px;border:1px solid rgba(255,255,255,.06);min-height:100px">
<div style="flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1px">You</span><span id="playerChoice" style="font-size:56px;line-height:1.2;min-height:70px;display:flex;align-items:center;justify-content:center;opacity:0.2">❓</span></div>
<span style="font-size:20px;font-weight:700;color:rgba(255,255,255,.15);padding:0 4px">VS</span>
<div style="flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1px">Robot</span><span id="robotChoice" style="font-size:56px;line-height:1.2;min-height:70px;display:flex;align-items:center;justify-content:center;opacity:0.2">❓</span></div>
</div>
<div style="text-align:center;margin:8px 0 18px;min-height:36px;display:flex;align-items:center;justify-content:center"><span id="resultMsg" style="font-size:20px;font-weight:700;color:#fff">Choose your move</span></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:8px 0 16px">
${['rock','paper','scissors'].map(c => `<button class="choice-btn" data-choice="${c}" style="background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.08);border-radius:20px;padding:16px 8px;font-size:40px;cursor:pointer;transition:all .15s;touch-action:manipulation;display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff">${c==='rock'?'✊':c==='paper'?'✋':'✌️'}<span style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px;font-weight:500">${c}</span></button>`).join('')}
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 2px">
<span id="statusMsg" style="font-size:13px;color:rgba(255,255,255,.5)">Best of 3? 5? Let's go!</span>
<button id="resetBtn" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:40px;padding:8px 22px;font-size:14px;font-weight:600;color:#eee;cursor:pointer;transition:all .15s;backdrop-filter:blur(6px);touch-action:manipulation">↻ New Match</button>
</div>
<div style="text-align:center;margin-top:14px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.25);border-top:1px solid rgba(255,255,255,.06);padding-top:14px;font-weight:300"><span style="color:rgba(255,255,255,.5);font-weight:600;background:linear-gradient(135deg,#f093fb,#f5576c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">REDOOX</span> · rock paper scissors</div>
</div></div></div>
<script>
(function(){
const choices=['rock','paper','scissors'],emojiMap={rock:'✊',paper:'✋',scissors:'✌️'},winMap={rock:'scissors',paper:'rock',scissors:'paper'};
let playerScore=0,robotScore=0,isPlaying=false;
const playerScoreEl=document.getElementById('playerScore'),robotScoreEl=document.getElementById('robotScore'),playerChoiceEl=document.getElementById('playerChoice'),robotChoiceEl=document.getElementById('robotChoice'),resultMsg=document.getElementById('resultMsg'),statusMsg=document.getElementById('statusMsg'),resetBtn=document.getElementById('resetBtn'),choiceBtns=document.querySelectorAll('.choice-btn');
function updateScores(){playerScoreEl.textContent=playerScore;robotScoreEl.textContent=robotScore}
function setChoices(player,robot){playerChoiceEl.textContent=player?emojiMap[player]:'❓';robotChoiceEl.textContent=robot?emojiMap[robot]:'❓';playerChoiceEl.style.opacity=player?'1':'0.2';robotChoiceEl.style.opacity=robot?'1':'0.2'}
function setResult(message,isWin=null){resultMsg.textContent=message;resultMsg.style.color='#fff';if(isWin===true){resultMsg.style.color='#a78bfa';resultMsg.style.animation='none';setTimeout(()=>{resultMsg.style.animation='winPulse 0.5s ease'},10);setTimeout(()=>{resultMsg.style.animation=''},510)}else if(isWin===false){resultMsg.style.color='#fb7185'}else{resultMsg.style.color='#fbbf24'}}
function playRound(playerChoice){if(isPlaying)return;isPlaying=true;choiceBtns.forEach(btn=>btn.style.opacity='0.5');const robotChoice=choices[Math.floor(Math.random()*3)];let result;if(playerChoice===robotChoice){result='draw'}else if(winMap[playerChoice]===robotChoice){result='win';playerScore++}else{result='lose';robotScore++}setChoices(playerChoice,robotChoice);updateScores();let msg='',isWin=null;if(result==='win'){msg='🎉 You win! '+emojiMap[playerChoice]+' beats '+emojiMap[robotChoice];isWin=true;statusMsg.textContent='Nice one! Keep going!'}else if(result==='lose'){msg='😔 Robot wins! '+emojiMap[robotChoice]+' beats '+emojiMap[playerChoice];isWin=false;statusMsg.textContent='Robot got lucky! Try again.'}else{msg='🤝 Draw! Both chose '+emojiMap[playerChoice];isWin=null;statusMsg.textContent='Draw! Choose again.'}setResult(msg,isWin);setTimeout(()=>{isPlaying=false;choiceBtns.forEach(btn=>btn.style.opacity='1')},400)}
function resetGame(){playerScore=0;robotScore=0;isPlaying=false;updateScores();setChoices(null,null);setResult('Choose your move',null);statusMsg.textContent='New match started!';choiceBtns.forEach(btn=>btn.style.opacity='1')}
choiceBtns.forEach(btn=>{btn.addEventListener('click',()=>{if(isPlaying)return;playRound(btn.dataset.choice)});btn.addEventListener('pointerdown',e=>e.preventDefault())});
resetBtn.addEventListener('click',resetGame);
resetGame();
})();
</script>
<style>
.choice-btn:active{transform:scale(.92);background:rgba(255,255,255,.12)}
.choice-btn:hover{border-color:rgba(167,139,250,.3);background:rgba(255,255,255,.08)}
@keyframes winPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
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

handler.help = handler.command = ["xrps", "suit", "rps"];
handler.tags = ['games'];
handler.owner = false;

export default handler;
