// captured-pointer - I14 (CONTRACT.md VS12, VS13): in headless Chrome, on a page whose root is an SVG element
// scaled and offset in its page (i14-page.html), with trusted input dispatched through the DevTools protocol's
// Input domain: with the pointer taken on a press, itemAt of each move's screen point answers the item under
// it while the target stays the capturing element; an item under a layer declared pointer-events none is
// answered through it; with no pointer taken and nothing the scene did not make above the items, itemAt of
// the screen point equals itemOf of the target for trusted presses over a grid of points; under an opaque
// foreign element above an item, itemAt answers the item and itemOf null; and a viewBox the application sets
// after opening is followed by toDrawing, toScreen and itemAt.
//
// Chrome is launched and torn down as I10's test launches it (chrome-driver.js), and the same guards hold:
// every test and hook has a timeout, and Node.js's WebSocket is asked for behind its flag where it needs one.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { launchChrome, serveRepository, sleep } from "./chrome-driver.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

if (typeof globalThis.WebSocket !== "function") {
	test("I14, run again with --experimental-websocket, since this Node.js keeps its WebSocket behind the flag", () => {
		const run = spawnSync(process.execPath, ["--experimental-websocket", "--test", fileURLToPath(import.meta.url)], { stdio: "inherit", timeout: 300000, killSignal: "SIGKILL" });
		assert.equal(run.status, 0);
	});
} else {
	let chrome, server;
	const TEST = { timeout: 60000 };
	const page = async (expression) => JSON.parse(await chrome.evaluate(`JSON.stringify(${expression})`));
	const mouse = (type, [x, y], buttons, button = "left") => chrome.send("Input.dispatchMouseEvent", { type, x, y, button, buttons, clickCount: type === "mouseMoved" ? 0 : 1 });

	before(async () => {
		server = await serveRepository(root);
		chrome = await launchChrome();
		await chrome.send("Page.enable");
		await chrome.send("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
		await chrome.send("Page.navigate", { url: `${server.origin}/test/browser/i14-page.html` });
		for (let i = 0; i < 200 && !(await chrome.evaluate("globalThis.page?.ready === true")); i++) await sleep(50);
		assert.equal(await chrome.evaluate("globalThis.page?.ready === true"), true, "the page opened its scene");
		assert.equal(await page("page.refused"), null, "openScene accepted an SVG element whose document holds elementsFromPoint");
	}, { timeout: 60000 });

	after(async () => {
		try {
			await chrome?.close();
		} finally {
			await server?.close();
		}
	}, { timeout: 30000 });

	/** What the page recorded under `name` since the last call, read once its count has held still for 100 milliseconds, or after 3 seconds. */
	const recorded = async (name) => {
		let count = -1;
		for (let waited = 0; waited < 3000; waited += 50) {
			await sleep(50);
			const now = await chrome.evaluate(`page.${name}.length`);
			if (now === count && waited >= 100) break;
			count = now;
		}
		return page(`page.${name}.splice(0)`);
	};
	const press = async (point) => {
		await mouse("mouseMoved", point, 0, "none");
		await mouse("mousePressed", point, 1);
		await mouse("mouseReleased", point, 0);
	};

	const A = { layer: "low", key: "a", path: [0] };
	const DOT = { layer: "low", key: "b", path: [0, 1, 0] };
	const BACK = { layer: "low", key: "b", path: [0, 0] };
	const C = { layer: "high", key: "c", path: [0] };
	const D = { layer: "low", key: "d", path: [0] };
	const E = { layer: "low", key: "e", path: [0] };

	test("I14, VS12: with the pointer taken on a press, itemAt of each move's screen point answers the item under it -- through a layer declared pointer-events none too -- while every move targets the capturing root and itemOf answers null", TEST, async () => {
		const at = await page("({ a: page.centre('a'), dot: page.centre('b-dot'), back: page.centre('b-back'), c: page.centre('c'), d: page.centre('d'), box: page.box() })");
		const ground = [Math.round(at.box.left + 10), Math.round(at.box.bottom - 10)];
		const beyond = [Math.round(at.box.right + 30), Math.round(at.box.bottom + 30)];
		await chrome.evaluate("page.capturing = true");
		await mouse("mouseMoved", at.a, 0, "none");
		await recorded("moves");
		await mouse("mousePressed", at.a, 1);
		const [pressed] = await recorded("presses");
		assert.equal(pressed.target, "a", "the press lands on item a");
		assert.deepEqual([pressed.of, pressed.at], [A, A]);
		const route = [at.dot, at.back, at.c, at.d, ground, beyond, at.a];
		for (const point of route) await mouse("mouseMoved", point, 1);
		const moves = await recorded("moves");
		await mouse("mouseReleased", at.a, 0);
		await chrome.evaluate("page.capturing = false");
		assert.deepEqual(moves.map((move) => [move.x, move.y]), route, "one trusted move at each point, in order");
		for (const move of moves) {
			assert.equal(move.trusted, true);
			assert.equal(move.buttons, 1, "the button held throughout");
			assert.equal(move.target, "root", "the capturing element is every move's target");
			assert.equal(move.captured, true);
			assert.equal(move.of, null, "itemOf of the capturing root answers nothing");
		}
		assert.deepEqual(moves.map((move) => move.at), [DOT, BACK, C, D, null, null, A], "itemAt answers by point: the nested dot, its group's back, the high layer's item, the item beneath the veil, the ground, beyond the root");
	});

	test("I14, VS12: with no pointer taken and nothing the scene did not make above the items, itemAt(screen) equals itemOf(target) for trusted presses over a grid of points", TEST, async () => {
		const box = await page("page.box()");
		const points = [];
		for (let i = 0; i <= 13; i++) for (let j = 0; j <= 10; j++) points.push([Math.round(box.left - 15 + ((box.right - box.left + 30) * i) / 13), Math.round(box.top - 15 + ((box.bottom - box.top + 30) * j) / 10)]);
		await recorded("presses");
		for (const point of points) await press(point);
		const presses = await recorded("presses");
		const onRoot = points.filter(([x, y]) => x >= box.left && x < box.right && y >= box.top && y < box.bottom);
		assert.equal(presses.length, onRoot.length, "a press recorded at every point on the root, whose listener records them");
		let items = 0;
		for (const pressed of presses) {
			assert.equal(pressed.trusted, true);
			assert.equal(pressed.captured, false);
			assert.deepEqual(pressed.at, pressed.of, `at (${pressed.x}, ${pressed.y}) on ${pressed.target}`);
			if (pressed.of !== null) items++;
		}
		assert.ok(items >= 12 && items < presses.length, `${items} of ${presses.length} presses on an item`);
		assert.ok(presses.some((pressed) => pressed.target === "d"), "a press beneath the veil reaches the item there");
	});

	test("I14, VS12: under an opaque foreign element above an item, itemAt answers the item and itemOf null", TEST, async () => {
		const centre = await page("page.occlude()");
		await recorded("presses");
		await press(centre);
		const [pressed] = await recorded("presses");
		assert.equal(pressed.target, "occluder", "the platform's hit is the element the page drew");
		assert.equal(pressed.of, null);
		assert.deepEqual(pressed.at, E, "itemAt looks through what the scene did not make");
	});

	test("I14, VS13: a viewBox the application sets after opening is followed by toDrawing, toScreen and itemAt", TEST, async () => {
		const before = await page("page.reframe('0 0 200 150')");
		assert.deepEqual(before, [2, 0, 0, 2, 30, 40], "scaled by 2 and offset to the root's place");
		assert.deepEqual(await page("page.conversions()"), [], "the conversions over the viewBox the root was opened with");
		const centres = await page("page.itemsAtCentres(['b-back', 'b-dot', 'c'])");
		assert.deepEqual(centres, { "b-back": BACK, "b-dot": DOT, c: C });
		const moved = await page("[page.centre('b-back'), page.centre('b-dot'), page.centre('c')]");
		const after = await page("page.reframe('60 0 100 75')");
		assert.deepEqual(after, [4, 0, 0, 4, -210, 40], "the root's own viewBox, set after opening, changes the screen transform");
		assert.deepEqual(await page("page.conversions()"), [], "the conversions follow the root as it stands");
		assert.deepEqual(await page("page.itemsAtCentres(['b-back', 'b-dot', 'c'])"), centres, "itemAt follows it too, each item answered where it now lies");
		assert.notDeepEqual(await page("[page.centre('b-back'), page.centre('b-dot'), page.centre('c')]"), moved, "every item moved on the screen");
		const dot = await page("page.centre('b-dot')");
		await recorded("presses");
		await press(dot);
		const [pressed] = await recorded("presses");
		assert.deepEqual([pressed.target, pressed.of, pressed.at], ["b-dot", DOT, DOT], "a trusted press where the item now lies");
		assert.deepEqual(await page("page.reframe('0 0 200 150')"), before);
	});
}
