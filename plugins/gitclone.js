// plugins/github.js — GitHub repository downloader
//
// .github <repo link | owner/repo> [branch]
// Sends a repo info card (description, stars, forks, language, size), then
// downloads the repository as a ZIP of the chosen branch (codeload) and
// sends it as a document. Public repos only — private repos need a token,
// which this plugin does not handle. Cap 95 MB, enforced while streaming.
import fs from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const CAP = 95 * 1024 * 1024
const UA = { 'User-Agent': 'SilanaBot', Accept: 'application/vnd.github+json' }
const busy = new Map() // chat -> expiry timestamp

function ensureTmp() {
    const d = path.join(process.cwd(), 'tmp', 'githubdl')
    fs.mkdirSync(d, { recursive: true })
    return d
}

// Accepts: https://github.com/owner/repo[/tree/branch][.git] or owner/repo
function parseRepo(raw) {
    const s = String(raw || '').trim()
    if (!s) return null
    let owner = '', repo = '', branch = ''
    const url = s.match(/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/tree\/([^\s]+))?(?:\/[^\s]*)?$/i)
    if (url) { owner = url[1]; repo = url[2]; branch = url[3] || '' }
    else {
        const short = s.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/)
        if (!short) return null
        owner = short[1]; repo = short[2].replace(/\.git$/i, '')
    }
    if (!owner || !repo || owner === 'orgs' || repo.includes('..')) return null
    return { owner, repo, branch: branch.replace(/\/$/, '') }
}

async function fetchJSON(url) {
    const res = await fetch(url, { headers: UA })
    if (res.status === 404) return { notFound: true }
    if (!res.ok) throw new Error('GitHub API HTTP ' + res.status)
    return { data: await res.json() }
}

async function downloadZip(url, file) {
    const res = await fetch(url, { headers: { 'User-Agent': 'SilanaBot' }, redirect: 'follow' })
    if (!res.ok || !res.body) throw new Error('download HTTP ' + res.status)
    let bytes = 0
    const counter = new Transform({
        transform(chunk, enc, cb) {
            bytes += chunk.length
            if (bytes > CAP) return cb(new Error('TOO_LARGE'))
            cb(null, chunk)
        }
    })
    await pipeline(Readable.fromWeb(res.body), counter, fs.createWriteStream(file))
    return bytes
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
    const chat = m.chat
    const exp = busy.get(chat)
    if (exp && exp > Date.now()) return m.reply('⏳ A GitHub download is already running in this chat — wait for it to finish.')
    const parsed = parseRepo((text || '').trim().split(/\s+/)[0])
    const argBranch = (text || '').trim().split(/\s+/)[1] || ''
    if (!parsed) {
        return m.reply(
            `🐙 *GitHub Repo Downloader*\n\n` +
            `Download any public repository as a ZIP file.\n\n` +
            `Usage: ${usedPrefix + command} <link or owner/repo> [branch]\n` +
            `Example: ${usedPrefix + command} noureddineouafy/silana-v2\n` +
            `Example: ${usedPrefix + command} https://github.com/owner/repo/tree/dev`
        )
    }
    busy.set(chat, Date.now() + 10 * 60 * 1000)
    const file = path.join(ensureTmp(), `${parsed.repo}-${Date.now()}.zip`)
    try {
        // Repo info (best effort — the download proceeds even if this fails).
        let info = null
        try {
            const r = await fetchJSON(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`)
            if (r.notFound) return m.reply(`❌ Repository not found: *${parsed.owner}/${parsed.repo}*\nIt may be private (private repos are not supported) or the name is wrong.`)
            info = r.data
        } catch {}

        const branch = argBranch || parsed.branch || info?.default_branch || 'main'

        if (info) {
            const sizeMB = info.size ? (info.size / 1024).toFixed(1) : '?'
            await m.reply(
                `🐙 *${info.full_name}*\n` +
                (info.description ? `${info.description}\n` : '') +
                `⭐ ${info.stargazers_count}   🍴 ${info.forks_count}   💻 ${info.language || '-'}\n` +
                `🌿 Branch: ${branch}   📦 Repo size: ~${sizeMB} MB\n` +
                `⏳ Downloading the ZIP…`
            )
        } else {
            await m.reply(`🐙 *${parsed.owner}/${parsed.repo}* — 🌿 ${branch}\n⏳ Downloading the ZIP…`)
        }

        const zipUrl = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/refs/heads/${encodeURIComponent(branch)}`
        let bytes
        try {
            bytes = await downloadZip(zipUrl, file)
        } catch (e) {
            if (String(e?.message) === 'TOO_LARGE') return m.reply(`❌ The ZIP passes the 95 MB cap — this repo is too big to send on WhatsApp.`)
            if (branch !== 'master' && /HTTP 404/.test(String(e?.message))) {
                // One retry on the classic default name.
                bytes = await downloadZip(`https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/refs/heads/master`, file).catch(() => { throw e })
            } else throw e
        }
        if (!bytes || bytes < 100) throw new Error('empty download')

        await conn.sendMessage(chat, {
            document: fs.readFileSync(file),
            mimetype: 'application/zip',
            fileName: `${parsed.repo}-${branch}.zip`,
            caption: `🐙 *${parsed.owner}/${parsed.repo}* — branch \`${branch}\` (${(bytes / 1024 / 1024).toFixed(2)} MB)\n${info?.html_url || `https://github.com/${parsed.owner}/${parsed.repo}`}`
        }, { quoted: m })
    } catch (e) {
        const msg = String(e?.message || e)
        if (/HTTP 404/.test(msg)) return m.reply(`❌ Could not download *${parsed.owner}/${parsed.repo}* — repo or branch not found. Check the name and the branch.`)
        return m.reply(`❌ GitHub download failed.\n🔧 ${msg.slice(0, 200)}`)
    } finally {
        busy.delete(chat)
        try { fs.rmSync(file, { force: true }) } catch {}
    }
}

handler.help = ['gitclone']
handler.tags = ['downloader']
handler.command = ['gitclone', 'ghrepo']
export default handler
