// plugins/concours.js — Latest Moroccan public-sector job competitions
//
// .concours          → the 10 most recent competitions on emploi-public.ma
// .concours <word>   → same list filtered by a keyword (e.g. صحة, justice,
//                      تعليم, finances…) matched on title + administration
//
// Source: the official portal www.emploi-public.ma (server-rendered list
// at /fr/concours-liste). Only the listing facts are shown (title,
// administration, number of posts, application deadline, exam date) with
// the official link for every item — applications happen on the portal.
const SITE = 'https://www.emploi-public.ma'
const LIST_URL = `${SITE}/fr/concours-liste?page=1`

const strip = s => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()

function parseConcours(html) {
    const parts = html.split(/href="(\/fr\/concours\/details\/[0-9a-f-]{36})"/)
    const out = []
    const seen = new Set()
    for (let i = 1; i < parts.length; i += 2) {
        const url = SITE + parts[i]
        if (seen.has(url)) continue
        seen.add(url)
        const card = strip(parts[i - 1]).slice(-700)
        const postes = (card.match(/(\d[\d\s.]*)\s*postes/i) || [])[1]?.replace(/[\s.]/g, '') || ''
        const deadline = (card.match(/Limite de dépôt\s*:\s*(\d{1,2}\s+\w+\s+\d{4}(?:\s*-\s*\d{1,2}:\d{2})?)/i) || [])[1] || ''
        const examDate = (card.match(/Date du concours\s*:\s*(\d{1,2}\s+\w+\s+\d{4})/i) || [])[1] || ''
        // Administration: from "Ministère …" (or other bodies) up to the status word
        let admin = ''
        const am = card.match(/(Ministère[^]*?|Secrétariat[^]*?|Haut[^]*?|Office[^]*?|Agence[^]*?|Université[^]*?|Services de l.etat[^]*?)(?=\s+(Annonce|Convocation|Résultats)\b)/i)
        if (am) admin = am[1].trim()
        // Title: the chunk right before the grade/administration block
        let title = ''
        const tm = card.match(/([A-ZÀ-Þa-zà-ÿ\u0600-\u06FF][^]{8,120}?)\s+-?\s*(Echelle|Échelle|Grade|Catégorie)/)
        if (tm) title = tm[1].replace(/^.*?>\s*/, '').trim()
        if (!title && admin) {
            const before = card.slice(0, card.indexOf(admin)).trim()
            title = before.split(/(?<=[.!])\s+/).pop()?.slice(-110) || ''
        }
        if (!postes && !deadline && !admin) continue
        out.push({ title, admin, postes, deadline, examDate, url })
        if (out.length >= 15) break
    }
    return out
}

async function fetchConcours() {
    const res = await fetch(LIST_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) throw new Error('emploi-public HTTP ' + res.status)
    return parseConcours(await res.text())
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const kw = (text || '').trim()
    await conn.reply(m.chat, `🏛️ كنجيب ليك آخر المباريات من البوابة الرسمية… ⏳`, m)
    let items
    try { items = await fetchConcours() }
    catch (e) { return conn.reply(m.chat, `❌ موقع الوظيفة العمومية ما جاوبش دابا — جرب من بعد، أو شوف مباشرة:\n${LIST_URL}\n🔧 ${String(e.message || e).slice(0, 120)}`, m) }
    if (!items.length) return conn.reply(m.chat, `😕 ما قدرت نستخرج حتى مباراة دابا — شوف القائمة الرسمية:\n${LIST_URL}`, m)
    if (kw) {
        const n = kw.toLowerCase()
        items = items.filter(it => (it.title + ' ' + it.admin).toLowerCase().includes(n))
        if (!items.length) return conn.reply(m.chat, `😕 ما لقيت حتى مباراة فيها «${kw}» في آخر المنشورات.\nجرب .concours بلا كلمة، أو شوف الكل:\n${LIST_URL}`, m)
    }
    const top = items.slice(0, 10)
    const body =
        `🏛️ *آخر مباريات التوظيف العمومي* 🇲🇦` + (kw ? ` — «${kw}»` : '') + `\n\n` +
        top.map((it, i) =>
            `${i + 1}. *${it.title || it.admin || 'مباراة توظيف'}*` +
            (it.admin && it.title ? `\n🏢 ${it.admin.length > 90 ? it.admin.slice(0, 90) + '…' : it.admin}` : '') +
            (it.postes ? `\n👥 المناصب: ${it.postes}` : '') +
            (it.deadline ? `\n⏰ آخر أجل للإيداع: ${it.deadline}` : '') +
            (it.examDate ? `\n📝 تاريخ المباراة: ${it.examDate}` : '') +
            `\n🔗 ${it.url}`
        ).join('\n\n') +
        `\n\n📌 الترشيح والشروط الكاملة في البوابة الرسمية — رد برقم أو تابع: ${SITE}/fr/concours-liste`
    return conn.reply(m.chat, body, m)
}

handler.help = ['concours']
handler.tags = ['morocco']
handler.command = ['concours', 'مباريات']
export default handler
      
