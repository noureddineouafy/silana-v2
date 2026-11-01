// plugins/apk.js — تحميل التطبيقات (APK)
// بحث وتحميل تطبيقات أندرويد بصيغة APK:
//   • البحث والتحميل المباشر عبر Aptoide API (JSON، بلا مفتاح)
//   • احتياطيا APKPure (أحدث نسخة) عند فشل المصدر الأول
// ملاحظة: Google Play نفسه ما كيعطيش ملفات APK مباشرة (كيطلب حساب Google)،
// فالمعلومات والتحميل كيجيو من هاد المرايا — والنتيجة نفس التطبيق والنسخة.
//
// الأوامر:
//   .apk <اسم التطبيق>        بحث (مثال: .apk whatsapp)
//   .apk <رقم>                 تحميل نتيجة من آخر بحث
//   .apk <package.id>          تحميل مباشر (مثال: .apk com.whatsapp)
//   .apk <رابط Play Store>     تحميل مباشر من الرابط
//
import fs from 'node:fs'
import path from 'node:path'

// مهم على هاد الاستضافة: /tmp ديال النظام محدود بـ 100MB فقط، وأي كتابة مؤقتة
// أكبر منو كتطيح بـ ENOSPC. كنحولو الملفات المؤقتة لمجلد tmp داخل البوت
// (على القرص الكبير) من بداية التحميل.
const BOT_TMP = path.join(process.cwd(), 'tmp')
try { fs.mkdirSync(BOT_TMP, { recursive: true }); process.env.TMPDIR = BOT_TMP } catch {}

// حد الإرسال: إلا فات الحجم 170MB البوت كيرسل رابط التحميل المباشر بدل الملف.
// حد التحميل اليومي: 6 تطبيقات لكل مستعمل فالنهار (المالك مستثنى).

const MAX_SEND = 170 * 1024 * 1024
const DAILY_LIMIT = 6
const DAY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date())
const memLimits = new Map()

function limitState(sender) {
    const today = DAY()
    try {
        const data = globalThis.db.data
        if (!data.apkLimits || typeof data.apkLimits !== 'object') data.apkLimits = {}
        let rec = data.apkLimits[sender]
        if (!rec || rec.day !== today) { rec = { day: today, n: 0 }; data.apkLimits[sender] = rec }
        return rec
    } catch {
        let rec = memLimits.get(sender)
        if (!rec || rec.day !== today) { rec = { day: today, n: 0 }; memLimits.set(sender, rec) }
        return rec
    }
}
const remaining = (sender) => Math.max(0, DAILY_LIMIT - limitState(sender).n)
const LIMIT_WARNING = '⚠️ *تنبيه:* ممنوع تحميل أكثر من 6 تطبيقات في اليوم، وإذا حملتي أكثر سيتم طردك.'
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
const sessions = new Map() // sender -> { results, at }

const mb = (bytes) => bytes ? (bytes / 1048576).toFixed(1) + 'MB' : '؟'
const pureLink = (pkg) => `https://d.apkpure.com/b/APK/${pkg}?version=latest`

async function aptoideSearch(query, limit = 8) {
    const url = `https://ws75.aptoide.com/api/7.20190205/apps/search?query=${encodeURIComponent(query)}&limit=${limit}`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`Aptoide HTTP ${res.status}`)
    const json = await res.json()
    const list = json?.datalist?.list || []
    return list.map((a) => ({
        name: a.name,
        pkg: a.package,
        dev: a.developer?.name || '',
        size: a.file?.filesize || a.size || 0,
        version: a.file?.vername || '',
        icon: a.icon || '',
        url: a.file?.path || a.file?.path_alt || '',
    })).filter((a) => a.pkg && a.url)
}

async function downloadBuffer(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
}

async function sendApk(m, conn, app, isOwner) {
    if (!isOwner && remaining(m.sender) <= 0) {
        return m.reply(`⛔ *وصلتي للحد اليومي!*\n\nحملتي ديجا ${DAILY_LIMIT} تطبيقات اليوم. الحد الأقصى هو ${DAILY_LIMIT} تطبيقات فالنهار — عاود غدا.\n\n${LIMIT_WARNING}`)
    }
    if (app.size && app.size > MAX_SEND) {
        return m.reply(
            `📦 *${app.name}* (${mb(app.size)}) — الحجم كبير على الإرسال فواتساب.\n\n` +
            `حملو مباشرة من هنا:\n${app.url}\n\n` +
            `أو أحدث نسخة من APKPure:\n${pureLink(app.pkg)}`)
    }
    await m.reply(`⏳ كنحمل *${app.name}* (${mb(app.size)})...`)
    // ملاحظة: كنرسلو Buffer — طبقة الميديا ديال هاد القاعدة ما كتقبلش الـ streams
    // (كطيح بـ toString of undefined)، والـ TMPDIR المحول أعلاه كيخلي أي كتابة
    // مؤقتة ديال Baileys تمشي للقرص الكبير بدل /tmp المحدود بـ 100MB.
    let buffer
    try {
        buffer = await downloadBuffer(app.url)
    } catch {
        // احتياطيا: APKPure
        const res = await fetch(pureLink(app.pkg), { headers: { 'User-Agent': UA } })
        if (!res.ok) throw new Error(`APKPure HTTP ${res.status}`)
        const len = Number(res.headers.get('content-length') || 0)
        if (len > MAX_SEND) {
            return m.reply(`📦 الحجم كبير على الإرسال (${mb(len)}). حملو من هنا:\n${pureLink(app.pkg)}`)
        }
        buffer = Buffer.from(await res.arrayBuffer())
    }
    if (buffer.length > MAX_SEND) {
        return m.reply(`📦 الحجم كبير على الإرسال (${mb(buffer.length)}). حملو من هنا:\n${pureLink(app.pkg)}`)
    }
    const fileName = `${String(app.name).replace(/[^\p{L}\p{N} ]/gu, '').trim().replace(/\s+/g, '_') || app.pkg}.apk`
    const sent = await conn.sendMessage(m.chat, {
        document: buffer,
        mimetype: 'application/vnd.android.package-archive',
        fileName,
        caption: `✅ *${app.name}*\n📦 ${app.pkg}${app.version ? `\n🔢 النسخة: ${app.version}` : ''}\n💾 ${mb(buffer.length)}`,
    }, { quoted: m })
    if (!isOwner) {
        const rec = limitState(m.sender)
        rec.n++
        await m.reply(`📊 حملتي ${rec.n}/${DAILY_LIMIT} تطبيقات اليوم — باقي ليك ${DAILY_LIMIT - rec.n}.\n${LIMIT_WARNING}`).catch(() => {})
    }
    return sent
}

let handler = async (m, { conn, text, command, isOwner, usedPrefix }) => {
    const q = (text || '').trim()

    // اختيار برقم من آخر بحث
    if (/^\d+$/.test(q)) {
        const s = sessions.get(m.sender)
        if (!s || Date.now() - s.at > 10 * 60 * 1000) {
            return m.reply('⌛ ما كاين حتى بحث نشط. دير بحث جديد: ' + usedPrefix + command + ' <اسم التطبيق>')
        }
        const app = s.results[Number(q) - 1]
        if (!app) return m.reply(`⚠️ الرقم غير موجود. اختار ما بين 1 و ${s.results.length}.`)
        try { return await sendApk(m, conn, app, isOwner) }
        catch (e) {
            return m.reply('❌ فشل التحميل من جميع المصادر. عاود من بعد.' + (isOwner ? `\n\n🔧 تفاصيل للمالك: ${String(e?.message || e).slice(0, 150)}` : ''))
        }
    }

    if (!q) {
        return m.reply(
            '📱 *تحميل التطبيقات (APK)*\n\n' +
            `${usedPrefix + command} <اسم التطبيق> — بحث\n` +
            `${usedPrefix + command} <package.id> — تحميل مباشر\n` +
            `${usedPrefix + command} <رابط Play Store> — تحميل من الرابط\n\n` +
            'ومن بعد اختار الرقم باش يتحمل التطبيق.\n\n' +
            LIMIT_WARNING)
    }

    // استخراج الـ package من رابط Play أو من الإدخال المباشر
    let pkg = ''
    const linkMatch = q.match(/[?&]id=([\w.]+)/)
    if (linkMatch) pkg = linkMatch[1]
    else if (/^[a-zA-Z][\w]*(\.[\w]+)+$/.test(q)) pkg = q

    await m.react?.('🔍').catch(() => {})
    try {
        const results = await aptoideSearch(pkg || q, 8)
        if (!results.length) return m.reply(`🔍 ما لقيت حتى تطبيق بـ "${q}". تأكد من الاسم أو جرب الـ package id.`)
        if (pkg) {
            const exact = results.find((r) => r.pkg === pkg) || results[0]
            return await sendApk(m, conn, exact, isOwner)
        }
        sessions.set(m.sender, { results, at: Date.now() })
        const list = results.map((r, i) => `${i + 1}. *${r.name}* — ${mb(r.size)}${r.version ? ` (v${r.version})` : ''}`).join('\n')
        const quota = isOwner ? '' : `\n\n📊 باقي ليك ${remaining(m.sender)}/${DAILY_LIMIT} تحميلات اليوم.\n${LIMIT_WARNING}`
        return m.reply(`📱 *نتائج البحث على "${q}":*\n\n${list}\n\n✍️ رد بـ ${usedPrefix + command} <رقم> باش تحمل التطبيق.${quota}`)
    } catch (e) {
        return m.reply('❌ وقع مشكل فالبحث (غالبا المصدر محجوب على الاستضافة). عاود من بعد.' + (isOwner ? `\n\n🔧 تفاصيل للمالك: ${String(e?.message || e).slice(0, 150)}` : ''))
    }
}

handler.help = handler.command = ['apk']
handler.tags = ['downloader']
handler.limit = true

export default handler
      
