import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import FormData from 'form-data'

const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  origin: 'https://prithivmlmods-qwen-image-edit-object-manipulator.hf.space',
  referer: 'https://prithivmlmods-qwen-image-edit-object-manipulator.hf.space/',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty'
}

const MODELS = {
  add: 'Qwen-Image-Edit-2511-Object-Adder',
  remove: 'Qwen-Image-Edit-2511-Object-Remover',
  remove2: 'QIE-2511-Object-Remover-v2',
  zoom: 'Zoom-Master',
  outfit: 'Extract-Outfit',
  layout: 'Outfit-Design-Layout'
}

async function uploadImage(file) {
  const uploadId = randomBytes(5).toString('hex')

  const form = new FormData()
  form.append('files', fs.createReadStream(file), {
    filename: path.basename(file),
    contentType: 'image/jpeg'
  })

  const { data } = await axios.post(
    `https://prithivmlmods-qwen-image-edit-object-manipulator.hf.space/gradio_api/upload?upload_id=${uploadId}`,
    form,
    {
      headers: {
        ...headers,
        ...form.getHeaders(),
        accept: '*/*'
      }
    }
  )

  return data[0]
}

async function qwenImageEdit(file, prompt, model) {
  const sessionHash = randomBytes(5).toString('hex')

  const uploaded = await uploadImage(file)

  const filename = path.basename(uploaded)

  const fileUrl =
    `https://prithivmlmods-qwen-image-edit-object-manipulator.hf.space/gradio_api/file=${uploaded}`

  const {
    data: { event_id }
  } = await axios.post(
    'https://prithivmlmods-qwen-image-edit-object-manipulator.hf.space/gradio_api/queue/join',
    {
      data: [
        [
          {
            image: {
              path: uploaded,
              url: fileUrl,
              size: null,
              orig_name: filename,
              mime_type: 'image/jpeg',
              is_stream: false,
              meta: {
                _type: 'gradio.FileData'
              }
            },
            caption: null
          }
        ],
        prompt,
        model,
        0,
        true,
        1,
        4
      ],
      fn_index: 1,
      trigger_id: 8,
      session_hash: sessionHash
    },
    {
      headers: {
        ...headers,
        'content-type': 'application/json',
        'x-gradio-user': 'app'
      }
    }
  )

  return await new Promise((resolve, reject) => {
    let buffer = ''

    axios
      .get(
        `https://prithivmlmods-qwen-image-edit-object-manipulator.hf.space/gradio_api/queue/data?session_hash=${sessionHash}`,
        {
          headers: {
            ...headers,
            accept: 'text/event-stream'
          },
          responseType: 'stream'
        }
      )
      .then(res => {
        res.data.on('data', chunk => {
          buffer += chunk.toString()

          const lines = buffer.split('\n')

          buffer = lines.pop()

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const json = JSON.parse(line.slice(6))

              if (
                json.msg === 'process_completed' &&
                json.event_id === event_id
              ) {
                resolve(json.output.data[0])
              }
            } catch {}
          }
        })

        res.data.on('end', () =>
          reject(new Error('Generation failed.'))
        )

        res.data.on('error', reject)
      })
      .catch(reject)
  })
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const quoted = m.quoted || m
  const mime = quoted.mimetype || ''

  if (!/image/i.test(mime)) {
    throw `
🖼️ *Qwen AI Image Editor*

Edit an image using powerful Qwen AI models.

Usage:

Reply to an image with:

${usedPrefix + command} <model>|<prompt>

Example:

${usedPrefix + command} add|Add sunglasses

Available models:

• add
• remove
• remove2
• zoom
• outfit
• layout
`.trim()
  }

  if (!text || !text.includes('|')) {
    throw `
Please specify a model and prompt.

Example:

${usedPrefix + command} add|Add a black hat
`.trim()
  }

  const [modelKey, ...promptArr] = text.split('|')

  const prompt = promptArr.join('|').trim()

  const model = MODELS[modelKey.toLowerCase()]

  if (!model) {
    throw `Invalid model.

Available models:

${Object.keys(MODELS).join('\n')}`
  }

  let file

  try {
    await m.react('⏳')

    const buffer = await quoted.download()

    file = `./tmp/qwen_${Date.now()}.jpg`

    fs.writeFileSync(file, buffer)

    await conn.reply(
      m.chat,
      '🎨 Editing your image with AI...\n\nThis may take a few moments.',
      m
    )

    const result = await qwenImageEdit(file, prompt, model)

    await conn.sendMessage(
      m.chat,
      {
        image: {
          url: result.url
        },
        caption:
`✨ *Qwen AI Image Editor*

✅ Image edited successfully.

🧠 Model:
${model}

📝 Prompt:
${prompt}`
      },
      {
        quoted: m
      }
    )

    await m.react('✅')
  } catch (e) {
    console.error(e)

    await m.react('❌')

    throw `Image editing failed.

${e.message || e}`
  } finally {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file)
    }
  }
}

handler.help = ['qwenedit']
handler.command = ['qwenedit']
handler.tags = ['editor']
handler.limit = false
export default handler
                         
