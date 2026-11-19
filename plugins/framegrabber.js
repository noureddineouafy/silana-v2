import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'

// .framegrabber — grabs one still image from a video at any second.
//   .framegrabber        -> the middle frame (a ready-made thumbnail)
//   .framegrabber 12     -> the frame at second 12
//   .framegrabber 1:30   -> the frame at 1 minute 30

const busy = new Set()
const run = (args) => new Promise((res, rej) => execFile('ffmpeg', args, { maxBuffer: 1 << 28 }, (e, so, se) => e ? rej(new Error(String(se || e.message).slice(-300))) : res(se)))
const probeRaw = (file) => new Promise((res) => execFile('ffmpeg', ['-i', file], (e, so, se) => res(String(se || ''))))

function parseTime(s, dur) {
  s = String(s || '').trim()
  if (!s) return dur > 0 ? Math.floor(dur / 2) : 1
  if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(s)) {
    const p = s.split(':').map(Number)
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
  }
  const n = parseFloat(s.replace(',', '.'))
  return isFinite(n) && n >= 0 ? n : -1
}
const fmtT = (t) => { const h = Math.floor(t / 3600), mi = Math.floor((t % 3600) / 60), se = Math.floor(t % 60); return (h ? h + ':' : '') + (h || mi ? String(mi).padStart(2, '0') + ':' : '') + String(se).padStart(2, '0') }

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const q = m.quoted ? m.quoted : m
  const mime = (q.msg || q).mimetype || ''
  if (!/video/.test(mime)) return conn.reply(m.chat, '↩️ Reply to a *video* with `' + usedPrefix + command + ' [second]`\nExamples: `' + usedPrefix + command + '` (middle frame) · `' + usedPrefix + command + ' 12` · `' + usedPrefix + command + ' 1:30`', m)
  if (busy.has(m.sender)) return conn.reply(m.chat, '⏳ A frame grab is already running for you — wait for it.', m)
  busy.add(m.sender)
  const dir = path.join(process.cwd(), 'tmp')
  const stamp = Date.now() + '-' + Math.floor(Math.random() * 1e5)
  const inF = path.join(dir, 'frm-in-' + stamp)
  const outF = path.join(dir, 'frm-out-' + stamp + '.jpg')
  try {
    await fs.promises.mkdir(dir, { recursive: true })
    const buf = await q.download()
    if (!buf || !buf.length) throw new Error('could not download the video')
    if (buf.length > 100 * 1024 * 1024) throw new Error('video too large (max 100 MB)')
    await fs.promises.writeFile(inF, buf)
    const info = await probeRaw(inF)
    const dm = info.match(/Duration: (\d+):(\d+):([\d.]+)/)
    const dur = dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + (+dm[3]) : 0
    let t = parseTime(text, dur)
    if (t < 0) throw new Error('give me a valid second, like 12 or 1:30')
    if (dur > 0 && t > dur - 0.2) t = Math.max(0, dur - 0.5)
    await run(['-y', '-ss', String(t), '-i', inF, '-frames:v', '1', '-q:v', '2', outF])
    const out = await fs.promises.readFile(outF)
    if (!out.length) throw new Error('no frame at that second')
    await conn.sendMessage(m.chat, { image: out, caption: '🖼️ *Frame at ' + fmtT(t) + '*' + (dur ? ' (video length ' + fmtT(dur) + ')' : '') }, { quoted: m })
  } catch (e) {
    await conn.reply(m.chat, '❌ ' + (e && e.message ? e.message : e), m)
  } finally {
    busy.delete(m.sender)
    for (const f of [inF, outF]) { try { fs.unlinkSync(f) } catch (e) {} }
  }
}

handler.help = ['framegrabber']
handler.tags = ['tools']
handler.command = /^framegrabber$/i
export default handler
               
