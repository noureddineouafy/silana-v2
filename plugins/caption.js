// sub.js — كابشن احترافي متزامن مع الكلام (.sub) — v5
// ─────────────────────────────────────────────────────────────────────────────
// رد (quote) على أي فيديو واكتب .sub → البوت كيحلل الصوت، كيقطع الكلام
// لجمل عند الوقفات الطبيعية (عتبة سكوت تكيفية)، كينسخ كل جملة بوحدها،
// وكيحرق كابشن ملتصق بتوقيت الجملة الحقيقي — بخط Rubik العريض.
//
//   .sub        → لغة الكلام: العربية/الدارجة (افتراضي)
//   .sub en|fr|es → كابشن بلغة الكلام الأصلية
//
// حدود تقنية: فيديو ≤ 3 دقائق و ≤ 60MB، خدمة واحدة في نفس الوقت.
// أول استعمال كينزل خط Rubik مرة واحدة (~175KB).
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

process.env.TMPDIR = path.join(process.cwd(), 'tmp')

const GKEY = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw' // مفتاح Chromium العمومي (نفسه في stt.js)

const MAX_DUR = 180
const MAX_SIZE = 60 * 1024 * 1024

const FONT_DIR = path.join(process.cwd(), 'assets', 'sub-fonts')
const RUBIK_PATH = path.join(FONT_DIR, 'rubik.ttf')
const RUBIK_URL = 'https://fonts.gstatic.com/s/rubik/v31/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-4I-1UA.ttf'
const KUFI_PATH = path.join(FONT_DIR, 'kufi-black.ttf')
const KUFI_URL = 'https://fonts.gstatic.com/s/notokufiarabic/v27/CSRp4ydQnPyaDxEXLFF6LZVLKrodhu8t57o1kDc5Wh7G2IbP.ttf'

const LANGS = {
    ar: 'ar-MA', darija: 'ar-MA',
    en: 'en-US', english: 'en-US',
    fr: 'fr-FR', french: 'fr-FR',
    es: 'es-ES', spanish: 'es-ES',
}

let busy = false
let capsCache = null

async function ffmpegCaps() {
    if (capsCache) return capsCache
    let filters = '', encoders = ''
    try { filters = (await run('ffmpeg', ['-hide_banner', '-filters'], { timeout: 20000 })).stdout } catch {}
    try { encoders = (await run('ffmpeg', ['-hide_banner', '-encoders'], { timeout: 20000 })).stdout } catch {}
    capsCache = {
        ass: /(^|\s)(ass|subtitles)\s/.test(filters),
        drawtext: /\sdrawtext\s/.test(filters),
        x264: /\slibx264\s/.test(encoders),
    }
    return capsCache
}

async function ensureFont() {
    fs.mkdirSync(FONT_DIR, { recursive: true })
    const okFile = p => { try { return fs.statSync(p).size > 30000 } catch { return false } }
    const grab = async (url, dest) => {
        const res = await fetch(url)
        if (!res.ok) return false
        fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
        return okFile(dest)
    }
    if (okFile(RUBIK_PATH)) return 'Rubik'
    try { if (await grab(RUBIK_URL, RUBIK_PATH)) return 'Rubik' } catch {}
    if (okFile(KUFI_PATH)) return 'Noto Kufi Arabic'
    try { if (await grab(KUFI_URL, KUFI_PATH)) return 'Noto Kufi Arabic' } catch {}
    return null
}

async function download(url, dest) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download HTTP ${res.status}`)
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

async function probeFfmpeg(file) {
    let txt = ''
    try { await run('ffmpeg', ['-hide_banner', '-i', file], { timeout: 20000 }) }
    catch (e) { txt = String(e.stderr || '') }
    const dm = txt.match(/Duration: (\d+):(\d+):([\d.]+)/)
    const vm = txt.match(/Video:[^\n]*?(\d{3,5})x(\d{3,5})/)
    return {
        duration: dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + parseFloat(dm[3]) : 0,
        width: vm ? +vm[1] : 720,
        height: vm ? +vm[2] : 1280,
        hasAudio: /:\s*Audio:/.test(txt),
    }
}

async function probe(file) {
    try {
        const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', file], { timeout: 20000 })
        const j = JSON.parse(stdout)
        const v = (j.streams || []).find(s => s.codec_type === 'video') || {}
        const r = { duration: parseFloat(j.format?.duration || 0), width: v.width || 720, height: v.height || 1280, hasAudio: (j.streams || []).some(s => s.codec_type === 'audio') }
        if (r.duration > 0) return r
    } catch {}
    return probeFfmpeg(file)
}

// عتبة تكيفية: كنقيسو مستوى الصوت العام ونحطو عتبة السكوت تحتو بـ 14dB
async function adaptiveNoise(wav) {
    try {
        const r = await run('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'astats=metadata=1', '-f', 'null', '-'], { timeout: 60000 })
        const mm = String(r.stderr || '').match(/RMS level dB: (-?[\d.]+)/)
        if (mm) {
            const rms = parseFloat(mm[1])
            return Math.max(-48, Math.min(-26, rms - 14))
        }
    } catch {}
    return -33
}

async function detectSilences(wav, noiseDb, minDur) {
    let log = ''
    try {
        const r = await run('ffmpeg', ['-hide_banner', '-i', wav, '-af', `silencedetect=noise=${noiseDb}dB:d=${minDur}`, '-f', 'null', '-'], { timeout: 90000 })
        log = String(r.stderr || '')
    } catch (e) { log = String(e.stderr || '') }
    const silences = []
    let cur = null
    for (const line of log.split('\n')) {
        let mm = line.match(/silence_start: ([\d.]+)/)
        if (mm) cur = parseFloat(mm[1])
        mm = line.match(/silence_end: ([\d.]+)/)
        if (mm && cur !== null) { silences.push([cur, parseFloat(mm[1])]); cur = null }
    }
    return { silences, openStart: cur }
}

// تقطيع الكلام لجمل: وقفة ≥0.35s كتقطع الجملة، والجمل الطويلة (>6.5s)
// كتقطع عند أطول وقفة داخلية — كل جملة غادي تتنسخ بوحدها = تزامن دقيق
async function detectPhrases(wav, duration) {
    const noiseDb = await adaptiveNoise(wav)
    const { silences, openStart } = await detectSilences(wav, noiseDb, 0.22)
    const all = [...silences]
    if (openStart !== null) all.push([openStart, duration])
    // الكلام = ما بين السكوتات
    const speech = []
    let prev = 0
    for (const [s, e] of all) { if (s - prev > 0.05) speech.push([prev, s]); prev = Math.max(prev, e) }
    if (duration - prev > 0.05) speech.push([prev, duration])
    // الجمل: دمج الكلام المفصول بوقفة قصيرة (<0.35s)
    const phrases = []
    for (const [s, e] of speech) {
        if (e - s < 0.25) continue
        const last = phrases[phrases.length - 1]
        if (last && s - last[1] < 0.35) last[1] = e
        else phrases.push([s, e])
    }
    // تقطيع الجمل الطويلة عند أطول وقفة داخلية
    const out = []
    const splitLong = (s, e, depth) => {
        if (e - s <= 6.5 || depth > 4) { out.push([s, e]); return }
        let best = null
        for (const [ss, ee] of all) {
            if (ss > s + 0.8 && ee < e - 0.8 && (!best || ee - ss > best[1] - best[0])) best = [ss, ee]
        }
        if (best) { const mid = (best[0] + best[1]) / 2; splitLong(s, best[0] + 0.05, depth + 1); splitLong(best[1] - 0.05, e, depth + 1) }
        else { const mid = s + (e - s) / 2; splitLong(s, mid, depth + 1); splitLong(mid, e, depth + 1) }
    }
    for (const [s, e] of phrases) splitLong(s, e, 0)
    return out.sort((a, b) => a[0] - b[0])
}

async function transcribe(flacBuf, lang) {
    const res = await fetch(`https://www.google.com/speech-api/v2/recognize?output=json&lang=${lang}&key=${GKEY}&pfilter=0`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/x-flac; rate=16000' },
        body: flacBuf,
    })
    if (!res.ok) throw new Error(`speech HTTP ${res.status}`)
    const body = await res.text()
    for (const line of body.split('\n')) {
        if (!line.trim()) continue
        try {
            const json = JSON.parse(line)
            const alt = json?.result?.[0]?.alternative?.[0]?.transcript
            if (alt) return alt.trim()
        } catch {}
    }
    return ''
}

function assTime(t) {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
    return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`
}

function wrapText(text, perLine = 30) {
    const words = text.split(/\s+/).filter(Boolean)
    const lines = []
    let cur = ''
    for (const w of words) {
        if ((cur + ' ' + w).trim().length > perLine && cur) { lines.push(cur.trim()); cur = w }
        else cur += ' ' + w
        if (lines.length === 2) break
    }
    if (cur.trim() && lines.length < 3) lines.push(cur.trim())
    return lines.join('\\N')
}

function buildAss(events, w, h, fontName) {
    const fontSize = Math.max(34, Math.round(h / 23))
    const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H8C000000,1,0,0,0,100,100,0,0,3,${Math.max(9, Math.round(fontSize / 5))},0,2,20,20,${Math.round(h * 0.08)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
    const fx = '{\\fad(60,120)\\fscx94\\fscy94\\t(0,90,\\fscx104\\fscy104)\\t(90,190,\\fscx100\\fscy100)}'
    const lines = events.map(ev => {
        const text = wrapText(ev.text).replace(/\{/g, '(').replace(/\}/g, ')')
        return `Dialogue: 0,${assTime(ev.start)},${assTime(ev.end)},Cap,,0,0,0,,${fx}${text}`
    }).join('\n')
    return head + lines + '\n'
}

const escFilterPath = p => p.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:')

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''
    const isVideo = /video/.test(mime) || q.mtype === 'videoMessage'

    if (!isVideo) {
        return conn.reply(m.chat,
            `🎬 *ترجمة الفيديو التلقائية* (v5)\n\n` +
            `رد على أي فيديو واكتب:\n` +
            `> ${usedPrefix + command}\n\n` +
            `الكابشن كيبان غير مع الكلام وكيتسالا مع السكوت 🎯\n` +
            `اللغات: افتراضي العربية/الدارجة — أو ${usedPrefix + command} en / fr / es\n` +
            `الحدود: ≤ 3 دقائق، ≤ 60MB.`, m)
    }
    if (busy) return conn.reply(m.chat, '⏳ كاينة خدمة أخرى كتتصايب… تسنى شوية وعاود.', m)

    const langKey = (args[0] || 'ar').toLowerCase()
    const lang = LANGS[langKey]
    if (!lang) return conn.reply(m.chat, `⚠️ اللغات المتوفرة: ar (افتراضي)، en، fr، es\nمثال: ${usedPrefix + command} en`, m)

    const caps = await ffmpegCaps()
    if (!caps.ass || !caps.x264) {
        return conn.reply(m.chat, '❌ سيرفر البوت ما فيهش مكتبة حرق الترجمة (libass).\n🔧 تفاصيل للمالك: ffmpeg بلا ass/subtitles filter أو بلا libx264.', m)
    }

    let dir
    busy = true
    try {
        await conn.reply(m.chat, '🎬 *كنصايب الكابشن الاحترافي…*\nكنحلل الكلام والسكوت باش الكابشن يتناسق مع الصوت 🎯', m)

        dir = fs.mkdtempSync(path.join(process.env.TMPDIR, 'sub-'))
        fs.mkdirSync(dir, { recursive: true })
        const input = path.join(dir, 'in.mp4')
        // التنزيل عبر Baileys أولا دائما: روابط ميديا واتساب مشفرة
        let gotBuf = null
        try { gotBuf = await q.download() } catch {}
        if (gotBuf && gotBuf.length > 10000) fs.writeFileSync(input, gotBuf)
        else {
            const mediaUrl = q.msg?.url || q.url
            if (mediaUrl && /^https?:/.test(mediaUrl)) await download(mediaUrl, input)
            else throw new Error('download: تعذر تنزيل الفيديو')
        }
        const size = fs.statSync(input).size
        if (size > MAX_SIZE) throw new Error('size: الفيديو كبير بزاف (الحد 60MB)')

        const meta = await probe(input)
        if (meta.duration > MAX_DUR) throw new Error(`duration: الفيديو طويل (${Math.round(meta.duration)}s) — الحد ${MAX_DUR}s`)
        if (meta.duration > 0 && !meta.hasAudio) throw new Error('audio: الفيديو ما فيهش صوت')

        // استخراج الصوت الكامل
        const wav = path.join(dir, 'audio.wav')
        try {
            await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vn', '-ac', '1', '-ar', '16000', wav], { timeout: 120000 })
        } catch (e) {
            const tail = String(e.stderr || e.message || '').replace(/\s+/g, ' ').slice(-260)
            throw new Error(`segment: ملف الفيديو ما تقراش (${Math.round(size / 1024)}KB) — ${tail}`)
        }
        if (!meta.duration) {
            const p = await probeFfmpeg(wav)
            meta.duration = p.duration || 0
            if (!meta.duration) throw new Error('probe: ما قدرتش نحدد مدة الفيديو')
            if (meta.duration > MAX_DUR) throw new Error(`duration: الفيديو طويل — الحد ${MAX_DUR}s`)
        }

        // تقطيع الكلام لجمل عند الوقفات الطبيعية — كل جملة كتتنسخ بوحدها
        let phrases = await detectPhrases(wav, meta.duration)
        if (!phrases.length) {
            for (let s = 0; s < meta.duration; s += 5) phrases.push([s, Math.min(meta.duration, s + 5)])
        }

        // نسخ كل جملة وربط النص بتوقيتها الحقيقي
        const events = []
        for (let i = 0; i < phrases.length; i++) {
            const [ps, pe] = phrases[i]
            const flac = path.join(dir, `p${i}.flac`)
            try {
                await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.max(0, ps - 0.12)), '-t', String(pe - ps + 0.24), '-i', wav, '-ac', '1', '-ar', '16000', flac], { timeout: 60000 })
            } catch { continue }
            let text = ''
            try { text = await transcribe(fs.readFileSync(flac), lang) } catch {}
            if (!text) continue
            const start = Math.max(0, ps - 0.03)
            let end = pe + 0.05
            if (end - start < 0.8) end = start + 0.8
            events.push({ start, end: Math.min(end, meta.duration), text })
        }
        if (!events.length) throw new Error('stt: ما سمعت حتى كلام واضح في الفيديو')

        // الخط + ملف الترجمة
        const fontName = await ensureFont()
        const assPath = path.join(dir, 'caps.ass')
        fs.writeFileSync(assPath, buildAss(events, meta.width, meta.height, fontName || 'Sans'))

        // الحرق + الواترمارك
        await conn.reply(m.chat, `✅ لقيت ${events.length} كابشن متزامن — دابا كنحرقهم على الفيديو…`, m)
        const out = path.join(dir, 'sub.mp4')
        const wmSize = Math.max(18, Math.round(meta.height / 40))
        let vf = `ass='${escFilterPath(assPath)}'`
        if (fontName) vf += `:fontsdir='${escFilterPath(FONT_DIR)}'`
        if (caps.drawtext) {
            vf += `,drawtext=text='silana_ai':fontcolor=white@0.45:fontsize=${wmSize}:shadowcolor=black@0.4:shadowx=1:shadowy=1:x=w-tw-20:y=h-${Math.round(meta.height * 0.088)}`
        }
        try {
            await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vf', vf,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out],
                { timeout: 30 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 })
        } catch (e) {
            const tail = (e.stderr || e.message || '').toString().slice(-300)
            throw new Error('encode: ' + tail.replace(/\s+/g, ' '))
        }
        if (!fs.existsSync(out) || fs.statSync(out).size < 10000) throw new Error('encode: المخرجات خاوية')

        await conn.sendFile(m.chat, out, 'silana-sub.mp4',
            `🎬 *صافي!* كابشن احترافي متزامن مع الكلام — ${events.length} كابشن.\n⚡ SILANA AI`, m)

    } catch (e) {
        const msg = String(e.message || e)
        if (/^(size|duration|audio|stt):/.test(msg))
            return conn.reply(m.chat, '⚠️ ' + msg.split(': ').slice(1).join(': '), m)
        return conn.reply(m.chat,
            '❌ وقع مشكل أثناء صناعة الكابشن.\n🔧 تفاصيل للمالك: ' + msg.slice(0, 280), m)
    } finally {
        busy = false
        if (dir) try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
    }
}

handler.help = ['|caption']
handler.tags = ['ai']
handler.command = /^(sub|caption)$/i
handler.limit = false

export default handler
