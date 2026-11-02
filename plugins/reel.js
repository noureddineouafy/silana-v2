// reel.js — محرر الريلز (.reel)
// ─────────────────────────────────────────────────────────────────────────────
// رد (quote) على أي فيديو واكتب .reel → كيرجع بصيغة ريلز 1080×1920
// احترافية جاهزة للنشر: خلفية ضبابية من نفس الفيديو، تحسين ألوان خفيف،
// واترمارك silana_ai، وتوحيد مستوى الصوت.
//
//   .reel            → وضع الخلفية الضبابية (الافتراضي)
//   .reel full       → ملء الشاشة بالقص (بلا خلفية)
//   .reel 5 20       → قص من الثانية 5 حتى 20 (أو 0:05 0:20)
//   .reel full 5 20  → بجوج
//
// حدود تقنية: ≤ 90 ثانية بعد القص، ≤ 60MB، خدمة واحدة في نفس الوقت.
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

process.env.TMPDIR = path.join(process.cwd(), 'tmp')

const MAX_DUR = 90
const MAX_SIZE = 60 * 1024 * 1024
const W = 1080, H = 1920

let busy = false
let capsCache = null

async function ffmpegCaps() {
    if (capsCache) return capsCache
    let filters = '', encoders = ''
    try { filters = (await run('ffmpeg', ['-hide_banner', '-filters'], { timeout: 20000 })).stdout } catch {}
    try { encoders = (await run('ffmpeg', ['-hide_banner', '-encoders'], { timeout: 20000 })).stdout } catch {}
    capsCache = {
        gblur: /\sgblur\s/.test(filters),
        drawtext: /\sdrawtext\s/.test(filters),
        x264: /\slibx264\s/.test(encoders),
    }
    return capsCache
}

async function probeFfmpeg(file) {
    let txt = ''
    try { await run('ffmpeg', ['-hide_banner', '-i', file], { timeout: 20000 }) }
    catch (e) { txt = String(e.stderr || '') }
    const dm = txt.match(/Duration: (\d+):(\d+):([\d.]+)/)
    const vm = txt.match(/Video:[^\n]*?(\d{3,5})x(\d{3,5})/)
    return {
        duration: dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + parseFloat(dm[3]) : 0,
        width: vm ? +vm[1] : 0,
        height: vm ? +vm[2] : 0,
        hasAudio: /:\s*Audio:/.test(txt),
    }
}

async function probe(file) {
    try {
        const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', file], { timeout: 20000 })
        const j = JSON.parse(stdout)
        const v = (j.streams || []).find(s => s.codec_type === 'video') || {}
        const r = { duration: parseFloat(j.format?.duration || 0), width: v.width || 0, height: v.height || 0, hasAudio: (j.streams || []).some(s => s.codec_type === 'audio') }
        if (r.duration > 0 && r.width) return r
    } catch {}
    return probeFfmpeg(file)
}

async function download(url, dest) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download HTTP ${res.status}`)
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function parseTime(s) {
    if (s == null) return null
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s)
    const mm = s.match(/^(\d+):(\d{1,2})$/) 
    if (mm) return (+mm[1]) * 60 + (+mm[2])
    return null
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''
    const isVideo = /video/.test(mime) || q.mtype === 'videoMessage'

    if (!isVideo) {
        return conn.reply(m.chat,
            `✂️ *محرر الريلز*\n\n` +
            `رد على أي فيديو واكتب:\n` +
            `> ${usedPrefix + command}\n\n` +
            `• الوضع الافتراضي: خلفية ضبابية 1080×1920\n` +
            `• ${usedPrefix + command} full → ملء الشاشة بالقص\n` +
            `• ${usedPrefix + command} 5 20 → قص من ثانية 5 لـ 20\n` +
            `الحدود: ≤ 90 ثانية، ≤ 60MB.`, m)
    }
    if (busy) return conn.reply(m.chat, '⏳ كاينة خدمة أخرى كتتصايب… تسنى شوية وعاود.', m)

    const full = args.some(a => /^(full|crop)$/i.test(a))
    const times = args.filter(a => !/^(full|crop)$/i.test(a)).map(parseTime).filter(v => v !== null)
    const startAt = times.length ? times[0] : 0
    const endAt = times.length > 1 ? times[1] : null

    const caps = await ffmpegCaps()
    if (!caps.x264) return conn.reply(m.chat, '❌ سيرفر البوت ما فيهش libx264.\n🔧 تفاصيل للمالك: ffmpeg بلا libx264.', m)

    let dir
    busy = true
    try {
        await conn.reply(m.chat, '✂️ *كنصايب الريلز…* كنحولو لـ 1080×1920 ⏳', m)

        dir = fs.mkdtempSync(path.join(process.env.TMPDIR, 'reel-'))
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
        if (size > MAX_SIZE) throw new Error('size: الفيديو كبير بزاف (الحد 60MB)')

        const meta = await probe(input)
        if (!meta.duration || !meta.width) throw new Error('probe: ما قدرتش نقرا الفيديو')
        const clipDur = (endAt !== null ? Math.min(endAt, meta.duration) : meta.duration) - startAt
        if (clipDur <= 0) throw new Error('time: أوقات القص ماشي صحيحة')
        if (clipDur > MAX_DUR) throw new Error(`duration: المقطع طويل (${Math.round(clipDur)}s) — الحد ${MAX_DUR}s. قصيه بالأرقام: ${usedPrefix + command} 0 60`)

        const ratio = meta.width / meta.height
        const target = W / H
        const already = Math.abs(ratio - target) < 0.03

        const blur = caps.gblur ? 'gblur=sigma=45' : 'boxblur=luma_radius=38:luma_power=3'
        const wm = caps.drawtext
            ? `,drawtext=text='silana_ai':fontcolor=white@0.45:fontsize=54:shadowcolor=black@0.4:shadowx=1:shadowy=1:x=w-tw-28:y=h-175`
            : ''
        let vf
        if (already) {
            vf = `scale=${W}:${H}:flags=lanczos,setsar=1,eq=saturation=1.07:contrast=1.03,unsharp=5:5:0.5:5:5:0.0${wm}`
        } else if (full) {
            vf = `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,eq=saturation=1.07:contrast=1.03,unsharp=5:5:0.5:5:5:0.0${wm}`
        } else {
            vf = `split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},${blur},eq=brightness=-0.06:saturation=1.1[bg];[b]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,eq=saturation=1.05:contrast=1.02,unsharp=5:5:0.5:5:5:0.0${wm}`
        }

        const out = path.join(dir, 'reel.mp4')
        const fargs = ['-y', '-v', 'error', '-i', input]
        if (startAt > 0) fargs.push('-ss', String(startAt))
        if (endAt !== null || clipDur) fargs.push('-t', String(clipDur))
        fargs.push('-vf', vf)
        if (meta.hasAudio) fargs.push('-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.79:level=false', '-c:a', 'aac', '-b:a', '128k')
        else fargs.push('-an')
        fargs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out)

        try {
            await run('ffmpeg', fargs, { timeout: 30 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 })
        } catch (e) {
            const tail = (e.stderr || e.message || '').toString().slice(-300)
            throw new Error('encode: ' + tail.replace(/\s+/g, ' '))
        }
        if (!fs.existsSync(out) || fs.statSync(out).size < 10000) throw new Error('encode: المخرجات خاوية')

        const modeTxt = already ? 'كان بصيغة الريلز' : full ? 'ملء الشاشة' : 'خلفية ضبابية'
        await conn.sendFile(m.chat, out, 'silana-reel.mp4',
            `✂️ *صافي!* ريلز 1080×1920 (${modeTxt}${startAt || endAt ? `، مقصوص ${Math.round(clipDur)}s` : ''}) — جاهز للنشر.\n⚡ SILANA AI`, m)

    } catch (e) {
        const msg = String(e.message || e)
        if (/^(size|duration|time):/.test(msg))
            return conn.reply(m.chat, '⚠️ ' + msg.split(': ').slice(1).join(': '), m)
        return conn.reply(m.chat,
            '❌ وقع مشكل أثناء صناعة الريلز.\n🔧 تفاصيل للمالك: ' + msg.slice(0, 280), m)
    } finally {
        busy = false
        if (dir) try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
    }
}

handler.help = ['reel']
handler.tags = ['editor']
handler.command = /^(reel|ريلز)$/i
handler.limit = false

export default handler
