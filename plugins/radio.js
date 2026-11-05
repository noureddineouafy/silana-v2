// plugins/radio.js — Moroccan live radio (.radio)
//   .radio            → station list
//   .radio <station>  → a 30-second LIVE sample as a voice note + the
//                       station name (e.g. .radio hit, .radio أصوات, .radio 3)
//
// Every stream below was verified live by actually recording from it
// (2026-11-05). Medi1 and Chada FM were tested too, but their streams
// could not be recorded from the test network, so they are NOT listed
// rather than listed broken. Recording uses ffmpeg into ./tmp (the
// base cleans it automatically); one recording per chat at a time.

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
const run = promisify(execFile)

const STATIONS = [
    { key: 'hit', name: 'Hit Radio', ar: 'هيت راديو', url: 'https://hitradio-maroc.ice.infomaniak.ch/hitradio-maroc-128.mp3', desc: '🎵 شبابية / هيتس' },
    { key: 'aswat', name: 'Radio Aswat', ar: 'أصوات', url: 'https://broadcast.ice.infomaniak.ch/aswat-high.mp3', desc: '🎙️ عامة / مجتمع' },
    { key: 'mars', name: 'Radio Mars', ar: 'راديو مارس', url: 'https://radiomars.ice.infomaniak.ch/radiomars-128.mp3', desc: '⚽ رياضة' },
    { key: 'mfm', name: 'MFM Radio', ar: 'إم إف إم', url: 'https://a5.asurahosting.com:7980/radio.mp3', desc: '🎙️ عامة / أخبار' },
    { key: 'medina', name: 'Medina FM', ar: 'مدينة إف إم', url: 'https://medinafm.ice.infomaniak.ch/medinafm-128.mp3', desc: '🎶 طرب / مغربي' },
    { key: 'atlantic', name: 'Atlantic Radio', ar: 'أطلانتيك', url: 'https://atlantic-sonic.nindohost.net:9300/stream', desc: '💼 اقتصاد / أخبار' },
    { key: 'medradio', name: 'Med Radio', ar: 'ميد راديو', url: 'http://medradio.ice.infomaniak.ch/medradio-128.mp3', desc: '🎙️ عامة' },
    { key: 'cap', name: 'Cap Radio', ar: 'كاب راديو', url: 'https://listen.radioking.com/radio/710810/stream/776366', desc: '🌊 طنجة / الشمال' }
]
const SAMPLE_SECONDS = 30
const busy = new Set()

function findStation(q) {
    q = (q || '').trim().toLowerCase()
    if (!q) return null
    if (/^\d+$/.test(q)) return STATIONS[parseInt(q, 10) - 1] || null
    return STATIONS.find(s => s.key === q || s.name.toLowerCase() === q || s.ar === q) ||
        STATIONS.find(s => s.name.toLowerCase().includes(q) || s.ar.includes(q) || s.key.includes(q)) || null
}

async function sendList(conn, m, usedPrefix) {
    if (conn.sendButton) {
        try {
            const rows = STATIONS.map((s, i) => ({ title: `${s.name} — ${s.ar}`, description: s.desc, id: `${usedPrefix}radio ${i + 1}` }))
            const sections = [{ title: 'المحطات المغربية المتوفرة', rows }]
            const listBtn = { name: 'single_select', buttonParamsJson: JSON.stringify({ title: 'اختار المحطة', sections }) }
            return await conn.sendButton(m.chat, {
                text: '📻 *راديو المغرب — البث المباشر*\nاختار محطة وغادي توصلك عينة حية ديال 30 ثانية 🎧',
                footer: 'Silana • Radio Maroc', buttons: [listBtn], interactiveButtons: [listBtn], headerType: 1
            }, { quoted: m })
        } catch { /* fall through to text */ }
    }
    return conn.reply(m.chat,
        '📻 *راديو المغرب — البث المباشر*\n\n' +
        STATIONS.map((s, i) => `*${i + 1}.* ${s.name} (${s.ar}) — ${s.desc}`).join('\n') +
        `\n\nمثال: ${usedPrefix}radio hit`, m)
}

let handler = async (m, { conn, text, usedPrefix }) => {
    const st = findStation(text)
    if (!st) return sendList(conn, m, usedPrefix)
    if (busy.has(m.chat)) return conn.reply(m.chat, '⏳ تسجيل آخر خدام — تسنى حتى يسالي.', m)
    busy.add(m.chat)
    const file = `./tmp/radio-${Date.now()}.ogg`
    try {
        await conn.reply(m.chat, `🔴 كنقرّب من *${st.name}* — عينة حية ${SAMPLE_SECONDS} ثانية…`, m)
        await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-user_agent', 'Mozilla/5.0',
            '-i', st.url, '-t', String(SAMPLE_SECONDS), '-vn', '-ac', '1', '-ar', '48000',
            '-c:a', 'libopus', '-b:a', '48k', file, '-y'], { timeout: (SAMPLE_SECONDS + 25) * 1000 })
        if (!fs.existsSync(file) || fs.statSync(file).size < 10000) throw new Error('empty recording')
        await conn.sendMessage(m.chat, {
            audio: fs.readFileSync(file), mimetype: 'audio/ogg; codecs=opus', ptt: true,
            caption: undefined
        }, { quoted: m })
        await conn.reply(m.chat, `📻 *${st.name}* (${st.ar}) — ${st.desc}\nعينة مباشرة، البث خدام دابا.`, m)
    } catch (e) {
        return conn.reply(m.chat, `❌ ما قدرتش نسجل من ${st.name} دابا — يمكن البث مقطوع مؤقتاً. جرب محطة أخرى: ${usedPrefix}radio`, m)
    } finally {
        busy.delete(m.chat)
        try { fs.unlinkSync(file) } catch { }
    }
}
handler.help = ['radio']
handler.tags = ['morocco']
handler.command = ['radio', 'راديو']
export default handler
          
