// plugins/dars.js — .dars : شرح الدروس بالدارجة (رياضيات / فيزياء / علوم)
// من الابتدائي حتى البكالوريا — شرح خطوة بخطوة + مثال محلول + تمرين مع الحل
// بلا مفاتيح وبلا ملفات: كيستعمل text.pollinations.ai (نموذج openai)
//
// الاستعمال:
//   .dars جمع الكسور — السادس ابتدائي
//   .dars فيزياء | الثانية باك | قانون أوم
//   .درس اشرح لي المعادلات من الدرجة الأولى — الثالثة إعدادي

const LEVELS = [
    { k: ['ابتدائي', 'ابتدائى'], label: 'ابتدائي' },
    { k: ['إعدادي', 'اعدادي', 'إعدادى'], label: 'إعدادي' },
    { k: ['ثانوي', 'باك', 'بكالوريا', 'الباك'], label: 'ثانوي/باك' }
]
const SUBJECTS = [
    { k: ['رياضيات', 'ماط', 'math'], label: 'الرياضيات' },
    { k: ['فيزياء', 'فيزيك', 'physique'], label: 'الفيزياء' },
    { k: ['كيمياء', 'chimie'], label: 'الكيمياء' },
    { k: ['علوم الحياة', 'svt', 'علوم'], label: 'علوم الحياة والأرض' }
]

function detect(list, s) {
    for (const item of list) {
        for (const kw of item.k) {
            if (s.includes(kw)) return item.label
        }
    }
    return ''
}

function cleanOut(s) {
    let out = String(s || '')
    out = out.replace(/\*\*(.+?)\*\*/g, '*$1*')          // **x** -> *x*
    out = out.replace(/^#{1,6}\s*/gm, '')                  // markdown headers
    out = out.replace(/\\\[|\\\]|\\\(|\\\)/g, '')          // LaTeX wrappers
    out = out.replace(/^\s*\|?[-: |]+\|?\s*$/gm, '')       // table separator rows
    out = out.replace(/\|/g, ' ')                          // table pipes
    out = out.replace(/\n{3,}/g, '\n\n')
    return out.trim()
}

async function askAI(messages) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 75000)
    try {
        const res = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'openai', messages }),
            signal: ctrl.signal
        })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const t = await res.text()
        if (!t || t.trim().length < 30) throw new Error('empty')
        return t
    } finally {
        clearTimeout(timer)
    }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const raw = (text || '').trim()
    if (!raw) {
        return m.reply(
            '📚 *.dars — شرح الدروس بالدارجة*\n' +
            'من الابتدائي حتى الباك: رياضيات، فيزياء، كيمياء، علوم.\n\n' +
            'الاستعمال:\n' +
            usedPrefix + command + ' جمع الكسور — السادس ابتدائي\n' +
            usedPrefix + command + ' فيزياء | الثانية باك | قانون أوم\n' +
            usedPrefix + command + ' المعادلات من الدرجة الأولى — الثالثة إعدادي\n\n' +
            'الشرح كيجي خطوة بخطوة + مثال محلول + تمرين مع الحل.'
        )
    }
    if (raw.length > 300) return m.reply('❌ قصّر شوية: كتب غير اسم الدرس والمستوى (أقل من 300 حرف).')

    const level = detect(LEVELS, raw)
    const subject = detect(SUBJECTS, raw)

    const system =
        'أنت أستاذ مغربي صبور ومتمكن. كتشرح الدروس بالدارجة المغربية السهلة وبالحروف العربية فقط. ' +
        'تأكد جيدا من صحة التعاريف والقوانين والأرقام قبل ما تجاوب. ' +
        'ممنوع الجداول وممنوع الرموز المعقدة: كتب الكسور هكذا 1/2 والقوى هكذا x^2. ' +
        'التنسيق ديال واتساب فقط: *نص غليظ* للعناوين الفرعية، وخطوات مرقمة 1. 2. 3. الجمل قصيرة وواضحة.'
    const userPrompt =
        'اشرح هاد الدرس' + (subject ? ' ديال ' + subject : '') + (level ? ' لمستوى ' + level : '') + ': ' + raw + '\n' +
        'البنية المطلوبة بالضبط:\n' +
        '*شنو هو هاد الدرس* — تعريف ساهل في جوج سطور\n' +
        '*الخطوات* — شرح مرقم خطوة بخطوة\n' +
        '*مثال محلول* — بأعداد بسيطة، كل خطوة في سطر\n' +
        '*تمرين* — تمرين واحد قصير، ومن بعدو *الحل* ديالو'

    try {
        await conn.sendMessage(m.chat, { react: { text: '📚', key: m.key } }).catch(() => {})
        let answer = ''
        try {
            answer = await askAI([
                { role: 'system', content: system },
                { role: 'user', content: userPrompt }
            ])
        } catch (e) {
            // محاولة ثانية بنفس الطلب
            answer = await askAI([
                { role: 'system', content: system },
                { role: 'user', content: userPrompt }
            ])
        }
        const body = cleanOut(answer).slice(0, 3800)
        if (!body) throw new Error('empty body')
        const head = '📚 *الدرس*' + (subject ? ' — ' + subject : '') + (level ? ' — ' + level : '') + '\n\n'
        await m.reply(head + body + '\n\n_شرح مبسّط للفهم — راجع حتى مع الكتاب المدرسي ولا الأستاذ ديالك._')
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {})
    } catch (e) {
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {})
        return m.reply('❌ وقع مشكل في الخدمة دابا. عاود المحاولة من بعد شوية.')
    }
}

handler.help = ['dars']
handler.tags = ['morocco']
handler.command = /^(dars|درس|شرح|sharh)$/i
export default handler
