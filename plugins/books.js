// novels.js — تحميل الروايات والكتب المجانية (اقتراح أحد المتابعين)
// المصادر (مكتبات مجانية وقانونية):
//   1) مؤسسة هنداوي (safahat.org): روايات عربية وعالمية مترجمة — تحميل PDF/EPUB مباشر
//   2) مكتبة الأرشيف (archive.org): مكتبة عالمية مفتوحة — كلاسيكيات عربية وعالمية ممسوحة
//   3) مشروع جوتنبرغ (gutendex.com): روايات عالمية كلاسيكية بلغتها الأصلية (دومين عام)
// الاستعمال:
//   .رواية <اسم الرواية أو المؤلف>   → بحث ونتائج مرقمة
//   .رواية <رقم>                      → تحميل الكتاب من آخر نتائج بحث عندك
// الجلسات: نتائج كل مستعمل محفوظة 10 دقائق.

const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
const MAX_BYTES = 64 * 1024 * 1024 // 64MB حد أمان للتحميل عبر البوت
const sessions = new Map() // sender -> { at, items }

async function fetchT(url, ms, opts) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), ms || 30000)
    try {
        return await fetch(url, { ...(opts || {}), signal: ctrl.signal, headers: { 'user-agent': UA, ...((opts && opts.headers) || {}) } })
    } finally { clearTimeout(t) }
}

// ---------- المصدر 1: هنداوي / صفحات ----------
async function searchHindawi(term) {
    const kw = encodeURIComponent(term.trim().replace(/\s+/g, '.'))
    const res = await fetchT(`https://www.safahat.org/search/keyword/${kw}/`, 30000)
    if (!res.ok) throw new Error(`Hindawi HTTP ${res.status}`)
    const html = await res.text()
    const start = html.indexOf('searchResults')
    const block = start >= 0 ? html.slice(start, start + 30000) : html
    const out = []
    const re = /<a href='\/books\/(\d+)\/'>([^<]+)<\/a>(?:\s*&middot;\s*بقلم\s*<a href='\/contributors\/\d+\/'>([^<]+)<\/a>)?/g
    let mm
    while ((mm = re.exec(block)) !== null && out.length < 8) {
        out.push({ source: 'هنداوي', id: mm[1], title: mm[2].trim(), author: (mm[3] || '').trim() })
    }
    return out
}

// ---------- المصدر 2: مكتبة الأرشيف ----------
const cleanArchiveTitle = (t) => String(t || '')
    .replace(/^Book\s+/i, '')
    .split('---')[0]
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

async function searchArchive(term) {
    const q = encodeURIComponent(term)
    const url = `https://archive.org/advancedsearch.php?q=${q}+AND+mediatype%3Atexts&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=8&output=json`
    const res = await fetchT(url, 30000)
    if (!res.ok) throw new Error(`Archive HTTP ${res.status}`)
    const data = await res.json()
    const out = []
    for (const d of (data.response?.docs || [])) {
        if (!d.identifier) continue
        const author = Array.isArray(d.creator) ? d.creator.join('، ') : (d.creator || '')
        out.push({ source: 'الأرشيف', id: d.identifier, title: cleanArchiveTitle(d.title) || d.identifier, author: String(author).slice(0, 60) })
    }
    return out
}

async function archiveFile(item) {
    const res = await fetchT(`https://archive.org/metadata/${encodeURIComponent(item.id)}`, 30000)
    if (!res.ok) throw new Error(`Archive meta HTTP ${res.status}`)
    const data = await res.json()
    const cands = []
    for (const f of (data.files || [])) {
        const name = f.name || ''
        const fmt = (f.format || '').toLowerCase()
        if (!name || name.includes('_djvu') || name.endsWith('.xml') || name.includes('metadata')) continue
        const size = parseInt(f.size || '0', 10) || 0
        let rank = -1
        if (fmt.includes('epub') || name.toLowerCase().endsWith('.epub')) rank = 0
        else if (fmt.includes('pdf') || name.toLowerCase().endsWith('.pdf')) rank = 1
        if (rank < 0 || (size > 0 && size > MAX_BYTES)) continue
        cands.push({ name, size, rank })
    }
    cands.sort((a, b) => a.rank - b.rank || (a.size || 1e15) - (b.size || 1e15))
    if (!cands.length) throw new Error('لا توجد نسخة PDF/EPUB مناسبة الحجم')
    return cands[0]
}

// ---------- المصدر 3: جوتنبرغ ----------
async function searchGutenberg(term) {
    const res = await fetchT(`https://gutendex.com/books?search=${encodeURIComponent(term)}`, 30000)
    if (!res.ok) throw new Error(`Gutendex HTTP ${res.status}`)
    const data = await res.json()
    const out = []
    for (const b of (data.results || []).slice(0, 8)) {
        const f = b.formats || {}
        const url = f['application/pdf'] || f['application/epub+zip'] || f['text/plain; charset=utf-8'] || f['text/plain; charset=us-ascii'] || ''
        if (!url || url.endsWith('.zip')) continue
        out.push({
            source: 'جوتنبرغ',
            title: (b.title || '').replace(/\s+/g, ' ').trim(),
            author: ((b.authors || []).map((a) => a.name).join('، ')),
            url,
        })
        if (out.length >= 5) break
    }
    return out
}

async function headSize(url) {
    try {
        const res = await fetchT(url, 15000, { method: 'HEAD' })
        const n = parseInt(res.headers.get('content-length') || '0', 10)
        return isNaN(n) ? 0 : n
    } catch { return 0 }
}

async function downloadBuffer(url) {
    const res = await fetchT(url, 120000)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new Error('TOO_BIG')
    return buf
}

const cleanName = (s) => String(s || 'book').replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'book'
const SOURCE_LABEL = { 'هنداوي': 'مؤسسة هنداوي', 'الأرشيف': 'مكتبة الأرشيف archive.org', 'جوتنبرغ': 'مشروع جوتنبرغ' }

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const arg = (text || '').trim()

    // ---------- تحميل برقم من آخر نتائج ----------
    if (/^\d+$/.test(arg)) {
        const sess = sessions.get(m.sender)
        if (!sess || Date.now() - sess.at > 10 * 60 * 1000) {
            sessions.delete(m.sender)
            return m.reply(`⚠️ ما عندكش نتائج بحث محفوظة (أو سالات 10 دقائق).\nابحث أولا: ${usedPrefix + command} <اسم الرواية>`)
        }
        const item = sess.items[parseInt(arg, 10) - 1]
        if (!item) return m.reply(`⚠️ الرقم ${arg} ما كاينش فالنتائج. شوف اللائحة ورجع اختار رقم صحيح.`)
        await m.react('⏳')
        try {
            let buf, fileName, mime
            if (item.source === 'هنداوي') {
                const pdfUrl = `https://downloads.hindawi.org/books/${item.id}.pdf`
                const epubUrl = `https://downloads.hindawi.org/books/${item.id}.epub`
                const pdfSize = await headSize(pdfUrl)
                if (pdfSize > 0 && pdfSize <= 30 * 1024 * 1024) {
                    buf = await downloadBuffer(pdfUrl); fileName = `${cleanName(item.title)}.pdf`; mime = 'application/pdf'
                } else {
                    try { buf = await downloadBuffer(epubUrl); fileName = `${cleanName(item.title)}.epub`; mime = 'application/epub+zip' }
                    catch (e) { buf = await downloadBuffer(pdfUrl); fileName = `${cleanName(item.title)}.pdf`; mime = 'application/pdf' }
                }
            } else if (item.source === 'الأرشيف') {
                const file = await archiveFile(item)
                buf = await downloadBuffer(`https://archive.org/download/${encodeURIComponent(item.id)}/${encodeURIComponent(file.name)}`)
                const ext = file.name.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf'
                fileName = `${cleanName(item.title)}.${ext}`
                mime = ext === 'epub' ? 'application/epub+zip' : 'application/pdf'
            } else {
                buf = await downloadBuffer(item.url)
                const ext = item.url.includes('.epub') ? 'epub' : item.url.includes('.pdf') ? 'pdf' : 'txt'
                fileName = `${cleanName(item.title)}.${ext}`
                mime = ext === 'pdf' ? 'application/pdf' : ext === 'epub' ? 'application/epub+zip' : 'text/plain'
            }
            await conn.sendMessage(m.chat, {
                document: buf,
                mimetype: mime,
                fileName,
                caption: `📖 *${item.title}*${item.author ? `\n✍️ ${item.author}` : ''}\n📚 المصدر: ${SOURCE_LABEL[item.source] || item.source}\n\nقراءة ممتعة! 🌙`,
            }, { quoted: m })
            await m.react('✅')
        } catch (e) {
            await m.react('❌')
            return m.reply(e.message === 'TOO_BIG'
                ? '⚠️ هاد الكتاب كبير بزاف (أكثر من 64MB) وما نقدرش نصيفطو عبر واتساب.'
                : `❌ وقع مشكل فالتحميل. عاود المحاولة.${isOwner ? `\n🔧 تفاصيل للمالك: ${e.message}` : ''}`)
        }
        return
    }

    // ---------- مساعدة ----------
    if (!arg) {
        return m.reply(
`📚 *مكتبة الروايات والكتب*

🔍 ابحث على أي رواية أو كتاب:
${usedPrefix + command} ماجدولين
${usedPrefix + command} الأجنحة المتكسرة
${usedPrefix + command} pride and prejudice

⬇️ من بعد اختار الرقم من النتائج:
${usedPrefix + command} 2

📖 الأنواع المتوفرة: روايات عربية • روايات عالمية مترجمة • روايات عالمية كلاسيكية بلغتها الأصلية
🏛️ المصادر: مؤسسة هنداوي + مكتبة الأرشيف + مشروع جوتنبرغ (كتب مجانية وقانونية)`)
    }

    // ---------- بحث ----------
    await m.react('🔍')
    const sources = [['هنداوي', searchHindawi], ['الأرشيف', searchArchive], ['جوتنبرغ', searchGutenberg]]
    const settled = await Promise.allSettled(sources.map(([, fn]) => fn(arg)))
    const items = []
    const errors = []
    let okCount = 0
    settled.forEach((r, i) => {
        if (r.status === 'fulfilled') { okCount++; items.push(...r.value) }
        else errors.push(`${sources[i][0]}: ${r.reason?.message || r.reason}`)
    })
    const merged = items.slice(0, 10)
    if (!merged.length) {
        await m.react('❌')
        if (okCount === 0) {
            return m.reply(`⚠️ المكتبات ما جاوباتش من سيرفر الاستضافة — غالبا الـ IP ديال الاستضافة محظور عند هاد المواقع (نفس مشكل إنستغرام قبل).

الأسباب المحتملة: حظر IP الاستضافة، أو انقطاع مؤقت. البديل المضمون هو تغيير الاستضافة/IP.${isOwner ? `\n\n🔧 تفاصيل للمالك:\n${errors.join('\n')}` : ''}`)
        }
        return m.reply(`😕 ما لقيت حتى كتاب بـ "${arg}" فالمكتبات المجانية.

📌 ملاحظة: البوت كيقلب غير فالكتب المجانية والقانونية (هنداوي + الأرشيف + جوتنبرغ). الكتب الحديثة التجارية — بحال "فاتتني صلاة" لإسلام جمال — محمية بحقوق النشر وما كتكونش فهاد المكتبات.

جرّب: روايات عربية كلاسيكية، روايات عالمية مترجمة، أو الاسم بالإنجليزية للكتب الأجنبية.`)
    }
    sessions.set(m.sender, { at: Date.now(), items: merged })
    const lines = merged.map((b, i) => `${i + 1}. 📖 *${b.title}*${b.author ? `\n   ✍️ ${b.author}` : ''}\n   🏛️ ${b.source}`)
    return m.reply(
`📚 *نتائج البحث على "${arg}":*

${lines.join('\n\n')}

⬇️ للتحميل صيفط: ${usedPrefix + command} <رقم>
مثال: ${usedPrefix + command} 1`)
}

handler.help = ['books']
handler.tags = ['downloader']
handler.command = ['novel', 'رواية', 'روايات', 'كتاب', 'book', 'books']
export default handler
