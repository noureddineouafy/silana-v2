/*
 * UpChannel — نشر صوت / فيديو لأي قناة بالرابط — Silana v2
 * أمر واحد فقط: .upchannel — بلا قناة افتراضية: خاصك تعطي
 * رابط القناة (ولا الـ JID ديالها) مع كل نشر.
 *
 * ✅ هاد الطريقة تأكدت حيا فـ 2026-10-30 (اختبار testpost3):
 * المقاطع الصوتية ظهرت أخيرا فالقناة "test".
 *
 * علاش الطرق العادية ما خداماش: فـ Baileys الأصلية، relayMessage
 * ديال القنوات كتحط عقدة <plaintext> بلا خاصية mediatype،
 * فالخادم ما كينشرش الوسائط (النص بوحدو كيوصل). الحل — وهو نفس
 * لي كديرو النسخ المعدلة بحال baileys-mod — هو نبنيو رسالة
 * القناة بنفسنا ونصيفطوها بـ conn.sendNode:
 *
 *   <message to="…@newsletter" id="3EB0…" type="media">
 *     <plaintext mediatype="audio|video">…proto bytes…</plaintext>
 *   </message>
 *
 * الوسائط كنرفعوها بنفسنا لمسار القناة (raw newsletter upload)
 * وكنبنيو audioMessage/videoMessage يدويا — بحال فرع القنوات
 * داخل Baileys وبحال TEST 9 المؤكد. ما كنستعملوش
 * generateWAMessageContent حيت كيجهز وسائط مشفرة ديال
 * المحادثات (بـ mediaKey)، والقناة كتحمل الملف المشفر وما
 * كتقدرش تشغلو ("something is wrong with the audio file").
 *
 * الصوت: أي مقطع ماشي VN (mp3 / m4a / wav...) كيتحول تلقائيا
 * لـ voice note (ogg Opus بـ ffmpeg، نفس إعدادات toPTT ديال
 * Silana) قبل النشر — حيت الـ mp3 كما هو كيبان فالقناة عند
 * بزاف ديال النسخ بـ "Update WhatsApp" وما كيخدمش.
 * إلا بغيتي تنشرو ملف صوتي كما هو بلا تحويل: .upchannel file <link>
 *
 * بطاقة AdReply: المنشور كيخرج داخل بطاقة externalAdReply
 * (عنوان + وصف + صورة القناة + رابطها وزر View channel) مع
 * forwardedNewsletterMessageInfo — بحال بلاغين send-to-channel
 * ديال Silana. مفعّلة افتراضيا؛ عطّلها بـ: .upchannel noad <link>
 * وبدّل نصوص البطاقة من ثوابت AD_* لتحت.
 *
 * Usage (أمر واحد: upchannel):
 *   1. Reply to an audio or a video with:
 *        .upchannel https://whatsapp.com/channel/xxxx
 *      or with its JID directly:  .upchannel 120363xxxxxxxxxx@newsletter
 *   2. Or send the audio/video with that as caption.
 *   3. Round video (PTV):            .upchannel ptv <link>
 *   4. Keep an mp3 as a file:        .upchannel file <link>
 *   5. Without the AdReply card:     .upchannel noad <link>
 */

import { randomBytes, createHash } from 'crypto'
import { spawn } from 'child_process'
import { promises as fsp } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { proto } from 'baileys'

// ما كاين حتى قناة افتراضية — الرابط كيتعطى مع كل أمر

// — إعدادات بطاقة AdReply (خلي '' باش يتخاد تلقائيا من القناة) —
const AD_TITLE = ''        // عنوان البطاقة — افتراضيا: اسم القناة
const AD_BODY = 'SILANA AI BOT 📢' // وصف البطاقة
const AD_THUMB_URL = ''    // صورة البطاقة — افتراضيا: صورة بروفايل القناة
const AD_SOURCE_URL = ''   // رابط البطاقة — افتراضيا: رابط القناة المستعمل

const newMsgId = () => '3EB0' + randomBytes(10).toString('hex').toUpperCase()

// تحويل أي صوت لـ voice note (ogg Opus) — نفس أركومنتس toPTT فـ lib/converter.js ديال Silana
async function convertToVN(buffer, mime) {
    const ext = mime.includes('mp3') || mime.includes('mpeg') ? 'mp3'
        : mime.includes('mp4') || mime.includes('m4a') ? 'm4a'
        : mime.includes('wav') ? 'wav'
        : mime.includes('webm') ? 'webm'
        : mime.includes('ogg') ? 'ogg' : 'bin'
    const id = Date.now() + '-' + randomBytes(4).toString('hex')
    const inFile = join(tmpdir(), `upchannel-${id}.${ext}`)
    const outFile = inFile + '.ogg'
    await fsp.writeFile(inFile, buffer)
    try {
        await new Promise((resolve, reject) => {
            spawn('ffmpeg', ['-y', '-i', inFile, '-vn', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', outFile])
                .on('error', reject)
                .on('close', code => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with code ' + code))))
        })
        return await fsp.readFile(outFile)
    } finally {
        await fsp.unlink(inFile).catch(() => {})
        await fsp.unlink(outFile).catch(() => {})
    }
}

// رفع خام لمسار القناة: POST للملف كما هو لـ /newsletter/newsletter-<type>
// (باستعمال refreshMediaConn ديال البوت) — كيرجع url/directPath صالحين للقناة
async function newsletterUpload(conn, buffer, mediaType) {
    const fileSha256 = createHash('sha256').update(buffer).digest()
    const hashB64 = encodeURIComponent(fileSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))
    if (typeof conn.refreshMediaConn !== 'function') throw 'conn.refreshMediaConn is not available on this build.'
    let info = await conn.refreshMediaConn(false)
    if (!info?.hosts?.length || !info?.auth) throw 'refreshMediaConn returned no hosts/auth.'
    let lastErr = null
    for (const { hostname } of info.hosts) {
        try {
            const url = `https://${hostname}/newsletter/newsletter-${mediaType}/${hashB64}?auth=${encodeURIComponent(info.auth)}&token=${hashB64}`
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Origin: 'https://web.whatsapp.com' }, body: buffer })
            const data = await res.json().catch(() => null)
            if (data?.url || data?.direct_path) return { mediaUrl: data.url, directPath: data.direct_path, fileSha256 }
            lastErr = new Error(`upload to ${hostname}: ${JSON.stringify(data)?.slice(0, 200)}`)
        } catch (e) { lastErr = e }
    }
    throw lastErr || new Error('Newsletter upload failed on all hosts.')
}

// waveform اختياري للـ VN — باستيراد ديناميكي محمي باش ما يطيحش البلاغين إلا غاب
async function vnExtras(buffer, fallbackSeconds) {
    let seconds = fallbackSeconds || undefined
    let waveform
    try {
        const utils = await import('baileys')
        if (!seconds && typeof utils.getAudioDuration === 'function') seconds = Math.round((await utils.getAudioDuration(buffer)) || 0) || undefined
        if (typeof utils.getAudioWaveform === 'function') waveform = await utils.getAudioWaveform(buffer)
    } catch {}
    return { seconds, waveform }
}

// بناء contextInfo ديال بطاقة AdReply + إعادة التوجيه من القناة نفسها
async function buildAdContext(conn, channelJid, channelName, usedLink) {
    let name = channelName || ''
    if (!name) {
        let meta = await conn.newsletterMetadata('jid', channelJid).catch(() => null)
        name = meta?.name || ''
    }
    let thumbUrl = AD_THUMB_URL || ''
    if (!thumbUrl && typeof conn.profilePictureUrl === 'function') {
        thumbUrl = await conn.profilePictureUrl(channelJid, 'image').catch(() => '') || ''
    }
    return {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: channelJid,
            ...(name ? { newsletterName: name } : {}),
            serverMessageId: 100
        },
        externalAdReply: {
            title: AD_TITLE || name || 'Silana AI',
            body: AD_BODY,
            mediaType: 1,
            ...(thumbUrl ? { thumbnailUrl: thumbUrl } : {}),
            ...((AD_SOURCE_URL || usedLink) ? { sourceUrl: AD_SOURCE_URL || usedLink } : {}),
            renderLargerThumbnail: true,
            showAdAttribution: false
        }
    }
}

async function sendToChannel(conn, channelJid, messageContent, mediaType) {
    if (typeof conn.sendNode !== 'function') {
        throw 'conn.sendNode is not available on this Baileys build, so channel media posting is not possible this way.'
    }
    const bytes = proto.Message.encode(messageContent).finish()
    await conn.sendNode({
        tag: 'message',
        attrs: { to: channelJid, id: newMsgId(), type: 'media' },
        content: [{ tag: 'plaintext', attrs: { mediatype: mediaType }, content: bytes }]
    })
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    // تحديد المقطع بحال sendptvchannel الأصلية
    let q = m.quoted ? m.quoted : m
    let inner = q.msg || q
    let mime = inner.mimetype || ''

    let kind = mime.startsWith('audio/')
        ? 'audio'
        : mime.startsWith('video/')
          ? 'video'
          : q.mediaType === 'audioMessage'
            ? 'audio'
            : q.mediaType === 'videoMessage'
              ? 'video'
              : null

    if (!kind) {
        return m.reply(`⚠️ هاد الأمر غير للصوت والفيديو.\nجاوب على audio ولا video بـ:\n${usedPrefix + command}`)
    }

    // تحديد القناة
    let argv = args || []
    let jidArg = argv.find(a => /^\d+@newsletter$/.test(a))
    let linkArg = argv.find(a => /whatsapp\.com\/channel\/[A-Za-z0-9_-]+/i.test(a))
    let asPtv = argv.some(a => a.toLowerCase() === 'ptv')
    let keepFile = argv.some(a => ['file', 'orig', 'original'].includes(a.toLowerCase()))
    let noAd = argv.some(a => a.toLowerCase() === 'noad')

    // القناة خاصها تعطى مع الأمر: رابط ولا JID — ما كاين حتى افتراضي
    let channelJid = jidArg || ''
    let channelName = ''
    let usedLink = linkArg || ''
    if (!channelJid && !linkArg) {
        return m.reply(`⚠️ خاصك تعطي رابط القناة لي بغيتي تنشر فيها.\nمثال: جاوب على الصوت بـ:\n${usedPrefix + command} https://whatsapp.com/channel/xxxx`)
    }
    if (linkArg) {
        let code = linkArg.split('https://whatsapp.com/channel/')[1] || linkArg.match(/channel\/([A-Za-z0-9_-]+)/i)?.[1]
        let res = code ? await conn.newsletterMetadata('invite', code).catch(() => null) : null
        if (!res?.id) return m.reply(`⚠️ ما قدرتش نوصل لهاد القناة من الرابط. تأكد من الرابط وعاود المحاولة.`)
        channelJid = res.id
        channelName = res.name || ''
    }

    // بطاقة AdReply (إلا ما تعطلاتش بـ noad)
    let adContext = null
    if (!noAd) {
        adContext = await buildAdContext(conn, channelJid, channelName, usedLink).catch(e => {
            console.error('[upchannel] ad context failed:', e)
            return null
        })
    }

    // تحميل المقطع
    let media = await q.download()
    if (!media?.length) return m.reply('⚠️ Failed to download that media.')

    // caption: إلا المقطع مصيفط بالأمر كـ caption، كنحيد الأمر منو
    let caption = inner.caption || ''
    if (!m.quoted && caption) {
        let head = ((usedPrefix || '.') + (command || '')).toLowerCase()
        if (caption.trim().toLowerCase().startsWith(head)) {
            caption = caption.trim().slice(head.length)
                .replace(/^\s*ptv\b/i, '')
                .replace(/^\s*file\b/i, '')
                .replace(/^\s*noad\b/i, '')
                .replace(/^\s*https?:\/\/\S+/i, '')
                .replace(/^\s*\d+@newsletter/i, '')
                .trim()
        }
    }

    // تجهيز الوسائط + الإرسال بالطريقة المؤكدة
    if (kind === 'audio') {
        // أي صوت ماشي VN أصلا (mp3/m4a/...) كنحولوه لـ VN قبل النشر،
        // إلا طلب المستخدم يبقى ملف كما هو بـ .upchannel file <link>
        let isVN = !!inner.ptt && /opus|ogg/.test(mime)
        let audioBuffer = media
        let audioMime = mime || (inner.ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg')
        let asVN = !!inner.ptt
        let converted = false
        if (!keepFile && !isVN) {
            try {
                audioBuffer = await convertToVN(media, mime)
            } catch (e) {
                console.error('[upchannel] VN conversion failed:', e)
                return m.reply(`⚠️ فشل تحويل الصوت لـ voice note: ${String(e?.message || e).split('\n')[0]}\nتأكد بلي ffmpeg خدام عند البوت، ولا جرب .upchannel file <link> باش تنشرو كما هو.`)
            }
            audioMime = 'audio/ogg; codecs=opus'
            asVN = true
            converted = true
        }

        let up = await newsletterUpload(conn, audioBuffer, 'audio')
        let { seconds, waveform } = asVN ? await vnExtras(audioBuffer, inner.seconds) : { seconds: inner.seconds, waveform: undefined }
        let audioMessage = {
            url: up.mediaUrl,
            directPath: up.directPath,
            mimetype: audioMime,
            fileSha256: up.fileSha256,
            fileLength: audioBuffer.length,
            ptt: asVN,
            ...(seconds ? { seconds } : {}),
            ...(waveform ? { waveform } : {}),
            ...(adContext ? { contextInfo: adContext } : {})
        }
        await sendToChannel(conn, channelJid, { audioMessage }, 'audio')
        return m.reply(`✅ Sent ${asVN ? 'voice note' : 'audio'}${converted ? ' (converted to VN)' : ''} to ${channelName || 'channel'}.\n🆔 Channel JID: ${channelJid}`)
    }

    let up = await newsletterUpload(conn, media, 'video')
    let videoMessage = {
        url: up.mediaUrl,
        directPath: up.directPath,
        mimetype: 'video/mp4',
        fileSha256: up.fileSha256,
        fileLength: media.length,
        caption: asPtv ? undefined : caption,
        ...(inner.seconds ? { seconds: inner.seconds } : {}),
        ...(inner.gifPlayback ? { gifPlayback: true } : {}),
        ...(adContext ? { contextInfo: adContext } : {})
    }
    await sendToChannel(conn, channelJid, asPtv ? { ptvMessage: videoMessage } : { videoMessage }, 'video')
    return m.reply(`✅ Sent video${asPtv ? ' (PTV)' : ''} to ${channelName || 'channel'}.\n🆔 Channel JID: ${channelJid}`)
}

handler.help = handler.command = ['upchannel']
handler.tags = ['owner']
handler.owner = true

export default handler
