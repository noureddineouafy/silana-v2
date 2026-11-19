
const IG_APP_ID = '936619743392459'
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const IG_COOKIE = process.env.IG_COOKIE || ''
const MAX_STORIES = 20

/* -------------------------------------------------------------------------- */
/* Input parsing                                                              */
/* -------------------------------------------------------------------------- */

/** Returns { username } or { url } or null. Accepts @user, user, links. */
function parseInput(text) {
    const t = String(text || '').trim()
    if (!t) return null
    const link = (t.match(/https?:\/\/\S+/i) || [])[0]
    if (link) {
        try {
            const u = new URL(link)
            if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null
            const parts = u.pathname.split('/').filter(Boolean)
            if (parts[0] === 'stories' && parts[1]) return { username: parts[1], url: link }
            if (parts[0] === 'highlights' && parts[1]) return { url: link }
            if (parts[0] && !['p', 'reel', 'reels', 'tv', 'explore', 'accounts'].includes(parts[0])) {
                return { username: parts[0], url: link }
            }
            return { url: link }
        } catch { return null }
    }
    const username = t.replace(/^@/, '').trim()
    if (/^[a-zA-Z0-9._]{1,30}$/.test(username)) return { username }
    return null
}

/* -------------------------------------------------------------------------- */
/* Source 1: SaveReels (no login) — same service as HIROBOT's ig plugin       */
/* -------------------------------------------------------------------------- */

function decodeSnapToken(link) {
    try {
        const token = link.match(/token=([^&]+)/)?.[1]
        if (!token) return null
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'))
    } catch { return null }
}

async function storiesViaSaveReels(queryUrl) {
    const res = await fetch('https://savereels.io/api/ajaxSearch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://savereels.io/',
            'Origin': 'https://savereels.io'
        },
        body: new URLSearchParams({ q: queryUrl, v: 'v2' }).toString()
    })
    if (!res.ok) throw new Error(`SaveReels HTTP ${res.status}`)
    const json = await res.json().catch(() => null)
    if (!json || json.status !== 'ok') throw new Error('SaveReels returned no results')
    const html = String(json.data || '').replace(/\\\//g, '/')

    const links = [...new Set((html.match(/https:\/\/[a-z0-9.-]*snapcdn\.app\/get\?token=[^\s"'<>]+/gi) || []))]
    const items = []
    const seen = new Set()
    for (const link of links) {
        const data = decodeSnapToken(link)
        const filename = data?.filename || ''
        const ext = (filename.split('.').pop() || '').toLowerCase()
        const inner = typeof data?.url === 'string' && /^https:\/\//.test(data.url) ? data.url : null
        const url = inner || link // prefer the real Instagram CDN link
        if (seen.has(url)) continue
        if (['mp4', 'mov', 'webm'].includes(ext)) { seen.add(url); items.push({ type: 'video', url }) }
        else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { seen.add(url); items.push({ type: 'image', url }) }
    }
    return items
}

/* -------------------------------------------------------------------------- */
/* Source 2: Instagram's own API (needs the owner's IG_COOKIE)                */
/* -------------------------------------------------------------------------- */

async function storiesViaInstagramApi(username) {
    const headers = {
        'X-IG-App-ID': IG_APP_ID,
        'User-Agent': BROWSER_UA,
        'Cookie': IG_COOKIE,
        'Referer': 'https://www.instagram.com/'
    }
    const profRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, { headers })
    if (!profRes.ok) throw new Error(`Instagram profile lookup HTTP ${profRes.status}`)
    const prof = await profRes.json().catch(() => null)
    const user = prof?.data?.user
    if (!user?.id) throw new Error('Instagram profile not found')

    const reelRes = await fetch(`https://i.instagram.com/api/v1/feed/user/${user.id}/reel_media/`, { headers })
    if (!reelRes.ok) throw new Error(`Instagram stories lookup HTTP ${reelRes.status}`)
    const reel = await reelRes.json().catch(() => null)
    const rawItems = reel?.reel?.items || reel?.items || []
    return rawItems.map(it => {
        if (it.media_type === 2 || it.video_versions?.length) {
            const vids = [...(it.video_versions || [])].sort((a, b) => (b.width * b.height) - (a.width * a.height))
            return vids[0]?.url ? { type: 'video', url: vids[0].url } : null
        }
        const imgs = [...(it.image_versions2?.candidates || [])].sort((a, b) => (b.width * b.height) - (a.width * a.height))
        return imgs[0]?.url ? { type: 'image', url: imgs[0].url } : null
    }).filter(Boolean)
}

/* -------------------------------------------------------------------------- */
/* Guide + handler                                                            */
/* -------------------------------------------------------------------------- */

function guideText(usedPrefix = '.') {
    return `*📸 Instagram Story Downloader — Guide*

*What is this feature?*
It downloads the *current stories* (photos and videos) of an Instagram account and sends them here, before they disappear after 24 hours.

*How to use it:*
• \`${usedPrefix}ig-story <username>\` — Download all current stories
• \`${usedPrefix}ig-story <story link>\` — Or paste a story/profile link

*Examples:*
• \`${usedPrefix}ig-story nasa\`
• \`${usedPrefix}ig-story https://www.instagram.com/stories/nasa/34123456789012345/\`

*Notes:*
• Works for *public* accounts that have stories *right now*.
• Private accounts: the bot owner can enable them by setting an Instagram session cookie (IG_COOKIE) — see the instructions at the top of the plugin file.`
}

let handler = async (m, { conn, usedPrefix = '.', text = '', command = '' } = {}) => {
    if (!text) return m.reply(guideText(usedPrefix))
    const parsed = parseInput(text)
    if (!parsed) {
        return m.reply(`That does not look like an Instagram username or link.\n\n${guideText(usedPrefix)}`)
    }
    const label = parsed.username ? `@${parsed.username}` : 'that account'
    try {
        await m.reply(`⏳ Fetching stories of ${label}...`)
        let items = []
        let source = ''
        const queryUrl = parsed.url && /^https:\/\/www\.instagram\.com\/(stories|highlights)\//.test(parsed.url)
            ? parsed.url
            : `https://www.instagram.com/stories/${parsed.username}/`

        if (IG_COOKIE && parsed.username) {
            try { items = await storiesViaInstagramApi(parsed.username); source = 'Instagram' } catch (e) { console.warn('[igstory] Instagram API failed:', e.message) }
        }
        if (!items.length) {
            try { items = await storiesViaSaveReels(queryUrl); source = 'SaveReels' } catch (e) { console.warn('[igstory] SaveReels failed:', e.message) }
        }
        if (!items.length && IG_COOKIE && parsed.username && source !== 'Instagram') {
            try { items = await storiesViaInstagramApi(parsed.username) } catch (e) { console.warn('[igstory] Instagram API retry failed:', e.message) }
        }

        if (!items.length) {
            return m.reply(`No stories found for ${label} right now.\n\nPossible reasons:\n• The account has *no active stories* (they expire after 24 hours)\n• The account is *private*${IG_COOKIE ? '' : ' — the bot owner can enable private accounts by setting the IG_COOKIE option (see the guide at the top of the plugin file)'}\n• The username is misspelled`)
        }

        const list = items.slice(0, MAX_STORIES)
        await m.reply(`📸 Found *${list.length} ${list.length === 1 ? 'story' : 'stories'}* of ${label} — sending now...`)
        let sent = 0
        for (let i = 0; i < list.length; i++) {
            const it = list[i]
            try {
                await conn.sendMessage(m.chat, {
                    [it.type === 'video' ? 'video' : 'image']: { url: it.url },
                    ...(it.type === 'video' ? { mimetype: 'video/mp4' } : {}),
                    caption: `📸 ${label} — story ${i + 1}/${list.length}`
                }, { quoted: m })
                sent++
            } catch (e) { console.warn('[igstory] send failed:', e.message) }
        }
        if (!sent) return m.reply('The stories were found but could not be sent. Please try again.')
        if (items.length > list.length) await m.reply(`Note: only the first ${MAX_STORIES} stories were sent (${items.length} found).`)
    } catch (e) {
        console.error('[igstory]', e)
        return m.reply(`❌ Failed to get the stories.\nReason: ${e.message}\n\nPlease try again in a moment.`)
    }
}

handler.help = [
    'ig-story <username>',
    { command: 'ig-story', name: 'text', description: 'Instagram username or story/profile link — downloads all current stories', type: 'string', required: true }
]
handler.tags = ['downloader']
handler.command = ['ig-story']
handler.description = {
    'ig-story': 'Download all current Instagram stories of an account (username or story link)'
}
handler.limit = true
handler.ai = { risk: 'low', description: 'download instagram stories of an account' }
handler.platform = { whatsapp: true, discord: true }

export default handler
                                                                                                     
