// plugins/grouptheme-v2.js — Group Theme & Wallpaper (.grouptheme)
// ============================================================
// v2 — the REAL shared group theme protocol, ported from the
// gist by krsna081 (Baileys Group Theme Protocol) after v1's
// live check proved the panel core has NO conn.setThemGroup.
//
// How it works (no conn helper needed):
//   1. Build a ChatThemeSetting payload by hand with
//      protobufjs Writer (Baileys 6.7.x WAProto has no
//      ChatThemeSetting type — verified locally; if a future
//      Baileys adds it, that encoder is preferred instead).
//   2. Wrap it in the theme protocol message (outer field 12,
//      type 34, payload at field 30).
//   3. Encrypt it as a sender-key group message through
//      conn.signalRepository.encryptGroupMessage and send the
//      raw node with mediatype 'chat_theme' via conn.sendNode.
// Wallpaper images are encrypted with the dedicated
// 'WhatsApp Chat Wallpaper Keys' HKDF (AES-256-CBC + HMAC)
// and uploaded to WhatsApp's own MMS hosts.
//
// Usage (group admins / owner only):
//   .grouptheme pink | #ff69b4 | وردي   colour preset or hex
//   .grouptheme            (reply to a photo) -> wallpaper
//   .grouptheme <image URL>           -> wallpaper from URL
//   .grouptheme reset                 -> back to default
//   .grouptheme check                 -> probe panel support
//
// HONEST STATUS: the payload/encryption path is a faithful
// port of the published gist implementation and is locally
// byte-verified, but whether WhatsApp delivers a shared theme
// from a bot account depends on the beta rollout — the live
// panel test is the verdict.
// ES2020 only (panel parser rule). Single file.
// ============================================================

import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

var COLOR_PRESETS = {
    pink: { hex: 'ff69b4', scheme: 'Pink@Tonal' },
    blue: { hex: '1e90ff', scheme: 'Royal-Blue@Tonal' },
    purple: { hex: '9b59b6', scheme: 'Amethyst@Tonal' },
    black: { hex: '121212', scheme: 'Dark@Tonal' },
    green: { hex: '2ecc71', scheme: 'Emerald@Tonal' },
    red: { hex: 'e74c3c', scheme: 'Crimson@Tonal' },
    yellow: { hex: 'f1c40f', scheme: 'Amber@Tonal' },
    orange: { hex: 'e67e22', scheme: 'Amber@Tonal' },
    white: { hex: 'f5f6fa', scheme: 'Light@Tonal' },
    biru: { hex: '1e90ff', scheme: 'Royal-Blue@Tonal' },
    ungu: { hex: '9b59b6', scheme: 'Amethyst@Tonal' },
    hitam: { hex: '121212', scheme: 'Dark@Tonal' },
    hijau: { hex: '2ecc71', scheme: 'Emerald@Tonal' },
    merah: { hex: 'e74c3c', scheme: 'Crimson@Tonal' },
    kuning: { hex: 'f1c40f', scheme: 'Amber@Tonal' },
    oren: { hex: 'e67e22', scheme: 'Amber@Tonal' },
    putih: { hex: 'f5f6fa', scheme: 'Light@Tonal' }
}
var AR_PRESETS = {
    'وردي': 'pink', 'ازرق': 'blue', 'أزرق': 'blue', 'بنفسجي': 'purple',
    'اسود': 'black', 'أسود': 'black', 'اخضر': 'green', 'أخضر': 'green',
    'احمر': 'red', 'أحمر': 'red', 'اصفر': 'yellow', 'أصفر': 'yellow',
    'برتقالي': 'orange', 'ابيض': 'white', 'أبيض': 'white'
}

function normId(jid) { return String(jid || '').split('@')[0].split(':')[0] }

function findImageMedia(obj, depth, hintType) {
    if (!obj || typeof obj !== 'object' || depth > 7) return null
    if (obj.imageMessage) return findImageMedia(obj.imageMessage, depth + 1, 'image')
    if (obj.documentMessage && /^image\//i.test(obj.documentMessage.mimetype || '')) return findImageMedia(obj.documentMessage, depth + 1, 'document')
    if (obj.viewOnceMessage && obj.viewOnceMessage.message) return findImageMedia(obj.viewOnceMessage.message, depth + 1, hintType)
    if (obj.viewOnceMessageV2 && obj.viewOnceMessageV2.message) return findImageMedia(obj.viewOnceMessageV2.message, depth + 1, hintType)
    if (obj.viewOnceMessageV2Extension && obj.viewOnceMessageV2Extension.message) return findImageMedia(obj.viewOnceMessageV2Extension.message, depth + 1, hintType)
    if (obj.ephemeralMessage && obj.ephemeralMessage.message) return findImageMedia(obj.ephemeralMessage.message, depth + 1, hintType)
    if (obj.documentWithCaptionMessage && obj.documentWithCaptionMessage.message) return findImageMedia(obj.documentWithCaptionMessage.message, depth + 1, 'document')
    if (obj.editedMessage && obj.editedMessage.message) return findImageMedia(obj.editedMessage.message, depth + 1, hintType)
    if (obj.msg && typeof obj.msg === 'object') {
        var mtype = String(obj.mtype || '')
        var nextHint = /image/i.test(mtype) ? 'image' : (/document/i.test(mtype) ? 'document' : hintType)
        var foundInMsg = findImageMedia(obj.msg, depth + 1, nextHint)
        if (foundInMsg) return foundInMsg
    }
    if (obj.message && typeof obj.message === 'object') {
        var foundInMessage = findImageMedia(obj.message, depth + 1, hintType)
        if (foundInMessage) return foundInMessage
    }
    if (obj.mediaKey && (obj.directPath || obj.url)) {
        var mime = String(obj.mimetype || '')
        if (hintType === 'image' || /^image\//i.test(mime)) {
            var dlType = hintType || (mime && !/^image\/(jpeg|jpg|png|webp)$/i.test(mime) ? 'document' : 'image')
            return { media: obj, dlType: dlType }
        }
    }
    return null
}

function extractMediaTarget(m) {
    if (m.quoted) {
        var foundQuoted = findImageMedia(m.quoted, 0, '')
        if (foundQuoted) return { holder: m.quoted, media: foundQuoted.media, dlType: foundQuoted.dlType }
    }
    var foundSelf = findImageMedia(m, 0, '')
    if (foundSelf) return { holder: m, media: foundSelf.media, dlType: foundSelf.dlType }
    return null
}

async function getMediaBuffer(conn, baileys, target) {
    var holder = target.holder
    if (holder && typeof holder.download === 'function') {
        var buf1 = await holder.download().catch(function () { return null })
        if (Buffer.isBuffer(buf1) && buf1.length) return buf1
    }
    var stream = await baileys.downloadContentFromMessage(target.media, target.dlType)
    var chunks = []
    for await (var chunk of stream) chunks.push(chunk)
    return Buffer.concat(chunks)
}

async function fetchUrlBuffer(url) {
    var res = await fetch(url)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    var ctype = res.headers.get('content-type') || ''
    if (!/^image\//i.test(ctype)) throw new Error('الرابط ماشي صورة')
    return Buffer.from(await res.arrayBuffer())
}

function encryptChatWallpaper(imgBuf) {
    var mediaKey = crypto.randomBytes(32)
    var expanded = Buffer.from(crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from('WhatsApp Chat Wallpaper Keys'), 112))
    var iv = expanded.subarray(0, 16)
    var cipherKey = expanded.subarray(16, 48)
    var macKey = expanded.subarray(48, 80)
    var cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv)
    var enc = Buffer.concat([cipher.update(imgBuf), cipher.final()])
    var mac = crypto.createHmac('sha256', macKey).update(Buffer.concat([iv, enc])).digest().subarray(0, 10)
    var encFile = Buffer.concat([enc, mac])
    return {
        encFile: encFile,
        mediaKey: mediaKey,
        fileSha256: crypto.createHash('sha256').update(imgBuf).digest(),
        fileEncSha256: crypto.createHash('sha256').update(encFile).digest()
    }
}

async function uploadDirectWallpaperMms(conn, encFile, fileEncSha256) {
    if (typeof conn.refreshMediaConn !== 'function') return null
    var mediaConn = await conn.refreshMediaConn(false).catch(function () { return null })
    if (!mediaConn) mediaConn = await conn.refreshMediaConn(true).catch(function () { return null })
    if (!mediaConn || !mediaConn.auth) return null
    var hosts = (mediaConn.hosts && mediaConn.hosts.length) ? mediaConn.hosts : [{ hostname: 'mmg.whatsapp.net' }]
    var token = fileEncSha256.toString('base64url')
    for (var i = 0; i < hosts.length; i++) {
        var host = hosts[i].hostname || hosts[i]
        var url = 'https://' + host + '/mms/chat-wallpaper-image/' + encodeURIComponent(token) +
            '?auth=' + encodeURIComponent(mediaConn.auth) + '&token=' + encodeURIComponent(token)
        try {
            var res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream', Origin: 'https://web.whatsapp.com' },
                body: encFile
            })
            if (!res.ok) continue
            var json = await res.json().catch(function () { return null })
            var directPath = json ? (json.direct_path || json.directPath) : null
            if (directPath) return directPath
        } catch (e) { /* try next host */ }
    }
    return null
}

async function uploadWallpaper(conn, imgBuf) {
    var enc = encryptChatWallpaper(imgBuf)
    var directMmsPath = await uploadDirectWallpaperMms(conn, enc.encFile, enc.fileEncSha256)
    if (directMmsPath) return { directPath: directMmsPath, mediaKey: enc.mediaKey, fileEncSha256: enc.fileEncSha256, fileSha256: enc.fileSha256 }
    var tmpFile = path.join(os.tmpdir(), 'wp_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + '.enc')
    try {
        fs.writeFileSync(tmpFile, enc.encFile)
        var up = await conn.waUploadToServer(tmpFile, { fileEncSha256B64: enc.fileEncSha256.toString('base64'), mediaType: 'image' })
        if (!up || !up.directPath) throw new Error('CDN server did not return directPath')
        return { directPath: up.directPath, mediaKey: enc.mediaKey, fileEncSha256: enc.fileEncSha256, fileSha256: enc.fileSha256 }
    } finally {
        try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch (e) {}
    }
}

function encodeChatThemePayload(Writer, proto, themeObj) {
    var ChatThemeSetting = proto && proto.Message ? proto.Message.ChatThemeSetting : null
    if (ChatThemeSetting && ChatThemeSetting.encode) {
        return ChatThemeSetting.encode(ChatThemeSetting.create(themeObj)).finish()
    }
    var w = Writer.create().uint32(8).int64(themeObj.settingTimestampMs || Date.now())
    if (themeObj.clearTheme) w.uint32(16).bool(true)
    if (themeObj.colorSchemeId) w.uint32(26).string(themeObj.colorSchemeId)
    if (themeObj.solidColor) {
        var sc = themeObj.solidColor
        w.uint32(90).fork()
            .uint32(13).fixed32(sc.backgroundLightArgb)
            .uint32(21).fixed32(sc.backgroundDarkArgb)
            .uint32(24).bool(sc.isDoodleEnabled !== false)
            .ldelim()
    } else if (themeObj.customImage) {
        var ci = themeObj.customImage
        w.uint32(106).fork()
            .uint32(10).string(ci.directPath)
            .uint32(18).bytes(ci.mediaKey)
            .uint32(26).bytes(ci.fileEncSha256)
            .uint32(34).bytes(ci.fileSha256)
            .uint32(45).float(ci.dimLevel || 0)
            .ldelim()
    }
    return w.finish()
}

let handler = async (m, { conn, text, isOwner }) => {
    if (!m.isGroup) return m.reply('🎨 هاد الأمر خاص بالمجموعات فقط.')
    var baileys = await import('baileys')
    var proto = baileys.proto || (baileys.default ? baileys.default.proto : null)
    var pb = await import('protobufjs/minimal.js')
    var Writer = pb.Writer || (pb.default ? pb.default.Writer : null)
    if (!Writer) return m.reply('⚠️ protobufjs ما متوفرش في البانل — البلاغين ما يقدرش يبني رسالة الثيم.')

    var q = String(text || '').trim()

    if (q.toLowerCase() === 'check') {
        var lines = ['🔎 *فحص دعم الثيمات (v2 — بروتوكول مباشر):*']
        lines.push((conn.signalRepository && typeof conn.signalRepository.encryptGroupMessage === 'function' ? '✅' : '❌') + ' signalRepository.encryptGroupMessage')
        lines.push((typeof conn.sendNode === 'function' ? '✅' : '❌') + ' conn.sendNode')
        lines.push((typeof conn.refreshMediaConn === 'function' ? '✅' : '❌') + ' conn.refreshMediaConn (لرفع الخلفية)')
        lines.push((typeof conn.waUploadToServer === 'function' ? '✅' : '❌') + ' conn.waUploadToServer (احتياطي)')
        lines.push((proto && proto.Message && proto.Message.ChatThemeSetting ? '✅' : 'ℹ️') + ' proto ChatThemeSetting ' + (proto && proto.Message && proto.Message.ChatThemeSetting ? '(كنستعملو)' : '(غايب — كنستعمل البناء اليدوي، عادي)'))
        lines.push((typeof baileys.writeRandomPadMax16 === 'function' ? '✅' : '❌') + ' baileys.writeRandomPadMax16')
        lines.push('')
        lines.push('v2 ما كيحتاجش setThemGroup — كيصيفط رسالة الثيم مشفّرة مباشرة ببروتوكول المجموعات.')
        return m.reply(lines.join('\n'))
    }

    var meta = await conn.groupMetadata(m.chat).catch(function () { return null })
    if (!meta) return m.reply('🚩 ما قدرت نجلب معلومات المجموعة.')

    var senderNum = normId(m.sender)
    var me = (conn.authState && conn.authState.creds ? conn.authState.creds.me : null) || conn.user || {}
    var botIds = {}
    if (normId(me.id)) botIds[normId(me.id)] = true
    if (normId(me.lid)) botIds[normId(me.lid)] = true
    var isSenderAdmin = false
    var isBotAdmin = false
    var parts = meta.participants || []
    for (var pi = 0; pi < parts.length; pi++) {
        var p = parts[pi]
        var admin = p.admin === 'admin' || p.admin === 'superadmin'
        if (!admin) continue
        if (normId(p.id) === senderNum || normId(p.lid) === senderNum) isSenderAdmin = true
        if (botIds[normId(p.id)] || botIds[normId(p.lid)]) isBotAdmin = true
    }
    if (!isSenderAdmin && !isOwner) return m.reply('🚩 غير مشرفي المجموعة ولا مالك البوت يقدرو يبدلو الثيم.')
    if (meta.restrict && !isBotAdmin) return m.reply('🚩 رقّي البوت لمشرف في المجموعة باش يقدر يبدّل الثيم.')

    var mediaTarget = extractMediaTarget(m)
    var urlMatch = q.match(/^(https?:\/\/\S+)$/i)

    if (!q && !mediaTarget) {
        return m.reply(
            '🎨 *ثيم المجموعة* — كيبدّل لون المحادثة ولا الخلفية عند كل الأعضاء\n\n' +
            '◦ لون جاهز: .grouptheme pink\n' +
            '◦ لون حر: .grouptheme #ff69b4\n' +
            '◦ خلفية: رد على صورة بـ .grouptheme، ولا .grouptheme + رابط صورة\n' +
            '◦ رجوع للافتراضي: .grouptheme reset\n' +
            '◦ فحص الدعم: .grouptheme check\n\n' +
            '*الألوان:* pink, blue, purple, black, green, red, yellow, orange, white\n' +
            'وبالعربية: وردي، أزرق، بنفسجي، أسود، أخضر، أحمر، أصفر، برتقالي، أبيض'
        )
    }

    try {
        var themePayload = { settingTimestampMs: Date.now() }
        var presetName = AR_PRESETS[q] || q.toLowerCase()
        var preset = COLOR_PRESETS[presetName]
        var hexInput = preset ? preset.hex : (/^#?[0-9a-f]{6}$/i.test(q) ? q.replace('#', '') : null)
        var modeLabel = ''

        if (/^(reset|hapus|clear|default|restore|افتراضي)$/i.test(q)) {
            themePayload.clearTheme = true
            modeLabel = 'الثيم الافتراضي (إعادة)'
        } else if (hexInput) {
            var cor = (0xff000000 | parseInt(hexInput, 16)) >>> 0
            themePayload.solidColor = { backgroundLightArgb: cor, backgroundDarkArgb: cor, isDoodleEnabled: true }
            if (preset && preset.scheme) themePayload.colorSchemeId = preset.scheme
            modeLabel = preset ? 'لون ' + presetName + ' (#' + hexInput.toUpperCase() + ')' : 'لون #' + hexInput.toUpperCase()
        } else if (mediaTarget || urlMatch) {
            var imgBuf = mediaTarget ? await getMediaBuffer(conn, baileys, mediaTarget) : await fetchUrlBuffer(urlMatch[1])
            if (!Buffer.isBuffer(imgBuf) || !imgBuf.length) throw new Error('الصورة خاوية ولا فشل تحميلها')
            var up = await uploadWallpaper(conn, imgBuf)
            themePayload.customImage = { directPath: up.directPath, mediaKey: up.mediaKey, fileEncSha256: up.fileEncSha256, fileSha256: up.fileSha256, dimLevel: 0 }
            modeLabel = 'خلفية من ' + (mediaTarget ? 'صورة' : 'رابط')
        } else {
            return m.reply('🚩 صيغة ما معروفة. استعمل لون hex (#ff69b4)، ولا اسم لون (pink / وردي...)، ولا رد على صورة، ولا .grouptheme reset.')
        }

        if (!conn.signalRepository || typeof conn.signalRepository.encryptGroupMessage !== 'function') {
            return m.reply('🚩 البانل ما فيه signalRepository.encryptGroupMessage — دير .grouptheme check باش تشوف شنو ناقص.')
        }
        if (typeof conn.sendNode !== 'function') {
            return m.reply('🚩 البانل ما فيه conn.sendNode — دير .grouptheme check باش تشوف شنو ناقص.')
        }

        var themeBytes = encodeChatThemePayload(Writer, proto, themePayload)
        var msgBytes = Writer.create().uint32(98).fork().uint32(16).int32(34).uint32(242).bytes(themeBytes).ldelim().finish()
        var modo = meta.addressingMode || 'lid'
        var meId = (modo === 'lid' && me.lid) ? me.lid : me.id
        var encResult = await conn.signalRepository.encryptGroupMessage({
            group: m.chat,
            data: baileys.writeRandomPadMax16(msgBytes),
            meId: meId
        })
        await conn.sendNode({
            tag: 'message',
            attrs: {
                id: baileys.generateMessageIDV2(me.id),
                to: m.chat,
                type: 'media',
                addressing_mode: modo
            },
            content: [{
                tag: 'enc',
                attrs: { v: '2', type: 'skmsg', mediatype: 'chat_theme' },
                content: encResult.ciphertext
            }]
        })
        return m.reply('✅ تصيفط ثيم المجموعة (' + modeLabel + ').\nإلا ما بان عند الأعضاء، فحساباتهم باقي ما وصلها دعم الثيمات المشتركة (بيتا واتساب) — الرسالة تصيفطات بالبروتوكول الصحيح.')
    } catch (err) {
        console.error('[GROUPTHEME V2]', err)
        return m.reply('🚩 فشل تبديل الثيم: ' + (isOwner ? String((err && err.message) || err) : 'وقع خطأ تقني — المالك يقدر يشوف التفاصيل في الكونسول.'))
    }
}

handler.help = ['grouptheme']
handler.tags = ['owner']
handler.command = ['grouptheme']
handler.group = true
handler.owner = true
export default handler
      
