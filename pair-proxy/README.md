# silana-pair

Clean-domain front for the **Silana sub-bot pairing page**.

This repo holds no app code — `vercel.json` rewrites every request to the
Silana pairing server running on the bot's panel host
(`panel.slowdy.tech:25565`), so visitors get a short HTTPS address
(`silana-pair.vercel.app`) with no visible port, while the pairing page
itself is served by the Silana bot (pairpage plugin + serbot v7).

Deploy: import this repo in Vercel (framework: Other) — no build settings.
