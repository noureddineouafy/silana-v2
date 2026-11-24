/*
 * AdReply v11 — بطاقة القناة thumbnail-link + ترويسة forwarded

 * جديد في v11: التخصيص بالأوامر (كيتحفظ في db):
 *   .adreply name <نص>   — اسم القناة في الترويسة (الافتراضي SILANA AI)
 *   .adreply title <نص>  — عنوان البطاقة
 *   .adreply body <نص>   — وصف البطاقة
 *   .adreply name reset  — رجوع للافتراضي (نفس الشيء لـ title/body) — Silana v2
 *
 * ملف واحد — كيتركب بـ .sfp adreply (كيتعوض plugins/adreply.js).
 * بلا ملفات مرافقة، بلا استضافة، بلا صور يدوية.
 *
 * الطريقة (مؤكدة حية في ReplyTest4 D): thumbnail-link مبني داخل
 * البلاغين — prepareWAMessageMedia بـ mediaTypeOverride
 * 'thumbnail-link' + extendedTextMessage + relayMessage.
 * externalAdReply ميت على هاد الجلسة (ReplyTest 1-3).
 *
 * شنو تبدل على v8 (اللي وصلات ردودها عادية بلا بطاقة):
 *  1. سباق التحضير تصلح: الصورة المصغرة ولات promise كيتسنى —
 *     v8 كانت كترجع null إلا كان التحضير خدام، فالرد كيمشي عادي.
 *  2. conn.reply تباتشات حتى هي — بزاف ديال البلاغينات كيجاوبو
 *     بـ m.reply ماشي conn.sendMessage مباشرة.
 *  3. قواعد الالتفاف توسعات: كنقبل text + mentions.
 *  4. .adreply كتبين عدادات: شحال تلف وشحال تسكيبا — للتشخيص.
 *
 * إلا فشل بناء البطاقة لأي سبب، الرد كيمشي عادي — حتى رد ما يضيع.
 * الأوامر: .adreply / .adreply on / .adreply off / .adreply test
 */

var AD_SOURCE = 'https://whatsapp.com/channel/0029VaX4b6J7DAWqt3Hhu01A'
var CHANNEL_INVITE = '0029VaX4b6J7DAWqt3Hhu01A'
var AD_TITLE = 'SILANA BOT ✦ سيلانا بوت'
var AD_BODY = 'أقوى بوت واتساب ذكي ومتطور ⚡ سرعة • ذكاء • أمان'

var state = {
    channelJid: null,
    thumb: null,
    thumbPromise: null,
    baileys: null,
    baileysPromise: null,
    internal: 0,
    wrapped: 0,
    skipped: 0,
    lastSkip: ''
}

function withTimeout(promise, ms, fallback) {
    return Promise.race([
        Promise.resolve(promise),
        new Promise(function (resolve) { setTimeout(function () { resolve(fallback) }, ms) })
    ]).catch(function () { return fallback })
}

function settings(conn) {
    try {
        var db = globalThis.db
        if (!db || !db.data) return null
        if (!db.data.settings) db.data.settings = {}
        var botJid = 'bot'
        if (conn && conn.user) botJid = String(conn.user.jid || conn.user.id || 'bot').replace(/[^0-9]/g, '')
        if (!db.data.settings[botJid]) db.data.settings[botJid] = {}
        return db.data.settings[botJid]
    } catch (e) { return null }
}

function isEnabled(conn) {
    if (globalThis.__adReplyAll === false) return false
    var s = settings(conn)
    if (s && s.adreply === false) return false
    return true
}

function loadBaileys() {
    if (state.baileys) return Promise.resolve(state.baileys)
    if (state.baileysPromise) return state.baileysPromise
    state.baileysPromise = (async function () {
        var names = ['baileys', '@whiskeysockets/baileys', '@adiwajshing/baileys']
        for (var i = 0; i < names.length; i++) {
            try {
                var mod = await import(names[i])
                if (mod && typeof mod.prepareWAMessageMedia === 'function' && typeof mod.generateWAMessageFromContent === 'function') {
                    state.baileys = mod
                    break
                }
            } catch (e) {}
        }
        return state.baileys
    })()
    return state.baileysPromise
}

async function resolveChannelJid(conn) {
    if (state.channelJid) return state.channelJid
    try {
        if (conn && typeof conn.newsletterMetadata === 'function') {
            var meta = await withTimeout(conn.newsletterMetadata('invite', CHANNEL_INVITE), 5000, null)
            if (meta && meta.id) state.channelJid = String(meta.id)
        }
    } catch (e) {}
    return state.channelJid
}

function findDirectPath(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 4) return null
    if (typeof obj.directPath === 'string' && obj.mediaKey) return obj
    var keys = Object.keys(obj)
    for (var i = 0; i < keys.length; i++) {
        var hit = findDirectPath(obj[keys[i]], depth + 1)
        if (hit) return hit
    }
    return null
}

async function fetchImageBuffer(conn, jid) {
    try {
        if (!jid || typeof conn.profilePictureUrl !== 'function') return null
        var url = await withTimeout(conn.profilePictureUrl(jid, 'image'), 4000, null)
        if (typeof url !== 'string') return null
        if (typeof conn.getFile === 'function') {
            var res = await withTimeout(conn.getFile(url), 6000, null)
            var data = res && (res.data || res.buffer)
            if (data && data.length > 1024) return data
        }
        var r = await withTimeout(fetch(url), 6000, null)
        if (r && r.ok) {
            var b = Buffer.from(await r.arrayBuffer())
            if (b && b.length > 1024) return b
        }
    } catch (e) {}
    return null
}

function prepareThumb(conn) {
    if (state.thumb) return Promise.resolve(state.thumb)
    if (state.thumbPromise) return state.thumbPromise
    state.thumbPromise = (async function () {
        try {
            var B = await loadBaileys()
            if (!B) return null
            var jid = await resolveChannelJid(conn)
            var buf = null
            if (jid) buf = await fetchImageBuffer(conn, jid)
            if (!buf && conn.user) buf = await fetchImageBuffer(conn, conn.user.jid || conn.user.id || '')
            if (!buf) return null
            var prepared = await B.prepareWAMessageMedia({ image: buf }, { upload: conn.waUploadToServer, mediaTypeOverride: 'thumbnail-link' })
            var img = findDirectPath(prepared, 0)
            if (!img) return null
            state.thumb = {
                jpegThumbnail: img.jpegThumbnail || undefined,
                directPath: img.directPath,
                mediaKey: img.mediaKey,
                mediaKeyTimestamp: img.mediaKeyTimestamp,
                width: img.width || 320,
                height: img.height || 320,
                fileSha256: img.fileSha256,
                fileEncSha256: img.fileEncSha256
            }
            return state.thumb
        } catch (e) { return null } finally { state.thumbPromise = null }
    })()
    return state.thumbPromise
}

async function sendCard(conn, chat, text, quoted, mentions) {
    var B = await loadBaileys()
    if (!B) return null
    var t = await prepareThumb(conn)
    if (!t) return null
    var ext = {
        text: AD_SOURCE + '\n' + text,
        matchedText: AD_SOURCE,
        title: titleOf(conn),
        description: bodyOf(conn),
        previewType: 0,
        thumbnailDirectPath: t.directPath,
        mediaKey: t.mediaKey,
        mediaKeyTimestamp: t.mediaKeyTimestamp,
        thumbnailWidth: t.width,
        thumbnailHeight: t.height,
        thumbnailSha256: t.fileSha256,
        thumbnailEncSha256: t.fileEncSha256
    }
    if (t.jpegThumbnail) ext.jpegThumbnail = t.jpegThumbnail
    var ci = {}
    var hasCi = false
    if (mentions && mentions.length) { ci.mentionedJid = mentions; hasCi = true }
    if (forwardEnabled(conn)) {
        var chanJid = await resolveChannelJid(conn)
        if (chanJid) {
            ci.forwardingScore = 999
            ci.isForwarded = true
            ci.forwardedNewsletterMessageInfo = {
                newsletterJid: chanJid,
                serverMessageId: 100,
                newsletterName: nameOf(conn)
            }
            hasCi = true
        }
    }
    if (hasCi) ext.contextInfo = ci
    var msg = B.generateWAMessageFromContent(chat, { extendedTextMessage: ext }, quoted ? { quoted: quoted } : {})
    await conn.relayMessage(chat, msg.message, { messageId: msg.key.id })
    state.wrapped++
    return msg
}

function wrapTargetOk(conn, jid) {
    if (state.internal > 0) return false
    if (!isEnabled(conn)) return false
    if (!jid || typeof jid !== 'string') return false
    if (jid.endsWith('@newsletter') || jid === 'status@broadcast') return false
    if (typeof conn.relayMessage !== 'function') return false
    return true
}

function contentMentions(content) {
    var out = []
    if (content.mentions && content.mentions.length) out = content.mentions.slice()
    if (content.contextInfo && content.contextInfo.mentionedJid && content.contextInfo.mentionedJid.length) {
        out = out.concat(content.contextInfo.mentionedJid)
    }
    return out
}

function shouldWrapContent(conn, jid, content) {
    if (!wrapTargetOk(conn, jid)) return false
    if (!content || typeof content !== 'object') { state.lastSkip = 'no-content'; return false }
    if (typeof content.text !== 'string' || !content.text.length) { state.lastSkip = 'no-text'; return false }
    if (content.text.indexOf(AD_SOURCE) !== -1) { state.lastSkip = 'has-link'; return false }
    var keys = Object.keys(content)
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i]
        if (k === 'text' || k === 'mentions') continue
        if (k === 'contextInfo') {
            var ci = content.contextInfo || {}
            var ciKeys = Object.keys(ci)
            var ciOk = true
            for (var j = 0; j < ciKeys.length; j++) { if (ciKeys[j] !== 'mentionedJid') { ciOk = false; break } }
            if (ciOk) continue
        }
        state.lastSkip = 'key:' + k
        return false
    }
    return true
}

function forwardEnabled(conn) {
    var s = settings(conn)
    if (s && s.adreplyForward === false) return false
    return true
}

function nameOf(conn) {
    var s = settings(conn)
    return (s && typeof s.adreplyName === 'string' && s.adreplyName) ? s.adreplyName : 'SILANA AI'
}
function titleOf(conn) {
    var s = settings(conn)
    return (s && typeof s.adreplyTitle === 'string' && s.adreplyTitle) ? s.adreplyTitle : AD_TITLE
}
function bodyOf(conn) {
    var s = settings(conn)
    return (s && typeof s.adreplyBody === 'string' && s.adreplyBody) ? s.adreplyBody : AD_BODY
}

function safeAssign(obj, key, value) {
    // Some conn methods (e.g. 'reply', 'sendMessage' from lib/simple.js) may be
    // defined read-only / non-configurable. Never let patching crash a command:
    // try plain assignment, then defineProperty, then give up silently.
    try { obj[key] = value; if (obj[key] === value) return true } catch (e) {}
    try {
        Object.defineProperty(obj, key, { value: value, writable: true, configurable: true, enumerable: true })
        return obj[key] === value
    } catch (e) { return false }
}

function patchConn(conn) {
    if (!conn || typeof conn.sendMessage !== 'function') return
    if (!conn.__adreplyV11) {
        var originalSend = conn.sendMessage.bind(conn)
        var patchedSend = async function (jid, content, opts) {
            if (shouldWrapContent(conn, jid, content)) {
                try {
                    var card = await sendCard(conn, jid, content.text, opts && opts.quoted, contentMentions(content))
                    if (card) return card
                } catch (e) { state.thumb = null }
                state.skipped++
            }
            return originalSend(jid, content, opts)
        }
        if (safeAssign(conn, 'sendMessage', patchedSend)) {
            conn.__adreplyV11 = true
            try { conn.__adreplyRawSend = originalSend } catch (e) {}
        } else {
            conn.__adreplyV11 = 'failed'
        }
    }
    if (typeof conn.reply === 'function' && !conn.__adreplyV11Reply) {
        var originalReply = conn.reply.bind(conn)
        var patchedReply = async function (jid, text, quoted, options) {
            var optsHasText = options && typeof options === 'object' && typeof options.text === 'string'
            if (typeof text === 'string' && text.length && !optsHasText && wrapTargetOk(conn, jid) && text.indexOf(AD_SOURCE) === -1) {
                try {
                    var card2 = await sendCard(conn, jid, text, quoted, null)
                    if (card2) return card2
                } catch (e) { state.thumb = null }
                state.skipped++
            }
            return originalReply(jid, text, quoted, options)
        }
        if (safeAssign(conn, 'reply', patchedReply)) {
            conn.__adreplyV11Reply = true
            try { conn.__adreplyRawReply = originalReply } catch (e) {}
        } else {
            conn.__adreplyV11Reply = 'failed'
        }
    }
}

async function rawReply(conn, m, text) {
    state.internal++
    try {
        var raw = conn.__adreplyRawSend || conn.sendMessage.bind(conn)
        return await raw(m.chat, { text: text }, { quoted: m })
    } finally { state.internal-- }
}

var handler = async function (m, extra) {
    var conn = (extra && extra.conn) || globalThis.conn
    if (!conn) return
    patchConn(conn)
    var rawAll = ((extra && extra.args) || []).join(' ').trim()
    if (!rawAll && typeof m.text === 'string') {
        var parts0 = m.text.trim().split(/\s+/)
        rawAll = parts0.slice(1).join(' ').trim()
    }
    var args = rawAll.toLowerCase()
    var s = settings(conn)

    var cmdWord = args.split(/\s+/)[0] || ''
    if (cmdWord === 'name' || cmdWord === 'title' || cmdWord === 'body') {
        var field = cmdWord === 'name' ? 'adreplyName' : (cmdWord === 'title' ? 'adreplyTitle' : 'adreplyBody')
        var label = cmdWord === 'name' ? 'اسم الترويسة' : (cmdWord === 'title' ? 'عنوان البطاقة' : 'وصف البطاقة')
        var value = rawAll.slice(cmdWord.length).trim()
        if (!s) return rawReply(conn, m, '⚠️ db غير متاح — التخصيص ما تحفظش.')
        if (!value) {
            var cur = cmdWord === 'name' ? nameOf(conn) : (cmdWord === 'title' ? titleOf(conn) : bodyOf(conn))
            return rawReply(conn, m, label + ' الحالي: ' + cur + '\nباش تبدلو: .adreply ' + cmdWord + ' <النص الجديد>')
        }
        if (value.toLowerCase() === 'reset') {
            delete s[field]
            return rawReply(conn, m, '↩️ ' + label + ' رجع للافتراضي.')
        }
        s[field] = value.slice(0, 200)
        return rawReply(conn, m, '✅ ' + label + ' تبدل: ' + s[field])
    }

    if (args === 'on') {
        if (s) s.adreply = true
        globalThis.__adReplyAll = true
        prepareThumb(conn)
        return rawReply(conn, m, '✅ AdReply v11 خدام — الردود غادي تولي بطاقات للقناة (thumbnail-link).')
    }
    if (args === 'off') {
        if (s) s.adreply = false
        return rawReply(conn, m, '⛔ AdReply v11 مطفي — الردود غادي تبقى عادية.')
    }
    if (args === 'test') {
        state.internal++
        try {
            var card = await sendCard(conn, m.chat, 'AdReply v11 — تجربة البطاقة (thumbnail-link + forwarded)', m, null)
            if (card) return
        } catch (e) {} finally { state.internal-- }
        return rawReply(conn, m, '⚠️ AdReply test: بناء البطاقة فشل، الرد العادي خدام. شوف الكونسول.')
    }
    if (args === 'forward') {
        if (s) s.adreplyForward = true
        return rawReply(conn, m, '✅ ترويسة forwarded (SILANA AI) خدامة في البطاقات.')
    }
    if (args === 'noforward') {
        if (s) s.adreplyForward = false
        return rawReply(conn, m, '⛔ ترويسة forwarded مطفية — البطاقات غادي تبقى بـ thumbnail-link بوحدو.')
    }
    var jid = state.channelJid || (await resolveChannelJid(conn)) || 'unresolved'
    var status = isEnabled(conn) ? 'ON ✅' : 'OFF ⛔'
    var thumbState = state.thumb ? 'محضرة (cached)' : 'ماشي محضرة بعد'
    return rawReply(conn, m,
        'AdReply v11 — thumbnail-link + forwarded\n' +
        'الحالة: ' + status + '\n' +
        'Channel JID: ' + jid + '\n' +
        'الصورة المصغرة: ' + thumbState + '\n' +
        'تلفو: ' + state.wrapped + ' — تسكيباو: ' + state.skipped + (state.lastSkip ? ' (آخر سبب: ' + state.lastSkip + ')' : '') + '\n' +
        'patch sendMessage: ' + (conn.__adreplyV11 ? 'yes' : 'no') + ' — patch reply: ' + (conn.__adreplyV11Reply ? 'yes' : 'no') + '\n' +
        'forward: ' + (forwardEnabled(conn) ? 'ON' : 'OFF') + '\n' +
        'اسم الترويسة: ' + nameOf(conn) + '\n' +
        '.adreply on / off / test / forward / noforward / name / title / body')
}
handler.help = ['adreply']
handler.tags = ['owner']
handler.command = ['adreply']
handler.owner = true

handler.all = async function (m, extra) {
    var conn = (extra && extra.conn) || globalThis.conn
    if (!conn) return
    if (globalThis.adReply) globalThis.adReply = false
    patchConn(conn)
    if (!state.channelJid) resolveChannelJid(conn)
    if (!state.thumb && isEnabled(conn)) prepareThumb(conn)
}

export default handler
        
