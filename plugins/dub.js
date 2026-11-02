// dub.js — دبلجة الفيديو للعربية (.dub)
// ─────────────────────────────────────────────────────────────────────────────
// رد (quote) على فيديو أجنبي واكتب .dub → البوت كيقطع الكلام لجمل،
// كينسخ كل جملة، كيترجمها للعربية، كينطقها بصوت عربي، وكيبدل الصوت
// الأصلي بالدبلجة (الأصلي كيبقى خفيف في الخلفية) — بنفس الفيديو.
//
//   .dub        → لغة أصلية: الإنجليزية (افتراضي)، صوت نسائي
//   .dub fr     → الفرنسية | .dub es → الإسبانية
//   .dub en m   → صوت رجالي (m) — الافتراضي f نسائي
//
// الترجمة عبر Google Translate ثم MyMemory كاحتياط. التعليق عبر
// msedge-tts (نفس تثبيت .remind) مع احتياط Google TTS.
// حدود تقنية: فيديو ≤ دقيقتين و ≤ 50MB، خدمة واحدة في نفس الوقت.
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const run = promisify(execFile)
const require = createRequire(import.meta.url)

process.env.TMPDIR = path.join(process.cwd(), 'tmp')

const GKEY = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw'

const MAX_DUR = 120
const MAX_SIZE = 50 * 1024 * 1024
const GTX_URL = 'https://translate.googleapis.com/translate_a/single'

const SRC_LANGS = { en: 'en-US', fr: 'fr-FR', es: 'es-ES' }
const VOICES = { f: 'ar-MA-MounaNeural', m: 'ar-MA-JamalNeural' }

let busy = false

// ---------- أدوات مشتركة (نفس محرك .sub) ----------
async function probeFfmpeg(file) {
    let txt = ''
    try { await run('ffmpeg', ['-hide_banner', '-i', file], { timeout: 20000 }) }
    catch (e) { txt = String(e.stderr || '') }
    const dm = txt.match(/Duration: (\d+):(\d+):([\d.]+)/)
    return {
        duration: dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + parseFloat(dm[3]) : 0,
        hasAudio: /:\s*Audio:/.test(txt),
    }
}

async function probe(file) {
    try {
        const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file], { timeout: 20000 })
        const j = JSON.parse(stdout)
        const r = { duration: parseFloat(j.format?.duration || 0), hasAudio: (j.streams || []).some(s => s.codec_type === 'audio') }
        if (r.duration > 0) return r
    } catch {}
    return probeFfmpeg(file)
}

async function adaptiveNoise(wav) {
    try {
        const r = await run('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'astats=metadata=1', '-f', 'null', '-'], { timeout: 60000 })
        const mm = String(r.stderr || '').match(/RMS level dB: (-?[\d.]+)/)
        if (mm) return Math.max(-48, Math.min(-26, parseFloat(mm[1]) - 14))
    } catch {}
    return -33
}

async function detectPhrases(wav, duration) {
    const noiseDb = await adaptiveNoise(wav)
    let log = ''
    try {
        const r = await run('ffmpeg', ['-hide_banner', '-i', wav, '-af', `silencedetect=noise=${noiseDb}dB:d=0.22`, '-f', 'null', '-'], { timeout: 90000 })
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
    if (cur !== null) silences.push([cur, duration])
    const speech = []
    let prev = 0
    for (const [s, e] of silences) { if (s - prev > 0.05) speech.push([prev, s]); prev = Math.max(prev, e) }
    if (duration - prev > 0.05) speech.push([prev, duration])
    const phrases = []
    for (const [s, e] of speech) {
        if (e - s < 0.25) continue
        const last = phrases[phrases.length - 1]
        if (last && s - last[1] < 0.35) last[1] = e
        else phrases.push([s, e])
    }
    const out = []
    const splitLong = (s, e, depth) => {
        if (e - s <= 6.5 || depth > 4) { out.push([s, e]); return }
        let best = null
        for (const [ss, ee] of silences) if (ss > s + 0.8 && ee < e - 0.8 && (!best || ee - ss > best[1] - best[0])) best = [ss, ee]
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

// ---------- الترجمة: Google ثم MyMemory ----------
async function translateText(text, sl) {
    // Google Translate (gtx)
    try {
        const u = `${GTX_URL}?client=gtx&sl=${sl}&tl=ar&dt=t&q=${encodeURIComponent(text)}`
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) })
        if (res.ok) {
            const j = await res.json()
            const out = (j?.[0] || []).map(s => s?.[0] || '').join('').trim()
            if (out) return out
        }
    } catch {}
    // MyMemory
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|ar`, { signal: AbortSignal.timeout(15000) })
        if (res.ok) {
            const j = await res.json()
            const out = (j?.responseData?.translatedText || '').trim()
            if (out && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) return out
        }
    } catch {}
    return ''
}

// ---------- التعليق الصوتي ----------
let edgeMod = null, edgeTried = false
function loadEdge() {
    if (edgeTried) return edgeMod
    edgeTried = true
    try { edgeMod = require('msedge-tts') } catch { edgeMod = null }
    return edgeMod
}

async function speakEdge(text, voice, dest) {
    const mod = loadEdge()
    if (!mod) throw new Error('msedge-tts not installed')
    const { MsEdgeTTS, OUTPUT_FORMAT } = mod
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const tmp = dest + '.raw'
    const { audioStream } = tts.toStream(text)
    await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(tmp)
        audioStream.pipe(ws)
        audioStream.on('end', resolve)
        audioStream.on('error', reject)
        ws.on('error', reject)
    })
    tts.close()
    fs.renameSync(tmp, dest)
}

async function speakGoogle(text, dest) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ar&q=${encodeURIComponent(text.slice(0, 190))}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`gtts HTTP ${res.status}`)
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

async function download(url, dest) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download HTTP ${res.status}`)
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''
    const isVideo = /video/.test(mime) || q.mtype === 'videoMessage'

    if (!isVideo) {
        return conn.reply(m.chat,
            `🎙️ *دبلجة الفيديو للعربية*\n\n` +
            `رد على فيديو أجنبي واكتب:\n` +
            `> ${usedPrefix + command}\n\n` +
            `اللغة الأصلية: en افتراضي — أو ${usedPrefix + command} fr / es\n` +
            `الصوت: نسائي افتراضي — زيد m للرجالي: ${usedPrefix + command} en m\n` +
            `الحدود: ≤ دقيقتين، ≤ 50MB.`, m)
    }
    if (busy) return conn.reply(m.chat, '⏳ كاينة دبلجة أخرى كتتصايب… تسنى شوية وعاود.', m)

    const sl = (args.find(a => SRC_LANGS[a.toLowerCase()]) || 'en').toLowerCase()
    const voiceKey = args.some(a => /^m$/i.test(a)) ? 'm' : 'f'
    const sttLang = SRC_LANGS[sl]

    let dir
    busy = true
    try {
        await conn.reply(m.chat, '🎙️ *كنبدا الدبلجة…*\nكنحلل الكلام، كنترجم وكنركب الصوت العربي ⏳', m)

        dir = fs.mkdtempSync(path.join(process.env.TMPDIR, 'dub-'))
        fs.mkdirSync(dir, { recursive: true })
        const input = path.join(dir, 'in.mp4')
        let gotBuf = null
        try { gotBuf = await q.download() } catch {}
        if (gotBuf && gotBuf.length > 10000) fs.writeFileSync(input, gotBuf)
        else {
            const mediaUrl = q.msg?.url || q.url
            if (mediaUrl && /^https?:/.test(mediaUrl)) await download(mediaUrl, input)
            else throw new Error('download: تعذر تنزيل الفيديو')
        }
        const size = fs.statSync(input).size
        if (size > MAX_SIZE) throw new Error('size: الفيديو كبير بزاف (الحد 50MB)')

        const meta = await probe(input)
        if (!meta.duration) throw new Error('probe: ما قدرتش نقرا الفيديو')
        if (!meta.hasAudio) throw new Error('audio: الفيديو ما فيهش صوت')
        if (meta.duration > MAX_DUR) throw new Error(`duration: الفيديو طويل (${Math.round(meta.duration)}s) — الحد ${MAX_DUR}s`)

        const wav = path.join(dir, 'audio.wav')
        await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vn', '-ac', '1', '-ar', '16000', wav], { timeout: 120000 })

        let phrases = await detectPhrases(wav, meta.duration)
        if (!phrases.length) throw new Error('stt: ما لقيت حتى كلام في الفيديو')
        if (phrases.length > 40) phrases = phrases.slice(0, 40)

        // نسخ + ترجمة + تعليق لكل جملة
        const jobs = []
        let translateFails = 0, usedGoogle = false
        for (let i = 0; i < phrases.length; i++) {
            const [ps, pe] = phrases[i]
            const flac = path.join(dir, `p${i}.flac`)
            try {
                await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.max(0, ps - 0.12)), '-t', String(pe - ps + 0.24), '-i', wav, '-ac', '1', '-ar', '16000', flac], { timeout: 60000 })
            } catch { continue }
            let src = ''
            try { src = await transcribe(fs.readFileSync(flac), sttLang) } catch {}
            if (!src) continue
            const ar = await translateText(src, sl)
            if (!ar) { translateFails++; continue }
            const mp3 = path.join(dir, `v${i}.mp3`)
            try { await speakEdge(ar, VOICES[voiceKey], mp3) }
            catch { try { await speakGoogle(ar, mp3); usedGoogle = true } catch { continue } }
            const tp = await probeFfmpeg(mp3)
            if (!tp.duration) continue
            const nextStart = i + 1 < phrases.length ? phrases[i + 1][0] : meta.duration
            const slot = Math.max(pe - ps, Math.min(nextStart - ps, (pe - ps) * 1.7))
            jobs.push({ start: ps, dur: tp.duration, slot, file: mp3 })
        }
        if (!jobs.length) {
            if (translateFails > 0) throw new Error('translate: خدمات الترجمة ما جاوباتش (Google/MyMemory) — عاود من بعد')
            throw new Error('stt: ما سمعت حتى كلام واضح في الفيديو')
        }

        await conn.reply(m.chat, `✅ ترجمت ${jobs.length} جملة — دابا كنركب الدبلجة على الفيديو…`, m)

        // المزج: الأصلي خفيف + كل جملة في بلاصتها (مع تسريع إلا طوالت على بلاصتها)
        const fargs = ['-y', '-v', 'error', '-i', input]
        for (const j of jobs) fargs.push('-i', j.file)
        const chains = [`[0:a]aresample=48000,volume=0.13[orig]`]
        jobs.forEach((j, i) => {
            let chain = `[${i + 1}:a]aresample=48000`
            if (j.dur > j.slot) {
                let tempo = Math.min(1.6, j.dur / j.slot)
                while (tempo > 2) { chain += ',atempo=2.0'; tempo /= 2 }
                chain += `,atempo=${tempo.toFixed(3)}`
            }
            const ms = Math.round(j.start * 1000)
            chain += `,adelay=${ms}|${ms}[d${i}]`
            chains.push(chain)
        })
        const mixIns = jobs.map((_, i) => `[d${i}]`).join('')
        chains.push(`${mixIns}amix=inputs=${jobs.length}:normalize=0[dub]`)
        chains.push(`[orig][dub]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.79:level=false[aout]`)
        const out = path.join(dir, 'dub.mp4')
        try {
            await run('ffmpeg', [...fargs, '-filter_complex', chains.join(';'),
                '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart', out], { timeout: 30 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 })
        } catch (e) {
            const tail = (e.stderr || e.message || '').toString().slice(-300)
            throw new Error('encode: ' + tail.replace(/\s+/g, ' '))
        }
        if (!fs.existsSync(out) || fs.statSync(out).size < 10000) throw new Error('encode: المخرجات خاوية')

        let note = `🎙️ *صافي!* الفيديو مدبلج للعربية — ${jobs.length} جملة.`
        if (translateFails) note += `\n⚠️ ${translateFails} جملة ما تترجماتش وبقات بصوتها الأصلي.`
        if (usedGoogle) note += `\n🔧 للمالك: التعليق داز بـ Google TTS (Edge ما وصلش).`
        note += `\n⚡ SILANA AI`
        await conn.sendFile(m.chat, out, 'silana-dub.mp4', note, m)

    } catch (e) {
        const msg = String(e.message || e)
        if (/^(size|duration|audio|stt|translate):/.test(msg))
            return conn.reply(m.chat, '⚠️ ' + msg.split(': ').slice(1).join(': '), m)
        return conn.reply(m.chat,
            '❌ وقع مشكل أثناء الدبلجة.\n🔧 تفاصيل للمالك: ' + msg.slice(0, 280), m)
    } finally {
        busy = false
        if (dir) try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
    }
}

handler.help = ['dub']
handler.tags = ['editor']
handler.command = /^(dub|دبلجة)$/i
handler.limit = false

export default handler
          
