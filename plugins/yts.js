import yts from 'yt-search';

let handler = async (m, { usedPrefix, command, text }) => {
 if (!text) throw `Usage: ${usedPrefix + command} Ela Vira Mortal`;

 m.react('🔁');

 try {
  const search = await yts(text);

  const results = search.videos.slice(0, 10);

  if (!results.length) {
   return m.reply('Result not found.');
  }

  const Audio = results.map((item) => ({
   title: item.title,
   description: `🕛 ${item.timestamp} | 👤 ${item.author.name}`,
   id: `${usedPrefix}ytmp3 ${item.url}`,
  }));

  const Video = results.map((item) => ({
   title: item.title,
   description: `🕛 ${item.timestamp} | 👤 ${item.author.name}`,
   id: `${usedPrefix}ytmp4 ${item.url}`,
  }));

  await conn.sendButton(
   m.chat,
   {
    text: `Search results for "${text}"`,
    footer: global.namebot,
    buttons: [
     {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
       title: 'Audio (MP3)',
       sections: [
        {
         title: 'Audio List',
         rows: Audio,
        },
       ],
      }),
     },
     {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
       title: 'Video (MP4)',
       sections: [
        {
         title: 'Video List',
         rows: Video,
        },
       ],
      }),
     },
    ],
    messageParamsJson: JSON.stringify({
     bottom_sheet: {
      list_title: 'YouTube Downloader',
      button_title: 'Choose Format',
      in_thread_buttons_limit: 1,
     },
    }),
   },
   { quoted: m }
  );
 } catch (e) {
  console.error(e);
  m.reply(String(e));
 }
};

handler.help = ['yts'];
handler.tags = ['downloader'];
handler.command = /^(yts|youtubesearch)$/i;
handler.limit = false;

export default handler;
