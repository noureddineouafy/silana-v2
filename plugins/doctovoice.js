/**
 * doctovoice.js — Hear your lessons: documents read aloud in Silana's voice
 *
 *   .doctovoice <text>          → type (or quote) any text, get it back
 *                                 as one audio file, read in the voice
 *                                 chosen in .aivoice (HeyGen).
 *   .doctovoice                 → quote a PDF or TXT document with this
 *                                 command and it is read to you.
 *
 * Built for lessons: quote the PDF that .doroos gave you and listen
 * instead of reading. Text is split into parts, each part is spoken by
 * HeyGen, and the parts are joined into a single MP3.
 *
 * Voices: your .aivoice choice wins. Otherwise the voice follows the
 * text — Arabic script → first Arabic female voice, French-looking
 * Latin text → first French female voice, else English.
 *
 * PDF note: text is extracted locally (no uploads). Most simple PDFs
 * work; some Arabic PDFs store text as glyph codes that cannot be
 * extracted — then the bot says so, and pasting the text works instead.
 *
 * Limits: 6,000 characters per document (owner: 15,000).
 */

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { execFile } from 'child_process'
import { promisify } from 'util'

const run = promisify(execFile)
const HEYGEN_MODEL = 'heygen-voice-1-turbo-free'
const CHUNK = 450
const LIMIT_NORMAL = 6000
const LIMIT_OWNER = 15000

const TMPDIR = path.join(process.cwd(), 'tmp', 'doctovoice')
function ensureTmp() { try { fs.mkdirSync(TMPDIR, { recursive: true }) } catch {} }
ensureTmp()
process.env.TMPDIR = path.join(process.cwd(), 'tmp')
const stamp = () => Date.now() + '-' + Math.floor(Math.random() * 1e6)

function heygenKey() { try { return global.db.data.settings?.heygenKey || '' } catch { return '' } }
function chosenVoiceId() { try { return global.db.data.settings?.aivoice?.voiceId || '' } catch { return '' } }

/* ---------------- Text sources ---------------- */

function decodePdfString(s) {
    return s.replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
        .replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
}

function extractPdfText(buf) {
    const raw = buf.toString('latin1')
    const texts = []
    const streamRe = /stream\r?\n/g
    let m
    while ((m = streamRe.exec(raw))) {
        const start = m.index + m[0].length
        const end = raw.indexOf('endstream', start)
        if (end < 0) break
        let content = null
        try { content = zlib.inflateSync(buf.subarray(start, end)).toString('latin1') } catch { content = raw.slice(start, end) }
        if (!content || !/Tj|TJ/.test(content)) continue
        const tj = [...content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((x) => decodePdfString(x[1]))
        const tjArr = [...content.matchAll(/\[((?:\\.|[^\]])*)\]\s*TJ/g)].map((x) =>
            [...x[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((y) => decodePdfString(y[1])).join(''))
        const hex = [...content.matchAll(/<([0-9A-Fa-f\s]{8,})>\s*Tj/g)].map((x) => {
            const h = x[1].replace(/\s/g, '')
            try {
                const b = Buffer.from(h, 'hex')
                return b.length > 1 && b[0] === 0xfe && b[1] === 0xff ? b.toString('utf16le') : ''
            } catch { return '' }
        })
        texts.push([...tj, ...tjArr, ...hex].join(' '))
    }
    return texts.join('\n').replace(/[^\S\n]+/g, ' ').trim()
}

function splitChunks(text) {
    const clean = String(text).replace(/\s+/g, ' ').trim()
    const sentences = clean.match(/[^.!?؟…\n]+[.!?؟…]*\s*/g) || [clean]
    const chunks = []
    let cur = ''
    for (const s of sentences) {
        if ((cur + s).length > CHUNK && cur) { chunks.push(cur.trim()); cur = '' }
        if (s.length > CHUNK) {
            let rest = s
            while (rest.length > CHUNK) { chunks.push(rest.slice(0, CHUNK).trim()); rest = rest.slice(CHUNK) }
            cur = rest
        } else cur += s
    }
    if (cur.trim()) chunks.push(cur.trim())
    return chunks.filter(Boolean)
}

function detectLang(text) {
    const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length
    if (arabic > text.length * 0.25) return 'ar'
    if (/\b(le|la|les|des|est|une|dans|pour|qui|avec|sur|plus|être|aux)\b/i.test(text)) return 'fr'
    return 'en'
}

/* ---------------- HeyGen ---------------- */

let voicesCache = null, voicesCacheAt = 0
async function fetchVoices() {
    if (voicesCache && Date.now() - voicesCacheAt < 3600000) return voicesCache
    const key = heygenKey()
    if (!key) throw new Error('No HeyGen key set — the owner sets it once with .heygenkey <key> (free at platform.heygen.com)')
    let arr = null
    try {
        const res = await fetch('https://api.heygen.com/v3/models/audio/voices?type=public&limit=100', { headers: { 'X-Api-Key': key, accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
        const d = await res.json().catch(() => null)
        arr = d?.data?.voices || d?.data || d?.voices || []
    } catch {}
    if (!arr || !arr.length) {
        const res = await fetch('https://api.heygen.com/v2/voices', { headers: { 'X-Api-Key': key, accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
        const d = await res.json().catch(() => null)
        if (!res.ok || !d) throw new Error('voices HTTP ' + res.status)
        arr = d?.data?.voices || d?.data || d?.voices || []
    }
    const voices = (Array.isArray(arr) ? arr : []).map((v) => ({
        id: v.voice_id || v.id || '',
        language: v.language || v.language_code || '',
        gender: v.gender || '',
    })).filter((v) => v.id)
    if (!voices.length) throw new Error('HeyGen returned no voices')
    voicesCache = voices
    voicesCacheAt = Date.now()
    return voices
}

async function voiceFor(text) {
    const picked = chosenVoiceId()
    if (picked) return picked
    const voices = await fetchVoices()
    const lang = detectLang(text)
    const want = lang === 'ar' ? /arab/i : lang === 'fr' ? /french/i : /english/i
    const f = voices.find((v) => want.test(v.language) && /female|woman/i.test(v.gender))
    const any = voices.find((v) => want.test(v.language))
    return (f || any || voices[0]).id
}

async function heygenTts(text, voiceId) {
    const res = await fetch('https://api.heygen.com/v3/models/audio/tts', {
        method: 'POST',
        headers: { 'X-Api-Key': heygenKey(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: HEYGEN_MODEL, voice_id: voiceId, text }),
        signal: AbortSignal.timeout(90000),
    })
    const d = await res.json().catch(() => null)
    if (!res.ok) throw new Error('HeyGen TTS HTTP ' + res.status + ': ' + (d?.error?.message || d?.message || ''))
    const find = (o, depth = 0) => {
        if (!o || depth > 5) return ''
        if (typeof o === 'string' && /^https?:\/\//.test(o) && /\.(mp3|wav|ogg|m4a)/i.test(o)) return o
        if (typeof o === 'object') { for (const v of Object.values(o)) { const r = find(v, depth + 1); if (r) return r } }
        return ''
    }
    const url = find(d)
    if (!url) throw new Error('HeyGen TTS: no audio URL in the response')
    const r2 = await fetch(url, { signal: AbortSignal.timeout(90000) })
    if (!r2.ok) throw new Error('HeyGen TTS: audio download HTTP ' + r2.status)
    return Buffer.from(await r2.arrayBuffer())
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

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const arg = String(text || '').trim()
    const fail = (e) => {
        console.error('[doctovoice]', e)
        const raw = String(e?.message || e)
        return conn.reply(m.chat, '❌ ' + raw + (isOwner ? `\n🔧 Owner details: ${raw.slice(0, 200)}` : ''), m)
    }
    const q = m.quoted
    const qMime = q?.mimetype || ''

    let fullText = arg
    let title = ''
    if (!fullText && q && !qMime.startsWith('application/pdf') && !qMime.startsWith('text/')) {
        fullText = String(q.text || q.caption || '').trim()
    }
    if (!fullText && !q) {
        return conn.reply(m.chat,
            `🔊 *Hear your lessons*\n\n` +
            `• ${usedPrefix + command} <text> — I read it aloud in Silana's voice\n` +
            `• Or quote a *PDF* or *TXT* document with ${usedPrefix + command}\n` +
            `• Or quote any long text message with ${usedPrefix + command}\n\n` +
            `You get one audio file you can play, pause and forward.`, m)
    }
    if (isBusy(m.sender)) return conn.reply(m.chat, '⏳ I am already reading something for you — one document at a time.', m)
    busyUsers.set(m.sender, Date.now())
    ensureTmp()
    const jobFiles = []
    try {
        if (!fullText && q) {
            const media = await q.download()
            if (!media) throw new Error('could not download the quoted document')
            if (qMime.startsWith('application/pdf')) {
                title = String(q.fileName || 'document.pdf')
                fullText = extractPdfText(media)
                if (fullText.replace(/\s/g, '').length < 40) {
                    return conn.reply(m.chat, '📄 I could not extract readable text from this PDF (some PDFs store text as glyph codes). Paste the text with the command instead and I will read it.', m)
                }
            } else if (qMime.startsWith('text/')) {
                title = String(q.fileName || 'document.txt')
                fullText = media.toString('utf8')
            } else {
                return conn.reply(m.chat, 'Quote a *PDF* or *TXT* document — or paste the text with the command.', m)
            }
        }
        const limit = isOwner ? LIMIT_OWNER : LIMIT_NORMAL
        if (fullText.length > limit) fullText = fullText.slice(0, limit)
        const chunks = splitChunks(fullText)
        if (!chunks.length) return conn.reply(m.chat, 'There is no readable text to read.', m)
        await conn.reply(m.chat, `🔊 Reading ${title ? `*${title}*` : 'your text'} — ${chunks.length} part(s). This takes a moment…`, m)
        try { await conn.sendPresenceUpdate('recording', m.chat) } catch {}
        const voiceId = await voiceFor(fullText)
        const parts = []
        for (let i = 0; i < chunks.length; i++) {
            const mp3 = await heygenTts(chunks[i], voiceId)
            const f = path.join(TMPDIR, `part-${stamp()}-${i}.mp3`)
            jobFiles.push(f)
            fs.writeFileSync(f, mp3)
            parts.push(f)
        }
        const out = path.join(TMPDIR, `doc-${stamp()}.mp3`)
        jobFiles.push(out)
        if (parts.length === 1) {
            fs.copyFileSync(parts[0], out)
        } else {
            const listFile = path.join(TMPDIR, `list-${stamp()}.txt`)
            jobFiles.push(listFile)
            fs.writeFileSync(listFile, parts.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'))
            await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', '-ar', '44100', out], { timeout: 300000 })
        }
        const buf = fs.readFileSync(out)
        await conn.sendMessage(m.chat, { audio: buf, mimetype: 'audio/mpeg', fileName: (title ? title.replace(/\.[^.]+$/, '') : 'silana-reading') + '.mp3', caption: `🔊 ${title || 'Your text'} — read by Silana (${chunks.length} part(s))` }, { quoted: m })
    } catch (e) { return fail(e) } finally {
        busyUsers.delete(m.sender)
        for (const f of jobFiles) { try { fs.unlinkSync(f) } catch {} }
    }
}

handler.help = ['doctovoice']
handler.tags = ['ai']
handler.command = /^(doctovoice|readforme)$/i
handler.limit = false

export default handler
