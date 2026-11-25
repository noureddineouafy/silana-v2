// wordchain — group word-chain game: each word must start with the last letter of the previous one.
// Play happens in normal chat messages (handler.before); points persist per chat in db settings.

const TURN_MS = 90 * 1000
const BANK = ['أسد', 'كتاب', 'قمر', 'شجرة', 'بحر', 'سيارة', 'مدرسة', 'تفاح', 'حصان', 'نجمة', 'باب', 'دار', 'ماء', 'نور', 'جبل', 'وردة', 'سفينة', 'طائرة', 'كرسي', 'هاتف', 'سحابة', 'رمل', 'عسل', 'قلم', 'ورقة', 'مدينة', 'قرية', 'سوق', 'فراشة', 'أرنب', 'ليمون', 'برتقال', 'موز', 'عنب', 'خوخ', 'تمر', 'زيتون', 'حليب', 'خبز', 'سمك']

const games = new Map()

function norm(w) {
  return String(w || '')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim()
}
const firstLetter = (w) => norm(w).charAt(0)
const lastLetter = (w) => { const n = norm(w); return n.charAt(n.length - 1) }
const isWordText = (t) => /^[ء-يٰa-zA-Z]+$/.test(t) && t.length >= 2 && t.length <= 20

function store() {
  if (!global.db || !global.db.data) return null
  if (!global.db.data.settings) global.db.data.settings = {}
  const s = global.db.data.settings
  if (!s.wordchain || typeof s.wordchain !== 'object') s.wordchain = {}
  if (!s.wordchain.scores || typeof s.wordchain.scores !== 'object') s.wordchain.scores = {}
  return s.wordchain
}
function addPoints(chat, sender, pts) {
  try {
    const st = store()
    if (!st) return
    if (!st.scores[chat] || typeof st.scores[chat] !== 'object') st.scores[chat] = {}
    st.scores[chat][sender] = (st.scores[chat][sender] || 0) + pts
  } catch (e) {}
}
function nameOf(conn, jid) {
  try { return conn.getName(jid) || jid.split('@')[0] } catch (e) { return String(jid).split('@')[0] }
}

async function endGame(conn, chat, reason) {
  const g = games.get(chat)
  if (!g) return
  games.delete(chat)
  let best = null, bestPts = -1
  for (const p of Object.keys(g.scores)) if (g.scores[p] > bestPts) { bestPts = g.scores[p]; best = p }
  let msg = '🏁 *سالا اللعب!* (' + reason + ')\n🔗 طول السلسلة: ' + g.chain + ' كلمة'
  if (best) msg += '\n🏆 الفائز: @' + best.split('@')[0] + ' بـ ' + bestPts + ' نقطة'
  msg += '\n\nبدا لعبة جديدة بـ .wordchain'
  try { await conn.sendMessage(chat, { text: msg, mentions: best ? [best] : [] }) } catch (e) {}
}

async function checkTimeout(conn, chat) {
  const g = games.get(chat)
  if (g && Date.now() > g.deadline) await endGame(conn, chat, 'انتهى الوقت ⏰')
}

let handler = async (m, { conn, usedPrefix, command }) => {
  const chat = m.chat
  await checkTimeout(conn, chat)
  const arg = ((m.text || '').trim().split(/\s+/)[1] || '').toLowerCase()
  const g = games.get(chat)

  if (arg === 'stop' || arg === 'إيقاف') {
    if (!g) return m.reply('ماكاينة حتى لعبة خدامة دابا.')
    let allowed = m.fromMe || g.starter === m.sender
    if (!allowed && m.isGroup) {
      try {
        const meta = await conn.groupMetadata(chat)
        const part = (meta.participants || []).find((p) => p.id === m.sender)
        allowed = !!(part && part.admin)
      } catch (e) {}
    }
    if (!allowed) return m.reply('🔒 غير اللي بدا اللعبة ولا مشرف يقدر يوقفها.')
    await endGame(conn, chat, 'توقفات يدوياً')
    return
  }

  if (arg === 'top' || arg === 'النقاط') {
    const st = store()
    const board = st && st.scores[chat] ? st.scores[chat] : {}
    const rows = Object.keys(board).map((p) => ({ p: p, pts: board[p] })).sort((a, b) => b.pts - a.pts).slice(0, 10)
    if (!rows.length) return m.reply('📊 مازال ما تجمعات حتى نقطة هنا. بدا لعبة بـ .wordchain')
    const lines = rows.map((r, i) => (i + 1) + '. @' + r.p.split('@')[0] + ' — ' + r.pts + ' نقطة')
    return conn.sendMessage(chat, { text: '📊 *أحسن اللاعبين هنا:*\n\n' + lines.join('\n'), mentions: rows.map((r) => r.p) }, { quoted: m })
  }

  if (g) {
    const left = Math.max(0, Math.round((g.deadline - Date.now()) / 1000))
    return m.reply('🎮 كاينة لعبة خدامة!\nالكلمة الحالية: «' + g.word + '»\nخاص الكلمة الجاية تبدا بحرف «' + lastLetter(g.word) + '»\n🔗 السلسلة: ' + g.chain + ' · ⏰ بقا ' + left + ' ثانية\nكتب كلمة واحدة في المحادثة باش تلعب، ولا .wordchain stop للإيقاف.')
  }

  const start = BANK[Math.floor(Math.random() * BANK.length)]
  const used0 = {}
  used0[norm(start)] = true
  games.set(chat, { starter: m.sender, word: start, used: used0, lastPlayer: '', deadline: Date.now() + TURN_MS, scores: {}, chain: 1 })
  return m.reply('🎮 *لعبة سلسلة الكلمات بدات!*\n\nالكلمة الأولى: «' + start + '»\nخاص الكلمة الجاية تبدا بحرف «' + lastLetter(start) + '»\n\n📜 القواعد:\n• كتب كلمة واحدة برك (عربية ولا إنجليزية)\n• ما تعاودش كلمة تقالت، وما تلعبش جوج مرات متتالية\n• عندكم 90 ثانية لكل دور — إلا سالات، كتسالي اللعبة\n• كل كلمة صحيحة = نقطة، وكل 5 كلمات في السلسلة = نقطة زايدة\n\n.wordchain top للنقاط · .wordchain stop للإيقاف')
}

handler.before = async function (m, { conn }) {
  try {
    if (!m || m.fromMe || !m.text || !m.chat || m.chat === 'status@broadcast') return
    const chat = m.chat
    const g = games.get(chat)
    if (!g) return
    const raw = String(m.text).trim()
    if (/^[.!/#]/.test(raw)) return
    if (Date.now() > g.deadline) { await endGame(conn, chat, 'انتهى الوقت ⏰'); return }
    if (raw.indexOf(' ') >= 0 || !isWordText(raw)) return
    const react = async (emoji) => { try { await conn.sendMessage(chat, { react: { text: emoji, key: m.key } }) } catch (e) {} }
    if (m.sender === g.lastPlayer) { await react('❌'); return }
    if (firstLetter(raw) !== lastLetter(g.word)) { await react('❌'); return }
    const key = norm(raw)
    if (g.used[key]) { await react('❌'); return }
    g.used[key] = true
    g.word = raw
    g.lastPlayer = m.sender
    g.chain += 1
    g.deadline = Date.now() + TURN_MS
    let pts = 1
    if (g.chain % 5 === 0) pts = 2
    g.scores[m.sender] = (g.scores[m.sender] || 0) + pts
    addPoints(chat, m.sender, pts)
    await react('✅')
    const feed = '✅ «' + raw + '» — @' + m.sender.split('@')[0] + ' (+' + pts + ')\nالدور على حرف «' + lastLetter(raw) + '» · 🔗 ' + g.chain
    try { await conn.sendMessage(chat, { text: feed, mentions: [m.sender] }) } catch (e) {}
  } catch (e) {}
}

handler.help = ['wordchain']
handler.tags = ['game']
handler.command = /^wordchain$/i
handler.group = true

export default handler
    
