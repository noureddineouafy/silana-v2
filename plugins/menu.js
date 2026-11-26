
import os from 'os'

const VERSION_TAG = 'menu v14'
const NEW_DAYS = 30
const STATUS_CACHE_MS = 5 * 60 * 1000

const ART_URL = 'https://i.postimg.cc/15X5MxMs/1001575716-14-mr45.jpg'
const ART_CACHE_MS = 6 * 60 * 60 * 1000
const ART_RETRY_MS = 10 * 60 * 1000
let artCache = { at: 0, buf: null }
async function getArtwork() {
	if (artCache.buf && Date.now() - artCache.at < ART_CACHE_MS) return artCache.buf
	if (!artCache.buf && artCache.at && Date.now() - artCache.at < ART_RETRY_MS) return null
	try {
		const res = await fetch(ART_URL, { signal: AbortSignal.timeout(8000) })
		if (!res.ok) throw new Error('HTTP ' + res.status)
		const type = res.headers.get('content-type') || ''
		if (!type.startsWith('image/')) throw new Error('not an image (' + type + ')')
		const buf = Buffer.from(await res.arrayBuffer())
		if (buf.length < 10000 || buf.length > 5 * 1024 * 1024) throw new Error('bad size ' + buf.length)
		artCache = { at: Date.now(), buf }
		return buf
	} catch (e) {
		console.error('menu v14: artwork fetch failed (menu continues without it):', e && e.message ? e.message : e)
		artCache = { at: Date.now(), buf: null }
		return null
	}
}

function toBoldUnicode(str) {
	const bold = {
		a:'𝐚',b:'𝐛',c:'𝐜',d:'𝐝',e:'𝐞',f:'𝐟',g:'𝐠',h:'𝐡',i:'𝐢',j:'𝐣',
		k:'𝐤',l:'𝐥',m:'𝐦',n:'𝐧',o:'𝐨',p:'𝐩',q:'𝐪',r:'𝐫',s:'𝐬',t:'𝐭',
		u:'𝐮',v:'𝐯',w:'𝐰',x:'𝐱',y:'𝐲',z:'𝐳',
		A:'𝐀',B:'𝐁',C:'𝐂',D:'𝐃',E:'𝐄',F:'𝐅',G:'𝐆',H:'𝐇',I:'𝐈',J:'𝐉',
		K:'𝐊',L:'𝐋',M:'𝐌',N:'𝐍',O:'𝐎',P:'𝐏',Q:'𝐐',R:'𝐑',S:'𝐒',T:'𝐓',
		U:'𝐔',V:'𝐕',W:'𝐖',X:'𝐱',Y:'𝐘',Z:'𝐙',
		0:'𝟎',1:'𝟏',2:'𝟐',3:'𝟑',4:'𝟒',5:'𝟓',6:'𝟔',7:'𝟕',8:'𝟖',9:'𝟗',
	}
	return String(str == null ? '' : str).split('').map(c => bold[c] || c).join('')
}

const categoryColors = {
	main: '🔵', ai: '🟣', downloader: '🟢', uploader: '🟢',
	editor: '🟠', sticker: '🟡', tools: '⚪', infobot: '🔵',
	group: '🟢', owner: '🔴', games: '🟤', morocco: '🟢', other: '⚫',
	calls: '🟣', education: '🟢', fun: '🟡', search: '🔵',
	maps: '🟢', audio: '🟣', tv: '🔵', video: '🟠',
	internet: '⚪', islamic: '🟢', database: '⚫', channel: '🟢',
	nostalgia: '🟡',
}

const translations = {
	en: {
		prefix: 'Prefix', uptime: 'Uptime', ram: 'RAM', status: 'Status',
		commands: 'Commands', plugins: 'Plugins', users: 'Users', views: 'Menu Views',
		tapMenu: '✦ Tap 📂 Menu List below to switch category',
		notFound: 'Category not found, showing full menu.', empty: '(empty)',
		whatsNew: "What's New", newDesc: 'Commands added in the last', days: 'days',
		noNew: '(no new commands right now)',
		listTitle: 'Categories',
		topFeatures: 'Top Features', topDesc: 'The flagship commands of the bot',
		discoverRow: 'Discover a Feature', discoverDesc: 'A random feature, explained',
		searchRow: 'Search Commands', searchDesc: 'Type .menu + a word, e.g. .menu tv',
		requestRow: 'Request a Feature', requestDesc: 'Your idea goes straight to the owner',
		searchTitle: 'Search results for', searchNone: 'No command matches that word. Try another word, or open the full menu.',
		searchHint: '🔍 *Search*\nType .menu followed by a word and I will find the commands for you.\nExample: .menu tv',
		discoverTitle: '🎲 *Discover a feature*',
		discoverIn: 'Section',
		discoverTry: 'Try it now: send',
		requestPrompt: '❓ *Request a Feature*\nDescribe the feature you wish the bot had, and send it as your next message — it goes straight to the owner.\n⏳ You have 5 minutes. Using any command cancels it.',
		langRow: 'Language', langDesc: 'العربية • English • Français',
		liveStats: '📊 Live', statsMembers: 'members', statsTodayTxt: 'commands today', statsTopTxt: 'most used',
		simpleWelcome: '👋 *Welcome!* Here are the essentials — tap 📂 Full Menu any time to see everything.', fullMenuRow: 'Full Menu', fullMenuDesc: 'See every section and command',
		langPrompt: '🌐 *Menu Language*\nChoose your language:',
		requestLabel: '❓ *Feature request*',
		feedbackLabel: '💌 *Bot feedback*',
		sentOk: '✅ Thanks! Your message was sent to the owner.',
		tips: [
			'💡 Tip: type .menu <category> to jump straight to a section.',
			'💡 Tip: 🆕 next to a command means it was added recently.',
			'💡 Tip: 🔥 marks the most used commands right now.',
			'💡 Tip: 🔒 means the command has a usage limit.',
			'💡 Tip: 💎 means the command is premium-only.',
			'💡 Tip: type .menu new to see everything added recently.',
			'💡 Tip: type .menu top for the flagship features.',
			'💡 Tip: type .menu discover and meet a feature you never tried.',
			'💡 Tip: type .menu + any word to search commands, e.g. .menu tv.',
			'💡 Tip: type .lang ar|fr|en to change the menu language.',
		],
	},
	ar: {
		prefix: 'البادئة', uptime: 'مدة التشغيل', ram: 'الذاكرة', status: 'الحالة',
		commands: 'الأوامر', plugins: 'الإضافات', users: 'المستخدمون', views: 'مشاهدات المنيو',
		tapMenu: '✦ اضغط 📂 قائمة الأوامر بالأسفل للتنقل بين الأقسام',
		notFound: 'القسم غير موجود، سيتم عرض القائمة الكاملة.', empty: '(فارغ)',
		whatsNew: 'الجديد', newDesc: 'أوامر تمت إضافتها في آخر', days: 'يوم',
		noNew: '(لا يوجد أوامر جديدة حاليا)',
		listTitle: 'الأقسام',
		topFeatures: 'الأكثر استعمالا', topDesc: 'أقوى أوامر البوت',
		discoverRow: 'اكتشف ميزة', discoverDesc: 'ميزة عشوائية مع الشرح',
		searchRow: 'بحث في الأوامر', searchDesc: 'اكتب .menu + كلمة، مثال: .menu tv',
		requestRow: 'طلب ميزة', requestDesc: 'فكرتك توصل مباشرة للمالك',
		searchTitle: 'نتائج البحث عن', searchNone: 'لا يوجد أمر يطابق هذه الكلمة. جرب كلمة أخرى أو افتح القائمة الكاملة.',
		searchHint: '🔍 *بحث*\nاكتب .menu متبوعة بكلمة وسأجد لك الأوامر.\nمثال: .menu tv',
		discoverTitle: '🎲 *اكتشف ميزة*',
		discoverIn: 'القسم',
		discoverTry: 'جربها الآن: أرسل',
		requestPrompt: '❓ *طلب ميزة*\nصف الميزة التي تتمنى أن تكون في البوت، وأرسلها في رسالتك التالية — تصل مباشرة إلى المالك.\n⏳ عندك 5 دقائق. استعمال أي أمر يلغي الطلب.',
		langRow: 'اللغة', langDesc: 'العربية • English • Français',
		liveStats: '📊 مباشر', statsMembers: 'عضو', statsTodayTxt: 'أمر اليوم', statsTopTxt: 'الأكثر استعمالاً',
		simpleWelcome: '👋 *مرحباً بك!* هادو هما الأساسيات — اضغط 📂 القائمة الكاملة في أي وقت باش تشوف كولشي.', fullMenuRow: 'القائمة الكاملة', fullMenuDesc: 'شوف جميع الأقسام والأوامر',
		langPrompt: '🌐 *لغة القائمة*\nاختر لغتك:',
		requestLabel: '❓ *طلب ميزة*',
		feedbackLabel: '💌 *ملاحظة على البوت*',
		sentOk: '✅ شكرا! رسالتك وصلت إلى المالك.',
		tips: [
			'💡 نصيحة: اكتب .menu <القسم> للوصول مباشرة لقسم معين.',
			'💡 نصيحة: 🆕 جانب الأمر تعني أنه أضيف مؤخرا.',
			'💡 نصيحة: 🔥 تعني أن هذا الأمر من الأكثر استعمالا.',
			'💡 نصيحة: 🔒 تعني أن الأمر له حد استعمال محدود.',
			'💡 نصيحة: 💎 تعني أن الأمر خاص بالمستخدمين المميزين.',
			'💡 نصيحة: اكتب .menu new لرؤية كل الأوامر المضافة مؤخرا.',
			'💡 نصيحة: اكتب .menu top لرؤية أقوى الميزات.',
			'💡 نصيحة: اكتب .menu discover واكتشف ميزة لم تجربها.',
			'💡 نصيحة: اكتب .menu + أي كلمة للبحث في الأوامر، مثال: .menu tv.',
			'💡 نصيحة: اكتب .lang ar|fr|en لتغيير لغة القائمة.',
		],
	},
	fr: {
		prefix: 'Préfixe', uptime: 'Uptime', ram: 'RAM', status: 'Statut',
		commands: 'Commandes', plugins: 'Plugins', users: 'Utilisateurs', views: 'Vues du menu',
		tapMenu: '✦ Appuyez sur 📂 Menu List ci-dessous pour changer de catégorie',
		notFound: 'Catégorie introuvable, menu complet affiché.', empty: '(vide)',
		whatsNew: 'Nouveautés', newDesc: 'Commandes ajoutées ces derniers', days: 'jours',
		noNew: '(aucune nouvelle commande pour le moment)',
		listTitle: 'Catégories',
		topFeatures: 'Top Fonctionnalités', topDesc: 'Les commandes phares du bot',
		discoverRow: 'Découvrir une fonction', discoverDesc: 'Une fonction au hasard, expliquée',
		searchRow: 'Rechercher', searchDesc: 'Tapez .menu + un mot, ex. .menu tv',
		requestRow: 'Demander une fonction', requestDesc: 'Votre idée va droit au propriétaire',
		searchTitle: 'Résultats pour', searchNone: 'Aucune commande ne correspond à ce mot. Essayez un autre mot ou ouvrez le menu complet.',
		searchHint: '🔍 *Recherche*\nTapez .menu suivi d\'un mot et je trouverai les commandes.\nExemple : .menu tv',
		discoverTitle: '🎲 *Découvrez une fonction*',
		discoverIn: 'Section',
		discoverTry: 'Essayez-la : envoyez',
		requestPrompt: '❓ *Demander une fonction*\nDécrivez la fonction que vous souhaitez, et envoyez-la dans votre prochain message — elle va droit au propriétaire.\n⏳ Vous avez 5 minutes. Toute commande annule la demande.',
		langRow: 'Langue', langDesc: 'العربية • English • Français',
		liveStats: '📊 En direct', statsMembers: 'membres', statsTodayTxt: "commandes aujourd'hui", statsTopTxt: 'le plus utilisé',
		simpleWelcome: '👋 *Bienvenue !* Voici l\'essentiel — touchez 📂 Menu complet pour tout voir.', fullMenuRow: 'Menu complet', fullMenuDesc: 'Voir toutes les sections et commandes',
		langPrompt: '🌐 *Langue du menu*\nChoisissez votre langue :',
		requestLabel: '❓ *Demande de fonction*',
		feedbackLabel: '💌 *Avis sur le bot*',
		sentOk: '✅ Merci ! Votre message a été envoyé au propriétaire.',
		tips: [
			'💡 Astuce : tapez .menu <catégorie> pour accéder directement à une section.',
			'💡 Astuce : 🆕 signifie que la commande a été ajoutée récemment.',
			'💡 Astuce : 🔥 marque les commandes les plus utilisées.',
			"💡 Astuce : 🔒 signifie que la commande a une limite d'utilisation.",
			'💡 Astuce : 💎 signifie que la commande est réservée aux membres premium.',
			'💡 Astuce : tapez .menu new pour voir tout ce qui a été ajouté récemment.',
			'💡 Astuce : tapez .menu top pour les fonctions phares.',
			'💡 Astuce : tapez .menu discover pour découvrir une fonction.',
			'💡 Astuce : tapez .menu + un mot pour rechercher, ex. .menu tv.',
			'💡 Astuce : tapez .lang ar|fr|en pour changer la langue du menu.',
		],
	},
}

const TAG_ORDER = ['main', 'ai', 'calls', 'downloader', 'uploader', 'editor', 'sticker', 'tools', 'education', 'morocco', 'islamic', 'games', 'fun', 'group', 'search', 'maps', 'tv', 'video', 'audio', 'internet', 'database', 'channel', 'nostalgia', 'infobot', 'owner', 'other']
const TAG_STYLE = {
	main: { title: 'Main Menu', emoji: '🏠' },
	ai: { title: 'AI Menu', emoji: '🤖' },
	calls: { title: 'Calls Menu', emoji: '📞' },
	downloader: { title: 'Downloader Menu', emoji: '📥' },
	uploader: { title: 'Uploader Menu', emoji: '📤' },
	editor: { title: 'Editor Menu', emoji: '🎨' },
	sticker: { title: 'Sticker Menu', emoji: '🎟' },
	tools: { title: 'Tools Menu', emoji: '🛠' },
	education: { title: 'Education Menu', emoji: '🎓' },
	morocco: { title: 'Morocco Menu', emoji: '🇲🇦' },
	islamic: { title: 'Islamic Menu', emoji: '🕌' },
	games: { title: 'Games Menu', emoji: '🎮' },
	fun: { title: 'Fun Menu', emoji: '🎉' },
	group: { title: 'Group Menu', emoji: '👥' },
	search: { title: 'Search Menu', emoji: '🔍' },
	maps: { title: 'Maps Menu', emoji: '🗺️' },
	tv: { title: 'TV Menu', emoji: '📺' },
	video: { title: 'Video Menu', emoji: '🎬' },
	audio: { title: 'Audio Menu', emoji: '🎧' },
	internet: { title: 'Internet Menu', emoji: '🌐' },
	database: { title: 'Database Menu', emoji: '🗄️' },
	channel: { title: 'Channel Menu', emoji: '📢' },
	nostalgia: { title: 'Nostalgia Menu', emoji: '🕰️' },
	infobot: { title: 'Info Menu', emoji: 'ℹ️' },
	owner: { title: 'Owner Menu', emoji: '👑' },
	other: { title: 'Other Menu', emoji: '📦' },
}
// Duplicate / mistyped tags used by some plugins are merged into one section.
const TAG_ALIAS = {
	game: 'games',
	games2: 'games',
	groups: 'group',
	info: 'infobot',
	onwer: 'owner',
	ownermenu: 'owner',
	ia: 'ai',
}
function normalizeTag(raw) {
	const base = String(raw == null ? '' : raw).trim().toLowerCase()
	if (!base) return ''
	return TAG_ALIAS[base] || base
}
// Curated ⭐ Top Features: first words of the flagship commands, in order.
const TOP_COMMANDS = ['callme', 'tvcall', 'groom', 'radiocall', 'doroos', 'bac', 'faceblur', 'blur', 'videocall', 'sub', 'dub', 'predict', 'manhwa', 'grouptheme', 'podcast']
function tagStyle(tag) {
	if (TAG_STYLE[tag]) return TAG_STYLE[tag]
	const pretty = String(tag).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
	return { title: pretty + ' Menu', emoji: '🧩' }
}

function t(lang, key) {
	const dict = translations[lang] || translations.en
	return dict[key] !== undefined ? dict[key] : translations.en[key]
}

function healDb() {
	if (!global.db) global.db = {}
	if (!global.db.data || typeof global.db.data !== 'object') global.db.data = {}
	const d = global.db.data
	if (!d.users || typeof d.users !== 'object') d.users = {}
	if (!d.stats || typeof d.stats !== 'object') d.stats = {}
	if (!d.settings || typeof d.settings !== 'object') d.settings = {}
	return d
}

const feedbackPending = new Map()
const feedbackCooldown = new Map()

const handler = async (m, { conn, usedPrefix: _p, command, isOwner, args }) => {

	const rawArgs = ((args || []).join(' ') || '').trim().toLowerCase()
	let teks = rawArgs.split(/\s+/)[0] || ''
	const showNewOnly = teks === 'new'
	const showTopOnly = teks === 'top'
	const showSimpleOnly = teks === 'simple'
	const langCodeArg = (teks === 'lang' && ['ar', 'fr', 'en'].includes(rawArgs.split(/\s+/)[1])) ? rawArgs.split(/\s+/)[1] : null
	const LANG_SET_MSG = { ar: '✅ تم تغيير لغة القائمة إلى العربية', en: '✅ Menu language changed to English', fr: '✅ Langue du menu : français' }

	const data = healDb()
	const earlyUser = (data.users && data.users[m.sender]) || {}
	const earlyLang = ['ar', 'fr', 'en'].includes(earlyUser.lang) ? earlyUser.lang : 'en'

	if (teks === 'feedback' || teks === 'request') {
		const lastF = feedbackCooldown.get(m.sender) || 0
		if (Date.now() - lastF < 10 * 60 * 1000) {
			await conn.reply(m.chat, '⏳ You already sent feedback recently — please try again in a few minutes.', m)
			return
		}
		feedbackPending.set(m.chat + '|' + m.sender, { at: Date.now(), kind: teks, lang: earlyLang })
		if (teks === 'request') {
			await conn.reply(m.chat, t(earlyLang, 'requestPrompt'), m)
		} else {
			await conn.reply(m.chat, '💌 *Feedback*\nWrite your opinion about the bot, or a feature you wish for, and send it as your next message — it goes straight to the owner.\n⏳ You have 5 minutes. Using any command cancels it.', m)
		}
		return
	}

	try {
		const now = Date.now()

		if (!data.users[m.sender] || typeof data.users[m.sender] !== 'object') data.users[m.sender] = {}
		let user = data.users[m.sender]
		if (langCodeArg) user.lang = langCodeArg
		const isFirstMenuOpen = !user.menuSeen
		user.menuSeen = true
		const simpleMode = showSimpleOnly || (isFirstMenuOpen && !isOwner && !rawArgs)
		const lang = ['ar', 'fr', 'en'].includes(user.lang) ? user.lang : 'en'
		const botName = (conn.user && conn.user.name) || global.namebot || 'SILANA BOT'

		const defaultMenu = {
			before: `
╭━━━⪩ ${toBoldUnicode(botName)} ⪨━━━⬣
┃ 👋 ${ucapan()}, %name
┃ 🔧 ${t(lang, 'prefix')}: %prefix   ✨ v%version
┃
┃ 📅 %week, %date
┃ 🌙 %hijri
┃ ⏱ ${t(lang, 'uptime')}: %uptime
┃ 💾 ${t(lang, 'ram')}: %ram
┃ 📡 ${t(lang, 'status')}: %status
┃
┃ 📦 ${t(lang, 'commands')}: %totalcmd | ${t(lang, 'plugins')}: %totalplugins
┃ 👥 ${t(lang, 'users')}: %rtotalreg/%totalreg
┃ 👁 ${t(lang, 'views')}: %views
╰━━━━━━━━━━━━━━━⬣
%tip
%readmore`.trim(),
			newBefore: `
╭━━━⪩ 🆕 ${toBoldUnicode(t(lang, 'whatsNew'))} ⪨━━━⬣
┃ ${t(lang, 'newDesc')} ${NEW_DAYS} ${t(lang, 'days')}
╰━━━━━━━━━━━━━━━⬣
%readmore`.trim(),
			topBefore: `
╭━━━⪩ ⭐ ${toBoldUnicode(t(lang, 'topFeatures'))} ⪨━━━⬣
┃ ${t(lang, 'topDesc')}
╰━━━━━━━━━━━━━━━⬣
%readmore`.trim(),
			header: '\n╭─⪩ %emoji %color %category ⪨─ (%count)\n│ %bar',
			body: '│ %index. %cmd%flags',
			footer: '╰────────────⬣',
			after: `\n> ${t(lang, 'tapMenu')}`,
		}

		if (!data.stats.pluginFirstSeen || typeof data.stats.pluginFirstSeen !== 'object') data.stats.pluginFirstSeen = {}
		const firstSeenMap = data.stats.pluginFirstSeen
		const isFirstBoot = Object.keys(firstSeenMap).length === 0

		const pluginEntries = (global.plugins && typeof global.plugins === 'object') ? Object.entries(global.plugins) : []
		const help = pluginEntries
			.filter(([_, p]) => p && !p.disabled)
			.map(([filename, p]) => {
				if (!(filename in firstSeenMap)) {
					firstSeenMap[filename] = isFirstBoot ? now - (NEW_DAYS + 1) * 86400000 : now
				}
				const isNewBool = now - firstSeenMap[filename] < NEW_DAYS * 86400000
				const helpList = (Array.isArray(p.help) ? p.help : (p.help != null ? [p.help] : []))
					.map(h => String(h == null ? '' : h).trim()).filter(Boolean)
				const tagList = [...new Set((Array.isArray(p.tags) ? p.tags : (p.tags != null ? [p.tags] : []))
					.map(x => normalizeTag(x)).filter(Boolean))]
				return {
					help: helpList,
					tags: tagList.length ? tagList : ['other'],
					prefix: 'customPrefix' in p,
					limit: p.limit ? '🔒' : '',
					premium: p.premium ? '💎' : '',
					owner: p.owner ? '🄾' : '',
					isNew: isNewBool ? '🆕' : '',
					isNewBool,
					popular: p.popular ? '🔥' : '',
				}
			})
			.filter(p => p.help.length)

		const totalcmd = help.reduce((a, p) => a + p.help.length, 0)
		const totalplugins = help.length
		const totalNew = help.filter(p => p.isNewBool).reduce((a, p) => a + p.help.length, 0)

		const allTags = {}
		{
			const found = new Set()
			for (const p of help) {
				if (p.tags.length) for (const tg of p.tags) found.add(tg)
				else found.add('other')
			}
			const ordered = [
				...TAG_ORDER.filter(tg => found.has(tg)),
				...[...found].filter(tg => !TAG_ORDER.includes(tg)).sort(),
			]
			for (const tg of ordered) allTags[tg] = tagStyle(tg)
		}
		let invalidCategory = !!(teks && teks !== 'all' && !showNewOnly && !showTopOnly && !['discover', 'random', 'search', 'request', 'feedback', 'lang', 'simple'].includes(teks) && !Object.keys(allTags).includes(teks))
		const routeWord = teks
		if (showNewOnly || showTopOnly || !Object.keys(allTags).includes(teks)) teks = 'all'
		let tags = teks === 'all' ? { ...allTags } : { [teks]: allTags[teks] }
		if (!isOwner) delete tags.owner
		if (!m.isGroup) delete tags.group
		const visibleTags = { ...allTags }
		if (!isOwner) delete visibleTags.owner
		if (!m.isGroup) delete visibleTags.group

		const countsByTag = Object.keys(visibleTags).map(tag =>
			help.filter(p => p.tags.includes(tag)).reduce((a, p) => a + p.help.length, 0)
		)
		const maxCount = Math.max(...countsByTag, 1)

		const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }
		const rows = [
			...Object.keys(visibleTags).map(tag => {
				const count = help.filter(p => p.tags.includes(tag)).reduce((a, p) => a + p.help.length, 0)
				return {
					title: cut(`${visibleTags[tag].emoji} ${visibleTags[tag].title}`, 24),
					description: cut(`${count} command${count === 1 ? '' : 's'}`, 72),
					id: `${_p + command} ${tag}`,
				}
			}),
			{
				title: cut(`🆕 ${t(lang, 'whatsNew')}`, 24),
				description: cut(`${totalNew} command${totalNew === 1 ? '' : 's'}`, 72),
				id: `${_p + command} new`,
			},
			{
				title: cut(`⭐ ${t(lang, 'topFeatures')}`, 24),
				description: cut(t(lang, 'topDesc'), 72),
				id: `${_p + command} top`,
			},
			{
				title: cut(`🎲 ${t(lang, 'discoverRow')}`, 24),
				description: cut(t(lang, 'discoverDesc'), 72),
				id: `${_p + command} discover`,
			},
			{
				title: cut(`🔍 ${t(lang, 'searchRow')}`, 24),
				description: cut(t(lang, 'searchDesc'), 72),
				id: `${_p + command} search`,
			},
			{
				title: cut(`❓ ${t(lang, 'requestRow')}`, 24),
				description: cut(t(lang, 'requestDesc'), 72),
				id: `${_p + command} request`,
			},
			{
				title: cut(`🌐 ${t(lang, 'langRow')}`, 24),
				description: cut(t(lang, 'langDesc'), 72),
				id: `${_p + command} lang`,
			},
		]

		if (simpleMode) {
			rows.length = 0
			rows.push(
				{
					title: cut(`⭐ ${t(lang, 'topFeatures')}`, 24),
					description: cut(t(lang, 'topDesc'), 72),
					id: `${_p + command} top`,
				},
				{
					title: cut(`📂 ${t(lang, 'fullMenuRow')}`, 24),
					description: cut(t(lang, 'fullMenuDesc'), 72),
					id: `${_p + command}`,
				},
				{
					title: cut(`🌐 ${t(lang, 'langRow')}`, 24),
					description: cut(t(lang, 'langDesc'), 72),
					id: `${_p + command} lang`,
				},
			)
		}

		// v12: 🌐 Language picker — three quick replies, plain-text fallback.
		if (routeWord === 'lang' && !langCodeArg) {
			const langButtons = [
				{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🇲🇦 العربية', id: _p + command + ' lang ar' }) },
				{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🇬🇧 English', id: _p + command + ' lang en' }) },
				{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🇫🇷 Français', id: _p + command + ' lang fr' }) },
			]
			let pickerSent = false
			if (typeof conn.sendButton === 'function') {
				try { await conn.sendButton(m.chat, { text: t(lang, 'langPrompt'), footer: `${global.namebot || 'SILANA BOT'} • ${VERSION_TAG}`, buttons: langButtons }, { quoted: m }); pickerSent = true } catch (eL) { console.error('menu v14: lang picker failed:', eL && eL.message ? eL.message : eL) }
			}
			if (!pickerSent) {
				await conn.reply(m.chat, t(lang, 'langPrompt') + '\n• ' + _p + command + ' lang ar — العربية\n• ' + _p + command + ' lang en — English\n• ' + _p + command + ' lang fr — Français', m)
			}
			return
		}

		// v11: 🎲 Discover — one random feature, explained in a small card.
		if (routeWord === 'discover' || routeWord === 'random') {
			const pool = []
			for (const p of help) {
				if (!isOwner && p.tags.includes('owner')) continue
				for (const h of p.help) pool.push({ h, p })
			}
			if (pool.length) {
				const pick = pool[Math.floor(Math.random() * pool.length)]
				const cmdStr = pick.p.prefix ? pick.h : `${_p}${pick.h}`
				const st = tagStyle(pick.p.tags[0] || 'other')
				const flags = [pick.p.isNew, pick.p.popular, pick.p.premium, pick.p.limit].filter(Boolean).join(' ')
				await conn.reply(m.chat, `${t(lang, 'discoverTitle')}\n\n${st.emoji} *${cmdStr}*${flags ? ' ' + flags : ''}\n📂 ${t(lang, 'discoverIn')}: ${st.title}\n\n${t(lang, 'discoverTry')} *${cmdStr}*`, m)
				return
			}
		}

		// v11: 🔍 Search — `.menu search <word>`, `.menu <word>`, or the Search row.
		const searchTerm = routeWord === 'search' ? rawArgs.slice(6).trim() : (invalidCategory ? rawArgs : '')
		if (routeWord === 'search' && !searchTerm) {
			await conn.reply(m.chat, t(lang, 'searchHint'), m)
			return
		}
		if (searchTerm) {
			const seenCmd = new Set()
			const matches = []
			for (const p of help) {
				if (!isOwner && p.tags.includes('owner')) continue
				for (const h of p.help) {
					const hl = h.toLowerCase()
					if (!hl.includes(searchTerm) && !p.tags.some(tg => tg.includes(searchTerm))) continue
					const cmdStr = p.prefix ? h : `${_p}${h}`
					if (seenCmd.has(cmdStr)) continue
					seenCmd.add(cmdStr)
					matches.push({ cmd: cmdStr, tag: p.tags[0] || 'other' })
				}
			}
			matches.sort((a, b) => a.cmd.localeCompare(b.cmd))
			if (!matches.length) {
				await conn.reply(m.chat, `🔍 ${t(lang, 'searchNone')}`, m)
			} else {
				const lines = matches.slice(0, 25).map(x => {
					const st = tagStyle(x.tag)
					return `• *${x.cmd}* — ${st.emoji} ${st.title}`
				})
				await conn.reply(m.chat, `🔍 *${t(lang, 'searchTitle')} "${searchTerm}"* (${matches.length})\n\n${lines.join('\n')}${matches.length > 25 ? '\n…' : ''}`, m)
			}
			return
		}

		let text
		if (showNewOnly) {
			const sections = Object.keys(allTags).map(tag => {
				const filtered = help.filter(p => p.tags.includes(tag))
				const list = []
				for (const p of filtered) {
					for (const h of p.help) {
						if (!p.isNewBool) continue
						list.push(p.prefix ? h : `${_p}${h}`)
					}
				}
				list.sort((a, b) => a.localeCompare(b))
				if (!list.length) return ''
				const items = list.map((cmd, i) =>
					defaultMenu.body
						.replace(/%index/g, String(i + 1).padStart(2, '0'))
						.replace(/%cmd/g, cmd)
						.replace(/%flags/g, ' 🆕')
				)
				return `${defaultMenu.header
					.replace('%emoji', allTags[tag].emoji)
					.replace('%color', categoryColors[tag] || '⚪')
					.replace('%category', toBoldUnicode(allTags[tag].title))
					.replace('%count', String(list.length))
					.replace('%bar', '')}\n${items.join('\n')}\n${defaultMenu.footer}`
			}).filter(Boolean)

			text = [
				defaultMenu.newBefore,
				...(sections.length ? sections : [`\n${t(lang, 'noNew')}`]),
			].join('\n')
		} else if (showTopOnly) {
			const items = []
			for (const name of TOP_COMMANDS) {
				for (const p of help) {
					for (const h of p.help) {
						if (h.split(/\s+/)[0].toLowerCase() !== name) continue
						const flags = [p.isNew, p.popular, p.owner, p.premium, p.limit].filter(Boolean).join(' ')
						items.push({ cmd: p.prefix ? h : `${_p}${h}`, flags: flags ? ` ${flags}` : '' })
					}
				}
			}
			const lines = items.map((entry, i) =>
				defaultMenu.body
					.replace(/%index/g, String(i + 1).padStart(2, '0'))
					.replace(/%cmd/g, entry.cmd)
					.replace(/%flags/g, entry.flags)
			)
			text = [
				defaultMenu.topBefore,
				lines.length ? `${defaultMenu.header
					.replace('%emoji', '⭐')
					.replace('%color', '🟡')
					.replace('%category', toBoldUnicode(t(lang, 'topFeatures')))
					.replace('%count', String(lines.length))
					.replace('%bar', '')}\n${lines.join('\n')}\n${defaultMenu.footer}` : `\n${t(lang, 'empty')}`,
			].join('\n')
		} else if (simpleMode) {
			const items = []
			for (const name of TOP_COMMANDS) {
				for (const p of help) {
					for (const h of p.help) {
						if (h.split(/\s+/)[0].toLowerCase() !== name) continue
						const flags = [p.isNew, p.popular, p.owner, p.premium, p.limit].filter(Boolean).join(' ')
						items.push({ cmd: p.prefix ? h : `${_p}${h}`, flags: flags ? ` ${flags}` : '' })
					}
				}
			}
			const lines = items.map((entry, i) =>
				defaultMenu.body
					.replace(/%index/g, String(i + 1).padStart(2, '0'))
					.replace(/%cmd/g, entry.cmd)
					.replace(/%flags/g, entry.flags)
			)
			text = [
				t(lang, 'simpleWelcome'),
				lines.length ? `${defaultMenu.header
					.replace('%emoji', '⭐')
					.replace('%color', '🟡')
					.replace('%category', toBoldUnicode(t(lang, 'topFeatures')))
					.replace('%count', String(lines.length))
					.replace('%bar', '')}\n${lines.join('\n')}\n${defaultMenu.footer}` : `\n${t(lang, 'empty')}`,
			].join('\n')
		} else {
			text = [
				defaultMenu.before,
				...Object.keys(tags).map(tag => {
					const filtered = help.filter(p => p.tags.includes(tag))
					const list = []
					for (const p of filtered) {
						for (const h of p.help) {
							const cmd = p.prefix ? h : `${_p}${h}`
							const flags = [p.isNew, p.popular, p.owner, p.premium, p.limit].filter(Boolean).join(' ')
							list.push({ cmd, flags: flags ? ` ${flags}` : '' })
						}
					}
					list.sort((a, b) => a.cmd.localeCompare(b.cmd))
					const items = list.map((entry, i) =>
						defaultMenu.body
							.replace(/%index/g, String(i + 1).padStart(2, '0'))
							.replace(/%cmd/g, entry.cmd)
							.replace(/%flags/g, entry.flags)
					)
					const count = list.length
					const filled = Math.max(1, Math.round((count / maxCount) * 10))
					const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled)
					return `${defaultMenu.header
						.replace('%emoji', tags[tag].emoji)
						.replace('%color', categoryColors[tag] || '⚪')
						.replace('%category', toBoldUnicode(tags[tag].title))
						.replace('%count', String(count))
						.replace('%bar', bar)}\n${items.join('\n') || `│ ${t(lang, 'empty')}`}\n${defaultMenu.footer}`
				}),
				invalidCategory ? `\n⚠️ ${t(lang, 'notFound')}` : '',
				defaultMenu.after,
			].filter(Boolean).join('\n')
		}

		let name = user.registered && user.name ? user.name : 'صديقي'
		if (!user.registered && typeof conn.getName === 'function') {
			try { name = (await conn.getName(m.sender)) || name } catch {}
		}
		let uptime = clockString(process.uptime() * 1000)
		let ram = ramUsage()
		let status = await checkStatus()

		let totalreg = Object.keys(data.users).length
		let rtotalreg = Object.values(data.users).filter(u => u && u.registered).length

		data.stats.menuViews = (data.stats.menuViews || 0) + 1
		let views = data.stats.menuViews

		let d = new Date()
		let locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-US'
		let week = d.toLocaleDateString(locale, { weekday: 'long' })
		let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
		let hijri = ''
		try { hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) } catch { hijri = '' }

		const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
		const tipList = t(lang, 'tips')
		const tip = tipList[dayOfYear % tipList.length]

		const replace = {
			'%': '',
			p: _p,
			prefix: _p,
			uptime,
			me: botName,
			name,
			week,
			date,
			hijri,
			totalreg,
			rtotalreg,
			totalcmd,
			totalplugins,
			ram,
			status,
			version: global.version || '1.0.0',
			tip,
			views,
			readmore: readMore,
		}
		const sortedKeys = Object.keys(replace).sort((a, b) => b.length - a.length)
		let finalText = text.replace(
			new RegExp(`%(${sortedKeys.join('|')})`, 'g'),
			(_, key) => String(replace[key] == null ? '' : replace[key])
		)
		if (!hijri) finalText = finalText.split('\n').filter(l => !l.includes('🌙')).join('\n')
		try {
			const stLive = data.stats || {}
			const statParts = [`👥 ${totalreg} ${t(lang, 'statsMembers')}`]
			const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date())
			const todayCmds = stLive.days && stLive.days[dayKey] ? stLive.days[dayKey].cmds : null
			if (typeof todayCmds === 'number') statParts.push(`⚡ ${todayCmds} ${t(lang, 'statsTodayTxt')}`)
			if (stLive.commands && typeof stLive.commands === 'object') {
				const topEntry = Object.entries(stLive.commands).filter(([, v]) => typeof v === 'number').sort((a, b) => b[1] - a[1])[0]
				if (topEntry) statParts.push(`🔥 ${t(lang, 'statsTopTxt')}: ${_p}${topEntry[0]}`)
			}
			const statsLine = `${t(lang, 'liveStats')}: ${statParts.join(' • ')}`
			const nlPos = finalText.indexOf('\n')
			finalText = nlPos > 0 ? finalText.slice(0, nlPos) + '\n' + statsLine + finalText.slice(nlPos) : statsLine + '\n' + finalText
		} catch {}
		if (langCodeArg) finalText = LANG_SET_MSG[langCodeArg] + '\n\n' + finalText
		const footerText = `${global.namebot || 'SILANA BOT'} • ${VERSION_TAG} • ${new Date().toLocaleTimeString('en-US')}`

		const buttons = [
			{
				name: 'single_select',
				buttonParamsJson: JSON.stringify({
					title: '📂 Menu List',
					sections: [{ title: t(lang, 'listTitle'), rows }],
				}),
			},
			{
				name: 'cta_url',
				buttonParamsJson: JSON.stringify({
					display_text: '📢 قناة صاحب البوت',
					url: 'https://whatsapp.com/channel/0029VaX4b6J7DAWqt3Hhu01A',
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: `🌐 ${t(lang, 'langRow')}`,
					id: _p + command + ' lang',
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: `🆕 ${t(lang, 'whatsNew')}`,
					id: _p + command + ' new',
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '💌 Feedback',
					id: _p + command + ' feedback',
				}),
			},
			{
				name: 'quick_reply',
				buttonParamsJson: JSON.stringify({
					display_text: '👑 Contact Owner',
					id: _p + 'owner',
				}),
			},
		]

		const art = await getArtwork()
		const sendAttempts = []
		if (art) {
			sendAttempts.push({ image: art, caption: finalText, footer: footerText, buttons })
			sendAttempts.push({ image: { url: ART_URL }, caption: finalText, footer: footerText, buttons })
		}
		sendAttempts.push({ text: finalText, footer: footerText, buttons })

		let firstErr = null
		if (typeof conn.sendButton === 'function') {
			for (const payload of sendAttempts) {
				try {
					await conn.sendButton(m.chat, payload, { quoted: m })
					return
				} catch (eA) {
					if (!firstErr) firstErr = eA
					console.error('menu v14: sendButton attempt failed:', eA && eA.message ? eA.message : eA)
				}
			}
			try {
				const headOnly = finalText.split(readMore)[0].trim()
				const shortText = (headOnly.length > 900 ? headOnly.slice(0, 900) + '…' : headOnly) +
					`\n\n${t(lang, 'tapMenu')}`
				await conn.sendButton(m.chat, { text: shortText, footer: footerText, buttons }, { quoted: m })
				return
			} catch (e2) {
				console.error('menu v14: short sendButton failed:', e2 && e2.message ? e2.message : e2)
				const extra = isOwner ? `\n\n🔧 (للمالك) سبب فشل الأزرار: ${String((firstErr && firstErr.message) || firstErr).slice(0, 200)}` : ''
				await conn.reply(m.chat, finalText + extra, m)
				return
			}
		}
		await conn.reply(m.chat, finalText, m)

	} catch (e) {
		console.error(e)
		try {
			await conn.reply(m.chat,
				isOwner
					? `Error displaying menu.\n🔧 السبب: ${String((e && e.message) || e).slice(0, 300)}`
					: 'Error displaying menu.', m)
		} catch {}
	}
}

handler.before = async function (m, { conn }) {
	try {
		if (!m || !m.text || m.fromMe || !m.sender) return false
		const key = m.chat + '|' + m.sender
		const pend = feedbackPending.get(key)
		if (!pend) return false
		const pendAt = typeof pend === 'object' ? pend.at : pend
		const pendKind = typeof pend === 'object' ? pend.kind : 'feedback'
		const pendLang = typeof pend === 'object' && pend.lang ? pend.lang : 'en'
		if (Date.now() - pendAt > 5 * 60 * 1000) { feedbackPending.delete(key); return false }
		const text = String(m.text).trim()
		if (!text || text.startsWith('.')) { feedbackPending.delete(key); return false }
		feedbackPending.delete(key)
		feedbackCooldown.set(m.sender, Date.now())
		let senderName = m.sender
		try { senderName = conn.getName(m.sender) || m.sender } catch {}
		const owners = []
		for (const o of (global.owner || [])) {
			const raw = Array.isArray(o) ? o[0] : o
			const num = String(raw || '').replace(/\D/g, '')
			if (num) owners.push(num + '@s.whatsapp.net')
		}
		const label = t(pendLang, pendKind === 'request' ? 'requestLabel' : 'feedbackLabel')
		const fwd = label + '\n👤 From: ' + senderName + ' (+' + String(m.sender).replace(/\D/g, '') + ')\n💬 ' + text
		for (const jid of owners) {
			if (jid === m.sender) continue
			try { await conn.sendMessage(jid, { text: fwd }) } catch {}
		}
		try { await conn.reply(m.chat, t(pendLang, 'sentOk'), m) } catch {}
		return true
	} catch { return false }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|help|\?)$/i

export default handler

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)

function clockString(ms) {
	let d = Math.floor(ms / 86400000)
	let h = Math.floor(ms / 3600000) % 24
	let min = Math.floor(ms / 60000) % 60
	let s = Math.floor(ms / 1000) % 60
	let parts = [h, min, s].map(v => v.toString().padStart(2, '0')).join(':')
	return d > 0 ? `${d}d ${parts}` : parts
}

function ramUsage() {
	const used = process.memoryUsage().rss
	const total = os.totalmem()
	return `${(used / 1024 / 1024).toFixed(0)}MB / ${(total / 1024 / 1024 / 1024).toFixed(1)}GB`
}

function ucapan() {
	let hour = 12
	try {
		hour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca', hour: 'numeric', hour12: false }), 10)
		if (isNaN(hour)) hour = new Date().getHours()
	} catch { hour = new Date().getHours() }
	if (hour < 5) return 'Good Night'
	if (hour < 12) return 'Good Morning'
	if (hour < 17) return 'Good Afternoon'
	if (hour < 21) return 'Good Evening'
	return 'Good Night'
}

async function checkStatus() {
	const data = healDb()
	const cache = data.stats.statusCache
	if (cache && Date.now() - cache.checkedAt < STATUS_CACHE_MS) return cache.result
	const services = [
		{ name: 'WhatsApp', check: async () => true },
		{ name: 'Database', check: async () => !!(global.db && global.db.data) },
	]
	const results = {}
	for (const s of services) {
		try { results[s.name] = (await s.check()) ? '🟢' : '🔴' } catch { results[s.name] = '🔴' }
	}
	const resultText = Object.entries(results).map(([k, v]) => `${v} ${k}`).join(' | ')
	data.stats.statusCache = { checkedAt: Date.now(), result: resultText }
	return resultText
}
