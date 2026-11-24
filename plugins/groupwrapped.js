// .groupwrapped — group activity stats card (counts messages only, never content)
const DAY_MS = 86400000

function settingsRoot() {
    if (typeof global.db !== 'object' || !global.db) global.db = { data: {} }
    if (typeof global.db.data !== 'object' || !global.db.data) global.db.data = {}
    if (typeof global.db.data.settings !== 'object' || !global.db.data.settings) global.db.data.settings = {}
    const s = global.db.data.settings
    if (typeof s.groupwrapped !== 'object' || !s.groupwrapped) s.groupwrapped = {}
    if (typeof s.groupwrapped.groups !== 'object' || !s.groupwrapped.groups) s.groupwrapped.groups = {}
    return s.groupwrapped
}
function freshGroup(nowTs) {
    return { total: 0, users: {}, days: {}, dayUsers: {}, hours: {}, firstDay: '', lastPrune: nowTs || 0 }
}
function healGroup(g, nowTs) {
    if (typeof g !== 'object' || !g) return freshGroup(nowTs)
    if (typeof g.total !== 'number') g.total = 0
    if (typeof g.users !== 'object' || !g.users) g.users = {}
    if (typeof g.days !== 'object' || !g.days) g.days = {}
    if (typeof g.dayUsers !== 'object' || !g.dayUsers) g.dayUsers = {}
    if (typeof g.hours !== 'object' || !g.hours) g.hours = {}
    if (typeof g.firstDay !== 'string') g.firstDay = ''
    if (typeof g.lastPrune !== 'number') g.lastPrune = 0
    return g
}
function partsCasablanca(ts) {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', hour12: false }).formatToParts(new Date(ts))
        let d = '01', mo = '01', y = '1970', h = '00'
        for (const p of parts) {
            if (p.type === 'day') d = p.value
            if (p.type === 'month') mo = p.value
            if (p.type === 'year') y = p.value
            if (p.type === 'hour') h = p.value
        }
        return { day: y + '-' + mo + '-' + d, hour: parseInt(h, 10) % 24 }
    } catch (e) {
        const n = new Date(ts)
        const mm = ('0' + (n.getMonth() + 1)).slice(-2), dd = ('0' + n.getDate()).slice(-2)
        return { day: n.getFullYear() + '-' + mm + '-' + dd, hour: n.getHours() }
    }
}
function prune(g, nowTs) {
    const cutoff = partsCasablanca(nowTs - 35 * DAY_MS).day
    for (const k of Object.keys(g.days)) if (k < cutoff) delete g.days[k]
    for (const k of Object.keys(g.dayUsers)) if (k < cutoff) delete g.dayUsers[k]
    g.lastPrune = nowTs
}
function countMessage(m) {
    try {
        if (!m || !m.chat || m.chat.indexOf('@g.us') === -1) return
        if (m.fromMe) return
        const sender = m.sender
        if (!sender || typeof sender !== 'string') return
        const root = settingsRoot()
        const nowTs = Date.now()
        let g = healGroup(root.groups[m.chat], nowTs)
        root.groups[m.chat] = g
        const p = partsCasablanca(nowTs)
        if (!g.firstDay) g.firstDay = p.day
        g.total += 1
        g.users[sender] = (g.users[sender] || 0) + 1
        g.days[p.day] = (g.days[p.day] || 0) + 1
        if (typeof g.dayUsers[p.day] !== 'object' || !g.dayUsers[p.day]) g.dayUsers[p.day] = {}
        g.dayUsers[p.day][sender] = (g.dayUsers[p.day][sender] || 0) + 1
        const hk = String(p.hour)
        g.hours[hk] = (g.hours[hk] || 0) + 1
        if (nowTs - g.lastPrune > 6 * 3600000) prune(g, nowTs)
    } catch (e) { /* counting must never break the chat */ }
}
function windowStats(g, daysBack, nowTs) {
    const userTotals = {}
    let total = 0, busiestDay = '', busiestCount = 0
    for (let i = 0; i < daysBack; i++) {
        const key = partsCasablanca(nowTs - i * DAY_MS).day
        const c = g.days[key] || 0
        total += c
        if (c > busiestCount) { busiestCount = c; busiestDay = key }
        const du = g.dayUsers[key] || {}
        for (const jid of Object.keys(du)) userTotals[jid] = (userTotals[jid] || 0) + du[jid]
    }
    return { userTotals: userTotals, total: total, busiestDay: busiestDay, busiestCount: busiestCount, active: Object.keys(userTotals).length }
}
function topList(userTotals, n) {
    return Object.keys(userTotals).map(function (jid) { return { jid: jid, count: userTotals[jid] } })
        .sort(function (a, b) { return b.count - a.count }).slice(0, n)
}
function prettyDay(key) {
    const p = String(key || '').split('-')
    if (p.length !== 3) return key
    return p[2] + '/' + p[1] + '/' + p[0]
}
function nameOf(conn, jid) {
    try {
        const n = conn && typeof conn.getName === 'function' ? conn.getName(jid) : ''
        if (n && typeof n === 'string') return n
    } catch (e) {}
    return String(jid || '').split('@')[0]
}

const handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const used = usedPrefix || '.'
    if (!m.chat || m.chat.indexOf('@g.us') === -1) return m.reply('👥 هاد الميزة خاصة بالمجموعات — جرّبها داخل أي مجموعة.')
    const root = settingsRoot()
    const g = healGroup(root.groups[m.chat], Date.now())
    root.groups[m.chat] = g
    const arg = String(text || '').trim().toLowerCase()
    if (arg === 'reset') {
        let allowed = !!isOwner
        if (!allowed && conn && typeof conn.groupMetadata === 'function') {
            try {
                const meta = await conn.groupMetadata(m.chat)
                const parts = (meta && meta.participants) || []
                for (const p of parts) {
                    if (p.id === m.sender && (p.admin === 'admin' || p.admin === 'superadmin')) { allowed = true; break }
                }
            } catch (e) {}
        }
        if (!allowed) return m.reply('⛔ تصفير إحصائيات المجموعة خاص بالمالك ومشرفي المجموعة.')
        delete root.groups[m.chat]
        return m.reply('🗑️ تصفّرات إحصائيات هاد المجموعة — العدّ غادي يبدا من جديد من دابا.')
    }
    if (arg && arg !== 'week' && arg !== 'month' && arg !== 'all') {
        return m.reply(
            '🎁 *ملخص المجموعة*\n\n' +
            '▪️ ' + used + command + ' — آخر 7 أيام\n' +
            '▪️ ' + used + command + ' month — آخر 30 يوم\n' +
            '▪️ ' + used + command + ' all — منذ البداية\n' +
            '▪️ ' + used + command + ' reset — تصفير (المالك/المشرفون)')
    }
    if (!g.total) {
        return m.reply('🎁 *ملخص المجموعة*\n\nمازال كنعدّ — الإحصائيات بدات غير دابا. خليو المجموعة تتحرك شوية وعاودو جربو من بعد! 📊')
    }
    const nowTs = Date.now()
    let title, stats
    if (arg === 'all') {
        title = 'منذ بداية العدّ (' + prettyDay(g.firstDay) + ')'
        let busiestDay = '', busiestCount = 0
        for (const k of Object.keys(g.days)) if (g.days[k] > busiestCount) { busiestCount = g.days[k]; busiestDay = k }
        stats = { userTotals: g.users, total: g.total, busiestDay: busiestDay, busiestCount: busiestCount, active: Object.keys(g.users).length }
    } else if (arg === 'month') {
        title = 'آخر 30 يوم'
        stats = windowStats(g, 30, nowTs)
    } else {
        title = 'آخر 7 أيام'
        stats = windowStats(g, 7, nowTs)
    }
    if (!stats.total) {
        return m.reply('🎁 *ملخص المجموعة — ' + title + '*\n\nما كانت حتى رسالة في هاد الفترة. جرّب: ' + used + command + ' all')
    }
    const tops = topList(stats.userTotals, 5)
    const medals = ['👑', '🥈', '🥉', '4️⃣', '5️⃣']
    let out = '🎁 *ملخص المجموعة — ' + title + '*\n\n'
    out += '💬 مجموع الرسائل: *' + stats.total + '*\n'
    out += '🗣️ الأعضاء النشطون: *' + stats.active + '*\n'
    if (stats.busiestDay) out += '🔥 أزحم نهار: *' + prettyDay(stats.busiestDay) + '* (' + stats.busiestCount + ' رسالة)\n'
    out += '\n🏆 *الأكثر كلاماً:*\n'
    tops.forEach(function (t, i) {
        const pct = Math.round(t.count * 100 / stats.total)
        out += medals[i] + ' ' + nameOf(conn, t.jid) + ' — ' + t.count + ' رسالة (' + pct + '%)\n'
    })
    if (tops.length) out += '\n👑 ملك الكلام: *' + nameOf(conn, tops[0].jid) + '*'
    if (arg !== 'all') out += '\n📊 منذ بداية العدّ: ' + g.total + ' رسالة (' + prettyDay(g.firstDay) + ')'
    out += '\n\n' + used + command + ' month · ' + used + command + ' all'
    const mentions = tops.map(function (t) { return t.jid })
    try {
        return await conn.sendMessage(m.chat, { text: out, mentions: mentions }, { quoted: m })
    } catch (e) {
        return m.reply(out)
    }
}

handler.help = ['groupwrapped']
handler.tags = ['tools']
handler.command = /^groupwrapped$/i
handler.before = async function (m) { countMessage(m) }
export default handler
                                             
