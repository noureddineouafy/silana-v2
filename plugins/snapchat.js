// snap.js — تحميل فيديوات وصور سناب شات العامة (.snap) — v1
// ─────────────────────────────────────────────────────────────────────────────
//   .snap <رابط>   → Spotlight / ستوري عامة / بروفايل
// كيفاش: صفحة الويب العامة ديال سناب فيها og:video بالنسبة للسبوتلايت،
// وروابط CDN مباشرة (sc-cdn.net) بالنسبة للستوريات والبروفايلات.
// كنصنف كل وسائط بـ HEAD (video/mp4 ولا image) وكنبعتها.
// ⚠️ غير المحتوى العام اللي عندو رابط مشاركة — الخاص ما كيوصلش هنا.
// ─────────────────────────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const MAX_MEDIA = 10
const MAX_FILE = 60 * 1024 * 1024

function unescapeHtml(s) {
    return s.replace(/\\u0026/g, '&').replace(/\\u003d/gi, '=').replace(/\\\//g, '/').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
}

function metaContent(html, prop) {
    const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]+)"`, 'i')
    const re2 = new RegExp(`<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="${prop}"`, 'i')
    const mm = html.match(re) || html.match(re2)
    return mm ? unescapeHtml(mm[1]) : null
}

async function headType(url) {
    try {
        const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })
        if (!r.ok) return null
        return { type: r.headers.get('content-type') || '', len: +(r.headers.get('content-length') || 0) }
    } catch { return null }
}

async function download(url) {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) })
    if (!r.ok) throw new Error(`CDN HTTP ${r.status}`)
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_FILE) throw new Error('الملف كبير بزاف (>60MB)')
    return buf
}

function extractMediaGroups(html) {
    const clean = unescapeHtml(html)
    const urls = clean.match(/https:\/\/[a-z0-9-]+\.sc-cdn\.net\/[^"'\\<>\s]+/gi) || []
    const groups = new Map()
    for (const u of urls) {
        const seg = u.split('/').pop().split('?')[0]
        const id = seg.split('.')[0]
        if (!id || id.length < 8) continue
        if (!groups.has(id)) groups.set(id, [])
        const arr = groups.get(id)
        if (!arr.includes(u)) arr.push(u)
    }
    return [...groups.values()]
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const urlMatch = (text || '').match(/https?:\/\/[^\s]+/i)
    const link = urlMatch ? urlMatch[0].replace(/[)\].,]+$/, '') : null
    if (!link || !/(snapchat\.com|t\.snapchat\.com)/i.test(link)) {
        return conn.reply(m.chat,
            `👻 *تحميل سناب شات (v1)*\n\n` +
            `> ${usedPrefix + command} <رابط Spotlight ولا ستوري عامة>\n\n` +
            `مثال: رابط من «مشاركة» في سناب شات.\n⚠️ غير المحتوى العام — الستوريات الخاصة ما كتتحملش.`, m)
    }
    await conn.reply(m.chat, '⏳ كنقلب على الوسائط في الرابط…', m)
    try {
        const page = await fetch(link, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000), redirect: 'follow' })
        if (!page.ok) throw new Error(`Snapchat HTTP ${page.status}`)
        const html = await page.text()
        const finalUrl = page.url || link
        const title = (metaContent(html, 'og:title') || '').split('|')[0].trim().slice(0, 120)

        // 1) سبوتلايت / رابط مشاركة: og:video مباشرة
        const ogVideo = metaContent(html, 'og:video:secure_url') || metaContent(html, 'og:video')
        if (ogVideo && /\.sc-cdn\.net|snapcdn/i.test(ogVideo)) {
            const buf = await download(ogVideo)
            await conn.sendMessage(m.chat, { video: buf, caption: `👻 ${title || 'Snapchat Spotlight'}\n⚡ SILANA AI`, mimetype: 'video/mp4' }, { quoted: m })
            return
        }

        // 2) ستوري / بروفايل: مجموعات وسائط متعددة
        const groups = extractMediaGroups(html).slice(0, 30)
        const media = []
        for (const variants of groups) {
            if (media.length >= MAX_MEDIA) break
            let picked = null
            for (const u of variants.slice(0, 4)) {
                const h = await headType(u)
                if (!h) continue
                if (h.type.startsWith('video/')) { picked = { url: u, kind: 'video' }; break }
                if (h.type.startsWith('image/') && !picked) picked = { url: u, kind: 'image' }
            }
            if (picked) media.push(picked)
        }
        if (!media.length) {
            return conn.reply(m.chat, '😕 ما لقيت حتى فيديو ولا تصويرة في هاد الرابط.\nتأكد بلي المحتوى *عام* وباقي متوفر (الستوريات كتسالي في 24 ساعة).', m)
        }
        await conn.reply(m.chat, `👻 لقيت *${media.length}* وسائط${/spotlight/i.test(finalUrl) ? '' : ' (ستوري/بروفايل)'} — كنبعت…`, m)
        let sent = 0
        for (const it of media) {
            try {
                const buf = await download(it.url)
                if (it.kind === 'video') await conn.sendMessage(m.chat, { video: buf, mimetype: 'video/mp4', caption: sent === 0 ? `👻 ${title || 'Snapchat'}` : undefined }, { quoted: m })
                else await conn.sendMessage(m.chat, { image: buf, caption: sent === 0 ? `👻 ${title || 'Snapchat'}` : undefined }, { quoted: m })
                sent++
            } catch { /* تخطي الفاشل */ }
        }
        if (!sent) throw new Error('فشل تحميل الوسائط من CDN')
    } catch (e) {
        return conn.reply(m.chat, '❌ ما قدرتش نحمل من هاد الرابط.\n🔧 تفاصيل للمالك: ' + String(e.message || e).slice(0, 160), m)
    }
}

handler.help = ['snapchat']
handler.tags = ['downloader']
handler.command = /^(snap|snapdl|snapchat|سناب|سنابشات)$/i
handler.limit = false

export default handler
