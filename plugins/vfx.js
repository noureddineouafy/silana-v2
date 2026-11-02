// voicefx.js — مؤثرات الصوت (.voicefx)
// ─────────────────────────────────────────────────────────────────────────────
// رد (quote) على بصمة صوتية/ملف صوت/فيديو واكتب .voicefx <مؤثر>
// → كيرجع الصوت بالمؤثر كبصمة صوتية (أو MP3 إلا زدتي mp3).
//
//   deep عميق | chipmunk سنجاب | robot روبوت | radio راديو
//   echo صدى | cave كهف | slow بطيء | fast سريع | reverse معكوس
//
// مثال: .voicefx deep  /  .voicefx radio mp3
// حدود تقنية: ≤ 3 دقائق و ≤ 20MB.
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

process.env.TMPDIR = path.join(process.cwd(), 'tmp')

const MAX_DUR = 180
const MAX_SIZE = 20 * 1024 * 1024

// كل مؤثر: سلسلة فلاتر + الفلاتر اللي خاصها تكون موجودة
const EFFECTS = {
    deep:     { ar: 'عميق 🐻',    needs: ['asetrate', 'atempo'], chain: sr => `asetrate=${Math.round(sr * 0.78)},aresample=${sr},atempo=1.282,bass=g=4` },
    chipmunk: { ar: 'سنجاب 🐿️',  needs: ['asetrate', 'atempo'], chain: sr => `asetrate=${Math.round(sr * 1.38)},aresample=${sr},atempo=0.725,treble=g=3` },
    robot:    { ar: 'روبوت 🤖',   needs: ['vibrato', 'acrusher'], chain: () => 'vibrato=f=28:d=0.85,acrusher=bits=7:mix=0.55:aa=1' },
    radio:    { ar: 'راديو 📻',   needs: ['highpass', 'lowpass', 'acrusher'], chain: () => 'highpass=f=450,lowpass=f=3100,acrusher=bits=9:mix=0.38:aa=1,acompressor=threshold=0.4:ratio=4' },
    echo:     { ar: 'صدى 🔁',     needs: ['aecho'], chain: () => 'aecho=0.8:0.72:70|140:0.34|0.22' },
    cave:     { ar: 'كهف 🕳️',    needs: ['aecho', 'lowpass'], chain: () => 'aecho=0.82:0.9:130|260|390:0.42|0.3|0.2,lowpass=f=5200' },
    slow:     { ar: 'بطيء 🐢',    needs: ['atempo'], chain: () => 'atempo=0.68' },
    fast:     { ar: 'سريع 🐇',    needs: ['atempo'], chain: () => 'atempo=1.6' },
    reverse:  { ar: 'معكوس 🔄',   needs: ['areverse'], chain: () => 'areverse' },
}
const ALIASES = {
    عميق: 'deep', سنجاب: 'chipmunk', روبوت: 'robot', راديو: 'radio',
    صدى: 'echo', كهف: 'cave', بطيء: 'slow', سريع: 'fast', معكوس: 'reverse',
    pitch: 'deep', old: 'radio', walkie: 'radio',
}

let busy = false
let filtersCache = null

async function ffmpegFilters() {
    if (filtersCache) return filtersCache
    try { filtersCache = (await run('ffmpeg', ['-hide_banner', '-filters'], { timeout: 20000 })).stdout }
    catch { filtersCache = '' }
    return filtersCache
}

async function probeFfmpeg(file) {
    let txt = ''
    try { await run('ffmpeg', ['-hide_banner', '-i', file], { timeout: 20000 }) }
    catch (e) { txt = String(e.stderr || '') }
    const dm = txt.match(/Duration: (\d+):(\d+):([\d.]+)/)
    const sm = txt.match(/Audio: [^,]*, (\d+) Hz/)
    return {
        duration: dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + parseFloat(dm[3]) : 0,
        rate: sm ? +sm[1] : 44100,
        hasAudio: /:\s*Audio:/.test(txt),
    }
}

async function download(url, dest) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download HTTP ${res.status}`)
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''
    const isAudio = /audio/.test(mime) || q.mtype === 'audioMessage'
    const isVideo = /video/.test(mime) || q.mtype === 'videoMessage'

    const fxArg = (args.find(a => EFFECTS[a.toLowerCase()] || ALIASES[a]) || '').toLowerCase()
    const fxKey = EFFECTS[fxArg] ? fxArg : ALIASES[fxArg]
    const wantMp3 = args.some(a => /^mp3$/i.test(a))

    if ((!isAudio && !isVideo) || !fxKey) {
        const list = Object.entries(EFFECTS).map(([k, v]) => `\`${k}\` ${v.ar}`).join('\n')
        return conn.reply(m.chat,
            `🗣️ *مؤثرات الصوت*\n\n` +
            `رد على بصمة صوتية أو ملف صوت واكتب:\n` +
            `> ${usedPrefix + command} <مؤثر>\n\n` +
            list + `\n\n` +
            `مثال: ${usedPrefix + command} deep\n` +
            `بصيغة MP3: ${usedPrefix + command} radio mp3`, m)
    }
    if (busy) return conn.reply(m.chat, '⏳ تسنى، كاينة خدمة أخرى… ثواني وعاود.', m)

    const fx = EFFECTS[fxKey]
    const filters = await ffmpegFilters()
    const missing = fx.needs.filter(f => !new RegExp(`\\s${f}\\s`).test(filters))
    if (missing.length) {
        return conn.reply(m.chat, `❌ هاد المؤثر ما خدامش على هاد السيرفر.\n🔧 تفاصيل للمالك: ffmpeg ناقصاه فلاتر: ${missing.join(', ')}`, m)
    }

    let dir
    busy = true
    try {
        dir = fs.mkdtempSync(path.join(process.env.TMPDIR, 'vfx-'))
        fs.mkdirSync(dir, { recursive: true })
        const input = path.join(dir, 'in.bin')
        let gotBuf = null
        try { gotBuf = await q.download() } catch {}
        if (gotBuf && gotBuf.length > 2000) fs.writeFileSync(input, gotBuf)
        else {
            const mediaUrl = q.msg?.url || q.url
            if (mediaUrl && /^https?:/.test(mediaUrl)) await download(mediaUrl, input)
            else throw new Error('download: تعذر تنزيل الملف')
        }
        if (fs.statSync(input).size > MAX_SIZE) throw new Error('size: الملف كبير بزاف (الحد 20MB)')

        const meta = await probeFfmpeg(input)
        if (!meta.hasAudio) throw new Error('audio: الملف ما فيهش صوت')
        if (meta.duration > MAX_DUR) throw new Error(`duration: طويل بزاف (${Math.round(meta.duration)}s) — الحد ${MAX_DUR}s`)

        const chain = fx.chain(meta.rate)
        const out = path.join(dir, wantMp3 ? 'fx.mp3' : 'fx.ogg')
        const codec = wantMp3
            ? ['-c:a', 'libmp3lame', '-b:a', '128k']
            : ['-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1']
        try {
            await run('ffmpeg', ['-y', '-v', 'error', '-i', input,
                '-af', `${chain},loudnorm=I=-15:TP=-1.5:LRA=11,alimiter=limit=0.79:level=false`,
                '-vn', ...codec, out], { timeout: 300000, maxBuffer: 4 * 1024 * 1024 })
        } catch (e) {
            const tail = (e.stderr || e.message || '').toString().slice(-260)
            throw new Error('encode: ' + tail.replace(/\s+/g, ' '))
        }
        if (!fs.existsSync(out) || fs.statSync(out).size < 2000) throw new Error('encode: المخرجات خاوية')

        if (wantMp3) {
            await conn.sendFile(m.chat, out, 'voicefx.mp3', `🗣️ مؤثر: ${fx.ar}\n⚡ SILANA AI`, m)
        } else {
            const buf = fs.readFileSync(out)
            try {
                await conn.sendMessage(m.chat, { audio: buf, ptt: true, mimetype: 'audio/ogg; codecs=opus' }, { quoted: m })
            } catch {
                await conn.sendFile(m.chat, out, 'voicefx.ogg', `🗣️ مؤثر: ${fx.ar}`, m)
            }
        }

    } catch (e) {
        const msg = String(e.message || e)
        if (/^(size|duration|audio):/.test(msg))
            return conn.reply(m.chat, '⚠️ ' + msg.split(': ').slice(1).join(': '), m)
        return conn.reply(m.chat,
            '❌ وقع مشكل أثناء تطبيق المؤثر.\n🔧 تفاصيل للمالك: ' + msg.slice(0, 280), m)
    } finally {
        busy = false
        if (dir) try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
    }
}

handler.help = ['voicefx']
handler.tags = [ 'tools']
handler.command = /^(voicefx|vfx|مؤثر)$/i
handler.limit = false

export default handler
