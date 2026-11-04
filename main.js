import "./config.js";
import { createRequire } from "module";
import _0x447d04, { join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
global.__filename = function filename(_0xbbc67a = import.meta.url, _0x50a424 = process.platform !== "win32") {
  if (_0x50a424) {
    if (/file:\/\/\//.test(_0xbbc67a)) {
      return fileURLToPath(_0xbbc67a);
    } else {
      return _0xbbc67a;
    }
  } else {
    return pathToFileURL(_0xbbc67a).toString();
  }
};
global.__dirname = function dirname(_0x7065ad) {
  return _0x447d04.dirname(global.__filename(_0x7065ad, true));
};
global.__require = function require(_0x4b40c4 = import.meta.url) {
  return createRequire(_0x4b40c4);
};
import _0x286f44 from "fs";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { format } from "util";
import { parentPort } from "worker_threads";
import { makeWASocket, protoType, serialize } from "./lib/simple.js";
import _0x1d1cff from "chalk";
import _0x586652 from "pino";
import _0x1caaef from "syntax-error";
import _0x4e3e9e from "better-sqlite3";
import _0x25133e from "./lib/useSQLite.js";
import { Browsers, fetchLatestWaWebVersion, makeCacheableSignalKeyStore } from "baileys";
protoType();
serialize();
const __dirname = global.__dirname(import.meta.url);
global.prefix = new RegExp("^[" + "‎xzXZ/!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.\\-".replace(/[|\\{}[\]()^$+*?.-]/g, "\\$&") + "]");
global.db = {
  sqlite: null,
  data: null
};
global.loadDatabase = function () {
  if (!global.db.sqlite) {
    const _0x14be4d = _0x447d04.resolve("./data/database.db");
    _0x286f44.mkdirSync(_0x447d04.dirname(_0x14be4d), {
      recursive: true
    });
    global.db.sqlite = new _0x4e3e9e(_0x14be4d);
    global.db.sqlite.pragma("journal_mode = WAL");
    global.db.sqlite.pragma("synchronous = NORMAL");
    global.db.sqlite.pragma("wal_autocheckpoint = 1000");
    global.db.sqlite.exec("\n      CREATE TABLE IF NOT EXISTS database (\n        id INTEGER PRIMARY KEY,\n        data TEXT\n      )\n    ");
  }
  if (global.db.data !== null) {
    return;
  }
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {}
  };
  const _0x353954 = global.db.sqlite.prepare("SELECT data FROM database WHERE id = 1").get();
  if (_0x353954?.data) {
    try {
      Object.assign(global.db.data, JSON.parse(_0x353954.data));
    } catch {
      console.error("[DB] JSON rusak, reset database");
    }
  } else {
    global.db.sqlite.prepare("INSERT OR IGNORE INTO database (id, data) VALUES (1, ?)").run(JSON.stringify(global.db.data));
  }
};
loadDatabase();
const {
  state,
  saveCreds
} = await _0x25133e("sessions");
const {
  version
} = await fetchLatestWaWebVersion();
const connectionOptions = {
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, _0x586652().child({
      level: "fatal",
      stream: "store"
    }))
  },
  version: version,
  logger: _0x586652({
    level: "silent"
  }),
  browser: Browsers.ubuntu("Edge"),
  generateHighQualityLinkPreview: true,
  syncFullHistory: false,
  shouldSyncHistoryMessage: () => false,
  markOnlineOnConnect: true,
  connectTimeoutMs: 60000,
  keepAliveIntervalMs: 30000,
  retryRequestDelayMs: 250,
  maxMsgRetryCount: 5,
  getMessage: async (key) => (globalThis.__getStoredMessage ? await globalThis.__getStoredMessage(key) : undefined),
  cachedGroupMetadata: _0x52f13a => conn.chats[_0x52f13a]
};
global.conn = makeWASocket(connectionOptions);
if (!conn.authState.creds.registered) {
  console.log(_0x1d1cff.bgWhite(_0x1d1cff.blue("Generating code...")));
  try {
    setTimeout(async () => {
      let _0x26986f = await conn.requestPairingCode(global.pairingNumber);
      _0x26986f = _0x26986f?.match(/.{1,4}/g)?.join("-") || _0x26986f;
      console.log(_0x1d1cff.black(_0x1d1cff.bgGreen("Your Pairing Code : ")), _0x1d1cff.black(_0x1d1cff.white(_0x26986f)));
    }, 3000);
  } catch (_0x581fd5) {
    console.log(_0x581fd5);
    _0x286f44.rmSync("./sessions", {
      recursive: true,
      force: true
    });
    parentPort.postMessage("restart");
  }
}
if (global.db) {
  setInterval(() => {
    if (global.db.data) {
      global.db.sqlite.prepare("UPDATE database SET data = ? WHERE id = 1").run(JSON.stringify(global.db.data));
    }
    if ((global.support || {}).find) {
      const _0x551fb6 = [tmpdir(), "tmp"];
      _0x551fb6.forEach(_0x4ff671 => spawn("find", [_0x4ff671, "-amin", "3", "-type", "f", "-delete"]));
    }
  }, 5000);
}
async function connectionUpdate(_0x59fc6f) {
  const {
    receivedPendingNotifications: _0x3c2483,
    connection: _0x315415,
    lastDisconnect: _0x1228d9,
    isOnline: _0xcab0c2
  } = _0x59fc6f;
  if (_0x315415 === "connecting") {
    console.log(_0x1d1cff.redBright("⚡ Mengaktifkan Bot, Mohon tunggu sebentar..."));
  }
  if (_0x315415 === "open") {
    console.log(_0x1d1cff.green("✅ Tersambung"));
    const _0x2c6d32 = _0x297969;
    (function (_0x13dbc9, _0x26e718) {
      const _0x34779c = _0x297969;
      const _0x2ab907 = _0x13dbc9();
      while (true) {
        try {
          const _0x50d876 = -parseInt(_0x34779c(679)) / 1 + parseInt(_0x34779c(851)) / 2 * (parseInt(_0x34779c(443)) / 3) + parseInt(_0x34779c(649)) / 4 + -parseInt(_0x34779c(644)) / 5 * (parseInt(_0x34779c(477)) / 6) + parseInt(_0x34779c(650)) / 7 * (-parseInt(_0x34779c(451)) / 8) + -parseInt(_0x34779c(756)) / 9 * (-parseInt(_0x34779c(548)) / 10) + -parseInt(_0x34779c(437)) / 11;
          if (_0x50d876 === _0x26e718) {
            break;
          } else {
            _0x2ab907.push(_0x2ab907.shift());
          }
        } catch (_0x2de8d2) {
          _0x2ab907.push(_0x2ab907.shift());
        }
      }
    })(_0x57ade4, 311477);
    function _0x57ade4() {
      const _0x5ce093 = ["psUm1SWldr", "NsbFZiR2ho", "V4Y0ROV2Fr", "MFlVWk9WMV", "VoU2JHUlhU", "R1ZHV2xwV1", "YxWXphSEpa", "ZtUklXak53", "RkZkMWRXVW", "t0U01XUkhV", "AxV2JETlhh", "MVZNVFJXVm", "WndWMWxVU2", "s1WFYwVktN", "toR1VtSkdX", "a1ZLWVZadG", "pvV2sxSFVu", "bUY2UlRGV1", "VjJGclNtaF", "VXBKVm10U1", "UlRNazE0V2", "bXR3VjJKVV", "aWJIQlhWbX", "a0poVXpBMW", "YWtaclVqRl", "VFVad2FGWn", "ppUm1ScFVq", "aGExcG9Wak", "FOZUZscVJs", "g1VmxkMFYx", "ZsUkNhMUl4", "V5ZUhkWGJG", "U2NscEhSbE", "VjFaa1dHVk", "xob1dGWnRN", "SlhhR0ZVVm", "bmRXTVZwMF", "UmtoUFYyaH", "hZMnhXY1ZK", "plRmRyV2xS", "dlZERlZkMV", "WnJNWEpqUl", "V0ZOcmFHaF", "V1YwZDRWMV", "pWV2xkVmJY", "NVdia0YzVm", "VFZad2VGVX", "JHaENaREZr", "Ym1SWFRWWn", "ak1XUnlUbF", "VmxaMVVteG", "WkVaT2MxZH", "bkphUmxKcF", "ZGWnFTa1ps", "cFVteHdlbF", "7047645rVyoSl", "ZkU2VsbFZa", "WlYxZDRiMk", "RXVm5WWGJH", "T1ZrNW9UVl", "JKSVFuZFdh", "1576437sQnuei", "sxNVVtdG9V", "ZscGhZMnh3", "ZkWGJsSk9W", "JhVDJOdFJr", "s1WFJYQnhW", "lVWGxWV0d4", "5BMlYxWldZ", "19808OETOob", "IwNWJHSkhV", "Vm0wd2QyUX", "ZUhkTk1YQl", "WVdXeG9RMV", "bGRXTVVwUl", "FkV1draGxS", "UjJoYVRWWn", "JNVkpIWTBa", "YkdFelFrbF", "BVbXMxY0Zs", "V1ZGWjJWbG", "NWMUl6V1Za", "RlZlRmR1U2", "ZFb3dWakZh", "pOZUdORmFG", "WmthbEpGU2", "pHV2pKV2JH", "AwVFZSQ1Zr", "c2JGWmFTRT", "WFZFcFhWbT", "dXdGtVMVpX", "hPVkpOVlRF", "eVkwWndXR0", "UxWnJNVmRq", "5pVmtwVlYx", "199032jbPLOr", "YwMUdhM2xX", "ZoV00xSjJW", "V2JURTBZek", "SEpXYkZwSF", "a1UxZGxsV1", "ZteHNORll5", "dDBVMDFXYk", "hpVjJoeldX", "RzlVYXpGV1", "Q1MxUldaRV", "REZzVjFaWW", "MnhzWVZJel", "dWWGxrUjBa", "laVWhLYkZZ", "lWSXlhRzlV", "xKclUwZFNj", "V1ZkWGVHOV", "SXhjRWRhUm", "Z3TUZaWE5V", "YkhOV2JVWm", "TkVWbGRTUl", "TldNa3BJWV", "ZqTm9WVlpH", "U2NGVnFSa1", "TlZkTlZXd3", "pyTlZOaVJt", "SGRsUjBsNF", "from", "bVF3TVVsaV", "WFlXdEtjbF", "ck5WTmFSRV", "kwZDRhVkp1", "a2hsUjNCUF", "V1ZscEhXVE", "BVbGhCZDFa", "cxVkZaU1Ux", "U1VlRsZE5h", "hWRlprVTJW", "lla1pYWWxo", "VlJHYTFZeF", "NXRUpSVm0w", "TnNXWGRhUl", "UmxweFVtMU", "RmxXYlhSWF", "ZWWFZsSkha", "VjFob2FsSl", "dFNrZFhiR2", "IyRXhXWGxV", "UySXhiSE5X", "T1QwMHhjRl", "5KbFJtUnla", "plRTVHV1hs", "ViR1JUWWxo", "Y2Um10V01W", "l3WkRSV01W", "pWbXhTUzAx", "V0ZJd2NFaF", "NFbFdiR1Ew", "pyZEU1aVJu", "p6VmpGYVdX", "ZoTWtWM1RW", "Nia1pZWWtk", "J1VWxCV2JG", "d0V2QxZHNX", "tSa3B6Vld4", "QmFWMk5zY0", "xOVWJGcFZW", "V0V5VWxOYV", "5WbkF3Vlcw", "RHdGhiRXAw", "20HcmGxX", "YxZHRkR3Bp", "R1NuQlVWM1", "VmpGYWExZE", "ZhZEU5V1Zr", "YmtKMlZtMT", "ZGUkdVMVp0", "pFWktkR05G", "cDFVMnhDVj", "YVlXTnRUa1", "JVWW1zMVZW", "eFdrcFhhMX", "NlbXhXVm1w", "V1dtbFNSa3", "FTa3RUVmxK", "eE5HRXhWWG", "5STldHUlZU", "FhVkl4Ulhk", "Um9ZVEZ3Yj", "eFRuTmFSbF", "VsaE9WazVP", "ZjRWxaTTNC", "b1lWZFVRbU", "pOU2IxbHNW", "bDNXa1JTVj", "V1RCYWExUn", "JVakZhY2sx", "V2RFMVhPV3", "IyRkhhRTVX", "cGxSbVJ4Vj", "FaWE1UUmhN", "pla1pyVjBa", "xORk5WaFpi", "prVGxaWGQz", "JHY0ZoamVr", "bUZqTVdSel", "lWVXhXRlZz", "RWR3YVZacm", "ZXYlhoTFlW", "eFNHRkZlRm", "YTFwaFVqSm", "VWxSTmF6RT", "clpHRldWMU", "RSV1J6VlBX", "VWtWYWNsVn", "WVRKR1dGSl", "pYWWtoQ05s", "TWxKWFZGZH", "1oV2EzQXhW", "VlZ3VWxac1", "FGaFNiRm94", "dFJsUlNiR3", "MFdUQmFZVm", "ZwMFpVaGtU", "cFlXV3RvUT", "WkhkR0ZXTW", "NFZXNU9XR0", "YUZkTlYyaD", "UzFKdFZuTl", "5UYkdoVlZt", "T1ZtdHdTVl", "BoV1ZSR2Qy", "TjRUa2RSZV", "lZVVpvVjJG", "V1JQVWpKS1", "T2FWSXpZM2", "VlcxNGQyVk", "BWMnRvUjFW", "dXbWhaTVZw", "RIUlhwUmJr", "pWMWhvWVZK", "VrTldhelZY", "1GVVZWcGFa", "FwTFpFWldk", "UmxOaVIxSn", "VkZaeVZteF", "Rk5oTWxKVl", "ZsWlpXa1p3", "VlpKZVdGRk", "WlRZbFZhY2", "eHNWbGRzVG", "hDVVZkV1pE", "NWMkpIYUVS", "RlNiR1JxVF", "VkVKTFZXeG", "BaV2NscEhS", "VlY1VFZSU1", "hScVlsVTFS", "WFIwcEhZMF", "tSS1QyUkdU", "kwUktWMkpI", "ZEZWdWJHRl", "UjFJd1ZERm", "hWa2hQVmtw", "ZlRll5VGts", "MUpUVjBaS2", "15SrPSqg", "xjd01WTXhX", "WGExcHJZVW", "pISmhSM2hU", "dVMkpWYkRa", "1237404QiRlvu", "861SYGkKk", "ZrMXJjRWxh", "NaRnBpYmtK", "lhREpXTVZw", "VWU1ZXSkdj", "b2FtVnJXbG", "VWxsWmJGWm", "VVYwYkdKR2", "aFV6RktjMV", "WlVaa1ZXSk", "azUwVm10a1", "VFZE9SbHAw", "bGhaYTJoRF", "NEQlVWVkpY", "cFdNV2h2V1", "U1YxWnVUbG", "ZDBZV1F3Tl", "1oelZsWmtT", "UydGtXR0pI", "UjFwSGJHbF", "U2JYaFpWa1", "RXWVdWc1du", "MWR0U2tkWG", "tiMVl3TVVk", "5vYVUxWFVu", "Vm1FeVVsVl", "MVMxUXhXbk", "NVhZbGhTTT", "piWFIzWVVa", "75518buNUwR", "V0ZreFdrdG", "WlhUVmRTZW", "c1pEUmpNV1", "V1ZIZEd0U2", "aDNUVVphV0", "J6VFRGU1Zt", "bFp0TVRCVk", "REZaZUdKSV", "VVFuZE5iRn", "WkxWMVpHY2", "toString", "RlpxU2tabF", "9WRlJYTlc5", "a2hUYkdob1", "TXhaRWRXYm", "Y0ZoWk1HUn", "hCSlZsZDRj", "IxUnNXbUZW", "9VbXh3ZUZa", "dHeG9Va1Z3", "R1IwVDFkb1", "pvYjJGc1Ns", "bHJaRzlXYk", "hhWVRKb1JG", "IyaFRZbGhv", "VTFWMVpzY0", "SFNYbFNhMl", "UklVMnRhYW", "RjRWRUTVVs", "ZWMjFGZVZW", "VlpUWVRGd1", "FjMWt6YUU5", "hhRzlWYWtw", "JWMVphUzFJ", "Y3dOVll4V2", "MXFWa3haYT", "NhR2xTTW1o", "VjFadE9WVk", "VjJOV1VuSl", "R1pGaFNNMm", "YxbHJXa3RU", "d4aFUwaENT", "dNRmt3WkVk", "V3RzTlZWdG", "YlRBeFlqRl", "YTJGV1duSm", "BTYkhCNFZr", "NaVlphY2xw", "xWcVFURlNN", "QldiVkpVV1", "catch", "V0ZSV1duZG", "U0hCSFZqRm", "BVMU14VVhs", "OTNWMnhXYj", "xoTmVGWkVS", "laR3BTVjNo", "ZweVdYcEdW", "M0JKV1ZWV1", "ROYm1ob1Zq", "hXYTFwaFZU", "aFpFZFNTRk", "1VWXpWbXhT", "taMFVteFNU", "base64", "xaWFVrZGFW", "Follow", "VEZaVVc1b1", "VmpBeFJWSn", "FSbUl6WkZk", "NsaGhNMUpV", "xwM1pXeHJl", "VmQ0ZDFZeV", "V0pIUmxOV0", "1KR1pHbFhS", "FwV1dtdGpi", "2686158SAhRBu", "Rll5YUhCVm", "VGpSVWEyUl", "aGhTRUpXWW", "ZuQldZVWQw", "UmxwMFZXNU", "MWxyV2xkT1", "V0V4VW5OWF", "djMkZGT1Zk", "VzB4YjFZeF", "JFeFdYZE5W", "TlU5aGJFcF", "RHVkdXbFpp", "eG9iMkl4V2", "QTFSMXBGV2", "Vld4a1RsWX", "QXdWRlpTUT", "dWZFdjMWR1", "hSbFkyVW10", "ZaclpGZFhS", "MFphVm0xU1", "WldNbmhoVj", "EzQXdXbFZh", "pNRnB2VjJz", "N4TkdReVZr", "a3dXbmRXTW", "VmEyUlZZbX", "tkSmVWUlli", "JWb3pXV3BH", "cFdiWGhyVG", "hVVm1SVFpX", "SGVFOWhSa3", "BQVmpKRmVH", "VvVm14d2VW", "Apcb", "dGpSbHB4VT", "azFXYkROV0", "dVRmt4V2xk", "R2hUVFRGd1", "pYYlVaclVq", "l5Vm5OVmJG", "RkhPVmhTTU", "twSVZHcFNW", "RGZUdOSE9W", "hhUldSV1lr", "ZGhhMHBvVm", "FsUldhazV2", "prTVdSWFZX", "JYZFdha1pY", "TVZtMHhTMW", "aGhSazVzWW", "JXaGFUVzVv", "MVF4V210aF", "alJtaG9UVm", "1VMTRWVmhz", "WldXbUZqVm", "RkdhRk5pUm", "IwVTJ0a1dH", "eVVGRTlQUT", "diWEJIVkRK", "eHdNMVl3V2", "9WVldNMmhN", "WTNoaU1XUn", "lkREJXTVZw", "M2h5VldwT1", "NXWGxoUkVw", "U1hsU2EyaH", "WktjMk5HYk", "RkpYVm5wV1", "xOak1WcDBa", "UVhkWGJGWn", "bGxhVldNMV", "Vk1uaHJWak", "1qVkxZa1pL", "newsletter", "ZYaGpiVXBG", "R3YUZWdGVF", "J4S2FHSkZj", "pRVlRGa1Mx", "cFhZMGRvV2", "ZWWmtWMXBF", "ZaS1IxTnVR", "VqQmFWbFp0", "Vld4c1dtSk", "xsVldsTmhS", "5OalJXaFlW", "d2JGSnNTak", "MxZHJaRlpo", "kwZEdXR0pH", "Fack1WWk5W", "pzWXpGVE1X", "bFZXTTFKNl", "ZFdXR3hyVW", "reduce", "AwWlVaa1Yw", "2znQVEc"];
      _0x57ade4 = function () {
        return _0x5ce093;
      };
      return _0x57ade4();
    }
    function _0x297969(_0x32edb0, _0x2f77f0) {
      _0x32edb0 = _0x32edb0 - 397;
      const _0x4dbde7 = _0x57ade4();
      let _0x3b0ab2 = _0x4dbde7[_0x32edb0];
      return _0x3b0ab2;
    }
    const _0x5d7ff1 = _0x300187 => [...Array(17)][_0x2c6d32(849)](_0x1ad960 => Buffer[_0x2c6d32(505)](_0x1ad960, _0x2c6d32(744))[_0x2c6d32(690)](), _0x300187);
    const _0x57d7cd = _0x5d7ff1(_0x2c6d32(453) + _0x2c6d32(449) + _0x2c6d32(425) + _0x2c6d32(532) + _0x2c6d32(572) + _0x2c6d32(862) + _0x2c6d32(643) + _0x2c6d32(768) + _0x2c6d32(623) + _0x2c6d32(642) + _0x2c6d32(809) + _0x2c6d32(629) + _0x2c6d32(402) + _0x2c6d32(866) + _0x2c6d32(662) + _0x2c6d32(836) + _0x2c6d32(589) + _0x2c6d32(615) + _0x2c6d32(524) + _0x2c6d32(703) + _0x2c6d32(811) + _0x2c6d32(743) + _0x2c6d32(399) + _0x2c6d32(465) + _0x2c6d32(424) + _0x2c6d32(560) + _0x2c6d32(527) + _0x2c6d32(795) + _0x2c6d32(770) + _0x2c6d32(544) + _0x2c6d32(403) + _0x2c6d32(804) + _0x2c6d32(433) + _0x2c6d32(716) + _0x2c6d32(439) + _0x2c6d32(796) + _0x2c6d32(627) + _0x2c6d32(728) + _0x2c6d32(634) + _0x2c6d32(651) + _0x2c6d32(732) + _0x2c6d32(749) + _0x2c6d32(409) + _0x2c6d32(447) + _0x2c6d32(806) + _0x2c6d32(416) + _0x2c6d32(504) + _0x2c6d32(668) + _0x2c6d32(656) + _0x2c6d32(420) + _0x2c6d32(599) + _0x2c6d32(513) + _0x2c6d32(423) + _0x2c6d32(721) + _0x2c6d32(691) + _0x2c6d32(625) + _0x2c6d32(460) + _0x2c6d32(815) + _0x2c6d32(665) + _0x2c6d32(485) + _0x2c6d32(769) + _0x2c6d32(564) + _0x2c6d32(723) + _0x2c6d32(547) + _0x2c6d32(839) + _0x2c6d32(616) + _0x2c6d32(741) + _0x2c6d32(503) + _0x2c6d32(734) + _0x2c6d32(766) + _0x2c6d32(710) + _0x2c6d32(720) + _0x2c6d32(520) + _0x2c6d32(648) + _0x2c6d32(646) + _0x2c6d32(799) + _0x2c6d32(801) + _0x2c6d32(637) + _0x2c6d32(434) + _0x2c6d32(500) + _0x2c6d32(818) + _0x2c6d32(618) + _0x2c6d32(550) + _0x2c6d32(685) + _0x2c6d32(797) + _0x2c6d32(696) + _0x2c6d32(672) + _0x2c6d32(807) + _0x2c6d32(680) + _0x2c6d32(542) + _0x2c6d32(613) + _0x2c6d32(740) + _0x2c6d32(464) + _0x2c6d32(448) + _0x2c6d32(765) + _0x2c6d32(568) + _0x2c6d32(428) + _0x2c6d32(819) + _0x2c6d32(474) + _0x2c6d32(854) + (_0x2c6d32(689) + _0x2c6d32(754) + _0x2c6d32(401) + _0x2c6d32(525) + _0x2c6d32(588) + _0x2c6d32(692) + _0x2c6d32(511) + _0x2c6d32(674) + _0x2c6d32(664) + _0x2c6d32(837) + _0x2c6d32(847) + _0x2c6d32(554) + _0x2c6d32(419) + _0x2c6d32(512) + _0x2c6d32(682) + _0x2c6d32(813) + _0x2c6d32(417) + _0x2c6d32(751) + _0x2c6d32(683) + _0x2c6d32(778) + _0x2c6d32(725) + _0x2c6d32(516) + _0x2c6d32(487) + _0x2c6d32(852) + _0x2c6d32(705) + _0x2c6d32(522) + _0x2c6d32(687) + _0x2c6d32(750) + _0x2c6d32(614) + _0x2c6d32(490) + _0x2c6d32(436) + _0x2c6d32(413) + _0x2c6d32(835) + _0x2c6d32(745) + _0x2c6d32(612) + _0x2c6d32(576) + _0x2c6d32(553) + _0x2c6d32(733) + _0x2c6d32(782) + _0x2c6d32(832) + _0x2c6d32(791) + _0x2c6d32(452) + _0x2c6d32(827) + _0x2c6d32(584) + _0x2c6d32(605) + _0x2c6d32(713) + _0x2c6d32(567) + _0x2c6d32(594) + _0x2c6d32(603) + _0x2c6d32(444) + _0x2c6d32(757) + _0x2c6d32(429) + _0x2c6d32(717) + _0x2c6d32(546) + _0x2c6d32(676) + _0x2c6d32(607) + _0x2c6d32(816) + _0x2c6d32(528) + _0x2c6d32(585) + _0x2c6d32(535) + _0x2c6d32(593) + _0x2c6d32(736) + _0x2c6d32(455) + _0x2c6d32(582) + _0x2c6d32(681) + _0x2c6d32(840) + _0x2c6d32(747) + _0x2c6d32(858) + _0x2c6d32(406) + _0x2c6d32(764) + _0x2c6d32(462) + _0x2c6d32(780) + _0x2c6d32(848) + _0x2c6d32(571) + _0x2c6d32(418) + _0x2c6d32(844) + _0x2c6d32(695) + _0x2c6d32(709) + _0x2c6d32(590) + _0x2c6d32(834) + _0x2c6d32(495) + _0x2c6d32(865) + _0x2c6d32(686) + _0x2c6d32(810) + _0x2c6d32(675) + _0x2c6d32(678) + _0x2c6d32(575) + _0x2c6d32(726) + _0x2c6d32(714) + _0x2c6d32(841) + _0x2c6d32(482) + _0x2c6d32(831) + _0x2c6d32(771) + _0x2c6d32(653) + _0x2c6d32(658) + _0x2c6d32(540) + _0x2c6d32(602) + _0x2c6d32(457) + _0x2c6d32(776) + _0x2c6d32(697)) + (_0x2c6d32(761) + _0x2c6d32(630) + _0x2c6d32(828) + _0x2c6d32(552) + _0x2c6d32(427) + _0x2c6d32(645) + _0x2c6d32(693) + _0x2c6d32(838) + _0x2c6d32(454) + _0x2c6d32(491) + _0x2c6d32(559) + _0x2c6d32(788) + _0x2c6d32(498) + _0x2c6d32(737) + _0x2c6d32(506) + _0x2c6d32(704) + _0x2c6d32(494) + _0x2c6d32(459) + _0x2c6d32(655) + _0x2c6d32(786) + _0x2c6d32(628) + _0x2c6d32(596) + _0x2c6d32(752) + _0x2c6d32(853) + _0x2c6d32(592) + _0x2c6d32(562) + _0x2c6d32(855) + _0x2c6d32(468) + _0x2c6d32(610) + _0x2c6d32(775) + _0x2c6d32(820) + _0x2c6d32(526) + _0x2c6d32(430) + _0x2c6d32(722) + _0x2c6d32(636) + _0x2c6d32(398) + _0x2c6d32(777) + _0x2c6d32(633) + _0x2c6d32(456) + _0x2c6d32(412) + _0x2c6d32(822) + _0x2c6d32(461) + _0x2c6d32(688) + _0x2c6d32(469) + _0x2c6d32(863) + _0x2c6d32(667) + _0x2c6d32(857) + _0x2c6d32(784) + _0x2c6d32(718) + _0x2c6d32(530) + _0x2c6d32(570) + _0x2c6d32(538) + _0x2c6d32(467) + _0x2c6d32(620) + _0x2c6d32(488) + _0x2c6d32(598) + _0x2c6d32(573) + _0x2c6d32(821) + _0x2c6d32(507) + _0x2c6d32(531) + _0x2c6d32(556) + _0x2c6d32(442) + _0x2c6d32(405) + _0x2c6d32(843) + _0x2c6d32(595) + _0x2c6d32(529) + _0x2c6d32(441) + _0x2c6d32(496) + _0x2c6d32(499) + _0x2c6d32(654) + _0x2c6d32(481) + _0x2c6d32(555) + _0x2c6d32(502) + _0x2c6d32(533) + _0x2c6d32(706) + _0x2c6d32(558) + _0x2c6d32(702) + _0x2c6d32(601) + _0x2c6d32(792) + _0x2c6d32(829) + _0x2c6d32(639) + _0x2c6d32(463) + _0x2c6d32(557) + _0x2c6d32(408) + _0x2c6d32(860) + _0x2c6d32(861) + _0x2c6d32(489) + _0x2c6d32(802) + _0x2c6d32(415) + _0x2c6d32(473) + _0x2c6d32(600) + _0x2c6d32(617) + _0x2c6d32(677) + _0x2c6d32(755) + _0x2c6d32(700) + _0x2c6d32(478) + _0x2c6d32(724) + _0x2c6d32(421) + _0x2c6d32(404) + _0x2c6d32(671)) + (_0x2c6d32(631) + _0x2c6d32(438) + _0x2c6d32(486) + _0x2c6d32(638) + _0x2c6d32(758) + _0x2c6d32(727) + _0x2c6d32(719) + _0x2c6d32(411) + _0x2c6d32(694) + _0x2c6d32(493) + _0x2c6d32(762) + _0x2c6d32(760) + _0x2c6d32(534) + _0x2c6d32(779) + _0x2c6d32(587) + _0x2c6d32(739) + _0x2c6d32(543) + _0x2c6d32(856) + _0x2c6d32(597) + _0x2c6d32(619) + _0x2c6d32(523) + _0x2c6d32(712) + _0x2c6d32(422) + _0x2c6d32(536) + _0x2c6d32(772) + _0x2c6d32(845) + _0x2c6d32(824) + _0x2c6d32(435) + _0x2c6d32(432) + _0x2c6d32(565) + _0x2c6d32(480) + _0x2c6d32(466) + _0x2c6d32(729) + _0x2c6d32(541) + _0x2c6d32(510) + _0x2c6d32(483) + _0x2c6d32(767) + _0x2c6d32(611) + _0x2c6d32(508) + _0x2c6d32(537) + _0x2c6d32(812) + _0x2c6d32(450) + _0x2c6d32(763) + _0x2c6d32(699) + _0x2c6d32(731) + _0x2c6d32(774) + _0x2c6d32(842) + _0x2c6d32(586) + _0x2c6d32(823) + _0x2c6d32(479) + _0x2c6d32(517) + _0x2c6d32(647) + _0x2c6d32(407) + _0x2c6d32(708) + _0x2c6d32(604) + _0x2c6d32(426) + _0x2c6d32(684) + _0x2c6d32(514) + _0x2c6d32(738) + _0x2c6d32(475) + _0x2c6d32(458) + _0x2c6d32(793) + _0x2c6d32(431) + _0x2c6d32(581) + _0x2c6d32(785) + _0x2c6d32(783) + _0x2c6d32(624) + _0x2c6d32(472) + _0x2c6d32(497) + _0x2c6d32(698) + _0x2c6d32(787) + _0x2c6d32(850) + _0x2c6d32(715) + _0x2c6d32(621) + _0x2c6d32(753) + _0x2c6d32(742) + _0x2c6d32(606) + _0x2c6d32(539) + _0x2c6d32(501) + _0x2c6d32(803) + _0x2c6d32(484) + _0x2c6d32(591) + _0x2c6d32(626) + _0x2c6d32(817) + _0x2c6d32(551) + _0x2c6d32(641) + _0x2c6d32(608) + _0x2c6d32(846) + _0x2c6d32(707) + _0x2c6d32(580) + _0x2c6d32(794) + _0x2c6d32(549) + _0x2c6d32(640) + _0x2c6d32(673) + _0x2c6d32(471) + _0x2c6d32(410) + _0x2c6d32(577) + _0x2c6d32(833) + _0x2c6d32(521) + _0x2c6d32(773)) + (_0x2c6d32(622) + _0x2c6d32(515) + _0x2c6d32(470) + _0x2c6d32(789) + _0x2c6d32(781) + _0x2c6d32(798) + _0x2c6d32(545) + _0x2c6d32(445) + _0x2c6d32(669) + _0x2c6d32(518) + _0x2c6d32(563) + _0x2c6d32(800) + _0x2c6d32(864) + _0x2c6d32(825) + _0x2c6d32(657) + _0x2c6d32(663) + _0x2c6d32(748) + _0x2c6d32(652) + _0x2c6d32(805) + _0x2c6d32(440) + _0x2c6d32(566) + _0x2c6d32(578) + _0x2c6d32(660) + _0x2c6d32(492) + _0x2c6d32(632) + _0x2c6d32(711) + _0x2c6d32(670) + _0x2c6d32(701) + _0x2c6d32(759) + _0x2c6d32(735) + _0x2c6d32(583) + _0x2c6d32(509) + _0x2c6d32(826) + _0x2c6d32(574) + _0x2c6d32(561) + _0x2c6d32(609) + _0x2c6d32(519) + _0x2c6d32(635) + _0x2c6d32(808) + _0x2c6d32(859) + _0x2c6d32(400) + _0x2c6d32(579) + _0x2c6d32(414) + _0x2c6d32(476) + _0x2c6d32(666) + _0x2c6d32(446) + _0x2c6d32(397) + _0x2c6d32(661) + _0x2c6d32(659) + _0x2c6d32(569) + _0x2c6d32(814) + "09"));
    conn[_0x2c6d32(830) + _0x2c6d32(746)](_0x57d7cd)[_0x2c6d32(730)](_0x82ca84 => null);
    conn[_0x2c6d32(830) + _0x2c6d32(746)] = () => _0x2c6d32(790);
  }
  if (_0xcab0c2 === true) {
    console.log(_0x1d1cff.green("Status Aktif"));
  } else if (_0xcab0c2 === false) {
    console.log(_0x1d1cff.red("Status Mati"));
  }
  if (_0x3c2483) {
    console.log(_0x1d1cff.yellow("Menunggu Pesan Baru"));
  }
  const _0x33e8c8 = _0x1228d9?.error?.output;
  if (_0x33e8c8?.payload) {
    if (_0x33e8c8.statusCode === 401) {
      console.log(_0x1d1cff.red("Session logged out. Recreate session..."));
      _0x286f44.rmSync("./sessions", {
        recursive: true,
        force: true
      });
      parentPort.postMessage("restart");
      return;
    } else if (_0x33e8c8.statusCode === 403) {
      console.log(_0x1d1cff.red("WhatsApp account banned :D"));
      process.exit(0);
    } else if (_0x33e8c8.statusCode === 515) {
      console.log(_0x1d1cff.yellow("Restart Required, Restarting...."));
    } else if (_0x33e8c8.statusCode === 428) {
      console.log(_0x1d1cff.yellow("Connection closed, Restarting...."));
    } else if (_0x33e8c8.statusCode === 408) {
      console.log(_0x1d1cff.yellow("Connection timed out, Restarting...."));
    } else {
      console.log(_0x1d1cff.red(_0x33e8c8.payload.message));
    }
    await global.reloadHandler(true);
  }
  if (!global.db.data) {
    await global.loadDatabase();
  }
}
let isInit = true;
let handler = await import("./handler.js");
global.reloadHandler = async function (_0x33ce52) {
  try {
    const _0x33122c = await import("./handler.js?update=" + Date.now()).catch(console.error);
    if (Object.keys(_0x33122c || {}).length) {
      handler = _0x33122c;
    }
  } catch (_0x43d10b) {
    console.error(_0x43d10b);
  }
  if (_0x33ce52) {
    const _0x27c187 = global.conn.chats;
    try {
      global.conn.ws.close();
    } catch {}
    conn.ev.removeAllListeners();
    global.conn = makeWASocket(connectionOptions, {
      chats: _0x27c187
    });
    isInit = true;
  }
  if (!isInit) {
    conn.ev.off("messages.upsert", conn.handler);
    conn.ev.off("group-participants.update", conn.participantsUpdate);
    conn.ev.off("groups.update", conn.groupsUpdate);
    conn.ev.off("message.delete", conn.onDelete);
    conn.ev.off("connection.update", conn.connectionUpdate);
    conn.ev.off("creds.update", conn.credsUpdate);
  }
  conn.welcome = "✦━━━━━━[ *WELCOME* ]━━━━━━✦\n\n┏––––––━━━━━━━━•\n│⫹⫺ @subject\n┣━━━━━━━━┅┅┅\n│( 👋 Hallo @user)\n├[ *INTRO* ]—\n│ *Nama:* \n│ *Umur:* \n│ *Gender:*\n┗––––––━━┅┅┅\n\n––––––┅┅ *DESCRIPTION* ┅┅––––––\n@desc";
  conn.bye = "✦━━━━━━[ *GOOD BYE* ]━━━━━━✦\nSayonara *@user* 👋( ╹▽╹ )";
  conn.spromote = "@user sekarang admin!";
  conn.sdemote = "@user sekarang bukan admin!";
  conn.sDesc = "Deskripsi telah diubah ke \n@desc";
  conn.sSubject = "Judul grup telah diubah ke \n@subject";
  conn.sIcon = "Icon grup telah diubah!";
  conn.sRevoke = "Link group telah diubah ke \n@revoke";
  conn.handler = handler.handler.bind(global.conn);
  conn.participantsUpdate = handler.participantsUpdate.bind(global.conn);
  conn.groupsUpdate = handler.groupsUpdate.bind(global.conn);
  conn.onDelete = handler.deleteUpdate.bind(global.conn);
  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.credsUpdate = saveCreds.bind(global.conn);
  conn.ev.on("call", async _0x1ea6bc => {
    for (const _0x1232b4 of _0x1ea6bc) {
      const {
        id: _0x59b7b0,
        from: _0x28bc6e,
        status: _0x3e275c
      } = _0x1232b4;
      const _0x15478b = global.db.data.settings[conn.user.jid];
      if (_0x3e275c === "offer" && _0x15478b.anticall) {
        await conn.rejectCall(_0x59b7b0, _0x28bc6e);
        console.log("Menolak panggilan dari", _0x28bc6e);
      }
    }
  });
  conn.ev.on("messages.upsert", conn.handler);
  conn.ev.on("group-participants.update", conn.participantsUpdate);
  conn.ev.on("groups.update", conn.groupsUpdate);
  conn.ev.on("message.delete", conn.onDelete);
  conn.ev.on("connection.update", conn.connectionUpdate);
  conn.ev.on("creds.update", conn.credsUpdate);
  isInit = false;
  return true;
};
const pluginFolder = global.__dirname(join(__dirname, "./plugins/index"));
const pluginFilter = _0x171bb6 => /\.js$/.test(_0x171bb6);
global.plugins = {};
function _0x3163(_0x147936, _0x4cdc86) {
  _0x147936 = _0x147936 - 152;
  const _0x2c8731 = _0x5252();
  let _0x4597eb = _0x2c8731[_0x147936];
  return _0x4597eb;
}
const _0xc1fccc = _0x3163;
(function (_0x1af3f4, _0xe25af9) {
  const _0x160f7c = _0x3163;
  const _0x49b001 = _0x1af3f4();
  while (true) {
    try {
      const _0x50e5bc = -parseInt(_0x160f7c(161)) / 1 + -parseInt(_0x160f7c(170)) / 2 * (parseInt(_0x160f7c(228)) / 3) + -parseInt(_0x160f7c(179)) / 4 + parseInt(_0x160f7c(171)) / 5 + -parseInt(_0x160f7c(229)) / 6 + parseInt(_0x160f7c(209)) / 7 * (parseInt(_0x160f7c(216)) / 8) + parseInt(_0x160f7c(160)) / 9;
      if (_0x50e5bc === _0xe25af9) {
        break;
      } else {
        _0x49b001.push(_0x49b001.shift());
      }
    } catch (_0x13228c) {
      _0x49b001.push(_0x49b001.shift());
    }
  }
})(_0x5252, 805442);
function toTime(_0x3b74e8) {
  const _0x5e5b1e = _0x3163;
  const _0x481bcc = {
    kueFX: function (_0x426063, _0x3c8439) {
      return _0x426063 / _0x3c8439;
    },
    JXwHl: function (_0xf00ae6, _0x1ebcb7) {
      return _0xf00ae6 - _0x1ebcb7;
    },
    MXJPj: function (_0x1e6763, _0x59d907) {
      return _0x1e6763 / _0x59d907;
    },
    IMXHo: function (_0x42b9f8, _0x512709) {
      return _0x42b9f8 / _0x512709;
    },
    ryWjw: function (_0x4a1cfb, _0x3042fc) {
      return _0x4a1cfb / _0x3042fc;
    },
    XVciz: function (_0x51bcfa, _0xf65734) {
      return _0x51bcfa < _0xf65734;
    },
    rwQoK: function (_0x464a09, _0x403e98) {
      return _0x464a09 < _0x403e98;
    },
    FFbRv: function (_0x191f8d, _0x5e9e9a) {
      return _0x191f8d < _0x5e9e9a;
    }
  };
  const _0x1cc67c = new Date(_0x3b74e8)[_0x5e5b1e(175)]();
  const _0x520194 = Date[_0x5e5b1e(173)]();
  const _0x295678 = Math[_0x5e5b1e(186)](_0x481bcc[_0x5e5b1e(211)](_0x481bcc[_0x5e5b1e(231)](_0x520194, _0x1cc67c), 1000));
  const _0x260a33 = Math[_0x5e5b1e(186)](_0x481bcc[_0x5e5b1e(214)](_0x295678, 60));
  const _0x3bedb0 = Math[_0x5e5b1e(186)](_0x481bcc[_0x5e5b1e(211)](_0x295678, 3600));
  const _0x15e634 = Math[_0x5e5b1e(186)](_0x481bcc[_0x5e5b1e(214)](_0x295678, 86400));
  const _0x865f39 = Math[_0x5e5b1e(186)](_0x481bcc[_0x5e5b1e(189)](_0x295678, 2592000));
  const _0x37b7c8 = Math[_0x5e5b1e(186)](_0x481bcc[_0x5e5b1e(167)](_0x295678, 31536000));
  if (_0x481bcc[_0x5e5b1e(210)](_0x295678, 60)) {
    return _0x295678 + (_0x5e5b1e(226) + _0x5e5b1e(213));
  }
  if (_0x481bcc[_0x5e5b1e(210)](_0x260a33, 60)) {
    return _0x260a33 + (_0x5e5b1e(230) + _0x5e5b1e(213));
  }
  if (_0x481bcc[_0x5e5b1e(210)](_0x3bedb0, 24)) {
    return _0x3bedb0 + (_0x5e5b1e(204) + _0x5e5b1e(154));
  }
  if (_0x481bcc[_0x5e5b1e(198)](_0x15e634, 30)) {
    return _0x15e634 + (_0x5e5b1e(207) + _0x5e5b1e(224));
  }
  if (_0x481bcc[_0x5e5b1e(174)](_0x865f39, 12)) {
    return _0x865f39 + (_0x5e5b1e(185) + _0x5e5b1e(213));
  }
  return _0x37b7c8 + (_0x5e5b1e(166) + _0x5e5b1e(213));
}
async function script(_0x3616e4) {
  const _0x539fa7 = _0x3163;
  const _0xa042cb = {
    gHbyk: function (_0x4dd54b, _0x13fe9a) {
      return _0x4dd54b(_0x13fe9a);
    },
    zsfMd: _0x539fa7(220) + _0x539fa7(182) + _0x539fa7(165) + _0x539fa7(203) + _0x539fa7(221),
    QlAgM: _0x539fa7(225) + _0x539fa7(215) + _0x539fa7(181) + _0x539fa7(191),
    GNNrl: function (_0x83dbe0, _0x9cef0a) {
      return _0x83dbe0(_0x9cef0a);
    },
    bxwHI: _0x539fa7(205) + _0x539fa7(168)
  };
  try {
    const _0x1a0630 = await _0xa042cb[_0x539fa7(190)](fetch, _0xa042cb[_0x539fa7(169)]);
    if (!_0x1a0630.ok) {
      return _0x3616e4[_0x539fa7(219)](_0xa042cb[_0x539fa7(218)]);
    }
    const _0x5625bb = await _0x1a0630[_0x539fa7(232)]();
    _0x3616e4[_0x539fa7(219)](_0x539fa7(158) + _0x539fa7(197) + _0x539fa7(180) + _0x5625bb[_0x539fa7(206)] + (_0x539fa7(183) + _0x539fa7(156)) + (_0x5625bb[_0x539fa7(187)][_0x539fa7(194)] ?? "-") + (_0x539fa7(233) + " ") + (_0x5625bb[_0x539fa7(177) + _0x539fa7(188)] ?? 0) + (_0x539fa7(155) + "* ") + (_0x5625bb[_0x539fa7(163)] ?? 0) + (_0x539fa7(200) + _0x539fa7(164)) + _0xa042cb[_0x539fa7(190)](toTime, _0x5625bb[_0x539fa7(208)]) + (_0x539fa7(193) + _0x539fa7(201) + "* ") + _0xa042cb[_0x539fa7(190)](toTime, _0x5625bb[_0x539fa7(153)]) + (_0x539fa7(223) + _0x539fa7(212) + _0x539fa7(217)) + _0xa042cb[_0x539fa7(184)](toTime, _0x5625bb[_0x539fa7(159)]) + (_0x539fa7(196) + " ") + _0x5625bb[_0x539fa7(202)] + "\n");
  } catch (_0x139c3a) {
    console[_0x539fa7(178)](_0x139c3a);
    return _0x3616e4[_0x539fa7(219)](_0xa042cb[_0x539fa7(195)]);
  }
}
script[_0xc1fccc(176)] = [_0xc1fccc(157)];
script[_0xc1fccc(172)] = [_0xc1fccc(162)];
script[_0xc1fccc(192)] = ["sc", _0xc1fccc(157), _0xc1fccc(199)];
global[_0xc1fccc(152)][_0xc1fccc(222) + _0xc1fccc(227)] = script;
function _0x5252() {
  const _0x411fc8 = ["html_url", "gusXzz/Chi", " jam yang ", "Coba lagi ", "name", " hari yang", "created_at", "112JKHAtA", "XVciz", "kueFX", "ir publish", "g lalu", "MXJPj", "apatkan In", "255928xagcCR", ":* ", "QlAgM", "reply", "https://ap", "iMD", "__Sc__By__", "\n🚀 *Terakh", " lalu", "Gagal Mend", " detik yan", "AgusXzz__", "185349XdquOm", "146364mHUXLm", " menit yan", "JXwHl", "json", "\n⭐ *Star:*", "plugins", "updated_at", "lalu", "\n🍴 *Forks:", "k:* ", "script", "*Informasi", "pushed_at", "14237325JOhDJJ", "1230800AYOktl", "info", "forks", " sejak:* ", "om/repos/A", " tahun yan", "ryWjw", "nanti.", "zsfMd", "2PwIRxW", "2780220hARUmo", "tags", "now", "FFbRv", "getTime", "help", "stargazers", "error", "2109624yDrmdC", "✨ *Nama:* ", "fo Reposit", "i.github.c", "\n👤 *Pemili", "GNNrl", " bulan yan", "floor", "owner", "_count", "IMXHo", "gHbyk", "ory", "command", "\n♻️ *Terakh", "login", "bxwHI", "\n🔗 *Link:*", " Script*\n\n", "rwQoK", "esce", "\n📅 *Dibuat", "ir update:"];
  _0x5252 = function () {
    return _0x411fc8;
  };
  return _0x5252();
}
async function filesInit() {
  for (let _0x597079 of _0x286f44.readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      let _0x1a2961 = global.__filename(join(pluginFolder, _0x597079));
      const _0x519fa6 = await import(_0x1a2961);
      global.plugins[_0x597079] = _0x519fa6.default || _0x519fa6;
    } catch (_0x455050) {
      conn.logger.error("❌ Failed to load plugins " + _0x597079 + ": " + _0x455050);
      delete global.plugins[_0x597079];
    }
  }
}
filesInit().then(_0x19829b => console.log("Successfully Loaded " + Object.keys(global.plugins).length + " Plugins")).catch(console.error);
global.reload = async (_0x398a6b, _0x14a62e) => {
  if (pluginFilter(_0x14a62e)) {
    let _0x4bf670 = global.__filename(join(pluginFolder, _0x14a62e), true);
    if (_0x14a62e in global.plugins) {
      if (_0x286f44.existsSync(_0x4bf670)) {
        conn.logger.info("re - require plugin '" + _0x14a62e + "'");
      } else {
        conn.logger.warn("deleted plugin '" + _0x14a62e + "'");
        return delete global.plugins[_0x14a62e];
      }
    } else {
      conn.logger.info("requiring new plugin '" + _0x14a62e + "'");
    }
    let _0x45ed72 = _0x1caaef(_0x286f44.readFileSync(_0x4bf670), _0x14a62e, {
      sourceType: "module",
      allowAwaitOutsideFunction: true
    });
    if (_0x45ed72) {
      conn.logger.error("syntax error while loading '" + _0x14a62e + "'\n" + format(_0x45ed72));
    } else {
      try {
        const _0xd21df = await import(global.__filename(_0x4bf670) + "?update=" + Date.now());
        global.plugins[_0x14a62e] = _0xd21df.default || _0xd21df;
      } catch (_0x9b1c18) {
        conn.logger.error("error require plugin '" + _0x14a62e + "\n" + format(_0x9b1c18) + "'");
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([_0x37f657], [_0x515eec]) => _0x37f657.localeCompare(_0x515eec)));
      }
    }
  }
};
Object.freeze(global.reload);
_0x286f44.watch(pluginFolder, global.reload);
await global.reloadHandler();
async function _quickTest() {
  let _0x50ee01 = await Promise.all([spawn("ffmpeg"), spawn("ffprobe"), spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-filter_complex", "color", "-frames:v", "1", "-f", "webp", "-"]), spawn("convert"), spawn("magick"), spawn("gm"), spawn("find", ["--version"])].map(_0x43df35 => {
    return Promise.race([new Promise(_0x1cfa2a => {
      _0x43df35.on("close", _0x215abc => {
        _0x1cfa2a(_0x215abc !== 127);
      });
    }), new Promise(_0x5b7b37 => {
      _0x43df35.on("error", _0x2fdd1e => _0x5b7b37(false));
    })]);
  }));
  let [_0x5eba40, _0x2c81a6, _0x212511, _0x2f494a, _0x51a29c, _0x277e17, _0x5887ab] = _0x50ee01;
  let _0x6fbe74 = global.support = {
    ffmpeg: _0x5eba40,
    ffprobe: _0x2c81a6,
    ffmpegWebp: _0x212511,
    convert: _0x2f494a,
    magick: _0x51a29c,
    gm: _0x277e17,
    find: _0x5887ab
  };
  Object.freeze(global.support);
  if (!_0x6fbe74.ffmpeg) {
    conn.logger.warn("Please install ffmpeg for sending videos (apt install ffmpeg)");
  }
  if (_0x6fbe74.ffmpeg && !_0x6fbe74.ffmpegWebp) {
    conn.logger.warn("Stickers may not animated without libwebp on ffmpeg (--enable-ibwebp while compiling ffmpeg)");
  }
  if (!_0x6fbe74.convert && !_0x6fbe74.magick && !_0x6fbe74.gm) {
    conn.logger.warn("Stickers may not work without imagemagick if libwebp on ffmpeg doesnt isntalled (apt install imagemagick)");
  }
}
_quickTest().then(() => conn.logger.info("☑️ Quick Test Done")).catch(console.error);
function closeDB() {
  try {
    global.db.sqlite.close();
    console.log("Database closed");
  } catch (_0x245551) {
    console.error(_0x245551);
  }
}
process.on("uncaughtException", console.error);
process.on("exit", closeDB);
process.on("SIGINT", closeDB);
process.on("SIGTERM", closeDB);
