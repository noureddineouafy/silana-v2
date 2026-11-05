// stem.js — AI stem separator (.stem) — v1
// ─────────────────────────────────────────────────────────────────────────────
//   Reply to a song / audio / video with .stem and Silana splits it into:
//     1) VOCALS       — the singer's voice alone
//     2) INSTRUMENTAL — the music alone (drums + bass + everything else)
//   Separation runs on a free public Demucs service (Hugging Face Space);
//   nothing heavy runs on this server. The 4 returned stems are mixed down
//   locally with ffmpeg into the 2 files above.
//
//   Limits (technical only): file <= 25 MB, audio <= 6 minutes, one job at
//   a time. Processing usually takes 1-4 minutes depending on the queue.
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

process.env.TMPDIR = path.join(process.cwd(), 'tmp')
try { fs.mkdirSync(process.env.TMPDIR, { recursive: true }) } catch {}

const VERSION = 'v1'
const BASE = 'https://youngndum-demucs-4stem-api.hf.space'
const MAX_SIZE = 25 * 1024 * 1024
const MAX_DUR = 360
const ATTEMPTS = 2

let busy = false

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchTimeout(url, opts, ms) {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), ms)
    try {
        return await fetch(url, { ...(opts || {}), signal: ctl.signal })
    } finally { clearTimeout(t) }
}

// Duration in seconds; ffprobe when present, ffmpeg banner parse otherwise.
async function probeDuration(file) {
    try {
        const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
        const d = parseFloat(stdout.trim())
        if (d > 0) return d
    } catch {}
    try {
        const { stderr } = await run('ffmpeg', ['-i', file, '-f', 'null', '-'])
        const mm = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr || '')
        if (mm) return (+mm[1]) * 3600 + (+mm[2]) * 60 + parseFloat(mm[3])
    } catch (e) {
        const mm = /Duration: (\d+):(\d+):([\d.]+)/.exec((e.stderr || '').toString())
        if (mm) return (+mm[1]) * 3600 + (+mm[2]) * 60 + parseFloat(mm[3])
    }
    return 0
}

// Find every FileData-like object ({path, url}) inside a parsed SSE payload.
function collectFiles(node, out) {
    if (!node || typeof node !== 'object') return out
    if (typeof node.path === 'string' && /\.(wav|mp3|flac|ogg|m4a)$/i.test(node.path)) out.push(node)
    if (Array.isArray(node)) { for (const x of node) collectFiles(x, out) }
    else { for (const k of Object.keys(node)) collectFiles(node[k], out) }
    return out
}

// One full separation attempt against the backend. Returns [{name, url}].
async function separateOnce(mp3Path) {
    // 1) upload
    const buf = fs.readFileSync(mp3Path)
    const fd = new FormData()
    fd.append('files', new Blob([buf], { type: 'audio/mpeg' }), 'song.mp3')
    const upRes = await fetchTimeout(BASE + '/gradio_api/upload', { method: 'POST', body: fd }, 120000)
    if (!upRes.ok) throw new Error('backend upload HTTP ' + upRes.status)
    const upJson = await upRes.json()
    const upPath = Array.isArray(upJson) ? upJson[0] : null
    if (!upPath) throw new Error('backend upload: unexpected reply')

    // 2) join the queue
    const fileData = {
        path: upPath,
        url: BASE + '/gradio_api/file=' + upPath,
        orig_name: 'song.mp3',
        mime_type: 'audio/mpeg',
        meta: { _type: 'gradio.FileData' }
    }
    const joinRes = await fetchTimeout(BASE + '/gradio_api/call/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [fileData] })
    }, 60000)
    if (!joinRes.ok) throw new Error('backend queue HTTP ' + joinRes.status)
    const joinJson = await joinRes.json()
    const eventId = joinJson.event_id
    if (!eventId) throw new Error('backend queue: no event id')

    // 3) wait on the event stream until the result payload shows up
    const ctl = new AbortController()
    const killer = setTimeout(() => ctl.abort(), 9 * 60 * 1000)
    let text = ''
    try {
        const res = await fetch(BASE + '/gradio_api/call/predict/' + eventId, { signal: ctl.signal })
        if (!res.ok) throw new Error('backend stream HTTP ' + res.status)
        if (res.body && typeof res.body.getReader === 'function') {
            const reader = res.body.getReader()
            const dec = new TextDecoder()
            while (true) {
                const part = await reader.read()
                if (part.done) break
                text += dec.decode(part.value, { stream: true })
                if (scanSse(text)) break
            }
        } else {
            text = await res.text()
        }
    } finally { clearTimeout(killer) }

    const files = scanSse(text)
    if (!files) throw new Error('backend: no result (service busy or job failed)')
    return files

    function scanSse(sseText) {
        let found = null
        for (const line of sseText.split('\n')) {
            const t = line.trim()
            if (!t.startsWith('data:')) continue
            const raw = t.slice(5).trim()
            if (!raw || raw === 'null') continue
            let msg
            try { msg = JSON.parse(raw) } catch { continue }
            if (msg && msg.msg === 'process_failed') throw new Error('backend: separation job failed')
            const filesFound = collectFiles(msg, [])
            // The File output arrives as one group; require at least 2 stems.
            if (filesFound.length >= 2) found = filesFound
        }
        return found
    }
}

async function downloadTo(url, dest) {
    const res = await fetchTimeout(url, {}, 300000)
    if (!res.ok) throw new Error('stem download HTTP ' + res.status)
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

let handler = async (m, { conn, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''
    const isAudio = /audio/.test(mime) || q.mtype === 'audioMessage' || q.mtype === 'pttMessage'
    const isVideo = /video/.test(mime) || q.mtype === 'videoMessage'

    if (!isAudio && !isVideo) {
        return conn.reply(m.chat,
            `🎚️ *SILANA STEM SEPARATOR ${VERSION}*\n\n` +
            `Reply to a *song, audio, voice note or video* with:\n` +
            `> ${usedPrefix + command}\n\n` +
            `You get back 2 files:\n` +
            `🎤 *Vocals* — the voice alone\n` +
            `🎵 *Instrumental* — the music alone\n\n` +
            `_Limits: ≤ 25 MB, ≤ 6 minutes. Separation runs on a free AI service, so it can take 1–4 minutes._`, m)
    }
    if (busy) return conn.reply(m.chat, '⏳ Another separation is already running… wait for it to finish, then try again.', m)

    busy = true
    let dir = null
    let statusMsg = null
    try {
        statusMsg = await conn.reply(m.chat, '🎚️ *Separating…*\nUploading your song to the AI separator — this usually takes 1–4 minutes ⏳', m)

        dir = fs.mkdtempSync(path.join(process.env.TMPDIR, 'stem-'))
        // 1) download the quoted media through the platform decryptor
        const rawPath = path.join(dir, 'input.bin')
        let gotBuf = null
        try { gotBuf = await q.download() } catch {}
        if (gotBuf && gotBuf.length > 10000) fs.writeFileSync(rawPath, gotBuf)
        else throw new Error('Could not download that media. Try again.')
        if (fs.statSync(rawPath).size > MAX_SIZE) throw new Error('File too large — the limit is 25 MB.')

        // 2) normalize to mp3 (also extracts the audio track from videos)
        const mp3Path = path.join(dir, 'song.mp3')
        await run('ffmpeg', ['-y', '-i', rawPath, '-vn', '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', mp3Path])
        const dur = await probeDuration(mp3Path)
        if (dur && dur > MAX_DUR) throw new Error(`Song too long (${Math.round(dur)}s) — the limit is 6 minutes.`)

        // 3) separate (with one retry — the free service can be flaky)
        let files = null
        let lastErr = null
        for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
            try { files = await separateOnce(mp3Path); break }
            catch (e) {
                lastErr = e
                if (attempt < ATTEMPTS) await sleep(8000)
            }
        }
        if (!files) throw new Error('The free separation service did not answer properly' + (lastErr ? ` (${lastErr.message})` : '') + '. Please try again in a few minutes.')

        // 4) download the stems and sort them out
        const stems = {}
        for (const f of files) {
            const name = (f.orig_name || f.path.split('/').pop() || '').toLowerCase()
            const dest = path.join(dir, 'stem-' + name.replace(/[^\w.]/g, '_'))
            await downloadTo(f.url || (BASE + '/gradio_api/file=' + f.path), dest)
            if (name.includes('vocal')) stems.vocals = dest
            else if (name.includes('drum')) stems.drums = dest
            else if (name.includes('bass')) stems.bass = dest
            else if (name.includes('other')) stems.other = dest
            else if (!stems.extra) stems.extra = dest
        }
        if (!stems.vocals) throw new Error('The service returned an unexpected result (no vocals stem). Please try again.')

        // 5) vocals -> mp3
        const vocalsOut = path.join(dir, 'vocals.mp3')
        await run('ffmpeg', ['-y', '-i', stems.vocals, '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', vocalsOut])

        // 6) instrumental = mix of every non-vocal stem
        const musicParts = [stems.drums, stems.bass, stems.other, stems.extra].filter(Boolean)
        if (!musicParts.length) throw new Error('The service returned an unexpected result (no music stems). Please try again.')
        const instOut = path.join(dir, 'instrumental.mp3')
        const mixArgs = ['-y']
        for (const p of musicParts) mixArgs.push('-i', p)
        mixArgs.push('-filter_complex', `amix=inputs=${musicParts.length}:duration=longest:normalize=0`, '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', instOut)
        await run('ffmpeg', mixArgs)

        // 7) deliver
        await conn.sendFile(m.chat, vocalsOut, 'vocals.mp3', '🎤 *Vocals only* — separated by Silana .stem', m)
        await conn.sendFile(m.chat, instOut, 'instrumental.mp3', '🎵 *Instrumental only* — no voice, separated by Silana .stem', m)
        if (statusMsg) {
            try { await conn.sendMessage(m.chat, { text: '✅ *Done!* Voice and music separated 🎚️', edit: statusMsg.key }) } catch {}
        }
    } catch (e) {
        const msg = (e && e.message) ? e.message : 'unknown error'
        try { await conn.reply(m.chat, `❌ *Separation failed*\n${msg}`, m) } catch {}
    } finally {
        busy = false
        if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }) } catch {} }
    }
}

handler.help = ['stem']
handler.tags = ['tools']
handler.command = /^(stem|stems|split)$/i
handler.limit = false

export default handler
