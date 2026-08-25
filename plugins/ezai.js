import crypto from 'crypto';

const API_HOST = 'https://api-v1.ezmaker.ai';
const CDN_PREFIX = 'https://temp.ezmaker.ai/';
const BRAND_ID = 37;
const ORIGIN_FROM = crypto
  .createHash('md5')
  .update('ezmaker.ai')
  .digest('hex')
  .substring(8, 24);

const FS = 'aifaceswap';
const WP = '1H5tRtzsBkqXcaJ';

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCwlO+boC6cwRo3UfXVBadaYwcX
0zKS2fuVNY2qZ0dgwb1NJ+/Q9FeAosL4ONiosD71on3PVYqRUlL5045mvH2K9i8b
AFVMEip7E6RMK6tKAAif7xzZrXnP1GZ5Rijtqdgwh+YmzTo39cuBCsZqK9oEoeQ3
r/myG9S+9cR5huTuFQIDAQAB
-----END PUBLIC KEY-----`;

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'theme-version':
    '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q',
};

function randStr(length) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function randHex(length) {
  const chars = '0123456789abcdef';

  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function rsaEncryptB64(text) {
  const encrypted = crypto.publicEncrypt(
    {
      key: PUBLIC_KEY_PEM,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(text, 'utf8')
  );

  return encrypted.toString('base64');
}

function aesCbcB64(data, key, iv) {
  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    Buffer.from(key, 'utf8'),
    Buffer.from(iv, 'utf8')
  );

  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);

  return encrypted.toString('base64');
}

function signx() {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const aesSecret = randStr(16);
  const secretKey = rsaEncryptB64(aesSecret);

  const payload = `${FS}:${WP}:${timestamp}:${nonce}:${secretKey}`;

  aesCbcB64(payload, aesSecret, aesSecret);

  return {
    secret_key: secretKey,
    aesSecret,
  };
}

function signux() {
  const nonce = crypto.randomUUID();
  const aesSecret = randStr(16);
  const secretKey = rsaEncryptB64(aesSecret);

  const payload = `${FS}:${nonce}:${secretKey}`;
  const sign = aesCbcB64(payload, aesSecret, aesSecret);

  return {
    secret_key: secretKey,
    sign,
  };
}

function fpHeaders(mu, signing) {
  const fp1 = aesCbcB64(
    `${FS}:${mu}`,
    signing.aesSecret,
    signing.aesSecret
  );

  return {
    fp: mu,
    fp1,
    'x-guide': signing.secret_key,
  };
}

function uploadHeaders(signing) {
  return {
    'x-guide': signing.secret_key,
    'x-sign': signing.sign,
  };
}

async function postJson(path, body, headers = {}) {
  const response = await fetch(API_HOST + path, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      ...headers,
      'Content-Type': 'application/json',
      'X-code': String(Date.now()),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok && data.code !== 200) {
    throw new Error(
      `HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function createTask(fnName, input, mu) {
  const signing = signx();

  const body = {
    fn_name: fnName,
    call_type: 3,
    input,
    request_from: BRAND_ID,
    origin_from: ORIGIN_FROM,
  };

  const data = await postJson(
    '/aitools/of/create',
    body,
    fpHeaders(mu, signing)
  );

  if (data.code !== 200) {
    throw new Error(`Create task failed: ${JSON.stringify(data)}`);
  }

  return data.data.task_id;
}

async function checkStatus(taskId, fnName, mu) {
  const signing = signx();

  const body = {
    task_id: taskId,
    fn_name: fnName,
    call_type: 3,
    consume_type: 0,
    request_from: BRAND_ID,
    origin_from: ORIGIN_FROM,
  };

  return postJson(
    '/aitools/of/check-status',
    body,
    fpHeaders(mu, signing)
  );
}

async function uploadImage(buffer, filename = 'input.jpg') {
  const signing = signux();

  const form = new FormData();

  form.append(
    'file',
    new Blob([buffer]),
    filename
  );

  const response = await fetch(
    API_HOST + '/api/aikit/upload_img',
    {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        ...uploadHeaders(signing),
      },
      body: form,
    }
  );

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(
      `Image upload failed: ${JSON.stringify(data)}`
    );
  }

  return data.data.path;
}

async function pollUntilDone(
  taskId,
  fnName,
  mu,
  timeoutMs = 300000,
  intervalMs = 3000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await checkStatus(
      taskId,
      fnName,
      mu
    );

    const data = response.data || {};
    const status = data.status;

    let result = data.result_image;

    if (result) {
      if (Array.isArray(result)) {
        result = result[0];
      }

      if (String(result).startsWith('http')) {
        return result;
      }

      return CDN_PREFIX + result;
    }

    if (
      status === 3 ||
      status === 'FAILED' ||
      status === 'FAIL'
    ) {
      throw new Error(
        `Generation failed: ${JSON.stringify(data)}`
      );
    }

    await new Promise(resolve =>
      setTimeout(resolve, intervalMs)
    );
  }

  throw new Error('Generation timed out.');
}

async function textToImage(prompt, aspectRatio = '1:1') {
  const fnName = 'demo-ez-text2image';
  const mu = randHex(32);

  const input = {
    prompt,
    aspect_ratio: aspectRatio,
    request_from: BRAND_ID,
  };

  const taskId = await createTask(
    fnName,
    input,
    mu
  );

  return pollUntilDone(
    taskId,
    fnName,
    mu
  );
}

async function imageToImage(
  imageBuffer,
  prompt,
  aspectRatio = '1:1',
  filename = 'input.jpg'
) {
  const fnName = 'demo-img2img';
  const mu = randHex(32);

  const imagePath = await uploadImage(
    imageBuffer,
    filename
  );

  const input = {
    mode: 'Single Edit',
    source_images: [imagePath],
    prompt,
    aspect_ratio: aspectRatio,
    request_from: BRAND_ID,
  };

  const taskId = await createTask(
    fnName,
    input,
    mu
  );

  return pollUntilDone(
    taskId,
    fnName,
    mu
  );
}

async function sendGeneratedImage(
  conn,
  jid,
  url,
  caption
) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download generated image: HTTP ${response.status}`
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  await conn.sendMessage(jid, {
    image: buffer,
    caption,
  });
}

let handler = async (m, { conn, text }) => {
  const args = text?.trim().split(/\s+/) || [];

  if (!args.length) {
    return m.reply(
      `*EzMaker AI — Text to Image & Image to Image*

Usage:

• Text to Image
.ezai text <prompt>

Example:
.ezai text a futuristic city at sunset, cinematic lighting

• Image to Image
Reply to an image with:
.ezai image <prompt>

Example:
.ezai image turn this photo into a cinematic anime illustration

Optional aspect ratio:
.ezai text <prompt> --ratio 16:9

Supported ratios:
1:1
9:16
16:9
3:4
4:3`
    );
  }

  const mode = args.shift().toLowerCase();

  const ratioIndex = args.indexOf('--ratio');

  let ratio = '1:1';

  if (ratioIndex !== -1) {
    ratio = args[ratioIndex + 1] || '1:1';
    args.splice(ratioIndex, 2);
  }

  const validRatios = [
    '1:1',
    '9:16',
    '16:9',
    '3:4',
    '4:3',
  ];

  if (!validRatios.includes(ratio)) {
    return m.reply(
      `Invalid aspect ratio.

Available ratios:
${validRatios.join(', ')}`
    );
  }

  const prompt = args.join(' ').trim();

  if (!prompt) {
    return m.reply(
      mode === 'image'
        ? 'Please provide a prompt.\n\nExample:\n.ezai image make this photo look cinematic'
        : 'Please provide a prompt.\n\nExample:\n.ezai text a beautiful cyberpunk city at night'
    );
  }

  try {
    if (mode === 'text') {
      await m.reply(
        '🎨 Generating your image...\n\nPlease wait.'
      );

      const result = await textToImage(
        prompt,
        ratio
      );

      await sendGeneratedImage(
        conn,
        m.chat,
        result,
        `✨ Generated with EzMaker AI\n\nPrompt: ${prompt}\nRatio: ${ratio}`
      );

      return;
    }

    if (mode === 'image') {
      const quoted = m.quoted;

      if (!quoted) {
        return m.reply(
          'Please reply to an image with this command:\n\n.ezai image <prompt>'
        );
      }

      const mime =
        quoted.mimetype ||
        quoted.msg?.mimetype ||
        '';

      if (!mime.startsWith('image/')) {
        return m.reply(
          'The message you replied to is not an image.'
        );
      }

      await m.reply(
        '🖼️ Processing your image...\n\nPlease wait.'
      );

      /*
       * Most Baileys-based bot frameworks expose
       * download() on quoted messages.
       */
      const imageBuffer = await quoted.download();

      if (!imageBuffer) {
        throw new Error(
          'Unable to download the source image.'
        );
      }

      const extension =
        mime.split('/')[1] || 'jpg';

      const result = await imageToImage(
        imageBuffer,
        prompt,
        ratio,
        `input.${extension}`
      );

      await sendGeneratedImage(
        conn,
        m.chat,
        result,
        `✨ Image edited with EzMaker AI\n\nPrompt: ${prompt}\nRatio: ${ratio}`
      );

      return;
    }

    return m.reply(
      `Unknown mode: ${mode}

Available modes:
• text
• image

Example:
.ezai text a dragon flying over a city

Or reply to an image:
.ezai image turn this into an oil painting`
    );
  } catch (error) {
    console.error('[EzMaker]', error);

    return m.reply(
      `❌ EzMaker failed.

Reason:
${error?.message || 'Unknown error'}

Please try again later.`
    );
  }
};

handler.help = handler.command = ['ezai'];
handler.tags = ['ai'];
handler.limit = false;

export default handler;
