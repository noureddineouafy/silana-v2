import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
function run(cmd, args, ms) {
    return new Promise(function (resolve, reject) {
        execFile(cmd, args, { timeout: ms || 240000 }, function (err, stdout, stderr) { if (err) { err.stderr = stderr; reject(err) } else resolve(stderr || '') })
    })
}
function probeDur(file) {
    return run('ffmpeg', ['-i', file]).catch(function (e) {
        var mt = /Duration: (\d+):(\d+):([\d.]+)/.exec(e.stderr || '')
        if (!mt) return 0
        return parseInt(mt[1]) * 3600 + parseInt(mt[2]) * 60 + parseFloat(mt[3])
    })
}
var lastUse = {}
let handler = async (m, { conn, text }) => {
    var q = m.quoted ? m.quoted : m
    var mime = ((q.msg || q).mimetype || '')
    if (!/video/.test(mime)) return m.reply('🎬 *بوميرانغ*\n\nرد على فيديو قصير بـ `.boomerang` وغادي يرجع ليك كيدور قدّام/لور بلا ما يوقف.\n\n▸ `.boomerang` — جوج دورات (الافتراضي)\n▸ `.boomerang 3` — عدد الدورات (1 حتى 4)\n\nالفيديو الطويل كيتقصّ لأول 10 ثواني، والصوت كيتحيّد (البوميرانغ صامت).')
    var now = Date.now()
    if (lastUse[m.sender] && now - lastUse[m.sender] < 15000) return m.reply('⏳ صبر شوية… البوميرانغ كياخد شوية ديال الخدمة، عاود بعد ثواني')
    var cycles = parseInt((text || '').trim()) || 2
    if (cycles < 1 || cycles > 4) return m.reply('❌ عدد الدورات بين 1 و 4')
    var media
    try { media = await q.download() } catch (e) {}
    if (!media) { try { media = await conn.downloadMediaMessage(q) } catch (e) {} }
    if (!media) return m.reply('❌ ما قدرتش نهبط الفيديو، عاود المحاولة')
    if (media.length > 30 * 1024 * 1024) return m.reply('❌ الفيديو كبير بزاف (الحد 30MB)')
    lastUse[m.sender] = now
    var dir = path.join(process.cwd(), 'tmp', 'boomerang')
    try { fs.mkdirSync(dir, { recursive: true }) } catch (e) {}
    var stamp = Date.now()
    var inF = path.join(dir, 'in' + stamp + '.mp4')
    var outF = path.join(dir, 'out' + stamp + '.mp4')
    try {
        fs.writeFileSync(inF, media)
        var dur = await probeDur(inF)
        if (!dur) return m.reply('❌ ما قدرتش نقرا مدة الفيديو')
        var clip = Math.min(dur, 10)
        var n = cycles * 2
        var splitOuts = '', filters = '', concatIn = ''
        for (var i = 0; i < n; i++) splitOuts += '[s' + i + ']'
        for (var j = 0; j < n; j++) {
            if (j % 2 === 1) { filters += '[s' + j + ']reverse[r' + j + '];'; concatIn += '[r' + j + ']' }
            else concatIn += '[s' + j + ']'
        }
        var fc = '[0:v]trim=0:' + clip + ',setpts=PTS-STARTPTS,scale=\'min(720,iw)\':-2,fps=30,split=' + n + splitOuts + ';' + filters + concatIn + 'concat=n=' + n + ':v=1:a=0[v]'
        await run('ffmpeg', ['-y', '-v', 'error', '-t', '12', '-i', inF, '-filter_complex', fc, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outF])
        var buf = fs.readFileSync(outF)
        var outDur = Math.round(clip * 2 * cycles)
        await conn.sendMessage(m.chat, { video: buf, caption: '🎬 بوميرانغ واجد! ' + cycles + (cycles === 1 ? ' دورة' : ' دورات') + ' — المدة ~' + outDur + ' ثانية', mimetype: 'video/mp4' }, { quoted: m })
    } catch (e) {
        m.reply('❌ وقع خطأ أثناء صناعة البوميرانغ')
    } finally {
        try { fs.unlinkSync(inF) } catch (e) {}
        try { fs.unlinkSync(outF) } catch (e) {}
    }
}
handler.help = ['boomerang']
handler.tags = ['tools']
handler.command = /^(boomerang)$/i
export default handler
  
