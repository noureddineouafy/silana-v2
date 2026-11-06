// mix.js — Music bed mixer (.mix) — v1
// ─────────────────────────────────────────────────────────────────────────────
//   Reply to a voice note or an audio file with .mix and Silana lays a
//   low music bed UNDER it (the voice stays in front) and sends it back:
//     • voice note in  → voice note out (same format, music underneath)
//     • audio file in  → mp3 out (stereo kept)
//
//   .mix              → chill bed (default), volume 20%
//   .mix happy        → mood: chill · happy · sad · epic (or 1-4)
//   .mix epic 30      → second number = music volume % (5-60)
//
//   Music: free Mixkit stock tracks (verified live 2026-11-06), cached
//   under tmp/ after the first download. Mixing is 100% local (ffmpeg).
//   Limits (technical only): file <= 25 MB, audio <= 10 minutes,
//   one mix at a time.
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const run = promisify(execFile)

process.env.TMPDIR = path.join(process.cwd(), 'tmp')
try { fs.mkdirSync(process.env.TMPDIR, { recursive: true }) } catch {}

const VERSION = 'v1'
const MAX_SIZE = 25 * 1024 * 1024
const MAX_DUR = 600
const DEFAULT_VOL = 20

const MOODS = {
    chill: { n: 1, emoji: '😌', url: 'https://assets.mixkit.co/music/16/16.mp3' },
    happy: { n: 2, emoji: '😄', url: 'https://assets.mixkit.co/music/1052/1052.mp3' },
    sad: { n: 3, emoji: '😢', url: 'https://assets.mixkit.co/music/156/156.mp3' },
    epic: { n: 4, emoji: '🔥', url: 'https://assets.mixkit.co/music/322/322.mp3' },
}
const MOOD_BY_NUM = { 1: 'chill', 2: 'happy', 3: 'sad', 4: 'epic' }

let busy = false

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

// Download (once) and cache the mood track; the base auto-cleans tmp/,
// so the cache folder is re-created and re-checked on every run.
async function getBed(mood) {
    const dir = path.join(process.cwd(), 'tmp', 'mix-beds')
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
    const file = path.join(dir, mood + '.mp3')
    try { if (fs.statSync(file).size > 100000) return file } catch {}
    const res = await fetchTimeout(MOODS[mood].url, {}, 120000)
    if (!res.ok) throw new Error('music download HTTP ' + res.status)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100000) throw new Error('music download looked broken — try again')
    fs.writeFileSync(file, buf)
    return file
}

function parseArgs(args) {
    let mood = 'chill'
    let vol = DEFAULT_VOL
    const toks = (args || []).map(s => String(s).toLowerCase())
    for (const t of toks) {
        if (MOODS[t]) mood = t
        else if (MOOD_BY_NUM[t] && toks.length === 1) mood = MOOD_BY_NUM[t]
        else if (MOOD_BY_NUM[t] && mood === 'chill' && vol === DEFAULT_VOL && t === toks[0]) mood = MOOD_BY_NUM[t]
        else if (/^\d+$/.test(t)) {
            const v = parseInt(t, 10)
            if (v >= 5 && v <= 60) vol = v
        }
    }
    return { mood, vol }
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m
    const qmsg = q.msg || q
    const mime = qmsg.mimetype || ''
    const isAudio = /audio/.test(mime) || q.mtype === 'audioMessage' || q.mtype === 'pttMessage'
    const isPtt = qmsg.ptt === true || q.mtype === 'pttMessage'

    if (!isAudio) {
        const moodList = Object.keys(MOODS).map(k => `${MOODS[k].n}. ${MOODS[k].emoji} ${k}`).join('   ')
        return conn.reply(m.chat,
            `🎵 *SILANA MUSIC MIXER ${VERSION}*\n\n` +
            `Reply to a *voice note* or an *audio file* with:\n` +
            `> ${usedPrefix + command} [mood] [volume%]\n\n` +
            `A low music bed is mixed UNDER your audio — the voice stays in front.\n\n` +
            `🎧 *Moods:* ${moodList}\n` +
            `🔊 *Volume:* 5-60% (default 20) — example: ${usedPrefix + command} epic 30\n\n` +
            `_Voice note in → voice note out. Audio file in → mp3 out. Limits: ≤ 25 MB, ≤ 10 minutes._`, m)
    }
    if (busy) return conn.reply(m.chat, '⏳ Another mix is already running… wait for it to finish, then try again.', m)

    const { mood, vol } = parseArgs(args)
    busy = true
    let dir = null
    let statusMsg = null
    try {
        statusMsg = await conn.reply(m.chat, `🎵 *Mixing…*\n${MOODS[mood].emoji} ${mood} bed at ${vol}% under your audio ⏳`, m)

        dir = fs.mkdtempSync(path.join(process.env.TMPDIR, 'mix-'))
        // 1) download the quoted media through the platform decryptor
        const rawPath = path.join(dir, 'input.bin')
        let gotBuf = null
        try { gotBuf = await q.download() } catch {}
        if (gotBuf && gotBuf.length > 1000) fs.writeFileSync(rawPath, gotBuf)
        else throw new Error('Could not download that media. Try again.')
        if (fs.statSync(rawPath).size > MAX_SIZE) throw new Error('File too large — the limit is 25 MB.')

        const dur = await probeDuration(rawPath)
        if (!dur) throw new Error('Could not read that audio. Try another file.')
        if (dur > MAX_DUR) throw new Error(`Audio too long (${Math.round(dur)}s) — the limit is 10 minutes.`)

        // 2) music bed (cached Mixkit track)
        const bed = await getBed(mood)

        // 3) mix: bed looped, trimmed to the voice length, faded in/out,
        //    voice untouched at full volume on top (amix normalize=0)
        const fadeIn = Math.min(1, dur / 4)
        const fadeDur = Math.min(2.5, dur / 3)
        const fadeOutStart = Math.max(dur - fadeDur, 0)
        const filter =
            `[1:a]atrim=0:${dur.toFixed(2)},volume=${(vol / 100).toFixed(2)},` +
            `afade=t=in:st=0:d=${fadeIn.toFixed(2)},afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDur.toFixed(2)}[bed];` +
            `[0:a][bed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`

        if (isPtt) {
            const out = path.join(dir, 'mix.ogg')
            await run('ffmpeg', ['-y', '-v', 'error', '-i', rawPath, '-stream_loop', '-1', '-i', bed,
                '-filter_complex', filter, '-map', '[a]', '-ar', '48000', '-ac', '1', '-c:a', 'libopus', '-b:a', '64k', out])
            await conn.sendMessage(m.chat, { audio: fs.readFileSync(out), ptt: true, mimetype: 'audio/ogg; codecs=opus' }, { quoted: m })
        } else {
            const out = path.join(dir, 'mix.mp3')
            await run('ffmpeg', ['-y', '-v', 'error', '-i', rawPath, '-stream_loop', '-1', '-i', bed,
                '-filter_complex', filter, '-map', '[a]', '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', out])
            await conn.sendFile(m.chat, out, 'silana-mix.mp3', `🎵 *Mixed by Silana .mix* — ${MOODS[mood].emoji} ${mood} bed at ${vol}%`, m)
        }
        if (statusMsg) {
            try { await conn.sendMessage(m.chat, { text: `✅ *Done!* ${MOODS[mood].emoji} ${mood} music mixed under your audio 🎵`, edit: statusMsg.key }) } catch {}
        }
    } catch (e) {
        const msg = (e && e.message) ? e.message : 'unknown error'
        try { await conn.reply(m.chat, `❌ *Mix failed*\n${msg}`, m) } catch {}
    } finally {
        busy = false
        if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }) } catch {} }
    }
}

handler.help = ['mix']
handler.tags = ['tools']
handler.command = /^(mix|bgmusic)$/i
handler.limit = false

export default handler
