// ==========================================
// Bot AI Plugin - Configured & Coded by: Hussein (Iraq)
// Official Gemini API Integration (Lightweight & Fast)
// ==========================================

import fetch from 'node-fetch';

const GEMINI_API_KEY = "AQ.Ab8RN6K_8f-mS2zcZwUnelfsJfZOz86XiyaV3YlmB0qYO4TVgA"; 

let globalAutoAi = false; // حالة التفعيل العامة

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) throw `*Example:* ${usedPrefix + command} on/off`;

  if (text === "on") {
    globalAutoAi = true;
    m.reply("[ ✓ ] Auto AI mode enabled (Official API + Private chats only).");
  } else if (text === "off") {
    globalAutoAi = false;
    m.reply("[ ✓ ] Auto AI mode disabled.");
  }
};

// 🧠 Auto AI reply logic باستخدام الـ API الرسمي وبدون ثقل
handler.before = async (m, { conn }) => {
  if (!globalAutoAi) return;
  if (m.isBaileys && m.fromMe) return;
  if (!m.text) return;
  if (m.isGroup) return; // يمنع البوت من الرد بالجروبات لحماية رقمك
  if (/^[.#/\\!]/.test(m.text)) return; // يتجاهل الأوامر الاعتيادية

  if (!GEMINI_API_KEY) {
    console.error("Gemini API Key is missing!");
    return;
  }

  try {
    // إظهار حالة جاري الكتابة لطابع بشري وحماية الحساب
    await conn.sendPresenceUpdate('composing', m.chat);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: m.text }]
        }]
      })
    });

    const data = await response.json();

    // التحقق من أن الاستجابة ناجحة من سيرفر جوجل
    if (!response.ok) {
      console.error("Gemini API Error Details:", data);
      return;
    }

    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (replyText) {
      await conn.reply(m.chat, replyText, m);
    }
  } catch (e) {
    console.error("AI Catch Error:", e);
  }
};

handler.command = ["autoai"];
handler.tags = ["ai"];
handler.help = ["autoai"];
handler.limit = false;

export default handler;
