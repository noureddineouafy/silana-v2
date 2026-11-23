// plugins/rentcontract.js — مولّد عقد كراء مغربي (.rentcontract) — v2: النتيجة PDF
// جلسة موجّهة: البوت كيسول سؤال بسؤال، وفي الأخير كيولّد عقد كراء كامل
// كنص في المحادثة + ملف PDF واجد للطباعة (محرك PDF مكتوب من الصفر في نفس الملف،
// بلا حتى مكتبة خارجية: تشكيل عربي + تضمين خط نَسخ).
// الخط: كيتلقى في النظام ولا كيتحمّل مرة وحدة وكيتحفظ في الكاش.
// إلا فشل الـPDF لأي سبب، كيوصلك العقد .txt كيفما كان في v1 — النتيجة ما كتضيعش.
// نموذج استرشادي فقط — ماشي بديل على التوثيق الرسمي ولا استشارة قانونية.

import fs from 'fs'
import path from 'path'

const TTL = 15 * 60 * 1000
const sessions = new Map()

function getSession(sender) {
    const s = sessions.get(sender)
    if (!s) return null
    if (Date.now() - s.at > TTL) { sessions.delete(sender); return null }
    return s
}

function isStopWord(t) {
    const x = String(t || '').trim().toLowerCase()
    return x === 'stop' || x === 'cancel' || x === 'إلغاء' || x === 'الغاء' || x === 'وقف' || x === 'حبس'
}
function isSkipWord(t) {
    const x = String(t || '').trim().toLowerCase()
    return x === '-' || x === 'تخطي' || x === 'skip' || x === 'لا' || x === 'بدون'
}

const STEPS = [
    {
        key: 'type', label: 'نوع العقد',
        ask: '📋 *الخطوة 1/11 — نوع العقد*\nجاوب بـ *1* للسكني ولا *2* للتجاري:',
        parse: function (v) {
            const x = v.trim()
            if (x === '1' || x.indexOf('سكن') !== -1) return 'سكني'
            if (x === '2' || x.indexOf('تجار') !== -1) return 'تجاري'
            return null
        },
        err: '⚠️ جاوب بـ 1 (سكني) ولا 2 (تجاري).'
    },
    {
        key: 'landlord', label: 'اسم المالك',
        ask: '👤 *الخطوة 2/11 — اسم المالك (المُكري)*\nالاسم الكامل كما هو في بطاقة التعريف:',
        parse: function (v) { const x = v.trim(); return x.length >= 3 && x.length <= 80 ? x : null },
        err: '⚠️ الاسم قصير بزاف ولا طويل — عاود كتب الاسم الكامل.'
    },
    {
        key: 'landlordCin', label: 'بطاقة المالك', optional: true,
        ask: '🪪 *الخطوة 3/11 — رقم بطاقة تعريف المالك* (اختياري)\nكتب الرقم، ولا «تخطي»:',
        parse: function (v) { const x = v.trim(); return x.length <= 20 ? x : null },
        err: '⚠️ الرقم طويل بزاف — عاود ولا كتب «تخطي».'
    },
    {
        key: 'tenant', label: 'اسم المستأجر',
        ask: '👤 *الخطوة 4/11 — اسم المستأجر (المكتري)*\nالاسم الكامل كما هو في بطاقة التعريف:',
        parse: function (v) { const x = v.trim(); return x.length >= 3 && x.length <= 80 ? x : null },
        err: '⚠️ الاسم قصير بزاف ولا طويل — عاود كتب الاسم الكامل.'
    },
    {
        key: 'tenantCin', label: 'بطاقة المستأجر', optional: true,
        ask: '🪪 *الخطوة 5/11 — رقم بطاقة تعريف المستأجر* (اختياري)\nكتب الرقم، ولا «تخطي»:',
        parse: function (v) { const x = v.trim(); return x.length <= 20 ? x : null },
        err: '⚠️ الرقم طويل بزاف — عاود ولا كتب «تخطي».'
    },
    {
        key: 'address', label: 'عنوان العقار',
        ask: '🏠 *الخطوة 6/11 — عنوان العقار*\nالمدينة + الحي + الزنقة/الشارع + رقم العمارة/الدار:',
        parse: function (v) { const x = v.trim(); return x.length >= 8 && x.length <= 200 ? x : null },
        err: '⚠️ العنوان ناقص — كتب المدينة والحي والشارع.'
    },
    {
        key: 'desc', label: 'وصف العقار',
        ask: '📝 *الخطوة 7/11 — وصف العقار*\nمثال: شقة من غرفتين وصالة ومطبخ وحمام، في الطابق الثاني:',
        parse: function (v) { const x = v.trim(); return x.length >= 5 && x.length <= 300 ? x : null },
        err: '⚠️ الوصف قصير بزاف — وصف العقار شوية (النوع + المرافق).'
    },
    {
        key: 'rent', label: 'الكراء الشهري',
        ask: '💰 *الخطوة 8/11 — مبلغ الكراء الشهري (بالدرهم)*\nكتب غير الرقم، مثال: 2500',
        parse: function (v) {
            const n = parseFloat(v.replace(/[^0-9.]/g, ''))
            return isFinite(n) && n > 0 && n <= 10000000 ? n : null
        },
        err: '⚠️ خاص رقم صحيح أكبر من 0 — مثال: 2500'
    },
    {
        key: 'deposit', label: 'مبلغ الضمان',
        ask: '🔐 *الخطوة 9/11 — مبلغ الضمان/التسبيق (بالدرهم)*\nكتب الرقم، ولا 0 إلا ما كاين حتى ضمان:',
        parse: function (v) {
            const n = parseFloat(v.replace(/[^0-9.]/g, ''))
            return isFinite(n) && n >= 0 && n <= 10000000 ? n : null
        },
        err: '⚠️ خاص رقم (0 مسموح) — مثال: 5000'
    },
    {
        key: 'start', label: 'تاريخ البداية',
        ask: '📅 *الخطوة 10/11 — تاريخ بداية الكراء*\nبصيغة يوم/شهر/سنة، مثال: 01/12/2026',
        parse: function (v) {
            const x = v.trim()
            const mt = x.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
            if (!mt) return null
            const d = parseInt(mt[1], 10), mo = parseInt(mt[2], 10)
            if (d < 1 || d > 31 || mo < 1 || mo > 12) return null
            return (d < 10 ? '0' + d : '' + d) + '/' + (mo < 10 ? '0' + mo : '' + mo) + '/' + mt[3]
        },
        err: '⚠️ التاريخ خاصو يكون بصيغة يوم/شهر/سنة — مثال: 01/12/2026'
    },
    {
        key: 'months', label: 'المدة بالأشهر',
        ask: '⏳ *الخطوة 11/11 — مدة العقد بالأشهر*\nكتب غير الرقم، مثال: 12',
        parse: function (v) {
            const n = parseInt(v.replace(/[^0-9]/g, ''), 10)
            return isFinite(n) && n >= 1 && n <= 600 ? n : null
        },
        err: '⚠️ خاص رقم بين 1 و600 — مثال: 12'
    }
]

function fmtNum(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function buildContract(d) {
    const today = new Date()
    const todayStr = (today.getDate() < 10 ? '0' + today.getDate() : '' + today.getDate()) + '/' +
        ((today.getMonth() + 1) < 10 ? '0' + (today.getMonth() + 1) : '' + (today.getMonth() + 1)) + '/' + today.getFullYear()
    const cinL = d.landlordCin ? '، الحامل لبطاقة التعريف الوطنية رقم: ' + d.landlordCin : ''
    const cinT = d.tenantCin ? '، الحامل لبطاقة التعريف الوطنية رقم: ' + d.tenantCin : ''
    const lines = []
    lines.push('عقد كراء ' + d.type)
    lines.push('━━━━━━━━━━━━━━━━━━')
    lines.push('')
    lines.push('تم تحرير هذا العقد بتاريخ: ' + todayStr)
    lines.push('')
    lines.push('بين الموقعين أسفله:')
    lines.push('')
    lines.push('الطرف الأول (المُكري): السيد/ة ' + d.landlord + cinL)
    lines.push('الطرف الثاني (المكتري): السيد/ة ' + d.tenant + cinT)
    lines.push('')
    lines.push('وقد اتفق الطرفان على ما يلي:')
    lines.push('')
    lines.push('المادة 1 — موضوع العقد:')
    lines.push('يُكري الطرف الأول للطرف الثاني العقار التالي: ' + d.desc + '، الكائن بـ: ' + d.address + '، وذلك لغرض ' + (d.type === 'تجاري' ? 'تجاري' : 'السكنى') + ' فقط.')
    lines.push('')
    lines.push('المادة 2 — المدة:')
    lines.push('يبدأ هذا العقد من تاريخ ' + d.start + ' ويمتد لمدة ' + d.months + ' شهراً، ويُجدَّد باتفاق الطرفين كتابةً.')
    lines.push('')
    lines.push('المادة 3 — ثمن الكراء:')
    lines.push('حدد الطرفان ثمن الكراء الشهري في مبلغ ' + fmtNum(d.rent) + ' درهم (' + d.rent + ' DH)، يُؤدَّى في أجل أقصاه اليوم الخامس من كل شهر.')
    lines.push('')
    lines.push('المادة 4 — الضمان:')
    if (d.deposit > 0) {
        lines.push('سلّم المكتري للمُكري مبلغ ' + fmtNum(d.deposit) + ' درهم (' + d.deposit + ' DH) كضمان، يُرجَع إليه عند انتهاء العقد وتسليم العقار على الحالة المتفق عليها، بعد خصم ما قد يكون مستحقاً.')
    } else {
        lines.push('اتفق الطرفان على عدم اشتراط أي مبلغ ضمان في هذا العقد.')
    }
    lines.push('')
    lines.push('المادة 5 — التزامات المكتري:')
    lines.push('— استعمال العقار للغرض المتفق عليه فقط، والمحافظة عليه وصيانته.')
    lines.push('— أداء فواتير الماء والكهرباء والخدمات المرتبطة بالعقار طيلة مدة الكراء.')
    lines.push('— عدم إحداث أي تغيير أو بناء داخل العقار دون موافقة كتابية من المُكري.')
    lines.push('— عدم كراء العقار للغير أو التنازل عنه دون موافقة كتابية من المُكري.')
    lines.push('')
    lines.push('المادة 6 — التزامات المُكري:')
    lines.push('— تسليم العقار في حالة صالحة للاستعمال المتفق عليه.')
    lines.push('— ضمان انتفاع المكتري بالعقار دون تعرّض طيلة مدة العقد.')
    lines.push('— القيام بالإصلاحات الكبرى التي لا تعود إلى استعمال المكتري.')
    lines.push('')
    lines.push('المادة 7 — الفسخ:')
    lines.push('في حالة إخلال أحد الطرفين بالتزاماته، يحق للطرف الآخر طلب فسخ العقد بعد إشعار كتابي قبل شهر على الأقل، مع مراعاة المقتضيات القانونية الجاري بها العمل.')
    lines.push('')
    lines.push('المادة 8 — أحكام عامة:')
    lines.push('حُرّر هذا العقد في نظيرين، تسلّم كل طرف نسخة منه، ويخضع في تفسيره وتنفيذه للقانون المغربي.')
    lines.push('')
    lines.push('إمضاء المُكري: ' + d.landlord)
    lines.push('')
    lines.push('إمضاء المكتري: ' + d.tenant)
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━')
    lines.push('نموذج مولّد آلياً بواسطة بوت سيلانا — استرشادي فقط، ويُنصح بمراجعته لدى مختص أو توثيقه رسمياً قبل الاعتماد عليه.')
    return lines.join('\n')
}

function chunkText(t, size) {
    const out = []
    let rest = String(t)
    while (rest.length > size) {
        let cut = rest.lastIndexOf('\n', size)
        if (cut < size * 0.5) cut = size
        out.push(rest.slice(0, cut))
        rest = rest.slice(cut).replace(/^\n+/, '')
    }
    if (rest) out.push(rest)
    return out
}

/* ═══════════════ محرك PDF عربي — مكتوب من الصفر، بلا مكتبات ═══════════════ */

// أشكال الحروف: [معزول، أخير، أول، وسط] — 0 = الشكل غير موجود (حرف يلتصق من اليمين فقط)
const FORMS = {
    0x0621: [0xFE80, 0, 0, 0],
    0x0622: [0xFE81, 0xFE82, 0, 0],
    0x0623: [0xFE83, 0xFE84, 0, 0],
    0x0624: [0xFE85, 0xFE86, 0, 0],
    0x0625: [0xFE87, 0xFE88, 0, 0],
    0x0626: [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C],
    0x0627: [0xFE8D, 0xFE8E, 0, 0],
    0x0628: [0xFE8F, 0xFE90, 0xFE91, 0xFE92],
    0x0629: [0xFE93, 0xFE94, 0, 0],
    0x062A: [0xFE95, 0xFE96, 0xFE97, 0xFE98],
    0x062B: [0xFE99, 0xFE9A, 0xFE9B, 0xFE9C],
    0x062C: [0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0],
    0x062D: [0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4],
    0x062E: [0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8],
    0x062F: [0xFEA9, 0xFEAA, 0, 0],
    0x0630: [0xFEAB, 0xFEAC, 0, 0],
    0x0631: [0xFEAD, 0xFEAE, 0, 0],
    0x0632: [0xFEAF, 0xFEB0, 0, 0],
    0x0633: [0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4],
    0x0634: [0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8],
    0x0635: [0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC],
    0x0636: [0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0],
    0x0637: [0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4],
    0x0638: [0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8],
    0x0639: [0xFEC9, 0xFECA, 0xFECB, 0xFECC],
    0x063A: [0xFECD, 0xFECE, 0xFECF, 0xFED0],
    0x0641: [0xFED1, 0xFED2, 0xFED3, 0xFED4],
    0x0642: [0xFED5, 0xFED6, 0xFED7, 0xFED8],
    0x0643: [0xFED9, 0xFEDA, 0xFEDB, 0xFEDC],
    0x0644: [0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0],
    0x0645: [0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4],
    0x0646: [0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8],
    0x0647: [0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC],
    0x0648: [0xFEED, 0xFEEE, 0, 0],
    0x0649: [0xFEEF, 0xFEF0, 0, 0],
    0x064A: [0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4],
    0x0671: [0xFB50, 0xFB51, 0, 0],
    0x067E: [0xFB56, 0xFB57, 0xFB58, 0xFB59],
    0x0686: [0xFB7A, 0xFB7B, 0xFB7C, 0xFB7D],
    0x06AF: [0xFB92, 0xFB93, 0xFB94, 0xFB95],
    0x06CC: [0xFBFC, 0xFBFD, 0xFBFE, 0xFBFF]
}
// تركيبات لام-ألف: [معزولة، أخيرة]
const LAM_ALEF = {
    0x0627: [0xFEF5, 0xFEF6],
    0x0622: [0xFEF7, 0xFEF8],
    0x0625: [0xFEF9, 0xFEFA],
    0x0623: [0xFEFB, 0xFEFC]
}
function isMark(cp) { return (cp >= 0x064B && cp <= 0x065F) || cp === 0x0670 || (cp >= 0x06D6 && cp <= 0x06ED) }
function joinsNext(cp) { const f = FORMS[cp]; return !!(f && f[2]) }
function joinsPrev(cp) { const f = FORMS[cp]; return !!(f && f[1]) || cp === 0x0640 }

// تشكيل نص منطقي → سلسلة أشكال عرض (بنفس الترتيب المنطقي) + خريطة كل شكل لحرفه الأصلي
function shapeText(str) {
    const chars = []
    for (const ch of String(str)) chars.push(ch.codePointAt(0))
    const out = [] // {cp: shaped codepoint, base: original codepoint}
    let i = 0
    function prevBase(idx) { // آخر حرف حقيقي قبل idx (متجاوزاً العلامات)
        for (let j = idx - 1; j >= 0; j--) { if (!isMark(chars[j])) return j }
        return -1
    }
    function nextBase(idx) {
        for (let j = idx + 1; j < chars.length; j++) { if (!isMark(chars[j])) return j }
        return -1
    }
    while (i < chars.length) {
        const cp = chars[i]
        // لام + ألف = تركيبة واحدة
        if (cp === 0x0644 && i + 1 < chars.length && LAM_ALEF[chars[i + 1]]) {
            const alef = chars[i + 1]
            const p = prevBase(i)
            const joined = p >= 0 && joinsNext(chars[p]) && joinsPrev(0x0644)
            out.push({ cp: LAM_ALEF[alef][joined ? 1 : 0], base: 0x0644 })
            i += 2
            continue
        }
        const f = FORMS[cp]
        if (!f) { out.push({ cp: cp, base: cp }); i++; continue }
        if (isMark(cp)) { out.push({ cp: cp, base: cp }); i++; continue }
        const p = prevBase(i), n = nextBase(i)
        const jp = p >= 0 && joinsNext(chars[p]) && joinsPrev(cp)
        const jn = n >= 0 && joinsPrev(chars[n]) && joinsNext(cp)
        let shaped
        if (jp && jn) shaped = f[3] || f[0]
        else if (jp) shaped = f[1] || f[0]
        else if (jn) shaped = f[2] || f[0]
        else shaped = f[0]
        out.push({ cp: shaped, base: cp })
        i++
    }
    return out
}

function isArabicCp(cp) {
    return (cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF)
}

// ترتيب بصري: عكس ترتيب المقاطع، وعكس الحروف داخل المقاطع العربية
function visualOrder(shaped) {
    const runs = []
    let cur = null
    for (const it of shaped) {
        const r = isArabicCp(it.cp) ? 'R' : 'L'
        if (!cur || cur.dir !== r) { cur = { dir: r, items: [] }; runs.push(cur) }
        cur.items.push(it)
    }
    runs.reverse()
    const out = []
    for (const run of runs) {
        if (run.dir === 'R') { for (let i = run.items.length - 1; i >= 0; i--) out.push(run.items[i]) }
        else for (const it of run.items) out.push(it)
    }
    return out
}

/* ── قراءة TTF: cmap + عروض الحروف ── */
function parseTtf(buf) {
    function u16(o) { return buf.readUInt16BE(o) }
    function u32(o) { return buf.readUInt32BE(o) }
    const numTables = u16(4)
    const tables = {}
    for (let i = 0; i < numTables; i++) {
        const o = 12 + i * 16
        const tag = buf.toString('ascii', o, o + 4)
        tables[tag] = { off: u32(o + 8), len: u32(o + 12) }
    }
    if (!tables['glyf'] || !tables['cmap'] || !tables['hmtx'] || !tables['head'] || !tables['hhea'] || !tables['maxp']) throw new Error('not a glyf TTF')
    const upem = u16(tables['head'].off + 18)
    const numGlyphs = u16(tables['maxp'].off + 4)
    const numH = u16(tables['hhea'].off + 34)
    const widths = []
    const hmtxOff = tables['hmtx'].off
    let lastW = 0
    for (let g = 0; g < numGlyphs; g++) {
        if (g < numH) lastW = u16(hmtxOff + g * 4)
        widths.push(Math.round(lastW * 1000 / upem))
    }
    // cmap: فضّل صيغة 12، وإلا 4
    const cmapOff = tables['cmap'].off
    const nSub = u16(cmapOff + 2)
    let fmt12 = 0, fmt4 = 0
    for (let i = 0; i < nSub; i++) {
        const o = cmapOff + 4 + i * 8
        const subOff = u32(o + 4)
        const fmt = u16(cmapOff + subOff)
        if (fmt === 12 && !fmt12) fmt12 = cmapOff + subOff
        if (fmt === 4 && !fmt4) fmt4 = cmapOff + subOff
    }
    const cmap = new Map()
    if (fmt12) {
        const nGroups = u32(fmt12 + 12)
        for (let i = 0; i < nGroups; i++) {
            const o = fmt12 + 16 + i * 12
            const start = u32(o), end = u32(o + 4), base = u32(o + 8)
            for (let c = start; c <= end && c - start < 70000; c++) cmap.set(c, base + (c - start))
        }
    } else if (fmt4) {
        const segCount = u16(fmt4 + 6) / 2
        const endOff = fmt4 + 14
        const startOff = endOff + 2 * segCount + 2
        const deltaOff = startOff + 2 * segCount
        const rangeOff = deltaOff + 2 * segCount
        for (let s = 0; s < segCount; s++) {
            const end = u16(endOff + s * 2), start = u16(startOff + s * 2)
            const delta = buf.readInt16BE(deltaOff + s * 2)
            const ro = u16(rangeOff + s * 2)
            for (let c = start; c <= end && c !== 0xFFFF; c++) {
                let gid
                if (ro === 0) gid = (c + delta) & 0xFFFF
                else {
                    const go = rangeOff + s * 2 + ro + (c - start) * 2
                    gid = u16(go)
                    if (gid !== 0) gid = (gid + delta) & 0xFFFF
                }
                if (gid) cmap.set(c, gid)
            }
        }
    } else throw new Error('no usable cmap')
    return { cmap: cmap, widths: widths, upem: upem, numGlyphs: numGlyphs }
}

// عروض Helvetica القياسية (ASCII 32..126) — خط PDF مدمج للاتيني
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 222, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]

const FONT_URLS = [
    'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400',
    'https://github.com/google/fonts/raw/main/ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf',
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf'
]
const SYSTEM_FONTS = [
    '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.otf'
]
let fontPromise = null
function fetchBuf(url, ms) {
    const ctrl = new AbortController()
    const t = setTimeout(function () { ctrl.abort() }, ms || 30000)
    return fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/534' } })
        .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer() })
        .then(function (ab) { return Buffer.from(ab) })
        .catch(function (e) { clearTimeout(t); throw e })
}
function loadFont() {
    if (fontPromise) return fontPromise
    fontPromise = (async function () {
        const cacheDir = path.join(process.cwd(), 'tmp', 'silana-fonts')
        const cacheFile = path.join(cacheDir, 'arabic.ttf')
        const candidates = SYSTEM_FONTS.concat([cacheFile])
        for (const p of candidates) {
            try {
                const b = fs.readFileSync(p)
                if (b.length > 20000) { const f = parseTtf(b); f.buf = b; return f }
            } catch (e) {}
        }
        for (const url of FONT_URLS) {
            try {
                let b
                if (url.indexOf('css2') !== -1) {
                    const css = (await fetchBuf(url, 20000)).toString('utf8')
                    const mt = css.match(/url\((https:[^)]+)\)/)
                    if (!mt) continue
                    b = await fetchBuf(mt[1], 30000)
                } else {
                    b = await fetchBuf(url, 30000)
                }
                if (b.length < 20000) continue
                const f = parseTtf(b)
                f.buf = b
                try { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cacheFile, b) } catch (e) {}
                return f
            } catch (e) {}
        }
        throw new Error('arabic font unavailable')
    })()
    fontPromise.catch(function () { fontPromise = null })
    return fontPromise
}

/* ── بناء PDF ── */
function buildPdf(title, paragraphs, font) {
    const PAGE_W = 595, PAGE_H = 842, MARGIN = 54
    const maxW = PAGE_W - MARGIN * 2
    const usedGids = new Map() // gid -> unicode (لـ ToUnicode)
    function gidOf(cp) { const g = font.cmap.get(cp); return g === undefined ? -1 : g }
    function charW1000(cp) {
        const g = gidOf(cp)
        if (g >= 0) return font.widths[g] || 500
        if (cp >= 32 && cp <= 126) return HELV[cp - 32]
        return 500
    }
    function wordWidth(word, size) {
        const shaped = shapeText(word)
        let w = 0
        for (const it of shaped) w += charW1000(it.cp)
        return w * size / 1000
    }
    function spaceW(size) { return charW1000(0x20) * size / 1000 }

    // تقسيم الفقرات لأسطر بصرية جاهزة للرسم: كل سطر = [{font:'A'|'H', text|gids, w}]
    function layoutLine(logical, size) {
        const visual = visualOrder(shapeText(logical))
        const segs = []
        let cur = null
        for (const it of visual) {
            const g = gidOf(it.cp)
            const useA = g >= 0
            if (!cur || cur.arab !== useA) { cur = { arab: useA, items: [] }; segs.push(cur) }
            cur.items.push({ cp: it.cp, base: it.base, gid: g })
        }
        let total = 0
        const out = segs.map(function (s) {
            let w = 0
            for (const it of s.items) w += charW1000(it.cp)
            w = w * size / 1000
            total += w
            return { arab: s.arab, items: s.items, w: w }
        })
        return { segs: out, w: total }
    }
    function wrapParagraph(text, size) {
        const words = String(text).split(/\s+/).filter(Boolean)
        const lines = []
        let curLine = ''
        for (const word of words) {
            const trial = curLine ? curLine + ' ' + word : word
            if (wordWidth(trial, size) <= maxW || !curLine) curLine = trial
            else { lines.push(curLine); curLine = word }
        }
        if (curLine) lines.push(curLine)
        return lines.map(function (l) { return layoutLine(l, size) })
    }

    // محتوى الصفحات
    const pages = []
    let content = []
    let y = PAGE_H - MARGIN
    function newPage() { if (content.length) pages.push(content); content = []; y = PAGE_H - MARGIN }
    function ensure(sp) { if (y - sp < MARGIN) newPage() }
    function drawLine(layout, size, align) {
        ensure(size * 1.5)
        y -= size * 1.35
        let x = align === 'center' ? (PAGE_W - layout.w) / 2 : PAGE_W - MARGIN - layout.w
        for (const seg of layout.segs) {
            if (seg.arab) {
                let hex = ''
                for (const it of seg.items) {
                    if (it.gid < 0) continue
                    hex += ('0000' + it.gid.toString(16)).slice(-4)
                    if (!usedGids.has(it.gid)) usedGids.set(it.gid, it.base)
                }
                if (hex) content.push('BT /F1 ' + size + ' Tf 1 0 0 1 ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' Tm <' + hex + '> Tj ET')
            } else {
                let s = ''
                for (const it of seg.items) {
                    const c = it.cp
                    if (c === 0x0640) continue
                    s += (c >= 32 && c <= 126) ? String.fromCharCode(c) : ' '
                }
                s = s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
                if (s) content.push('BT /F2 ' + size + ' Tf 1 0 0 1 ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' Tm (' + s + ') Tj ET')
            }
            x += seg.w
        }
    }
    // العنوان
    const titleLayout = layoutLine(title, 20)
    drawLine(titleLayout, 20, 'center')
    y -= 6
    content.push('0.55 0.55 0.55 RG 1.2 w ' + MARGIN + ' ' + y.toFixed(1) + ' m ' + (PAGE_W - MARGIN) + ' ' + y.toFixed(1) + ' l S')
    y -= 10
    for (const para of paragraphs) {
        if (para === '') { y -= 9; continue }
        const isHead = /^المادة \d/.test(para) || para.indexOf('بين الموقعين') === 0 || para.indexOf('وقد اتفق') === 0
        const size = isHead ? 13.5 : 12.5
        const lines = wrapParagraph(para, size)
        for (const l of lines) drawLine(l, size, 'right')
        y -= 3
    }
    newPage()

    // ToUnicode
    let tu = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n'
    const entries = Array.from(usedGids.entries())
    for (let i = 0; i < entries.length; i += 90) {
        const slice = entries.slice(i, i + 90)
        tu += slice.length + ' beginbfchar\n'
        for (const pair of slice) tu += '<' + ('0000' + pair[0].toString(16)).slice(-4) + '> <' + ('0000' + pair[1].toString(16)).slice(-4) + '>\n'
        tu += 'endbfchar\n'
    }
    tu += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend'

    const wArr = []
    const sortedGids = Array.from(usedGids.keys()).sort(function (a, b) { return a - b })
    for (const g of sortedGids) wArr.push(g + ' [' + (font.widths[g] || 500) + ']')

    const objects = []
    function obj(body) { objects.push(body); return objects.length }
    const fontFileObj = obj({ stream: font.buf, dict: '<< /Length ' + font.buf.length + ' /Length1 ' + font.buf.length + ' >>' })
    const tuObj = obj({ stream: Buffer.from(tu, 'ascii'), dict: '<< /Length ' + Buffer.byteLength(tu) + ' >>' })
    const cidFontObj = obj('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SilanaArabic /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor << /Type /FontDescriptor /FontName /SilanaArabic /Flags 4 /FontBBox [0 -200 1000 900] /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 ' + fontFileObj + ' 0 R >> /CIDToGIDMap /Identity /DW 500 /W [' + wArr.join(' ') + '] >>')
    const f1Obj = obj('<< /Type /Font /Subtype /Type0 /BaseFont /SilanaArabic /Encoding /Identity-H /DescendantFonts [' + cidFontObj + ' 0 R] /ToUnicode ' + tuObj + ' 0 R >>')
    const f2Obj = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    const pageObjs = []
    for (const pc of pages) {
        const stream = pc.join('\n')
        const contentObj = obj({ stream: Buffer.from(stream, 'ascii'), dict: '<< /Length ' + Buffer.byteLength(stream) + ' >>' })
        pageObjs.push(contentObj)
    }
    const pagesObjNum = objects.length + pageObjs.length + 1
    const realPageObjs = []
    for (let i = 0; i < pages.length; i++) {
        realPageObjs.push(obj('<< /Type /Page /Parent ' + pagesObjNum + ' 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H + '] /Resources << /Font << /F1 ' + f1Obj + ' 0 R /F2 ' + f2Obj + ' 0 R >> >> /Contents ' + pageObjs[i] + ' 0 R >>'))
    }
    const kids = realPageObjs.map(function (n) { return n + ' 0 R' }).join(' ')
    const pagesObj = obj('<< /Type /Pages /Kids [' + kids + '] /Count ' + realPageObjs.length + ' >>')
    const catalogObj = obj('<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>')

    // تجميع الملف
    const chunks = []
    let offset = 0
    function push(b) { chunks.push(b); offset += b.length }
    push(Buffer.from('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n', 'binary'))
    const offsets = [0]
    for (let i = 0; i < objects.length; i++) {
        offsets.push(offset)
        const o = objects[i]
        if (typeof o === 'string') {
            push(Buffer.from((i + 1) + ' 0 obj\n' + o + '\nendobj\n', 'ascii'))
        } else {
            push(Buffer.from((i + 1) + ' 0 obj\n' + o.dict + '\nstream\n', 'ascii'))
            push(o.stream)
            push(Buffer.from('\nendstream\nendobj\n', 'ascii'))
        }
    }
    const xrefPos = offset
    let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n'
    for (let i = 1; i <= objects.length; i++) xref += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n'
    xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogObj + ' 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF'
    push(Buffer.from(xref, 'ascii'))
    return Buffer.concat(chunks)
}

async function askStep(conn, m, s) {
    const step = STEPS[s.step]
    await conn.reply(m.chat, step.ask + '\n\n_للإلغاء: stop_', m)
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const arg = (text || '').trim()
    if (isStopWord(arg)) {
        if (getSession(m.sender)) {
            sessions.delete(m.sender)
            return m.reply('🛑 تلغات جلسة العقد. ملي تبغي تبدا من جديد: ' + usedPrefix + command)
        }
        return m.reply('ما عندك حتى جلسة عقد خدامة دابا. بدا بـ ' + usedPrefix + command)
    }
    if (arg) return m.reply('ℹ️ العقد كيتصايب بالأسئلة واحداً بواحد — صيفط غير ' + usedPrefix + command + ' بلا حتى زيادة وغنبدا معاك.')
    if (getSession(m.sender)) {
        const s = getSession(m.sender)
        return m.reply('⏳ عندك جلسة عقد خدامة أصلاً (واصلين للخطوة ' + (s.step + 1) + '/11: ' + STEPS[s.step].label + '). كمّل الجواب، ولا صيفط stop للإلغاء.')
    }
    const s = { step: 0, data: {}, at: Date.now() }
    sessions.set(m.sender, s)
    await conn.reply(m.chat, '📄 *مولّد عقد الكراء* 🇲🇦\nغنسولك 11 سؤالاً واحداً بواحد، وفي الأخير غنولّد ليك العقد كاملاً كنص + ملف PDF واجد للطباعة.\n⚠️ هذا نموذج استرشادي — التوثيق الرسمي كيبقى هو الأضمن قانونياً.', m)
    await askStep(conn, m, s)
}

handler.before = async function (m, { conn }) {
    try {
        if (!m || m.fromMe || m.chat === 'status@broadcast') return
        const s = getSession(m.sender)
        if (!s) return
        const raw = (m.text || m.body || '').trim()
        if (!raw) return
        if (raw.indexOf('.') === 0) return
        if (isStopWord(raw)) {
            sessions.delete(m.sender)
            await conn.reply(m.chat, '🛑 تلغات جلسة العقد. ملي تبغي تعاود: .rentcontract', m)
            return true
        }
        const step = STEPS[s.step]
        let val
        if (step.optional && isSkipWord(raw)) val = ''
        else val = step.parse(raw)
        if (val === null || val === undefined) {
            await conn.reply(m.chat, step.err, m)
            return true
        }
        s.data[step.key] = val
        s.step++
        s.at = Date.now()
        if (s.step < STEPS.length) {
            await askStep(conn, m, s)
            return true
        }
        sessions.delete(m.sender)
        const contract = buildContract(s.data)
        await conn.reply(m.chat, '✅ *سالينا! هذا هو العقد ديالك:*', m)
        const chunks = chunkText(contract, 3500)
        for (const ch of chunks) await conn.reply(m.chat, ch, m)
        const caption = '📄 عقد كراء ' + s.data.type + ' — ' + s.data.tenant + ' (' + fmtNum(s.data.rent) + ' درهم/شهر)'
        let pdfSent = false
        try {
            const font = await loadFont()
            const paras = contract.split('\n')
            const title = paras[0]
            const pdf = buildPdf(title, paras.slice(2), font)
            await conn.sendMessage(m.chat, {
                document: pdf,
                mimetype: 'application/pdf',
                fileName: 'rent-contract.pdf',
                caption: caption
            }, { quoted: m })
            pdfSent = true
        } catch (e) { pdfSent = false }
        if (!pdfSent) {
            try {
                await conn.sendMessage(m.chat, {
                    document: Buffer.from(contract, 'utf8'),
                    mimetype: 'text/plain',
                    fileName: 'rent-contract.txt',
                    caption: caption + '\n(تعذّر توليد PDF هاد المرة — وصلك العقد كنص)'
                }, { quoted: m })
            } catch (e) {}
        }
        return true
    } catch (e) {
        return
    }
}

handler.help = ['rentcontract']
handler.tags = ['morocco']
handler.command = /^rentcontract$/i
handler.limit = false

export default handler
