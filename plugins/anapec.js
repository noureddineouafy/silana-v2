// plugins/anapec.js — ANAPEC job offers (.anapec)
//   .anapec              → latest published ANAPEC offers
//   .anapec <keyword>    → search (job or city), e.g. .anapec سائق
//   .anapec <number>     → offer details (ANAPEC reference when published)
//
// Why not anapec.org directly: the official portal is unreachable
// from every network tested (assistant VM, platform fetcher AND the
// user's own panel — probe report 2026-11-05: all four candidate
// URLs fail in ~100-400ms). So the offers come from alwadifa-club,
// which republishes ANAPEC offers in full (titles carry the job,
// headcount, city and often the salary). Every card links to the
// full announcement; applications still go through ANAPEC itself
// (agency or the official site when it is back). Cache: 30 min.
// Tags: morocco.

const SITE = 'https://alwadifa-club.com'
const UA = 'Mozilla/5.0 (Linux; Android 13) SilanaBot'
const CACHE_MS = 30 * 60 * 1000
const cache = new Map()
const lastList = new Map()

const dec = s => (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#0?39;/g, "'")
    .replace(/\s+/g, ' ').trim()

function parseOffers(html, requireAnapec) {
    const out = []
    const seenUrls = new Set(), seenTitles = new Set()
    const re = /href="(https:\/\/alwadifa-club\.com\/(?:offre-prive|offre-a-etranger)\/[^"]*?\/\d+\/)"[^>]*>([\s\S]{0,220}?)<\/a>/g
    for (const mm of html.matchAll(re)) {
        const url = mm[1]
        if (seenUrls.has(url)) continue
        const title = dec(mm[2])
        if (title.length < 20 || seenTitles.has(title)) continue
        if (requireAnapec && !/أنابيك|anapec/i.test(title)) continue
        seenUrls.add(url); seenTitles.add(title)
        out.push({ title, url })
        if (out.length >= 10) break
    }
    return out
}

async function fetchOffers(keyword) {
    const key = keyword || '__latest__'
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.items
    const q = keyword ? `anapec ${keyword}` : 'anapec'
    const res = await fetch(`${SITE}/?s=${encodeURIComponent(q)}`, {
        headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000), redirect: 'follow'
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const items = parseOffers(await res.text(), !keyword)
    if (!items.length) throw new Error('no offers')
    cache.set(key, { at: Date.now(), items })
    return items
}

async function sendOffers(conn, m, usedPrefix, keyword) {
    let items
    try { items = await fetchOffers(keyword) }
    catch (e) {
        return conn.reply(m.chat, keyword
            ? `❌ ما لقيت حتى عرض أنابيك بـ «${keyword}» — جرب كلمة أخرى (مهنة ولا مدينة).`
            : '❌ ما قدرتش نجيب عروض الأنابيك دابا — عاود بعد شوية.', m)
    }
    lastList.set(`${m.chat}|${m.sender}`, { at: Date.now(), items })
    const text =
        `🧑‍💼 *عروض شغل الأنابيك${keyword ? ` — «${keyword}»` : ' — الأحدث'}*\n\n` +
        items.map((o, i) => `*${i + 1}.* ${o.title}`).join('\n') +
        `\n\n📌 التفاصيل والمرجع: ${usedPrefix}anapec <رقم>\n📊 المصدر: alwadifa-club (كيعاود نشر عروض الأنابيك كاملة)\nℹ️ الموقع الرسمي anapec.org متعذر الوصول حالياً — الترشيح عبر أقرب وكالة أنابيك ولا الموقع ملي يرجع.`
    return conn.reply(m.chat, text, m)
}

async function sendDetail(conn, m, item) {
    let ref = '', salary = ''
    try {
        const res = await fetch(item.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000), redirect: 'follow' })
        const body = dec(await res.text())
        ref = (body.match(/\b[A-Z]{2}\d{10,13}\b/) || [])[0] || ''
        const sal = body.match(/(?:Salaire mensuel|الراتب الشهري|Salaire|الراتب)\s*:?\s*([0-9][0-9\s.]{2,10})\s*(?:DH|درهم)/i)
        if (sal) salary = sal[1].replace(/\s+/g, ' ').trim() + ' درهم'
    } catch { /* best effort */ }
    const text =
        `🧑‍💼 *${item.title}*\n` +
        (ref ? `\n🔖 مرجع العرض في الأنابيك: *${ref}*` : '') +
        (salary ? `\n💰 الراتب الشهري: *${salary}*` : '') +
        `\n\n📄 الإعلان الكامل (الشروط + طريقة الترشيح):\n${item.url}\n\nℹ️ الترشيح كيدار عبر وكالة الأنابيك ولا موقعها الرسمي — احتفظ بالمرجع إلا كان متوفر.`
    return conn.reply(m.chat, text, m)
}

let handler = async (m, { conn, text, usedPrefix }) => {
    const raw = (text || '').trim()
    if (/^\d+$/.test(raw)) {
        const st = lastList.get(`${m.chat}|${m.sender}`)
        const item = st && Date.now() - st.at < 15 * 60 * 1000 ? st.items[parseInt(raw, 10) - 1] : null
        if (item) return sendDetail(conn, m, item)
        return conn.reply(m.chat, `❗ ما كاينة حتى قائمة حديثة — دير ${usedPrefix}anapec هي اللولة.`, m)
    }
    return sendOffers(conn, m, usedPrefix, raw || null)
}
handler.help = ['anapec']
handler.tags = ['morocco']
handler.command = ['anapec', 'أنابيك']
export default handler
