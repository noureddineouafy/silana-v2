
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE = 'https://api.ilovepdf.com';

let handler = async (m, { conn, text, usedPrefix, command }) => {
  let filePath;

  if (m.quoted?.mimetype === 'application/pdf') {
    await m.react('⏳');

    const buffer = await m.quoted.download();
    filePath = `./tmp/${Date.now()}.pdf`;
    fs.writeFileSync(filePath, buffer);
  } else if (text) {
    filePath = text.trim();
  } else {
    throw `
🖼️ *PDF to JPG Converter*

Convert every page of a PDF into high-quality JPG images.

*How to use*

Option 1 (Recommended)
• Reply to a PDF document with this command.

Example:
${usedPrefix + command}

Option 2
• Provide the local file path.

Example:
${usedPrefix + command} ./tmp/document.pdf

The result will be a ZIP archive containing all converted JPG images.
`.trim();
  }

  if (!fs.existsSync(filePath)) {
    throw '❌ The specified PDF file could not be found.';
  }

  const outputZip = `./tmp/pdf2jpg_${Date.now()}.zip`;

  try {
    await pdfToJpg(filePath, outputZip, {
      dpi: '300'
    });

    await conn.sendFile(
      m.chat,
      outputZip,
      'pdf-pages.zip',
      `✅ *Conversion Complete!*

Your PDF has been successfully converted into JPG images.

The ZIP archive contains one JPG image for each page.`,
      m
    );

    await m.react('✅');
  } catch (e) {
    console.error(e);
    await m.react('❌');
    throw `Conversion failed.\n\n${e.message || e}`;
  } finally {
    if (m.quoted && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(outputZip)) fs.unlinkSync(outputZip);
  }
};

async function getPublicToken() {
  const res = await axios.get('https://www.ilovepdf.com/pdf_to_jpg', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
    }
  });

  const match = res.data.match(/"token":"([^"]+)"/);

  if (!match) throw new Error('Unable to obtain public token.');

  return match[1];
}

async function startTask(token) {
  const res = await axios.get(`${BASE}/v1/start/pdfjpg`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return {
    server: `https://${res.data.server}`,
    task: res.data.task
  };
}

async function uploadFile(server, task, token, filePath) {
  const form = new FormData();

  form.append('task', task);
  form.append(
    'file',
    fs.createReadStream(filePath),
    path.basename(filePath)
  );

  const res = await axios.post(`${server}/v1/upload`, form, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...form.getHeaders()
    }
  });

  return res.data.server_filename;
}

async function processTask(
  server,
  task,
  token,
  serverFilename,
  originalName,
  mode = 'pages',
  dpi = '300'
) {
  const form = new FormData();

  form.append('task', task);
  form.append('tool', 'pdfjpg');
  form.append('pdfjpg_mode', mode);
  form.append('dpi', dpi);
  form.append('output_filename', '{filename}_page');
  form.append('packaged_filename', 'pdf-pages');
  form.append('files[0][server_filename]', serverFilename);
  form.append('files[0][filename]', originalName);

  await axios.post(`${server}/v1/process`, form, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...form.getHeaders()
    }
  });
}

async function downloadResult(server, task, token, outputPath) {
  const res = await axios.get(`${server}/v1/download/${task}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(outputPath, res.data);
}

async function pdfToJpg(
  filePath,
  outputPath = 'output.zip',
  {
    mode = 'pages',
    dpi = '300'
  } = {}
) {
  const token = await getPublicToken();

  const { server, task } = await startTask(token);

  const serverFilename = await uploadFile(
    server,
    task,
    token,
    filePath
  );

  await processTask(
    server,
    task,
    token,
    serverFilename,
    path.basename(filePath),
    mode,
    dpi
  );

  await downloadResult(server, task, token, outputPath);
}

handler.help = ['pdf2jpg']
handler.command = ['pdf2jpg'];
handler.tags = ['tools'];
handler.limit = false;
export default handler;
