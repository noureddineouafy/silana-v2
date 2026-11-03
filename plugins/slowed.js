// slowed.js — Slowed + Reverb v2 🌙🎵
// رد على أغنية/أوظيو/فيديو بـ .slowed → نسخة بطيئة مع صدى (الستايل الفيروسي)
// .slowed          → تبطيئ 0.85 مع ريفيرب حقيقي (IR مولّد محلياً)
// .slowed 0.8      → عامل تبطيئ مخصص (0.5 حتى 0.98)
// .slowed video    → نفس الشي ويرجع فيديو بطيء (حتى 90 ثانية)
// المعالجة محلية بالكامل بـ ffmpeg — الصدى عبر afir بنبضة مولّدة أول مرة.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const execFileAsync = promisify(execFile)
const VERSION = 'v2'
const MAX_AUDIO_SEC = 600
const MAX_VIDEO_SEC = 90
const MAX_MB = 25

let busy = false
let irPromise = null

function probeDuration(file) {
  return execFileAsync('ffmpeg', ['-i', file]).then(() => 0).catch((e) => {
    const mch = String(e.stderr || '').match(/Duration: (\d+):(\d+):([\d.]+)/)
    return mch ? Number(mch[1]) * 3600 + Number(mch[2]) * 60 + Number(mch[3]) : 0
  })
}

// نبضة ريفيرب (ضجيج وردي مضمحل) — كتتولد مرة وحدة وكتبقى في assets
function getIR() {
  if (!irPromise) {
    irPromise = (async () => {
      const dir = path.join(process.cwd(), 'assets')
      const ir = path.join(dir, 'slowed-ir-v2.wav')
      try {
        if (fs.existsSync(ir) && fs.statSync(ir).size > 10000) return ir
        fs.mkdirSync(dir, { recursive: true })
        await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anoisesrc=d=3.4:c=pink:r=44100:a=0.85', '-af', 'lowpass=f=4600,afade=t=out:st=1.0:d=2.4,pan=stereo|c0=c0|c1=c0,volume=0.9', ir], { timeout: 30000 })
        return ir
      } catch { return null }
    })()
  }
  return irPromise
}

async function processAudio(inp, out, factor) {
  const ir = await getIR()
  const slow = `asetrate=44100*${factor},aresample=44100,atempo=1.0`
  if (ir) {
    // ريفيرب حقيقي: خلط الجاف مع المبلل عبر afir
    const fc = `[0:a]${slow},asplit=2[dry][wet];[wet][1:a]afir,volume=12[rev];[dry][rev]amix=inputs=2:duration=first:weights=1 1.1,lowpass=f=5600,alimiter=limit=0.92:level=false,loudnorm=I=-14:TP=-1.5:LRA=11`
    await execFileAsync('ffmpeg', ['-y', '-i', inp, '-i', ir, '-filter_complex', fc, '-vn', '-ar', '44100', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', out], { timeout: 600000 })
  } else {
    // بديل: صدى متعدد النقرات
    const fc = `${slow},aecho=0.82:0.92:55|115|195|310|430:0.46|0.38|0.3|0.22|0.16,lowpass=f=5200,alimiter=limit=0.92:level=false,loudnorm=I=-14:TP=-1.5:LRA=11`
    await execFileAsync('ffmpeg', ['-y', '-i', inp, '-af', fc, '-vn', '-ar', '44100', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', out], { timeout: 600000 })
  }
}

async function processVideo(inp, out, factor) {
  const ir = await getIR()
  const slowA = `asetrate=44100*${factor},aresample=44100`
  const verb = ir ? null : 'aecho=0.82:0.92:55|115|195|310:0.42|0.34|0.26|0.18'
  if (ir) {
    const fc = `[0:v]setpts=PTS/${factor},fps=30[v];[0:a]${slowA},asplit=2[dry][wet];[wet][1:a]afir,volume=12[rev];[dry][rev]amix=inputs=2:duration=first:weights=1 1.1,lowpass=f=5600,alimiter=limit=0.92:level=false[a]`
    await execFileAsync('ffmpeg', ['-y', '-i', inp, '-i', ir, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-codec:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-codec:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { timeout: 600000 })
  } else {
    const fc = `[0:v]setpts=PTS/${factor},fps=30[v];[0:a]${slowA},${verb},lowpass=f=4800,alimiter=limit=0.92:level=false[a]`
    await execFileAsync('ffmpeg', ['-y', '-i', inp, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-codec:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-codec:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { timeout: 600000 })
  }
}

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
  const src = m.quoted && (m.quoted.mtype === 'audioMessage' || m.quoted.mtype === 'videoMessage') ? m.quoted
    : (m.mtype === 'audioMessage' || m.mtype === 'videoMessage') ? m : null
  if (!src) {
    return m.reply(`🌙 *Slowed + Reverb ${VERSION}*\n\nرد على أغنية ولا فيديو بـ ${usedPrefix + command} وغادي ترجع ليك النسخة البطيئة مع الصدى.\n\n• ${usedPrefix + command} ← تبطيئ 0.85\n• ${usedPrefix + command} 0.8 ← عامل مخصص (0.5–0.98)\n• ${usedPrefix + command} video ← يرجع فيديو بطيء (≤90 ثانية)`)
  }
  const args = (text || '').toLowerCase()
  const wantVideo = /\bvideo\b|فيديو/.test(args)
  const numMatch = args.match(/0\.\d+/)
  let factor = numMatch ? parseFloat(numMatch[0]) : 0.85
  if (!(factor >= 0.5 && factor <= 0.98)) factor = 0.85
  if (busy) return m.reply('⏳ كاينة معالجة خدامة — سالي وعاود.')
  busy = true
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slowed-'))
  try {
    await m.react('🌙').catch(() => {})
    const buf = await src.download()
    if (!buf || !buf.length) throw new Error('download empty')
    if (buf.length > MAX_MB * 1024 * 1024) return m.reply(`⚠️ الملف كبير بزاف (الحد ${MAX_MB}MB).`)
    const isVideoSrc = src.mtype === 'videoMessage'
    const inp = path.join(dir, 'in' + (isVideoSrc ? '.mp4' : '.bin'))
    fs.writeFileSync(inp, buf)
    const dur = await probeDuration(inp)
    await m.reply(`🌙 كنبطّئ ×${factor} وكنزيد الصدى...${dur ? ` (الأصل ${Math.round(dur)} ثانية)` : ''}`)
    if (wantVideo) {
      if (!isVideoSrc) return m.reply('⚠️ وضع video خاص غير بالفيديوهات.')
      if (dur && dur > MAX_VIDEO_SEC) return m.reply(`⚠️ الفيديو طويل بزاف لوضع الفيديو (الحد ${MAX_VIDEO_SEC} ثانية) — جرب بلا video باش يرجع غير الصوت.`)
      const out = path.join(dir, 'out.mp4')
      await processVideo(inp, out, factor)
      const ob = fs.readFileSync(out)
      await conn.sendMessage(m.chat, { video: ob, mimetype: 'video/mp4', fileName: 'slowed.mp4', caption: `🌙 *Slowed + Reverb* ×${factor}` }, { quoted: m })
    } else {
      if (dur && dur > MAX_AUDIO_SEC) return m.reply(`⚠️ الصوت طويل بزاف (الحد ${MAX_AUDIO_SEC / 60} دقائق).`)
      const out = path.join(dir, 'out.mp3')
      await processAudio(inp, out, factor)
      const ob = fs.readFileSync(out)
      await conn.sendMessage(m.chat, { audio: ob, mimetype: 'audio/mpeg', fileName: 'slowed-reverb.mp3', ptt: false }, { quoted: m })
      await m.reply(`✅ *Slowed + Reverb* ×${factor} — ${Math.round(ob.length / 1024)}KB`)
    }
    await m.react('✅').catch(() => {})
  } catch (e) {
    await m.react('❌').catch(() => {})
    return m.reply('❌ وقع مشكل فالمعالجة.' + (isOwner ? `\n\n🔧 ${String(e?.message || e).slice(0, 220)}` : ''))
  } finally {
    busy = false
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  }
}

handler.help = ['slowed', 'slowed video']
handler.tags = ['tools']
handler.command = /^(slowed|بطيء)$/i
handler.limit = false

export default handler
                     
