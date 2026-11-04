// plugins/fixkeys.js — Encryption-key doctor for "Waiting for this message" (owner only) — fixkeys v7
//
// v5 — ALL GROUPS, ALL SOCKETS, FULLY AUTOMATIC
//   Everything in v4, and the periodic sweep now covers EVERY group of the
//   main bot AND of every online SerBot sub-bot, with a first sweep ~2
//   minutes after load (then every 12h) — nothing for the owner to run.
// v4 — THE ROOT, ZERO-RESTART EDITION
//   Everything in v3, plus PERIODIC SELF-MAINTENANCE: every 12 hours the
//   plugin wipes the sender-key distribution memory of every group the bot
//   participates in, so the next message in each group re-distributes the
//   key to every current device — even for members whose breakage is silent
//   (no membership change, no retry request, e.g. many iOS phones). No
//   command, no restart, no owner action. `.fixkeys sweep` runs it now;
//   `.fixkeys auto on|off` toggles it (default ON).
//   INSTALL WITHOUT RESTART: this base watches the plugins folder
//   (fs.watch(pluginFolder, global.reload) in main.js) and re-imports a
//   changed plugin live, socket untouched — just replace the file.
//   The ONLY restart this problem ever needed was the one-time main.js
//   getMessage line (socket options are read once at socket creation);
//   every healing action itself acts live through conn.authState.keys,
//   which Baileys re-reads on every single group send.
//
// WHAT WAS WRONG (why v1/v2 alone could not finish the job)
//   1) WhatsApp heals a stuck message by itself: the member's phone sends a
//      RETRY request and the bot is supposed to resend the original message.
//      Baileys only resends if the socket was created with a `getMessage`
//      function that can return past messages — Silana's main.js does NOT
//      define one (verified in the base: connectionOptions ends at
//      maxMsgRetryCount / cachedGroupMetadata), and no plugin ever stored the
//      outgoing messages. Every retry request therefore died with "message
//      not available" and the member stayed stuck forever.
//      → v3 stores every outgoing message (wrapping conn.sendMessage /
//        conn.relayMessage, the same patching style BotShield already uses
//        in this base) and exposes it as globalThis.__getStoredMessage.
//        ONE line in main.js (see the patch file delivered with this plugin)
//        connects Baileys' retry path to that store. After that, stuck
//        messages heal THEMSELVES the next time the member's phone asks.
//   2) Baileys never rotates the group sender key when membership changes
//      (upstream WhiskeySockets/Baileys #2704 / #2730): a member who leaves,
//      rejoins, changes number or SWITCHES PHONES keeps being skipped by the
//      sender-key distribution, because the stored distribution memory still
//      marks their device as "already has the key" — so their new phone
//      shows "Waiting for this message" on every new group message, forever.
//      → v3 listens to group-participants.update and wipes the group's
//        distribution memory on add / remove / leave / modify, so the next
//        group message distributes a fresh key to exactly the current
//        devices. (Upstream leaves 'add' out; we include it on purpose — a
//        rejoining phone may have purged the old key, and one redistribution
//        is cheap insurance in a bot group.)
//
// COMMANDS (owner only)
//   .fixkeys                inside a group: reset the whole group (v1/v2 behaviour)
//   .fixkeys <groupJid>     reset a group from anywhere
//   .fixkeys <phone>        reset ONE member (or reply to their message with .fixkeys)
//   .fixkeys all            inside a group: group reset + at-risk member report
//   .fixkeys check          diagnostics (Baileys version, addressing mode,
//                           LID-only participants, stored-message count…)
//
// Old stuck messages stay stuck UNLESS the getMessage line is installed —
// with it, they resend automatically on the member phone's retry request.
// Other members' records are never touched. Credentials are never touched.
// Sub-bot (SerBot) sessions live in their own folders and are never touched.

import fs from 'node:fs'
import path from 'node:path'

const VERSION = 'fixkeys v7'
const digits = (s) => String(s || '').replace(/[^0-9]/g, '')

// ---------------------------------------------------------------------------
// Outgoing-message store — feeds WhatsApp's retry-resend protocol.
// ---------------------------------------------------------------------------
if (!globalThis.__msgStore) globalThis.__msgStore = new Map()
const msgStore = globalThis.__msgStore
const STORE_MAX_KEYS = 600 // ~300 messages × (jid|id + id) keys

function cacheSent(sent) {
    try {
        if (!sent || !sent.key || !sent.key.id || !sent.message) return
        const jid = sent.key.remoteJid || ''
        msgStore.set(jid + '|' + sent.key.id, sent.message)
        msgStore.set(sent.key.id, sent.message)
        while (msgStore.size > STORE_MAX_KEYS) {
            const oldest = msgStore.keys().next().value
            if (oldest === undefined) break
            msgStore.delete(oldest)
        }
    } catch {}
}

// Read by the one-line getMessage patch in main.js. Baileys calls
// getMessage({ remoteJid, id, ... }) when a recipient asks for a resend.
globalThis.__getStoredMessage = async (key) => {
    try {
        if (!key || !key.id) return undefined
        return msgStore.get((key.remoteJid || '') + '|' + key.id) || msgStore.get(key.id)
    } catch { return undefined }
}

// ---------------------------------------------------------------------------
// Socket binding: wrap the send functions once per socket + auto-rotation.
// Sockets are recreated on reconnects, so binding is re-checked on a timer
// and on every incoming message (handler.before) — the welcomerules pattern.
// ---------------------------------------------------------------------------
let boundConn = null
function bindConn(conn) {
    try {
        if (!conn || boundConn === conn) return
        boundConn = conn

        if (!conn.__fixkeysStorePatched && typeof conn.sendMessage === 'function') {
            conn.__fixkeysStorePatched = true
            const origSend = conn.sendMessage.bind(conn)
            conn.sendMessage = async (jid, content, opts) => {
                const sent = await origSend(jid, content, opts)
                cacheSent(sent)
                return sent
            }
            if (typeof conn.relayMessage === 'function') {
                const origRelay = conn.relayMessage.bind(conn)
                conn.relayMessage = async (jid, msg, opts) => {
                    const out = await origRelay(jid, msg, opts)
                    cacheSent(out)
                    return out
                }
            }
        }

        // Session-churn watcher (v6): count every session record write per
        // peer, so `.fixkeys check` can NAME the peer whose session is being
        // rebuilt in a loop (the console "Closing session" flood) — this
        // works with any auth adapter, file-based or database-based alike.
        try {
            const ks = conn.authState && conn.authState.keys
            if (ks && typeof ks.set === 'function' && !conn.__fixkeysKeyWatch) {
                conn.__fixkeysKeyWatch = true
                const label = conn.isSerbot ? 'sub-' + (conn.serbotPhone || '?') : 'main'
                const origSet = ks.set.bind(ks)
                ks.set = async (data) => {
                    try {
                        if (!globalThis.__fixkeysKeyStats) globalThis.__fixkeysKeyStats = new Map()
                        const stats = globalThis.__fixkeysKeyStats
                        const now = Date.now()
                        for (const [cat, entries] of Object.entries(data || {})) {
                            if (cat !== 'session' || !entries) continue
                            for (const id of Object.keys(entries)) {
                                const k = label + '|' + id
                                let rec = stats.get(k)
                                if (Array.isArray(rec)) rec = { times: rec, conn: null, lastRepair: 0 }
                                if (!rec) { rec = { times: [], conn: null, lastRepair: 0 }; }
                                rec.conn = conn
                                rec.times.push(now)
                                if (rec.times.length > 300) rec.times.splice(0, rec.times.length - 300)
                                stats.set(k, rec)
                            }
                        }
                    } catch {}
                    return origSet(data)
                }
            }
        } catch {}

        if (!conn.__fixkeysAutoRotate && conn.ev && typeof conn.ev.on === 'function') {
            conn.__fixkeysAutoRotate = true
            conn.ev.on('group-participants.update', async (upd) => {
                try {
                    const gid = upd && upd.id
                    const action = upd && upd.action
                    if (!gid || !String(gid).endsWith('@g.us')) return
                    if (['add', 'remove', 'leave', 'modify'].indexOf(action) < 0) return
                    const keys = conn.authState && conn.authState.keys
                    if (keys && typeof keys.set === 'function') {
                        await keys.set({ 'sender-key-memory': { [gid]: null } })
                    }
                } catch {}
            })
        }
    } catch {}
}
bindConn(globalThis.conn)
if (!globalThis.__fixkeysBindTimer) {
    globalThis.__fixkeysBindTimer = setInterval(() => bindConn(globalThis.conn), 4000)
}

// ---------------------------------------------------------------------------
// Periodic self-maintenance (v5): rotate the distribution memory of EVERY
// group of EVERY socket — the main bot AND every online SerBot sub-bot —
// on a timer, so silent breakages heal on their own in all groups at once.
// The first sweep runs ~2 minutes after load; then every 12 hours. Groups
// the main bot chats in are remembered as a fallback when the participating
// list is unavailable. The timer replaces any older version's timer across
// hot-reloads (the base re-imports changed plugins live, without restart),
// and its callback always goes through globalThis.__fixkeysSweepNow so the
// newest loaded version is the one that runs.
// ---------------------------------------------------------------------------
if (!globalThis.__fixkeysSeenGroups) globalThis.__fixkeysSeenGroups = new Set()
const SWEEP_MS = 12 * 3600 * 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function rotateConnGroups(conn, fallbackGroups) {
    const keys = conn && conn.authState && conn.authState.keys
    if (!conn || !keys || typeof keys.set !== 'function') return 0
    let groups = []
    try {
        if (typeof conn.groupFetchAllParticipating === 'function') {
            const all = await conn.groupFetchAllParticipating()
            groups = Object.keys(all || {}).filter((g) => String(g).endsWith('@g.us'))
        }
    } catch {}
    if (!groups.length && fallbackGroups) groups = [...fallbackGroups]
    let done = 0
    for (const gid of groups.slice(0, 50)) {
        try {
            await keys.set({ 'sender-key-memory': { [gid]: null } })
            done++
            await sleep(1200)
        } catch {}
    }
    return done
}

async function sweepOnce(force) {
    try {
        if (!force && globalThis.__fixkeysAuto === false) return 0
        let total = await rotateConnGroups(globalThis.conn, globalThis.__fixkeysSeenGroups)
        try {
            const subs = globalThis.__serbots ? [...globalThis.__serbots.values()] : []
            for (const entry of subs) {
                if (!entry || !entry.sock || !entry.wasOpen) continue
                total += await rotateConnGroups(entry.sock, null)
            }
        } catch {}
        if (total) globalThis.__fixkeysLastSweep = Date.now()
        return total
    } catch { return 0 }
}
globalThis.__fixkeysSweepNow = sweepOnce
if (globalThis.__fixkeysSweepVersion !== 7) {
    try { if (globalThis.__fixkeysSweepTimer) clearInterval(globalThis.__fixkeysSweepTimer) } catch {}
    globalThis.__fixkeysSweepVersion = 7
    globalThis.__fixkeysSweepTimer = setInterval(() => { if (globalThis.__fixkeysSweepNow) globalThis.__fixkeysSweepNow(false) }, SWEEP_MS)
    if (!globalThis.__fixkeysInitialSweep7) {
        globalThis.__fixkeysInitialSweep7 = true
        setTimeout(() => { if (globalThis.__fixkeysSweepNow) globalThis.__fixkeysSweepNow(false) }, 2 * 60 * 1000)
    }
}

// ---------------------------------------------------------------------------
// Auto-repair (v7): when ONE peer's session is rebuilt over and over (the
// console "Closing session" flood), wipe that session record automatically
// so it rebuilds ONCE, clean — for every member, on every socket, with no
// owner command. Guards: >=12 rebuilds within 3 minutes, at most one repair
// per peer per 30 minutes, at most 20 repairs per hour overall, and a
// healthy mass-rebuild wave (each peer rebuilding once or twice) never
// reaches the threshold.
// ---------------------------------------------------------------------------
async function churnScan() {
    try {
        if (globalThis.__fixkeysAutoRepair === false) return 0
        const stats = globalThis.__fixkeysKeyStats
        if (!stats) return 0
        if (!globalThis.__fixkeysAutoRepairs) globalThis.__fixkeysAutoRepairs = []
        const reps = globalThis.__fixkeysAutoRepairs
        const now = Date.now()
        const hourAgo = now - 3600 * 1000
        while (reps.length && reps[0].at < now - 24 * 3600 * 1000) reps.shift()
        if (reps.filter((r) => r.at >= hourAgo).length >= 20) return 0
        let repaired = 0
        for (const [k, rec0] of stats.entries()) {
            const rec = Array.isArray(rec0) ? { times: rec0, conn: null, lastRepair: 0 } : rec0
            if (!rec || !rec.conn) continue
            const recent = rec.times.filter((t) => t >= now - 3 * 60 * 1000).length
            if (recent < 12) continue
            if (now - (rec.lastRepair || 0) < 30 * 60 * 1000) continue
            const keys = rec.conn.authState && rec.conn.authState.keys
            if (!keys || typeof keys.set !== 'function') continue
            const id = k.split('|').slice(1).join('|')
            try {
                await keys.set({ session: { [id]: null } })
                rec.times = []
                rec.lastRepair = now
                stats.set(k, rec)
                reps.push({ k, at: now })
                repaired++
                try { console.log('[fixkeys] auto-repaired looping session:', k) } catch {}
            } catch {}
            if (reps.filter((r) => r.at >= hourAgo).length >= 20) break
        }
        return repaired
    } catch { return 0 }
}
globalThis.__fixkeysChurnScan = churnScan
if (globalThis.__fixkeysChurnVersion !== 7) {
    try { if (globalThis.__fixkeysChurnTimer) clearInterval(globalThis.__fixkeysChurnTimer) } catch {}
    globalThis.__fixkeysChurnVersion = 7
    globalThis.__fixkeysChurnTimer = setInterval(() => { if (globalThis.__fixkeysChurnScan) globalThis.__fixkeysChurnScan() }, 20000)
}

// ---------------------------------------------------------------------------
// Helpers carried over from v2 (verified live): auth files + key resets.
// ---------------------------------------------------------------------------
function findAuthDir() {
    return ['sessions', 'session', 'auth'].map((d) => path.join(process.cwd(), d)).find((d) => fs.existsSync(d)) || ''
}
function listAuthFiles(dir) {
    try { return dir ? fs.readdirSync(dir) : [] } catch { return [] }
}
function ownNumbers(conn) {
    const nums = new Set()
    const idPart = String(conn?.user?.id || '').split('@')[0].split(':')[0]
    const lidPart = String(conn?.user?.lid || '').split('@')[0].split(':')[0]
    if (digits(idPart)) nums.add(digits(idPart))
    if (digits(lidPart)) nums.add(digits(lidPart))
    return nums
}

async function wipeGroupMemory(keys, groupJid, steps) {
    try {
        await keys.set({ 'sender-key-memory': { [groupJid]: null } })
        steps.push('✔ Group distribution memory cleared — every member gets the key again')
        return true
    } catch {
        steps.push('✖ Could not clear the group distribution memory')
        return false
    }
}

async function deleteOwnSenderKey(keys, conn, groupJid, files, steps) {
    let done = false
    try {
        const mine = ownNumbers(conn)
        const prefix = 'sender-key-' + groupJid.replace(/:/g, '-')
        for (const f of files) {
            if (!f.startsWith(prefix) || !f.endsWith('.json')) continue
            const inner = f.slice('sender-key-'.length, -'.json'.length)
            const sep = inner.indexOf('--')
            if (sep < 0) continue
            const senderNum = digits(inner.slice(sep + 2).split('.')[0])
            if (!mine.has(senderNum)) continue // another member's record — never touch it
            const keyId = inner.slice(0, sep) + '::' + inner.slice(sep + 2)
            await keys.set({ 'sender-key': { [keyId]: null } })
            done = true
        }
    } catch {}
    steps.push(done ? '✔ Old sender key deleted — a brand-new key will be generated' : '• Sender key record not found by name (the memory wipe alone usually suffices)')
    return done
}

async function sendRefresh(conn, groupJid, steps) {
    try {
        await conn.sendMessage(groupJid, { text: '🔑 *Encryption keys refreshed*\nIf my messages were showing as "Waiting for this message", they should arrive normally from now on.' })
        steps.push('✔ Refresh message sent — fresh keys distributed')
        return true
    } catch {
        steps.push('✖ Could not send the refresh message into the group')
        return false
    }
}

function baileysVersion() {
    const candidates = [
        path.join(process.cwd(), 'node_modules', 'baileys', 'package.json'),
        path.join(process.cwd(), 'node_modules', '@whiskeysockets', 'baileys', 'package.json'),
    ]
    for (const p of candidates) {
        try {
            const pkg = JSON.parse(fs.readFileSync(p, 'utf8'))
            if (pkg && pkg.version) return pkg.version + ' (' + (pkg.name || '?') + ')'
        } catch {}
    }
    return 'unknown'
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
let handler = async (m, { conn, text, isOwner, usedPrefix, command }) => {
    if (!isOwner) return m.reply('⛔ This command is owner-only.')
    bindConn(conn)

    const keys = conn?.authState?.keys
    if (!keys?.set) {
        return m.reply('❌ The key store is not reachable from here. Use the panel method instead: stop the bot, delete the group\'s sender-key files in sessions/, start again.')
    }

    const raw = (text || '').trim()
    const first = (raw.split(/\s+/)[0] || '').toLowerCase()
    const argJid = raw.split(/\s+/).find((w) => w.includes('@g.us')) || ''
    const argNum = digits(raw.split(/\s+/).find((w) => digits(w).length >= 9) || '')
    const quotedNum = m.quoted?.sender ? digits(String(m.quoted.sender).split('@')[0].split(':')[0]) : ''
    const groupJid = argJid || (m.chat?.endsWith('@g.us') ? m.chat : '')
    const memberNum = argNum || quotedNum

    // ---------- AUTO / SWEEP MODES ----------
    if (first === 'auto') {
        const arg = (raw.split(/\s+/)[1] || '').toLowerCase()
        if (arg === 'off') globalThis.__fixkeysAuto = false
        else if (arg === 'on') globalThis.__fixkeysAuto = true
        return m.reply(`🤖 *Periodic key maintenance:* ${globalThis.__fixkeysAuto === false ? 'OFF' : 'ON'} — every 12h all group keys rotate by themselves, no restart, no command.\nUsage: ${usedPrefix + command} auto on|off`)
    }
    if (first === 'repair') {
        const arg = (raw.split(/\s+/)[1] || '').toLowerCase()
        if (arg === 'off') globalThis.__fixkeysAutoRepair = false
        else if (arg === 'on') globalThis.__fixkeysAutoRepair = true
        return m.reply(`🛠️ *Auto-repair of broken sessions:* ${globalThis.__fixkeysAutoRepair === false ? 'OFF' : 'ON'} — when any member's session starts looping, the bot wipes and rebuilds it by itself (max once per 30 min per member). Usage: ${usedPrefix + command} repair on|off`)
    }
    if (first === 'sweep') {
        const done = await sweepOnce(true)
        return m.reply(done ? `🧹 *Key sweep done* — distribution memory rotated for ${done} group(s) across the main bot + online sub-bots. The next message in each group re-distributes the key to every current device.` : '🧹 *Key sweep:* no groups could be rotated right now (no participating list and no group seen yet).')
    }

    // ---------- CHECK MODE ----------
    if (first === 'check') {
        const lines = [`🩺 *Encryption diagnostics — ${VERSION}*`]
        lines.push(`• Baileys: ${baileysVersion()}`)
        const meId = String(conn?.user?.id || '').split('@')[0]
        const meLid = String(conn?.user?.lid || '').split('@')[0]
        lines.push(`• Bot identity: ${meId || '?'}${meLid ? ' / LID ' + meLid : ''}`)
        lines.push(`• Stored outgoing messages (for retry resend): ${Math.floor(msgStore.size / 2)}`)
        lines.push(`• Auto key-rotation on membership change: ${conn.__fixkeysAutoRotate ? 'ON ✔' : 'not bound ✖'}`)
        lines.push(`• Periodic maintenance (12h sweep): ${globalThis.__fixkeysAuto === false ? 'OFF' : 'ON'}${globalThis.__fixkeysLastSweep ? ' — last sweep ' + new Date(globalThis.__fixkeysLastSweep).toLocaleString() : ' — no sweep yet'}`)
        lines.push(`• Send-store patch on this socket: ${conn.__fixkeysStorePatched ? 'ON ✔' : 'not bound ✖'}`)
        let cover = null
        try {
            if (typeof conn.groupFetchAllParticipating === 'function') {
                const allG = await conn.groupFetchAllParticipating()
                cover = Object.keys(allG || {}).filter((g) => String(g).endsWith('@g.us')).length
            }
        } catch {}
        let subsOnline = 0
        try { subsOnline = globalThis.__serbots ? [...globalThis.__serbots.values()].filter((e) => e && e.sock && e.wasOpen).length : 0 } catch {}
        if (cover !== null) lines.push(`• Coverage: main bot is in ${cover} group(s), online sub-bots: ${subsOnline} — the automatic sweep rotates ALL of them`)
        try {
            const stats = globalThis.__fixkeysKeyStats
            let hot = null
            if (stats) {
                const cutoff = Date.now() - 5 * 60 * 1000
                for (const [k, rec] of stats.entries()) {
                    const times = Array.isArray(rec) ? rec : (rec && rec.times) || []
                    const recent = times.filter((t) => t >= cutoff).length
                    if (recent && (!hot || recent > hot.n)) hot = { k, n: recent }
                }
            }
            lines.push(hot ? `• Session churn (last 5 min): hottest ${hot.k} — ${hot.n} rebuild(s)${hot.n >= 10 ? ' ⚠️ flood peer — auto-repair handles it on its own' : ''}` : '• Session churn (last 5 min): quiet — no session rebuilds')
            try {
                const reps = (globalThis.__fixkeysAutoRepairs || []).filter((r) => Date.now() - r.at < 24 * 3600 * 1000)
                const last = reps[reps.length - 1]
                lines.push(`• Auto-repair of broken sessions: ${globalThis.__fixkeysAutoRepair === false ? 'OFF' : 'ON'} — ${reps.length} repair(s) in 24h${last ? ', last: ' + last.k + ' at ' + new Date(last.at).toLocaleTimeString() : ''}`)
            } catch {}
        } catch {}
        if (groupJid) {
            try {
                const mem = await keys.get('sender-key-memory', [groupJid])
                const entry = mem && mem[groupJid]
                const devCount = entry ? Object.keys(entry).length : 0
                lines.push(`• This group: sender key already distributed to ${devCount} device(s)`)
            } catch { lines.push('• This group: could not read the distribution memory') }
            const files = listAuthFiles(findAuthDir())
            const prefix = 'sender-key-' + groupJid.replace(/:/g, '-')
            const skFiles = files.filter((f) => f.startsWith(prefix)).length
            lines.push(`• Sender-key files on disk for this group: ${skFiles}`)
            try {
                const meta = await conn.groupMetadata(groupJid)
                const parts = (meta && meta.participants) || []
                const lidOnly = parts.filter((p) => String(p.id || '').endsWith('@lid')).length
                lines.push(`• Participants: ${parts.length}${meta?.addressingMode ? ' — addressing mode: ' + meta.addressingMode : ''}${lidOnly ? ' — ' + lidOnly + ' addressed by LID' : ''}`)
            } catch { lines.push('• Participants: could not read group metadata') }
        } else {
            lines.push('• Run `.fixkeys check` inside a group for group details.')
        }
        lines.push('\nReminder: automatic resend of stuck messages needs the one-line getMessage patch in main.js (delivered with this plugin). Without it, only NEW messages benefit from a reset.')
        return m.reply(lines.join('\n'))
    }

    // ---------- MEMBER MODE ----------
    if (memberNum && first !== 'all') {
        const steps = [`🎯 *Member key reset:* +${memberNum} — ${VERSION}`]
        const authDir = findAuthDir()
        const files = listAuthFiles(authDir)

        const targets = new Set([memberNum])
        if (groupJid) {
            try {
                const meta = await conn.groupMetadata(groupJid)
                for (const p of meta?.participants || []) {
                    const ids = [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).map((x) => digits(String(x).split('@')[0].split(':')[0]))
                    if (ids.includes(memberNum)) ids.forEach((x) => { if (x) targets.add(x) })
                }
            } catch {}
        }

        let wiped = 0
        for (const f of files) {
            if (!f.startsWith('session-') || !f.endsWith('.json')) continue
            const inner = f.slice('session-'.length, -'.json'.length)
            if (!targets.has(digits(inner.split('.')[0]))) continue
            try { await keys.set({ session: { [inner]: null } }); wiped++ } catch {}
        }
        steps.push(wiped ? `✔ Deleted ${wiped} broken session record(s) for this member` : '• No stored session records found for this member (a fresh one will be built anyway)')

        let dm = false
        try {
            await conn.sendMessage(memberNum + '@s.whatsapp.net', { text: '🔑 *Key refresh*\nThe bot reset its encryption session with your number. Group messages should display normally now — please check the group.' })
            dm = true
        } catch {}
        steps.push(dm ? '✔ DM sent to the member — clean session rebuilt' : '✖ Could not DM the member (they may have blocked the bot, or the number is not on WhatsApp)')

        if (groupJid) {
            await wipeGroupMemory(keys, groupJid, steps)
            await sendRefresh(conn, groupJid, steps)
        } else {
            steps.push('• No group context: run plain `.fixkeys` inside the group afterwards to push the group key through the new session')
        }
        steps.push('\nAsk the member to check the NEWEST bot message in the group. With the main.js getMessage patch installed, old stuck messages also resend on their own when their phone asks again.')
        return m.reply(steps.join('\n'))
    }

    // ---------- GROUP MODE / ALL MODE ----------
    if (!groupJid) {
        return m.reply(
            `⚠️ Usage — ${VERSION}:\n` +
            `• ${usedPrefix + command} — inside a group: reset the whole group\n` +
            `• ${usedPrefix + command} <phone> — reset ONE member (or reply to their message with ${usedPrefix + command})\n` +
            `• ${usedPrefix + command} all — inside a group: reset + report members at risk\n` +
            `• ${usedPrefix + command} sweep — rotate the keys of ALL groups now (no restart)\n` +
            `• ${usedPrefix + command} auto on|off — the 12h self-maintenance (default on)\n` +
            `• ${usedPrefix + command} repair on|off — auto-repair of looping member sessions (default on)\n` +
            `• ${usedPrefix + command} check — diagnostics\n` +
            `• ${usedPrefix + command} <groupJid> — reset a group from anywhere`
        )
    }
    const steps = [`🔑 *Key reset done for this group* — ${VERSION}`]
    await wipeGroupMemory(keys, groupJid, steps)
    await deleteOwnSenderKey(keys, conn, groupJid, listAuthFiles(findAuthDir()), steps)
    await sendRefresh(conn, groupJid, steps)

    if (first === 'all') {
        try {
            const meta = await conn.groupMetadata(groupJid)
            const parts = (meta && meta.participants) || []
            const lidOnly = parts.filter((p) => String(p.id || '').endsWith('@lid'))
            steps.push(`• Participants: ${parts.length}${lidOnly.length ? ` — ${lidOnly.length} are addressed by LID (privacy mode). If any of them still cannot read new messages, fix them one by one with \`.fixkeys <number>\` or by replying to their message.` : ''}`)
        } catch {}
        steps.push('• From now on, this group\'s key rotates automatically whenever a member joins, leaves or changes number — no command needed.')
    } else {
        steps.push('\nMembers who still cannot read NEW messages have a broken personal session — fix them one by one: reply to their message with `.fixkeys`, or run `.fixkeys <their number>` here.')
    }
    return m.reply(steps.join('\n'))
}

handler.before = async function (m, { conn }) {
    try {
        bindConn(conn || globalThis.conn)
        if (m && m.chat && String(m.chat).endsWith('@g.us')) globalThis.__fixkeysSeenGroups.add(m.chat)
    } catch {}
}

handler.help = ['fixkeys']
handler.tags = ['owner']
handler.command = ['fixkeys']
export default handler
