// SILANA Souk (v1) — a marketplace inside each group.
//   .sell <item> | <price> | <details>   -> post something for sale
//   .souk                                -> see what's for sale in this group
//   .buy <number>                        -> tell the seller you want it
//   .souk mine                           -> your own listings here
//   .souk del <number>                   -> remove your listing (admins: any)
//   .souk clear                          -> empty the group's souk (admins)
// Listings live in the bot database per group and expire after 14 days.

const VER = 'v1'
const MAX_PER_SELLER = 5
const EXPIRE_MS = 14 * 24 * 3600 * 1000

function store() {
  if (!globalThis.db) globalThis.db = { data: {} }
  if (!globalThis.db.data) globalThis.db.data = {}
  const d = globalThis.db.data
  if (!d.souk || typeof d.souk !== 'object' || Array.isArray(d.souk)) d.souk = {}
  return d.souk
}

function groupList(jid) {
  const s = store()
  if (!Array.isArray(s[jid])) s[jid] = []
  const now = Date.now()
  s[jid] = s[jid].filter(it => it && (now - (it.ts || 0)) < EXPIRE_MS)
  return s[jid]
}

const num = jid => String(jid || '').split('@')[0]
const ageTxt = ts => {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 60) return mins + ' min ago'
  if (mins < 1440) return Math.floor(mins / 60) + ' h ago'
  return Math.floor(mins / 1440) + ' d ago'
}
const fmtList = (list) => list.map((it, i) =>
  '*' + (i + 1) + '.* ' + it.item + ' — *' + it.price + '*' +
  (it.desc ? '\n   ' + it.desc : '') +
  '\n   👤 ' + (it.name || num(it.seller)) + ' · ' + ageTxt(it.ts)
).join('\n')

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
  const prefix = usedPrefix || '.'
  const cmd = String(command || '').toLowerCase()
  if (!m.isGroup) return conn.reply(m.chat, '🛒 The souk works in *groups* only — post and shop where the people are.', m)
  const list = groupList(m.chat)
  const help =
    '🛒 *SILANA SOUK* (' + VER + ') — this group\'s marketplace\n' +
    '━━━━━━━━━━━━━━━\n' +
    '• `' + prefix + 'sell <item> | <price> | <details>` — post for sale\n' +
    '• `' + prefix + 'souk` — browse (' + list.length + ' listed now)\n' +
    '• `' + prefix + 'buy <number>` — I tag the seller for you\n' +
    '• `' + prefix + 'souk mine` · `' + prefix + 'souk del <number>`\n' +
    '_Listings expire after 14 days. Max ' + MAX_PER_SELLER + ' per seller._'

  // ── .sell ────────────────────────────────────────────────────────────────
  if (cmd === 'sell') {
    const raw = String(text || '').trim()
    if (!raw) return conn.reply(m.chat, help, m)
    const mine = list.filter(it => it.seller === m.sender)
    if (mine.length >= MAX_PER_SELLER) return conn.reply(m.chat, '⚠️ You already have ' + MAX_PER_SELLER + ' listings here — remove one first with `' + prefix + 'souk del <number>`.', m)
    let item = '', price = '', desc = ''
    if (raw.includes('|')) {
      const parts = raw.split('|').map(s => s.trim())
      item = parts[0] || ''
      price = parts[1] || ''
      desc = parts.slice(2).join(' | ')
    } else {
      const mm = raw.match(/^(.*?)[\s]+(\d[\d\s.,]*\s*(?:dh|mad|درهم)?)$/i)
      if (mm) { item = mm[1].trim(); price = mm[2].trim() } else item = raw
    }
    if (!item) return conn.reply(m.chat, help, m)
    if (!price) price = 'Price on ask'
    if (!/dh|mad|درهم/i.test(price) && /^\d/.test(price)) price = price + ' DH'
    list.push({ seller: m.sender, name: m.pushName || '', item: item.slice(0, 80), price: String(price).slice(0, 30), desc: desc.slice(0, 200), ts: Date.now() })
    return conn.reply(m.chat, '✅ *Listed in the souk!*\n\n' + fmtList([list[list.length - 1]]).replace(/^\*1\.\*/, '*' + list.length + '.*') + '\n\nBuyers will reach you with `' + prefix + 'buy ' + list.length + '`.', m)
  }

  // ── .buy ─────────────────────────────────────────────────────────────────
  if (cmd === 'buy') {
    const n = parseInt(String(text || '').trim(), 10)
    if (!n || n < 1 || n > list.length) return conn.reply(m.chat, 'Usage: `' + prefix + 'buy <number>` — see the numbers with `' + prefix + 'souk`.', m)
    const it = list[n - 1]
    if (it.seller === m.sender) return conn.reply(m.chat, '😄 That one is yours — you can\'t buy from yourself.', m)
    return conn.sendMessage(m.chat, {
      text: '🛎️ @' + num(it.seller) + ' — *' + (m.pushName || num(m.sender)) + '* wants your *' + it.item + '* (' + it.price + ')!\n📲 Buyer: https://wa.me/' + num(m.sender),
      mentions: [it.seller]
    }, { quoted: m })
  }

  // ── .souk (+ subcommands) ────────────────────────────────────────────────
  const arg = String(text || '').trim().toLowerCase()
  if (!arg) {
    if (!list.length) return conn.reply(m.chat, '🛒 The souk is empty here — be the first: `' + prefix + 'sell <item> | <price>`', m)
    return conn.reply(m.chat, '🛒 *Group Souk* — ' + list.length + ' item' + (list.length > 1 ? 's' : '') + '\n━━━━━━━━━━━━━━━\n' + fmtList(list) + '\n\n_Buy with `' + prefix + 'buy <number>`_', m)
  }
  if (arg === 'mine') {
    const mine = list.map((it, i) => ({ it, i })).filter(x => x.it.seller === m.sender)
    if (!mine.length) return conn.reply(m.chat, 'You have nothing listed in this group yet.', m)
    return conn.reply(m.chat, '🛒 *Your listings*\n━━━━━━━━━━━━━━━\n' + mine.map(x => '*' + (x.i + 1) + '.* ' + x.it.item + ' — *' + x.it.price + '*').join('\n'), m)
  }
  if (arg.startsWith('del')) {
    const n = parseInt(arg.replace('del', '').trim(), 10)
    if (!n || n < 1 || n > list.length) return conn.reply(m.chat, 'Usage: `' + prefix + 'souk del <number>`', m)
    const it = list[n - 1]
    let isAdmin = !!isOwner
    if (!isAdmin && it.seller !== m.sender) {
      try {
        const meta = await conn.groupMetadata(m.chat)
        const part = (meta.participants || []).find(x => x.id === m.sender)
        isAdmin = !!(part && (part.admin === 'admin' || part.admin === 'superadmin'))
      } catch (e) { /* metadata is a bonus check */ }
    }
    if (it.seller !== m.sender && !isAdmin) return conn.reply(m.chat, '🔒 You can only remove your own listings (admins can remove any).', m)
    list.splice(n - 1, 1)
    return conn.reply(m.chat, '🗑️ Removed: *' + it.item + '*', m)
  }
  if (arg === 'clear') {
    let isAdmin = !!isOwner
    if (!isAdmin) {
      try {
        const meta = await conn.groupMetadata(m.chat)
        const part = (meta.participants || []).find(x => x.id === m.sender)
        isAdmin = !!(part && (part.admin === 'admin' || part.admin === 'superadmin'))
      } catch (e) { /* ignore */ }
    }
    if (!isAdmin) return conn.reply(m.chat, '🔒 Only group admins or the owner can clear the souk.', m)
    store()[m.chat] = []
    return conn.reply(m.chat, '🧹 Souk cleared — 0 listings.', m)
  }
  return conn.reply(m.chat, help, m)
}
handler.help = ['souk', 'sell', 'buy']
handler.tags = ['morocco']
handler.command = ['souk', 'sell', 'buy']
handler.limit = false
export default handler
