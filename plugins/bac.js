// bac.js — عدّاد البكالوريا: كم بقي من الوقت؟ (.bac)
// ─────────────────────────────────────────────────────────────────────────────
// التواريخ الرسمية لدورة 2027 حسب المقرر الوزاري رقم 047.26
// (3 يوليوز 2026) المنظم للسنة الدراسية 2026/2027:
//   الجهوي (أولى باك) العادية: 28-29 ماي 2027 | الاستدراكية: 28-29 يونيو
//   الوطني (ثانية باك) العادية: 1-3 يونيو 2027 | الاستدراكية: 1-3 يوليوز
//   نتائج العادية (وطني): 19 يونيو 2027 | نتائج الاستدراكية: 10 يوليوز
// ملاحظة للمالك: حدث جدول DATES كل سنة عند صدور المقرر الجديد.
//
//   .bac        → العد التنازلي للامتحان الوطني + كل المواعيد
//   .bac جهوي   → التركيز على الامتحان الجهوي (أولى باك)
// ─────────────────────────────────────────────────────────────────────────────

const TZ = 'Africa/Casablanca'
const at = (y, mo, d, h = 8) => {
    // بناء التاريخ بتوقيت المغرب عبر إزاحة Intl
    const utcGuess = Date.UTC(y, mo - 1, d, h, 0, 0)
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcGuess))
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]))
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
    return utcGuess - (asUTC - utcGuess)
}

const DATES = {
    yearStart: at(2026, 9, 7),
    jihawi: at(2027, 5, 28),
    jihawiRattrapage: at(2027, 6, 28),
    watani: at(2027, 6, 1),
    wataniEnd: at(2027, 6, 3, 20),
    wataniResults: at(2027, 6, 19, 10),
    wataniRattrapage: at(2027, 7, 1),
    wataniRattrapageResults: at(2027, 7, 10, 10),
}

const TIPS = [
    'راجع بالتمارين والامتحانات الوطنية السابقة — هي أقرب حاجة للامتحان الحقيقي.',
    'قسم المراجعة لجلسات 45 دقيقة + 10 دقائق راحة (تقنية بومودورو).',
    'ابدأ كل نهار بالمادة اللي كتخوفك كثر — الطاقة عالية في الصباح.',
    'لخص كل درس في صفقة وحدة بخط يدك؛ الملخص القصير كيثبت في الذاكرة.',
    'حل امتحان وطني كامل بالتوقيت الحقيقي مرة في الأسبوع على الأقل.',
    'راجع أخطاءك، ماشي غير الحلول الصحيحة — الخطأ المتكرر هو العدو.',
    'النوم 8 ساعات ماشي رفاهية: الذاكرة كتتثبت أثناء النوم.',
    'بعد على الهاتف أثناء المراجعة: حطو في بيئة أخرى، ماشي غير صامت.',
    'علم الدرس لشي حد (ولا لنفسك بصوت عال) — إلا عرفتي تشرحو، راك فهمتيه.',
    'في الرياضيات والفيزياء: الفهم قبل الحفظ، والمنهجية كتجيب النقط.',
    'دير جدول مراجعة أسبوعي والتزم بيه أكثر ما التزمت بالكمال فيه.',
    'المواد الأدبية: خطط للإنشاء من دابا — المقدمة والعرض والخاتمة.',
    'شرب الماء وكل مزيان: الدماغ كيستهلك طاقة كبيرة في المراجعة.',
    'آخر أسبوعين: غير مراجعة خفيفة وتمارين — بلا دروس جداد.',
]

function remaining(target, now) {
    const ms = target - now
    if (ms <= 0) return null
    const totalH = Math.floor(ms / 3600000)
    return { days: Math.floor(totalH / 24), hours: totalH % 24, totalDays: Math.ceil(ms / 86400000) }
}

function bar(pct, len = 14) {
    const filled = Math.max(0, Math.min(len, Math.round(pct / 100 * len)))
    return '▓'.repeat(filled) + '░'.repeat(len - filled) + ` ${pct.toFixed(0)}%`
}

function fmtDate(ts) {
    return new Intl.DateTimeFormat('ar-MA', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts))
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const now = Date.now()
    const wantJihawi = /جهوي|jihawi/i.test(text || '') || command === 'jihawi'

    const target = wantJihawi ? DATES.jihawi : DATES.watani
    const targetName = wantJihawi ? 'الامتحان الجهوي (الأولى باكالوريا)' : 'الامتحان الوطني (الثانية باكالوريا)'
    const rem = remaining(target, now)

    let head
    if (rem) {
        const yearPct = Math.max(0, Math.min(100, (now - DATES.yearStart) / (target - DATES.yearStart) * 100))
        head =
            `🎓 *كم بقي لـ ${targetName}؟*\n\n` +
            `⏳ *${rem.days} يوم* و *${rem.hours} ساعة*\n` +
            `📅 البداية: ${fmtDate(target)} — 8:00 صباحا\n` +
            `📊 تقدم السنة الدراسية: ${bar(yearPct)}\n`
    } else if (now < DATES.wataniResults && !wantJihawi) {
        head =
            `🎓 *الامتحان الوطني داز!*\n\n` +
            `🍀 بالتوفيق لجميع المترشحين — النتائج ديال الدورة العادية: *${fmtDate(DATES.wataniResults)}*\n`
    } else {
        head =
            `🎓 *دورة 2027 سالات*\n\n` +
            `النتائج بانت. بالتوفيق للجميع في الموسم الجاي 🍀\n`
    }

    const tip = TIPS[Math.floor(now / 86400000) % TIPS.length]

    return conn.reply(m.chat,
        head +
        `\n🗓️ *جميع مواعيد دورة 2027 (المقرر الوزاري 047.26):*\n` +
        `• الجهوي العادية: 28-29 ماي 2027\n` +
        `• الوطني العادية: 1-3 يونيو 2027\n` +
        `• نتائج الوطني العادية: 19 يونيو 2027\n` +
        `• الجهوي الاستدراكية: 28-29 يونيو 2027\n` +
        `• الوطني الاستدراكية: 1-3 يوليوز 2027\n` +
        `• نتائج الاستدراكية: 10 يوليوز 2027\n` +
        `\n💡 *نصيحة اليوم:* ${tip}\n` +
        `\n📚 للمراجعة بالدروس والفروض: ${usedPrefix}doroos`, m)
}

handler.help = ['bac']
handler.tags = ['morocco']
handler.command = /^(bac|باك|باكالوريا|jihawi|جهوي)$/i
handler.limit = false

export default handler
