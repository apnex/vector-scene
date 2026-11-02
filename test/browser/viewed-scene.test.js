// viewed-scene - I21 (CONTRACT.md VS10, VS14, VS15): in headless Chrome, a viewed scene on each of three roots --
// one placed by a translation, one under a CSS scale(2), one resized between views (i21-page.html) -- through a
// panned and a zoomed view: every layer's element, scene and foreign, carries the transform VS14 gives; the platform
// draws the items where the screen positions calculated here, from the page's own layout and the view alone, put
// them -- a drawing point at a view's top-left lands at the root's top-left corner on screen, and the root's screen
// scale times the view's is the pixels a unit spans; toDrawing and toScreen equal DOMPoint over the root's screen
// transform and the view, under Object.is, at thousands of points, and the platform's own composition of the layer's
// transform; itemAt and itemOf answer through the view; and visible() equals the root's corners converted.
//
// Chrome is launched and torn down as I10's test launches it, through headless-chromium, and the same guards hold.
import assert from "node:assert/strict";
import path from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { connectToPage, launchChrome, serveStatic } from "@apnex/headless-chromium";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let browser, chrome, server;
const TEST = { timeout: 60000 };
const page = async (expression) => JSON.parse(await chrome.evaluate(`JSON.stringify(${expression})`));

/** Each root's top-left corner on screen, its screen scale and its size in its own units, as the page lays it out. */
const ROOTS = {
	moved: { left: 37, top: 23, scale: 1, width: 400, height: 300 },
	scaled: { left: 480, top: 20, scale: 2, width: 200, height: 150 },
	resized: { left: 41, top: 360, scale: 1, width: 300, height: 200 },
};
/** The items, in drawing coordinates, as the page puts them. */
const ITEMS = { a: { x: 0, y: 0, w: 40, h: 30 }, b: { x: 100, y: -50, w: 60, h: 40 } };
const DOT = { cx: -80, cy: 60, r: 12 };
/** The views: the opening one, one panned, one zoomed in, and one zoomed out. */
const VIEWS = [{ x: 0, y: 0, scale: 1 }, { x: -120.5, y: 75.25, scale: 1 }, { x: -60, y: -40, scale: 2.5 }, { x: -300, y: -200, scale: 0.38 }];
/** The views the hit test is asked through, each a region holding every point it asks: one panned at the root's own scale of a pixel a unit, one zoomed in from it, and one zoomed out. */
const HIT_VIEWS = {
	moved: [{ x: -110.5, y: -70.25, scale: 1 }, { x: -95, y: -55, scale: 1.15 }, { x: -300, y: -200, scale: 0.38 }],
	scaled: [{ x: -110.5, y: -70.25, scale: 0.5 }, { x: -101, y: -62, scale: 0.55 }, { x: -300, y: -200, scale: 0.19 }],
};

/** A drawing point's screen position, calculated from the layout and the view alone. */
const screenOf = (id, view, x, y) => {
	const r = ROOTS[id];
	return { x: r.left + r.scale * view.scale * (x - view.x), y: r.top + r.scale * view.scale * (y - view.y) };
};
const near = (got, want, tolerance, label) => assert.ok(Math.abs(got - want) <= tolerance, `${label}: ${got} against ${want}`);

before(async () => {
	server = await serveStatic({ folders: { "/dist/": path.join(root, "dist"), "/test/browser/": path.join(root, "test", "browser") } });
	browser = await launchChrome({ args: ["--window-size=1000,700"] });
	chrome = await connectToPage(browser.port);
	await chrome.send("Page.enable");
	await chrome.send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false });
	await chrome.send("Page.navigate", { url: `${server.origin}/test/browser/i21-page.html` });
	for (let i = 0; i < 200 && !(await chrome.evaluate("globalThis.page?.ready === true")); i++) await sleep(50);
	assert.equal(await chrome.evaluate("globalThis.page?.ready === true"), true, "the page opened its scenes");
	assert.deepEqual(await page("page.refused"), {}, "openScene accepted each root with a view");
}, { timeout: 60000 });

// none of the three closes throws
after(async () => {
	chrome?.close();
	await browser?.close();
	await server?.close();
}, { timeout: 30000 });

for (const id of ["moved", "scaled"]) {
	test(`I21, VS14, VS15: on the root ${id === "moved" ? "placed by a translation" : "under a CSS scale(2)"}, every layer carries the view's transform, the items are drawn where the layout and the view put them, and visible() is the root's corners converted`, TEST, async () => {
		const r = ROOTS[id];
		for (const view of VIEWS) {
			const shown = await page(`page.show(${JSON.stringify(id)}, ${JSON.stringify(view)})`);
			const label = `${id} at ${JSON.stringify(view)}`;
			const s = view.scale;
			const text = `matrix(${String(s)}, 0, 0, ${String(s)}, ${String(-s * view.x)}, ${String(-s * view.y)})`;
			assert.deepEqual(shown.answered, view, label);
			assert.equal(shown.layerElements, 3, label);
			assert.deepEqual(shown.transforms, [text, text, text], `${label}: the scene layer and both foreign layers`);
			// a drawing point at the view's top-left lands at the root's top-left corner on screen
			assert.deepEqual(shown.topLeft, { x: r.left, y: r.top }, label);
			near(shown.rootBox.left, r.left, 1e-9, `${label}: the root's left, control`);
			near(shown.rootBox.top, r.top, 1e-9, `${label}: the root's top, control`);
			// the platform draws each item where the layout and the view put it: the root's scale times the view's per unit
			for (const [key, item] of Object.entries(ITEMS)) {
				const at = screenOf(id, view, item.x, item.y);
				const box = shown.boxes[key];
				near(box.left, at.x, 0.02, `${label}: ${key}'s left`);
				near(box.top, at.y, 0.02, `${label}: ${key}'s top`);
				near(box.width, r.scale * s * item.w, 0.02, `${label}: ${key}'s width`);
				near(box.height, r.scale * s * item.h, 0.02, `${label}: ${key}'s height`);
			}
			const dot = screenOf(id, view, DOT.cx - DOT.r, DOT.cy - DOT.r);
			near(shown.boxes.dot.left, dot.x, 0.02, `${label}: the nested circle's left`);
			near(shown.boxes.dot.width, r.scale * s * 2 * DOT.r, 0.02, `${label}: the nested circle's width`);
			// visible(): the view's top-left and the root's size in its own units over the view's scale, the screen pixels a unit spans
			assert.deepEqual(shown.visible, { region: { kind: "rect", x: view.x, y: view.y, w: r.width / s, h: r.height / s }, scale: r.scale * s }, label);
			const far = { x: view.x + r.width / s, y: view.y + r.height / s };
			near(shown.corners.topLeft.x, view.x, 1e-9 * Math.max(1, Math.abs(view.x)), `${label}: the root's top-left corner converted`);
			near(shown.corners.topLeft.y, view.y, 1e-9 * Math.max(1, Math.abs(view.y)), `${label}: the root's top-left corner converted`);
			near(shown.corners.bottomRight.x, far.x, 1e-9 * Math.max(1, Math.abs(far.x)), `${label}: the root's bottom-right corner converted`);
			near(shown.corners.bottomRight.y, far.y, 1e-9 * Math.max(1, Math.abs(far.y)), `${label}: the root's bottom-right corner converted`);
		}
	});

	test(`I21, VS10: on the root ${id === "moved" ? "placed by a translation" : "under a CSS scale(2)"}, toDrawing and toScreen equal DOMPoint over the root's screen transform and the view, under Object.is, at thousands of points, and the layer's own composition`, TEST, async () => {
		let compared = 0;
		for (const [index, view] of VIEWS.entries()) {
			await page(`page.show(${JSON.stringify(id)}, ${JSON.stringify(view)})`);
			const result = await page(`page.conversions(${JSON.stringify(id)}, 400, ${index + 1})`);
			assert.deepEqual(result.wrong, [], `${id} at ${JSON.stringify(view)}: ${result.wrongCount} wrong`);
			compared += result.compared;
		}
		assert.ok(compared >= 3000, `${compared} compared`);
	});

	test(`I21, VS9, VS12: on the root ${id === "moved" ? "placed by a translation" : "under a CSS scale(2)"}, itemAt and itemOf answer through a panned and a zoomed view at the screen points the layout and the view give`, TEST, async () => {
		for (const view of HIT_VIEWS[id]) {
			await page(`page.show(${JSON.stringify(id)}, ${JSON.stringify(view)})`);
			const centre = (x, y) => {
				const p = screenOf(id, view, x, y);
				return [p.x, p.y];
			};
			// a's centre, b's left half, the circle's centre, b's right half under the foreign rect above it, the rect beneath, and open ground
			const points = [centre(20, 15), centre(110, -30), centre(DOT.cx, DOT.cy), centre(150, -30), centre(215, 110), centre(60, 60)];
			const hits = await page(`page.hits(${JSON.stringify(id)}, ${JSON.stringify(points)})`);
			const label = `${id} at ${JSON.stringify(view)}`;
			const item = (key, ...pathTo) => ({ layer: "items", key, path: pathTo });
			assert.deepEqual(hits.map((h) => h.at), [item("a", 0), item("b", 0), item("c", 0, 0), item("b", 0), null, null], `${label}: itemAt`);
			assert.deepEqual(hits.map((h) => h.of), [item("a", 0), item("b", 0), item("c", 0, 0), null, null, null], `${label}: itemOf of the platform's topmost element`);
			assert.deepEqual(hits.map((h) => h.element), [`${id}-a`, `${id}-b`, `${id}-c-dot`, `${id}-over`, `${id}-under`, id], `${label}: control, the platform's own hit test`);
		}
	});
}

test("I21, VS14, VS15: on a root resized between views, visible() follows the resize with no setView, the transform is unchanged by it, and every view before and after is drawn and converted as the layout puts it", TEST, async () => {
	const id = "resized";
	const before = await page(`page.show("resized", ${JSON.stringify(VIEWS[2])})`);
	assert.deepEqual(before.visible, { region: { kind: "rect", x: -60, y: -40, w: 300 / 2.5, h: 200 / 2.5 }, scale: 2.5 });
	assert.deepEqual(await page(`page.resize("resized", 360, 240)`), { clientWidth: 360, clientHeight: 240 });
	assert.deepEqual(await page(`page.visible("resized")`), { region: { kind: "rect", x: -60, y: -40, w: 360 / 2.5, h: 240 / 2.5 }, scale: 2.5 }, "followed, with no setView");
	ROOTS.resized.width = 360;
	ROOTS.resized.height = 240;
	for (const [index, view] of [VIEWS[2], VIEWS[1], VIEWS[3]].entries()) {
		const shown = await page(`page.show("resized", ${JSON.stringify(view)})`);
		const s = view.scale;
		const text = `matrix(${String(s)}, 0, 0, ${String(s)}, ${String(-s * view.x)}, ${String(-s * view.y)})`;
		assert.deepEqual(shown.transforms, [text, text, text]);
		assert.deepEqual(shown.topLeft, { x: ROOTS.resized.left, y: ROOTS.resized.top });
		assert.deepEqual(shown.visible.region, { kind: "rect", x: view.x, y: view.y, w: 360 / s, h: 240 / s });
		const at = screenOf(id, view, ITEMS.a.x, ITEMS.a.y);
		near(shown.boxes.a.left, at.x, 0.02, "a's left");
		near(shown.boxes.a.width, s * ITEMS.a.w, 0.02, "a's width");
		near(shown.corners.bottomRight.x, view.x + 360 / s, 1e-9 * Math.max(1, Math.abs(view.x + 360 / s)), "the resized root's bottom-right corner converted");
		const result = await page(`page.conversions("resized", 400, ${index + 11})`);
		assert.deepEqual(result.wrong, []);
	}
	await page(`page.resize("resized", 300, 200)`);
	ROOTS.resized.width = 300;
	ROOTS.resized.height = 200;
});
