// books-v3.js — free & legal books library for Silana (improved .books)
// Sources (all free and legal):
//   1) Hindawi Foundation (safahat.org): Arabic + translated world novels — direct PDF/EPUB
//   2) Open Library (openlibrary.org): huge catalog with covers — public IA copies download,
//      the rest open as a cover + info card
//   3) Internet Archive (archive.org): open scanned classics, Arabic and world
//   4) Project Gutenberg (gutendex.com): public-domain world classics in their own language
// Usage:
//   .books <title or author>   -> merged results as a tappable list (or numbered text)
//   .books <number>            -> download the book, or open its cover/info card
// Sessions: each user's last results are kept for 10 minutes.

const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
const MAX_BYTES = 64 * 1024 * 1024
const sessions = new Map()
const busyDownloads = new Set()

async function fetchT(url, ms, opts) {
    const ctrl = new AbortController()
    const t = setTimeout(function () { ctrl.abort() }, ms || 30000)
    const o = {}
    const src = opts || {}
    for (const k in src) o[k] = src[k]
    o.signal = ctrl.signal
    const headers = { 'user-agent': UA }
    if (src.headers) { for (const h in src.headers) headers[h] = src.headers[h] }
    o.headers = headers
    try { return await fetch(url, o) } finally { clearTimeout(t) }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }
async function fetchJson(url, ms, label) {
    const res = await fetchT(url, ms)
    if (!res.ok) throw new Error(label + ' HTTP ' + res.status)
    const txt = await res.text()
    try { return JSON.parse(txt) } catch (e) { throw new Error(label + ': رجّع صفحة HTML بدل البيانات — غالباً حظر أو ضغط مؤقت على IP الاستضافة') }
}
function cleanName(s) {
    const out = String(s || 'book').replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    return out || 'book'
}
function normTitle(s) {
    return String(s || '').toLowerCase()
        .replace(/[\u064B-\u0652]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ').trim()
}

/* ---------------- Source 1: Hindawi ---------------- */
async function searchHindawi(term) {
    const kw = encodeURIComponent(term.trim().replace(/\s+/g, '.'))
    const res = await fetchT('https://www.safahat.org/search/keyword/' + kw + '/', 30000)
    if (!res.ok) throw new Error('Hindawi HTTP ' + res.status)
    const html = await res.text()
    const start = html.indexOf('searchResults')
    const block = start >= 0 ? html.slice(start, start + 30000) : html
    const out = []
    const re = /<a href='\/books\/(\d+)\/'>([^<]+)<\/a>(?:\s*&middot;\s*بقلم\s*<a href='\/contributors\/\d+\/'>([^<]+)<\/a>)?/g
    let mm
    while ((mm = re.exec(block)) !== null && out.length < 8) {
        out.push({ source: 'هنداوي', id: mm[1], title: mm[2].trim(), author: (mm[3] || '').trim(), downloadable: true })
    }
    return out
}

/* ---------------- Source 2: Open Library ---------------- */
async function searchOpenLibrary(term) {
    const fields = 'key,title,author_name,cover_i,first_publish_year,edition_count,ia,ebook_access'
    const data = await fetchJson('https://openlibrary.org/search.json?q=' + encodeURIComponent(term) + '&limit=8&fields=' + fields, 30000, 'المكتبة المفتوحة')
    const out = []
    const docs = (data && data.docs) || []
    for (const d of docs) {
        if (!d || !d.title) continue
        const ia = (d.ia && d.ia.length) ? String(d.ia[0]) : ''
        const downloadable = d.ebook_access === 'public' && !!ia
        out.push({
            source: 'المكتبة المفتوحة',
            title: String(d.title).replace(/\s+/g, ' ').trim(),
            author: (d.author_name || []).join('، '),
            year: d.first_publish_year || '',
            editions: d.edition_count || 0,
            cover: d.cover_i ? 'https://covers.openlibrary.org/b/id/' + d.cover_i + '-L.jpg' : '',
            workKey: d.key || '',
            iaId: ia,
            downloadable: downloadable
        })
    }
    return out
}
async function fetchDescription(workKey) {
    if (!workKey) return ''
    try {
        const data = await fetchJson('https://openlibrary.org' + workKey + '.json', 20000, 'المكتبة المفتوحة')
        let desc = ''
        if (data && typeof data.description === 'string') desc = data.description
        else if (data && data.description && typeof data.description.value === 'string') desc = data.description.value
        return desc.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 700)
    } catch (e) { return '' }
}

/* ---------------- Source 3: Internet Archive ---------------- */
function cleanArchiveTitle(t) {
    return String(t || '').replace(/^Book\s+/i, '').split('---')[0].replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()
}
async function searchArchive(term) {
    const q = encodeURIComponent(term)
    const url = 'https://archive.org/advancedsearch.php?q=' + q + '+AND+mediatype%3Atexts&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=8&output=json'
    const data = await fetchJson(url, 30000, 'الأرشيف')
    const out = []
    const docs = (data && data.response && data.response.docs) || []
    for (const d of docs) {
        if (!d.identifier) continue
        const author = Array.isArray(d.creator) ? d.creator.join('، ') : (d.creator || '')
        out.push({ source: 'الأرشيف', id: d.identifier, title: cleanArchiveTitle(d.title) || d.identifier, author: String(author).slice(0, 60), downloadable: true })
    }
    return out
}
async function archiveFile(item) {
    let data = null
    for (let attempt = 0; attempt < 2; attempt++) {
        try { data = await fetchJson('https://archive.org/metadata/' + encodeURIComponent(item.id), 30000, 'الأرشيف'); break }
        catch (e) { if (attempt === 1) throw e; await sleep(2000) }
    }
    const cands = []
    const files = (data && data.files) || []
    for (const f of files) {
        const name = f.name || ''
        const fmt = (f.format || '').toLowerCase()
        if (!name || name.indexOf('_djvu') !== -1 || name.endsWith('.xml') || name.indexOf('metadata') !== -1) continue
        const size = parseInt(f.size || '0', 10) || 0
        let rank = -1
        if (fmt.indexOf('epub') !== -1 || name.toLowerCase().endsWith('.epub')) rank = 0
        else if (fmt.indexOf('pdf') !== -1 || name.toLowerCase().endsWith('.pdf')) rank = 1
        if (rank < 0 || (size > 0 && size > MAX_BYTES)) continue
        cands.push({ name: name, size: size, rank: rank })
    }
    cands.sort(function (a, b) { return (a.rank - b.rank) || ((a.size || 1e15) - (b.size || 1e15)) })
    if (!cands.length) throw new Error('لا توجد نسخة PDF/EPUB مناسبة الحجم')
    return cands[0]
}

/* ---------------- Source 4: Gutenberg ---------------- */
async function searchGutenberg(term) {
    const data = await fetchJson('https://gutendex.com/books?search=' + encodeURIComponent(term), 30000, 'جوتنبرغ')
    const out = []
    const results = (data && data.results) || []
    for (const b of results.slice(0, 8)) {
        const f = b.formats || {}
        const url = f['application/pdf'] || f['application/epub+zip'] || f['text/plain; charset=utf-8'] || f['text/plain; charset=us-ascii'] || ''
        if (!url || url.endsWith('.zip')) continue
        const authors = (b.authors || []).map(function (a) { return a.name })
        out.push({ source: 'جوتنبرغ', title: (b.title || '').replace(/\s+/g, ' ').trim(), author: authors.join('، '), url: url, downloadable: true })
        if (out.length >= 5) break
    }
    return out
}

async function headSize(url) {
    try {
        const res = await fetchT(url, 15000, { method: 'HEAD' })
        const n = parseInt(res.headers.get('content-length') || '0', 10)
        return isNaN(n) ? 0 : n
    } catch (e) { return 0 }
}
async function downloadBuffer(url, ms) {
    const res = await fetchT(url, ms || 120000)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new Error('TOO_BIG')
    return buf
}

const SOURCE_LABEL = { 'هنداوي': 'مؤسسة هنداوي', 'المكتبة المفتوحة': 'المكتبة المفتوحة Open Library', 'الأرشيف': 'مكتبة الأرشيف archive.org', 'جوتنبرغ': 'مشروع جوتنبرغ' }

async function sendResults(m, conn, usedPrefix, command, term, items) {
    const rows = []
    for (let i = 0; i < items.length; i++) {
        const b = items[i]
        const mark = b.downloadable ? '⬇️ ' : 'ℹ️ '
        let desc = b.source
        if (b.author) desc = b.author.slice(0, 40) + ' · ' + desc
        if (b.year) desc += ' · ' + b.year
        rows.push({ title: (mark + b.title).slice(0, 50), description: desc.slice(0, 70), id: usedPrefix + command + ' ' + (i + 1) })
    }
    if (typeof conn.sendButton === 'function') {
        try {
            await conn.sendButton(m.chat, {
                text: '📚 *نتائج البحث عن "' + term + '"*\n⬇️ = قابل للتحميل · ℹ️ = غلاف ومعلومات فقط\nاختار كتابا من اللائحة 👇',
                footer: 'مكتبة سيلانا — كتب مجانية وقانونية',
                buttons: [
                    { name: 'single_select', buttonParamsJson: JSON.stringify({ title: '📚 لائحة الكتب', sections: [{ title: 'نتائج البحث', rows: rows }] }) }
                ]
            }, { quoted: m })
            return
        } catch (e) {
            console.error('[BOOKS] sendButton failed, falling back to text list:', (e && e.message) || e)
        }
    }
    const lines = items.map(function (b, i) {
        return (i + 1) + '. ' + (b.downloadable ? '⬇️' : 'ℹ️') + ' 📖 *' + b.title + '*' +
            (b.author ? '\n   ✍️ ' + b.author : '') +
            (b.year ? '\n   📅 ' + b.year : '') +
            '\n   🏛️ ' + b.source
    })
    await conn.reply(m.chat,
        '📚 *نتائج البحث عن "' + term + '":*\n\n' + lines.join('\n\n') +
        '\n\n⬇️ للتحميل أو فتح البطاقة صيفط: ' + usedPrefix + command + ' <رقم>\nمثال: ' + usedPrefix + command + ' 1', m)
}

async function sendInfoCard(m, conn, item, note) {
    const desc = await fetchDescription(item.workKey)
    let caption = '📖 *' + item.title + '*'
    if (item.author) caption += '\n✍️ ' + item.author
    if (item.year) caption += '\n📅 أول نشر: ' + item.year
    if (item.editions) caption += '\n📚 الطبعات المسجلة: ' + item.editions
    if (desc) caption += '\n\n' + desc
    caption += '\n\n🏛️ المصدر: ' + (SOURCE_LABEL[item.source] || item.source)
    caption += '\n' + (note || 'ℹ️ هذا الكتاب متاح للاطلاع في المكتبة المفتوحة — لا توجد نسخة مجانية قابلة للتحميل المباشر.')
    if (item.cover) {
        try {
            const buf = await downloadBuffer(item.cover, 30000)
            const isJpg = buf.length > 2 && buf[0] === 0xFF && buf[1] === 0xD8
            const isPng = buf.length > 2 && buf[0] === 0x89 && buf[1] === 0x50
            if (isJpg || isPng) {
                await conn.sendMessage(m.chat, { image: buf, caption: caption }, { quoted: m })
                return
            }
        } catch (e) {}
    }
    await conn.reply(m.chat, caption, m)
}

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const arg = (text || '').trim()

    if (/^\d+$/.test(arg)) {
        const sess = sessions.get(m.sender)
        if (!sess || Date.now() - sess.at > 10 * 60 * 1000) {
            sessions.delete(m.sender)
            return m.reply('⚠️ ما عندكش نتائج بحث محفوظة (أو سالات 10 دقائق).\nابحث أولا: ' + usedPrefix + command + ' <اسم الكتاب>')
        }
        const item = sess.items[parseInt(arg, 10) - 1]
        if (!item) return m.reply('⚠️ الرقم ' + arg + ' ما كاينش فالنتائج. شوف اللائحة ورجع اختار رقم صحيح.')
        if (busyDownloads.has(m.sender)) return m.reply('⏳ التحميل السابق باقي خدام — صبر حتى يسالي.')
        busyDownloads.add(m.sender)
        await m.react('⏳')
        try {
            if (item.source === 'المكتبة المفتوحة' && !item.downloadable) {
                await sendInfoCard(m, conn, item)
                await m.react('✅')
                return
            }
            let buf = null, fileName = '', mime = ''
            if (item.source === 'هنداوي') {
                const pdfUrl = 'https://downloads.hindawi.org/books/' + item.id + '.pdf'
                const epubUrl = 'https://downloads.hindawi.org/books/' + item.id + '.epub'
                const pdfSize = await headSize(pdfUrl)
                if (pdfSize > 0 && pdfSize <= 30 * 1024 * 1024) {
                    buf = await downloadBuffer(pdfUrl); fileName = cleanName(item.title) + '.pdf'; mime = 'application/pdf'
                } else {
                    try { buf = await downloadBuffer(epubUrl); fileName = cleanName(item.title) + '.epub'; mime = 'application/epub+zip' }
                    catch (e) { buf = await downloadBuffer(pdfUrl); fileName = cleanName(item.title) + '.pdf'; mime = 'application/pdf' }
                }
            } else if (item.source === 'الأرشيف' || (item.source === 'المكتبة المفتوحة' && item.iaId)) {
                const archItem = item.source === 'الأرشيف' ? item : { id: item.iaId }
                let file = null
                try { file = await archiveFile(archItem) } catch (e) { file = null }
                if (!file) {
                    if (item.source === 'المكتبة المفتوحة') {
                        await sendInfoCard(m, conn, item, 'ℹ️ النسخة المفتوحة ديال هاد الكتاب ما فيهاش ملف قابل للتحميل المباشر — هاهي بطاقة الكتاب:')
                        await m.react('✅')
                        return
                    }
                    throw new Error('لا توجد نسخة PDF/EPUB مناسبة الحجم')
                }
                buf = await downloadBuffer('https://archive.org/download/' + encodeURIComponent(archItem.id) + '/' + encodeURIComponent(file.name))
                const ext = file.name.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf'
                fileName = cleanName(item.title) + '.' + ext
                mime = ext === 'epub' ? 'application/epub+zip' : 'application/pdf'
            } else {
                buf = await downloadBuffer(item.url)
                const ext = item.url.indexOf('.epub') !== -1 ? 'epub' : item.url.indexOf('.pdf') !== -1 ? 'pdf' : 'txt'
                fileName = cleanName(item.title) + '.' + ext
                mime = ext === 'pdf' ? 'application/pdf' : ext === 'epub' ? 'application/epub+zip' : 'text/plain'
            }
            await conn.sendMessage(m.chat, {
                document: buf,
                mimetype: mime,
                fileName: fileName,
                caption: '📖 *' + item.title + '*' + (item.author ? '\n✍️ ' + item.author : '') + '\n📚 المصدر: ' + (SOURCE_LABEL[item.source] || item.source) + '\n\nقراءة ممتعة! 🌙'
            }, { quoted: m })
            await m.react('✅')
        } catch (e) {
            await m.react('❌')
            return m.reply(e.message === 'TOO_BIG'
                ? '⚠️ هاد الكتاب كبير بزاف (أكثر من 64MB) وما نقدرش نصيفطو عبر واتساب.'
                : '❌ وقع مشكل فالتحميل من ' + (SOURCE_LABEL[item.source] || item.source) + ' هذه المرة. جرّب رقما آخر من نتائج البحث، أو عاود المحاولة من بعد.' + (isOwner ? '\n🔧 تفاصيل للمالك: ' + e.message : ''))
        } finally {
            busyDownloads.delete(m.sender)
        }
        return
    }

    if (!arg) {
        return m.reply(
            '📚 *مكتبة سيلانا — الروايات والكتب*\n\n' +
            '🔍 ابحث على أي رواية أو كتاب:\n' +
            usedPrefix + command + ' ماجدولين\n' +
            usedPrefix + command + ' الأجنحة المتكسرة\n' +
            usedPrefix + command + ' pride and prejudice\n\n' +
            '⬇️ من بعد اختار من اللائحة، أو صيفط الرقم:\n' +
            usedPrefix + command + ' 2\n\n' +
            '⬇️ = الكتاب يتحمل مباشرة · ℹ️ = الغلاف والمعلومات فقط\n' +
            '🏛️ المصادر: مؤسسة هنداوي + المكتبة المفتوحة + مكتبة الأرشيف + مشروع جوتنبرغ (كتب مجانية وقانونية)')
    }

    await m.react('🔍')
    const sources = [['هنداوي', searchHindawi], ['المكتبة المفتوحة', searchOpenLibrary], ['الأرشيف', searchArchive], ['جوتنبرغ', searchGutenberg]]
    const settled = await Promise.allSettled(sources.map(function (pair) { return pair[1](arg) }))
    const items = []
    const errors = []
    let okCount = 0
    settled.forEach(function (r, i) {
        if (r.status === 'fulfilled') { okCount++; for (const it of r.value) items.push(it) }
        else errors.push(sources[i][0] + ': ' + ((r.reason && r.reason.message) || r.reason))
    })
    const seen = new Set()
    const merged = []
    for (const it of items) {
        const key = normTitle(it.title)
        if (key && key.length > 3 && seen.has(key)) continue
        if (key) seen.add(key)
        merged.push(it)
        if (merged.length >= 10) break
    }
    if (!merged.length) {
        await m.react('❌')
        if (okCount === 0) {
            return m.reply('⚠️ المكتبات ما جاوباتش من سيرفر الاستضافة — غالبا الـ IP ديال الاستضافة محظور عند هاد المواقع (نفس مشكل إنستغرام قبل).\n\nالأسباب المحتملة: حظر IP الاستضافة، أو انقطاع مؤقت. البديل المضمون هو تغيير الاستضافة/IP.' + (isOwner ? '\n\n🔧 تفاصيل للمالك:\n' + errors.join('\n') : ''))
        }
        return m.reply('😕 ما لقيت حتى كتاب بـ "' + arg + '" فالمكتبات المجانية.\n\n📌 ملاحظة: البوت كيقلب غير فالكتب المجانية والقانونية (هنداوي + المكتبة المفتوحة + الأرشيف + جوتنبرغ). الكتب الحديثة التجارية محمية بحقوق النشر وما كتكونش فهاد المكتبات.\n\nجرّب: روايات عربية كلاسيكية، روايات عالمية مترجمة، أو الاسم بالإنجليزية للكتب الأجنبية.')
    }
    sessions.set(m.sender, { at: Date.now(), items: merged })
    await sendResults(m, conn, usedPrefix, command, arg, merged)
}

handler.help = ['books']
handler.tags = ['downloader']
handler.command = /^books$/i
handler.limit = false

export default handler
                
