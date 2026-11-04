// plugins/trending.js — Moroccan trending searches today (.trending)
//   .trending   → the top 10 searches trending in Morocco right now,
//                 with approximate search volume + the top related headline.
//
// Data: Google Trends official daily RSS for Morocco (geo=MA) — an
// official public feed, no key, no account. Results are cached 20
// minutes in memory so repeated calls don't hammer the feed.
//
// Tags: morocco (the user's standing rule for Moroccan features).

const FEED_URL = 'https://trends.google.com/trending/rss?geo=MA'
const CACHE_MS = 20 * 60 * 1000
let cache = { at: 0, items: null }

const dec = s => (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, '').trim()

function parseFeed(xml) {
    const items = []
    const blocks = xml.split('<item>').slice(1)
    for (const b of blocks) {
        const title = dec((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1])
        const traffic = dec((b.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/) || [])[1])
        const news = dec((b.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/) || [])[1])
        const src = dec((b.match(/<ht:news_item_source>([\s\S]*?)<\/ht:news_item_source>/) || [])[1])
        if (title) items.push({ title, traffic, news, src, vol: parseInt((traffic || '').replace(/[^\d]/g, ''), 10) || 0 })
    }
    // The RSS order is recency-based, not volume — re-rank by searches.
    items.sort((a, b) => b.vol - a.vol)
    return items.slice(0, 10)
}

async function fetchTrends() {
    if (cache.items && Date.now() - cache.at < CACHE_MS) return cache.items
    const res = await fetch(FEED_URL, {
        headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 13) SilanaBot' },
        signal: AbortSignal.timeout(20000)
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const items = parseFeed(await res.text())
    if (!items.length) throw new Error('empty feed')
    cache = { at: Date.now(), items }
    return items
}

const MEDALS = ['🥇', '🥈', '🥉']

let handler = async (m, { conn }) => {
    let items
    try { items = await fetchTrends() }
    catch (e) { return conn.reply(m.chat, '❌ خدمة الترند ما جاوباتش دابا — عاود المحاولة بعد شوية.', m) }

    const today = new Intl.DateTimeFormat('ar-MA', { timeZone: 'Africa/Casablanca', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
    const lines = items.map((t, i) => {
        const rank = MEDALS[i] || `*${i + 1}.*`
        let s = `${rank} *${t.title}*${t.traffic ? `  —  🔥 +${t.traffic.replace(/\+$/, '')} بحث` : ''}`
        if (t.news) s += `\n   📰 ${t.news}${t.src ? ` (${t.src})` : ''}`
        return s
    })
    const text =
        `📈 *ترند المغرب — ${today}*\n` +
        `أكثر المواضيع اللي كيقلب عليها المغاربة دابا:\n\n` +
        lines.join('\n') +
        `\n\n💡 صالحة لأفكار فيديوات وهوكات جديدة.\n📊 المصدر: Google Trends — المغرب`
    return conn.reply(m.chat, text, m)
}
handler.help = ['trending']
handler.tags = ['morocco']
handler.command = ['trending', 'trend', 'ترند']
export default handler
