// plugins/spacetoon.js — سبيستون: كرتون الزمن الجميل (2000–2013)
// .spacetoon            → قائمة الكرتون
// .spacetoon <رقم/اسم>  → كيصيفط ليك شارة البداية بالعربية كملف صوتي
// المصدر: SoundCloud (روابط مفحوصة يدوياً) بنفس طريقة .dl-sc —
// يوتيوب محجوب على خوادم مراكز البيانات بلا PO token (سقف 1MB)،
// وساوندكلاود كيخدم كامل. إلا فشل المصدر كيتصايب رابط يوتيوب كبديل.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const execFileAsync = promisify(execFile)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const MAX_BYTES = 30 * 1024 * 1024

const CARTOONS = [
  { name: 'أبطال الديجيتال', sub: 'Digimon Adventure', sc: 'https://soundcloud.com/mohamed-abdallah/digimon1', yt: 'F2pw97R4160', keys: ['digimon', 'ديجيتال', 'ابطال'] },
  { name: 'بي بليد', sub: 'Beyblade', sc: 'https://soundcloud.com/almahmeedgamer/fcmoimjtoorh', yt: 'TDDBKc4GJ8A', keys: ['beyblade', 'بليد'] },
  { name: 'المحقق كونان', sub: 'Detective Conan', sc: 'https://soundcloud.com/hussien-hussien-1/conan-opening-arabic', yt: 'Xd6qPWVVVRk', keys: ['conan', 'كونان', 'محقق'] },
  { name: 'دراغون بول', sub: 'Dragon Ball', note: 'توزيع جديد', sc: 'https://soundcloud.com/sultan-jarmakani/mfcs5rqvzwyq', yt: '0RJlf6RXqVM', keys: ['dragon', 'دراغون', 'بول'] },
  { name: 'بوكيمون', sub: 'Pokémon', sc: 'https://soundcloud.com/user-689030024/fvtm8ikmnhgn', yt: 'MCU3Bya2v9A', keys: ['pokemon', 'بوكيمون'] },
  { name: 'يوغي يو', sub: 'Yu-Gi-Oh!', sc: 'https://soundcloud.com/h-remy-1/xtb28byixigj', yt: 'iu9FFtcfzj4', keys: ['yugioh', 'يوغي', 'يوقي'] },
  { name: 'همتارو', sub: 'Hamtaro', sc: 'https://soundcloud.com/crunchy-729446819/eppxbvubbn3b', yt: 'nHTM6UDE-E0', keys: ['hamtaro', 'همتارو', 'هامتارو'] },
  { name: 'سلام دانك', sub: 'Slam Dunk', sc: 'https://soundcloud.com/maram-adel/spacetoon-8', yt: 'WevtBmOU5qY', keys: ['slam', 'dunk', 'سلام', 'دانك'] },
  { name: 'القناص', sub: 'Hunter × Hunter', sc: 'https://soundcloud.com/hasan-mahameed/l3ejuetl6uwt', yt: 'vBmusw7a8fc', keys: ['hunter', 'قناص', 'هنتر'] },
  { name: 'ناروتو', sub: 'Naruto', sc: 'https://soundcloud.com/molten-freedy-1998/epwqbzmraffi', yt: 'oszljsNwk4I', keys: ['naruto', 'ناروتو'] },
  { name: 'ون بيس', sub: 'One Piece', sc: 'https://soundcloud.com/shibo-koko/one-piece-arabic-opening-hd', yt: 'iBpm4ii4NOU', keys: ['one piece', 'ون', 'بيس'] },
  { name: 'سابق ولاحق', sub: "Let's & Go", sc: 'https://soundcloud.com/arab-cartoons/vux3hsvt42gq', yt: 'aVps7M4DH4s', keys: ['سابق', 'لاحق', 'lets'] },
  { name: 'إنيوشا', sub: 'Inuyasha', sc: 'https://soundcloud.com/sweetgoldy/uravujli9hf', yt: 'nLiM0mUuWFs', keys: ['inuyasha', 'انيوشا', 'إنيوشا'] },
  { name: 'دروب ريمي', sub: 'Remi', sc: 'https://soundcloud.com/emad-abdulrahman-hamdy/zsloc0uyx33s', yt: null, keys: ['remi', 'ريمي', 'دروب'] },
  { name: 'كابتن ماجد', sub: 'Captain Tsubasa', sc: 'https://soundcloud.com/asyad-fatima/xjtjbyxtljds', yt: null, keys: ['tsubasa', 'ماجد', 'كابتن', 'الهداف'] },
  { name: 'عدنان ولينا', sub: 'Future Boy Conan', sc: 'https://soundcloud.com/asyad-fatima/kzmfdcli1qqo', yt: null, keys: ['عدنان', 'لينا', 'conan boy'] },
  { name: 'ماوكلي', sub: 'Jungle Book', sc: 'https://soundcloud.com/maram-mohamad/iaqceuuthvea', yt: null, keys: ['ماوكلي', 'mowgli', 'فتى الغابة'] },
  { name: 'أنا وأخواتي', sub: 'Baby and Me', sc: 'https://soundcloud.com/trqlrbytrqn/nzzih6sdqwps', yt: null, keys: ['اخواتي', 'أخواتي'] },
  { name: 'هزيم الرعد', sub: 'Thunder Jet', sc: 'https://soundcloud.com/mahmoud-zidan-45/dfuaeynkyhuu', yt: null, keys: ['هزيم', 'الرعد'] },
  { name: 'ماروكو الصغيرة', sub: 'Chibi Maruko-chan', sc: 'https://soundcloud.com/radrecords16/mp3', yt: null, keys: ['ماروكو', 'maruko'] },
  { name: 'بوليانا', sub: 'Pollyanna', sc: 'https://soundcloud.com/shaheidt-alislam-338640704/abldi9zp4ghd', yt: null, keys: ['بوليانا', 'pollyanna'] },
  { name: 'جنى', sub: 'Jana', sc: 'https://soundcloud.com/tahani202016/tmbdld8irbdn', yt: null, keys: ['جنى', 'امد اليدين'] },
  { name: 'دورايمون', sub: 'Doraemon', sc: 'https://soundcloud.com/abdel-rahman-ahmed-1/uaj2smyeo6nj', yt: null, keys: ['دورايمون', 'doraemon'] },
  { name: 'أجنحة الكاندام', sub: 'Gundam Wing', sc: 'https://soundcloud.com/yousef-mohamed-71/fiucs8qfmram', yt: null, keys: ['كاندام', 'gundam'] },
  { name: 'زورو', sub: 'Zorro', sc: 'https://soundcloud.com/wahhab-amargi/ydwhcx30ipml', yt: null, keys: ['زورو', 'zorro'] },
  { name: 'الرمية الملتهبة', sub: 'Hungry Heart', sc: 'https://soundcloud.com/asyad-fatima/cgrpi4lsdqkd', yt: null, keys: ['الرمية', 'ملتهبة'] },
  { name: 'أبطال الكرة', sub: 'Inazuma Eleven', sc: 'https://soundcloud.com/mustafa-bajan-394205727/spacetoon-1', yt: null, keys: ['الكرة', 'inazuma'] },
  { name: 'عهد الأصدقاء', sub: 'Romeo no Aoi Sora', sc: 'https://soundcloud.com/theonlyhosny/qtvbtark7hit', yt: null, keys: ['عهد', 'الاصدقاء'] },
  { name: 'لحن الحياة', sub: 'Trapp Family Story', sc: 'https://soundcloud.com/user-689030024/7jqwtj1iifui', yt: null, keys: ['لحن', 'الحياة'] },
  { name: 'صاحب الظل الطويل', sub: 'Daddy Long Legs', sc: 'https://soundcloud.com/arab-cartoons/e752skfsfsbl', yt: null, keys: ['الظل', 'طويل'] },
  { name: 'توم سوير', sub: 'Tom Sawyer', sc: 'https://soundcloud.com/user-112176726/avwhnwgqmixi', yt: null, keys: ['توم', 'سوير', 'sawyer'] },
  { name: 'جزيرة الكنز', sub: 'Takarajima', sc: 'https://soundcloud.com/adhussien/azewug95p1yy', yt: null, keys: ['جزيرة', 'الكنز'] },
  { name: 'فتاة المراعي', sub: 'Katri', sc: 'https://soundcloud.com/shaimaa-natshah/uchwfynuuubb', yt: null, keys: ['المراعي', 'فتاة'] },
  { name: 'الحديقة السرية', sub: 'Secret Garden', sc: 'https://soundcloud.com/muhamed-alhabib-nakache/vzpvysnwx1yo', yt: null, keys: ['الحديقة', 'سرية'] },
  { name: 'بيل وسبستيان', sub: 'Belle and Sebastian', sc: 'https://soundcloud.com/rachid-sajid/d8xkmbpizq8l', yt: null, keys: ['بيل', 'سبستيان'] },
  { name: 'ساندي بيل', sub: 'Sandybell', sc: 'https://soundcloud.com/user-490680958/u2j7lckhqawd', yt: null, keys: ['ساندي', 'sandybell'] },
  { name: 'دراغون بول زد', sub: 'Dragon Ball Z', sc: 'https://soundcloud.com/moussamohsen/dragon-ball-z-arabic-opening', yt: null, keys: ['زد', 'z'] },
  { name: 'دراغون بول جي تي', sub: 'Dragon Ball GT', sc: 'https://soundcloud.com/mad123-2/ki6pfouzjfng', yt: null, keys: ['جي تي', 'gt'] },
  { name: 'أبطال الديجيتال 3', sub: 'Digimon Tamers', sc: 'https://soundcloud.com/mohamed-hamama/w6zggb6kalru', yt: null, keys: ['تامرز', 'tamers'] },
  { name: 'فلة والأقزام السبعة', sub: 'Snow White', sc: 'https://soundcloud.com/arab-cartoons/kh1taygi1eiv', yt: null, keys: ['فلة', 'الاقزام'] },
  { name: 'فلينستون', sub: 'The Flintstones', sc: 'https://soundcloud.com/mohamed-gebril-18/arabic-opening-1', yt: null, keys: ['فلينستون', 'flintstones'] },
  { name: 'محققو الحيوانات', sub: 'Kiruminzuu', sc: 'https://soundcloud.com/user-340858752/anyamaru-tantei-kiruminzuu', yt: null, keys: ['حيوانات', 'محققو'] },
]

/* ---------------- SoundCloud engine (نفس طريقة dlpack) ---------------- */

let scClientId = ''
async function getScClientId() {
  if (scClientId) return scClientId
  const home = await (await fetch('https://soundcloud.com/', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).text()
  const assets = [...new Set([...home.matchAll(/https:\/\/[^"'\s]*sndcdn\.com\/assets\/[^"'\s]+\.js/g)].map((x) => x[0]))]
  for (const a of assets) {
    try {
      const js = await (await fetch(a, { signal: AbortSignal.timeout(20000) })).text()
      const mm = js.match(/client_id["']?\s*[:=]\s*["']([0-9a-zA-Z]{32})["']/)
      if (mm) { scClientId = mm[1]; return scClientId }
    } catch {}
  }
  throw new Error('soundcloud: could not obtain client_id')
}

function workDir() {
  const d = path.join(process.cwd(), 'tmp', 'spacetoon')
  try { fs.mkdirSync(d, { recursive: true }) } catch {}
  return d
}

async function fetchTheme(cartoon) {
  const cid = await getScClientId()
  const res = await fetch('https://api-widget.soundcloud.com/resolve?url=' + encodeURIComponent(cartoon.sc) + '&format=json&client_id=' + cid,
    { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) { scClientId = ''; throw new Error('soundcloud resolve HTTP ' + res.status) }
  const t = await res.json()
  if (t.kind !== 'track') throw new Error('soundcloud: not a track')
  const trans = t.media?.transcodings || []
  const prog = trans.find((x) => x.format?.protocol === 'progressive')
  const hls = trans.find((x) => x.format?.protocol === 'hls')
  if (prog) {
    const s = await (await fetch(prog.url + '?client_id=' + cid, { headers: { 'User-Agent': UA } })).json()
    if (!s?.url) throw new Error('soundcloud: no stream url')
    const r = await fetch(s.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
    if (!r.ok) throw new Error('soundcloud stream HTTP ' + r.status)
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 20000 || buf.length > MAX_BYTES) throw new Error('soundcloud: bad size ' + buf.length)
    return buf
  }
  if (hls) {
    const s = await (await fetch(hls.url + '?client_id=' + cid, { headers: { 'User-Agent': UA } })).json()
    if (!s?.url) throw new Error('soundcloud: no stream url')
    const out = path.join(workDir(), 'theme-' + Date.now() + '.mp3')
    try {
      await execFileAsync('ffmpeg', ['-y', '-user_agent', UA, '-i', s.url, '-vn', '-c:a', 'libmp3lame', '-q:a', '3', out], { timeout: 240000 })
      if (!fs.existsSync(out) || fs.statSync(out).size < 20000) throw new Error('soundcloud: empty audio output')
      return fs.readFileSync(out)
    } finally { try { fs.unlinkSync(out) } catch {} }
  }
  throw new Error('soundcloud: no playable stream')
}

/* ---------------- اختيار من القائمة ---------------- */

function menuText(prefix, cmd) {
  let t = '📺 *سبيستون — كرتون الزمن الجميل* ✨\nشارات البداية بالعربية (2000–2013):\n\n'
  CARTOONS.forEach((c, i) => { t += `${i + 1}. ${c.name} — ${c.sub}\n` })
  t += `\nاختر اللي بغيتي: ${prefix + cmd} <رقم ولا اسم>\nمثال: ${prefix + cmd} 2 ولا ${prefix + cmd} كونان`
  return t
}

function pick(arg) {
  const a = String(arg || '').trim().toLowerCase()
  if (!a) return null
  const n = parseInt(a, 10)
  if (String(n) === a && n >= 1 && n <= CARTOONS.length) return CARTOONS[n - 1]
  return CARTOONS.find((c) => c.name.toLowerCase().includes(a) || a.includes(c.name.toLowerCase()) ||
    c.sub.toLowerCase().includes(a) || c.keys.some((k) => a.includes(k.toLowerCase()))) || null
}

let busy = false

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const arg = (text || '').trim()
  if (!arg) return m.reply(menuText(usedPrefix, command))
  const cartoon = pick(arg)
  if (!cartoon) return m.reply('❌ ما لقيتش هاد الكرتون في القائمة. كتب ' + usedPrefix + command + ' باش تشوف القائمة كاملة.')
  if (busy) return m.reply('⏳ كاين تحميل خدام دابا — سالي وعاود المحاولة.')
  busy = true
  try {
    await conn.sendMessage(m.chat, { react: { text: '🎵', key: m.key } }).catch(() => {})
    const buf = await fetchTheme(cartoon)
    await conn.sendMessage(m.chat, {
      audio: buf,
      mimetype: 'audio/mpeg',
      fileName: `شارة ${cartoon.name}.mp3`,
      ptt: false,
    }, { quoted: m })
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {})
    return m.reply(`✅ *شارة ${cartoon.name}* — ${cartoon.sub}${cartoon.note ? ' (' + cartoon.note + ')' : ''}\n📺 سبيستون... شباب المستقبل ✨`)
  } catch (e) {
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    if (cartoon.yt) {
      return m.reply(`⚠️ ما قدرتش نهبط الشارة مباشرة دابا، ولكن تقدر تسمعها هنا:\nhttps://youtu.be/${cartoon.yt}`)
    }
    return m.reply('❌ وقع مشكل في التحميل. عاود المحاولة بعد شوية.')
  } finally {
    busy = false
  }
}

handler.help = ['spacetoon']
handler.tags = ['morocco']
handler.command = /^(spacetoon|سبيستون|كرتون)$/i

export default handler
   
