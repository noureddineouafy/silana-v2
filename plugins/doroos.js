// doroos.js — دروس وفروض وامتحانات المغرب + تحميل مباشر (.doroos) — v4
// .doroos بوحدها كتفتح تصفح بالقوائم: المستوى ← المادة ← النتائج،
// والأزرار عبر conn.sendButton ديال القاعدة (native flow) بحال menu.js،
// مع احتياط الأرقام النصية في كل خطوة. والبحث النصي المباشر باقي خدام.
// ─────────────────────────────────────────────────────────────────────────────
// بحث في مكتبة AlloSchool المغربية (دروس، تمارين، فروض، امتحانات
// وطنية + التصحيح) لجميع المستويات، مع تحميل الـ PDF مباشرة في واتساب:
// رد برقم النتيجة (أو اضغط زر التحميل) وكيوصلك الملف هنا.
//
//   .doroos فرض الرياضيات الأولى إعدادي
//   .doroos امتحان وطني الفيزياء 2024
//   (من بعد) رد بـ 1 أو 2 ... للتحميل
// ─────────────────────────────────────────────────────────────────────────────

const BASE = 'https://www.alloschool.com'
const MAX_RESULTS = 20
const MAX_PDF = 32 * 1024 * 1024
const SESSION_TTL = 10 * 60 * 1000

const sessions = new Map() // `${chat}|${sender}` -> { results, at }
const browse = new Map() // `${chat}|${sender}` -> { step, levelKey, at }

const LEVELS = [
    { key: 'p1', label: 'الأول ابتدائي', frag: 'الأول ابتدائي', cycle: 'prim', sec: '🎒 التعليم الابتدائي' },
    { key: 'p2', label: 'الثاني ابتدائي', frag: 'الثاني ابتدائي', cycle: 'prim', sec: '🎒 التعليم الابتدائي' },
    { key: 'p3', label: 'الثالث ابتدائي', frag: 'الثالث ابتدائي', cycle: 'prim', sec: '🎒 التعليم الابتدائي' },
    { key: 'p4', label: 'الرابع ابتدائي', frag: 'الرابع ابتدائي', cycle: 'prim', sec: '🎒 التعليم الابتدائي' },
    { key: 'p5', label: 'الخامس ابتدائي', frag: 'الخامس ابتدائي', cycle: 'prim', sec: '🎒 التعليم الابتدائي' },
    { key: 'p6', label: 'السادس ابتدائي', frag: 'السادس ابتدائي', cycle: 'prim', sec: '🎒 التعليم الابتدائي' },
    { key: 'c1', label: 'الأولى إعدادي', frag: 'أولى إعدادي', cycle: 'col', sec: '📗 التعليم الإعدادي' },
    { key: 'c2', label: 'الثانية إعدادي', frag: 'ثانية إعدادي', cycle: 'col', sec: '📗 التعليم الإعدادي' },
    { key: 'c3', label: 'الثالثة إعدادي', frag: 'ثالثة إعدادي', cycle: 'col', sec: '📗 التعليم الإعدادي' },
    { key: 'ts', label: 'الجذع المشترك', frag: 'جذع مشترك', cycle: 'lyc', sec: '🎓 التعليم الثانوي' },
    { key: 'b1', label: 'الأولى باكالوريا', frag: 'أولى باك', cycle: 'lyc', sec: '🎓 التعليم الثانوي' },
    { key: 'b2', label: 'الثانية باكالوريا', frag: 'ثانية باك', cycle: 'lyc', sec: '🎓 التعليم الثانوي' },
]

const SUBJECTS_BY_CYCLE = {
    prim: ['الرياضيات', 'اللغة العربية', 'اللغة الفرنسية', 'النشاط العلمي', 'التربية الإسلامية', 'الاجتماعيات'],
    col: ['الرياضيات', 'الفيزياء والكيمياء', 'علوم الحياة والأرض', 'اللغة العربية', 'اللغة الفرنسية', 'اللغة الإنجليزية', 'التاريخ والجغرافيا', 'التربية الإسلامية', 'المعلوميات'],
    lyc: ['الرياضيات', 'الفيزياء والكيمياء', 'علوم الحياة والأرض', 'الفلسفة', 'اللغة العربية', 'اللغة الفرنسية', 'اللغة الإنجليزية', 'التاريخ والجغرافيا', 'التربية الإسلامية', 'المعلوميات'],
}

const norm = s => (s || '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

function parseElements(html) {
    const out = []
    const seen = new Set()
    const re = /href="https:\/\/www\.alloschool\.com\/element\/(\d+)"[^>]*>\s*([^<]{4,160}?)\s*<\/a>/g
    let mm
    while ((mm = re.exec(html)) !== null) {
        const title = mm[2].replace(/\s+/g, ' ').trim()
        if (!title || seen.has(mm[1])) continue
        seen.add(mm[1])
        out.push({ id: mm[1], title, url: `${BASE}/element/${mm[1]}` })
    }
    return out
}

// بحث الموقع كيخدم بكلمات قصيرة (المادة) — العبارات الطويلة كترجع خاوية
const SUBJECTS = [
    'الفيزياء والكيمياء', 'علوم الحياة والأرض', 'التاريخ والجغرافيا', 'اللغة الفرنسية',
    'اللغة الإنجليزية', 'اللغة العربية', 'التربية الإسلامية', 'الرياضيات', 'الفلسفة',
    'الاجتماعيات', 'المعلوميات', 'الفيزياء', 'الكيمياء', 'الفرنسية', 'الإنجليزية',
    'العربية', 'الجغرافيا', 'التاريخ', 'النشاط العلمي', 'التربية البدنية',
]

function pickSubject(query) {
    const nq = norm(query)
    let best = null
    for (const s of SUBJECTS) if (nq.includes(norm(s)) && (!best || s.length > best.length)) best = s
    return best
}

async function fetchText(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
}

async function searchAllo(query) {
    return parseElements(await fetchText(`${BASE}/search?q=${encodeURIComponent(query)}`))
}

async function searchSmart(query) {
    const subject = pickSubject(query)
    if (subject) {
        const els = await searchAllo(subject)
        if (els.length) return els
    }
    return searchAllo(query)
}

function getSession(m) {
    const key = `${m.chat}|${m.sender}`
    const s = sessions.get(key)
    if (!s || Date.now() - s.at > SESSION_TTL) { sessions.delete(key); return null }
    return s
}

// تحميل عنصر: صفحة العنصر → رابط PDF المباشر → إرسال كوثيقة
async function deliverElement(conn, m, el) {
    await conn.reply(m.chat, `📥 كنحمل ليك:\n*${el.title}*\n⏳ ثواني…`, m)
    const html = await fetchText(el.url)
    const pdfMatch = html.match(/href="(https:\/\/www\.alloschool\.com\/assets\/documents\/[^"]+\.pdf)"/)
    if (!pdfMatch) {
        return conn.reply(m.chat,
            `📄 هاد العنصر ما فيهش PDF مباشر — تقدر تفتحو من الموقع:\n${el.url}`, m)
    }
    const pdfUrl = pdfMatch[1]
    const res = await fetch(pdfUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(120000),
    })
    if (!res.ok) throw new Error(`pdf HTTP ${res.status}`)
    const len = parseInt(res.headers.get('content-length') || '0')
    if (len > MAX_PDF) {
        return conn.reply(m.chat,
            `📄 الملف كبير بزاف (${(len / 1048576).toFixed(1)}MB) — حملو من الموقع:\n${el.url}`, m)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_PDF) {
        return conn.reply(m.chat, `📄 الملف كبير بزاف — حملو من الموقع:\n${el.url}`, m)
    }
    const fileName = el.title.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').slice(0, 80).trim() + '.pdf'
    await conn.sendMessage(m.chat, {
        document: buf,
        mimetype: 'application/pdf',
        fileName,
        caption: `📚 ${el.title}\n⚡ SILANA AI`,
    }, { quoted: m })
}

function getBrowse(m) {
    const key = `${m.chat}|${m.sender}`
    const b = browse.get(key)
    if (!b || Date.now() - b.at > SESSION_TTL) { browse.delete(key); return null }
    return b
}

// إرسال رسالة بقائمة اختيار (native flow) مع احتياط نصي مرقم
async function sendList(conn, m, body, buttonTitle, sections) {
    if (typeof conn.sendButton === 'function') {
        try {
            await conn.sendButton(m.chat, {
                text: body,
                footer: 'AlloSchool • SILANA AI',
                buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: buttonTitle, sections }) }],
            }, { quoted: m })
            return true
        } catch {}
    }
    await conn.reply(m.chat, body, m)
    return false
}

async function sendLevels(conn, m, usedPrefix) {
    browse.set(`${m.chat}|${m.sender}`, { step: 'level', at: Date.now() })
    const bySec = {}
    LEVELS.forEach((lv, i) => { (bySec[lv.sec] = bySec[lv.sec] || []).push({ lv, i }) })
    const sections = Object.entries(bySec).map(([sec, items]) => ({
        title: sec,
        rows: items.map(({ lv, i }) => ({ title: lv.label, description: 'اضغط لاختيار المواد', id: `${usedPrefix}doroosgo lv ${lv.key}` })),
    }))
    const body =
        `📚 *دروس وفروض وامتحانات المغرب*\n\n` +
        `اختار *المستوى* ديالك من القائمة 👇\n\n` +
        LEVELS.map((lv, i) => `${i + 1}. ${lv.label}`).join('\n') +
        `\n\nولا قلب مباشرة: ${usedPrefix}doroos فرض الرياضيات الأولى إعدادي`
    await sendList(conn, m, body, '🎓 اختر المستوى', sections)
}

async function sendSubjects(conn, m, usedPrefix, level) {
    browse.set(`${m.chat}|${m.sender}`, { step: 'subject', levelKey: level.key, at: Date.now() })
    const subjects = SUBJECTS_BY_CYCLE[level.cycle]
    const sections = [{
        title: `مواد ${level.label}`,
        rows: subjects.map((s, i) => ({ title: s, description: 'اضغط لعرض الدروس والفروض', id: `${usedPrefix}doroosgo sub ${level.key} ${i}` })),
    }]
    const body =
        `📚 *${level.label}* — اختار *المادة* 👇\n\n` +
        subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')
    await sendList(conn, m, body, '📖 اختر المادة', sections)
}

async function runSearch(conn, m, usedPrefix, query) {
    await conn.reply(m.chat, `📚 كنقلب ليك على «${query}»… ⏳`, m)
    const all = await searchSmart(query)
    if (!all.length) {
        return conn.reply(m.chat,
            `😕 ما لقيت حتى نتيجة لـ «${query}».\n` +
            `جرب غير المادة بوحدها، أو بدل الصياغة (مثال: «الفيزياء والكيمياء» بدل «الفيزياء»).`, m)
    }
    const tokens = norm(query).split(' ').filter(w => w.length > 1)
    const scored = all.map(el => {
        const t = norm(el.title)
        let score = 0
        for (const tok of tokens) if (t.includes(tok)) score++
        return { el, score }
    }).filter(x => tokens.length < 2 || x.score >= Math.min(2, tokens.length))
    scored.sort((a, b) => b.score - a.score)
    const top = (scored.length ? scored : all.map(el => ({ el, score: 0 }))).slice(0, MAX_RESULTS).map(x => x.el)

    sessions.set(`${m.chat}|${m.sender}`, { results: top, at: Date.now() })
    browse.delete(`${m.chat}|${m.sender}`)

    const body =
        `📚 *نتائج «${query}»* (${all.length} نتيجة — هاهوما الأقرب):\n\n` +
        top.map((el, i) => `${i + 1}. ${el.title}`).join('\n') +
        `\n\n📥 *للتحميل:* اضغط زر «تحميل درس» واختار، أو رد برقم الدرس.`
    const mkRow = (el, i) => ({
        title: el.title.slice(0, 24),
        description: '📄 PDF — اضغط للتحميل',
        id: `${usedPrefix}doroosdl ${i + 1}`,
    })
    const sections = [{ title: 'اختر الدرس للتحميل (1-10)', rows: top.slice(0, 10).map(mkRow) }]
    if (top.length > 10) sections.push({ title: 'المزيد (11-20)', rows: top.slice(10).map((el, j) => mkRow(el, j + 10)) })
    await sendList(conn, m, body, '📥 تحميل درس', sections)
}

let handler = async (m, { conn, text, args, usedPrefix, command }) => {
    const query = (text || '').trim()
    try {

    // تنقل بالقوائم: .doroosgo lv <key> | .doroosgo sub <key> <idx>
    if (command === 'doroosgo') {
        if (args[0] === 'lv') {
            const level = LEVELS.find(l => l.key === args[1])
            if (level) return await sendSubjects(conn, m, usedPrefix, level)
        }
        if (args[0] === 'sub') {
            const level = LEVELS.find(l => l.key === args[1])
            const subject = level && SUBJECTS_BY_CYCLE[level.cycle][parseInt(args[2])]
            if (level && subject) return await runSearch(conn, m, usedPrefix, `${subject} ${level.frag}`)
        }
        return await sendLevels(conn, m, usedPrefix)
    }

    // تحميل من قائمة النتائج: .doroosdl <رقم>
    if (command === 'doroosdl') {
        const n = parseInt(args[0]) || parseInt(query)
        const s = getSession(m)
        if (!s) return conn.reply(m.chat, '⌛ الجلسة سالات — عاود البحث بـ .doroos', m)
        const el = s.results[n - 1]
        if (!el) return conn.reply(m.chat, '⚠️ الرقم ما كاينش في النتائج.', m)
        try { await deliverElement(conn, m, el) }
        catch (e) { return conn.reply(m.chat, '❌ فشل التحميل.\n🔧 تفاصيل للمالك: ' + String(e.message || e).slice(0, 200), m) }
        return
    }

    // اختيار برقم: كيتبع سياق التصفح إلا كان، وإلا فهو رقم نتيجة
    if (/^\d+$/.test(query)) {
        const n = parseInt(query)
        const b = getBrowse(m)
        if (b && b.step === 'level') {
            const level = LEVELS[n - 1]
            if (level) return await sendSubjects(conn, m, usedPrefix, level)
        }
        if (b && b.step === 'subject') {
            const level = LEVELS.find(l => l.key === b.levelKey)
            const subject = level && SUBJECTS_BY_CYCLE[level.cycle][n - 1]
            if (level && subject) return await runSearch(conn, m, usedPrefix, `${subject} ${level.frag}`)
        }
        const s = getSession(m)
        if (s) {
            const el = s.results[n - 1]
            if (el) {
                try { await deliverElement(conn, m, el) }
                catch (e) { return conn.reply(m.chat, '❌ فشل التحميل.\n🔧 تفاصيل للمالك: ' + String(e.message || e).slice(0, 200), m) }
                return
            }
        }
    }

    // بلا بحث: قائمة المستويات
    if (!query || query.length < 2) return await sendLevels(conn, m, usedPrefix)

    // بحث نصي مباشر
    return await runSearch(conn, m, usedPrefix, query)

    } catch (e) {
        return conn.reply(m.chat,
            '❌ وقع مشكل.\n🔧 تفاصيل للمالك: ' + String(e.message || e).slice(0, 200), m)
    }
}

handler.help = ['doroos']
handler.tags = ['morocco']
handler.command = /^(doroos|دروس|فروض|دراسة|doroosdl|doroosgo)$/i
handler.limit = false

export default handler
          
