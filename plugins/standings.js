function fetchT(url, ms) {
    var ctl = new AbortController()
    var t = setTimeout(function () { ctl.abort() }, ms || 20000)
    return fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'SilanaBot' } }).finally(function () { clearTimeout(t) })
}
var LEAGUES = {
    botola: { name: '🇲🇦 البطولة الاحترافية', src: 'tsdb', id: '4520' },
    premier: { name: '🏴 البريميرليغ', src: 'espn', id: 'eng.1' },
    laliga: { name: '🇪🇸 الليغا', src: 'espn', id: 'esp.1' },
    seriea: { name: '🇮🇹 الدوري الإيطالي', src: 'espn', id: 'ita.1' },
    bundesliga: { name: '🇩🇪 البوندسليغا', src: 'espn', id: 'ger.1' },
    ligue1: { name: '🇫🇷 الدوري الفرنسي', src: 'espn', id: 'fra.1' },
    champions: { name: '⭐ دوري أبطال أوروبا', src: 'espn', id: 'uefa.champions' }
}
function seasonStr() {
    var now = new Date()
    var y = now.getFullYear()
    return now.getMonth() >= 7 ? y + '-' + (y + 1) : (y - 1) + '-' + y
}
function statMap(stats) {
    var out = {}
    if (stats) for (var i = 0; i < stats.length; i++) out[stats[i].name] = stats[i].value
    return out
}
async function espnTable(id) {
    var r = await fetchT('https://site.api.espn.com/apis/v2/sports/soccer/' + id + '/standings')
    if (!r.ok) throw new Error('espn ' + r.status)
    var j = await r.json()
    var entries = null
    if (j.children && j.children[0] && j.children[0].standings) entries = j.children[0].standings.entries
    if (!entries && j.standings) entries = j.standings.entries
    if (!entries) throw new Error('no entries')
    var rows = []
    for (var i = 0; i < entries.length; i++) {
        var e = entries[i]
        var s = statMap(e.stats)
        var team = (e.team && (e.team.displayName || e.team.name)) || '?'
        rows.push({ team: team, p: s.gamesPlayed || 0, w: s.wins || 0, d: s.ties || 0, l: s.losses || 0, gd: s.pointDifferential || 0, pts: s.points || 0 })
    }
    return rows
}
async function tsdbTable(id) {
    var r = await fetchT('https://www.thesportsdb.com/api/v1/json/123/lookuptable.php?l=' + id + '&s=' + seasonStr())
    if (!r.ok) throw new Error('tsdb ' + r.status)
    var j = await r.json()
    if (!j.table) throw new Error('no table')
    var rows = []
    for (var i = 0; i < j.table.length; i++) {
        var t = j.table[i]
        rows.push({ team: t.strTeam, p: t.intPlayed, w: t.intWin, d: t.intDraw, l: t.intLoss, gd: t.intGoalDifference, pts: t.intPoints, form: t.strForm || '' })
    }
    return rows
}
let handler = async (m, { text }) => {
    var key = (text || '').trim().toLowerCase()
    if (!key || !LEAGUES[key]) {
        var list = Object.keys(LEAGUES).map(function (k) { return '▸ `.standings ' + k + '` — ' + LEAGUES[k].name }).join('\n')
        return m.reply('📊 *ترتيب البطولات*\n\nاختار بطولة:\n' + list)
    }
    var lg = LEAGUES[key]
    try {
        var rows = lg.src === 'tsdb' ? await tsdbTable(lg.id) : await espnTable(lg.id)
        if (!rows.length) return m.reply('ℹ️ لا توجد بيانات ترتيب متاحة حالياً لهذه البطولة')
        var out = '📊 *' + lg.name + '*\n_لعب | فاز | تعادل | خسر | الفرق | النقاط_\n\n'
        var max = Math.min(rows.length, 20)
        for (var i = 0; i < max; i++) {
            var r2 = rows[i]
            var gd = Number(r2.gd) > 0 ? '+' + r2.gd : '' + r2.gd
            out += (i + 1) + '. *' + r2.team + '*\n    ' + r2.p + ' | ' + r2.w + ' | ' + r2.d + ' | ' + r2.l + ' | ' + gd + ' | *' + r2.pts + '*'
            if (r2.form) out += '  (' + r2.form + ')'
            out += '\n'
        }
        return m.reply(out.trim())
    } catch (e) {
        return m.reply('❌ تعذّر جلب الترتيب الآن، عاود المحاولة من بعد')
    }
}
handler.help = ['standings']
handler.tags = ['morocco']
handler.command = /^(standings)$/i
export default handler
                               
