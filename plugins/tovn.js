// plugins/tovn.js — محول الملاحظات الصوتية (مصحح)
//
// المشكل فالنسخة القديمة: كانت كتصيفط الملف الأصلي كما هو
// (mp3 مثلا) مع mimetype 'audio/mp4' و ptt:true بلا تحويل —
// فالملاحظة الصوتية كتبان ولكن ما كتخدمش:
// "This audio is not available because something is wrong
//  with the audio file."
// الحل: التحويل الحقيقي لـ Ogg Opus بـ toPTT ديال Silana
// (lib/converter.js — ffmpeg) قبل الإرسال.

import { toPTT } from '../lib/converter.js'

let handler = async (m, { conn, usedPrefix, command }) => {
    if (!m.quoted) {
        return m.reply(
            '📌 *محول الملاحظات الصوتية*\n\n' +
            'كيحول أي مقطع صوتي ولا فيديو لـ voice note خدامة.\n\n' +
            '*الاستعمال:*\n' +
            '1. جاوب على مقطع صوتي ولا فيديو.\n' +
            `2. كتب: ${usedPrefix + command}\n\n` +
            '_الأوامر: .tovn / .tovoice / .vn_'
        )
    }

    let q = m.quoted
    let inner = q.msg || q
    let mime = inner.mimetype || q.mimetype ||
        q.message?.audioMessage?.mimetype ||
        q.message?.videoMessage?.mimetype ||
        q.message?.documentMessage?.mimetype || ''

    if (!/^(audio|video)\//.test(mime)) {
        return m.reply(`⚠️ صيغة غير مدعومة: ${mime || 'غير معروفة'}\nجاوب على مقطع صوتي ولا فيديو ولا ملف صوتي.`)
    }

    try {
        let buffer = await q.download()
        if (!buffer || buffer.length < 1024) {
            return m.reply('⚠️ فشل التحميل ولا الملف صغير بزاف.')
        }

        // إلا كان أصلا VN بـ opus، كنصيفطوه كما هو بلا إعادة تحويل
        let isOpusVN = !!inner.ptt && /opus|ogg/.test(mime)
        let out = buffer
        let cleanup = null
        if (!isOpusVN) {
            let ext = mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
                : mime.includes('mp4') ? (mime.startsWith('video/') ? 'mp4' : 'm4a')
                : mime.includes('ogg') ? 'ogg'
                : mime.includes('wav') ? 'wav'
                : mime.includes('webm') ? 'webm'
                : mime.includes('quicktime') ? 'mov' : 'mp3'
            let res = await toPTT(buffer, ext)
            out = res.data
            cleanup = res.delete
        }

        await conn.sendMessage(
            m.chat,
            { audio: out, mimetype: 'audio/ogg; codecs=opus', ptt: true },
            { quoted: m }
        )
        if (cleanup) await cleanup().catch(() => {})
    } catch (e) {
        console.error('[TOVN] error:', e)
        m.reply('⚠️ فشل تحويل المقطع لـ voice note. تأكد بلي ffmpeg خدام عند البوت.')
    }
}

handler.help = handler.command = ['tovn', 'tovoice', 'vn']
handler.tags = ['tools']
handler.limit = false

export default handler
