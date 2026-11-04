/**
 * dlpack.js — Multi-platform downloader pack for Silana v2 (ChiiMD base, Baileys ESM)
 *
 * One plugin, nineteen downloaders — every command starts with "dl-":
 *   .dl           → menu of the pack (with a working example for each command)
 *   .dl-reddit    <reddit post link | v.redd.it link>   video (audio merged), images, gifs
 *   .dl-sc        <soundcloud track link>               MP3 audio
 *   .dl-gdrive    <google drive share link>             any public file (video/audio/image/document)
 *   .dl-tg        <t.me public post link>               photo/video of public Telegram posts
 *   .dl-vimeo     <vimeo link>                          video
 *   .dl-twitch    <twitch clip link>                    clip video
 *   .dl-streamable <streamable link>                    video
 *   .dl-kwai      <kwai video link>                     video
 *   .dl-rumble    <rumble link>                         video
 *   .dl-pin       <pinterest pin link>                  photo or video of the pin
 *   .dl-mf        <mediafire file link>                 any public file
 *   .dl-st        <streamtape video link>               video
 *   .dl-x         <x/twitter post link>                 video or photo of the post
 *   .dl-pd        <pixeldrain link>                     any public file
 *   .dl-tb        <terabox share link>                  files from public shares
 *   .dl-fb        <facebook video link>                 public videos and reels
 *   .dl-lk        <likee video link>                    video
 *   .dl-gf        <gofile share link>                   any public file
 *   .dl-wt        <wetransfer link>                     the transfer file (usually a zip)
 *
 * v6 (2026-11-04) added Likee, Doodstream, Filemoon, Gofile and WeTransfer.
 * v6.1 (same day): Doodstream and Filemoon were REMOVED — both live-confirmed
 * dead on the panel too (Doodstream: HTTP 403 for the hosting IP + a
 * Cloudflare Turnstile captcha in front of the player; Filemoon: rebuilt as
 * the "Byse" JS app, streams only via premium API keys). Gofile was FIXED:
 * its guest API wants the website-token as an X-Website-Token HEADER (its own
 * frontend's services/contents.js shows the exact call) — as a ?wt= query
 * parameter the API answers error-notPremium. WeTransfer's API route is
 * verified (expired links return the API's own structured errors). Likee is
 * still awaiting a real video link to test with.
 * v6.2 (same day): the Gofile menu example is now a tiny test clip uploaded
 * for this pack (silana-dl-test.mp4) — test examples must always be files
 * whose content is known and clean, never random public uploads.
 *
 * v3: Dailymotion and Bilibili were REMOVED — both platforms hard-block
 * server IPs (DM stream CDN 403, Bilibili anti-bot 412), confirmed live.
 * Every downloader that remains is live-verified end-to-end.
 *
 * Notes:
 * - Reddit post pages are resolved through Reddit's JSON; if Reddit refuses
 *   the server IP, v.redd.it links still work (they go straight to the CDN
 *   DASH playlist, merged locally with ffmpeg).
 * - SoundCloud's client_id is scraped from soundcloud.com's own JS assets
 *   at runtime (cached), exactly like the website does — no key to maintain.
 * - All downloads are capped (95 MB) and land in ./tmp (the panel /tmp is a
 *   tiny tmpfs — see the TMPDIR fix at the top).
 */

import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const run = promisify(execFile)

// Panel /tmp is a 100MB tmpfs — always work under the bot's own folder.
// NOTE: the base auto-cleans ./tmp while running, so the folder can vanish
// at any moment — ensureTmp() recreates it before every use.
const TMPDIR = path.join(process.cwd(), 'tmp', 'dlpack')
function ensureTmp() { try { fs.mkdirSync(TMPDIR, { recursive: true }) } catch {} }
ensureTmp()
process.env.TMPDIR = path.join(process.cwd(), 'tmp')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const MAX_BYTES = 95 * 1024 * 1024

const stamp = () => Date.now() + '-' + Math.floor(Math.random() * 1e6)
const cleanName = (s, fb) => String(s || fb || 'download').replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 80) || 'download'

async function fetchBuf(url, opts = {}, cap = MAX_BYTES) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...(opts.headers || {}) }, redirect: 'follow', signal: AbortSignal.timeout(120000) })
    if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + new URL(url).host)
    const len = Number(r.headers.get('content-length') || 0)
    if (len && len > cap) throw new Error('file too large (' + Math.round(len / 1048576) + ' MB, cap ' + Math.round(cap / 1048576) + ' MB)')
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > cap) throw new Error('file too large (cap ' + Math.round(cap / 1048576) + ' MB)')
    return { buf, type: r.headers.get('content-type') || '', finalUrl: r.url }
}

async function downloadToFile(url, file, headers = {}) {
    ensureTmp()
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(300000) })
    if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + new URL(url).host)
    const len = Number(r.headers.get('content-length') || 0)
    if (len && len > MAX_BYTES) throw new Error('file too large (' + Math.round(len / 1048576) + ' MB, cap 95 MB)')
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new Error('file too large (cap 95 MB)')
    fs.writeFileSync(file, buf)
    return { size: buf.length, type: r.headers.get('content-type') || '' }
}

async function ffmpeg(args, timeout = 600000) {
    ensureTmp()
    try { await run('ffmpeg', ['-y', '-loglevel', 'error', ...args], { timeout }) }
    catch (e) { throw new Error('ffmpeg: ' + String(e.stderr || e.message).slice(0, 200)) }
}

function sendByType(conn, m, file, mime, caption) {
    const buf = fs.readFileSync(file)
    if (/^video\//.test(mime)) return conn.sendMessage(m.chat, { video: buf, caption, mimetype: 'video/mp4' }, { quoted: m })
    if (/^audio\//.test(mime)) return conn.sendMessage(m.chat, { audio: buf, mimetype: 'audio/mpeg', fileName: path.basename(file) }, { quoted: m })
    if (/^image\//.test(mime)) return conn.sendMessage(m.chat, { image: buf, caption }, { quoted: m })
    return conn.sendMessage(m.chat, { document: buf, mimetype: mime || 'application/octet-stream', fileName: path.basename(file), caption }, { quoted: m })
}

/* ---------------- Reddit ---------------- */

async function redditJson(postPath) {
    const hosts = ['https://www.reddit.com', 'https://old.reddit.com']
    let lastErr = ''
    for (const h of hosts) {
        try {
            const r = await fetch(h + postPath + '.json', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
            if (!r.ok) { lastErr = 'HTTP ' + r.status + ' via ' + h; continue }
            const j = await r.json()
            const d = j?.[0]?.data?.children?.[0]?.data
            if (d) return d
            lastErr = 'empty post data via ' + h
        } catch (e) { lastErr = e.message }
    }
    throw new Error('reddit-json: ' + lastErr)
}

async function redditDashToFile(mediaId, out) {
    await ffmpeg(['-user_agent', UA, '-i', `https://v.redd.it/${mediaId}/DASHPlaylist.mpd`, '-c', 'copy', out])
    if (!fs.existsSync(out) || fs.statSync(out).size < 10000) throw new Error('reddit-dash: empty output')
}

async function dlReddit(conn, m, url) {
    const vredd = url.match(/v\.redd\.it\/([a-z0-9]+)/i)
    const out = path.join(TMPDIR, `reddit-${stamp()}.mp4`)
    if (vredd) {
        await redditDashToFile(vredd[1], out)
        return sendByType(conn, m, out, 'video/mp4', '🎬 Reddit video — via Silana DL Pack')
    }
    const post = url.match(/reddit\.com(\/r\/[^?#]+?\/comments\/[a-z0-9]+[^?#]*)|redd\.it\/([a-z0-9]+)/i)
    if (!post) throw new Error('bad-link: not a reddit post / v.redd.it link')
    const postPath = post[1] || ('/comments/' + post[2])
    const d = await redditJson(postPath)
    const title = cleanName(d.title, 'Reddit post')
    const rv = d.secure_media?.reddit_video || d.media?.reddit_video
    if (rv?.fallback_url) {
        const mediaId = rv.fallback_url.match(/v\.redd\.it\/([a-z0-9]+)/i)?.[1]
        if (mediaId) { await redditDashToFile(mediaId, out); return sendByType(conn, m, out, 'video/mp4', '🎬 ' + title) }
        const { buf } = await fetchBuf(rv.fallback_url)
        fs.writeFileSync(out, buf)
        return sendByType(conn, m, out, 'video/mp4', '🎬 ' + title)
    }
    if (d.is_gallery && d.media_metadata) {
        const ids = (d.gallery_data?.items || []).map(i => i.media_id).filter(Boolean).slice(0, 4)
        let sent = 0
        for (const id of ids) {
            const meta = d.media_metadata[id]
            const src = meta?.s?.u?.replace(/&amp;/g, '&')
            if (!src) continue
            const { buf } = await fetchBuf(src)
            await conn.sendMessage(m.chat, { image: buf, caption: sent === 0 ? '🖼️ ' + title : '' }, { quoted: m })
            sent++
        }
        if (sent) return
        throw new Error('reddit-gallery: no downloadable images')
    }
    const direct = (d.url_overridden_by_dest || d.url || '').replace(/&amp;/g, '&')
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(direct)) {
        const { buf } = await fetchBuf(direct)
        return conn.sendMessage(m.chat, { image: buf, caption: '🖼️ ' + title }, { quoted: m })
    }
    if (/\.gif(\?|$)/i.test(direct) || d.preview?.reddit_video_preview?.fallback_url) {
        const src = d.preview?.reddit_video_preview?.fallback_url || direct
        const { buf } = await fetchBuf(src)
        fs.writeFileSync(out, buf)
        return conn.sendMessage(m.chat, { video: buf, caption: '🎬 ' + title, gifPlayback: /\.gif/i.test(src) }, { quoted: m })
    }
    throw new Error('reddit: this post has no downloadable media (text/link post?)')
}

/* ---------------- SoundCloud ---------------- */

let scClientId = ''
async function getScClientId() {
    if (scClientId) return scClientId
    const home = await (await fetch('https://soundcloud.com/', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).text()
    const assets = [...new Set([...home.matchAll(/https:\/\/[^"'\s]*sndcdn\.com\/assets\/[^"'\s]+\.js/g)].map(x => x[0]))]
    for (const a of assets) {
        try {
            const js = await (await fetch(a, { signal: AbortSignal.timeout(20000) })).text()
            const mm = js.match(/client_id["']?\s*[:=]\s*["']([0-9a-zA-Z]{32})["']/)
            if (mm) { scClientId = mm[1]; return scClientId }
        } catch {}
    }
    throw new Error('soundcloud: could not obtain client_id')
}

async function dlSc(conn, m, url) {
    const cid = await getScClientId()
    const res = await fetch('https://api-widget.soundcloud.com/resolve?url=' + encodeURIComponent(url) + '&format=json&client_id=' + cid, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
    if (!res.ok) { scClientId = ''; throw new Error('soundcloud resolve HTTP ' + res.status) }
    const t = await res.json()
    if (t.kind !== 'track') throw new Error('soundcloud: only single tracks are supported (not playlists/sets)')
    const title = cleanName((t.user?.username || '') + ' - ' + (t.title || 'track'), 'SoundCloud track')
    const out = path.join(TMPDIR, `sc-${stamp()}.mp3`)
    const trans = t.media?.transcodings || []
    const prog = trans.find(x => x.format?.protocol === 'progressive')
    const hls = trans.find(x => x.format?.protocol === 'hls')
    if (prog) {
        const s = await (await fetch(prog.url + '?client_id=' + cid, { headers: { 'User-Agent': UA } })).json()
        if (!s?.url) throw new Error('soundcloud: no stream url')
        await downloadToFile(s.url, out)
    } else if (hls) {
        const s = await (await fetch(hls.url + '?client_id=' + cid, { headers: { 'User-Agent': UA } })).json()
        if (!s?.url) throw new Error('soundcloud: no stream url')
        await ffmpeg(['-user_agent', UA, '-i', s.url, '-vn', '-c:a', 'libmp3lame', '-q:a', '3', out], 900000)
    } else throw new Error('soundcloud: no playable stream for this track (paid/premium?)')
    if (!fs.existsSync(out) || fs.statSync(out).size < 20000) throw new Error('soundcloud: empty audio output')
    fs.renameSync(out, path.join(TMPDIR, title + '.mp3'))
    return sendByType(conn, m, path.join(TMPDIR, title + '.mp3'), 'audio/mpeg', '')
}

/* ---------------- Google Drive ---------------- */

async function dlGdrive(conn, m, url) {
    const id = url.match(/[-\w]{25,}/)?.[0]
    if (!id || !/drive\.google\.com|drive\.usercontent\.google\.com/.test(url)) throw new Error('bad-link: not a Google Drive share link')
    const dl = 'https://drive.usercontent.google.com/download?id=' + id + '&export=download&confirm=t'
    const r = await fetch(dl, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    let type = r.headers.get('content-type') || ''
    let name = ''
    const disp = r.headers.get('content-disposition') || ''
    const nm = disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
    if (nm) { try { name = decodeURIComponent(nm[1]) } catch { name = nm[1] } }
    if (/text\/html/.test(type)) {
        // Virus-scan / confirm interstitial for large files: replay its form once.
        const html = await r.text()
        const action = html.match(/<form[^>]+action="([^"]+)"/i)?.[1]?.replace(/&amp;/g, '&')
        if (!action) throw new Error('gdrive: file is not public or needs sign-in (Google returned a page, not the file)')
        const fields = {}
        for (const inp of html.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi)) fields[inp[1]] = inp[2]
        const body = new URLSearchParams(fields).toString()
        const out = path.join(TMPDIR, `gdrive-${stamp()}.bin`)
        const rr = await fetch(action, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body, redirect: 'follow', signal: AbortSignal.timeout(300000) })
        if (!rr.ok) throw new Error('gdrive confirm HTTP ' + rr.status)
        type = rr.headers.get('content-type') || ''
        if (/text\/html/.test(type)) throw new Error('gdrive: Google still returned a page (file too large for direct download or not public)')
        const buf2 = Buffer.from(await rr.arrayBuffer())
        if (buf2.length > MAX_BYTES) throw new Error('file too large (cap 95 MB)')
        fs.writeFileSync(out, buf2)
        const fname = cleanName(name, 'gdrive-file')
        const target = path.join(TMPDIR, fname)
        fs.renameSync(out, target)
        return sendByType(conn, m, target, type, '📁 ' + fname)
    }
    const out = path.join(TMPDIR, `gdrive-${stamp()}.bin`)
    const len = Number(r.headers.get('content-length') || 0)
    if (len && len > MAX_BYTES) throw new Error('file too large (' + Math.round(len / 1048576) + ' MB, cap 95 MB)')
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new Error('file too large (cap 95 MB)')
    if (!buf.length) throw new Error('gdrive: empty response (file not public?)')
    fs.writeFileSync(out, buf)
    const fname = cleanName(name, 'gdrive-file')
    const target = path.join(TMPDIR, fname)
    fs.renameSync(out, target)
    return sendByType(conn, m, target, type, '📁 ' + fname)
}


async function dlTg(conn, m, url) {
    const mm = url.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)\/(\d+)/)
    if (!mm || mm[1] === 's' || mm[1] === 'joinchat') throw new Error('bad-link: not a public Telegram post link (t.me/<channel>/<post id>)')
    const emb = await fetch(`https://t.me/${mm[1]}/${mm[2]}?embed=1&mode=tme`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
    if (!emb.ok) throw new Error('telegram HTTP ' + emb.status)
    const html = await emb.text()
    const vid = html.match(/<video[^>]+src="(https:\/\/cdn\d*\.telesco\.pe\/[^"]+)"/)?.[1] || html.match(/(https:\/\/cdn\d*\.telesco\.pe\/file\/[^"'\s]+\.mp4[^"'\s]*)/)?.[1]
    if (vid) {
        const out = path.join(TMPDIR, `tg-${stamp()}.mp4`)
        await downloadToFile(vid.replace(/&amp;/g, '&'), out)
        return sendByType(conn, m, out, 'video/mp4', '🎬 Telegram video — via Silana DL Pack')
    }
    const photo = html.match(/background-image:url\('(https:\/\/cdn\d*\.telesco\.pe\/[^']+)'\)/)?.[1]
    if (photo) {
        const { buf } = await fetchBuf(photo.replace(/&amp;/g, '&'))
        return conn.sendMessage(m.chat, { image: buf, caption: '🖼️ Telegram photo — via Silana DL Pack' }, { quoted: m })
    }
    throw new Error('telegram: no downloadable media in this post (text-only, private channel, or a group/channel the web preview cannot see)')
}

/* ---------------- Vimeo ---------------- */

async function dlVimeo(conn, m, url) {
    const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1]
    if (!id) throw new Error('bad-link: not a Vimeo video link')
    // Route 1: player /config → progressive MP4 (blocked on many server IPs)
    try {
        const r = await fetch('https://player.vimeo.com/video/' + id + '/config', { headers: { 'User-Agent': UA, 'Referer': 'https://vimeo.com/' }, signal: AbortSignal.timeout(30000) })
        if (r.ok) {
            const j = await r.json().catch(() => null)
            const progs = (j?.request?.files?.progressive || []).slice().sort((a, b) => (b.height || 0) - (a.height || 0))
            const pick = progs.find(p => (p.height || 0) <= 720) || progs[progs.length - 1]
            if (pick?.url) {
                const out = path.join(TMPDIR, `vimeo-${stamp()}.mp4`)
                await downloadToFile(pick.url, out)
                return sendByType(conn, m, out, 'video/mp4', '🎬 ' + cleanName(j?.video?.title, 'Vimeo video'))
            }
        }
    } catch {}
    // Route 2: the player page embeds window.playerConfig with signed HLS streams
    const page = await fetch('https://player.vimeo.com/video/' + id, { headers: { 'User-Agent': UA, 'Referer': 'https://vimeo.com/' }, signal: AbortSignal.timeout(30000) })
    if (!page.ok) throw new Error('vimeo: player page refused (HTTP ' + page.status + ')')
    const html = await page.text()
    const cfgTxt = html.match(/window\.playerConfig\s*=\s*(\{.*?\})<\/script>/s)?.[1]
    if (!cfgTxt) throw new Error('vimeo: no embedded player config (private/password-protected video?)')
    const cfg = JSON.parse(cfgTxt)
    const hls = cfg?.request?.files?.hls
    const master = hls?.cdns?.[hls?.default_cdn]?.url || Object.values(hls?.cdns || {})[0]?.url
    if (!master) throw new Error('vimeo: no HLS stream in the player config')
    let src = master
    try {
        const pl = await (await fetch(master, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).text()
        const variants = [...pl.matchAll(/#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\s]+)/g)].map(x => ({ h: +x[1], url: new URL(x[2], master).href })).sort((a, b) => b.h - a.h)
        const pick = variants.find(v => v.h <= 720) || variants[variants.length - 1]
        if (pick) src = pick.url
    } catch {}
    const out = path.join(TMPDIR, `vimeo-${stamp()}.mp4`)
    await ffmpeg(['-user_agent', UA, '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-reconnect_at_eof', '1', '-i', src, '-c', 'copy', out], 900000)
    if (!fs.existsSync(out) || fs.statSync(out).size < 10000) throw new Error('vimeo: empty output')
    return sendByType(conn, m, out, 'video/mp4', '🎬 ' + cleanName(cfg?.video?.title, 'Vimeo video'))
}

/* ---------------- Twitch clips ---------------- */

async function dlTwitch(conn, m, url) {
    const slug = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/)?.[1] || url.match(/twitch\.tv\/[^/]+\/clip\/([A-Za-z0-9_-]+)/)?.[1]
    if (!slug) throw new Error('bad-link: not a Twitch clip link')
    const query = 'query ClipAccessToken($slug: ID!) { clip(slug: $slug) { title playbackAccessToken(params: {platform: "web", playerType: "site"}) { signature value } videoQualities { sourceURL quality } } }'
    const r = await fetch('https://gql.twitch.tv/gql', { method: 'POST', headers: { 'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko', 'Content-Type': 'application/json', 'User-Agent': UA }, body: JSON.stringify({ query, variables: { slug } }), signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('twitch gql HTTP ' + r.status)
    const j = await r.json().catch(() => null)
    const clip = j?.data?.clip
    if (!clip?.videoQualities?.length) throw new Error('twitch: clip not found or deleted')
    const qs = clip.videoQualities.slice().sort((a, b) => (+b.quality || 0) - (+a.quality || 0))
    const pick = qs.find(q => (+q.quality || 0) <= 720) || qs[qs.length - 1]
    const src = pick.sourceURL + '?sig=' + clip.playbackAccessToken.signature + '&token=' + encodeURIComponent(clip.playbackAccessToken.value)
    const title = cleanName(clip.title, 'Twitch clip')
    const out = path.join(TMPDIR, `twitch-${stamp()}.mp4`)
    await ffmpeg(['-user_agent', UA, '-i', src, '-c', 'copy', out], 600000)
    if (!fs.existsSync(out) || fs.statSync(out).size < 10000) throw new Error('twitch: empty output')
    return sendByType(conn, m, out, 'video/mp4', '🎬 ' + title)
}

/* ---------------- Streamable ---------------- */

async function dlStreamable(conn, m, url) {
    const id = url.match(/streamable\.com\/(?:e\/)?([a-z0-9]+)/i)?.[1]
    if (!id) throw new Error('bad-link: not a Streamable link')
    const r = await fetch('https://api.streamable.com/videos/' + id, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('streamable api HTTP ' + r.status)
    const j = await r.json().catch(() => null)
    const f = j?.files?.mp4 || j?.files?.['mp4-mobile']
    if (!f?.url) throw new Error('streamable: video not ready or removed (status ' + (j?.status ?? '?') + ')')
    const title = cleanName(j?.title, 'Streamable video')
    const out = path.join(TMPDIR, `streamable-${stamp()}.mp4`)
    await downloadToFile(f.url.startsWith('//') ? 'https:' + f.url : f.url, out)
    return sendByType(conn, m, out, 'video/mp4', '🎬 ' + title)
}

/* ---------------- Kwai ---------------- */

async function dlKwai(conn, m, url) {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('kwai HTTP ' + r.status)
    const html = await r.text()
    const src = html.match(/property="og:video(?::secure_url)?" content="([^"]+)"/)?.[1]
        || html.match(/"playUrl"\s*:\s*"(https?:[^"]+?)"/)?.[1]?.replace(/\\u002F/g, '/').replace(/\\\//g, '/')
        || html.match(/"photoUrl"\s*:\s*"(https?:[^"]+?)"/)?.[1]?.replace(/\\u002F/g, '/').replace(/\\\//g, '/')
        || html.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/)?.[0]
    if (!src) throw new Error('kwai: no video URL in the page — Kwai shows most of its web pages only inside the app')
    const out = path.join(TMPDIR, `kwai-${stamp()}.mp4`)
    await downloadToFile(src.replace(/&amp;/g, '&'), out)
    return sendByType(conn, m, out, 'video/mp4', '🎬 Kwai video — via Silana DL Pack')
}

/* ---------------- Rumble ---------------- */

async function dlRumble(conn, m, url) {
    const embId = url.match(/rumble\.com\/embed\/(v[0-9a-z]+)/i)?.[1] || url.match(/rumble\.com\/(v[0-9a-z]+)(?:-|\.html)/i)?.[1]
    if (!embId) throw new Error('bad-link: not a Rumble video link')
    const r = await fetch('https://rumble.com/embed/' + embId + '/?pub=4', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('rumble embed HTTP ' + r.status)
    const html = await r.text()
    const i = html.indexOf('"mp4"')
    const seg = i >= 0 ? html.slice(i, i + 6000) : ''
    const entries = [...seg.matchAll(/"(\d+)"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/g)].map(x => ({ q: +x[1], url: x[2].replace(/\\\//g, '/') }))
    if (!entries.length) throw new Error('rumble: no mp4 stream in the embed page (live stream or removed?)')
    entries.sort((a, b) => b.q - a.q)
    const pick = entries.find(e => e.q <= 720) || entries[entries.length - 1]
    const title = cleanName(html.match(/property="og:title" content="([^"]+)"/)?.[1], 'Rumble video')
    const out = path.join(TMPDIR, `rumble-${stamp()}.mp4`)
    await downloadToFile(pick.url, out)
    return sendByType(conn, m, out, 'video/mp4', '🎬 ' + title)
}

/* ---------------- Pinterest (photos + videos) ---------------- */

async function dlPin(conn, m, url) {
    if (!/pinterest\.[a-z.]+\/pin\/|pin\.it\//i.test(url)) throw new Error('bad-link: not a Pinterest pin link')
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('pinterest HTTP ' + r.status)
    const html = (await r.text()).replace(/\\\//g, '/')
    const title = cleanName(html.match(/"title"\s*:\s*"([^"]{3,120})"/)?.[1], 'Pinterest pin')
    // Video pins: progressive MP4s are embedded in the page — take the best resolution
    const mp4s = [...new Set([...html.matchAll(/https:\/\/v\d\.pinimg\.com\/videos\/[^"'\s]+\.mp4/g)].map(x => x[0]))]
    if (mp4s.length) {
        const score = u => { const mm = u.match(/(\d{3,4})p/); return mm ? +mm[1] : 0 }
        mp4s.sort((a, b) => score(b) - score(a))
        const out = path.join(TMPDIR, `pin-${stamp()}.mp4`)
        await downloadToFile(mp4s[0], out)
        return sendByType(conn, m, out, 'video/mp4', '📌 ' + title)
    }
    const m3u8 = html.match(/https:\/\/v\d\.pinimg\.com\/videos\/[^"'\s]+\.m3u8/)?.[0]
    if (m3u8) {
        const out = path.join(TMPDIR, `pin-${stamp()}.mp4`)
        await ffmpeg(['-user_agent', UA, '-i', m3u8, '-c', 'copy', out], 900000)
        if (!fs.existsSync(out) || fs.statSync(out).size < 10000) throw new Error('pinterest: empty video output')
        return sendByType(conn, m, out, 'video/mp4', '📌 ' + title)
    }
    // Photo pins: the pin's own image is the one published in the most sizes
    const groups = {}
    for (const x of html.matchAll(/https:\/\/i\.pinimg\.com\/(originals|736x|564x|474x|236x)\/([0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]+\.(?:jpg|jpeg|png|webp))/g)) {
        if (!groups[x[2]]) groups[x[2]] = {}
        groups[x[2]][x[1]] = x[0]
    }
    const best = Object.values(groups).sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0]
    const img = best?.originals || best?.['736x'] || (best && Object.values(best)[0])
    if (!img) throw new Error('pinterest: no photo or video found on this pin')
    const out = path.join(TMPDIR, `pin-${stamp()}` + (path.extname(new URL(img).pathname) || '.jpg'))
    await downloadToFile(img, out)
    return sendByType(conn, m, out, 'image/jpeg', '📌 ' + title)
}

// Streaming download for CDNs whose connections close dirtily (MediaFire's
// servers + some proxies cut the final bytes, which makes strict fetch reads
// fail with a content-length mismatch even though the file arrived complete).
// Accepts the file when the stream ends cleanly, or when the byte count
// matches the expected total.
async function downloadStream(url, file, headers = {}, expectedTotal = 0) {
    ensureTmp()
    let got = 0
    let total = expectedTotal || 0
    const ws = fs.createWriteStream(file)
    try {
        for (let round = 0; round < 80; round++) {
            const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers, ...(got ? { 'Range': 'bytes=' + got + '-' } : {}) }, redirect: 'follow', signal: AbortSignal.timeout(180000) })
            if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status + ' from ' + new URL(url).host)
            if (got && r.status === 200) throw new Error('server does not support resume — download aborted midway')
            if (!total) total = +(r.headers.get('content-range')?.split('/')[1] || r.headers.get('content-length') || 0)
            if (total > MAX_BYTES) throw new Error(`file too large (${(total / 1048576).toFixed(0)} MB, cap 95 MB)`)
            const reader = r.body.getReader()
            let roundErr = null
            try {
                for (;;) {
                    const { done, value } = await reader.read()
                    if (done) break
                    got += value.length
                    if (got > MAX_BYTES) throw new Error('file too large (over 95 MB cap)')
                    await new Promise((res, rej) => ws.write(value, e => (e ? rej(e) : res())))
                }
            } catch (e) { if (/too large/.test(e.message)) throw e; roundErr = e }
            if (!roundErr && (!total || got >= total)) break   // clean finish
            if (roundErr && !total) throw roundErr              // dirty close, size unknown — cannot verify
            if (total && got >= total) break                    // all bytes arrived despite the dirty close
            // otherwise: loop and resume from `got` with a Range request
        }
    } finally { await new Promise(res => ws.end(res)) }
    if (total && got !== total) throw new Error(`incomplete download (${got}/${total} bytes)`)
    if (!got) throw new Error('empty download')
    return got
}

/* ---------------- MediaFire ---------------- */

const MF_MIME = { '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf', '.zip': 'application/zip', '.rar': 'application/vnd.rar', '.txt': 'text/plain' }

async function dlMf(conn, m, url) {
    if (!/mediafire\.com\/file\//i.test(url)) throw new Error('bad-link: not a MediaFire file link')
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('mediafire HTTP ' + r.status)
    const html = await r.text()
    const direct = html.match(/id="downloadButton"[^>]*href="([^"]+)"/)?.[1] || html.match(/href="(https:\/\/download\d*\.mediafire\.com\/[^"]+)"/)?.[1]
    if (!direct) throw new Error('mediafire: download button not found (file removed/private, or a folder link)')
    let fname = html.match(/<div class="filename">([^<]+)<\/div>/)?.[1]?.trim() || ''
    if (!fname) { try { fname = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean)[2] || '') } catch {} }
    fname = cleanName(fname, 'MediaFire file')
    const ext = path.extname(fname).toLowerCase()
    const directUrl = direct.replace(/&amp;/g, '&')
    // Learn the exact size up-front (headers only) so a dirty connection
    // close can be told apart from a truncated file.
    let total = 0
    try { const hr = await fetch(directUrl, { headers: { 'User-Agent': UA, 'Range': 'bytes=0-0' }, signal: AbortSignal.timeout(20000) }); total = +(hr.headers.get('content-range')?.split('/')[1] || 0); if (hr.body) hr.body.cancel().catch(() => {}) } catch {}
    const tmp = path.join(TMPDIR, `mf-${stamp()}.bin`)
    await downloadStream(directUrl, tmp, {}, total)
    const target = path.join(TMPDIR, fname || `mediafire-${stamp()}.bin`)
    fs.renameSync(tmp, target)
    return sendByType(conn, m, target, MF_MIME[ext] || 'application/octet-stream', '💾 ' + fname)
}

/* ---------------- Streamtape ---------------- */

async function dlSt(conn, m, url) {
    const idm = url.match(/streamtape\.(?:com|to|net|xyz)\/(?:v|e)\/([A-Za-z0-9]+)/i)
    if (!idm) throw new Error('bad-link: not a Streamtape video link')
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('streamtape HTTP ' + r.status)
    const html = await r.text()
    // The watch page assembles the real link in a script: a static prefix plus a
    // junk-padded query string trimmed by a chain of .substring(n) calls.
    const s = html.match(/robotlink'\)\.innerHTML\s*=\s*'([^']*)'\s*\+\s*\('([^']*)'\)((?:\.substring\(\d+\))+)/)
    let full = ''
    if (s) {
        let tail = s[2]
        for (const n of s[3].match(/\d+/g)) tail = tail.substring(+n)
        full = (s[1].startsWith('//') ? 'https:' + s[1] : s[1]) + tail
    } else {
        const plain = html.match(/(?:https?:)?\/\/streamtape\.(?:com|to)\/get_video\?id=[^"'\s<]+/)?.[0]
        if (plain) full = plain.startsWith('//') ? 'https:' + plain : plain
    }
    if (!full) throw new Error('streamtape: could not assemble the download link (page layout changed or video removed)')
    let fname = ''
    try { fname = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean)[2] || '') } catch {}
    const title = cleanName(fname.replace(/\.mp4$/i, ''), 'Streamtape video')
    const out = path.join(TMPDIR, `st-${stamp()}.mp4`)
    await downloadToFile(full, out, { 'Referer': url })
    return sendByType(conn, m, out, 'video/mp4', '🎬 ' + title)
}

/* ---------------- X / Twitter ---------------- */

async function dlX(conn, m, url) {
    const mm = url.match(/(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/i)
    if (!mm) throw new Error('bad-link: not an X/Twitter post link')
    let media = [], text = ''
    try {
        const j = await (await fetch(`https://api.fxtwitter.com/${mm[1]}/status/${mm[2]}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json()
        if (j?.code === 200 && j.tweet) { text = j.tweet.text || ''; media = (j.tweet.media?.all || []).map(x => ({ type: x.type, url: x.url })) }
    } catch {}
    if (!media.length) {
        const j = await (await fetch(`https://api.vxtwitter.com/${mm[1]}/status/${mm[2]}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json().catch(() => null)
        if (j) { text = text || j.text || ''; media = (j.media_extended || []).map(x => ({ type: x.type, url: x.url })) }
    }
    if (!media.length) throw new Error('x: this post has no downloadable media (or it is private/deleted)')
    const title = cleanName(text, 'X post')
    const vid = media.find(x => (x.type === 'video' || x.type === 'gif') && /\.mp4/.test(x.url || ''))
    if (vid) {
        const out = path.join(TMPDIR, `x-${stamp()}.mp4`)
        await downloadToFile(vid.url, out)
        return sendByType(conn, m, out, 'video/mp4', '🐦 ' + title)
    }
    const photo = media.find(x => x.type === 'photo' && x.url)
    if (photo) {
        const out = path.join(TMPDIR, `x-${stamp()}` + (path.extname(new URL(photo.url).pathname) || '.jpg'))
        await downloadToFile(photo.url, out)
        return sendByType(conn, m, out, 'image/jpeg', '🐦 ' + title)
    }
    throw new Error('x: no video or photo found in this post')
}

/* ---------------- Pixeldrain ---------------- */

async function dlPd(conn, m, url) {
    const lm = url.match(/pixeldrain\.com\/l\/([A-Za-z0-9]+)/)
    const fm = url.match(/pixeldrain\.com\/u\/([A-Za-z0-9]+)/)
    if (!lm && !fm) throw new Error('bad-link: not a Pixeldrain link')
    let id, name = '', size = 0, mime = ''
    if (lm) {
        const j = await (await fetch('https://pixeldrain.com/api/list/' + lm[1], { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json().catch(() => null)
        const files = (j?.files || []).filter(f => f.id)
        if (!files.length) throw new Error('pixeldrain: list is empty or not public')
        files.sort((a, b) => (b.size || 0) - (a.size || 0))
        const f = files[0]
        id = f.id; name = f.name || ''; size = f.size || 0; mime = f.mime_type || ''
        if (files.length > 1) name = name + `  (+${files.length - 1} more in the list — largest sent)`
    } else {
        id = fm[1]
        const j = await (await fetch('https://pixeldrain.com/api/file/' + id + '/info', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json().catch(() => null)
        if (!j?.success) throw new Error('pixeldrain: file not found (deleted or private)')
        name = j.name || ''; size = j.size || 0; mime = j.mime_type || ''
    }
    if (size > MAX_BYTES) throw new Error(`file too large (${(size / 1048576).toFixed(0)} MB, cap 95 MB)`)
    name = cleanName(name, 'Pixeldrain file')
    const ext = path.extname(name).toLowerCase()
    const tmp = path.join(TMPDIR, `pd-${stamp()}.bin`)
    await downloadToFile('https://pixeldrain.com/api/file/' + id + '?download', tmp)
    const target = path.join(TMPDIR, name)
    fs.renameSync(tmp, target)
    return sendByType(conn, m, target, mime || MF_MIME[ext] || 'application/octet-stream', '📦 ' + name)
}

/* ---------------- Terabox ---------------- */

async function dlTb(conn, m, url) {
    const surl = url.match(/[?&]surl=([A-Za-z0-9_-]+)/)?.[1] || url.match(/\/s\/1?([A-Za-z0-9_-]{10,})/)?.[1]
    if (!surl || !/terabox|1024tera|mirrobox|nephobox|freeterabox|terashare|momerybox|gibibox|tibibox|4funbox/i.test(url)) throw new Error('bad-link: not a Terabox share link')
    const base = 'https://www.terabox.com'
    const pageRes = await fetch(base + '/s/1' + surl, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    const cookie = (pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ')
    const html = await pageRes.text()
    const jsToken = html.match(/window\.jsToken\s*=\s*'([^']+)'/)?.[1] || html.match(/"jsToken"\s*:\s*"([^"]+)"/)?.[1] || ''
    const listUrl = `${base}/share/list?app_id=250528&web=1&channel=chunlei&clienttype=0&shorturl=${surl}&page=1&num=20&order=name` + (jsToken ? '&jsToken=' + encodeURIComponent(jsToken) : '')
    const j = await (await fetch(listUrl, { headers: { 'User-Agent': UA, 'Cookie': cookie, 'Referer': base + '/s/1' + surl }, signal: AbortSignal.timeout(30000) })).json().catch(() => null)
    if (!j) throw new Error('terabox: no answer from the share API (blocked or down)')
    if (j.errno === -9 || j.errno === -12) throw new Error('terabox: this share needs an extraction code — password shares are not supported')
    if (j.errno !== 0) throw new Error('terabox: share refused (errno ' + j.errno + ' — deleted, expired, or login-walled)')
    const files = (j.list || []).filter(f => !+f.isdir && f.dlink)
    if (!files.length) throw new Error('terabox: no downloadable file in this share (folder of folders, or login wall)')
    files.sort((a, b) => (+b.size || 0) - (+a.size || 0))
    const f = files[0]
    if (+f.size > MAX_BYTES) throw new Error(`file too large (${(+f.size / 1048576).toFixed(0)} MB, cap 95 MB)`)
    const fname = cleanName(f.server_filename, 'Terabox file')
    const ext = path.extname(fname).toLowerCase()
    const tmp = path.join(TMPDIR, `tb-${stamp()}.bin`)
    await downloadToFile(f.dlink, tmp, { 'Cookie': cookie, 'Referer': base + '/' })
    const target = path.join(TMPDIR, fname)
    fs.renameSync(tmp, target)
    const note = files.length > 1 ? `  (+${files.length - 1} more in the share — largest sent)` : ''
    return sendByType(conn, m, target, MF_MIME[ext] || 'application/octet-stream', '☁️ ' + fname + note)
}

/* ---------------- Facebook (public videos via the official embed player) ---------------- */

async function dlFb(conn, m, url) {
    if (!/facebook\.com|fb\.watch/i.test(url)) throw new Error('bad-link: not a Facebook link')
    const embed = 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url) + '&show_text=false&width=720'
    const r = await fetch(embed, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('facebook embed HTTP ' + r.status)
    const html = (await r.text()).replace(/\\\//g, '/').replace(/\\u0026/g, '&')
    const hd = html.match(/"browser_native_hd_url"\s*:\s*"([^"]+)"/)?.[1]
    const sd = html.match(/"browser_native_sd_url"\s*:\s*"([^"]+)"/)?.[1]
    const any = html.match(/https:\/\/video-[^"'\s]+\.mp4[^"'\s]*/)?.[0]
    const src = hd || sd || any
    if (!src && /\/share\/|fb\.watch/i.test(url)) throw new Error('facebook: share links hide the video — send the direct link instead (open the video, copy the watch/reel link)')
    if (!src) throw new Error('facebook: no video source in the embed page (private video, or this server is walled)')
    const out = path.join(TMPDIR, `fb-${stamp()}.mp4`)
    await downloadToFile(src, out)
    return sendByType(conn, m, out, 'video/mp4', '📘 Facebook video — via Silana DL Pack')
}

/* ---------------- Likee ---------------- */

async function dlLk(conn, m, url) {
    if (!/likee\.video|like\.video|likee\.com|l\.likee/i.test(url)) throw new Error('bad-link: not a Likee link')
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error('likee: page refused (HTTP ' + r.status + ')')
    const html = (await r.text()).replace(/\\\//g, '/').replace(/\\u002F/g, '/')
    // A dead short link lands on the Likee home page — that is not a video.
    if (/^https?:\/\/(www\.)?likee\.video\/?$/.test(r.url || '')) throw new Error('likee: this link no longer leads to a video (expired share link?)')
    let src = html.match(/property="og:video(?::secure_url)?" content="([^"]+)"/)?.[1]
        || html.match(/"video_url"\s*:\s*"([^"]+)"/)?.[1]
        || html.match(/"videoUrl"\s*:\s*"([^"]+)"/)?.[1]
        || html.match(/"ori_video_url"\s*:\s*"([^"]+)"/)?.[1]
    if (!src) {
        const mp4s = [...new Set([...html.matchAll(/https:[^"' ]+?\.mp4[^"' ]*/g)].map(x => x[0]))].filter(u => !/sprite|thumb|cover|avatar/i.test(u))
        src = mp4s.sort((a, b) => b.length - a.length)[0]
    }
    if (!src) throw new Error('likee: no video source found on the page (deleted/private video, or Likee changed its player)')
    const title = cleanName(html.match(/property="og:title" content="([^"]+)"/)?.[1], 'Likee video')
    const out = path.join(TMPDIR, `lk-${stamp()}.mp4`)
    await downloadToFile(src, out, { Referer: 'https://likee.video/' })
    return sendByType(conn, m, out, 'video/mp4', '🎵 ' + title + ' — via Silana DL Pack')
}

/* ---------------- Gofile ---------------- */

let gfCache = { token: '', wt: '', at: 0 }

async function gofileWt(token) {
    // Gofile's "wt" website-token is computed by an obfuscated script the
    // site itself ships (gofile.io/js/wt.obf.js, exposing generateWT(token)).
    // Run the site's own script in a sandbox, exactly like a browser does.
    const { runInNewContext } = await import('vm')
    const code = await (await fetch('https://gofile.io/js/wt.obf.js', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).text()
    const sandbox = { navigator: { userAgent: UA, language: 'en-US' }, location: { href: 'https://gofile.io/', hostname: 'gofile.io', origin: 'https://gofile.io', pathname: '/' }, document: { cookie: '', createElement: () => ({ style: {}, setAttribute: () => {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, head: { appendChild: () => {} }, body: { appendChild: () => {} } }, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, console: { log: () => {}, warn: () => {}, error: () => {} } }
    sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox
    runInNewContext(code, sandbox, { timeout: 5000 })
    if (typeof sandbox.generateWT !== 'function') throw new Error('gofile: the wt script changed shape')
    const wt = sandbox.generateWT(token)
    return String((wt && wt.then) ? await wt : wt)
}

async function dlGf(conn, m, url) {
    const idm = url.match(/gofile\.io\/d\/([A-Za-z0-9_-]+)/)
    if (!idm) throw new Error('bad-link: not a Gofile link')
    if (!gfCache.token || Date.now() - gfCache.at > 10 * 60 * 1000) {
        const acc = await (await fetch('https://api.gofile.io/accounts', { method: 'POST', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json().catch(() => null)
        if (!acc?.data?.token) throw new Error('gofile: could not open a guest session')
        gfCache = { token: acc.data.token, wt: '', at: Date.now() }
    }
    if (!gfCache.wt) gfCache.wt = await gofileWt(gfCache.token)
    // The website-token travels as an X-Website-Token HEADER — as a ?wt=
    // query parameter the API ignores it and answers error-notPremium.
    // (Request shape taken from Gofile's own frontend, services/contents.js.)
    const gfQuery = 'page=1&pageSize=100&sortField=name&sortDirection=1'
    const j = await (await fetch(`https://api.gofile.io/contents/${idm[1]}?${gfQuery}`, { headers: { 'User-Agent': UA, Authorization: 'Bearer ' + gfCache.token, 'X-Website-Token': gfCache.wt, 'X-BL': 'en-US' }, signal: AbortSignal.timeout(30000) })).json().catch(() => null)
    if (!j) throw new Error('gofile: no answer from the API')
    if (j.status !== 'ok') throw new Error('gofile: API refused (' + (j.status || 'unknown') + ') — the share is private, or Gofile is restricting guest API access right now')
    const box = j.data?.children || j.data?.contents || {}
    let files = Object.values(box).filter(f => f && f.link && (f.type === 'file' || !f.children))
    if (!files.length && j.data?.link) files = [j.data] // single-file share: the content itself is the file
    if (!files.length) throw new Error('gofile: no downloadable file in this share')
    files.sort((a, b) => (b.size || 0) - (a.size || 0))
    const f = files[0]
    if (f.size > MAX_BYTES) throw new Error(`file too large (${(f.size / 1048576).toFixed(0)} MB, cap 95 MB)`)
    const fname = cleanName(f.name, 'Gofile file')
    const ext = path.extname(fname).toLowerCase()
    const tmp = path.join(TMPDIR, `gf-${stamp()}.bin`)
    await downloadToFile(f.link, tmp, { Cookie: 'accountToken=' + gfCache.token })
    const target = path.join(TMPDIR, fname)
    fs.renameSync(tmp, target)
    const note = files.length > 1 ? `  (+${files.length - 1} more in the share — largest sent)` : ''
    return sendByType(conn, m, target, f.mimetype || MF_MIME[ext] || 'application/octet-stream', '📁 ' + fname + note)
}

/* ---------------- WeTransfer ---------------- */

async function dlWt(conn, m, url) {
    let id = '', hash = ''
    const full = url.match(/wetransfer\.com\/downloads\/([0-9a-f]+)\/([0-9a-f]+)/i)
    if (full) { id = full[1]; hash = full[2] }
    else if (/we\.tl\//i.test(url)) {
        const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
        const mm = (r.url || '').match(/wetransfer\.com\/downloads\/([0-9a-f]+)\/([0-9a-f]+)/i)
        if (!mm) throw new Error('wetransfer: this short link did not lead to a download page (expired?)')
        id = mm[1]; hash = mm[2]
    } else throw new Error('bad-link: not a WeTransfer link')
    const r = await fetch(`https://wetransfer.com/api/v4/transfers/${id}/download`, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest' }, body: JSON.stringify({ security_hash: hash, intent: 'entire_transfer' }), signal: AbortSignal.timeout(30000) })
    const j = await r.json().catch(() => null)
    if (!j?.direct_link) throw new Error('wetransfer: no download link back (' + (j?.message || 'HTTP ' + r.status) + ') — WeTransfer links expire after a few days')
    const fromUrl = decodeURIComponent(new URL(j.direct_link).pathname.split('/').pop() || '')
    const fname = cleanName(j.recommended_filename || fromUrl, 'wetransfer.zip')
    const ext = path.extname(fname).toLowerCase()
    const tmp = path.join(TMPDIR, `wt-${stamp()}.bin`)
    await downloadToFile(j.direct_link, tmp)
    const target = path.join(TMPDIR, fname)
    fs.renameSync(tmp, target)
    return sendByType(conn, m, target, MF_MIME[ext] || 'application/octet-stream', '💧 ' + fname + ' — via WeTransfer')
}

/* ---------------- Handler ---------------- */

const SOURCES = {
    'dl-reddit': { fn: dlReddit, label: 'Reddit', need: 'a Reddit post link or a v.redd.it link', example: 'https://v.redd.it/g5xu53hv97s61' },
    'dl-sc': { fn: dlSc, label: 'SoundCloud', need: 'a SoundCloud track link', example: 'https://soundcloud.com/forss/flickermood' },
    'dl-gdrive': { fn: dlGdrive, label: 'Google Drive', need: 'a public Google Drive share link', example: 'https://drive.google.com/file/d/1vn-wW9uxrmKzYogfrVn7t9V1j5rZLOBC/view' },
    'dl-tg': { fn: dlTg, label: 'Telegram', need: 'a public Telegram post link (t.me/channel/123)', example: 'https://t.me/telegram/441' },
    'dl-vimeo': { fn: dlVimeo, label: 'Vimeo', need: 'a Vimeo video link', example: 'https://vimeo.com/847497330' },
    'dl-twitch': { fn: dlTwitch, label: 'Twitch', need: 'a Twitch clip link (clips.twitch.tv/…)', example: 'https://clips.twitch.tv/DirtyRudePineappleHotPokket-5O0zpDLNgOZKwZpp' },
    'dl-streamable': { fn: dlStreamable, label: 'Streamable', need: 'a Streamable link', example: 'https://streamable.com/aqbjxq' },
    'dl-kwai': { fn: dlKwai, label: 'Kwai', need: 'a Kwai video link', example: 'https://k.kwai.com/p/Ph9CfDIO' },
    'dl-rumble': { fn: dlRumble, label: 'Rumble', need: 'a Rumble video link', example: 'https://rumble.com/vcld79-the-right-view-with-president-donald-j-trump-and-lara-trump.html' },
    'dl-pin': { fn: dlPin, label: 'Pinterest', need: 'a Pinterest pin link (photo or video)', example: 'https://www.pinterest.com/pin/baby-video--17099673581133973/' },
    'dl-mf': { fn: dlMf, label: 'MediaFire', need: 'a MediaFire file link', example: 'https://www.mediafire.com/file/4ba0oemf7sd39k9/UQMG_JTW_Sample_MissionPack_2.zip/file' },
    'dl-st': { fn: dlSt, label: 'Streamtape', need: 'a Streamtape video link', example: 'https://streamtape.com/v/m7XGwwGRM6HbK9Y/VID-20251205-WA0067.mp4' },
    'dl-x': { fn: dlX, label: 'X (Twitter)', need: 'an X/Twitter post link', example: 'https://x.com/AbdulElSayed/status/2115065692751872212' },
    'dl-pd': { fn: dlPd, label: 'Pixeldrain', need: 'a Pixeldrain file link', example: 'https://pixeldrain.com/u/8o4XMJhw' },
    'dl-tb': { fn: dlTb, label: 'Terabox', need: 'a Terabox share link', example: null },
    'dl-fb': { fn: dlFb, label: 'Facebook', need: 'a public Facebook video/reel link', example: 'https://www.facebook.com/watch/?v=1160678223584230' },
    'dl-lk': { fn: dlLk, label: 'Likee', need: 'a Likee video link', example: null },
    'dl-gf': { fn: dlGf, label: 'Gofile', need: 'a Gofile share link', example: 'https://gofile.io/d/sbHH5OKM' },
    'dl-wt': { fn: dlWt, label: 'WeTransfer', need: 'a WeTransfer link (we.tl or wetransfer.com/downloads)', example: null },
}

// Busy lock per user, with a 10-minute expiry so a hung job can never
// lock someone out forever.
const busyUsers = new Map()
const BUSY_MS = 10 * 60 * 1000
function isBusy(sender) {
    const t = busyUsers.get(sender)
    if (!t) return false
    if (Date.now() - t > BUSY_MS) { busyUsers.delete(sender); return false }
    return true
}

let handler = async (m, { conn, text, usedPrefix, command, isOwner }) => {
    const cmd = String(command || '').toLowerCase()
    if (cmd === 'dl') {
        const lines = Object.entries(SOURCES).map(([c, s]) =>
            `• ${usedPrefix}${c} <link> — ${s.label}\n   ↳ ` + (s.example ? `try it: ${usedPrefix}${c} ${s.example}` : `send any ${s.label} link`)).join('\n')
        const names = Object.values(SOURCES).map(s => s.label)
        const nameList = names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
        return conn.reply(m.chat,
            `📥 *Silana DL Pack* v6.2\n` +
            `With these commands you can download from ${names.length} platforms: ${nameList}.\n\n` +
            `Every command below has a working example — copy it to test the feature yourself:\n\n` +
            lines + `\n\nMax file size: 95 MB.`, m)
    }
    const src = SOURCES[cmd]
    if (!src) return
    const url = String(text || '').trim().split(/\s+/)[0] || (m.quoted?.text ? String(m.quoted.text).match(/https?:\/\/\S+/)?.[0] : '')
    if (!url || !/^https?:\/\//i.test(url)) {
        return conn.reply(m.chat, `📥 Usage: ${usedPrefix + cmd} <link>\nSend ${src.need}.` + (src.example ? `\nWorking example — try it: ${usedPrefix + cmd} ${src.example}` : ''), m)
    }
    if (isBusy(m.sender)) return conn.reply(m.chat, '⏳ A download is already running for you — wait for it to finish.', m)
    busyUsers.set(m.sender, Date.now())
    ensureTmp()
    let before = new Set()
    try { before = new Set(fs.readdirSync(TMPDIR)) } catch {}
    try {
        await conn.reply(m.chat, `📥 Downloading from ${src.label}…`, m)
        await src.fn(conn, m, url)
    } catch (e) {
        console.error('[dlpack]', cmd, e)
        const raw = String(e?.message || e)
        let friendly = '❌ Download failed. Check the link is public and try again.'
        if (raw.includes('bad-link')) friendly = '❌ That does not look like a ' + src.label + ' link.'
        else if (raw.includes('too large')) friendly = '❌ ' + raw.replace(/^.*?(file too large)/, 'That $1') + '.'
        else if (raw.includes('reddit-json')) friendly = '❌ Reddit refused this server\'s request for the post page (IP block). Tip: v.redd.it links always work — open the video in Reddit and copy its v.redd.it link.'
        else if (raw.includes('gdrive:')) friendly = '❌ ' + raw + ' Make sure the file is shared as "Anyone with the link".'
        else if (raw.includes('telegram:')) friendly = '❌ ' + raw
        else if (raw.includes('soundcloud:')) friendly = '❌ ' + raw
        else if (/^(vimeo|twitch|streamable|kwai|rumble|pinterest|mediafire|streamtape|x|pixeldrain|terabox|facebook|likee|gofile|wetransfer):/.test(raw)) friendly = '❌ ' + raw
        return conn.reply(m.chat, friendly + (isOwner ? `\n🔧 Owner details: ${raw.slice(0, 180)}` : ''), m)
    } finally {
        busyUsers.delete(m.sender)
        // Clean only the temp files this job created
        try { for (const f of fs.readdirSync(TMPDIR)) if (!before.has(f)) fs.unlinkSync(path.join(TMPDIR, f)) } catch {}
    }
}

handler.help = ['dl', 'dl-reddit', 'dl-sc', 'dl-gdrive', 'dl-tg', 'dl-vimeo', 'dl-twitch', 'dl-streamable', 'dl-kwai', 'dl-rumble', 'dl-pin', 'dl-mf', 'dl-st', 'dl-x', 'dl-pd', 'dl-tb', 'dl-fb', 'dl-lk', 'dl-gf', 'dl-wt']
handler.tags = ['downloader']
handler.command = /^(dl|dl-reddit|dl-sc|dl-gdrive|dl-tg|dl-vimeo|dl-twitch|dl-streamable|dl-kwai|dl-rumble|dl-pin|dl-mf|dl-st|dl-x|dl-pd|dl-tb|dl-fb|dl-lk|dl-gf|dl-wt)$/i
handler.limit = false

export default handler
