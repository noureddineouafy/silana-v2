// plugins/mahroukat.js — Moroccan fuel prices (.mahroukat)
//   .mahroukat                    → today's indicative prices (gasoil + essence)
//   .mahroukat حساب <km> <L/100>  → trip cost, e.g. .mahroukat حساب 300 6.5
//
// Prices in Morocco are liberalised (free since 2015): every station
// sets its own price, so no official per-station feed exists. This
// plugin shows the national indicative average published by
// OilPricez (updated continuously), clearly labelled as an average —
// coastal cities tend to be cheaper, the south more expensive.
// Cache: 6 hours. Tags: morocco.

const UA = 'Mozilla/5.0 (Linux; Android 13) SilanaBot'
const PAGES = {
    gasoil: 'https://oilpricez.com/ma/morocco-diesel-price',
    essence: 'https://oilpricez.com/ma/morocco-gasoline-price'
}
const CACHE_MS = 6 * 60 * 60 * 1000
let cache = null

async function fetchPrice(url) {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const text = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const mm = text.match(/1 Liter Price =\s*([\d.]+)\s*MAD/)
    if (!mm) throw new Error('price not found')
    return parseFloat(mm[1])
}

async function getPrices() {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache
    const [gasoil, essence] = await Promise.all([fetchPrice(PAGES.gasoil), fetchPrice(PAGES.essence)])
    cache = { at: Date.now(), gasoil, essence }
    return cache
}

const fmt = n => (Math.round(n * 100) / 100).toFixed(2)

let handler = async (m, { conn, text, usedPrefix }) => {
    const raw = (text || '').trim()
    let prices
    try { prices = await getPrices() }
    catch (e) { return conn.reply(m.chat, '❌ ما قدرتش نجيب أثمنة المحروقات دابا — عاود بعد شوية.', m) }

    const trip = raw.match(/(?:حساب|trip|calcul)\s+([\d.]+)\s+([\d.]+)/i)
    if (trip) {
        const km = parseFloat(trip[1]), conso = parseFloat(trip[2])
        if (!(km > 0) || !(conso > 0)) return conn.reply(m.chat, `❗ الصيغة: ${usedPrefix}mahroukat حساب <كم> <الاستهلاك ل/100كم>\nمثال: ${usedPrefix}mahroukat حساب 300 6.5`, m)
        const litres = km * conso / 100
        return conn.reply(m.chat,
            `🧮 *حساب رحلة ${km} كم* (استهلاك ${conso} ل/100كم)\n\n` +
            `⛽ الوقود اللازم: *${fmt(litres)} لتر*\n` +
            `🛢️ بالغازوال (${fmt(prices.gasoil)} درهم/ل): *${fmt(litres * prices.gasoil)} درهم*\n` +
            `🔥 بالبنزين (${fmt(prices.essence)} درهم/ل): *${fmt(litres * prices.essence)} درهم*\n\n` +
            `ℹ️ حساب بالمتوسط الوطني التقريبي — الثمن الحقيقي كيختلف حسب المحطة.`, m)
    }

    if (raw) return conn.reply(m.chat, `❗ الخيارات: ${usedPrefix}mahroukat (الأثمنة) ولا ${usedPrefix}mahroukat حساب 300 6.5 (تكلفة رحلة)`, m)

    return conn.reply(m.chat,
        `⛽ *أثمنة المحروقات في المغرب — اليوم*\n\n` +
        `🛢️ *الغازوال (Diesel):* ${fmt(prices.gasoil)} درهم/لتر\n` +
        `🔥 *البنزين (Essence):* ${fmt(prices.essence)} درهم/لتر\n\n` +
        `🚗 ملء خزان 50 لتر:\n` +
        `• غازوال: *${fmt(50 * prices.gasoil)} درهم*\n` +
        `• بنزين: *${fmt(50 * prices.essence)} درهم*\n\n` +
        `🧮 تكلفة رحلة: ${usedPrefix}mahroukat حساب <كم> <الاستهلاك>\n` +
        `ℹ️ متوسط وطني تقريبي (OilPricez) — الأثمنة حرة وكتختلف حسب المحطة والمدينة: الساحل أرخص، والجنوب أغلى.`, m)
}
handler.help = ['mahroukat']
handler.tags = ['morocco']
handler.command = ['mahroukat', 'محروقات']
export default handler
