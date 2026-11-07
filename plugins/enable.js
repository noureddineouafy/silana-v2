let handler = async (m, { conn, usedPrefix, command, args, isOwner, isAdmin }) => {
	const isEnable = /^(true|enable|(turn)?on|1)$/i.test(command);
	const chat = global.db.data.chats[m.chat];
	const user = global.db.data.users[m.sender];
	const settings = global.db.data.settings[conn.user.jid];
	let type = (args[0] || '').toLowerCase();
	let isAll = false;
	let isUser = false;

	switch (type) {
		case 'welcome':
			if (m.isGroup && !(isAdmin || isOwner)) return global.dfail('admin', m, conn);
			chat.welcome = isEnable;
			break;

		case 'detect':
			if (m.isGroup && !(isAdmin || isOwner)) return global.dfail('admin', m, conn);
			chat.detect = isEnable;
			break;

		case 'antidelete':
		case 'delete':
			if (m.isGroup && !(isAdmin || isOwner)) return global.dfail('admin', m, conn);
			chat.delete = isEnable;
			break;

		case 'antilink':
			if (m.isGroup && !(isAdmin || isOwner)) return global.dfail('admin', m, conn);
			chat.antiLink = isEnable;
			break;

		case 'autolevelup':
			isUser = true;
			user.autolevelup = isEnable;
			break;

		case 'autoread':
			isAll = true;
			if (!isOwner) return global.dfail('owner', m, conn);
			settings.autoread = isEnable;
			break;

		case 'public':
			isAll = true;
			if (!isOwner) return global.dfail('owner', m, conn);
			settings.public = isEnable;
			break;

		case 'gconly':
		case 'grouponly':
			isAll = true;
			if (!isOwner) return global.dfail('owner', m, conn);
			settings.gconly = isEnable;
			break;

		case 'anticall':
			isAll = true;
			if (!isOwner) return global.dfail('owner', m, conn);
			settings.anticall = isEnable;
			break;

		default:
			if (!/[01]/.test(command))
				return m.reply(
					`
*List of configurable options:*

*For Users:*
- autolevelup

*For Group Admins:*
- welcome
- detect
- antidelete
- antilink
${
	isOwner
		? `
*For Bot Owners:*
- autoread
- public
- anticall
- gconly
`
		: ''
}

*Usage examples:*
- ${usedPrefix}enable welcome
- ${usedPrefix}disable welcome
`.trim()
				);

			throw false;
	}

	m.reply(
		`*${type}* has been successfully *${
			isEnable ? 'enabled' : 'disabled'
		}* ${isAll ? 'for the bot' : isUser ? '' : 'for this chat'}`
	);
};

handler.help = ['enable', 'disable'];
handler.tags = ['onwer'];
handler.command = /^((en|dis)able|(true|false)|(turn)?(on|off)|[01])$/i;
handler.owner= true
export default handler;
