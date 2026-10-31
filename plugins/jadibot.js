// plugins/serbot.js — JadiBot / SerBot (تنصيب بوت فرعي)
// كيخلي أي مستعمل يربط الرقم ديالو مع البوت الرئيسي بكود الربط (pairing code)،
// وكيولي الرقم ديالو بوت فرعي كيخدم بنفس البلاغينات، بلا سيرفر بوحدو.
//
// الأوامر:
//   .serbot                 ربط رقمك (أو .serbot 2126XXXXXXXX لرقم آخر)
//   .jadibot                نفس الشي
//   .stopserbot             إيقاف البوت الفرعي ديالك (الجلسة كتبقى محفوظة)
//   .delserbot              حذف البوت الفرعي نهائيا (تسجيل الخروج + مسح الجلسة)
//   .listbots               (للمالك) لائحة البوتات الفرعية المتصلة
//
// الجلسات كتحفظ فمجلد serbot/<phone> فجذر البوت. من بعد إعادة تشغيل البوت
// الرئيسي، المستعمل كيعاود .serbot وكيتربط مباشرة بلا كود جديد.
//
// ملاحظة تقنية: من بعد إدخال كود الربط، واتساب كيسد الاتصال بـ 515
// (restartRequired) وخاص إعادة الربط بنفس الجلسة — هادا سلوك عادي ومقصود هنا.

import { useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestWaWebVersion, Browsers, DisconnectReason } from 'baileys'
import { makeWASocket } from '../lib/simple.js'
import { handler as mainHandler, participantsUpdate, groupsUpdate } from '../handler.js'
import pino from 'pino'
import fs from 'node:fs'
import path from 'node:path'

const MAX_SERBOTS = 10
const BASE_DIR = path.join(process.cwd(), 'serbot')
if (!globalThis.__serbots) globalThis.__serbots = new Map()
const registry = globalThis.__serbots // phone -> entry
const logger = pino({ level: 'silent' })

const digits = (s) => String(s || '').replace(/[^0-9]/g, '')
const userJid = (phone) => `${phone}@s.whatsapp.net`

// مجموعات ممنوعة على البوتات الفرعية (فيها البوت الرئيسي — بلا ازدواجية فالردود)
// قابلة للتعديل بالأوامر .blockserbot / .unblockserbot (للمالك)، وكتحفظ فالداتابيز
const DEFAULT_BLOCKED_GROUPS = ['120363409475224628@g.us']
function blockedGroups() {
    try {
        const saved = globalThis.db?.data?.settings?.serbotBlocked
        if (Array.isArray(saved)) return saved
    } catch {}
    return DEFAULT_BLOCKED_GROUPS
}
function saveBlockedGroups(list) {
    try {
        globalThis.db.data.settings = globalThis.db.data.settings || {}
        globalThis.db.data.settings.serbotBlocked = [...new Set(list)]
        return true
    } catch { return false }
}

function senderPhone(m, text) {
    const fromText = digits((text || '').trim().split(/\s+/)[0])
    if (fromText.length >= 9) return fromText
    if (m?.sender?.endsWith('@s.whatsapp.net')) return digits(m.sender)
    return '' // LID أو مجهول: خاص الرقم صراحة
}

async function notify(mainConn, phone, text) {
    try { await mainConn.sendMessage(userJid(phone), { text }) } catch {}
}

// كينشئ (أو يعاود إنشاء) الصوكيت ديال واحد الـ entry موجود
async function connectSocket(entry, mainConn) {
    const { state, saveCreds } = await useMultiFileAuthState(entry.dir)
    entry.registered = !!state.creds.registered

    let version
    try { version = (await fetchLatestWaWebVersion()).version } catch {}

    const sock = makeWASocket({
        ...(version ? { version } : {}),
        logger,
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        browser: Browsers?.ubuntu ? Browsers.ubuntu('Chrome') : ['SILANA SERBOT', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false,
        syncFullHistory: false,
    })
    sock.isSerbot = true
    sock.serbotPhone = entry.phone
    entry.sock = sock

    // البوت الفرعي كيتجاهل تماما المجموعات المحظورة (فيها البوت الرئيسي)
    sock.handler = (chatUpdate) => {
        const msgs = (chatUpdate?.messages || []).filter((msg) => !blockedGroups().includes(msg?.key?.remoteJid || ''))
        if (!msgs.length) return
        return mainHandler.call(sock, { ...chatUpdate, messages: msgs })
    }
    sock.ev.on('messages.upsert', sock.handler)
    sock.ev.on('group-participants.update', (upd) => {
        if (blockedGroups().includes(upd?.id || '')) return
        return participantsUpdate.call(sock, upd)
    })
    sock.ev.on('groups.update', (updates) => {
        const allowed = (updates || []).filter((u) => !blockedGroups().includes(u?.id || ''))
        if (!allowed.length) return
        return groupsUpdate.call(sock, allowed)
    })
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            entry.wasOpen = true
            entry.attempts = 0
            if (!entry.openNotified) {
                entry.openNotified = true
                await notify(mainConn, entry.phone,
                    '✅ *البوت الفرعي ديالك ولى خدام!*\n\n' +
                    'الرقم ديالك دابا بوت: أي واحد يهضر معاه ويستعمل الأوامر كيجاوب بنفس مميزات سيلانا.\n' +
                    '• `.stopserbot` — إيقاف مؤقت (من البوت الرئيسي)\n' +
                    '• `.delserbot` — حذف نهائي')
            }
            return
        }
        if (connection !== 'close' || entry.stopping) return

        const code = lastDisconnect?.error?.output?.statusCode

        // تسجيل خروج حقيقي لجلسة كانت خدامة: كنمسحو كلشي
        if (code === DisconnectReason.loggedOut && entry.wasOpen) {
            registry.delete(entry.phone)
            fs.rmSync(entry.dir, { recursive: true, force: true })
            await notify(mainConn, entry.phone, '⚠️ تم تسجيل خروج البوت الفرعي ديالك (من الهاتف أو من واتساب). عاود `.serbot` إلا بغيتي تربطو من جديد.')
            return
        }

        // باقي الإغلاقات (515 ديال ما بعد الربط، 428، 408 وحتى 401 قبل أول فتح)
        // كتعالج بإعادة الربط بنفس الجلسة — ماشي بالحذف
        entry.attempts++
        const cap = entry.wasOpen ? 5 : 3
        if (entry.attempts > cap) {
            registry.delete(entry.phone)
            try { sock.end?.(undefined) } catch {}
            await notify(mainConn, entry.phone, entry.wasOpen
                ? '❌ البوت الفرعي توقف بعد محاولات إعادة ربط فاشلة. عاود `.serbot` لتشغيلو.'
                : entry.registered
                    ? `⚠️ الجلسة المحفوظة لهاد الرقم ما قدراتش تتصل — غالبا الربط الأول ما كملش حتى للنهاية. الحل: \`.delserbot ${entry.phone}\` ومن بعد \`.serbot ${entry.phone}\` وربط بكود جديد.`
                    : '⌛ سالات مهلة الربط قبل ما يكمل التنصيب. عاود `.serbot` وخد كود جديد ودخلو بسرعة.')
            return
        }
        entry.sock = null
        const delay = entry.wasOpen ? 3000 * entry.attempts : 1000
        entry.timer = setTimeout(async () => {
            if (entry.stopping || registry.get(entry.phone) !== entry) return
            try {
                const res = await connectSocket(entry, mainConn)
                if (res?.code) {
                    await notify(mainConn, entry.phone,
                        '🔗 *كود ربط جديد:*\n\n' +
                        `*${res.code}*\n\n` +
                        'دخلو دابا: واتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف.')
                }
            } catch (e) {
                console.error('[SERBOT] reconnect failed:', e?.message || e)
            }
        }, delay)
    })

    if (!state.creds.registered) {
        // كنخليو الصوكيت يبدا الاتصال قبل طلب الكود
        await new Promise((r) => setTimeout(r, 2500))
        let code
        try { code = await sock.requestPairingCode(entry.phone) }
        catch { await new Promise((r) => setTimeout(r, 3000)); code = await sock.requestPairingCode(entry.phone) }
        return { code: String(code || '').match(/.{1,4}/g)?.join('-') || String(code || '') }
    }
    return {}
}

async function startSerbot(phone, mainConn) {
    const existing = registry.get(phone)
    if (existing?.sock) return { status: 'already' }
    if (existing) return { status: 'already' } // كاين وكيتعاود الربط ديالو
    if (registry.size >= MAX_SERBOTS) return { status: 'full' }

    const dir = path.join(BASE_DIR, phone)
    fs.mkdirSync(dir, { recursive: true })
    const entry = { sock: null, phone, dir, startedAt: Date.now(), wasOpen: false, stopping: false, attempts: 0, timer: null, openNotified: false, registered: false }
    registry.set(phone, entry)

    const res = await connectSocket(entry, mainConn)
    if (res?.code) return { status: 'code', code: res.code }
    return { status: 'reconnecting' }
}

async function stopSerbot(phone, { logout = false } = {}) {
    const entry = registry.get(phone)
    const dirExists = fs.existsSync(path.join(BASE_DIR, phone))
    if (!entry && !dirExists) return false
    if (entry) {
        entry.stopping = true
        if (entry.timer) clearTimeout(entry.timer)
        try { if (logout) await entry.sock?.logout() } catch {}
        try { entry.sock?.end?.(undefined) } catch {}
        try { entry.sock?.ws?.close() } catch {}
        registry.delete(phone)
    }
    if (logout) fs.rmSync(path.join(BASE_DIR, phone), { recursive: true, force: true })
    return true
}

let handler = async (m, { conn, text, command, isOwner, usedPrefix }) => {
    // ممنوع التنصيب من داخل بوت فرعي
    if (conn?.isSerbot && ['serbot', 'jadibot'].includes(command)) {
        return m.reply('🤖 هادا بوت فرعي ديجا — التنصيب كيكون غير من البوت الرئيسي SILANA.')
    }

    if (command === 'blockserbot' || command === 'unblockserbot') {
        if (!isOwner) return m.reply('⛔ هاد الأمر خاص بالمالك فقط.')
        const arg = (text || '').trim()
        const target = arg.includes('@g.us') ? arg : (m.chat?.endsWith('@g.us') ? m.chat : '')
        if (!target) return m.reply(`⚠️ دير الأمر داخل الگروب المقصود، أو زيد الـ JID: ${usedPrefix + command} 120363XXXX@g.us`)
        const list = blockedGroups()
        if (command === 'blockserbot') {
            if (list.includes(target)) return m.reply('ℹ️ هاد الگروب محظور على البوتات الفرعية ديجا.')
            if (!saveBlockedGroups([...list, target])) return m.reply('❌ ما قدرتش نحفظ (قاعدة البيانات غير متاحة).')
            return m.reply('🚫 تم: البوتات الفرعية ما غاديش تخدم فهاد الگروب (البوت الرئيسي بوحدو كافي).')
        }
        if (!list.includes(target)) return m.reply('ℹ️ هاد الگروب ماشي محظور على البوتات الفرعية.')
        if (!saveBlockedGroups(list.filter((g) => g !== target))) return m.reply('❌ ما قدرتش نحفظ (قاعدة البيانات غير متاحة).')
        return m.reply('✅ تم: البوتات الفرعية تقدر تخدم فهاد الگروب من جديد.')
    }

    if (command === 'listbots') {
        if (!isOwner) return m.reply('⛔ هاد الأمر خاص بالمالك فقط.')
        if (!registry.size) return m.reply('📭 ما كاين حتى بوت فرعي متصل دابا.')
        const list = [...registry.values()].map((e, i) => `${i + 1}. +${e.phone} — ${e.wasOpen ? '🟢 خدام' : '🟡 كيتربط'}`).join('\n')
        return m.reply(`🤖 *البوتات الفرعية (${registry.size}/${MAX_SERBOTS}):*\n\n${list}`)
    }

    const phone = senderPhone(m, text)

    if (command === 'delserbot' || command === 'stopserbot') {
        if (!phone) return m.reply(`⚠️ ما عرفتش الرقم ديالك. جرب: ${usedPrefix + command} 2126XXXXXXXX`)
        const done = await stopSerbot(phone, { logout: command === 'delserbot' })
        if (!done) return m.reply('📭 ما عندك حتى بوت فرعي خدام بهاد الرقم.')
        return m.reply(command === 'delserbot'
            ? '🗑️ تم حذف البوت الفرعي نهائيا وتسجيل الخروج. تقدر تعاود `.serbot` فوقت ما بغيتي.'
            : '⏸️ تم إيقاف البوت الفرعي. الجلسة محفوظة — عاود `.serbot` باش تشغلو بلا كود جديد.')
    }

    // serbot / jadibot
    if (!phone) {
        return m.reply(
            '⚠️ *خاص الرقم صراحة:*\n' +
            `${usedPrefix + command} 2126XXXXXXXX\n\n` +
            '(رقم واتساب ديالك مع رمز الدولة، هو اللي غادي يولي بوت)')
    }
    if (phone === digits(conn?.user?.id)) {
        return m.reply('😄 هادا هو رقم البوت الرئيسي نفسو — اختار رقم آخر.')
    }

    await m.react?.('🕓').catch(() => {})
    try {
        const res = await startSerbot(phone, conn)
        if (res.status === 'already') return m.reply('ℹ️ البوت الفرعي ديالك ديجا خدام ولا كيتربط. إلا تعطل، دير `.stopserbot` وعاود.')
        if (res.status === 'full') return m.reply(`⚠️ وصلنا للحد الأقصى ديال البوتات الفرعية (${MAX_SERBOTS}). جرب من بعد.`)
        if (res.status === 'code') {
            return m.reply(
                '🔗 *كود الربط ديالك:*\n\n' +
                `*${res.code}*\n\n` +
                'دخلو دابا فهاتف الرقم اللي بغيتي تنصبو:\n' +
                'واتساب ← الأجهزة المرتبطة ← ربط جهاز ← *الربط برقم الهاتف* ← دخل الكود.\n\n' +
                '⏳ الكود كيسالي بسرعة — دخلو مباشرة. ملي يتربط، غادي توصلك رسالة تأكيد.')
        }
        await m.react?.('✅').catch(() => {})
        return m.reply('♻️ الجلسة ديالك محفوظة — كنعاود نربط البوت الفرعي بلا كود جديد. غادي توصلك رسالة ملي يولي خدام.')
    } catch (e) {
        console.error('[SERBOT] start failed:', e)
        registry.delete(phone)
        return m.reply('❌ فشل بدء التنصيب. عاود المحاولة من بعد.' + (isOwner ? `\n\n🔧 تفاصيل للمالك: ${String(e?.message || e).slice(0, 150)}` : ''))
    }
}

handler.help = handler.command = ['serbot', 'jadibot', 'delserbot', 'stopserbot', 'listbots', 'blockserbot', 'unblockserbot']
handler.tags = ['owner']
handler.limit = false
export default handler
