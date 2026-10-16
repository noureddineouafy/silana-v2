// Source Code: https://whatsapp.com/channel/0029Vb6D8o67YSd1UzflqU1d/1265

let handler = async (m, { conn, args }) => {
	try {
		if (!args[0]) throw '*Example:* .ssweb https://instagram.com/noureddine_ouafy';
		let buff = await ssweb.capture(args[0]);
		conn.sendMessage(m.chat, { image: buff }, { quoted: m });
	} catch (e) {
		m.reply(e.message);
	}
};

handler.help = ['ssweb'];
handler.command = ['ssweb'];
handler.tags = ['tools'];

export default handler;

const ssweb = {
	_static: Object.freeze({
		baseUrl: 'https://www.screenshotmachine.com',
		baseHeaders: { 'content-encoding': 'zstd' },
		maxOutputLength: 200,
	}),

	formatError(string) {
		if (!string) return '(empty message)';
		let message = '';

		try {
			message = JSON.stringify(string, null, 2);
		} catch {
			message = string;
		}

		return message.length >= this._static.maxOutputLength
			? message.substring(0, this._static.maxOutputLength) + ' [trimmed]'
			: message;
	},

	async getCookie() {
		const r = await fetch(this._static.baseUrl, {
			headers: this._static.baseHeaders,
		});

		if (!r.ok)
			throw Error(
				`${r.status} ${r.statusText} ${this.formatError(await r.text())}`
			);

		const cookie =
			r.headers
				.get('set-cookie')
				?.split(',')
				.map((v) => v.split(';')[0])
				.join('; ') || '';

		if (!cookie) throw Error('failed to get cookie');

		return { cookie };
	},

	async getBuffer(reqObj, cookie) {
		if (reqObj.status !== 'success')
			throw Error('request status was not successful');

		const { link } = reqObj;

		const r = await fetch(this._static.baseUrl + '/' + link, {
			headers: { cookie },
		});

		if (!r.ok)
			throw Error(
				`${r.status} ${r.statusText} ${this.formatError(await r.text())}`
			);

		const ab = await r.arrayBuffer();

		return { buffer: Buffer.from(ab) };
	},

	async req(url, cookie) {
		const headers = {
			cookie,
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			...this._static.baseHeaders,
		};

		const r = await fetch(this._static.baseUrl + '/capture.php', {
			headers,
			body:
				'url=' +
				encodeURIComponent(url) +
				'&device=desktop&cacheLimit=0',
			method: 'POST',
		});

		if (!r.ok)
			throw Error(
				`${r.status} ${r.statusText} ${this.formatError(await r.text())}`
			);

		const reqObj = await r.json();

		return { reqObj };
	},

	validateUrl(url) {
		let parsed;
		try {
			parsed = new URL(url);
		} catch {
			throw Error('invalid URL');
		}

		if (!['http:', 'https:'].includes(parsed.protocol))
			throw Error('only http/https URLs are allowed');

		const host = parsed.hostname.toLowerCase();
		const blockedHosts = ['localhost', '169.254.169.254', '::1'];
		const privateIpPattern =
			/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0)/;

		if (
			blockedHosts.includes(host) ||
			privateIpPattern.test(host) ||
			host === '[::1]'
		)
			throw Error('URL points to a disallowed private/internal address');

		return true;
	},

	async capture(url) {
		if (!url) throw Error('URL parameter cannot be empty');
		this.validateUrl(url);

		const { cookie } = await this.getCookie();
		const { reqObj } = await this.req(url, cookie);
		const { buffer } = await this.getBuffer(reqObj, cookie);

		return buffer;
	},
};