// plugins/rentcontract.js — مولّد عقد كراء مغربي (.rentcontract)
// جلسة موجّهة: البوت كيسول سؤال بسؤال، وفي الأخير كيولّد عقد كراء كامل
// كنص في المحادثة + ملف .txt واجد للطباعة.
// نموذج استرشادي فقط — ماشي بديل على التوثيق الرسمي ولا استشارة قانونية.

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
    await conn.reply(m.chat, '📄 *مولّد عقد الكراء* 🇲🇦\nغنسولك 11 سؤالاً واحداً بواحد، وفي الأخير غنولّد ليك العقد كاملاً كنص + ملف واجد للطباعة.\n⚠️ هذا نموذج استرشادي — التوثيق الرسمي كيبقى هو الأضمن قانونياً.', m)
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
        try {
            await conn.sendMessage(m.chat, {
                document: Buffer.from(contract, 'utf8'),
                mimetype: 'text/plain',
                fileName: 'rent-contract.txt',
                caption: '📄 عقد كراء ' + s.data.type + ' — ' + s.data.tenant + ' (' + fmtNum(s.data.rent) + ' درهم/شهر)'
            }, { quoted: m })
        } catch (e) {}
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
                    
