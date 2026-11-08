// plugins/antilink.js — Anti-Link v2 (owner request 2026-11-08)
// v1 (2026-11-07) guarded GROUP invite links only (chat.whatsapp.com).
// A member then promoted his channel inside the official group by hiding a
// whatsapp.com/channel link inside a bot command (.chreact) and deleting the
// message afterwards — outside v1's scope. v2 widens the net:
//   • matches group invites AND channel links (whatsapp.com/channel/...)
//   • scans EVERY member message, commands included — the guard runs the
//     moment the message arrives, so deleting it later changes nothing
//   • same discipline as v1: delete + numbered warning, 3rd warning = kick
// Admins, the owner and the bot are exempt. Delete/kick need the bot to be a
// group admin; otherwise it warns only. Per-group flag: db chats antiLink
// (shared with v1 + .enable/.disable antilink). Side effect, by design:
// .chreact with a channel link no longer works inside a guarded group —
// members can still use it in private chat with the bot.
const LINK_RE = /(chat\.whatsapp\.com(\/[0-9A-Za-z]{20,})?|whatsapp\.com\/channel\/[0-9A-Za-z]{10,})/i
const MAX_WARN = 3

function healChat(jid) {
	global.db = global.db || {}
	global.db.data = global.db.data || {}
	global.db.data.chats = global.db.data.chats || {}
	let chat = global.db.data.chats[jid]
	if (!chat || typeof chat !== 'object') chat = global.db.data.chats[jid] = {}
	if (typeof chat.antiLink !== 'boolean') chat.antiLink = !!chat.antiLink
	if (!chat.antiLinkWarns || typeof chat.antiLinkWarns !== 'object') chat.antiLinkWarns = {}
	return chat
}

let handler = async (m, { conn, args, isOwner, isAdmin }) => {
	if (!m.isGroup) return conn.reply(m.chat, '👥 This command works in groups only.', m)
	if (!(isAdmin || isOwner)) return conn.reply(m.chat, '⛔ Group admins only.', m)
	const chat = healChat(m.chat)
	const sub = (args[0] || '').toLowerCase()
	if (sub === 'on' || sub === '1') {
		chat.antiLink = true
		return conn.reply(m.chat, '🛡️ *Anti-Link ON* — WhatsApp group AND channel links from members will be deleted, with warnings. (Admins are exempt.)', m)
	}
	if (sub === 'off' || sub === '0') {
		chat.antiLink = false
		return conn.reply(m.chat, '🔓 *Anti-Link OFF* — group/channel links are allowed again in this group.', m)
	}
	return conn.reply(m.chat, `🛡️ Anti-Link is currently *${chat.antiLink ? 'ON' : 'OFF'}* in this group.\nUse *.antilink on* or *.antilink off* to change it.\n(You can also use *.enable antilink* / *.disable antilink*.)`, m)
}

handler.before = async (m, { conn, isAdmin, isOwner, isBotAdmin }) => {
	try {
		if (!m || !m.isGroup || m.fromMe) return
		if (isAdmin || isOwner) return
		const text = m.text || ''
		if (!LINK_RE.test(text)) return
		const chat = healChat(m.chat)
		if (!chat.antiLink) return
		if (isBotAdmin) {
			const key = (m.key && m.key.id) ? m.key : { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }
			try { await conn.sendMessage(m.chat, { delete: key }) } catch {}
		}
		const warns = (chat.antiLinkWarns[m.sender] || 0) + 1
		chat.antiLinkWarns[m.sender] = warns
		if (warns >= MAX_WARN && isBotAdmin) {
			delete chat.antiLinkWarns[m.sender]
			try { await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove') } catch {}
			return conn.sendMessage(m.chat, { text: `🚫 @${m.sender.split('@')[0]} was removed — ${MAX_WARN} warnings for posting WhatsApp group/channel links.`, mentions: [m.sender] })
		}
		return conn.sendMessage(m.chat, { text: `⚠️ @${m.sender.split('@')[0]} — WhatsApp group/channel links are not allowed here.${isBotAdmin ? ' Your message was deleted.' : ''} Warning *${warns}/${MAX_WARN}*.`, mentions: [m.sender] })
	} catch {}
}

handler.help = ['antilink']
handler.tags = ['group']
handler.command = /^(antilink)$/i
handler.group = true

export default handler
