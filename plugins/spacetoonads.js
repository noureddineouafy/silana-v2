// spacetoonads — classic Spacetoon ads & bumpers (2000-2003) from the Internet Archive, sent at random.
// Source collections: archive.org Spacetoon broadcast archives 2000-2001 and 2002-2005. Nothing is stored on the panel; each video is fetched on demand.
const ADS = [
  ['فاصل كواكب سبيستون 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/fasl-koakb-sbys-ton-2003.mp4'],
  ['كوكب علوم 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-aalom-2002-2003-sbys-ton.mp4'],
  ['كوكب أبجد 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-abgd-2002-2003-sbys-ton.mp4'],
  ['كوكب أفلام 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-aflam-2002-2003-sbys-ton.mp4'],
  ['كوكب أفلام 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-aflam-2003.mp4'],
  ['كوكب أكشن 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-akshn-2002-2003-sbys-ton.mp4'],
  ['كوكب بون بون 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-bon-bon-2002-2003-sbys-ton.mp4'],
  ['كوكب كوميديا 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-komydya-2002-2003-sbys-ton.mp4'],
  ['كوكب مغامرات 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-mghamarat-2002-2003-sbys-ton.mp4'],
  ['كوكب مغامرات القديم', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-mghamrat-alkdym.mp4'],
  ['كوكب رياضة 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-ryad-2002-2003-sbys-ton.mp4'],
  ['كوكب تاريخ 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-tarykh-2002-2003-sbys-ton.mp4'],
  ['كوكب زمردة 2002-2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kokb-zmrd-2002-2003-sbys-ton.mp4'],
  ['إعلان نيو بوي 2001: الألوان', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/2001-new-boy-asbys-ton-daaay-alaloan-alshry-mn.mp4'],
  ['إعلان منتجات نيو بوي 2001', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/2001-new-boy-kna-asbys-ton-daaay-mntgat.mp4'],
  ['إعلان ملصقات بوكيمون 2001', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/2001-pokemon-kna-asbys-ton-daaay-mlskat-bokymon.mp4'],
  ['إعلان بوكيمون الجزء السادس', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/aaalan-bokymon-algzaa-alsads-aal-kna-nyo-ty-fy.mp4'],
  ['إعلان بسكوت إسلام دانك وزبادي المراعي 2002', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/asbys-ton-daaay-bskot-aslam-dank-o-zbady-almraaay-2002.mp4'],
  ['إعلان منتجات إسلام دانك 2002', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/asbys-ton-daaay-mntgat-aslam-dank-sn-2002.mp4'],
  ['إعلان نيو بوي: الرسم العجيب 2002', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/asbys-ton-daaay-new-boy-alrsm-alaagyb-sn-2002.mp4'],
  ['إعلان نيو بوي: جمع وترتيب الصور 2002', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/asbys-ton-daaay-new-boy-lgmaa-o-trtyb-alsor-sn-2002.mp4'],
  ['دعايات سبيستون ١', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/daaayat-sbys-ton-1.mp4'],
  ['دعايات سبيستون ٣', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/daaayat-sbys-ton-3.mp4'],
  ['إعلان ديليس دانون', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/delice-danone.mp4'],
  ['إعلانات سبيستون 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/hsrya-aaalan-o-ththyr-mn-kna-asbys-ton-2000.mp4'],
  ['دعاية برنامج داي على الهواء 2001', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/laol-mr-daaay-brnamg-day-aal-alhoaaa-aal-asbys-ton-2001.mp4'],
  ['دعايات قديمة + فاصل أكشن قديم', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/yatykm-kdym-daaayat-kdym-aadna-ashkn-kdym-fasl-akshn-kdym.mp4'],
  ['ابحث عن سبيستون', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/abhth-aan-sbys-ton.mp4'],
  ['تشاهدون اليوم القديم — فواصل قديمة', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/anthaaa-mn-kokb-ryad-alkdym-tshahdon-alyom-alkdym-foasl-sbys-tony-kdym.mp4'],
  ['انتهت رحلتنا في كوكب أكشن 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/antht-rhltna-fy-kokb-akshn-2003-sbys-ton.mp4'],
  ['فواصل سبيستون قصيرة 2001', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/asbys-ton-foasl-ksyr-sn-2001.mp4'],
  ['بعد قليل', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/baad-klyl-6-sbys-ton.mp4'],
  ['بعد قليل: اكتشاف أعماق البحار — كوكب علوم 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/baad-klyl-aktshaf-aaamak-albhar-kokb-aalom-sbys-tn-2003.mp4'],
  ['فاصل المحقق كونان', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/daaay-aalk-almhkk-konan-spacetoon.mp4'],
  ['فاصل بوكيمون 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/fasl-bokymon-2000-am-by-sy.mp4'],
  ['فاصل سبيستون: مهمة', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/fasl-sbys-ton-mhma.mp4'],
  ['فاصل سبيستون: نصيحة', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/fasl-sbys-ton-nsyh.mp4'],
  ['فاصل سبيستون', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/fasl-sbys-ton.mp4'],
  ['فواصل سبيستون القديمة ١', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/foasl-sbys-tony-kdym-1.mp4'],
  ['فواصل قديمة: كوكب رياضة', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/foasl-sbys-tony-kdym-kokb-ryad-alkdym.mp4'],
  ['فواصل سبيستون 2002', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/foasl-spacetoon-sn-2002.mp4'],
  ['قريباً قريباً قريباً', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/kryba-kryba-kryba-kryba.mp4'],
  ['قريباً ١', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kryba-sbys-ton-1.mp4'],
  ['قريباً ٤', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kryba-sbys-ton-4.mp4'],
  ['قريباً ٦', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kryba-sbys-ton-6.mp4'],
  ['قريباً ٧', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kryba-sbys-ton-7.mp4'],
  ['قريباً ٨', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kryba-sbys-ton-8.mp4'],
  ['قريباً ٩', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/kryba-sbys-ton-9.mp4'],
  ['تشاهدون غداً — تلفزيون البحرين 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/tlfzyon-albhryn-asbys-ton-tshahdon-ghda-sn-2000.mp4'],
  ['تشاهدون اليوم: أبطال الديجيتال ج٣', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/tshahdon-alyom-alkdym-daaay-abtal-alddygytal-g-3-alkdym-foasl-sbys-tony-kdym.mp4'],
  ['تشاهدون اليوم 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/tshahdon-alyom-sn-2003-sbys-ton.mp4'],
  ['يأتيكم في الأوقات التالية: أبطال النينجا 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/yatykm-fy-aokat-altaly-abtal-alnnga-2003-sbys-ton.mp4'],
  ['يأتيكم في الأوقات التالية: سابق ولاحق 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/yatykm-fy-aokat-altaly-sabk-o-lahk-2003-sbys-ton.mp4'],
  ['فاصل رمضان كريم 2001', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/asbys-ton-fasl-rmdan-krym-sn-2001.mp4'],
  ['آية قرآنية — رمضان 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/ay-krany-rmdan-2003-sbys-ton.mp4'],
  ['أيام رمضان 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/ayam-rmdan-19-sbys-ton-2003.mp4'],
  ['حديث شريف — رمضان 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/hdyth-shryf-rmdan-2003-sbys-ton.mp4'],
  ['رمضان كريم 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/rmdan-krym-sbys-ton-2003.mp4'],
  ['سبيستون في رمضان', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/sbys-ton-rmdan-24.mp4'],
  ['تشاهدون اليوم — رمضان 2003', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/tshahdon-alyon-2003-rmdan-sbys-ton.mp4'],
  ['التعريف بكوكب بون بون — افتتاح 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/altaaryf-bkokb-bonbon-afttahy-sbyston-2000.mp4'],
  ['أرشيف البث التجريبي 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/arshyf-albth-altgryby-lkna-spacetoon-sn-2000.mp4'],
  ['فاصل البث التجريبي — نايل سات 2001', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/fasl-albth-altgryby-lkna-spacetoon-nilesat-sn-2001.mp4'],
  ['فاصل شعار القناة — البث التجريبي 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/fasl-shaaar-kna-asbys-ton-altgryby-2000.mp4'],
  ['تحية كونان — افتتاح سبيستون 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/fkr-arshyfy-thy-mn-konan-bmnasb-afttah-sbys-ton-aaam-2000m.mp4'],
  ['انتهاء البث التجريبي 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/hsrya-anthaaa-albth-altgryby-lkna-asbys-ton-2000.mp4'],
  ['البث الرسمي 2000: مغامرات حنين', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/sbys-ton-albth-alrsmy-aal-albhryn-2-mghamrat-hnyn.mp4'],
  ['البث الرسمي 2000: صقور الأرض', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/sbys-ton-albth-alrsmy-aal-albhryn-3-skor-alard.mp4'],
  ['البث التجريبي 2000: مدرسة الكونغ فو', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/sbys-ton-albth-altgryby-aal-albhryn-1-mdrs-alkongh-fo.mp4'],
  ['البث التجريبي 2000: باص المدرسة العجيب', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/sbys-ton-albth-altgryby-aal-albhryn-2-bas-almdrs-alaagyb.mp4'],
  ['البث التجريبي 2000: باتمان', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/sbys-ton-albth-altgryby-aal-albhryn-3-bat-man.mp4'],
  ['البث التجريبي 2000: المحقق كونان', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/sbys-ton-albth-altgryby-aal-albhryn-4-almhkk-konan.mp4'],
  ['شعار سبيستون', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/shaaarsbys-ton.mp4'],
  ['تحية الكابتن ماجد — افتتاح سبيستون 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/thy-mn-alkabtn-magd-afttahy-sbyston-aaam-2000.mp4'],
  ['تحية القناع الأخضر — افتتاح سبيستون 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/thy-mn-alknaaa-alakhdr-mask-afttahy-sbyston-aaam-2000.mp4'],
  ['تحية فيل — افتتاح سبيستون 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/thy-mn-fl-afttahy-sbyston-2000.mp4'],
  ['تحية روميو للأصدقاء — افتتاح سبيستون 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/thy-mn-romyo-lasdkaaa-sbystonafttahy-sbyston-aaam-2000.mp4'],
  ['تحية ريمي — افتتاح سبيستون 2000', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/thy-mn-rymy-afttah-kna-sbyston-aaam-2000.mp4'],
  ['أغنية سبيستون', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/aghny-sbys-ton.mp4'],
  ['أغنية ماذا أهديك', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/matha-ahdyk-sbys-ton-spacetoon.mp4'],
  ['مفاجأة سبيستون: رالي العرب', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/mfaga-sbys-ton-raly-alaarb.mp4'],
  ['فقرة من يعرف كيف يكون', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/mn-yaarf-kyf-ykon-sbys-ton.mp4'],
  ['مواعيد عرض أبطال الديجيتال', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/moaayd-aard-abtal-aldygytal-sbys-ton-kdym.mp4'],
  ['نصائح سبيستون ١', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/nsayh-sbys-ton-1.mp4'],
  ['نصائح سبيستون ٢', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/nsayh-sbys-ton-2.mp4'],
  ['نصائح سبيستون ٣', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/nsayh-sbys-ton-3.mp4'],
  ['أغنية ريمي: أمي كم أهواها', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/rymy-amy-km-ahoaha.mp4'],
  ['سبيستون أوربت', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/sbys-ton-aorbyt.mp4'],
  ['شنغل ومنغل', 'https://archive.org/download/mnoaaat-msgl-mn-asbys-ton-aal-alnayl-sat-2002/shnghl-o-mnghl.mp4'],
  ['أغنية أصحابي مسرورون', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/spacetoon-ashaby-msroron-sbyston.mp4'],
  ['أغنية يا أمي', 'https://archive.org/download/hsrya-o-laol-mr-brnamg-konan-aal-alhoaaa-2000-2/ya-amy-mn-yhzn-sbys-ton.mp4'],
]
const MAX_BYTES = 45 * 1024 * 1024
const lastPick = {}
const busyChats = {}
const lastUse = {}

let handler = async (m, { conn, text, isOwner }) => {
  const chat = m.chat
  const sender = m.sender
  const arg = (text || '').trim()
  if (arg === 'list') {
    let out = '📺 *لائحة إعلانات وفواصل سبيستون القديمة (' + ADS.length + ')*\n\n'
    for (let i = 0; i < ADS.length; i++) out += (i + 1) + '. ' + ADS[i][0] + '\n'
    out += '\nكتب .spacetoonads <رقم> باش تشوف واحد بعينه 🎞️'
    return m.reply(out)
  }
  let idx = -1
  if (/^\d+$/.test(arg)) {
    idx = parseInt(arg, 10) - 1
    if (idx < 0 || idx >= ADS.length) return m.reply('⚠️ الرقم خاص يكون بين 1 و ' + ADS.length + ' — كتب .spacetoonads list باش تشوف اللائحة')
  } else if (arg !== '') {
    return m.reply('📺 *إعلانات وفواصل سبيستون القديمة*\n\nكتب .spacetoonads وغادي يوصلك إعلان ولا فاصل عشوائي من الزمن الجميل (2000-2003) ✨\n• .spacetoonads <رقم> — شوف واحد بعينه\n• .spacetoonads list — اللائحة كاملة (' + ADS.length + ')')
  }
  const now = Date.now()
  if (!isOwner && lastUse[sender] && now - lastUse[sender] < 10000) return m.reply('⏳ صبر شوية بين كل طلب وطلب (10 ثواني)')
  if (busyChats[chat]) return m.reply('⏳ كنحمّل فيديو آخر لهاد المحادثة، سالي و عاود المحاولة')
  if (idx < 0) {
    idx = Math.floor(Math.random() * ADS.length)
    if (ADS.length > 1 && idx === lastPick[chat]) idx = (idx + 1 + Math.floor(Math.random() * (ADS.length - 1))) % ADS.length
  }
  lastUse[sender] = now
  busyChats[chat] = true
  const title = ADS[idx][0]
  const url = ADS[idx][1]
  try {
    await m.reply('📺 كنوجد ليك: *' + title + '* ...')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 180000)
    let res
    try {
      res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
    } finally { clearTimeout(timer) }
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const declared = parseInt(res.headers.get('content-length') || '0', 10)
    if (declared && declared > MAX_BYTES) throw new Error('file too large: ' + declared)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 10000) throw new Error('file too small: ' + buf.length)
    if (buf.length > MAX_BYTES) throw new Error('file too large: ' + buf.length)
    if (buf.toString('latin1', 4, 8) !== 'ftyp') throw new Error('not an mp4')
    lastPick[chat] = idx
    await conn.sendMessage(chat, {
      video: buf,
      mimetype: 'video/mp4',
      fileName: 'spacetoon-' + (idx + 1) + '.mp4',
      caption: '📺 *' + title + '*\n\n🎞️ من أرشيف سبيستون الذهبي (2000-2003)\n🔢 رقم ' + (idx + 1) + ' من ' + ADS.length + ' — كتب .spacetoonads ' + (idx + 1) + ' باش تعاود تشوفو، ولا .spacetoonads لواحد آخر عشوائي'
    }, { quoted: m })
  } catch (e) {
    let msg = '😕 ما قدرتش نجيب هاد الفيديو دابا، عاود المحاولة'
    if (isOwner) msg += '\n\n🔧 ' + (e && e.message ? e.message : e)
    await m.reply(msg)
  } finally {
    busyChats[chat] = false
  }
}
handler.help = ['spacetoonads']
handler.tags = ['morocco']
handler.command = /^spacetoonads$/i
export default handler
  
