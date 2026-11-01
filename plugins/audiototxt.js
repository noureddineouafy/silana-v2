// plugins/stt.js — تحويل البصمات الصوتية إلى نص (بالدارجة المغربية)
// كيرد على أي فويس/أوديو بالنص ديالو مكتوب. المحرك مضبوط على ar-MA
// (العربية المغربية) باش يفهم الدارجة كما هي، ماشي غير الفصحى.
//
// الاستعمال: رد (quote) على بصمة صوتية واكتب:
//   .audiototxt            تفريغ بالدارجة المغربية (الافتراضي)
//   .audiototxt fr         تفريغ بالفرنسية — لغات أخرى: en / es / ar / de / it
//
// التقنية: الصوت كيتحول بـ ffmpeg إلى FLAC 16kHz وكيتصيفط لخدمة Google
// Speech المجانية بنفس مفتاح Chromium العمومي المستعمل في مكتبات التعرف
// الصوتي المفتوحة. حد الطول: دقيقتان للبصمة الواحدة.

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

const TMP = path.join(process.cwd(), 'tmp')
try { fs.mkdirSync(TMP, { recursive: true }); process.env.TMPDIR = TMP } catch {}

const GKEY = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw'
const LANGS = { ma: 'ar-MA', ar: 'ar-MA', fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', it: 'it-IT', pt: 'pt-PT', tr: 'tr-TR' }
const MAX_SECONDS = 120

function toFlac(input, output) {
    return new Promise((resolve, reject) => {
        execFile('ffmpeg', ['-y', '-v', 'error', '-i', input, '-ar', '16000', '-ac', '1', output], (err) => err ? reject(err) : resolve())
    })
}

async function transcribe(flacBuffer, lang) {
    const res = await fetch(`https://www.google.com/speech-api/v2/recognize?output=json&lang=${lang}&key=${GKEY}&pfilter=0`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/x-flac; rate=16000' },
        body: flacBuffer,
    })
    if (!res.ok) throw new Error(`Google Speech HTTP ${res.status}`)
    const body = await res.text()
    for (const line of body.split('\n')) {
        if (!line.trim()) continue
        try {
            const json = JSON.parse(line)
            const alt = json?.result?.[0]?.alternative?.[0]?.transcript
            if (alt) return alt
        } catch {}
    }
    return ''
}

let handler = async (m, { text, isOwner, usedPrefix, command }) => {
    const q = m.quoted
    if (!q) {
        return m.reply(`🎙️ *تحويل الصوت إلى نص*\n\nرد على بصمة صوتية (quote) واكتب ${usedPrefix + command}\nاللغة الافتراضية: الدارجة المغربية 🇲🇦\nلغات أخرى: ${usedPrefix + command} fr / en / es ...`)
    }
    const mime = q.mimetype || ''
    if (!mime.startsWith('audio/')) {
        return m.reply('⚠️ خاص ترد على *بصمة صوتية* أو ملف صوتي.')
    }
    const seconds = Number(q.seconds || q.duration || 0)
    if (seconds > MAX_SECONDS) {
        return m.reply(`⚠️ البصمة طويلة بزاف (${seconds} ثانية). الحد الأقصى هو ${MAX_SECONDS} ثانية — قسمها وجرب.`)
    }

    const langArg = (text || '').trim().toLowerCase()
    const lang = LANGS[langArg] || (/^[a-z]{2}(-[A-Z]{2})?$/i.test(langArg) ? langArg : 'ar-MA')

    await m.react?.('🎧').catch(() => {})
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const inFile = path.join(TMP, `stt-${stamp}.bin`)
    const outFile = path.join(TMP, `stt-${stamp}.flac`)
    try {
        let buffer
        try { buffer = await q.download() }
        catch { buffer = null }
        if (!buffer?.length) throw new Error('تعذر تحميل الصوت من الرسالة')
        await fs.promises.writeFile(inFile, buffer)
        await toFlac(inFile, outFile)
        const flac = await fs.promises.readFile(outFile)
        const transcript = await transcribe(flac, lang)
        if (!transcript) {
            return m.reply('🤔 ما قدرت نفهم حتى كلمة من هاد البصمة. جرب بصمة أوضح، أقصر، وبعيدة على الضجيج.')
        }
        await m.react?.('✅').catch(() => {})
        return m.reply(`📝 *النص المفرغ* (${lang === 'ar-MA' ? 'دارجة مغربية' : lang}):\n\n${transcript}`)
    } catch (e) {
        return m.reply('❌ فشل التفريغ. عاود من بعد.' + (isOwner ? `\n\n🔧 تفاصيل للمالك: ${String(e?.message || e).slice(0, 150)}` : ''))
    } finally {
        try { fs.rmSync(inFile, { force: true }) } catch {}
        try { fs.rmSync(outFile, { force: true }) } catch {}
    }
}

handler.help = handler.command = ['audiototxt']
handler.tags = ['ai']
handler.limit = false
export default handler         
