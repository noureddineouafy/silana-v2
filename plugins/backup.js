// SILANA Backup (v1) — owner-only safety copy of the bot's brain.
//   .backup  -> sends a JSON snapshot of the whole bot database (users,
//   chats, settings, every plugin's stored data) to the owner's DM as a
//   file, plus a small manifest (date, plugin count, data size).
// Sessions/WhatsApp credentials are NEVER included — a backup restores the
// bot's data, not its login (re-pair after a server move, like always).

import { promises as fs } from 'fs'
import path from 'path'

const VER = 'v1'

function safeStringify(obj) {
  const seen = new WeakSet()
  return JSON.stringify(obj, (k, v) => {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return undefined
      seen.add(v)
    }
    return v
  }, 1)
}

function ownerJids() {
  const out = []
  try {
    const raw = (globalThis.owner || [])
    for (const o of raw) {
      const n = Array.isArray(o) ? o[0] : o
      const d = String(n || '').replace(/[^\d]/g, '')
      if (d) out.push(d + '@s.whatsapp.net')
    }
  } catch (e) { /* owner list is best-effort */ }
  return out
}

let handler = async (m, { conn, isOwner }) => {
  if (!isOwner && !m.fromMe) return conn.reply(m.chat, '🔒 Backup is owner-only.', m)
  try {
    await conn.reply(m.chat, '💾 Preparing your backup…', m)
    const data = (globalThis.db && globalThis.db.data) || {}
    const json = safeStringify(data)
    const buf = Buffer.from(json, 'utf8')
    const now = new Date()
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
    let pluginCount = 0
    try {
      const files = await fs.readdir(path.join(process.cwd(), 'plugins'))
      pluginCount = files.filter(f => f.endsWith('.js')).length
    } catch (e) { /* plugins dir name may differ — count is a bonus */ }
    const counts = {}
    for (const k of Object.keys(data)) {
      const v = data[k]
      counts[k] = v && typeof v === 'object' ? Object.keys(v).length : 1
    }
    const manifest =
      '💾 *SILANA BACKUP* (' + VER + ')\n' +
      '━━━━━━━━━━━━━━━\n' +
      '📅 Date: ' + now.toLocaleString('en-GB', { timeZone: 'Africa/Casablanca' }) + ' (Morocco)\n' +
      '🧩 Plugins on server: ' + (pluginCount || 'unknown') + '\n' +
      '🗄️ Data size: ' + (buf.length / 1024).toFixed(1) + ' KB\n' +
      '📦 Sections: ' + Object.keys(counts).map(k => k + ' (' + counts[k] + ')').join(', ') + '\n\n' +
      '_The attached JSON is the bot database. Keep it somewhere safe — anyone holding it can read your bot data. Sessions are not included: after a server move you re-pair the number as usual._'
    const targets = ownerJids()
    const dest = targets.length ? targets[0] : m.chat
    await conn.sendMessage(dest, { document: buf, fileName: 'silana-backup-' + stamp + '.json', mimetype: 'application/json', caption: manifest }, { quoted: m })
    if (dest !== m.chat) await conn.reply(m.chat, '✅ Backup sent to your DM.', m)
  } catch (e) {
    return conn.reply(m.chat, '❌ Backup failed.\n🔧 ' + ((e && e.message) || e), m)
  }
}
handler.help = ['backup']
handler.tags = ['owner']
handler.command = ['backup']
handler.owner = true
export default handler
    
