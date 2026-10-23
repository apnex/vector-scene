// real-chrome - I10 (CONTRACT.md; VECTOR-SCENE.md section 4 and section 7): in headless Chrome, on a page
// whose root is an SVG element scaled, letterboxed and offset in its page (i10-page.html): puts, patches,
// moves and removals leave each layer's elements equal to what items answers, as I4 compares them; an
// element kept across a sibling item's insertion keeps a running transition; a trusted press, dispatched
// through the DevTools protocol's Input domain, on a child shape, on an item's own shape, on the ground and
// in a foreign layer is mapped by itemOf of its target to that item and path, or null; toDrawing and
// toScreen equal DOMPoint's matrixTransform over the root's screen transform for thousands of points; and
// close leaves the root as found.
//
// The gate runs it on every push: Chrome is launched as the consumer test launches it, with a profile and
// a debugging port of its own (chrome-driver.js), and driven over Node.js's global WebSocket. Where a
// Node.js has no global WebSocket -- 22.0 to 22.3, which keep it behind a flag -- the file runs itself
// again with --experimental-websocket.
//
// Every test and hook has a timeout, so a hang fails rather than runs on; the after hook ends Chrome's
// whole process group and closes the server in finally blocks, so its cleanup can neither fail the run
// nor leave a handle holding it open.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { launchChrome, serveRepository, sleep } from "./chrome-driver.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

if (typeof globalThis.WebSocket !== "function") {
	test("I10, run again with --experimental-websocket, since this Node.js keeps its WebSocket behind the flag", () => {
		const run = spawnSync(process.execPath, ["--experimental-websocket", "--test", fileURLToPath(import.meta.url)], { stdio: "inherit", timeout: 300000, killSignal: "SIGKILL" });
		assert.equal(run.status, 0);
	});
} else {
	let chrome, server;
	const TEST = { timeout: 60000 };
	const page = async (expression) => JSON.parse(await chrome.evaluate(`JSON.stringify(${expression})`));

	before(async () => {
		server = await serveRepository(root);
		chrome = await launchChrome();
		await chrome.send("Page.enable");
		await chrome.send("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
		await chrome.send("Page.navigate", { url: `${server.origin}/test/browser/i10-page.html` });
		for (let i = 0; i < 200 && !(await chrome.evaluate("globalThis.page?.ready === true")); i++) await sleep(50);
		assert.equal(await chrome.evaluate("globalThis.page?.ready === true"), true, "the page opened its scene");
		assert.equal(await page("page.refused"), null, "openScene accepted an SVG element as the root");
	}, { timeout: 60000 });

	after(async () => {
		try {
			await chrome?.close();
		} finally {
			await server?.close();
		}
	}, { timeout: 30000 });

	const press = async ([x, y]) => {
		await chrome.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0 });
		await chrome.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
		await chrome.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
	};
	/** The presses recorded since the last call, read once the count has held still for 100 milliseconds, or after 3 seconds. */
	const presses = async () => {
		let count = -1;
		for (let waited = 0; waited < 3000; waited += 50) {
			await sleep(50);
			const now = await chrome.evaluate("page.presses.length");
			if (now === count && waited >= 100) break;
			count = now;
		}
		return page("page.presses.splice(0)");
	};

	test("I10, VS3: the layers are made in the SVG namespace, their attributes set, and appended after the ground the root held", TEST, async () => {
		assert.deepEqual(await page("page.appended()"), [
			{ local: "rect", svg: true, attrs: [["id", "ground"], ["x", "-100"], ["y", "-50"], ["width", "200"], ["height", "100"], ["fill", "#eee"]] },
			{ local: "g", svg: true, attrs: [["id", "back"]] },
			{ local: "g", svg: true, attrs: [["id", "items"], ["class", "items"]] },
			{ local: "g", svg: true, attrs: [] },
			{ local: "g", svg: true, attrs: [["id", "free"]] },
		]);
	});

	test("I10, I4: generated puts, patches, moves and removals leave each layer's elements equal to items after every call, an element made holding its attributes in description order", TEST, async () => {
		let calls = 0;
		let peak = 0;
		for (let seed = 1; seed <= 12; seed++) {
			const result = await page(`page.sequence(${seed}, 50)`);
			assert.deepEqual(result.out, [], `seed ${seed}`);
			calls += result.calls;
			peak = Math.max(peak, result.elements);
		}
		assert.equal(calls, 600);
		assert.ok(peak > 20, `${peak} elements at the most`);
		assert.deepEqual(await page("page.clear()"), [0, 0, 0]);
	});

	test("I10: an element kept across a sibling item's insertion, and across a patch of its own, keeps its running transition", TEST, async () => {
		const result = await page("page.transition()");
		assert.equal(result.start, "1");
		assert.deepEqual(result.before, { count: 1, type: "CSSTransition", state: "running" }, "the patch of its style started a transition");
		assert.equal(result.kept, true, "the very element is still the one under its id");
		assert.deepEqual(result.order, ["s", "circle", "t", "u"], "the sibling item inserted before it, another after");
		assert.equal(result.afterCount, 1);
		assert.equal(result.same, true, "the same transition object");
		assert.equal(result.state, "running");
		assert.deepEqual(result.itemOf, { layer: "back", key: "t", path: [0] });
		assert.deepEqual(await page("page.clear()"), [0, 0, 0]);
	});

	test("I10, VS9: a trusted press on a child shape, an item's own shape, the ground and a foreign layer's content is mapped by itemOf of its target to its item and path, or null", TEST, async () => {
		const at = await page("page.targets()");
		await presses();
		for (const point of [at.inner, at.own, at.ground, at.dot]) await press(point);
		const got = await presses();
		assert.deepEqual(got, [
			{ target: "inner", trusted: true, at: { layer: "top", key: "group", path: [0, 1] } },
			{ target: "own", trusted: true, at: { layer: "top", key: "own", path: [0] } },
			{ target: "ground", trusted: true, at: null },
			{ target: "dot", trusted: true, at: null },
		]);
		assert.deepEqual(await page("[page.scene.itemOf(document.getElementById('root')), page.scene.itemOf(document.getElementById('free')), page.scene.itemOf(document.getElementById('group').firstChild), page.scene.itemOf(document)]"), [null, null, { layer: "top", key: "group", path: [0, 0] }, null]);
	});

	test("I10, VS10: toDrawing and toScreen equal DOMPoint's matrixTransform over the root's screen transform, under Object.is, for thousands of points, and follow the transform as it changes", TEST, async () => {
		const first = await page("page.conversions(5, 3000)");
		assert.deepEqual(first.out, []);
		assert.deepEqual(first.matrix, [2.185, 0, 0, 2.185, 258.5, 170], "scaled by 2.185, offset to the root's place and letterboxed down 40.75 px");
		assert.ok(first.compared > 5000 && first.refused >= 20, `${first.compared} compared, ${first.refused} refused where DOMPoint is not finite`);
		await chrome.evaluate("document.getElementById('root').setAttribute('width', '523'); document.getElementById('root').style.left = '17.5px'; void document.body.offsetWidth");
		const second = await page("page.conversions(6, 3000)");
		assert.deepEqual(second.out, []);
		assert.notDeepEqual(second.matrix, first.matrix);
		assert.ok(second.compared > 5000);
	});

	test("I10, VS3: close leaves the root as found, answers undefined twice, and every other function then throws", TEST, async () => {
		assert.equal(await chrome.evaluate("String(page.scene.close())"), "undefined");
		assert.equal(await chrome.evaluate("String(page.scene.close())"), "undefined");
		assert.equal(await chrome.evaluate("document.getElementById('root').innerHTML === page.found"), true);
		assert.equal(await chrome.evaluate("document.getElementById('root').childElementCount"), 1);
		assert.equal(await chrome.evaluate("(() => { try { page.scene.items('back'); return 'answered'; } catch (e) { return e.message.split(':')[0]; } })()"), "items");
	});
}
