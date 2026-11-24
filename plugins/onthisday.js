// .onthisday — a short historical story for today's date (Wikipedia On This Day, Arabic first)
const UA = 'SilanaBot/1.0 (Silana WhatsApp bot - onthisday feature)'
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر']
const cache = new Map()

function fetchT(url, ms) {
    const ctrl = new AbortController()
    const t = setTimeout(function () { ctrl.abort() }, ms || 15000)
    return fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, 'Api-User-Agent': UA } })
        .then(function (res) { clearTimeout(t); return res })
        .catch(function (e) { clearTimeout(t); throw e })
}
async function fetchJson(url, ms) {
    const res = await fetchT(url, ms)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return res.json()
}
function pad2(n) { return (n < 10 ? '0' : '') + n }
function todayCasablanca() {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date())
        let d = 1, mo = 1, y = 2026
        for (const p of parts) {
            if (p.type === 'day') d = parseInt(p.value, 10)
            if (p.type === 'month') mo = parseInt(p.value, 10)
            if (p.type === 'year') y = parseInt(p.value, 10)
        }
        return { d: d, mo: mo, y: y }
    } catch (e) {
        const n = new Date()
        return { d: n.getDate(), mo: n.getMonth() + 1, y: n.getFullYear() }
    }
}
function trimStory(s, cap) {
    s = String(s || '').replace(/\s+/g, ' ').trim()
    if (s.length <= cap) return s
    const cut = s.slice(0, cap)
    const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('؟ '), cut.lastIndexOf('! '))
    if (dot > cap * 0.5) return cut.slice(0, dot + 1)
    return cut + '…'
}
function pickStory(events) {
    let best = null, bestScore = -1
    for (const e of events) {
        const page = (e.pages && e.pages[0]) || {}
        const extract = String(page.extract || '')
        if (!e.text || !e.year) continue
        let score = Math.min(extract.length, 900)
        if (extract.length < 120) score = score - 500
        if (e.year < 1950) score = score + 60
        if (score > bestScore) { bestScore = score; best = e }
    }
    return best
}
async function getEvents(lang, mm, dd) {
    const key = lang + '-' + mm + '-' + dd
    if (cache.has(key)) return cache.get(key)
    const data = await fetchJson('https://api.wikimedia.org/feed/v1/wikipedia/' + lang + '/onthisday/events/' + mm + '/' + dd)
    const events = (data && data.events) || []
    if (cache.size > 40) cache.clear()
    cache.set(key, events)
    return events
}

const handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const used = usedPrefix || '.'
    const now = todayCasablanca()
    let mo = now.mo, d = now.d
    const arg = String(text || '').trim()
    if (arg) {
        const dm = arg.match(/^(\d{1,2})[\/\-. ](\d{1,2})$/)
        if (!dm) {
            return m.reply(
                '📅 *في مثل هذا اليوم*\n\n' +
                '▪️ ' + used + command + ' — قصة اليوم\n' +
                '▪️ ' + used + command + ' 15/3 — قصة أي تاريخ (اليوم/الشهر)\n\n' +
                'قصص تاريخية قصيرة من ويكيبيديا، بالعربية أولاً.')
        }
        d = parseInt(dm[1], 10); mo = parseInt(dm[2], 10)
        if (d < 1 || d > 31 || mo < 1 || mo > 12) return m.reply('⚠️ هاد التاريخ ما صالحش — جرب بحال: ' + used + command + ' 15/3')
    }
    const mm = pad2(mo), dd = pad2(d)
    await m.react('📅')
    let events = null, lang = 'ar', firstErr = null
    try { events = await getEvents('ar', mm, dd) } catch (e) { firstErr = e }
    if (!events || !events.length) {
        try { events = await getEvents('en', mm, dd); lang = 'en' } catch (e) { if (!firstErr) firstErr = e }
    }
    if (!events || !events.length) {
        await m.react('❌')
        let msg = '😕 ما قدرت نجيب أحداث هاد التاريخ دابا — المصدر (ويكيبيديا) ما جاوبش. عاود المحاولة من بعد شوية.'
        if (isOwner && firstErr) msg += '\n\n🔧 ' + (firstErr.message || String(firstErr))
        return m.reply(msg)
    }
    const story = pickStory(events)
    if (!story) return m.reply('😕 لقيت أحداث لهاد التاريخ ولكن بلا تفاصيل كافية — جرب تاريخ آخر.')
    const page = (story.pages && story.pages[0]) || {}
    const yearsAgo = now.y - story.year
    let agoLine
    if (yearsAgo <= 0) agoLine = 'هاد السنة نفسها'
    else if (yearsAgo === 1) agoLine = 'قبل سنة واحدة'
    else if (yearsAgo === 2) agoLine = 'قبل سنتين'
    else agoLine = 'قبل ' + yearsAgo + ' سنة'
    let out = '📅 *في مثل هذا اليوم — ' + d + ' ' + MONTHS_AR[mo - 1] + '*\n\n'
    out += '🕰️ *' + agoLine + '، في سنة ' + story.year + ':*\n' + trimStory(story.text, 300) + '\n'
    if (page.extract) out += '\n📖 ' + trimStory(page.extract, 650) + '\n'
    const others = []
    for (const e of events) {
        if (others.length >= 3) break
        if (e === story || !e.year || !e.text) continue
        others.push('▪️ *' + e.year + '* — ' + trimStory(e.text, 110))
    }
    if (others.length) out += '\n✨ *أحداث أخرى في نفس اليوم:*\n' + others.join('\n') + '\n'
    out += '\n📚 المصدر: ويكيبيديا' + (page.normalizedtitle || page.title ? ' — ' + (page.normalizedtitle || page.title) : '')
    if (lang === 'en') out += '\n(المصدر العربي ما جاوبش، فالقصة بالإنجليزية هاد المرة)'
    out += '\n\nجرّب أي تاريخ: ' + used + command + ' 1/1'
    await m.react('✅')
    return m.reply(out)
}

handler.help = ['onthisday']
handler.tags = ['tools']
handler.command = /^onthisday$/i
export default handler
      
