// transform-range - I22 (CONTRACT.md VS14 rules 3 and 4): in headless Chrome, the drafter's transform-range cases
// through the scene's own writes (i22-page.html): at both edges of the scale, 2^16 and 2^-16, and at a transform
// member of 2^24 of either sign, every member within the range when the case is classed, a bar put by the scene
// under a view setView wrote is drawn, by the pixels of a screenshot, and hit, by itemAt, where 3.2's arithmetic in
// binary64 puts it: within a tenth of a pixel drawn and a quarter hit at the scale's edges, and within single
// precision's own resolution at a member of 2^24, a pixel drawn and two hit. Just past each edge setView refuses,
// and the platform records no write: the transform, the bar and what is drawn stay as they were.
//
// Chrome is launched and torn down as I10's test launches it, through headless-chromium, and the same guards hold.
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import { connectToPage, launchChrome, serveStatic } from "@apnex/headless-chromium";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const W = 800, ROW = 300, T = 2 ** 24;

let browser, chrome, server;
const TEST = { timeout: 90000 };
const page = async (expression) => JSON.parse(await chrome.evaluate(`JSON.stringify(${expression})`));

/** A PNG Chrome writes -- 8-bit RGB or RGBA, not interlaced -- as its rows of bytes. */
function pixels(buffer) {
	let at = 8, w = 0, h = 0, type = 0;
	const idat = [];
	while (at < buffer.length) {
		const length = buffer.readUInt32BE(at), kind = buffer.toString("ascii", at + 4, at + 8), body = buffer.subarray(at + 8, at + 8 + length);
		if (kind === "IHDR") {
			w = body.readUInt32BE(0);
			h = body.readUInt32BE(4);
			type = body[9];
		}
		if (kind === "IDAT") idat.push(body);
		at += 12 + length;
	}
	const bpp = type === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
	for (let y = 0; y < h; y++) {
		const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
			const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
			out[y * stride + x] = (line[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]) & 255;
		}
	}
	return { w, bpp, data: out };
}

/** What is drawn along the row: how dark each pixel is, 0 white to 1 black. */
async function row() {
	await chrome.evaluate("page.frame()");
	const shot = await chrome.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: ROW, width: W, height: 1, scale: 1 } });
	const image = pixels(Buffer.from(shot.data, "base64"));
	return (x) => (x < 0 || x >= image.w ? 0 : 1 - image.data[x * image.bpp] / 255);
}

/** The bar's drawn edges against the arithmetic's, as the drafter's probe measures them: the white before its left edge and the black before its right, over 40 pixels about each. */
function drawnEdges(dark, eL, eR) {
	let total = 0;
	for (let x = 0; x < W; x++) total += dark(x);
	const L0 = Math.floor(eL) - 20, R0 = Math.floor(eR) - 20;
	let white = 0, black = 0;
	for (let x = L0; x < L0 + 40; x++) white += 1 - dark(x);
	for (let x = R0; x < R0 + 40; x++) black += dark(x);
	return { total, left: L0 + white - eL, right: R0 + black - eR };
}

/** The representable binary64 numbers just past a positive number, above and below. */
const above = (v) => v + 2 ** (Math.floor(Math.log2(v)) - 52);
const below = (v) => v - 2 ** (Math.floor(Math.log2(v)) - 53);

before(async () => {
	server = await serveStatic({ folders: { "/dist/": path.join(root, "dist"), "/test/browser/": path.join(root, "test", "browser") } });
	browser = await launchChrome({ args: ["--window-size=800,700", "--force-device-scale-factor=1"] });
	chrome = await connectToPage(browser.port);
	await chrome.send("Page.enable");
	await chrome.send("Emulation.setDeviceMetricsOverride", { width: 800, height: 700, deviceScaleFactor: 1, mobile: false });
	await chrome.send("Page.navigate", { url: `${server.origin}/test/browser/i22-page.html` });
	for (let i = 0; i < 200 && !(await chrome.evaluate("globalThis.page?.ready === true")); i++) await sleep(50);
	assert.equal(await chrome.evaluate("globalThis.page?.ready === true"), true, "the page opened its scene");
	assert.equal(await page("page.refused"), null);
}, { timeout: 60000 });

// none of the three closes throws
after(async () => {
	chrome?.close();
	await browser?.close();
	await server?.close();
}, { timeout: 30000 });

/** Each case: its scale and drawing x, and how near the arithmetic it must be drawn and hit. */
const EDGES = [
	{ name: "the scale at 2^16", s: 2 ** 16, D: 0, drawn: 0.1, hit: 0.25 },
	{ name: "the scale at 2^-16", s: 2 ** -16, D: 0, drawn: 0.1, hit: 0.25 },
	{ name: "a member of -2^24 at scale 1", s: 1, D: T + 400, drawn: 1.05, hit: 2 },
	{ name: "a member of 2^24 at scale 1", s: 1, D: 400 - T, drawn: 1.05, hit: 2 },
	{ name: "a member of -2^24 at scale 4", s: 4, D: T / 4 + 100, drawn: 1.05, hit: 2 },
	{ name: "a member of 2^24 at scale 4", s: 4, D: 100 - T / 4, drawn: 1.05, hit: 2 },
];

test("I22, VS14 rule 4: at each edge of the range -- the scale at 2^16 and 2^-16, a member of 2^24 of either sign -- every member within it, the bar the scene draws is drawn and hit where the arithmetic puts it", TEST, async (t) => {
	const measured = [];
	for (const c of EDGES) {
		const placed = await page(`page.place(${c.D}, ${c.s})`);
		const [s, e, f] = placed.members;
		// the case classed: every member within the range, one of them at its edge
		assert.ok(s >= 2 ** -16 && s <= 2 ** 16 && Math.abs(e) <= T && Math.abs(f) <= T, `${c.name}: every member within the range, ${placed.members}`);
		assert.ok(s === 2 ** 16 || s === 2 ** -16 || Math.abs(e) === T, `${c.name}: a member at its edge, ${placed.members}`);
		assert.equal(f, 300, `${c.name}: the vertical member held`);
		assert.equal(placed.transform, `matrix(${String(s)}, 0, 0, ${String(s)}, ${String(e)}, ${String(f)})`, `${c.name}: the transform the scene wrote`);
		const drawn = drawnEdges(await row(), placed.eL, placed.eR);
		const hitL = await page(`page.hit(${placed.eL - 12}, ${placed.eL + 12})`);
		const hitR = await page(`page.hit(${placed.eR + 12}, ${placed.eR - 12})`);
		measured.push({ name: c.name, eL: placed.eL, drawnL: drawn.left, drawnR: drawn.right, hitL: hitL === null ? null : hitL - placed.eL, hitR: hitR === null ? null : hitR - placed.eR });
		assert.ok(Math.abs(drawn.total - 100) <= 6, `${c.name}: the bar drawn, ${drawn.total} dark pixels along the row`);
		assert.ok(Math.abs(drawn.left) <= c.drawn && Math.abs(drawn.right) <= c.drawn, `${c.name}: drawn ${drawn.left} and ${drawn.right} from where the arithmetic puts its edges`);
		assert.ok(hitL !== null && hitR !== null, `${c.name}: hit along the row`);
		assert.ok(Math.abs(hitL - placed.eL) <= c.hit && Math.abs(hitR - placed.eR) <= c.hit, `${c.name}: hit ${hitL - placed.eL} and ${hitR - placed.eR} from the edges`);
	}
	assert.equal(measured.length, EDGES.length);
	for (const m of measured) t.diagnostic(`${m.name}: drawn ${m.drawnL.toFixed(3)} and ${m.drawnR.toFixed(3)}, hit ${m.hitL} and ${m.hitR} pixels from the arithmetic's edges`);
});

test("I22, VS14 rules 3 and 4: just past each edge -- the scale past 2^16 and short of 2^-16, a member past 2^24 of either sign and on either axis, a scale of 1e39 and of 1e-50, a member of 1e39 -- setView refuses and the platform records no write, the transform and what is drawn as they were", TEST, async () => {
	const placed = await page("page.place(0, 1)");
	const baseline = drawnEdges(await row(), placed.eL, placed.eR);
	assert.ok(Math.abs(baseline.left) <= 0.1 && Math.abs(baseline.right) <= 0.1, "control: the bar drawn at scale 1");
	const past = [
		{ x: -400 / above(2 ** 16), y: -300 / above(2 ** 16), scale: above(2 ** 16) },
		{ x: 0, y: 0, scale: below(2 ** -16) },
		{ x: -above(T), y: -300, scale: 1 },
		{ x: above(T), y: -300, scale: 1 },
		{ x: -400, y: above(T), scale: 1 },
		{ x: -400, y: -above(T), scale: 1 },
		{ x: -above(T) / 4, y: -75, scale: 4 },
		{ x: 0, y: 0, scale: 1e39 },
		{ x: 0, y: 0, scale: 1e-50 },
		{ x: 1e39, y: -300, scale: 1 },
	];
	assert.ok(above(2 ** 16) > 2 ** 16 && below(2 ** -16) < 2 ** -16 && above(T) > T, "control: each just past its edge");
	for (const view of past) {
		const refused = await page(`page.refuse(${JSON.stringify(view)})`);
		const label = JSON.stringify(view);
		assert.match(refused.thrown ?? "", /^TypeError: setView: /, `${label}: refused`);
		assert.equal(refused.records, 0, `${label}: the platform recorded no write`);
		assert.equal(refused.kept, true, `${label}: the transform kept`);
		assert.deepEqual(refused.view, placed.view, `${label}: the view kept`);
	}
	const after = drawnEdges(await row(), placed.eL, placed.eR);
	assert.deepEqual(after, baseline, "what is drawn as it was");
});
