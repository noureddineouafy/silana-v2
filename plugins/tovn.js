// plugins/tovn.js

let handler = async (m, { conn }) => {
  if (!m.quoted) {
    return m.reply(
      '📌 *Voice Note Converter*\n\n' +
      'This feature converts an audio, video, or audio-document file into a WhatsApp voice note (PTT).\n\n' +
      '*How to use:*\n' +
      '1. Reply to an audio, video, or audio-document message.\n' +
      '2. Send the command: `.tovn` (or `.tovoice`, `.vn`)\n\n' +
      '_Example: reply to a voice message or audio file and type .tovn_'
    )
  }

  // Try several common property names/locations for the mimetype,
  // since frameworks differ in how they expose this on the quoted object.
  const mime =
    m.quoted.mime ||
    m.quoted.mimetype ||
    m.quoted.mediaType ||
    m.quoted?.message?.audioMessage?.mimetype ||
    m.quoted?.message?.videoMessage?.mimetype ||
    m.quoted?.message?.documentMessage?.mimetype ||
    ''

  // Debug: log the full quoted object once so you can find the right key
  console.log('[TOVN] quoted object:', JSON.stringify(m.quoted, null, 2))

  const validMime = /^(audio|video)\/|application\/(octet-stream|pdf|msword|vnd\.|x-)/

  if (!validMime.test(mime)) {
    return m.reply(`Unsupported format: ${mime || 'unknown'}\n\nPlease reply to an audio, video, or audio-document file.`)
  }

  try {
    const buffer = await m.quoted.download()

    if (!buffer || buffer.length < 1024) {
      return m.reply('Download failed or the file is too small.')
    }

    await conn.sendMessage(
      m.chat,
      {
        audio: buffer,
        mimetype: 'audio/mp4',
        ptt: true
      },
      { quoted: m }
    )
  } catch (e) {
    console.error('[TOVN] error:', e)
    m.reply('Failed to convert the media into a voice note.')
  }
}

handler.help = handler.command = ['tovn']

handler.tags = ['tools']

handler.limit = false

export default handler
