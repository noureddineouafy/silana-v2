/**
 * aivoice.js — Talk to Silana by voice (Silana v2, ChiiMD base, Baileys ESM)
 *
 *   .aivoice                  → quote a voice note, or type a question after
 *                               the command — Silana answers with a VOICE NOTE
 *   .aivoice <question>       → ask by text, get the answer spoken
 *   .aivoice voices           → list the available AI voices (Arabic first)
 *   .aivoice sample <n>       → hear voice n°<n> say a sample line
 *   .aivoice setvoice <n>     → (owner) make voice n°<n> Silana's voice
 *   .aivoice reset            → forget this chat's conversation
 *   .aivoice on|off           → (owner) AUTO voice chat in this chat (v2):
 *                               no command needed — talk and Silana answers
 *                               by voice, like chatting with a human.
 *                               Private chats: every message counts.
 *                               Groups: voice notes, or messages that start
 *                               with "Silana" — so a busy group stays sane.
 * v2 also carries a speed pass: a cached Gemini guest cookie (new chats
 * skip one round-trip), a "recording…" presence while Silana prepares the
 * answer, and extra-short answers in auto mode (shorter text = faster
 * voice rendering).
 *
 * Pipeline: your voice note → Google Speech (tuned for Moroccan Darija,
 * ar-MA — the same engine as .audiototxt) → Gemini (web session, keeps the
 * conversation per chat) → HeyGen AI voice (the same key as .heygen —
 * set it once with .heygenkey) → OGG Opus voice note.
 * If HeyGen is unavailable, a basic backup voice answers instead.
 *
 * Answers are prompted to be SPOKEN: short, warm, no markdown, in the
 * language/dialect you used (Darija in → Darija out).
 */

import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const run = promisify(execFile)

// Panel /tmp is a 100MB tmpfs and the base auto-cleans ./tmp — work under
// the bot's own folder and re-ensure it before every use.
const TMPDIR = path.join(process.cwd(), 'tmp', 'aivoice')
function ensureTmp() { try { fs.mkdirSync(TMPDIR, { recursive: true }) } catch {} }
ensureTmp()
process.env.TMPDIR = path.join(process.cwd(), 'tmp')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const GKEY = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw' // public Chromium speech key — same as .audiototxt
const MAX_SECONDS = 120
const HEYGEN_MODEL = 'heygen-voice-1-turbo-free'
const SAMPLE_LINE = 'أهلاً… أنا سيلانا. هادا صوتي الجديد — دافئ، هادئ، وقريب من القلب. إلا عجبك، خليه هو صوتي الدائم.'

const stamp = () => Date.now() + '-' + Math.floor(Math.random() * 1e6)

function store() {
    try {
        if (!global.db.data.settings) global.db.data.settings = {}
        const s = global.db.data.settings
        if (!s.aivoice || typeof s.aivoice !== 'object') s.aivoice = {}
        if (!s.aivoice.web || typeof s.aivoice.web !== 'object') s.aivoice.web = {}
        if (!s.aivoice.chats || typeof s.aivoice.chats !== 'object') s.aivoice.chats = {}
        return s.aivoice
    } catch { return { web: {} } }
}
function heygenKey() { try { return global.db.data.settings?.heygenKey || '' } catch { return '' } }

/* ---------------- Speech to text (Google Speech, Darija-tuned) ---------------- */

async function toFlac(input, output) {
    ensureTmp()
    await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-ar', '16000', '-ac', '1', output], { timeout: 120000 })
}

async function transcribe(flacBuffer, lang) {
    const res = await fetch(`https://www.google.com/speech-api/v2/recognize?output=json&lang=${lang}&key=${GKEY}&pfilter=0`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/x-flac; rate=16000' },
        body: flacBuffer,
        signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error('stt: Google Speech HTTP ' + res.status)
    const body = await res.text()
    for (const line of body.split('\n')) {
        if (!line.trim()) continue
        try {
            const json = JSON.parse(line)
            const alt = json?.result?.[0]?.alternative?.[0]?.transcript
            if (alt) return alt
        } catch {}
    }
    return ''
}

/* ---------------- Gemini Web (guest session — same route as .tilmide) ---------------- */

let cookieCache = { value: '', at: 0 }
const geminiWeb = {
    getNewCookie: async function () {
        if (cookieCache.value && Date.now() - cookieCache.at < 600000) return cookieCache.value
        const r = await fetch('https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c', {
            headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: 'f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&',
            method: 'POST',
            signal: AbortSignal.timeout(30000),
        })
        const c = r.headers.get('set-cookie')
        if (!c) throw new Error('gemini web: no cookie')
        cookieCache = { value: c.split(';')[0], at: Date.now() }
        return cookieCache.value
    },
    ask: async function (prompt, previousId = null) {
        let resumeArray = null, cookie = null
        if (previousId) {
            try { const j = JSON.parse(Buffer.from(previousId, 'base64').toString('utf8')); resumeArray = j.newResumeArray; cookie = j.cookie } catch { previousId = null }
        }
        const headers = {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'x-goog-ext-525001261-jspb': '[1,null,null,null,"9ec249fc9ad08861",null,null,null,[4]]',
            cookie: cookie || await this.getNewCookie(),
        }
        const body = new URLSearchParams({ 'f.req': JSON.stringify([null, JSON.stringify([[prompt], ['en-US'], resumeArray])]) })
        const response = await fetch('https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c', { headers, body, method: 'POST', signal: AbortSignal.timeout(90000) })
        if (!response.ok) throw new Error('gemini web HTTP ' + response.status)
        const data = await response.text()
        const chunks = Array.from(data.matchAll(/^\d+\n(.+?)\n/gm), (x) => x[1])
        for (const chunk of chunks.reverse()) {
            try {
                const realArray = JSON.parse(chunk)
                const parse1 = JSON.parse(realArray[0][2])
                if (parse1?.[4]?.[0]?.[1]?.[0]) {
                    const id = Buffer.from(JSON.stringify({ newResumeArray: [...parse1[1], parse1[4][0][0]], cookie: headers.cookie })).toString('base64')
                    return { text: String(parse1[4][0][1][0]), id }
                }
            } catch {}
        }
        throw new Error('gemini web: parse failed')
    },
}

const SYS = `You are Silana, a warm and charming Moroccan AI companion inside WhatsApp. Your answer will be SPOKEN ALOUD as a voice note, so:
- Reply in the SAME language and dialect as the user (Moroccan Darija if they speak Darija, Arabic if Arabic, French if French, English if English).
- Keep it SHORT and conversational: at most 60 words, like talking to a close friend.
- NO markdown, no lists, no emojis, no links — only natural spoken words.
- Be warm, friendly and a little playful. Never say you are a language model unless asked.`

async function webAsk(chat, prompt, brief = false) {
    const t = store()
    const sid = t.web[chat] || null
    const p = brief ? prompt + '\n(Keep this answer extra short — one or two sentences.)' : prompt
    const full = sid ? p : SYS + '\n\n———\n' + p
    try {
        const r = await geminiWeb.ask(full, sid)
        t.web[chat] = r.id
        return r.text.trim()
    } catch (e) {
        if (sid) {
            delete t.web[chat]
            const r = await geminiWeb.ask(SYS + '\n\n———\n' + p, null)
            t.web[chat] = r.id
            return r.text.trim()
        }
        throw e
    }
}

/* ---------------- HeyGen voices ---------------- */

let voicesCache = null, voicesCacheAt = 0

async function fetchVoices() {
    if (voicesCache && Date.now() - voicesCacheAt < 3600000) return voicesCache
    const key = heygenKey()
    if (!key) throw new Error('aivoice: no HeyGen key set — the owner sets it once with .heygenkey <key> (free at platform.heygen.com)')
    let arr = null
    try {
        const res = await fetch('https://api.heygen.com/v3/models/audio/voices?type=public&limit=100', { headers: { 'X-Api-Key': key, accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
        const d = await res.json().catch(() => null)
        arr = d?.data?.voices || d?.data || d?.voices || []
    } catch {}
    if (!arr || !arr.length) {
        const res = await fetch('https://api.heygen.com/v2/voices', { headers: { 'X-Api-Key': key, accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
        const d = await res.json().catch(() => null)
        if (!res.ok || !d) throw new Error('aivoice: voices HTTP ' + res.status)
        arr = d?.data?.voices || d?.data || d?.voices || []
    }
    const voices = (Array.isArray(arr) ? arr : []).map((v) => ({
        id: v.voice_id || v.id || '',
        name: v.name || v.voice_name || 'Voice',
        language: v.language || v.language_code || '',
        gender: v.gender || '',
    })).filter((v) => v.id)
    if (!voices.length) throw new Error('aivoice: voices list is empty')
    // Arabic voices first (Silana speaks Darija/Arabic by default), then the rest
    voices.sort((a, b) => (/arab/i.test(b.language) ? 1 : 0) - (/arab/i.test(a.language) ? 1 : 0))
    voicesCache = voices
    voicesCacheAt = Date.now()
    return voices
}

async function currentVoice() {
    const t = store()
    if (t.voiceId) return t.voiceId
    const voices = await fetchVoices()
    const arFemale = voices.find((v) => /arab/i.test(v.language) && /female|woman/i.test(v.gender))
    const ar = voices.find((v) => /arab/i.test(v.language))
    const female = voices.find((v) => /female|woman/i.test(v.gender))
    return (arFemale || ar || female || voices[0]).id
}

async function heygenTts(text, voiceId) {
    const res = await fetch('https://api.heygen.com/v3/models/audio/tts', {
        method: 'POST',
        headers: { 'X-Api-Key': heygenKey(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: HEYGEN_MODEL, voice_id: voiceId, text }),
        signal: AbortSignal.timeout(90000),
    })
    const d = await res.json().catch(() => null)
    if (!res.ok) throw new Error('heygen tts HTTP ' + res.status + ' ' + (d?.error?.message || d?.message || ''))
    const find = (o, depth = 0) => {
        if (!o || depth > 5) return ''
        if (typeof o === 'string' && /^https?:\/\//.test(o) && /\.(mp3|wav|ogg|m4a)/i.test(o)) return o
        if (typeof o === 'object') { for (const v of Object.values(o)) { const r = find(v, depth + 1); if (r) return r } }
        return ''
    }
    const url = find(d)
    if (!url) throw new Error('heygen tts: no audio url in response')
    const r2 = await fetch(url, { signal: AbortSignal.timeout(90000) })
    if (!r2.ok) throw new Error('heygen tts: audio download HTTP ' + r2.status)
    return Buffer.from(await r2.arrayBuffer())
}

/* ---------------- Backup voice (Google Translate TTS) ---------------- */

async function googleTts(text) {
    const parts = []
    let rest = text
    while (rest.length) { parts.push(rest.slice(0, 190)); rest = rest.slice(190) }
    const bufs = []
    for (const p of parts.slice(0, 4)) {
        const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ar&q=' + encodeURIComponent(p)
        const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
        if (!r.ok) throw new Error('backup tts HTTP ' + r.status)
        bufs.push(Buffer.from(await r.arrayBuffer()))
    }
    return Buffer.concat(bufs)
}

/* ---------------- Speak: text → OGG Opus voice note ---------------- */

async function speak(conn, m, text) {
    const clean = String(text || '').replace(/[*_~`#>\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 700)
    if (!clean) throw new Error('aivoice: empty answer')
    try { await conn.sendPresenceUpdate('recording', m.chat) } catch {}
    let mp3 = null, usedBackup = false
    try {
        mp3 = await heygenTts(clean, await currentVoice())
    } catch (e) {
        mp3 = await googleTts(clean)
        usedBackup = true
    }
    ensureTmp()
    const inF = path.join(TMPDIR, `av-${stamp()}.mp3`)
    const outF = path.join(TMPDIR, `av-${stamp()}.ogg`)
    fs.writeFileSync(inF, mp3)
    await run('ffmpeg', ['-y', '-v', 'error', '-i', inF, '-ar', '48000', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', outF], { timeout: 120000 })
    const buf = fs.readFileSync(outF)
    try { fs.unlinkSync(inF); fs.unlinkSync(outF) } catch {}
    await conn.sendMessage(m.chat, { audio: buf, ptt: true, mimetype: 'audio/ogg; codecs=opus' }, { quoted: m })
    return usedBackup
}

/* ---------------- Handler ---------------- */

const busyUsers = new Map()
const BUSY_MS = 10 * 60 * 1000
function isBusy(sender) {
    const t = busyUsers.get(sender)
    if (!t) return false
    if (Date.now() - t > BUSY_MS) { busyUsers.delete(sender); return false }
    return true
}
const lastList = new Map() // sender -> { at, voices }

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const arg = String(text || '').trim()
    const fail = (e) => {
        console.error('[aivoice]', e)
        const raw = String(e?.message || e)
        return conn.reply(m.chat, '❌ ' + raw + (isOwner ? `\n🔧 Owner details: ${raw.slice(0, 180)}` : ''), m)
    }

    // ---- auto mode toggle (owner)
    if (/^(on|off)$/i.test(arg)) {
        if (!isOwner) return conn.reply(m.chat, '🔒 Only the owner can switch auto voice chat.', m)
        const t = store()
        if (arg.toLowerCase() === 'on') {
            t.chats[m.chat] = true
            return conn.reply(m.chat, '🎙️ *Auto voice chat ON* for this chat.\nJust talk — voice notes or plain messages — and Silana answers by voice. No command needed.\nPrivate chat: every message. Group: voice notes, or messages starting with "Silana".', m)
        }
        delete t.chats[m.chat]
        return conn.reply(m.chat, '🔕 Auto voice chat OFF for this chat. The .aivoice command still works.', m)
    }

    // ---- voice catalogue commands
    if (/^voices$/i.test(arg)) {
        try {
            const voices = await fetchVoices()
            lastList.set(m.sender, { at: Date.now(), voices })
            const lines = voices.slice(0, 30).map((v, i) => `${i + 1}. ${v.name}${v.language ? ' — ' + v.language : ''}${v.gender ? ' (' + v.gender + ')' : ''}`)
            return conn.reply(m.chat, `🎙️ *Silana's voices* (HeyGen)\n\n${lines.join('\n')}\n\nHear one: ${usedPrefix + command} sample <number>\nSet it (owner): ${usedPrefix + command} setvoice <number>`, m)
        } catch (e) { return fail(e) }
    }
    const sampleM = arg.match(/^sample\s+(\d+)$/i)
    const setM = arg.match(/^setvoice\s+(\d+)$/i)
    if (sampleM || setM) {
        const entry = lastList.get(m.sender)
        if (!entry || Date.now() - entry.at > 3600000) return conn.reply(m.chat, `First run ${usedPrefix + command} voices to load the list, then pick a number.`, m)
        const v = entry.voices[Number((sampleM || setM)[1]) - 1]
        if (!v) return conn.reply(m.chat, 'That number is not in the list.', m)
        if (setM) {
            if (!isOwner) return conn.reply(m.chat, '🔒 Only the owner chooses Silana\'s voice. You can still hear samples.', m)
            store().voiceId = v.id
            store().voiceName = v.name
            return conn.reply(m.chat, `✅ Silana's voice is now *${v.name}*.`, m)
        }
        if (isBusy(m.sender)) return conn.reply(m.chat, '⏳ One voice job at a time — wait a moment.', m)
        busyUsers.set(m.sender, Date.now())
        try {
            const buf = await heygenTts(SAMPLE_LINE, v.id)
            ensureTmp()
            const inF = path.join(TMPDIR, `avs-${stamp()}.mp3`)
            const outF = path.join(TMPDIR, `avs-${stamp()}.ogg`)
            fs.writeFileSync(inF, buf)
            await run('ffmpeg', ['-y', '-v', 'error', '-i', inF, '-ar', '48000', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', outF], { timeout: 120000 })
            const ogg = fs.readFileSync(outF)
            try { fs.unlinkSync(inF); fs.unlinkSync(outF) } catch {}
            return conn.sendMessage(m.chat, { audio: ogg, ptt: true, mimetype: 'audio/ogg; codecs=opus' }, { quoted: m })
        } catch (e) { return fail(e) } finally { busyUsers.delete(m.sender) }
    }
    if (/^reset$/i.test(arg)) {
        delete store().web[m.chat]
        return conn.reply(m.chat, '🧹 Conversation forgotten. Next message starts fresh.', m)
    }

    // ---- main flow: quoted voice note OR typed question
    const q = m.quoted
    const qMime = q?.mimetype || ''
    let question = arg
    if (!question && !q) {
        const cur = store().voiceName ? `\nCurrent voice: *${store().voiceName}*` : ''
        return conn.reply(m.chat,
            `🎙️ *Talk to Silana by voice*\n\n` +
            `• Quote a voice note with ${usedPrefix + command} — she listens and answers by voice\n` +
            `• Or type: ${usedPrefix + command} <your question>${cur}\n\n` +
            `Voices: ${usedPrefix + command} voices · hear one: ${usedPrefix + command} sample <n> · set (owner): ${usedPrefix + command} setvoice <n>\n` +
            `Auto chat in this chat (owner): ${usedPrefix + command} on / off\n` +
            `Forget the chat: ${usedPrefix + command} reset`, m)
    }
    if (isBusy(m.sender)) return conn.reply(m.chat, '⏳ Silana is already answering you — one voice at a time.', m)
    busyUsers.set(m.sender, Date.now())
    ensureTmp()
    try {
        if (!question && q) {
            if (!qMime.startsWith('audio/')) return conn.reply(m.chat, 'Quote a *voice note* or an audio file — or type your question after the command.', m)
            const seconds = Number(q.seconds || q.duration || 0)
            if (seconds > MAX_SECONDS) return conn.reply(m.chat, `That voice note is too long (${seconds}s). Max ${MAX_SECONDS}s.`, m)
            const media = await q.download()
            if (!media) throw new Error('aivoice: could not download the voice note')
            const rawF = path.join(TMPDIR, `avq-${stamp()}.bin`)
            const flacF = path.join(TMPDIR, `avq-${stamp()}.flac`)
            fs.writeFileSync(rawF, media)
            await toFlac(rawF, flacF)
            const flac = fs.readFileSync(flacF)
            try { fs.unlinkSync(rawF); fs.unlinkSync(flacF) } catch {}
            question = await transcribe(flac, 'ar-MA')
            if (!question) question = await transcribe(flac, 'ar-SA')
            if (!question) return conn.reply(m.chat, '🎙️ I could not make out any words in that voice note — try again, a bit closer to the mic.', m)
        }
        try { await conn.sendPresenceUpdate('composing', m.chat) } catch {}
        const answer = await webAsk(m.chat, question)
        const usedBackup = await speak(conn, m, answer)
        if (usedBackup && isOwner) return conn.reply(m.chat, '🔧 Owner note: HeyGen did not answer, so the backup voice was used. Check the HeyGen key/quota.', m)
    } catch (e) { return fail(e) } finally { busyUsers.delete(m.sender) }
}

handler.help = ['aivoice']
handler.tags = ['ai']
handler.command = /^(aivoice|aiv)$/i
handler.limit = false

/* ---------------- Auto mode (.aivoice on): open voice chat ---------------- */

const autoBusy = new Set()
handler.before = async function (m, { conn }) {
    try {
        if (!m || m.fromMe || !m.chat || m.chat === 'status@broadcast' || m.chat.endsWith('@broadcast') || m.chat.endsWith('@newsletter')) return
        const t = store()
        if (!t.chats[m.chat]) return
        const isGroup = m.chat.endsWith('@g.us')
        const type = m.mtype || ''
        let question = ''
        let audioBuf = null
        if (type === 'audioMessage') {
            const seconds = Number(m.msg?.seconds || m.seconds || 0)
            if (seconds > MAX_SECONDS) return
            audioBuf = await m.download().catch(() => null)
            if (!audioBuf) return
        } else if (type === 'conversation' || type === 'extendedTextMessage') {
            const txt = String(m.text || '').trim()
            if (!txt || /^[.!/#]/.test(txt)) return // commands are not chat
            if (isGroup) {
                const nm = txt.match(/^(silana|سيلانا)\b[،,:]?\s*/i)
                if (!nm) return
                question = txt.slice(nm[0].length).trim()
                if (!question) return
            } else question = txt
        } else return
        if (autoBusy.has(m.chat)) return
        autoBusy.add(m.chat)
        ensureTmp()
        try {
            try { await conn.sendPresenceUpdate('recording', m.chat) } catch {}
            if (audioBuf) {
                const rawF = path.join(TMPDIR, `ava-${stamp()}.bin`)
                const flacF = path.join(TMPDIR, `ava-${stamp()}.flac`)
                fs.writeFileSync(rawF, audioBuf)
                await toFlac(rawF, flacF)
                const flac = fs.readFileSync(flacF)
                try { fs.unlinkSync(rawF); fs.unlinkSync(flacF) } catch {}
                question = await transcribe(flac, 'ar-MA')
                if (!question) question = await transcribe(flac, 'ar-SA')
                if (!question) return
            }
            const answer = await webAsk(m.chat, question, true)
            await speak(conn, m, answer)
        } catch (e) { console.error('[aivoice-auto]', e) } finally { autoBusy.delete(m.chat) }
    } catch {}
}

export default handler
