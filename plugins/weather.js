// weather.js — طقس الغد: تنبيه تلقائي + بطاقة AIRich احترافية (.weather) — v1
// ─────────────────────────────────────────────────────────────────────────────
// المصدر: Open-Meteo (مجاني، بلا مفتاح) — مدن المغرب كاملة عبر
// جدول مدمج للمدن الكبرى + بحث جغرافي بالعربية لباقي المدن.
//   .weather <مدينة>        → بطاقة طقس الغد (AIRich) دابا
//   .weather auto <مدينة>   → اشتراك: كل ليلة 20:00 توصلك نشرة الغد
//   .weather auto <مدينة> <jid قروب>  → (للمالك) اشتراك لأي قروب عن بعد
//   .weather off [jid]      → إلغاء الاشتراك (للمالك عن بعد بـ jid)
//   .weather subs           → (للمالك) قائمة الاشتراكات
//   .weather                → نشرة مدينتك المشتركة
//   .weather test           → (للمالك) إرسال فوري لكل المشتركين
// البطاقة: ملخص + جدول ساعات الغد + شروق/غروب + نصيحة ذكية،
// مع رجوع لنص عادي إلا فشل إرسال AIRich.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID, randomBytes } from 'crypto'

const TZ = 'Africa/Casablanca'
const SEND_HOUR = 20
const UA = { 'User-Agent': 'Mozilla/5.0 (SilanaBot)' }

const CITIES = {
    'الدار البيضاء': [33.5731, -7.5898, 'الدار البيضاء'], 'كازا': [33.5731, -7.5898, 'الدار البيضاء'], 'casablanca': [33.5731, -7.5898, 'الدار البيضاء'],
    'الرباط': [34.0209, -6.8416, 'الرباط'], 'rabat': [34.0209, -6.8416, 'الرباط'],
    'مراكش': [31.6295, -7.9811, 'مراكش'], 'marrakech': [31.6295, -7.9811, 'مراكش'],
    'اكادير': [30.4278, -9.5981, 'أكادير'], 'أكادير': [30.4278, -9.5981, 'أكادير'], 'agadir': [30.4278, -9.5981, 'أكادير'],
    'طنجة': [35.7595, -5.8340, 'طنجة'], 'tanger': [35.7595, -5.8340, 'طنجة'],
    'فاس': [34.0181, -5.0078, 'فاس'], 'fes': [34.0181, -5.0078, 'فاس'],
    'مكناس': [33.8731, -5.5407, 'مكناس'], 'وجدة': [34.6814, -1.9086, 'وجدة'],
    'القنيطرة': [34.2610, -6.5802, 'القنيطرة'], 'تطوان': [35.5889, -5.3626, 'تطوان'],
    'سلا': [34.0531, -6.7985, 'سلا'], 'المحمدية': [33.6866, -7.3830, 'المحمدية'],
    'الجديدة': [33.2316, -8.5007, 'الجديدة'], 'بني ملال': [32.3373, -6.3498, 'بني ملال'],
    'الناظور': [35.1681, -2.9335, 'الناظور'], 'اسفي': [32.2994, -9.2372, 'آسفي'], 'آسفي': [32.2994, -9.2372, 'آسفي'],
    'العيون': [27.1253, -13.1625, 'العيون'], 'الداخلة': [23.6848, -15.9280, 'الداخلة'],
    'الصويرة': [31.5085, -9.7595, 'الصويرة'], 'افران': [33.5228, -5.1110, 'إفران'], 'إفران': [33.5228, -5.1110, 'إفران'],
    'شفشاون': [35.1688, -5.2636, 'شفشاون'], 'الرشيدية': [31.9314, -4.4271, 'الرشيدية'],
    'ورزازات': [30.9335, -6.9208, 'ورزازات'], 'الحسيمة': [35.2517, -3.9372, 'الحسيمة'],
    'خريبكة': [32.8811, -6.9063, 'خريبكة'], 'العرائش': [35.1932, -6.1563, 'العرائش'],
    'تزنيت': [29.6934, -9.7322, 'تزنيت'], 'كلميم': [28.9884, -10.0527, 'كلميم'],
}

const WMO = {
    0: ['☀️', 'صافي'], 1: ['🌤️', 'مشمس غالبا'], 2: ['⛅', 'غائم جزئيا'], 3: ['☁️', 'غائم'],
    45: ['🌫️', 'ضباب'], 48: ['🌫️', 'ضباب كثيف'],
    51: ['🌦️', 'رذاذ خفيف'], 53: ['🌦️', 'رذاذ'], 55: ['🌦️', 'رذاذ كثيف'],
    56: ['🌧️', 'رذاذ متجمد'], 57: ['🌧️', 'رذاذ متجمد'],
    61: ['🌧️', 'مطر خفيف'], 63: ['🌧️', 'مطر'], 65: ['🌧️', 'مطر غزير'],
    66: ['🌧️', 'مطر متجمد'], 67: ['🌧️', 'مطر متجمد'],
    71: ['❄️', 'ثلج خفيف'], 73: ['❄️', 'ثلج'], 75: ['❄️', 'ثلج كثيف'], 77: ['❄️', 'حبيبات ثلج'],
    80: ['🌦️', 'زخات خفيفة'], 81: ['🌦️', 'زخات مطر'], 82: ['🌧️', 'زخات غزيرة'],
    85: ['❄️', 'زخات ثلج'], 86: ['❄️', 'زخات ثلج'],
    95: ['⛈️', 'عاصفة رعدية'], 96: ['⛈️', 'عاصفة مع بَرَد'], 99: ['⛈️', 'عاصفة مع بَرَد'],
}
const wmo = c => WMO[c] || ['🌡️', '—']

function store() {
    const db = global.db
    if (!db.data.weather || typeof db.data.weather !== 'object') db.data.weather = {}
    const s = db.data.weather
    if (!s.subs || typeof s.subs !== 'object') s.subs = {}
    return s
}

function norm(s) {
    return String(s || '').toLowerCase().replace(/[ً-ٟ]/g, '').replace(/إ|أ|آ/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim()
}

async function resolveCity(raw) {
    const q = String(raw || '').trim()
    if (!q) return null
    const hit = CITIES[q] || CITIES[norm(q)]
    if (hit) return { lat: hit[0], lon: hit[1], name: hit[2] }
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=ar`
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`geo HTTP ${res.status}`)
    const j = await res.json()
    const list = (j.results || []).filter(r => r.country_code === 'MA')
    const best = (list.length ? list : (j.results || [])).sort((a, b) => (b.population || 0) - (a.population || 0))[0]
    if (!best) return null
    return { lat: best.latitude, lon: best.longitude, name: best.name }
}

async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset` +
        `&hourly=temperature_2m,weather_code&timezone=${encodeURIComponent(TZ)}&forecast_days=2`
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) })
    if (!res.ok) throw new Error(`weather HTTP ${res.status}`)
    const j = await res.json()
    const d = j.daily, h = j.hourly
    const hours = [6, 9, 12, 15, 18, 21].map(hr => {
        const i = 24 + hr
        return { hr, temp: Math.round(h.temperature_2m[i]), code: h.weather_code[i] }
    })
    return {
        dateISO: d.time[1],
        code: d.weather_code[1],
        tmax: Math.round(d.temperature_2m_max[1]),
        tmin: Math.round(d.temperature_2m_min[1]),
        rain: d.precipitation_probability_max ? d.precipitation_probability_max[1] : null,
        wind: Math.round(d.wind_speed_10m_max[1]),
        sunrise: String(d.sunrise[1]).slice(11, 16),
        sunset: String(d.sunset[1]).slice(11, 16),
        hours,
        todayCode: d.weather_code[0],
        todayMax: Math.round(d.temperature_2m_max[0]),
        todayMin: Math.round(d.temperature_2m_min[0]),
    }
}

function fmtDay(iso) {
    const [y, mo, da] = iso.split('-').map(Number)
    return new Intl.DateTimeFormat('ar-MA', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, mo - 1, da, 12)))
}

function advice(w) {
    const tips = []
    if (w.rain !== null && w.rain >= 50) tips.push('☂️ احتمال الأمطار عالٍ — خود المظلة معاك.')
    else if (w.rain !== null && w.rain >= 30) tips.push('🌂 يقدر يكون شوية المطر — احتياطك مزيان.')
    if (w.tmin <= 8) tips.push('🧥 صباح بارد — لبس دافئ.')
    if (w.tmax >= 35) tips.push('🥵 نهار سخون — شرب الماء وتجنب شمس الظهيرة.')
    if (w.wind >= 50) tips.push('💨 رياح قوية متوقعة — رد بالك في الطريق.')
    if (w.code === 95 || w.code === 96 || w.code === 99) tips.push('⛈️ عواصف رعدية — تجنب الأماكن المكشوفة.')
    if (!tips.length) tips.push('😎 نهار مناسب للخروج والأنشطة الخارجية.')
    return tips
}

function textCard(city, w) {
    const [em, label] = wmo(w.code)
    return (
        `🌦️ *طقس الغد — ${city}*\n📅 ${fmtDay(w.dateISO)}\n\n` +
        `${em} *${label}* — من ${w.tmin}° إلى ${w.tmax}°\n` +
        (w.rain !== null ? `🌧️ احتمال المطر: ${w.rain}%\n` : '') +
        `💨 الرياح حتى: ${w.wind} كم/س\n` +
        `🌅 الشروق ${w.sunrise} • 🌇 الغروب ${w.sunset}\n\n` +
        `🕐 *خلال النهار:*\n` +
        w.hours.map(x => `${String(x.hr).padStart(2, '0')}:00 — ${x.temp}° ${wmo(x.code)[0]} ${wmo(x.code)[1]}`).join('\n') +
        `\n\n${advice(w).join('\n')}\n\n⚡ SILANA AI • Open-Meteo`
    )
}

// ─── AIRich ───
function _cert(len) { const b = randomBytes(len); b[0] = 48; b[1] = 130; return b }
function _layout(name, data, extra) {
    return { ...(extra || {}), view_model: { [Array.isArray(data) ? 'primitives' : 'primitive']: data, __typename: `GenAI${name}LayoutViewModel` } }
}

async function sendRichWeather(conn, jid, city, w) {
    if (typeof conn.relayMessage !== 'function') throw new Error('rich: relayMessage غير متوفر')
    const [em, label] = wmo(w.code)
    const intro = `**طقس الغد في ${city}** 🌦️\n📅 ${fmtDay(w.dateISO)}\n\n${em} **${label}** — الحرارة من **${w.tmin}°** إلى **${w.tmax}°**` +
        (w.rain !== null ? `\n🌧️ احتمال المطر: **${w.rain}%**` : '') +
        `\n💨 الرياح حتى ${w.wind} كم/س • 🌅 ${w.sunrise} • 🌇 ${w.sunset}`
    const rows = [
        { is_header: true, cells: ['الساعة', 'الحرارة', 'الحالة'] },
        ...w.hours.map(x => ({ is_header: false, cells: [`${String(x.hr).padStart(2, '0')}:00`, `${x.temp}°`, `${wmo(x.code)[0]} ${wmo(x.code)[1]}`] })),
    ]
    const tips = advice(w).join('\n')
    const sections = [
        _layout('Single', { text: intro, __typename: 'GenAIMarkdownTextUXPrimitive' }),
        _layout('Single', { rows, __typename: 'GenAITableUXPrimitive' }),
        _layout('Single', { text: tips, __typename: 'GenAIMarkdownTextUXPrimitive' }),
        _layout('Single', {
            sources: [{ source_type: 'THIRD_PARTY', source_display_name: 'Open-Meteo', source_subtitle: 'open-meteo.com', source_url: 'https://open-meteo.com', favicon: { url: 'https://open-meteo.com/favicon.ico', mime_type: 'image/jpeg', width: 16, height: 16 } }],
            __typename: 'GenAISearchResultPrimitive',
        }),
        _layout('Single', { text: 'للاشتراك في نشرة كل ليلة: .weather auto مدينتك', __typename: 'GenAIMetadataTextPrimitive' }),
    ]
    const responseId = randomUUID()
    const msg = {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: 'SILANA AI • طقس الغد',
                richResponseSourcesMetadata: { sources: [] },
                botResponseId: responseId,
                verificationMetadata: { proofs: [{ certificateChain: [_cert(685), _cert(892)], version: 1, useCase: 1, signature: randomBytes(64) }] },
            },
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{ messageType: 2, messageText: textCard(city, w) }],
                    unifiedResponse: { data: Buffer.from(JSON.stringify({ response_id: responseId, sections })).toString('base64') },
                    contextInfo: { isForwarded: true, forwardingScore: 1, forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' }, forwardOrigin: 4 },
                },
            },
        },
    }
    await conn.relayMessage(jid, msg, { messageId: randomBytes(16).toString('hex').toUpperCase() })
    return true
}

async function deliver(conn, jid, city, w) {
    try { await sendRichWeather(conn, jid, city, w); return }
    catch { await conn.sendMessage(jid, { text: textCard(city, w) }) }
}

// ─── الإرسال التلقائي ───
let lastConn = null
function maNow() {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date())
    const o = Object.fromEntries(p.map(x => [x.type, x.value]))
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24 }
}
function tomorrowKey() {
    const { y, mo, d } = maNow()
    const t = new Date(Date.UTC(y, mo - 1, d + 1))
    return t.toISOString().slice(0, 10)
}

async function tick(force = false) {
    const conn = lastConn
    if (!conn) return
    const { h } = maNow()
    if (!force && h < SEND_HOUR) return
    const s = store()
    const key = tomorrowKey()
    for (const [jid, sub] of Object.entries(s.subs)) {
        if (!sub || typeof sub !== 'object') { delete s.subs[jid]; continue }
        if (!force && sub.lastFor === key) continue
        try {
            const w = await fetchWeather(sub.lat, sub.lon)
            await deliver(conn, jid, sub.city, w)
            sub.lastFor = key
            sub.fails = 0
        } catch {
            sub.fails = (sub.fails || 0) + 1
            if (sub.fails >= 5) delete s.subs[jid]
        }
    }
}

if (!global.__silanaWeatherTimer) {
    global.__silanaWeatherTimer = setInterval(() => { tick().catch(() => {}) }, 60000)
}

let handler = async (m, { conn, text, args, usedPrefix, command, isOwner }) => {
    lastConn = conn
    const raw = (text || '').trim()
    const s = store()
    try {
        if (/^(auto|اشتراك|اشترك)$/i.test(args[0] || '')) {
            let cityArg = raw.replace(/^(auto|اشتراك|اشترك)\s*/i, '').trim()
            let target = m.chat
            const jidMatch = cityArg.match(/(\d{6,}@g\.us)\s*$/)
            if (jidMatch) {
                if (!isOwner) return conn.reply(m.chat, '🔒 الاشتراك عن بعد للمالك فقط.', m)
                target = jidMatch[1]
                cityArg = cityArg.replace(jidMatch[1], '').trim()
            }
            if (!cityArg) return conn.reply(m.chat, `🌦️ اكتب المدينة: ${usedPrefix + command} auto الدار البيضاء`, m)
            const c = await resolveCity(cityArg)
            if (!c) return conn.reply(m.chat, `😕 ما لقيتش مدينة «${cityArg}» — جرب الاسم بالعربية أو الفرنسية.`, m)
            s.subs[target] = { city: c.name, lat: c.lat, lon: c.lon, lastFor: '', fails: 0 }
            const w = await fetchWeather(c.lat, c.lon)
            await deliver(conn, target, c.name, w)
            const remote = target !== m.chat
            return conn.reply(m.chat, `✅ *تم الاشتراك!* نشرة طقس *${c.name}* غادي توصل ${remote ? 'للقروب المحدد' : 'هنا'} كل ليلة على 20:00.${remote ? '\nوبعت ليه نشرة الغد دابا كمثال 👆' : '\nهادي نشرة الغد كبداية 👆'} وللإلغاء: ${usedPrefix + command} off${remote ? ' ' + target : ''}`, m)
        }
        if (/^(subs|اشتراكات)$/i.test(args[0] || '')) {
            if (!isOwner) return conn.reply(m.chat, '🔒 للمالك فقط.', m)
            const list = Object.entries(s.subs)
            if (!list.length) return conn.reply(m.chat, 'ℹ️ ما كاين حتى اشتراك دابا.', m)
            return conn.reply(m.chat, `📋 *اشتراكات الطقس (${list.length}):*\n` + list.map(([jid, sub]) => `• ${sub.city} → ${jid}`).join('\n'), m)
        }
        if (/^(off|الغاء|إلغاء|stop)$/i.test(args[0] || '')) {
            const jidArg = (args[1] || '').trim()
            const target = /@g\.us$/.test(jidArg) ? jidArg : m.chat
            if (target !== m.chat && !isOwner) return conn.reply(m.chat, '🔒 الإلغاء عن بعد للمالك فقط.', m)
            if (s.subs[target]) { delete s.subs[target]; return conn.reply(m.chat, '🛑 تم إلغاء اشتراك الطقس.', m) }
            return conn.reply(m.chat, 'ℹ️ ما كاين حتى اشتراك هنا.', m)
        }
        if (/^test$/i.test(args[0] || '')) {
            if (!isOwner) return conn.reply(m.chat, '🔒 للمالك فقط.', m)
            const n = Object.keys(s.subs).length
            await tick(true)
            return conn.reply(m.chat, `📤 بعت النشرة لـ ${n} مشترك.`, m)
        }
        // نشرة فورية
        let c = null
        if (raw) c = await resolveCity(raw)
        else if (s.subs[m.chat]) { const sub = s.subs[m.chat]; c = { lat: sub.lat, lon: sub.lon, name: sub.city } }
        if (!c) {
            return conn.reply(m.chat,
                `🌦️ *طقس الغد (v1)*\n\n` +
                `> ${usedPrefix + command} الدار البيضاء — نشرة فورية\n` +
                `> ${usedPrefix + command} auto أكادير — اشتراك كل ليلة 20:00\n` +
                `> ${usedPrefix + command} off — إلغاء الاشتراك\n\n` +
                `كندعم جميع المدن المغربية 🇲🇦`, m)
        }
        const w = await fetchWeather(c.lat, c.lon)
        await deliver(conn, m.chat, c.name, w)
    } catch (e) {
        return conn.reply(m.chat, '❌ وقع مشكل في جلب الطقس.\n🔧 تفاصيل للمالك: ' + String(e.message || e).slice(0, 160), m)
    }
}

handler.before = async (m, { conn }) => { lastConn = conn; return false }

handler.help = ['weather']
handler.tags = ['tools']
handler.command = /^(weather|طقس|wather)$/i
handler.limit = false

export default handler
