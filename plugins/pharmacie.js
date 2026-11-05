// plugins/pharmacie.js — Pharmacies de garde in Morocco (.pharmacie)
//   .pharmacie                     → pick a city (list)
//   .pharmacie <city>              → today's on-duty pharmacies (24h + night first)
//   .pharmacie <city> نهار|ليل|24   → filter: day / night / 24h
//   .pharmacie <number>            → details of a result (phone + directions)
//
// Data: annuaire-gratuit.ma daily on-duty lists (the same publisher
// behind the SOS Pharmacie app) — one page per city for the day list
// and one for the night list, updated daily. Listing pages mask the
// phone numbers, so the detail view fetches the pharmacy's own page.
// Results are cached 1 hour per city. Tags: morocco.

const BASE = 'https://www.annuaire-gratuit.ma'
const UA = 'Mozilla/5.0 (Linux; Android 13) SilanaBot'
const CITIES = [
    ['الدار البيضاء', 'casablanca'], ['الرباط', 'rabat'], ['مراكش', 'marrakech'],
    ['أكادير', 'agadir'], ['طنجة', 'tanger'], ['فاس', 'fes'], ['مكناس', 'meknes'],
    ['وجدة', 'oujda'], ['القنيطرة', 'kenitra'], ['تطوان', 'tetouan'], ['سلا', 'sale'],
    ['تمارة', 'temara'], ['المحمدية', 'mohammedia'], ['الجديدة', 'el-jadida'],
    ['آسفي', 'safi'], ['الناظور', 'nador'], ['صفرو', 'sefrou'], ['سلوان', 'selouane'],
    ['خريبكة', 'khouribga'], ['برشيد', 'berrechid'], ['بن جرير', 'ben-guerir']
]
const CACHE_MS = 60 * 60 * 1000
const cache = new Map()   // slug -> { at, items }
const lastList = new Map() // chat|sender -> { at, items }

const dec = s => (s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/&acirc;/g, 'â').replace(/&ecirc;/g, 'ê').replace(/&icirc;/g, 'î')
    .replace(/&ocirc;/g, 'ô').replace(/&ccedil;/g, 'ç').replace(/&iuml;/g, 'ï')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#0?39;/g, "'").replace(/&middot;/g, '·')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

function parseCards(html, kind) {
    const out = []
    const parts = html.split('data-pharmacy-id=').slice(1)
    for (const part of parts) {
        const head = part.slice(0, 400)
        const name = dec((head.match(/data-name="([^"]*)"/) || [])[1])
        const url = (head.match(/data-url="([^"]*)"/) || [])[1] || ''
        const lat = (head.match(/data-lat="([\d.-]+)"/) || [])[1]
        const lng = (head.match(/data-lng="([\d.-]+)"/) || [])[1]
        if (!name || !url) continue
        const body = part.slice(0, 1600)
        const status = dec((body.match(/ag_ph_status[^>]*>([^<]+)</) || [])[1])
        const street = dec((body.match(/itemprop="streetAddress">([^<]+)</) || [])[1])
        const quartier = dec((body.match(/quartier-[a-z0-9-]+\.html"[^>]*>([^<]+)</) || [])[1])
        let type = kind
        if (/24h/i.test(status)) type = '24h'
        else if (/nuit/i.test(status)) type = 'night'
        else if (/jour/i.test(status)) type = 'day'
        out.push({ name, url, lat, lng, status, street, quartier, type })
    }
    return out
}

async function fetchCity(slug) {
    const hit = cache.get(slug)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.items
    const get = async path => {
        const res = await fetch(BASE + path, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.text()
    }
    const [dayHtml, nightHtml] = await Promise.all([
        get(`/pharmacie-garde-${slug}.html`),
        get(`/pharmacie-garde-${slug}/garde-nuit.html`).catch(() => '')
    ])
    const merged = new Map()
    for (const it of parseCards(dayHtml, 'day')) merged.set(it.url, it)
    for (const it of parseCards(nightHtml, 'night')) if (!merged.has(it.url)) merged.set(it.url, it)
    const items = [...merged.values()]
    if (!items.length) throw new Error('no pharmacies found')
    cache.set(slug, { at: Date.now(), items })
    return items
}

const TYPE_META = { '24h': ['🌟', '24h/24'], night: ['🌙', 'حراسة الليل'], day: ['☀️', 'حراسة النهار'] }
const rank = t => t === '24h' ? 0 : t === 'night' ? 1 : 2

async function sendList(conn, m, usedPrefix, cityName, slug, filter) {
    let items
    try { items = await fetchCity(slug) }
    catch (e) { return conn.reply(m.chat, `❌ ما قدرتش نجيب صيدليات الحراسة ديال ${cityName} دابا — عاود بعد شوية.`, m) }
    let shown = items.slice().sort((a, b) => rank(a.type) - rank(b.type))
    if (filter) shown = shown.filter(i => i.type === filter)
    const total = shown.length
    shown = shown.slice(0, 12)
    lastList.set(`${m.chat}|${m.sender}`, { at: Date.now(), items: shown })
    const today = new Intl.DateTimeFormat('ar-MA', { timeZone: 'Africa/Casablanca', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
    const lines = shown.map((p, i) => {
        const [icon, label] = TYPE_META[p.type] || TYPE_META.day
        return `*${i + 1}.* ${icon} *${p.name}* — ${label}${p.status && !p.status.includes(label) ? ` (${p.status})` : ''}\n   📍 ${p.street || '—'}${p.quartier ? ` · ${p.quartier}` : ''}`
    })
    const text =
        `💊 *صيدليات الحراسة — ${cityName}*\n📅 ${today}\n\n` +
        lines.join('\n') +
        (total > shown.length ? `\n\n… وباقي ${total - shown.length} أخرى. صفّي بـ: ${usedPrefix}pharmacie ${cityName} ليل` : '') +
        `\n\n📞 للتفاصيل والهاتف: ${usedPrefix}pharmacie <رقم>\n⚠️ اتصل بالصيدلية للتأكد قبل ما تمشي.\n📊 المصدر: annuaire-gratuit.ma (قوائم يومية)`
    return conn.reply(m.chat, text, m)
}

async function sendDetail(conn, m, item) {
    let phone = ''
    try {
        const res = await fetch(BASE + item.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000), redirect: 'follow' })
        const html = await res.text()
        phone = (html.match(/href="tel:(\+?[0-9 ]+)"/) || [])[1] || (html.match(/0[5-7](?:[ .-]?[0-9]{2}){4}/) || [])[0] || ''
    } catch { /* phone stays empty */ }
    const maps = item.lat && item.lng ? `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}` : ''
    const [icon, label] = TYPE_META[item.type] || TYPE_META.day
    const text =
        `💊 *${item.name}*\n${icon} ${label}${item.status ? ` — ${item.status}` : ''}\n📍 ${item.street || '—'}${item.quartier ? ` · ${item.quartier}` : ''}` +
        (phone ? `\n📞 ${phone.trim()}` : '\n📞 الرقم غير متوفر في المصدر') +
        (maps ? `\n🧭 الاتجاهات: ${maps}` : '') +
        `\n⚠️ اتصل للتأكد من الحراسة وتوفر الدواء.`
    return conn.reply(m.chat, text, m)
}

function findCity(q) {
    q = (q || '').trim().toLowerCase()
    if (!q) return null
    return CITIES.find(([ar, slug]) => ar === q || slug === q || ar.replace(/^(ال)/, '') === q.replace(/^(ال)/, '')) ||
        CITIES.find(([ar, slug]) => ar.includes(q) || slug.includes(q)) || null
}

let handler = async (m, { conn, text, args, usedPrefix }) => {
    const raw = (text || '').trim()
    // detail by number from the last shown list
    if (/^\d+$/.test(raw)) {
        const st = lastList.get(`${m.chat}|${m.sender}`)
        const item = st && Date.now() - st.at < 15 * 60 * 1000 ? st.items[parseInt(raw, 10) - 1] : null
        if (item) return sendDetail(conn, m, item)
        return conn.reply(m.chat, `❗ ما كاينة حتى قائمة حديثة — دير ${usedPrefix}pharmacie <مدينة> هي اللولة.`, m)
    }
    const parts = raw.split(/\s+/)
    let filter = null
    const lastWord = (parts[parts.length - 1] || '').toLowerCase()
    if (['ليل', 'nuit', 'night'].includes(lastWord)) { filter = 'night'; parts.pop() }
    else if (['نهار', 'jour', 'day'].includes(lastWord)) { filter = 'day'; parts.pop() }
    else if (lastWord === '24' || lastWord === '24h') { filter = '24h'; parts.pop() }
    const city = findCity(parts.join(' '))
    if (!city) {
        if (conn.sendButton) {
            try {
                const rows = CITIES.map(([ar], i) => ({ title: ar, description: 'صيدليات الحراسة اليوم', id: `${usedPrefix}pharmacie city ${i}` }))
                const sections = [{ title: 'المدن المتوفرة', rows }]
                const listBtn = { name: 'single_select', buttonParamsJson: JSON.stringify({ title: 'اختار المدينة', sections }) }
                return await conn.sendButton(m.chat, {
                    text: '💊 *صيدلية الحراسة* — اختار المدينة 👇',
                    footer: 'Silana • pharmacies de garde',
                    buttons: [listBtn], interactiveButtons: [listBtn], headerType: 1
                }, { quoted: m })
            } catch { /* fall through to text */ }
        }
        return conn.reply(m.chat, `💊 *صيدلية الحراسة* — اختار مدينة:\n\n${CITIES.map(([ar]) => '• ' + ar).join('\n')}\n\nمثال: ${usedPrefix}pharmacie مراكش`, m)
    }
    return sendList(conn, m, usedPrefix, city[0], city[1], filter)
}

// List taps come back as ".pharmacie city <i>" — translate before the main parse.
const origHandler = handler
handler = async (m, ctx) => {
    const t = (ctx.text || '').trim()
    const tap = t.match(/^city\s+(\d+)$/)
    if (tap) {
        const city = CITIES[parseInt(tap[1], 10)]
        if (city) { ctx.text = city[0]; return origHandler(m, ctx) }
    }
    return origHandler(m, ctx)
}
handler.help = ['pharmacie']
handler.tags = ['morocco']
handler.command = ['pharmacie', 'صيدلية']
export default handler
