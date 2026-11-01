// plugins/stats.js — إحصائيات البوت (للمالك)
// كيجمع الإحصائيات من نهار التركيب: أكثر الأعضاء نشاطا، أكثر الأوامر استعمالا،
// أنشط الگروبات، نشاط اليوم، عدد المستعملين والگروبات فالداتابيز،
// والبوتات الفرعية المتصلة (إلا كان بلاغين serbot مركب).
//
// الأوامر:
//   .stats            التقرير الكامل (للمالك فقط)
//   .stats reset      تصفير العدادات

const DAY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date())
const SELF_CMDS = ['stats', 'احصائيات', 'إحصائيات']

function store() {
    try {
        const data = globalThis.db.data
        let st = data.stats
        if (!st || typeof st !== 'object') st = data.stats = {}
        // كنصلحو أي حقل ناقص (الداتابيز ممكن ترجع كائن جزئي من الحفظ)
        if (!st.since) st.since = Date.now()
        if (typeof st.totalMsgs !== 'number') st.totalMsgs = 0
        if (typeof st.totalCmds !== 'number') st.totalCmds = 0
        if (!st.commands || typeof st.commands !== 'object') st.commands = {}
        if (!st.users || typeof st.users !== 'object') st.users = {}
        if (!st.groups || typeof st.groups !== 'object') st.groups = {}
        if (!st.days || typeof st.days !== 'object') st.days = {}
        return st
    } catch { return null }
}

function prune(map, keep) {
    const entries = Object.entries(map)
    if (entries.length <= keep) return map
    entries.sort((a, b) => (b[1].n || 0) - (a[1].n || 0))
    return Object.fromEntries(entries.slice(0, keep))
}

function countMessage(m) {
    try {
        if (!m || m.fromMe || m.key?.fromMe) return
        if ((m.chat || '') === 'status@broadcast') return
        const st = store()
        if (!st) return
        st.totalMsgs++
        if (m.sender) {
            const u = st.users[m.sender] || { n: 0, name: '' }
            u.n++
            if (m.pushName) u.name = m.pushName
            st.users[m.sender] = u
        }
        if (m.isGroup && m.chat) {
            const g = st.groups[m.chat] || { n: 0 }
            g.n++
            st.groups[m.chat] = g
        }
        const today = DAY()
        const d = st.days[today] || { msgs: 0, cmds: 0 }
        d.msgs++
        const mt = String(m.text || '').trim().match(/^[.!#/]([\p{L}\p{N}_-]+)/u)
        if (mt) {
            const cmd = mt[1].toLowerCase()
            if (!SELF_CMDS.includes(cmd)) {
                st.commands[cmd] = (st.commands[cmd] || 0) + 1
                st.totalCmds++
                d.cmds++
            }
        }
        st.days[today] = d
        // كنخليو غير آخر 14 يوم
        const dayKeys = Object.keys(st.days).sort()
        while (dayKeys.length > 14) delete st.days[dayKeys.shift()]
        if (Object.keys(st.users).length > 800) st.users = prune(st.users, 500)
        if (Object.keys(st.groups).length > 300) st.groups = prune(st.groups, 200)
    } catch {}
}

const top = (obj, n) => Object.entries(obj).sort((a, b) => (b[1].n ?? b[1]) - (a[1].n ?? a[1])).slice(0, n)
const fmt = (n) => Number(n || 0).toLocaleString('en-US')

let handler = async (m, { conn, text, isOwner }) => {
    if (!isOwner) return m.reply('⛔ هاد الأمر خاص بالمالك فقط.')
    const st = store()
    if (!st) return m.reply('❌ قاعدة البيانات غير متاحة.')

    if ((text || '').trim().toLowerCase() === 'reset') {
        globalThis.db.data.stats = { since: Date.now(), totalMsgs: 0, totalCmds: 0, commands: {}, users: {}, groups: {}, days: {} }
        return m.reply('🗑️ تم تصفير الإحصائيات. العد بدا من جديد من دابا.')
    }

    const dbUsers = Object.keys(globalThis.db?.data?.users || {}).length
    const dbChats = Object.keys(globalThis.db?.data?.chats || {}).length
    const dbGroups = Object.keys(globalThis.db?.data?.chats || {}).filter((j) => j.endsWith('@g.us')).length
    const today = st.days[DAY()] || { msgs: 0, cmds: 0 }
    const since = new Date(st.since).toLocaleDateString('en-GB')

    let serbLine = ''
    try {
        const reg = globalThis.__serbots
        if (reg) {
            const bots = [...reg.values()]
            const supportOn = bots.filter((e) => globalThis.db?.data?.settings?.serbotSupport?.[e.phone]).length
            serbLine = `\n🤖 *البوتات الفرعية:* ${bots.filter((e) => e.wasOpen).length} خدامة من ${bots.length} (الدعم مشغل عند ${supportOn})`
        }
    } catch {}

    const topUsers = top(st.users, 5).map(([jid, u], i) => `${i + 1}. ${u.name ? `${u.name} ` : ''}(+${jid.split('@')[0]}) — ${fmt(u.n)} رسالة`).join('\n') || '—'
    const topCmds = top(Object.fromEntries(Object.entries(st.commands).map(([k, v]) => [k, { n: v }])), 8).map(([cmd, o], i) => `${i + 1}. .${cmd} — ${fmt(o.n)}`).join('\n') || '—'

    let topGroups = '—'
    const tg = top(st.groups, 5)
    if (tg.length) {
        const lines = []
        for (const [jid, g] of tg) {
            let name = ''
            try { name = (await conn.groupMetadata(jid))?.subject || '' } catch {}
            lines.push(`${lines.length + 1}. ${name || jid.split('@')[0]} — ${fmt(g.n)} رسالة`)
        }
        topGroups = lines.join('\n')
    }

    return m.reply(
        `📊 *إحصائيات SILANA* (منذ ${since})\n\n` +
        `💬 الرسائل المعالجة: ${fmt(st.totalMsgs)}\n` +
        `⚡ الأوامر المنفذة: ${fmt(st.totalCmds)}\n` +
        `📅 اليوم: ${fmt(today.msgs)} رسالة، ${fmt(today.cmds)} أمر\n` +
        `👥 المستعملون فالداتابيز: ${fmt(dbUsers)}\n` +
        `🗂️ المحادثات: ${fmt(dbChats)} (منها ${fmt(dbGroups)} گروب)` +
        serbLine +
        `\n\n🏆 *أكثر الأعضاء نشاطا:*\n${topUsers}\n\n` +
        `⚡ *أكثر الأوامر استعمالا:*\n${topCmds}\n\n` +
        `🔥 *أنشط الگروبات:*\n${topGroups}`)
}

handler.help = handler.command = ['stats']
handler.tags = ['owner']
handler.limit = false

// كيعد كل رسالة وأمر كيوصلو للبوت (بلا ما يأثر على المعالجة)
handler.before = async function (m) { countMessage(m) }

export default handler
