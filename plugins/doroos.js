// doroos.js — دروس وفروض وامتحانات المغرب + تحميل مباشر (.doroos) — v7
// v7: التصفح ولّى: المستوى ← المادة ← النوع (الدروس / التمارين /
// الامتحانات والفروض / الكل) ← النتائج — المستعمل كيختار النوع قبل
// ما يشوف النتائج، والأعداد في قائمة الأنواع حقيقية من نفس البيانات.
// .doroos بوحدها كتفتح تصفح بالقوائم: المستوى ← المادة ← النتائج،
// والأزرار عبر conn.sendButton ديال القاعدة (native flow) بحال menu.js،
// مع احتياط الأرقام النصية في كل خطوة. والبحث النصي المباشر باقي خدام.
// v5/v6: النتائج كتوصل كبطاقة AIRich غنية (نص منسق + جدول + مصادر)
// — نفس بروتوكول ردود Meta AI — وقائمة sendButton للتحميل كترافقها
// (اقتراحات AIRich لا تعمل خارج محادثات Meta AI). للمالك: .doroos rich on|off
// ─────────────────────────────────────────────────────────────────────────────
// بحث في مكتبة AlloSchool المغربية (دروس، تمارين، فروض، امتحانات
// وطنية + التصحيح) لجميع المستويات، مع تحميل الـ PDF مباشرة في واتساب:
// رد برقم النتيجة (أو اضغط زر التحميل) وكيوصلك الملف هنا.
//
//   .doroos فرض الرياضيات الأولى إعدادي
//   .doroos امتحان وطني الفيزياء 2024
//   (من بعد) رد بـ 1 أو 2 ... للتحميل
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID, randomBytes } from 'crypto'

const BASE = 'https://www.alloschool.com'
const MAX_RESULTS = 20
const MAX_PDF = 32 * 1024 * 1024
const SESSION_TTL = 10 * 60 * 1000

const sessions = new Map() // `${chat}|${sender}` -> { results, at }
const browse = new Map() // `${chat}|${sender}` -> { step, levelKey, subject, at }
const pools = new Map() // `${chat}|${sender}` -> { buckets, all, levelKey, subject, at }

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

// ─── v7: أنواع المحتوى ────────────────────────────────────────────────
// التصنيف من عنوان العنصر في AlloSchool: الامتحانات والفروض عندها
// كلمات صريحة، التمارين حتى هي، والباقي (مواضيع الدروس والملخصات
// والجذاذات) كيتحسب دروس.
const CATS = [
    { key: 'lessons', label: 'الدروس', icon: '📚' },
    { key: 'exercises', label: 'التمارين', icon: '✏️' },
    { key: 'exams', label: 'الامتحانات والفروض', icon: '📝' },
    { key: 'all', label: 'الكل (مختلط)', icon: '🌐' },
]

function classify(title) {
    const n = norm(title)
    if (/امتحان|فرض|اختبار|مراقبه|مباراه|اولمبياد/.test(n)) return 'exams'
    if (/تمارين|تمرين|سلسله|تدريب/.test(n)) return 'exercises'
    return 'lessons'
}

function scoreByTokens(els, tokens) {
    const scored = els.map(el => {
        const t = norm(el.title)
        let s = 0
        for (const tok of tokens) if (t.includes(tok)) s++
        return { el, s }
    }).filter(x => tokens.length < 2 || x.s >= Math.min(2, tokens.length))
    scored.sort((a, b) => b.s - a.s)
    return scored.length ? scored.map(x => x.el) : els
}

// كيبني مكتبة (مادة + مستوى) مصنفة حسب النوع، من نفس محرك بحث v6.
// التمارين كتتعزز ببحوث عبارات إضافية إلا كانت قليلة في المكتبة،
// حيت AlloSchool كيخزن السلاسل الحقيقية تحت عناوين «سلسلة تمارين…».
async function buildPool(subject, level) {
    const query = `${subject} ${level.frag}`
    const tokens = norm(query).split(' ').filter(w => w.length > 1)
    const ranked = scoreByTokens(await searchSmart(query), tokens).slice(0, 300)
    const buckets = { lessons: [], exercises: [], exams: [] }
    for (const el of ranked) buckets[classify(el.title)].push(el)
    if (buckets.exercises.length < 8) {
        const seen = new Set(ranked.map(e => e.id))
        for (const q of [`تمارين ${subject}`, `سلسلة تمارين ${subject}`, `تمارين محلولة ${subject}`]) {
            try {
                for (const el of scoreByTokens(await searchAllo(q), tokens)) {
                    if (seen.has(el.id) || classify(el.title) !== 'exercises') continue
                    seen.add(el.id)
                    buckets.exercises.push(el)
                    if (buckets.exercises.length >= 40) break
                }
            } catch {}
            if (buckets.exercises.length >= 20) break
        }
    }
    return { buckets, all: ranked }
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

// ─── AIRich: بطاقة غنية ببروتوكول ردود Meta AI (unified response) ───
// البنية مطابقة لما كيولدو Baileys forks المعروفة (JAPofc AIRich):
// botForwardedMessage.richResponseMessage + sections بلا GenAI types،
// وشهادات/توقيع verificationMetadata عشوائية الشكل (العميل لا يتحقق منها).
function _cert(len) {
    const b = randomBytes(len)
    b[0] = 48; b[1] = 130
    return b
}
function _layout(name, data, extra) {
    return {
        ...(extra || {}),
        view_model: {
            [Array.isArray(data) ? 'primitives' : 'primitive']: data,
            __typename: `GenAI${name}LayoutViewModel`,
        },
    }
}

function richEnabled() {
    try { return global.db.data.settings.doroosRich !== false } catch { return true }
}

async function sendRichResults(conn, m, usedPrefix, query, top, total) {
    if (typeof conn.relayMessage !== 'function') throw new Error('rich: relayMessage غير متوفر')
    const intro = `**نتائج «${query}»** 📚\nلقيت ${total} نتيجة في AlloSchool — هاهوما الأقرب ليك (الجدول في «See details»). قائمة التحميل في الرسالة اللي تحت 👇`
    const header = ['#', 'الدرس']
    const rows = top.map((el, i) => [String(i + 1), el.title.length > 44 ? el.title.slice(0, 44) + '…' : el.title])
    const unifiedRows = [
        { is_header: true, cells: header },
        ...rows.map(r => ({ is_header: false, cells: r })),
    ]
    const sections = [
        _layout('Single', { text: intro, __typename: 'GenAIMarkdownTextUXPrimitive' }),
        _layout('Single', { rows: unifiedRows, __typename: 'GenAITableUXPrimitive' }),
        _layout('Single', {
            sources: [{
                source_type: 'THIRD_PARTY',
                source_display_name: 'AlloSchool',
                source_subtitle: 'alloschool.com',
                source_url: BASE,
                favicon: { url: BASE + '/favicon.ico', mime_type: 'image/jpeg', width: 16, height: 16 },
            }],
            __typename: 'GenAISearchResultPrimitive',
        }),
        // ملاحظة: اقتراحات FollowUpSuggestion ديال AIRich ما كتخدمش خارج
        // محادثات Meta AI (الضغط عليها ما كيرسل والو) — بلا بيها هنا،
        // والتحميل كيتم بقائمة sendButton العادية اللي كترسل مع البطاقة.
    ]
    const responseId = randomUUID()
    const msg = {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: 'SILANA AI • دروس وفروض المغرب',
                richResponseSourcesMetadata: { sources: [] },
                botResponseId: responseId,
                verificationMetadata: {
                    proofs: [{
                        certificateChain: [_cert(685), _cert(892)],
                        version: 1,
                        useCase: 1,
                        signature: randomBytes(64),
                    }],
                },
            },
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [
                        { messageType: 2, messageText: intro.replace(/\*\*/g, '') },
                        {
                            messageType: 4,
                            tableMetadata: {
                                title: '',
                                rows: [
                                    { items: header, isHeading: true },
                                    ...rows.map(r => ({ items: r })),
                                ],
                            },
                        },
                    ],
                    unifiedResponse: {
                        data: Buffer.from(JSON.stringify({ response_id: responseId, sections })).toString('base64'),
                    },
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 1,
                        forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
                        forwardOrigin: 4,
                    },
                },
            },
        },
    }
    const messageId = randomBytes(16).toString('hex').toUpperCase()
    await conn.relayMessage(m.chat, msg, { messageId })
    return true
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
        rows: subjects.map((s, i) => ({ title: s, description: 'اضغط لاختيار النوع', id: `${usedPrefix}doroosgo sub ${level.key} ${i}` })),
    }]
    const body =
        `📚 *${level.label}* — اختار *المادة* 👇\n\n` +
        subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')
    await sendList(conn, m, body, '📖 اختر المادة', sections)
}

// v7: خطوة اختيار النوع — كتبني المكتبة المصنفة وكتوري الأعداد الحقيقية
async function sendCategories(conn, m, usedPrefix, level, subIdx) {
    const subject = SUBJECTS_BY_CYCLE[level.cycle][subIdx]
    await conn.reply(m.chat, `📚 *${subject}* — ${level.label}\nكنجمع ليك الدروس والتمارين والامتحانات… ⏳`, m)
    let pool = null
    try { pool = await buildPool(subject, level) } catch {}
    if (!pool) return await runSearch(conn, m, usedPrefix, `${subject} ${level.frag}`)
    const key = `${m.chat}|${m.sender}`
    pools.set(key, { ...pool, levelKey: level.key, subject, at: Date.now() })
    browse.set(key, { step: 'cat', levelKey: level.key, subject, at: Date.now() })
    const counts = {
        lessons: pool.buckets.lessons.length,
        exercises: pool.buckets.exercises.length,
        exams: pool.buckets.exams.length,
        all: pool.all.length,
    }
    const sections = [{
        title: `${subject} — ${level.label}`,
        rows: CATS.map(c => ({
            title: `${c.icon} ${c.label}`,
            description: `${counts[c.key]} نتيجة — اضغط للعرض`,
            id: `${usedPrefix}doroosgo cat ${level.key} ${subIdx} ${c.key}`,
        })),
    }]
    const body =
        `📚 *${subject}* — ${level.label}\n\n` +
        `شنو بغيتي؟ اختار *النوع* 👇\n\n` +
        CATS.map((c, i) => `${i + 1}. ${c.icon} ${c.label} (${counts[c.key]})`).join('\n')
    await sendList(conn, m, body, '🗂️ اختر النوع', sections)
}

// v7: عرض نتائج نوع واحد من المكتبة المصنفة
async function runCategory(conn, m, usedPrefix, level, subject, catKey) {
    const key = `${m.chat}|${m.sender}`
    let p = pools.get(key)
    if (!p || Date.now() - p.at > SESSION_TTL || p.levelKey !== level.key || p.subject !== subject) {
        try { p = { ...(await buildPool(subject, level)), levelKey: level.key, subject, at: Date.now() }; pools.set(key, p) }
        catch { return await runSearch(conn, m, usedPrefix, `${subject} ${level.frag}`) }
    }
    const cat = CATS.find(c => c.key === catKey) || CATS[3]
    const list = cat.key === 'all' ? p.all : p.buckets[cat.key]
    if (!list.length) {
        browse.set(key, { step: 'cat', levelKey: level.key, subject, at: Date.now() })
        return conn.reply(m.chat,
            `😕 ما لقيت حتى نتيجة في *${cat.label}* لـ${subject} (${level.label}) في فهرس AlloSchool.\n` +
            `جرب نوع آخر بالأرقام 1-4، أو رجع للمادة بـ .doroos`, m)
    }
    const label = `${subject} — ${level.label} — ${cat.label}`
    return await presentResults(conn, m, usedPrefix, label, list.slice(0, MAX_RESULTS), list.length)
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
    const top = scoreByTokens(all, tokens).slice(0, MAX_RESULTS)
    return await presentResults(conn, m, usedPrefix, query, top, all.length)
}

async function presentResults(conn, m, usedPrefix, query, top, total) {
    sessions.set(`${m.chat}|${m.sender}`, { results: top, at: Date.now() })
    browse.delete(`${m.chat}|${m.sender}`)

    const body =
        `📚 *نتائج «${query}»* (${total} نتيجة — هاهوما الأقرب):\n\n` +
        top.map((el, i) => `${i + 1}. ${el.title}`).join('\n') +
        `\n\n📥 *للتحميل:* اضغط زر «تحميل درس» واختار، أو رد برقم الدرس.`
    const mkRow = (el, i) => ({
        title: el.title.slice(0, 24),
        description: '📄 PDF — اضغط للتحميل',
        id: `${usedPrefix}doroosdl ${i + 1}`,
    })
    const sections = [{ title: 'اختر الدرس للتحميل (1-10)', rows: top.slice(0, 10).map(mkRow) }]
    if (top.length > 10) sections.push({ title: 'المزيد (11-20)', rows: top.slice(10).map((el, j) => mkRow(el, j + 10)) })
    // v6: بطاقة AIRich للعرض (جدول+مصادر) + قائمة التحميل العادية معها،
    // لأن اقتراحات AIRich لا تعمل خارج محادثات Meta AI. إلا فشلت البطاقة
    // كترجع القائمة بوحدها بالنص الكامل.
    let richOk = false
    if (richEnabled()) {
        try { await sendRichResults(conn, m, usedPrefix, query, top, total); richOk = true } catch {}
    }
    if (richOk) {
        await sendList(conn, m, '📥 *للتحميل:* اختار الدرس من القائمة، أو رد برقمو.', '📥 تحميل درس', sections)
    } else {
        await sendList(conn, m, body, '📥 تحميل درس', sections)
    }
}

let handler = async (m, { conn, text, args, usedPrefix, command, isOwner }) => {
    const query = (text || '').trim()
    try {

    // للمالك: تشغيل/إيقاف بطاقة AIRich
    if (command === 'doroos' && args[0] === 'rich' && (args[1] === 'on' || args[1] === 'off')) {
        if (!isOwner) return conn.reply(m.chat, '🔒 هاد الأمر للمالك فقط.', m)
        global.db.data.settings.doroosRich = args[1] === 'on'
        return conn.reply(m.chat, `🎴 بطاقة AIRich للنتائج: *${args[1] === 'on' ? 'مشغلة' : 'موقفة'}*`, m)
    }

    // تنقل بالقوائم: .doroosgo lv <key> | .doroosgo sub <key> <idx>
    if (command === 'doroosgo') {
        if (args[0] === 'lv') {
            const level = LEVELS.find(l => l.key === args[1])
            if (level) return await sendSubjects(conn, m, usedPrefix, level)
        }
        if (args[0] === 'sub') {
            const level = LEVELS.find(l => l.key === args[1])
            const subject = level && SUBJECTS_BY_CYCLE[level.cycle][parseInt(args[2])]
            if (level && subject) return await sendCategories(conn, m, usedPrefix, level, parseInt(args[2]))
        }
        if (args[0] === 'cat') {
            const level = LEVELS.find(l => l.key === args[1])
            const subject = level && SUBJECTS_BY_CYCLE[level.cycle][parseInt(args[2])]
            if (level && subject) return await runCategory(conn, m, usedPrefix, level, subject, args[3])
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
            if (level && subject) return await sendCategories(conn, m, usedPrefix, level, n - 1)
        }
        if (b && b.step === 'cat') {
            const level = LEVELS.find(l => l.key === b.levelKey)
            const cat = CATS[n - 1]
            if (level && b.subject && cat) return await runCategory(conn, m, usedPrefix, level, b.subject, cat.key)
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
handler.tags = ['search', 'tools']
handler.command = /^(doroos|دروس|فروض|دراسة|doroosdl|doroosgo)$/i
handler.limit = false

export default handler
