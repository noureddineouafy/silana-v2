// .groupphoto v2 — builds one composite "class photo" grid from the group members' profile pictures
// v2: smaller composite + image-send retry + document fallback (panel media uploads can fail on all hosts)
import { execFile } from 'child_process'
import { promises as fsp } from 'fs'
import os from 'os'
import path from 'path'

const MAX_MEMBERS = 120
const COOLDOWN_MS = 60000
const PALETTE = ['0x37474F', '0x4E342E', '0x1A237E', '0x004D40', '0x880E4F', '0x33691E', '0x263238', '0x3E2723', '0x0D47A1', '0x006064']
const cooldowns = new Map()

function fetchT(url, ms) {
    const ctrl = new AbortController()
    const t = setTimeout(function () { ctrl.abort() }, ms || 10000)
    return fetch(url, { signal: ctrl.signal }).then(function (res) { clearTimeout(t); return res }).catch(function (e) { clearTimeout(t); throw e })
}
function isImage(buf) {
    if (!buf || buf.length < 50) return false
    if (buf[0] === 0xFF && buf[1] === 0xD8) return true
    if (buf[0] === 0x89 && buf[1] === 0x50) return true
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return true
    return false
}
function runFfmpeg(args) {
    return new Promise(function (resolve, reject) {
        execFile('ffmpeg', args, { maxBuffer: 16 * 1024 * 1024, timeout: 120000 }, function (err, stdout, stderr) {
            if (err) { err.stderrText = stderr ? stderr.toString().slice(-300) : ''; return reject(err) }
            resolve()
        })
    })
}
async function fetchPic(conn, jid) {
    try {
        const url = await conn.profilePictureUrl(jid, 'image')
        if (!url) return null
        const res = await fetchT(url, 10000)
        if (!res.ok) return null
        const buf = Buffer.from(await res.arrayBuffer())
        return isImage(buf) ? buf : null
    } catch (e) { return null }
}

const handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    if (!m.chat || m.chat.indexOf('@g.us') === -1) return m.reply('👥 هاد الميزة خاصة بالمجموعات — جرّبها داخل أي مجموعة.')
    const now = Date.now()
    const last = cooldowns.get(m.chat) || 0
    if (!isOwner && now - last < COOLDOWN_MS) {
        return m.reply('⏳ الصورة الجماعية خدمة ثقيلة — عاود من بعد ' + Math.ceil((COOLDOWN_MS - (now - last)) / 1000) + ' ثانية.')
    }
    let meta
    try { meta = await conn.groupMetadata(m.chat) } catch (e) { return m.reply('😕 ما قدرت نجيب أعضاء المجموعة دابا — عاود المحاولة.') }
    const parts = ((meta && meta.participants) || []).map(function (p) { return p.id }).filter(Boolean)
    if (parts.length < 2) return m.reply('😕 المجموعة صغيرة بزاف على صورة جماعية.')
    const capped = parts.length > MAX_MEMBERS
    const members = parts.slice(0, MAX_MEMBERS)
    cooldowns.set(m.chat, now)
    await m.react('📸')
    await m.reply('📸 كنبني الصورة الجماعية لـ ' + members.length + ' عضو — لحظة...')
    const pics = new Array(members.length).fill(null)
    for (let i = 0; i < members.length; i += 10) {
        const batch = members.slice(i, i + 10)
        const got = await Promise.all(batch.map(function (jid) { return fetchPic(conn, jid) }))
        for (let j = 0; j < batch.length; j++) pics[i + j] = got[j]
    }
    const realCount = pics.filter(Boolean).length
    const n = members.length
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    const tile = n <= 16 ? 256 : (n <= 36 ? 176 : (n <= 64 ? 144 : 112))
    const cells = cols * rows
    let dir = null
    try {
        dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'groupphoto-'))
        const args = ['-y']
        const filters = []
        let inputIdx = 0
        for (let i = 0; i < n; i++) {
            if (pics[i]) {
                const f = path.join(dir, 'p' + i + '.img')
                await fsp.writeFile(f, pics[i])
                args.push('-i', f)
            } else {
                args.push('-f', 'lavfi', '-i', 'color=c=' + PALETTE[i % PALETTE.length] + ':s=' + tile + 'x' + tile)
            }
            filters.push('[' + inputIdx + ':v]scale=' + tile + ':' + tile + ':force_original_aspect_ratio=increase,crop=' + tile + ':' + tile + ',setsar=1[v' + i + ']')
            inputIdx++
        }
        for (let k = n; k < cells; k++) {
            args.push('-f', 'lavfi', '-i', 'color=c=0x111111:s=' + tile + 'x' + tile)
            filters.push('[' + inputIdx + ':v]setsar=1[v' + k + ']')
            inputIdx++
        }
        const layout = []
        for (let i = 0; i < cells; i++) layout.push(((i % cols) * tile) + '_' + (Math.floor(i / cols) * tile))
        let chain = ''
        for (let i = 0; i < cells; i++) chain += '[v' + i + ']'
        filters.push(chain + 'xstack=inputs=' + cells + ':layout=' + layout.join('|') + '[out]')
        args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-frames:v', '1', '-q:v', '5', path.join(dir, 'out.jpg'))
        await runFfmpeg(args)
        const out = await fsp.readFile(path.join(dir, 'out.jpg'))
        if (!out || out.length < 2000) throw new Error('composite too small')
        let caption = '📸 *الصورة الجماعية — ' + (meta.subject || 'المجموعة') + '*\n👥 ' + n + ' عضو'
        caption += '\n🖼️ ' + realCount + ' بصور حقيقية' + (n - realCount > 0 ? ' · ' + (n - realCount) + ' بلا صورة بروفايل' : '')
        if (capped) caption += '\n⚠️ المجموعة كبيرة — هادي أول ' + MAX_MEMBERS + ' عضو'
        let delivered = false
        for (let attempt = 0; attempt < 2 && !delivered; attempt++) {
            try {
                await conn.sendMessage(m.chat, { image: out, caption: caption }, { quoted: m })
                delivered = true
            } catch (e) {
                if (attempt === 0) await new Promise(function (r) { setTimeout(r, 4000) })
                else throw e
            }
        }
        await m.react('✅')
    } catch (e) {
        // last resort: the same composite as a document (a different media path)
        try {
            const out2 = await fsp.readFile(path.join(dir, 'out.jpg'))
            let caption2 = '📸 *الصورة الجماعية — ' + (meta.subject || 'المجموعة') + '* (كمستند — إرسال الصورة فشل)\n👥 ' + n + ' عضو · 🖼️ ' + realCount + ' بصور حقيقية'
            await conn.sendMessage(m.chat, { document: out2, mimetype: 'image/jpeg', fileName: 'groupphoto.jpg', caption: caption2 }, { quoted: m })
            await m.react('✅')
            return
        } catch (e2) {}
        await m.react('❌')
        let msg = '😕 ما قدرتش نبني الصورة الجماعية دابا — عاود المحاولة من بعد.'
        if (isOwner) msg += '\n\n🔧 ' + (e.message || String(e)) + (e.stderrText ? '\n' + e.stderrText : '')
        return m.reply(msg)
    } finally {
        if (dir) { try { await fsp.rm(dir, { recursive: true, force: true }) } catch (e) {} }
    }
}

handler.help = ['groupphoto']
handler.tags = ['owner']
handler.command = /^groupphoto$/i
handler.owner = true
export default handler
  
