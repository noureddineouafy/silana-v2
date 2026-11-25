// tempmail v3 — disposable email inbox inside WhatsApp.
// Providers with automatic failover: mail.tm (accounts), then Guerrilla Mail (session API).
// v3 vs v2: maildrop REMOVED (its API answered but Gmail mail never arrived in the owner's live
// test — silent drop); Guerrilla Mail added (live-probed: address issue + inbox list verified).

const TM = 'https://api.mail.tm'
const GM = 'https://www.guerrillamail.com/ajax.php'

const sessions = new Map()
const tokens = new Map()
const lastInbox = new Map()
const lastNew = new Map()

function store() {
  if (!global.db || !global.db.data) return null
  if (!global.db.data.settings) global.db.data.settings = {}
  const s = global.db.data.settings
  if (!s.tempmail || typeof s.tempmail !== 'object') s.tempmail = {}
  if (!s.tempmail.users || typeof s.tempmail.users !== 'object') s.tempmail.users = {}
  return s.tempmail
}
function myAccount(sender) {
  const st = store()
  if (!st) return null
  const acc = st.users[sender]
  return acc && acc.address && acc.provider ? acc : null
}
function saveAccount(sender, acc) { const st = store(); if (st) st.users[sender] = acc }
function dropAccount(sender) { const st = store(); if (st) delete st.users[sender] }

function isOwnerUser(m, conn) {
  if (m.fromMe) return true
  try {
    const me = conn && conn.user && conn.user.id ? String(conn.user.id).split('@')[0].split(':')[0] : ''
    const sender = String(m.sender || '').split('@')[0].split(':')[0]
    if (me && sender === me) return true
    const owners = []
    if (Array.isArray(global.owner)) for (const o of global.owner) owners.push(String(Array.isArray(o) ? o[0] : o).replace(/[^0-9]/g, ''))
    return owners.indexOf(sender.replace(/[^0-9]/g, '')) >= 0
  } catch (e) { return false }
}

const randStr = (n) => { const c = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s }
function stripHtml(html) {
  return String(html || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
}
function findCode(text) { const mm = String(text || '').match(/\b(\d{4,8})\b/); return mm ? mm[1] : '' }
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Casablanca', hour12: false }) } catch (e) { return String(iso || '') } }
function timedFetch(url, opts) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 25000)
  const o = opts || {}
  o.signal = ctl.signal
  return fetch(url, o).then((r) => { clearTimeout(t); return r }, (e) => { clearTimeout(t); throw e })
}

/* ---------------- mail.tm provider ---------------- */
async function tmApi(path, opts) {
  opts = opts || {}
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
  if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token
  const r = await timedFetch(TM + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
  const text = await r.text()
  let data = null
  try { data = JSON.parse(text) } catch (e) {}
  if (!r.ok) { const err = new Error('mail.tm HTTP ' + r.status); err.status = r.status; throw err }
  return data
}
async function tmCreate() {
  let lastErr = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const domains = await tmApi('/domains')
      const list = Array.isArray(domains) ? domains : (domains && domains['hydra:member']) || []
      const dom = list.find((d) => d.isActive && !d.isPrivate) || list[0]
      if (!dom) throw new Error('mail.tm: no domain')
      const address = 'silana' + randStr(8) + '@' + dom.domain
      const password = 'Tm' + randStr(12) + '9'
      const created = await tmApi('/accounts', { method: 'POST', body: { address: address, password: password } })
      return { provider: 'mailtm', address: address, password: password, id: (created && created.id) || '' }
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('mail.tm failed')
}
async function tmToken(acc) {
  const hit = tokens.get(acc.address)
  if (hit && Date.now() - hit.ts < 20 * 60 * 1000) return hit.token
  const data = await tmApi('/token', { method: 'POST', body: { address: acc.address, password: acc.password } })
  if (!data || !data.token) throw new Error('mail.tm login failed')
  tokens.set(acc.address, { token: data.token, ts: Date.now() })
  return data.token
}

/* ---------------- Guerrilla Mail provider ---------------- */
function readCookie(res) {
  try {
    if (res.headers && typeof res.headers.getSetCookie === 'function') {
      const arr = res.headers.getSetCookie()
      if (arr && arr.length) return String(arr[0]).split(';')[0]
    }
  } catch (e) {}
  try { const sc = res.headers && res.headers.get('set-cookie'); if (sc) return String(sc).split(';')[0] } catch (e) {}
  return ''
}
async function gmCall(params, cookie) {
  const qs = Object.keys(params).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&')
  const headers = { 'Accept': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  const r = await timedFetch(GM + '?' + qs, { headers: headers })
  if (!r.ok) { const err = new Error('guerrilla HTTP ' + r.status); err.status = r.status; throw err }
  const data = await r.json()
  return { data: data, cookie: readCookie(r) }
}
async function gmCreate() {
  const out = await gmCall({ f: 'get_email_address', lang: 'en' }, '')
  const d = out.data || {}
  if (!d.email_addr || !d.sid_token) throw new Error('guerrilla: bad response')
  if (!out.cookie) throw new Error('guerrilla: no session cookie')
  return { provider: 'guerrilla', address: d.email_addr, cookie: out.cookie, sid: d.sid_token }
}

/* ---------------- unified operations ---------------- */
async function createAccount() {
  try { return await tmCreate() } catch (e1) {
    try { return await gmCreate() } catch (e2) {
      throw new Error('mail.tm: ' + (e1 && e1.message ? e1.message : e1) + ' | guerrilla: ' + (e2 && e2.message ? e2.message : e2))
    }
  }
}
async function fetchInbox(acc) {
  if (acc.provider === 'guerrilla') {
    const out = await gmCall({ f: 'check_email', seq: 0, sid_token: acc.sid }, acc.cookie)
    const items = (out.data && out.data.list) || []
    return items.slice(0, 10).map((x) => ({
      id: String(x.mail_id),
      subject: x.mail_subject || '',
      from: x.mail_from || '?',
      seen: x.mail_read === 1 || x.mail_read === '1',
      when: x.mail_timestamp ? fmtDate(new Date(x.mail_timestamp * 1000).toISOString()) : String(x.mail_date || '')
    }))
  }
  const token = await tmToken(acc)
  const data = await tmApi('/messages?page=1', { token: token })
  const items = (Array.isArray(data) ? data : (data && data['hydra:member']) || []).slice(0, 10)
  return items.map((x) => ({ id: x.id, subject: x.subject || '', from: (x.from && x.from.address) || '?', seen: !!x.seen, when: fmtDate(x.createdAt) }))
}
async function fetchMessage(acc, id) {
  if (acc.provider === 'guerrilla') {
    const out = await gmCall({ f: 'fetch_email', email_id: id, sid_token: acc.sid }, acc.cookie)
    const msg = out.data || {}
    if (!msg.mail_body && !msg.mail_subject) throw new Error('message not found')
    return { subject: msg.mail_subject || '', from: msg.mail_from || '?', when: String(msg.mail_date || ''), body: stripHtml(msg.mail_body) }
  }
  const token = await tmToken(acc)
  const msg = await tmApi('/messages/' + id, { token: token })
  return { subject: msg.subject || '', from: (msg.from && msg.from.address) || '?', when: fmtDate(msg.createdAt), body: msg.text || stripHtml(Array.isArray(msg.html) ? msg.html.join('\n') : msg.html) }
}
const lifeNote = (acc) => acc && acc.provider === 'guerrilla' ? '\n⏳ هاد العنوان كيعيش ~ساعة وحدة (Guerrilla Mail).' : ''

let handler = async (m, { conn, args, usedPrefix, command }) => {
  const sender = m.sender
  const owner = isOwnerUser(m, conn)
  const sub = ((args && args[0]) || '').toLowerCase()
  const usage = '📧 *بريد مؤقت — tempmail*\n\n' + usedPrefix + command + ' — عنوانك (كيتصاوب إلا ما كانش)\n' + usedPrefix + command + ' new — عنوان جديد\n' + usedPrefix + command + ' inbox — الرسائل اللي وصلات\n' + usedPrefix + command + ' <رقم> — قرا رسالة من اللائحة\n' + usedPrefix + command + ' delete — مسح الحساب'

  const now = Date.now()
  if ((sub === 'inbox' || sub === 'الوارد') && lastInbox.get(sender) && now - lastInbox.get(sender) < 3000) return m.reply('⏳ صبر 3 ثواني بين كل تحديث للوارد.')
  if ((sub === 'new' || sub === 'جديد') && lastNew.get(sender) && now - lastNew.get(sender) < 10000) return m.reply('⏳ صبر شوية قبل ما تطلب عنوان جديد آخر.')

  try {
    if (sub === 'status' || sub === 'حالة') {
      if (!owner) return m.reply('🔒 Owner only.')
      const lines = ['🩺 *فحص خدمة البريد المؤقت:*', '']
      const t1 = Date.now()
      try { const d = await tmApi('/domains'); const l = Array.isArray(d) ? d : (d && d['hydra:member']) || []; lines.push('✅ mail.tm — جاوب في ' + (Date.now() - t1) + 'ms · دومينات: ' + l.map((x) => x.domain).join(', ')) } catch (e) { lines.push('❌ mail.tm — ' + (e && e.message ? e.message : e) + ' (' + (Date.now() - t1) + 'ms)') }
      const t2 = Date.now()
      try { const o = await gmCall({ f: 'get_email_address', lang: 'en' }, ''); lines.push('✅ guerrilla — جاوب في ' + (Date.now() - t2) + 'ms' + (o.data && o.data.email_addr ? ' · ' + o.data.email_addr : '')) } catch (e) { lines.push('❌ guerrilla — ' + (e && e.message ? e.message : e) + ' (' + (Date.now() - t2) + 'ms)') }
      return m.reply(lines.join('\n'))
    }

    if (sub === 'delete' || sub === 'مسح') {
      const acc = myAccount(sender)
      if (!acc) return m.reply('ماكاين حتى حساب عندك.')
      if (acc.provider === 'mailtm' && acc.id) { try { const token = await tmToken(acc); await tmApi('/accounts/' + acc.id, { method: 'DELETE', token: token }) } catch (e) {} }
      tokens.delete(acc.address)
      sessions.delete(sender)
      dropAccount(sender)
      return m.reply('🗑️ تمسح الحساب والعنوان ديالك.')
    }

    if (sub === 'new' || sub === 'جديد') {
      lastNew.set(sender, Date.now())
      const old = myAccount(sender)
      if (old) { tokens.delete(old.address); sessions.delete(sender); dropAccount(sender) }
      const acc = await createAccount()
      saveAccount(sender, acc)
      return m.reply('📧 *عنوانك المؤقت الجديد:*\n\n`' + acc.address + '`\n\nاستعملو في التسجيلات، والرسائل اللي غادي توصلو غادي تلقاها هنا بـ ' + usedPrefix + command + ' inbox\n⚠️ البريد المؤقت عمومي الخدمة — ما تستعملوش لحسابات مهمة.' + lifeNote(acc))
    }

    if (sub === 'inbox' || sub === 'الوارد') {
      lastInbox.set(sender, Date.now())
      let acc = myAccount(sender)
      if (!acc) { acc = await createAccount(); saveAccount(sender, acc) }
      const items = await fetchInbox(acc)
      sessions.set(sender, { lastList: items.map((x) => x.id), ts: Date.now() })
      if (!items.length) return m.reply('📭 *الوارد خاوي* — حتى رسالة ما وصلات لـ `' + acc.address + '`\nعاود جرّب من بعد شوية.')
      const lines = items.map((x, i) => (i + 1) + '. ' + (x.seen ? '' : '🆕 ') + '*' + (x.subject || '(بلا عنوان)') + '*\n    من: ' + x.from + ' · ' + x.when)
      return m.reply('📥 *الوارد ديال* `' + acc.address + '`:\n\n' + lines.join('\n') + '\n\nقرا رسالة بـ ' + usedPrefix + command + ' <رقم>')
    }

    if (/^\d+$/.test(sub)) {
      const acc = myAccount(sender)
      if (!acc) return m.reply('ماكاين حتى حساب — بدا بـ ' + usedPrefix + command)
      const sess = sessions.get(sender)
      if (!sess || !sess.lastList || !sess.lastList.length) return m.reply('خاصك تشوف الوارد أولاً: ' + usedPrefix + command + ' inbox')
      const id = sess.lastList[parseInt(sub, 10) - 1]
      if (!id) return m.reply('هاد الرقم ما كاينش في اللائحة.')
      const msg = await fetchMessage(acc, id)
      let body = msg.body || '(الرسالة خاوية)'
      if (body.length > 1500) body = body.slice(0, 1500) + '…'
      const code = findCode(body) || findCode(msg.subject)
      return m.reply('✉️ *' + (msg.subject || '(بلا عنوان)') + '*\nمن: ' + msg.from + '\n' + msg.when + (code ? '\n\n🔑 *الكود: ' + code + '*' : '') + '\n\n' + body)
    }

    if (!sub) {
      let acc = myAccount(sender)
      const isNew = !acc
      if (!acc) { acc = await createAccount(); saveAccount(sender, acc) }
      return m.reply('📧 *عنوانك المؤقت' + (isNew ? ' الجديد' : '') + ':*\n\n`' + acc.address + '`\n\n' + usedPrefix + command + ' inbox — شوف الرسائل\n' + usedPrefix + command + ' new — بدّل العنوان\n⚠️ ما تستعملوش لحسابات مهمة (كلمات السر كتبقى عند الخدمة).' + lifeNote(acc))
    }

    return m.reply(usage)
  } catch (e) {
    return m.reply('❌ خدمة البريد المؤقت ما جاوباتش دابا. عاود من بعد شوية.' + (owner ? '\n🔧 ' + (e && e.message ? e.message : e) : ''))
  }
}

handler.help = ['tempmail']
handler.tags = ['tools']
handler.command = /^tempmail$/i

export default handler
  
