// plugins/audiotranslate.js — ترجمة المقاطع الصوتية لأي لغة (تفريغ + ترجمة + دبلجة صوتية)
// رد على بصمة صوتية / مقطع صوتي / فيديو، والبوت:
//   1) كيفرغ الكلام لنص (Google Speech — نفس محرك .audiototxt، مقسم لمقاطع)
//   2) كيكشف لغة الأصل تلقائياً (أو حددها نتا)
//   3) كيترجم بمحرك Google Translate (translate-pa) مع بدائل احتياطية
//   4) كيرجع الترجمة مكتوبة + بصمة صوتية مدبلجة بلغة الهدف (صوت Edge العصبي)
//
// الاستعمال:
//   .audiotranslate en            ترجمة للإنكليزية (الأصل كيكتشف تلقائياً)
//   .audiotranslate fr            للفرنسية — أي لغة بغيتي: es de it pt tr ru zh ja ko hi ur fa id nl uk sv pl...
//   .audiotranslate ar en         من العربية للإنكليزية (تحديد الأصل)
//   .audiotranslate en text       غير النص بلا دبلجة صوتية (أو كتب: نص)
// الحدود: الصوت حتى 5 دقائق / 25MB. بلا حدود استعمال.

import { spawn, execFile } from 'child_process'
import { createRequire } from 'module'
import { mkdirSync, writeFileSync, unlinkSync, readdirSync, promises as fsp } from 'fs'
import path from 'path'

process.env.TMPDIR = path.join(process.cwd(), 'tmp')
const require = createRequire(import.meta.url)

const GKEY = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw'
const PA_KEY = 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520'
const MAX_SECONDS = 300
const MAX_SIZE = 25 * 1024 * 1024
const DUB_MAX_CHARS = 3000
let busy = false

// كود اللغة -> كود التعرف الصوتي / صوت Edge (نسائي افتراضيا) / الاسم بالعربية
const LANGS = {
    ar: { stt: 'ar-MA', voice: 'ar-MA-MounaNeural', name: 'العربية' },
    en: { stt: 'en-US', voice: 'en-US-AvaNeural', name: 'الإنكليزية' },
    fr: { stt: 'fr-FR', voice: 'fr-FR-DeniseNeural', name: 'الفرنسية' },
    es: { stt: 'es-ES', voice: 'es-ES-ElviraNeural', name: 'الإسبانية' },
    de: { stt: 'de-DE', voice: 'de-DE-KatjaNeural', name: 'الألمانية' },
    it: { stt: 'it-IT', voice: 'it-IT-ElsaNeural', name: 'الإيطالية' },
    pt: { stt: 'pt-PT', voice: 'pt-BR-FranciscaNeural', name: 'البرتغالية' },
    tr: { stt: 'tr-TR', voice: 'tr-TR-EmelNeural', name: 'التركية' },
    ru: { stt: 'ru-RU', voice: 'ru-RU-SvetlanaNeural', name: 'الروسية' },
    zh: { stt: 'zh-CN', voice: 'zh-CN-XiaoxiaoNeural', name: 'الصينية' },
    ja: { stt: 'ja-JP', voice: 'ja-JP-NanamiNeural', name: 'اليابانية' },
    ko: { stt: 'ko-KR', voice: 'ko-KR-SunHiNeural', name: 'الكورية' },
    hi: { stt: 'hi-IN', voice: 'hi-IN-SwaraNeural', name: 'الهندية' },
    ur: { stt: 'ur-PK', voice: 'ur-PK-UzmaNeural', name: 'الأردية' },
    fa: { stt: 'fa-IR', voice: 'fa-IR-DilaraNeural', name: 'الفارسية' },
    id: { stt: 'id-ID', voice: 'id-ID-GadisNeural', name: 'الإندونيسية' },
    ms: { stt: 'ms-MY', voice: '', name: 'الماليزية' },
    nl: { stt: 'nl-NL', voice: 'nl-NL-FennaNeural', name: 'الهولندية' },
    uk: { stt: 'uk-UA', voice: 'uk-UA-PolinaNeural', name: 'الأوكرانية' },
    sv: { stt: 'sv-SE', voice: 'sv-SE-SofieNeural', name: 'السويدية' },
    pl: { stt: 'pl-PL', voice: 'pl-PL-AgnieszkaNeural', name: 'البولندية' },
    bn: { stt: 'bn-IN', voice: '', name: 'البنغالية' },
    vi: { stt: 'vi-VN', voice: '', name: 'الفيتنامية' },
    th: { stt: 'th-TH', voice: '', name: 'التايلاندية' },
}
const ALIASES = {
    arabic: 'ar', arabe: 'ar', عربي: 'ar', العربية: 'ar',
    english: 'en', anglais: 'en', انجليزية: 'en', الإنكليزية: 'en', الانجليزية: 'en',
    french: 'fr', francais: 'fr', français: 'fr', فرنسية: 'fr', الفرنسية: 'fr',
    spanish: 'es', espagnol: 'es', اسبانية: 'es', الإسبانية: 'es',
    german: 'de', allemand: 'de', المانية: 'de', الألمانية: 'de',
    italian: 'it', italien: 'it', ايطالية: 'it',
    portuguese: 'pt', portugais: 'pt', برتغالية: 'pt',
    turkish: 'tr', turc: 'tr', تركية: 'tr',
    russian: 'ru', russe: 'ru', روسية: 'ru',
    chinese: 'zh', chinois: 'zh', صينية: 'zh',
    japanese: 'ja', japonais: 'ja', يابانية: 'ja',
    korean: 'ko', كورية: 'ko',
    hindi: 'hi', هندية: 'hi',
    urdu: 'ur', اردو: 'ur', الأردية: 'ur',
    persian: 'fa', farsi: 'fa', فارسية: 'fa',
    indonesian: 'id', اندونيسية: 'id',
    malay: 'ms', ماليزية: 'ms',
    dutch: 'nl', هولندية: 'nl',
    ukrainian: 'uk', اوكرانية: 'uk',
    swedish: 'sv', سويدية: 'sv',
    polish: 'pl', بولندية: 'pl',
}
const DETECT = [['ar-MA', 'ar'], ['en-US', 'en'], ['fr-FR', 'fr'], ['es-ES', 'es']]

function resolveLang(tok) {
    if (!tok) return null
    const t = String(tok).toLowerCase()
    if (LANGS[t]) return t
    if (ALIASES[t]) return ALIASES[t]
    const base = t.split('-')[0]
    if (LANGS[base]) return base
    return null
}

function run(cmd, args, timeout) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args)
        let se = ''
        if (p.stderr) p.stderr.on('data', (d) => { se += d })
        if (p.stdin) p.stdin.on('error', () => {})
        const timer = setTimeout(() => { try { p.kill('SIGKILL') } catch {} reject(new Error('timeout')) }, timeout || 120000)
        p.on('error', (e) => { clearTimeout(timer); reject(e) })
        p.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(se.slice(-200) || `exit ${code}`)) })
    })
}

function probeSeconds(file) {
    return new Promise((resolve) => {
        execFile('ffmpeg', ['-i', file], (e, stdout, stderr) => {
            const d = String(stderr || '').match(/Duration: (\d+):(\d+):([\d.]+)/)
            resolve(d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0)
        })
    })
}

// ---------- التفريغ الصوتي ----------
async function transcribeChunk(flacBuffer, lang) {
    const res = await fetch(`https://www.google.com/speech-api/v2/recognize?output=json&lang=${lang}&key=${GKEY}&pfilter=0`, {
        method: 'POST', headers: { 'Content-Type': 'audio/x-flac; rate=16000' }, body: flacBuffer,
    })
    if (!res.ok) throw new Error('speech HTTP ' + res.status)
    const body = await res.text()
    for (const line of body.split('\n')) {
        if (!line.trim()) continue
        try {
            const json = JSON.parse(line)
            const alt = json?.result?.[0]?.alternative?.[0]
            if (alt && alt.transcript) return { text: alt.transcript, confidence: alt.confidence || 0 }
        } catch {}
    }
    return { text: '', confidence: 0 }
}

// ---------- الترجمة ----------
function decodeEntities(s) {
    return String(s)
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

async function translatePa(text, src, tgt) {
    const clean = text.replace(/\n+/g, ' <brk> ')
    const r = await fetch('https://translate-pa.googleapis.com/v1/translateHtml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json+protobuf', 'x-goog-api-key': PA_KEY, 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/112.0 Mobile Safari/537.36', 'Referer': 'https://www.amazon.com' },
        body: JSON.stringify([[[clean], src, tgt], 'te_lib']),
    })
    if (!r.ok) throw new Error('pa HTTP ' + r.status)
    const j = await r.json()
    const segs = Array.isArray(j?.[0]) ? j[0] : []
    const out = segs.map((s) => Array.isArray(s) ? s.join('') : String(s || '')).join('')
    if (!out) throw new Error('pa empty')
    return decodeEntities(out).replace(/<brk>/g, '\n').trim()
}

async function translateGtx(text, src, tgt) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) throw new Error('gtx HTTP ' + r.status)
    const j = await r.json()
    const out = (j?.[0] || []).map((s) => s?.[0] || '').join('')
    if (!out) throw new Error('gtx empty')
    return out.trim()
}

async function translateMyMemory(text, src, tgt) {
    if (src === 'auto') throw new Error('mm needs source')
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) throw new Error('mm HTTP ' + r.status)
    const j = await r.json()
    const out = j?.responseData?.translatedText || ''
    if (!out || /MYMEMORY WARNING|INVALID|QUOTA/i.test(out)) throw new Error('mm quota/invalid')
    return out.trim()
}

const ENGINES = [
    ['Google Translate', translatePa],
    ['Google GTX', translateGtx],
    ['MyMemory', translateMyMemory],
]

function splitForTranslate(text, max = 4000) {
    const parts = []
    let rest = text.trim()
    while (rest.length > max) {
        let cut = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf(' ', max))
        if (cut < 500) cut = max
        parts.push(rest.slice(0, cut).trim())
        rest = rest.slice(cut).trim()
    }
    if (rest) parts.push(rest)
    return parts
}

async function translateText(text, src, tgt) {
    const chunks = splitForTranslate(text)
    const errors = []
    for (const [name, fn] of ENGINES) {
        try {
            const out = []
            for (const c of chunks) out.push(await fn(c, src, tgt))
            return { text: out.join('\n'), engine: name }
        } catch (e) { errors.push(name + ': ' + (e.message || e)) }
    }
    throw new Error(errors.join(' | ').slice(0, 300))
}

// ---------- الدبلجة (TTS بلغة الهدف) ----------
function splitSentences(text, max = 450) {
    const raw = String(text).split(/(?<=[.!?؟…])\s+/).map((s) => s.trim()).filter(Boolean)
    const out = []
    for (const s of raw) {
        let rest = s
        while (rest.length > max) {
            let cut = rest.lastIndexOf(' ', max)
            if (cut < 80) cut = max
            out.push(rest.slice(0, cut).trim())
            rest = rest.slice(cut).trim()
        }
        if (rest) out.push(rest)
    }
    return out
}

async function edgeTts(text, voice) {
    const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts')
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
    const { audioStream } = tts.toStream(text)
    const chunks = []
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('edge timeout')), 45000)
        audioStream.on('data', (c) => chunks.push(c))
        audioStream.on('end', () => { clearTimeout(timer); resolve() })
        audioStream.on('error', (e) => { clearTimeout(timer); reject(e) })
    })
    const buf = Buffer.concat(chunks)
    if (!buf.length) throw new Error('edge empty')
    return buf
}

async function googleTts(text, langCode) {
    const bufs = []
    for (const chunk of splitSentences(text, 175)) {
        const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + encodeURIComponent(langCode) + '&q=' + encodeURIComponent(chunk)
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!r.ok) throw new Error('gtts HTTP ' + r.status)
        bufs.push(Buffer.from(await r.arrayBuffer()))
    }
    return Buffer.concat(bufs)
}

async function dub(text, tgtCode, stamp, tmpDir) {
    const info = LANGS[tgtCode] || {}
    const segments = splitSentences(text)
    const segFiles = []
    let edgeDown = !info.voice
    try {
        for (let i = 0; i < segments.length; i++) {
            let buf = null
            if (!edgeDown) {
                try { buf = await edgeTts(segments[i], info.voice) } catch { edgeDown = true }
            }
            if (!buf) buf = await googleTts(segments[i], info.stt || tgtCode)
            const f = path.join(tmpDir, `atr-${stamp}-seg${i}.mp3`)
            writeFileSync(f, buf)
            segFiles.push(f)
        }
        const voiceFile = path.join(tmpDir, `atr-${stamp}-voice.wav`)
        const outFile = path.join(tmpDir, `atr-${stamp}.ogg`)
        const inputs = []
        for (const f of segFiles) inputs.push('-i', f)
        const filter = segments.map((_, i) => `[${i}:a]`).join('') + `concat=n=${segments.length}:v=0:a=1[voice]`
        await run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filter, '-map', '[voice]', '-ac', '1', '-ar', '48000', voiceFile])
        await run('ffmpeg', ['-y', '-v', 'error', '-i', voiceFile, '-af', 'loudnorm=I=-14:TP=-2:LRA=11,alimiter=limit=0.79:level=false', '-c:a', 'libopus', '-b:a', '64k', outFile])
        return await fsp.readFile(outFile)
    } finally {
        for (const f of segFiles) { try { unlinkSync(f) } catch {} }
        try { unlinkSync(path.join(tmpDir, `atr-${stamp}-voice.wav`)) } catch {}
        try { unlinkSync(path.join(tmpDir, `atr-${stamp}.ogg`)) } catch {}
    }
}

// ---------- الأمر ----------
let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const q = m.quoted
    const tokens = (text || '').trim().split(/\s+/).filter(Boolean)
    const wantTextOnly = tokens.some((t) => /^(text|نص)$/i.test(t))
    const langTokens = tokens.filter((t) => !/^(text|نص)$/i.test(t)).map(resolveLang).filter(Boolean)

    const usage = `🎙️🌍 *ترجمة المقاطع الصوتية*\n\nرد على *بصمة صوتية* أو مقطع صوتي وكتب:\n• ${usedPrefix + command} en ← ترجمة للإنكليزية (لغة الأصل كتكتشف بوحدها)\n• ${usedPrefix + command} fr ← للفرنسية\n• ${usedPrefix + command} ar en ← من العربية للإنكليزية\n• ${usedPrefix + command} en text ← غير النص، بلا صوت\n\nاللغات: ar en fr es de it pt tr ru zh ja ko hi ur fa id ms nl uk sv pl bn vi th\n\nالنتيجة: النص الأصلي + الترجمة مكتوبة + بصمة صوتية مدبلجة بلغة الهدف. حتى 5 دقائق.`

    if (!q) return m.reply(usage)
    const mime = q.mimetype || ''
    if (!/audio|video/.test(mime)) return m.reply('⚠️ خاص ترد على *بصمة صوتية* أو مقطع صوتي/فيديو.\n\n' + usage)
    if (!langTokens.length) return m.reply(usage)
    const tgt = langTokens[langTokens.length - 1]
    let src = langTokens.length >= 2 ? langTokens[0] : 'auto'
    if (busy) return m.reply('⏳ كاينة ترجمة خدامة دابا، سنى شوية وعاود.')

    let buffer
    try { buffer = await q.download() } catch { buffer = null }
    if (!buffer || !buffer.length) return m.reply('❌ ما قدرتش نحمل المقطع.')
    if (buffer.length > MAX_SIZE) return m.reply('❌ المقطع كبير بزاف (الحد 25MB).')

    busy = true
    const stamp = Date.now()
    const tmpDir = path.join(process.cwd(), 'tmp')
    mkdirSync(tmpDir, { recursive: true })
    const inFile = path.join(tmpDir, `atr-${stamp}.bin`)
    const chunkPrefix = path.join(tmpDir, `atr-${stamp}-chunk`)
    const cleanup = []
    try {
        writeFileSync(inFile, buffer)
        cleanup.push(inFile)
        const seconds = Number(q.seconds || 0) || await probeSeconds(inFile)
        if (seconds > MAX_SECONDS) return m.reply(`❌ المقطع طويل بزاف (${Math.round(seconds)} ثانية). الحد ${MAX_SECONDS} ثانية (5 دقائق).`)

        await m.reply('⏳ كنفرغ الصوت ونترجم... (تقدر تاخد شوية الوقت)')

        // تقسيم لمقاطع FLAC 12 ثانية
        await run('ffmpeg', ['-y', '-v', 'error', '-i', inFile, '-ar', '16000', '-ac', '1', '-f', 'segment', '-segment_time', '12', '-c:a', 'flac', chunkPrefix + '%03d.flac'], 120000)
        const chunkFiles = readdirSync(tmpDir).filter((f) => f.startsWith(`atr-${stamp}-chunk`)).sort().map((f) => path.join(tmpDir, f))
        cleanup.push(...chunkFiles)
        if (!chunkFiles.length) throw new Error('ffmpeg produced no chunks')

        // كشف اللغة من أول مقطع إلا ما تحداتش
        // ملحوظة مجربة: ثقة Google ما كتصلحش للمقارنة بين اللغات (اللغة الغلاطة كتعطي ثقة أعلى!)
        // فكنستعملو الخط (العربي كيحسم) + كلمات التوقف الخاصة بكل لغة، والثقة غير للترجيح الأخير.
        let sttLang = null
        if (src !== 'auto') {
            sttLang = LANGS[src].stt
        } else {
            const firstBuf = await fsp.readFile(chunkFiles[0])
            const attempts = await Promise.all(DETECT.map(async ([code, base]) => {
                try { const r = await transcribeChunk(firstBuf, code); return { code, base, ...r } } catch { return { code, base, text: '', confidence: 0 } }
            }))
            const STOP = {
                en: ['the', 'and', 'you', 'your', 'for', 'with', 'this', 'that', 'have', 'are', 'will', 'today', 'hello', 'what', 'how', 'going', 'market'],
                fr: ['le', 'la', 'les', 'des', 'nous', 'vous', 'pour', 'avec', 'est', 'dans', 'une', 'un', 'et', 'au', 'aux', 'bonjour', 'merci', 'demain', 'marché'],
                es: ['el', 'la', 'los', 'las', 'para', 'con', 'una', 'un', 'y', 'en', 'es', 'por', 'mañana', 'hola', 'gracias', 'hoy', 'mercado'],
            }
            const maxLen = Math.max(1, ...attempts.map((a) => a.text.length))
            for (const a of attempts) {
                const letters = a.text.replace(/[^A-Za-z\u0600-\u06FF]/g, '')
                a.arRatio = letters.length ? (a.text.match(/[\u0600-\u06FF]/g) || []).length / letters.length : 0
                a.lenRatio = a.text.length / maxLen
            }
            // نص عربي حقيقي (طويل نسبياً) كيحسم مباشرة — أما شظايا عربية قصيرة من كلام أجنبي كتتجاهل
            const scriptWin = attempts.find((a) => a.text && a.arRatio > 0.25 && a.lenRatio >= 0.5)
            const score = (a) => {
                if (!a.text || a.arRatio > 0.25) return -100
                const words = a.text.toLowerCase().split(/[^a-zàâäéèêëîïôöùûüçñ]+/i).filter(Boolean)
                const hits = (STOP[a.base] || []).filter((w) => words.includes(w)).length
                return hits * 3 + a.confidence + a.lenRatio
            }
            if (!scriptWin) attempts.sort((a, b) => score(b) - score(a))
            const best = scriptWin || attempts.find((a) => a.text && a.arRatio <= 0.25)
            if (!best) return m.reply('🤔 ما سمعت حتى كلام واضح فهاد المقطع. جرب مقطع أنقى أو قرب من الميكرو.')
            sttLang = best.code
            src = best.base
        }

        // تفريغ جميع المقاطع
        const parts = []
        for (let i = 0; i < chunkFiles.length; i++) {
            const buf = await fsp.readFile(chunkFiles[i])
            const r = await transcribeChunk(buf, sttLang)
            if (r.text) parts.push(r.text)
        }
        const transcript = parts.join(' ').replace(/\s+/g, ' ').trim()
        if (!transcript) return m.reply('🤔 ما قدرت نفرغ حتى كلمة من هاد المقطع.')
        if (src === tgt) return m.reply(`ℹ️ المقطع أصلاً بـ *${LANGS[tgt].name}* — ها النص ديالو:\n\n${transcript}`)

        // الترجمة
        let translated, engine
        try {
            const r = await translateText(transcript, src, tgt)
            translated = r.text
            engine = r.engine
        } catch (e) {
            return m.reply(`📝 *النص الأصلي (${LANGS[src]?.name || src}):*\n${transcript}\n\n❌ ولكن الترجمة فشلات من جميع المحركات (غالباً حظر/حصة على الاستضافة). عاود من بعد.` + (isOwner ? `\n\n🔧 تفاصيل للمالك: ${String(e.message || e).slice(0, 250)}` : ''))
        }

        // النتيجة النصية (+ ملف إلا طوالت)
        const head = `🎙️🌍 *ترجمة صوتية*\n🗣️ الأصل: ${LANGS[src]?.name || src} ← 🎯 الهدف: ${LANGS[tgt].name}\n`
        const fullText = `${head}\n📝 *النص الأصلي:*\n${transcript}\n\n🌍 *الترجمة:*\n${translated}`
        if (fullText.length <= 3600) {
            await m.reply(fullText)
        } else {
            await m.reply(`${head}\n📝 *الأصل:* ${transcript.slice(0, 300)}…\n\n🌍 *الترجمة:* ${translated.slice(0, 900)}…\n\n📄 النص الكامل كاين فالملف المرفق.`)
            await conn.sendMessage(m.chat, {
                document: Buffer.from(fullText, 'utf8'),
                mimetype: 'text/plain',
                fileName: `audio-translation-${stamp}.txt`,
                caption: `🎙️🌍 ترجمة صوتية: ${LANGS[src]?.name || src} ← ${LANGS[tgt].name}`,
            }, { quoted: m })
        }
        if (engine !== 'Google Translate' && isOwner) await m.reply(`🔧 ملحوظة للمالك: المحرك الأساسي ما جاوبش، تستعمل ${engine}.`)

        // الدبلجة الصوتية
        if (!wantTextOnly) {
            try {
                const dubText = translated.length > DUB_MAX_CHARS ? translated.slice(0, DUB_MAX_CHARS) : translated
                const ogg = await dub(dubText, tgt, stamp, tmpDir)
                await conn.sendMessage(m.chat, { audio: ogg, ptt: true, mimetype: 'audio/ogg; codecs=opus' }, { quoted: m })
                if (translated.length > DUB_MAX_CHARS) await m.reply(`ℹ️ الدبلجة الصوتية فيها أول ${DUB_MAX_CHARS} حرف (الترجمة طويلة) — النص الكامل الفوق.`)
            } catch (e) {
                await m.reply('⚠️ الترجمة وصلاتك مكتوبة، ولكن الدبلجة الصوتية فشلات.' + (isOwner ? `\n🔧 تفاصيل: ${String(e.message || e).slice(0, 150)}` : ''))
            }
        }
    } catch (e) {
        return m.reply('❌ وقع مشكل فالترجمة. عاود من بعد.' + (isOwner ? `\n\n🔧 تفاصيل للمالك: ${String(e?.message || e).slice(0, 250)}` : ''))
    } finally {
        busy = false
        for (const f of cleanup) { try { unlinkSync(f) } catch {} }
    }
}

handler.help = ['audiotranslate']
handler.tags = [ 'ai']
handler.command = /^(audiotranslate|atranslate|ترجمة|ترجم)$/i
handler.limit = false

export default handler
