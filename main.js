// ═══════════════════════════════════════════════════════════════
// main.js — المُشغّل الرئيسي | بنية معيارية (Modular Architecture)
// ═══════════════════════════════════════════════════════════════

import './config.js';

import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { parentPort } from 'worker_threads';
import { createRequire } from 'module';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { format } from 'util';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import useSQLiteAuthState from './lib/useSQLite.js';
import {
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} from 'baileys';

// ─────────────────────────────────────────────
// [A] التهيئة الأساسية
// ─────────────────────────────────────────────
protoType();
serialize();

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// ✅ FadeHost: القراءة من /app، الكتابة في /data
const WRITABLE = process.env.WRITABLE_DIR || '/data';

const PATHS = {
    sessions: path.join(WRITABLE, 'sessions'),
    database: path.join(WRITABLE, 'database.json'),
    plugins: path.join(ROOT, 'plugins'),
    tmp: path.join(WRITABLE, 'tmp'),
};

fs.mkdirSync(PATHS.sessions, { recursive: true });
fs.mkdirSync(PATHS.tmp, { recursive: true });

console.log(chalk.cyan(`[PATHS] writable=${WRITABLE}`));
console.log(chalk.cyan(`[PATHS] sessions=${PATHS.sessions}`));
console.log(chalk.cyan(`[PATHS] database=${PATHS.database}`));

global.__filename = function (p = import.meta.url, stripPrefix = process.platform !== 'win32') {
    if (stripPrefix) return /^file:\/\//.test(p) ? fileURLToPath(p) : p;
    return pathToFileURL(p).toString();
};
global.__dirname = (p) => path.dirname(global.__filename(p));
global.__require = (p = import.meta.url) => createRequire(p);

global.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#%^&.©^]/;
global.version = global.version || '3.0.0';
global.wm = global.wm || global.namebot || 'Bot';
global.nameowner = global.nameowner || global.owner?.[0]?.[1] || 'Owner';

// ─────────────────────────────────────────────
// [B] طبقة قاعدة البيانات
// ─────────────────────────────────────────────
const DB = (() => {
    const shape = () => ({ users: {}, chats: {}, stats: {}, settings: {}, sticker: {} });
    let _data = null;
    let _timer = null;
    let _writing = false;
    let _dirty = false;

    function read() {
        let parsed = {};
        try {
            if (fs.existsSync(PATHS.database)) {
                parsed = JSON.parse(fs.readFileSync(PATHS.database, 'utf8') || '{}');
            }
        } catch (e) {
            console.error(chalk.red('[DB] قراءة فاشلة:'), e.message);
            try { fs.copyFileSync(PATHS.database, `${PATHS.database}.corrupt-${Date.now()}.bak`); } catch {}
        }
        _data = { ...shape(), ...parsed };
        return _data;
    }

    function markDirty() {
        _dirty = true;
        if (_timer) return;
        _timer = setTimeout(() => { _timer = null; flush(); }, 5000);
    }

    function flush() {
        if (!_data || !_dirty || _writing) return;
        _writing = true;
        _dirty = false;
        const temp = `${PATHS.database}.tmp`;
        try {
            fs.writeFileSync(temp, JSON.stringify(_data));
            fs.renameSync(temp, PATHS.database);
        } catch (e) {
            console.error(chalk.red('[DB] كتابة فاشلة:'), e.message);
            _dirty = true;
        } finally {
            _writing = false;
        }
    }

    return { read, markDirty, flush, get data() { return _data; }, set data(v) { _data = v; } };
})();

global.db = DB;
global.loadDatabase = async () => {
    if (global.db.data !== null) return global.db.data;
    return global.db.read();
};
await global.loadDatabase();

setInterval(() => global.db.markDirty(), 30_000).unref?.();

// ─────────────────────────────────────────────
// [C] مدير الإضافات
// ─────────────────────────────────────────────
const PluginManager = (() => {
    const loaded = {};
    const debounce = {};
    const isJs = (n) => n.endsWith('.js');

    async function load(file) {
        const full = path.join(PATHS.plugins, file);
        const err = syntaxerror(fs.readFileSync(full, 'utf8'), file, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
        });
        if (err) {
            console.error(chalk.red(`[PLUGIN] خطأ صياغة في ${file}:\n${format(err)}`));
            return false;
        }
        try {
            const mod = await import(`${pathToFileURL(full).href}?t=${Date.now()}`);
            loaded[file] = mod.default || mod;
            return true;
        } catch (e) {
            console.error(chalk.red(`[PLUGIN] فشل تحميل ${file}:`), e);
            delete loaded[file];
            return false;
        }
    }

    async function loadAll() {
        const files = fs.readdirSync(PATHS.plugins).filter(isJs);
        let ok = 0;
        for (const f of files) if (await load(f)) ok++;
        console.log(chalk.green(`[PLUGIN] ${ok}/${files.length} محمّلة`));
    }

    function watch() {
        fs.watch(PATHS.plugins, (event, file) => {
            if (!file || !isJs(file)) return;
            clearTimeout(debounce[file]);
            debounce[file] = setTimeout(async () => {
                const full = path.join(PATHS.plugins, file);
                if (!fs.existsSync(full)) {
                    if (file in loaded) {
                        delete loaded[file];
                        console.log(chalk.yellow(`[PLUGIN] حُذفت ${file}`));
                    }
                    return;
                }
                const existed = file in loaded;
                if (await load(file)) {
                    console.log(chalk.cyan(`[PLUGIN] ${existed ? 'حُدّثت' : 'أُضيفت'} ${file}`));
                }
            }, 400);
        });
    }

    return { loaded, loadAll, watch };
})();

global.plugins = PluginManager.loaded;
await PluginManager.loadAll();
PluginManager.watch();

// ─────────────────────────────────────────────
// [D] المسجّل الصامت
// ─────────────────────────────────────────────
const SILENT = {
    level: 'silent',
    trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
    child() { return SILENT; },
};

// ─────────────────────────────────────────────
// [E] وحدة الاتصال
// ─────────────────────────────────────────────
const Connection = (() => {
    const usePairing = Boolean(global.pairingNumber);
    let reconnecting = false;
    let reconnectAttempts = 0;
    let handlerModule = null;
    let firstBind = true;

    async function loadHandler(force = false) {
        if (!handlerModule || force) {
            try {
                handlerModule = await import(`./handler.js?t=${Date.now()}`);
            } catch (e) {
                console.error(chalk.red('[HANDLER] فشل الاستيراد:'), e);
                if (!handlerModule) throw e;
            }
        }
        return handlerModule;
    }

    async function bind(conn) {
        const hm = await loadHandler(firstBind === false);

        if (!firstBind) {
            if (conn.handler) conn.ev.off('messages.upsert', conn.handler);
            if (conn.participantsUpdate) conn.ev.off('group-participants.update', conn.participantsUpdate);
            if (conn.groupsUpdate) conn.ev.off('groups.update', conn.groupsUpdate);
            if (conn.onDelete) conn.ev.off('message.delete', conn.onDelete);
        }

        conn.handler = hm.handler?.bind(conn);
        conn.participantsUpdate = hm.participantsUpdate?.bind(conn);
        conn.groupsUpdate = hm.groupsUpdate?.bind(conn);
        conn.onDelete = hm.deleteUpdate?.bind(conn);

        if (conn.handler) conn.ev.on('messages.upsert', conn.handler);
        if (conn.participantsUpdate) conn.ev.on('group-participants.update', conn.participantsUpdate);
        if (conn.groupsUpdate) conn.ev.on('groups.update', conn.groupsUpdate);
        if (conn.onDelete) conn.ev.on('message.delete', conn.onDelete);

        firstBind = false;
    }

    async function handleCall(calls) {
        try {
            const conn = global.conn;
            const s = global.db.data?.settings?.[conn.user.jid];
            if (!s?.anticall) return;
            for (const c of calls) {
                if (c.status !== 'offer' || c.fromMe) continue;
                await conn.rejectCall(c.id, c.from).catch(() => {});
            }
        } catch (e) { console.error(e); }
    }

    function onUpdate(update) {
        const { connection, lastDisconnect, isNewLogin } = update;
        const conn = global.conn;

        if (isNewLogin) conn.isInit = true;

        if (connection === 'open') {
            conn.user.jid = conn.decodeJid(conn.user.id);
            reconnecting = false;
            reconnectAttempts = 0;
            console.log(chalk.green(`✅ متصل كـ ${conn.user.jid}`));
            setTimeout(() => (conn.isInit = false), 15_000);
            return;
        }

        if (connection === 'close') {
            const statusCode =
                lastDisconnect?.error?.output?.statusCode ??
                lastDisconnect?.error?.data?.statusCode;
            const reason = DisconnectReason[statusCode] || 'unknown';
            console.log(chalk.yellow(`🔌 الاتصال مغلق (${statusCode} - ${reason})`));

            // 401 = loggedOut -> لا نعيد الاتصال
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log(chalk.red('⛔ تم تسجيل الخروج. احذف sessions/ وأعد التشغيل.'));
                return;
            }

            // 440 = connectionReplaced -> لا نعيد الاتصال
            if (statusCode === DisconnectReason.connectionReplaced || statusCode === 440) {
                console.log(chalk.red('⚠️ الجلسة استُبدلت. أغلق الجلسة الأخرى.'));
                return;
            }

            // أي رمز آخر (بما في ذلك 428) -> إعادة اتصال فقط
            return reconnect();
        }
    }

    function reconnect() {
        if (reconnecting) return;
        reconnecting = true;
        const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), 60_000);
        reconnectAttempts++;
        console.log(chalk.cyan(`⏳ إعادة الاتصال خلال ${Math.round(delay / 1000)}s (المحاولة ${reconnectAttempts})`));

        try {
            global.conn?.ev?.removeAllListeners();
            global.conn?.ws?.close?.();
        } catch {}

        setTimeout(async () => {
            reconnecting = false;
            try { await start(); } catch (e) {
                console.error(chalk.red('❌ إعادة الاتصال فشلت:'), e);
                reconnect();
            }
        }, delay);
    }

    async function start() {
        const { state, saveCreds } = await useSQLiteAuthState(PATHS.sessions);
        let version;
        try { ({ version } = await fetchLatestBaileysVersion()); } catch {}

        const opts = {
            ...(version ? { version } : {}),
            logger: SILENT,
            printQRInTerminal: !usePairing,
            browser: Browsers.ubuntu('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, SILENT),
            },
            markOnlineOnConnect: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            getMessage: async (key) => {
                const msg = global.conn?.loadMessage?.(key.id);
                return msg?.message || undefined;
            },
        };

        const cachedChats = global.conn ? global.conn.chats : {};
        const conn = (global.conn = makeWASocket(opts, { chats: cachedChats }));
        conn.isInit = true;

        if (usePairing && !conn.authState.creds.registered) {
            const num = String(global.pairingNumber).replace(/\D/g, '');
            setTimeout(async () => {
                if (conn.authState.creds.registered) return;
                try {
                    const code = await conn.requestPairingCode(num);
                    console.log(
                        chalk.black(chalk.bgGreen(' 🔑 كود الاقتران ')),
                        chalk.white(code?.match(/.{1,4}/g)?.join('-') || code)
                    );
                } catch (e) {
                    console.error(chalk.red('❌ فشل طلب كود الاقتران:'), e?.message || e);
                }
            }, 5000);
        }

        conn.ev.on('creds.update', saveCreds);
        conn.ev.on('connection.update', onUpdate);
        conn.ev.on('call', handleCall);

        await bind(conn);

        global.reloadHandler = async () => {
            await bind(conn);
            return 'handler reloaded';
        };

        return conn;
    }

    return { start };
})();

// ─────────────────────────────────────────────
// [F] تنظيف الملفات المؤقتة
// ─────────────────────────────────────────────
setInterval(() => {
    try {
        const now = Date.now();
        for (const file of fs.readdirSync(PATHS.tmp)) {
            const full = path.join(PATHS.tmp, file);
            try {
                const st = fs.statSync(full);
                if (st.isFile() && now - st.mtimeMs > 30 * 60_000) fs.unlinkSync(full);
            } catch {}
        }
    } catch {}
}, 10 * 60_000).unref?.();

// ─────────────────────────────────────────────
// [G] الأمان
// ─────────────────────────────────────────────
const safeFlush = () => { try { global.db.flush(); } catch {} };

process.on('exit', safeFlush);
process.on('SIGINT', () => { safeFlush(); process.exit(0); });
process.on('SIGTERM', () => { safeFlush(); process.exit(0); });
process.on('unhandledRejection', (r) => console.error(chalk.red('[UNHANDLED]'), r));
process.on('uncaughtException', (e) => console.error(chalk.red('[UNCAUGHT]'), e));

parentPort?.on('message', (cmd) => {
    if (cmd === 'save' || cmd === 'flush') {
        global.db.flush();
        console.log('[DB] saved');
    }
});

// ─────────────────────────────────────────────
// [H] الإقلاع
// ─────────────────────────────────────────────
await Connection.start();
