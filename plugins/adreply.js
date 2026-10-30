/*
 * AdReply All — كل ردود البوت على شكل AdReply — Silana v2
 *
 * كيخدم بـ before hook: كيبدل m.reply ديال أي أمر، فأي رد نصي
 * (مثال: جواب .s "Send or reply to media...") كيخرج ببطاقة
 * AdReply ديال Silana نفسها (conn.adReply): صورة + عنوان + وصف
 * + رابط — بدل النص العادي.
 *
 * التحكم (للمالك فقط):  .adreply on  /  .adreply off
 * الحالة كتبقى حتى يعاود البوت التشغيل.
 *
 * ملاحظة: الردود لي ماشي نصية (صور/ملفات...) كتبقى عادية.
 */

import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

// — إعدادات البطاقة —
const AD_TITLE = 'SILANA BOT ✦ سيلانا بوت'                 // عنوان البطاقة
const AD_BODY = 'أقوى بوت واتساب ذكي ومتطور ⚡ سرعة • ذكاء • أمان' // الوصف تحت العنوان
const AD_SOURCE = 'https://whatsapp.com/channel/0029VaX4b6J7DAWqt3Hhu01A' // القناة الرسمية — رابط البطاقة (كيعطي زر View channel)
// صورة البطاقة — ملاحظة: رابط ShareBin المباشر /files/ كيرجع صفحة HTML،
// فرابط /embed/ هو لي كيعطي الصورة نيشان (تحققنا منو)
const AD_THUMB_URL = 'https://sharebin.eu/embed/file_000000004a9871f59bf494baa80ac527.png'

// تصغير صورة لـ JPEG صغير (320px) بـ ffmpeg — thumbnails ديال معاينة
// الروابط فواتساب خاصهم يكونو صغار، والصورة الأصلية 2MB ما بانتش
function downscaleJpeg(buffer) {
    return new Promise((resolve) => {
        try {
            const ff = spawn('ffmpeg', ['-y', '-i', 'pipe:0', '-vf', 'scale=320:320:force_original_aspect_ratio=decrease', '-f', 'mjpeg', '-q:v', '3', 'pipe:1'])
            const chunks = []
            ff.stdout.on('data', c => chunks.push(c))
            ff.on('error', () => resolve(null))
            ff.on('close', code => resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : null))
            ff.stdin.on('error', () => {})
            ff.stdin.end(buffer)
        } catch { resolve(null) }
    })
}

let thumbCache // undefined = ما تحسبش، null = ما كاينش
async function getThumb(conn) {
    if (thumbCache !== undefined) return thumbCache
    try {
        if (AD_THUMB_URL) {
            // كنحملو الصورة من الرابط بـ User-Agent ديال متصفح،
            // وكنصغروها وحدنا — بلا ما يحتاج المستخدم يحط حتى ملف
            const res = await fetch(AD_THUMB_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Safari/537.36' } })
            const buf = Buffer.from(await res.arrayBuffer())
            const isImage = buf.length > 1024 && (buf[0] === 0x89 && buf[1] === 0x50 || buf[0] === 0xFF && buf[1] === 0xD8)
            if (isImage) return (thumbCache = (await downscaleJpeg(buf)) || buf)
        }
        if (conn?.user?.jid && typeof conn.profilePictureUrl === 'function') {
            const pp = await conn.profilePictureUrl(conn.user.jid, 'image', 'buffer').catch(() => null)
            if (pp) return (thumbCache = pp)
        }
        const local = fileURLToPath(new URL('../media/thumbnail.jpg', import.meta.url))
        if (existsSync(local)) return (thumbCache = local)
    } catch {}
    return (thumbCache = null)
}

let handler = async (m, { conn, text }) => {
    const arg = (text || '').trim().toLowerCase()
    if (arg === 'off') {
        globalThis.__adReplyAll = false
        return m.reply('🔕 AdReply replies: OFF — الردود رجعات عادية.')
    }
    if (arg === 'on') {
        globalThis.__adReplyAll = true
        return m.reply('🔔 AdReply replies: ON — كل الردود النصية غادي تخرج ببطاقة AdReply.')
    }
    return m.reply(`AdReply replies are currently: ${globalThis.__adReplyAll === false ? 'OFF 🔕' : 'ON 🔔'}\nUsage: .adreply on | off`)
}
handler.help = handler.command = ['adreply']
handler.tags = ['owner']
handler.owner = true

handler.before = async function (m, { conn }) {
    if (globalThis.__adReplyAll === false) return
    if (!m || typeof m.reply !== 'function' || m.__adReplyWrapped) return
    if (typeof conn?.adReply !== 'function') return
    m.__adReplyWrapped = true
    const original = m.reply.bind(m)
    const wrapped = async (text, ...rest) => {
        if (typeof text !== 'string' || !text.trim()) return original(text, ...rest)
        try {
            const thumb = await getThumb(conn)
            if (!thumb) return original(text, ...rest)
            return await conn.adReply(m.chat, text, thumb, m, {
                title: AD_TITLE || conn.user?.name || 'SILANA AI',
                description: AD_BODY,
                source: AD_SOURCE,
            })
        } catch (e) {
            console.error('[adreply] failed, falling back:', e?.message || e)
            return original(text, ...rest)
        }
    }
    try {
        // m.reply فـ Silana معرفة على الـ prototype بـ defineProperties
        // (read-only) — التعيين العادي m.reply = ... كيخسر، ولكن
        // defineProperty على الرسالة نفسها كتظللها بنجاح
        Object.defineProperty(m, 'reply', { value: wrapped, writable: true, configurable: true })
    } catch (e) {
        console.error('[adreply] could not wrap m.reply:', e?.message || e)
    }
}

export default handler
