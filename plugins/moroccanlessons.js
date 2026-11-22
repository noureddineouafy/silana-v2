const API = 'https://www.jami3dorosmaroc.com/wp-json/wp/v2/posts'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const MAX_RESULTS = 8
const SESSION_TTL = 10 * 60 * 1000
const MAX_PDF_BYTES = 30 * 1024 * 1024
const CHUNK = 3500
const MAX_CHUNKS = 4

const sessions = new Map()
const busy = new Set()

function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController()
    const timer = setTimeout(function () { ctrl.abort() }, ms)
    return fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal }).then(
        function (r) { clearTimeout(timer); return r },
        function (e) { clearTimeout(timer); throw e }
    )
}

async function apiGet(url) {
    const res = await fetchWithTimeout(url, 40000)
    if (!res.ok) throw new Error('jami3doros HTTP ' + res.status)
    return res.json()
}

function decodeEntities(s) {
    return String(s || '')
        .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)) })
        .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(parseInt(n, 10)) })
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
}

function cleanTitle(t) {
    return decodeEntities(t).replace(/\s+/g, ' ').trim()
}

function htmlToText(html) {
    let s = String(html || '')
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    s = s.replace(/<br\s*\/?>/gi, '\n')
    s = s.replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<\/tr>/gi, '\n')
    s = s.replace(/<li[^>]*>/gi, '\n• ')
    s = s.replace(/<[^>]+>/g, ' ')
    s = decodeEntities(s)
    s = s.replace(/[ \t]+/g, ' ')
    s = s.replace(/\n[ \t]+/g, '\n')
    s = s.replace(/\n{3,}/g, '\n\n')
    return s.trim()
}

function findPdfLinks(html) {
    const out = []
    const hrefs = String(html || '').match(/href="([^"]+)"/gi) || []
    for (let i = 0; i < hrefs.length; i++) {
        const url = hrefs[i].slice(6, -1)
        if (/\.pdf($|\?|#)/i.test(url)) out.push(url)
        const drive = url.match(/drive\.google\.com\/file\/d\/([0-9A-Za-z_-]+)/)
        if (drive) out.push('https://drive.google.com/uc?export=download&id=' + drive[1])
    }
    return out
}

function findYoutube(html) {
    const m = String(html || '').match(/youtube\.com\/embed\/([0-9A-Za-z_-]{6,})/)
    return m ? 'https://www.youtube.com/watch?v=' + m[1] : ''
}

function chunkText(text, size) {
    const chunks = []
    let rest = text
    while (rest.length > size) {
        let cut = rest.lastIndexOf('\n', size)
        if (cut < size * 0.5) cut = size
        chunks.push(rest.slice(0, cut).trim())
        rest = rest.slice(cut).trim()
    }
    if (rest) chunks.push(rest)
    return chunks
}

function safeFileName(title) {
    let name = String(title || 'lesson').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()
    name = name.replace(/\s*pdf$/i, '')
    if (name.length > 80) name = name.slice(0, 80).trim()
    return (name || 'lesson') + '.pdf'
}

async function react(m, emoji) {
    try { if (m.react) await m.react(emoji) } catch (e) {}
}

async function showList(m, conn, query, posts, usedPrefix, command) {
    const items = []
    for (let i = 0; i < posts.length && items.length < MAX_RESULTS; i++) {
        const p = posts[i]
        if (!p || !p.id) continue
        items.push({ id: p.id, title: cleanTitle(p.title && p.title.rendered), link: p.link || '' })
    }
    if (!items.length) return false
    sessions.set(m.sender, { at: Date.now(), items: items })
    const head = '📚 *' + (query ? 'نتائج البحث: ' + query : 'آخر الدروس المضافة') + '*\n_من موقع جميع دروس المغرب_\n'
    const rows = items.map(function (it, i) {
        return {
            title: it.title.length > 50 ? it.title.slice(0, 50) + '…' : it.title,
            description: /pdf/i.test(it.title) ? '📄 ملف PDF' : '📖 درس نصي',
            id: usedPrefix + command + ' ' + (i + 1)
        }
    })
    if (typeof conn.sendButton === 'function') {
        try {
            await conn.sendButton(m.chat, {
                text: head + '\nاختار الدرس من اللائحة 👇',
                footer: 'jami3dorosmaroc.com',
                buttons: [
                    { name: 'single_select', buttonParamsJson: JSON.stringify({ title: '📚 لائحة الدروس', sections: [{ title: query ? 'نتائج البحث' : 'آخر الدروس', rows: rows }] }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🆕 آخر الدروس', id: usedPrefix + command + ' جديد' }) }
                ]
            }, { quoted: m })
            return true
        } catch (e) {
            console.error('[MOROCCANLESSONS] sendButton failed, falling back to text list:', (e && e.message) || e)
        }
    }
    let msg = head
    for (let i = 0; i < items.length; i++) {
        const mark = /pdf/i.test(items[i].title) ? '📄 ' : ''
        msg += '\n' + (i + 1) + '. ' + mark + items[i].title
    }
    msg += '\n\n↩️ رد برقم الدرس باش يوصلك هنا في واتساب:\n*' + usedPrefix + command + ' <الرقم>*'
    await conn.reply(m.chat, msg, m)
    return true
}

async function openPost(m, conn, item, isOwner) {
    const data = await apiGet(API + '/' + item.id + '?_fields=title,link,content')
    const html = (data && data.content && data.content.rendered) || ''
    const title = cleanTitle((data && data.title && data.title.rendered) || item.title)
    const pdfs = findPdfLinks(html)

    if (pdfs.length) {
        const res = await fetchWithTimeout(pdfs[0], 90000)
        if (!res.ok) throw new Error('PDF HTTP ' + res.status)
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length > MAX_PDF_BYTES) throw new Error('PDF too large: ' + buf.length)
        if (buf.slice(0, 4).toString('latin1') === '%PDF') {
            await conn.sendMessage(m.chat, {
                document: buf,
                mimetype: 'application/pdf',
                fileName: safeFileName(title),
                caption: '📄 ' + title + '\n_من موقع جميع دروس المغرب_'
            }, { quoted: m })
            return true
        }
    }

    const text = htmlToText(html)
    if (!text) throw new Error('EMPTY_CONTENT')
    const yt = findYoutube(html)
    const chunks = chunkText(text, CHUNK)
    const total = Math.min(chunks.length, MAX_CHUNKS)
    for (let i = 0; i < total; i++) {
        const head = i === 0 ? '📚 *' + title + '*\n\n' : ''
        const foot = chunks.length > 1 ? '\n\n— ' + (i + 1) + '/' + total + ' —' : ''
        await conn.sendMessage(m.chat, { text: head + chunks[i] + foot }, { quoted: m })
    }
    if (chunks.length > total) {
        await conn.reply(m.chat, 'ℹ️ الدرس طويل بزاف — صيفطت ليك الجزء الأول. الدرس كامل هنا:\n' + (item.link || ''), m)
    }
    if (yt) await conn.reply(m.chat, '🎥 فيديو الشرح ديال هاد الدرس:\n' + yt, m)
    return true
}

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const q = (text || '').trim()

    if (!q) {
        const usageText =
            '📚 *دروس المغرب — موقع جميع الدروس*\n\n' +
            '🔍 البحث:\n' + usedPrefix + command + ' <كلمات البحث>\n' +
            '_مثال: ' + usedPrefix + command + ' الجهاز العصبي الثالثة اعدادي_\n\n' +
            '🆕 آخر الدروس:\n' + usedPrefix + command + ' جديد\n\n' +
            'من بعد البحث، رد برقم الدرس وغادي يوصلك هنا في واتساب — النص كامل أو ملف PDF إلا كان متوفر.'
        if (typeof conn.sendButton === 'function') {
            try {
                await conn.sendButton(m.chat, {
                    text: usageText,
                    footer: 'jami3dorosmaroc.com',
                    buttons: [
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🆕 آخر الدروس', id: usedPrefix + command + ' جديد' }) },
                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔍 مثال بحث', id: usedPrefix + command + ' الجهاز العصبي الثالثة اعدادي' }) }
                    ]
                }, { quoted: m })
                return
            } catch (e) {
                console.error('[MOROCCANLESSONS] usage sendButton failed:', (e && e.message) || e)
            }
        }
        return m.reply(usageText)
    }

    if (busy.has(m.sender)) return m.reply('⏳ طلبك السابق باقي خدام — تسنى شوية وعاود.')
    busy.add(m.sender)
    try {
        if (/^\d+$/.test(q)) {
            const s = sessions.get(m.sender)
            if (!s || Date.now() - s.at > SESSION_TTL) {
                sessions.delete(m.sender)
                return m.reply('⌛ ما كاين حتى بحث سابق (أو سالات المهلة). قلب أولاً:\n' + usedPrefix + command + ' <كلمات البحث>')
            }
            const idx = parseInt(q, 10) - 1
            if (idx < 0 || idx >= s.items.length) {
                return m.reply('⚠️ الرقم خاصو يكون بين 1 و ' + s.items.length + ' من اللائحة الأخيرة.')
            }
            await react(m, '🕓')
            await openPost(m, conn, s.items[idx], isOwner)
            await react(m, '✅')
            return
        }

        await react(m, '🕓')
        if (q === 'جديد' || q.toLowerCase() === 'latest') {
            const posts = await apiGet(API + '?per_page=' + MAX_RESULTS + '&_fields=id,link,title')
            const shown = await showList(m, conn, '', posts, usedPrefix, command)
            if (!shown) await m.reply('📭 ما وصل حتى درس جديد دابا. عاود من بعد.')
            await react(m, '✅')
            return
        }

        const posts = await apiGet(API + '?search=' + encodeURIComponent(q) + '&per_page=' + MAX_RESULTS + '&_fields=id,link,title')
        const shown = await showList(m, conn, q, posts, usedPrefix, command)
        if (!shown) {
            await react(m, '✖️')
            return m.reply('📭 ما لقيت حتى درس بـ "' + q + '".\nجرب كلمات أخرى — مثلاً اسم الدرس + المستوى: _الجهاز العصبي الثالثة اعدادي_')
        }
        await react(m, '✅')
    } catch (e) {
        console.error('[MOROCCANLESSONS] error:', e)
        await react(m, '✖️')
        const msg = String((e && e.message) || e)
        if (msg.indexOf('EMPTY_CONTENT') !== -1) {
            return m.reply('❌ هاد الدرس خاوي من المحتوى في الموقع. جرب درس آخر.')
        }
        return m.reply('❌ وقع خطأ في الاتصال بموقع الدروس. عاود المحاولة من بعد.' +
            (isOwner ? '\n\n🔧 تفاصيل للمالك: ' + msg.slice(0, 150) : ''))
    } finally {
        busy.delete(m.sender)
    }
}

handler.help = ['moroccanlessons']
handler.tags = ['morocco']
handler.command = /^moroccanlessons$/i
handler.limit = false

export default handler
