// plugins/ytcomments.js — الحصول على تعليقات فيديوهات يوتيوب
// كيستعمل واجهة يوتيوب الداخلية (InnerTube) بلا حتى مفتاح API:
// كيقرا صفحة الفيديو، كياخد توكن التعليقات، وكيقلب الصفحات حتى يجمع العدد المطلوب.
// الاستعمال:
//   .ytcomments <رابط يوتيوب أو ID> [العدد]
//   .ytcomments https://youtu.be/xxxxx 30
//   أو رد على رسالة فيها رابط وكتب .ytcomments
// العدد الافتراضي 20، والحد 100. حتى 15 تعليق كيبانو فالمحادثة مباشرة،
// وكثر من ذلك كيوصل ملف .txt فيه كلشي + أفضل 10 فالمحادثة. بلا حدود استعمال.

import axios from 'axios'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const MAX_WANT = 100
const DEFAULT_WANT = 20
const CHAT_INLINE = 15

function extractVideoId(input) {
    const s = String(input || '')
    const patterns = [
        /youtu\.be\/([A-Za-z0-9_-]{11})/,
        /[?&]v=([A-Za-z0-9_-]{11})/,
        /youtube\.com\/(?:shorts|live|embed|clip)\/([A-Za-z0-9_-]{11})/,
        /music\.youtube\.com\/watch\?[^ ]*v=([A-Za-z0-9_-]{11})/,
    ]
    for (const re of patterns) { const m = s.match(re); if (m) return m[1] }
    const bare = s.trim().match(/^([A-Za-z0-9_-]{11})$/)
    return bare ? bare[1] : null
}

function runsText(r) { return (r?.runs || []).map((x) => x.text || '').join('') || r?.simpleText || '' }

function sliceJson(html, marker) {
    // استخراج JSON بتوازن الأقواس (كاين محتوى زائد بعد الـ JSON قبل نهاية السكريبت)
    const from = html.indexOf(marker)
    if (from < 0) return null
    const s = html.indexOf('{', from + marker.length)
    if (s < 0) return null
    let depth = 0, inStr = false, esc = false
    for (let i = s; i < html.length; i++) {
        const ch = html[i]
        if (inStr) {
            if (esc) esc = false
            else if (ch === '\\') esc = true
            else if (ch === '"') inStr = false
            continue
        }
        if (ch === '"') inStr = true
        else if (ch === '{') depth++
        else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(s, i + 1)) } catch { return null } } }
    }
    return null
}

function findCommentContinuation(node, depth = 0) {
    if (!node || depth > 32) return null
    if (Array.isArray(node)) { for (const i of node) { const r = findCommentContinuation(i, depth + 1); if (r) return r } return null }
    if (typeof node === 'object') {
        const isr = node.itemSectionRenderer
        if (isr && (isr.sectionIdentifier === 'comment-item-section' || isr.targetId === 'comments-section')) {
            const cont = (isr.contents || []).find((c) => c.continuationItemRenderer)
            const token = cont?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
            if (token) return token
        }
        for (const v of Object.values(node)) { const r = findCommentContinuation(v, depth + 1); if (r) return r }
    }
    return null
}

function parsePage(data) {
    const out = { comments: [], nextToken: null, total: '' }
    const mutations = data.frameworkUpdates?.entityBatchUpdate?.mutations || []
    const byKey = new Map()
    for (const m of mutations) {
        const p = m?.payload?.commentEntityPayload
        if (p && p.key) byKey.set(p.key, p)
    }
    for (const ep of data.onResponseReceivedEndpoints || []) {
        const items = ep.reloadContinuationItemsCommand?.continuationItems || ep.appendContinuationItemsAction?.continuationItems || []
        for (const item of items) {
            if (item.commentsHeaderRenderer) {
                const t = runsText(item.commentsHeaderRenderer.countText).replace(/\s+/g, ' ').trim()
                if (t) out.total = t
            }
            const thread = item.commentThreadRenderer
            if (thread) {
                const vm = thread.commentViewModel?.commentViewModel || thread.comment?.commentViewModel
                const payload = vm?.commentKey ? byKey.get(vm.commentKey) : null
                if (payload) {
                    const pr = payload.properties || {}
                    const tb = payload.toolbar || {}
                    out.comments.push({
                        author: payload.author?.displayName || '',
                        text: pr.content?.content || '',
                        time: pr.publishedTime || '',
                        likes: tb.likeCountNotliked || tb.likeCountLiked || '',
                        replies: tb.replyCount || '',
                        verified: !!payload.author?.isVerified,
                        creator: !!payload.author?.isCreator,
                        heart: !!tb.heartActiveTooltip,
                    })
                    continue
                }
                const c = thread.comment?.commentRenderer
                if (c) {
                    out.comments.push({
                        author: runsText(c.authorText),
                        text: runsText(c.contentText),
                        time: runsText(c.publishedTimeText),
                        likes: c.likeCount ? String(c.likeCount) : '',
                        replies: '',
                        verified: false, creator: false, heart: !!c.isHearted,
                    })
                }
                continue
            }
            const token = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
            if (token) out.nextToken = token
        }
    }
    return out
}

async function fetchComments(videoId, want) {
    let pageRes
    try {
        pageRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
            timeout: 30000, responseType: 'text', validateStatus: () => true,
        })
    } catch (e) { throw new Error('NET: ' + (e.message || e)) }
    if (pageRes.status !== 200) throw new Error('HTTP ' + pageRes.status + ' (صفحة الفيديو)')
    const html = String(pageRes.data || '')
    const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1]
    const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] || '2.20241120.00.00'
    if (!apiKey) throw new Error('NO_KEY')

    const player = sliceJson(html, 'var ytInitialPlayerResponse = ')
    const details = player?.videoDetails || {}
    const initial = sliceJson(html, 'var ytInitialData = ')

    let token = initial ? findCommentContinuation(initial) : null
    if (!token) {
        if (/comments are turned off/i.test(html)) throw new Error('COMMENTS_DISABLED')
        throw new Error('NO_CONTINUATION')
    }

    let all = []
    let total = ''
    let pages = 0
    while (token && all.length < want && pages < 8) {
        const res = await axios.post(`https://www.youtube.com/youtubei/v1/next?key=${apiKey}&prettyPrint=false`, {
            context: { client: { clientName: 'WEB', clientVersion, hl: 'en', gl: 'US' } },
            continuation: token,
        }, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }, timeout: 30000, validateStatus: () => true })
        if (res.status !== 200) throw new Error('HTTP ' + res.status + ' (واجهة التعليقات)')
        const parsed = parsePage(res.data || {})
        if (parsed.total && !total) total = parsed.total
        all = all.concat(parsed.comments.filter((c) => c.text && c.text.trim()))
        token = parsed.nextToken
        pages++
    }
    return { title: details.title || '', channel: details.author || '', total, comments: all.slice(0, want) }
}

// "6 years ago" -> "قبل 6 سنوات"
function timeAr(t) {
    const m = String(t || '').match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i)
    if (!m) return t || ''
    const n = +m[1]
    const unit = { second: ['ثانية', 'ثواني'], minute: ['دقيقة', 'دقائق'], hour: ['ساعة', 'ساعات'], day: ['يوم', 'أيام'], week: ['أسبوع', 'أسابيع'], month: ['شهر', 'أشهر'], year: ['سنة', 'سنوات'] }[m[2].toLowerCase()]
    if (!unit) return t
    if (n === 1) return `قبل ${unit[0]}`
    if (n === 2) return `قبل ${unit[0]}ين`.replace('ةين', 'تين').replace('يومين', 'يومين')
    return `قبل ${n} ${unit[1]}`
}

function badges(c) {
    let b = ''
    if (c.creator) b += ' 👑'
    else if (c.verified) b += ' ✔️'
    if (c.heart) b += ' ❤️'
    return b
}

function formatComment(c, i, maxLen) {
    let text = c.text.replace(/\s+\n/g, '\n').trim()
    if (text.length > maxLen) text = text.slice(0, maxLen) + '…'
    const meta = [c.likes ? `👍 ${c.likes}` : '', c.replies ? `💬 ${c.replies}` : '', timeAr(c.time)].filter(Boolean).join(' • ')
    return `${i + 1}. *${c.author || 'مجهول'}*${badges(c)}${meta ? `\n_${meta}_` : ''}\n${text}`
}

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const raw = (text || '').trim()
    const quotedText = m.quoted?.text || m.quoted?.caption || ''
    const source = raw || quotedText
    const videoId = extractVideoId(source) || extractVideoId(quotedText)
    if (!videoId) {
        return m.reply(`💬 *تعليقات يوتيوب*\n\nعطيني رابط فيديو يوتيوب وغادي نجيب ليك أفضل التعليقات:\n${usedPrefix + command} https://youtu.be/xxxxx\n\nتقدر تزيد العدد (حتى ${MAX_WANT}):\n${usedPrefix + command} https://youtube.com/watch?v=xxxxx 50\n\nأو رد على رسالة فيها الرابط وكتب ${usedPrefix + command}`)
    }
    const numMatch = source.replace(/https?:\/\/\S+/g, ' ').match(/\b(\d{1,3})\b/)
    let want = numMatch ? +numMatch[1] : DEFAULT_WANT
    if (want < 1) want = DEFAULT_WANT
    if (want > MAX_WANT) want = MAX_WANT

    await m.reply('⏳ كنجيب التعليقات...')
    let result
    try {
        result = await fetchComments(videoId, want)
    } catch (e) {
        const msg = String(e?.message || e)
        if (msg === 'COMMENTS_DISABLED') return m.reply('🚫 التعليقات *مقفولة* فهاد الفيديو من عند صاحب القناة.')
        if (msg === 'NO_KEY' || msg === 'NO_CONTINUATION' || msg.startsWith('HTTP 4')) {
            return m.reply('❌ يوتيوب رفض الطلب من هاد الاستضافة (غالباً حظر IP مؤقت على السيرفر). عاود من بعد.' + (isOwner ? `\n\n🔧 تفاصيل للمالك: ${msg.slice(0, 150)}` : ''))
        }
        return m.reply('❌ وقع مشكل ملي كنت كنجيب التعليقات. تأكد من الرابط وعاود.' + (isOwner ? `\n\n🔧 تفاصيل للمالك: ${msg.slice(0, 150)}` : ''))
    }

    const { title, channel, total, comments } = result
    if (!comments.length) return m.reply('🤔 ما لقيت حتى تعليق مكتوب فهاد الفيديو.')

    const link = `https://youtu.be/${videoId}`
    const head = `💬 *تعليقات يوتيوب*\n\n🎬 *${title || videoId}*${channel ? `\n📺 ${channel}` : ''}\n🔗 ${link}\n📊 مجموع التعليقات: ${total || 'غير معروف'} — جبت ليك *${comments.length}* من الأفضل:\n`

    if (comments.length <= CHAT_INLINE) {
        let body = head + '\n' + comments.map((c, i) => formatComment(c, i, 280)).join('\n\n')
        if (body.length > 3800) body = body.slice(0, 3800) + '\n\n… (طويل بزاف، زيد العدد وغادي يوصلك ملف كامل)'
        return m.reply(body)
    }

    // عدد كبير: ملف نصي فيه كلشي + أفضل 10 فالمحادثة
    const fileText =
        `تعليقات يوتيوب\n================\nالفيديو: ${title || videoId}\nالقناة: ${channel || ''}\nالرابط: ${link}\nمجموع التعليقات: ${total || ''}\nالمعروض هنا: ${comments.length}\n================\n\n` +
        comments.map((c, i) => {
            const meta = [c.likes ? `إعجاب: ${c.likes}` : '', c.replies ? `ردود: ${c.replies}` : '', c.time].filter(Boolean).join(' | ')
            return `${i + 1}. ${c.author || 'مجهول'}${badges(c)}${meta ? `\n(${meta})` : ''}\n${c.text}`
        }).join('\n\n----------------\n\n')

    const preview = head + '\n' + comments.slice(0, 10).map((c, i) => formatComment(c, i, 150)).join('\n\n') +
        `\n\n📄 *اللائحة الكاملة (${comments.length} تعليق) كاينة فالملف المرفق* 👇`
    await m.reply(preview)
    await conn.sendMessage(m.chat, {
        document: Buffer.from(fileText, 'utf8'),
        mimetype: 'text/plain',
        fileName: `yt-comments-${videoId}.txt`,
        caption: `💬 تعليقات: ${title || videoId} (${comments.length} تعليق)`,
    }, { quoted: m })
}

handler.help = ['ytcomments']
handler.tags = ['tools']
handler.command = /^(ytcomments)$/i
handler.limit = false

export default handler
                                   
