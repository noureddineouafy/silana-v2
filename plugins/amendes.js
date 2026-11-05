// plugins/amendes.js — Moroccan traffic fines guide (.amendes)
//   .amendes          → the fine classes (ATF) + early-payment reductions
//   .amendes سرعة     → speeding: class + points by excess
//   .amendes كيفاش    → how to check and pay YOUR fines (official platform)
//
// Why a guide and not a live checker: the official platform
// (infractionsroutieres.narsa.gov.ma) works only through a personal
// account opened with your CIN + driving-licence number — personal
// credentials that must never be typed into a WhatsApp bot. So the
// bot gives the official public scale (Trésorerie Générale / NARSA)
// and the exact steps; the check itself stays on the official site.
//
// Tags: morocco.

const PLATFORM = 'https://infractionsroutieres.narsa.gov.ma'

const MAIN =
    `🚦 *مخالفات السير — الغرامات التصالحية والجزافية (ATF)*\n\n` +
    `الغرامة كتنقص إلا خلّصتي بكري (الأداء عند الخزينة العامة TGR):\n\n` +
    `*الدرجة 1:* 700 درهم ← *400* نهار المخالفة · *500* في 15 يوم\n` +
    `*الدرجة 2:* 500 درهم ← *300* نهار المخالفة · *350* في 15 يوم\n` +
    `*الدرجة 3:* 300 درهم ← *150* نهار المخالفة · *200* في 15 يوم\n\n` +
    `⏳ الثمن المخفّض متوفر حتى لـ *30 يوم* من التبليغ — من بعد كترجع الغرامة كاملة والملف يقدر يمشي للمحكمة.\n\n` +
    `📌 زيد:\n` +
    `• *.amendes سرعة* — تجاوز السرعة: الدرجة والنقط\n` +
    `• *.amendes كيفاش* — كيفاش تشوف وتخلّص مخالفاتك رسمياً\n\n` +
    `ℹ️ أرقام رسمية منشورة (TGR/NARSA) — تأكد من ملفك الشخصي للوضعية الدقيقة.`

const SPEED =
    `🏎️ *تجاوز السرعة — الدرجة والنقط المسحوبة*\n\n` +
    `• أقل من *20 كم/س* فوق الحد ← الدرجة 3 (300 درهم)\n` +
    `• من *20 إلى أقل من 30 كم/س* ← الدرجة 2 (500 درهم) + سحب *2 نقط*\n` +
    `• من *30 إلى أقل من 50 كم/س* ← الدرجة 1 (700 درهم) + سحب *4 نقط*\n` +
    `• *50 كم/س* فأكثر ← ماشي غرامة تصالحية: *جنحة* كتمشي للمحكمة\n\n` +
    `🎫 رصيد رخصة السياقة = *30 نقطة* — النقط كتسحب حسب المخالفة وكترجع بشروط (منها تكوين في السلامة الطرقية).\n\n` +
    `📌 *.amendes* — جدول الغرامات والتخفيضات\n` +
    `📌 *.amendes كيفاش* — الاطلاع والأداء الرسمي`

const HOW =
    `🔎 *كيفاش تشوف مخالفاتك وتخلّصهم (رسمي)*\n\n` +
    `المنصة الرسمية ديال NARSA هي الوحيدة اللي كتعطي ملفك الحقيقي:\n${PLATFORM}\n\n` +
    `*الخطوات:*\n` +
    `1. افتح حساب في المنصة برقم *البطاقة الوطنية (CIN)* ورقم *رخصة السياقة*\n` +
    `2. غادي تلقى: لائحة المخالفات (رادار + الدرك + الأمن)، صورة الرادار، ووضعية كل ملف (مخلّصة / غير مخلّصة / عند المحكمة)\n` +
    `3. مخالفات الرادار تقدر تخلّصهم *إلكترونياً* من نفس المنصة\n\n` +
    `🔒 *مهم:* حتى واحد ما يطلب منك CIN ولا رقم الرخصة في واتساب — هاد المعلومات كتدخل غير في الموقع الرسمي.\n\n` +
    `📌 *.amendes* — جدول الغرامات · *.amendes سرعة* — درجات السرعة`

let handler = async (m, { conn, text, usedPrefix }) => {
    const q = (text || '').trim().toLowerCase()
    if (['سرعة', 'speed', 'vitesse'].includes(q)) return conn.reply(m.chat, SPEED, m)
    if (['كيفاش', 'how', 'check', 'اطلاع'].includes(q)) {
        if (conn.sendButton) {
            try {
                return await conn.sendButton(m.chat, {
                    text: HOW, footer: 'Silana • NARSA',
                    buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🌐 المنصة الرسمية للمخالفات', url: PLATFORM }) }],
                    interactiveButtons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🌐 المنصة الرسمية للمخالفات', url: PLATFORM }) }],
                    headerType: 1
                }, { quoted: m })
            } catch { /* fall through to text */ }
        }
        return conn.reply(m.chat, HOW, m)
    }
    return conn.reply(m.chat, MAIN, m)
}
handler.help = ['amendes']
handler.tags = ['morocco']
handler.command = ['amendes', 'مخالفات']
export default handler
