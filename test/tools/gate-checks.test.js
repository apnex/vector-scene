// gate-checks - the gate's own checks (I12) can fail: the vocabulary check and the runtime check
// (SNAP-GRID.md section 7.2, as input-capture widened it), its platform-member pass held to VS1's slice,
// input-binding's clock and chance check, adopted as written, and the source check (INPUT-CAPTURE.md
// section 7) each pass over this repository and fail over a copy holding what it exists to refuse.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { candidateWords, findVocabulary, readVocabulary, splitWords } from "../../tools/check-vocabulary.mjs";
import { findClockAndChance } from "../../tools/check-clock-and-chance.mjs";
import { ALLOWED_GLOBALS, findRuntimeUses, freeGlobalReferences, parseModule, PLATFORM_SLICE, platformMemberNames } from "../../tools/check-runtime.mjs";
import { findConfigProblems, findSourceProblems, sourceProblems } from "../../tools/check-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const run = (tool, ...args) => spawnSync(process.execPath, [path.join(root, "tools", tool), ...args], { encoding: "utf8" });
const scratch = (files) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vector-scene-check-"));
	for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
	return dir;
};

test("I12: the vocabulary check splits identifiers at case changes, underscores, hyphens and digits, and also compares each whole", () => {
	assert.deepEqual(splitWords("nodeCount NODE_EXT zone-keys HTMLLayout zone2 drawV2"), ["node", "count", "node", "ext", "zone", "keys", "html", "layout", "zone", "2", "draw", "v", "2"]);
	assert.deepEqual(candidateWords("draw_V2"), ["draw_v2", "drawv2", "draw", "v", "2"]);
	const lists = readVocabulary();
	assert.deepEqual(findVocabulary("// the anchor of a thing", lists).map((f) => f.word), ["anchor"]);
	assert.deepEqual(findVocabulary('const s = "Keyboard";', lists).map((f) => [f.word, f.consumer]), [["keyboard", "gesture-tester"]]);
	assert.deepEqual(findVocabulary("const route = group(key, mouse, bend, draw, nodal, linkage, keys, groups);", lists), [], "ordinary words, and words that merely contain a listed one, pass");
});

test("I12: plurals, digits and a case change inside a word are caught; a run of lower-case letters is not", () => {
	const lists = readVocabulary();
	const caught = (text) => findVocabulary(text, lists).map((f) => f.listed);
	assert.deepEqual(caught("const zones = [];"), ["zone"]);
	assert.deepEqual(caught("// nodes and glyphes"), ["node", "glyph"]);
	assert.deepEqual(caught("export const drawV2 = 1;"), ["drawv2"]);
	assert.deepEqual(caught("const draw_v2 = 1;"), ["drawv2"]);
	assert.deepEqual(caught("let zone2 = 0;"), ["zone"]);
	assert.deepEqual(caught("class ZoneGrid {}"), ["zone"]);
	assert.deepEqual(caught("const zonegrid = 0;"), [], "a listed word inside one run of lower-case letters is not caught: no dictionary splits it");
	for (const control of ["group", "route", "key", "nodal", "keys", "drawing", "linked"]) assert.deepEqual(caught(`const ${control} = 1;`), [], control);
});

test("I12: the vocabulary check passes over src, and fails on a word of draw's in a comment, a string or code", () => {
	assert.equal(run("check-vocabulary.mjs").status, 0);
	for (const text of ["// snaps a waypoint\nexport const a = 1;\n", 'export const a = "zone";\n', "export const layoutName = 1;\n", "/* the DIAGRAM */\n"]) {
		const dir = scratch({ "a.ts": text });
		try {
			const r = run("check-vocabulary.mjs", dir);
			assert.equal(r.status, 1, text);
			assert.match(r.stdout, /FAIL/);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

test("I12: the traps section 7 names for an SVG component are caught -- the DOM's Node and Node.js, <a>'s link and anchor, SVG's glyph, a page's layout -- and no contract name of section 3 holds a listed word", () => {
	const lists = readVocabulary();
	const caught = (text) => findVocabulary(text, lists).map((f) => f.listed);
	assert.deepEqual(caught("// not a DOM Node"), ["node"]);
	assert.deepEqual(caught("// a child node of the root"), ["node"]);
	assert.deepEqual(caught("// runs in Node.js and a browser"), ["node"]);
	assert.deepEqual(caught("const parentNode = 1;"), ["node"], "the platform's own member name");
	assert.deepEqual(caught("// an <a> element is a link or an anchor"), ["link", "anchor"]);
	assert.deepEqual(caught("// xlink:href"), [], "xlink is one run of lower-case letters, which no dictionary splits");
	assert.deepEqual(caught("// SVG's <glyph> element"), ["glyph"]);
	assert.deepEqual(caught("// lays out a page's layout"), ["layout"]);
	assert.deepEqual(caught("// see https://example.com/link/page"), ["link"]);
	assert.deepEqual(caught("// a keyboard shortcut"), ["keyboard"]);
	assert.deepEqual(caught("const anchorPoint = 1; // layout"), ["anchor", "layout"]);
	assert.deepEqual(caught("// a shape, an element, an item, a layer, lays out, a key, a point"), []);
	const names = `openScene root layers name attrs foreign ok scene problems pointer problem not-an-object unknown-property
missing-property invalid-value duplicate-name layers put remove items itemOf layerElement toDrawing toScreen close tag
text children before key shapes path layer x y ownerDocument appendChild getScreenCTM createElementNS setAttribute
removeAttribute insertBefore textContent inverse a b c d e f declared-scene keyed-shapes shape-at-element
screen-conversion vector-scene item shape element description place point transform screen drawing open closed failed
writes platform slice scene layer foreign layer attribute record svg namespace`;
	assert.deepEqual(findVocabulary(names, lists), []);
});

test("I12, VS1: the runtime check's platform members are lib.dom.d.ts's, and VS1's slice is the only part of them a built file may name", () => {
	const members = platformMemberNames();
	assert.ok(members.size > 500, `${members.size} platform members`);
	for (const name of ["getAttribute", "childNodes", "getBoundingClientRect", "parentNode", "querySelector", "children", "innerHTML", "firstChild", "attributes", "classList", "style", "getTotalLength", "elementFromPoint", "createElement", "getElementById", "transformPoint", "multiply"]) {
		assert.ok(members.has(name), `${name} is a platform member`);
	}
	for (const name of Object.values(PLATFORM_SLICE).flat()) assert.ok(members.has(name), `${name}, of the slice, is a platform member the check allows`);
	assert.deepEqual(PLATFORM_SLICE, {
		root: ["ownerDocument", "appendChild", "getScreenCTM"],
		document: ["createElementNS"],
		element: ["setAttribute", "removeAttribute", "appendChild", "insertBefore", "remove", "textContent"],
		transform: ["inverse", "a", "b", "c", "d", "e", "f"],
		point: ["x", "y"],
	});
});

test("I12, VS1: the runtime check fails on a platform member outside the slice -- getAttribute, childNodes, getBoundingClientRect -- by dot, brackets, destructuring, in and Reflect; and passes the slice, a point's x and an array's length", () => {
	const finding = (name) => `names ${name}, a platform member outside VS1's slice`;
	const planted = [
		["export const a = (el) => el.getAttribute(\"x\");\n", "getAttribute"],
		["export const b = (el) => el.childNodes;\n", "childNodes"],
		["export const c = (el) => el.getBoundingClientRect();\n", "getBoundingClientRect"],
		["export const d = (el) => el[\"childNodes\"];\n", "childNodes"],
		["export const e = (el) => el?.getAttribute(\"x\");\n", "getAttribute"],
		["export const f = ({ getBoundingClientRect }) => getBoundingClientRect;\n", "getBoundingClientRect"],
		["export const g = (el) => { const { childNodes: kids } = el; return kids; };\n", "childNodes"],
		["export const h = (el) => \"getAttribute\" in el;\n", "getAttribute"],
		["export const i = (el) => Reflect.get(el, \"childNodes\");\n", "childNodes"],
		["export const j = (el) => el[`getBoundingClientRect`]();\n", "getBoundingClientRect"],
		["export const k = (el) => el.parentNode.removeChild(el);\n", "parentNode"],
		["export const l = (el) => { let kids; ({ childNodes: kids } = el); return kids; };\n", "childNodes"],
	];
	for (const [text, name] of planted) assert.ok(findRuntimeUses(text).some((f) => f.finding === finding(name)), text);
	const clean = [
		"export const a = (point) => point.x + point.y;\n",
		"export const b = (list) => list.length + list.map((v) => v).length;\n",
		"export const c = (root) => root.ownerDocument.createElementNS(\"http://www.w3.org/2000/svg\", \"g\");\n",
		"export const d = (el, kid) => { el.setAttribute(\"a\", \"1\"); el.removeAttribute(\"a\"); el.appendChild(kid); el.insertBefore(kid, null); el.textContent = \"\"; kid.remove(); };\n",
		"export const e = (m) => m.inverse().a + m.b + m.c + m.d + m.e + m.f;\n",
		"// getAttribute, childNodes and getBoundingClientRect in a comment\nexport const f = \"el.getAttribute(childNodes)\";\n",
		"export const g = (map, key) => map.get(key) ?? map.has(key);\n",
	];
	for (const text of clean) assert.deepEqual(findRuntimeUses(text), [], text);
	// each plant a file of its own in one copy, run through the tool once: each must be reported
	const dir = scratch(Object.fromEntries(planted.map(([text], i) => [`member-${String(i).padStart(2, "0")}.js`, text])));
	try {
		const r = run("check-runtime.mjs", dir);
		assert.equal(r.status, 1);
		planted.forEach(([text], i) => assert.match(r.stdout, new RegExp(`member-${String(i).padStart(2, "0")}\\.js:\\d+  names \\w+, a platform member outside VS1's slice`), text));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I12, VS1: a DOM member outside the slice named as the literal key of Object.getOwnPropertyDescriptor, Object.hasOwn, Object.defineProperty, Reflect.has, Reflect.get, in, or hasOwnProperty is found as a read is; a variable key and a slice member pass", () => {
	const finding = (name) => `names ${name}, a platform member outside VS1's slice`;
	const planted = [
		["export const a = (el) => Object.getOwnPropertyDescriptor(el, \"childNodes\");\n", "childNodes"],
		["export const b = (el) => Object.hasOwn(el, \"getAttribute\");\n", "getAttribute"],
		["export const c = (el) => Object.defineProperty(el, \"innerHTML\", { value: \"\" });\n", "innerHTML"],
		["export const d = (el) => Reflect.has(el, \"getBoundingClientRect\");\n", "getBoundingClientRect"],
		["export const e = (el) => Reflect.get(el, `parentNode`);\n", "parentNode"],
		["export const f = (el) => Reflect.getOwnPropertyDescriptor(el, \"firstChild\");\n", "firstChild"],
		["export const g = (el) => \"querySelector\" in el;\n", "querySelector"],
		["export const h = (el) => el.hasOwnProperty(\"children\");\n", "children"],
		["export const i = (el) => Object.prototype.hasOwnProperty.call(el, \"classList\");\n", "classList"],
		["export const j = (el) => el.propertyIsEnumerable(\"style\");\n", "style"],
		["export const k = (el) => el.__lookupGetter__(\"attributes\");\n", "attributes"],
	];
	for (const [text, name] of planted) assert.deepEqual(findRuntimeUses(text).map((f) => f.finding), [finding(name)], text);
	const clean = [
		"export const a = (value, name) => Object.getOwnPropertyDescriptor(value, name) ?? Reflect.getOwnPropertyDescriptor(value, \"length\");\n",
		"export const b = (point) => Object.hasOwn(point, \"x\") && Reflect.has(point, \"y\") && \"x\" in point;\n",
		"export const c = (attrs, name) => Object.defineProperty(attrs, name, { value: \"1\" });\n",
		"export const d = (el, text) => Reflect.set(el, \"textContent\", text) && Reflect.get(el, \"remove\");\n",
		"export const e = (record) => record.hasOwnProperty(\"tag\") && Object.hasOwn(record, \"children\" + \"\");\n",
	];
	for (const text of clean) assert.deepEqual(findRuntimeUses(text), [], text);
});

test("I12: the runtime check allows only the globals the build uses -- exactly the built-ins its built files name -- so a platform global fails however it is named", () => {
	const named = new Set();
	for (const file of fs.readdirSync(path.join(root, "dist")).filter((f) => f.endsWith(".js"))) {
		for (const { name } of freeGlobalReferences(parseModule(fs.readFileSync(path.join(root, "dist", file), "utf8"), file))) named.add(name);
	}
	assert.deepEqual([...named].sort(), [...ALLOWED_GLOBALS].sort(), "the allow-list is exactly the globals the built files name");
	const finding = (name) => `names the global ${name}, which is none of the built-ins the build uses`;
	const globals = ["MessageChannel", "EventSource", "Worker", "SharedWorker", "BroadcastChannel", "RTCPeerConnection", "Atomics", "SharedArrayBuffer", "WebSocket", "XMLHttpRequest", "fetch", "navigator", "location", "localStorage", "indexedDB", "postMessage", "structuredClone", "queueMicrotask", "Promise", "Proxy", "Symbol", "Date", "Intl", "WeakRef", "arguments"];
	for (const name of globals) {
		assert.deepEqual(findRuntimeUses(`export const planted = () => ${name};\n`).map((f) => f.finding), [finding(name)], name);
	}
	assert.deepEqual(findRuntimeUses("export const a = new MessageChannel();\n").map((f) => f.finding), [finding("MessageChannel")], "constructed");
	assert.deepEqual(findRuntimeUses("export const a = typeof Worker;\n").map((f) => f.finding), [finding("Worker")], "under typeof");
	assert.deepEqual(findRuntimeUses("export const a = { Atomics };\n").map((f) => f.finding), [finding("Atomics")], "a shorthand property is a reference");
	assert.deepEqual(findRuntimeUses("export function f() { return Worker; }\nfunction g() { const Worker = 1; return Worker; }\nexport { g };\n").map((f) => [f.line, f.finding]), [[1, finding("Worker")]], "a name declared in another scope does not cover this one");
	const clean = [
		`export const a = () => [${ALLOWED_GLOBALS.join(", ")}];\n`,
		"const Worker = 1; export const a = Worker;\n",
		"export const a = (MessageChannel) => MessageChannel;\n",
		"export function f({ EventSource }) { return EventSource; }\n",
		"export const a = (x) => x.Worker + x?.Atomics + ({ BroadcastChannel: 1 }).BroadcastChannel;\n",
		"// MessageChannel, Worker and Atomics in a comment\nexport const s = \"new Worker(MessageChannel)\";\n",
		"export class Atomics2 { method() { return this.RTCPeerConnection; } }\n",
		"label: for (;;) { break label; }\nexport {};\n",
		"try { void 0; } catch (error) { void error; }\nexport {};\n",
		"import { Worker } from \"./worker.js\";\nexport const w = Worker;\n",
	];
	for (const text of clean) assert.deepEqual(findRuntimeUses(text), [], text);
	const dir = scratch(Object.fromEntries(globals.slice(0, 7).map((name, i) => [`global-${i}.js`, `export const planted = () => ${name};\n`])));
	try {
		const r = run("check-runtime.mjs", dir);
		assert.equal(r.status, 1);
		globals.slice(0, 7).forEach((name, i) => assert.match(r.stdout, new RegExp(`global-${i}\\.js:1  names the global ${name},`)));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I12, VS1: getAttribute, childNodes and getBoundingClientRect planted in a copy of the built files are each found", () => {
	for (const [plant, name] of [["export const planted = (el) => el.getAttribute(\"id\");\n", "getAttribute"], ["export const planted = (el) => el.childNodes.length;\n", "childNodes"], ["export const planted = (el) => el.getBoundingClientRect().x;\n", "getBoundingClientRect"]]) {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vector-scene-dist-"));
		try {
			fs.cpSync(path.join(root, "dist"), dir, { recursive: true });
			const file = path.join(dir, "scene-writing.js");
			fs.writeFileSync(file, `${fs.readFileSync(file, "utf8")}\n${plant}`);
			const r = run("check-runtime.mjs", dir);
			assert.equal(r.status, 1, name);
			assert.match(r.stdout, new RegExp(`scene-writing\\.js:\\d+  names ${name}, a platform member outside VS1's slice`));
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

test("I12: the runtime check passes over dist, and fails on a bare or node: import, a dynamic import, or a runtime's global", () => {
	assert.equal(run("check-runtime.mjs").status, 0);
	const bad = [
		'import fs from "node:fs";\n',
		'import { x } from "some-package";\n',
		'export { y } from "@scope/pkg/sub";\n',
		'import "side-effect";\n',
		'const m = await import("./a.js");\n',
		"export const g = globalThis;\n",
		"export const p = process.env;\n",
		"const r = require;\n",
		"const b = Buffer.from([]);\n",
		"export const w = typeof window;\n",
		"export const d = document;\n",
		"export const s = self;\n",
		"export const t = `${global.x}`;\n",
		"const r = /'/; const p = process.env;\n",
		"if (Math.PI) /'/.test(''); globalThis.x = 1; //'\n",
		"{} /'/.test(''); process.exit(); //'\n",
		"export const o = { self: 1 };\n",
		'export const e = eval("this");\n',
		"const F = Function; export const g = F(\"return this\")();\n",
		'export const n = new Function("return this")();\n',
		'export const c = (() => 0).constructor("return this")();\n',
		'export const b = (() => 0)["constructor"]("return this")();\n',
		'export const k = new (function () {}).constructor("return this")();\n',
	];
	// every plant a file of its own in one copy, run through the tool once: each must be reported
	const dir = scratch(Object.fromEntries(bad.map((text, i) => [`plant-${String(i).padStart(2, "0")}.js`, text])));
	try {
		const r = run("check-runtime.mjs", dir);
		assert.equal(r.status, 1);
		bad.forEach((text, i) => assert.match(r.stdout, new RegExp(`plant-${String(i).padStart(2, "0")}\\.js:`), text));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I12: the runtime check reads names in code only, never in comments or strings, nor as members", () => {
	const clean = '// globalThis, process and require( in a comment\nimport { a } from "./a.js";\nconst options = {}, b = 1, c = 2;\nexport * from "../b.js";\nconst s = "window document self";\nconst q = \'process\';\nconst t = `import("x") ${a.process}`;\nconst o = { x: options.self };\nconst d = a / b / c;\nconst r = [/"/g, /\\//];\n/* Buffer */\n';
	assert.deepEqual(findRuntimeUses(clean), []);
	assert.deepEqual(findRuntimeUses("const t = `a ${globalThis.x} b`;\n").map((f) => f.finding), ["names globalThis"]);
	assert.deepEqual(findRuntimeUses("const r = /'/; const p = process.env;\n").map((f) => f.finding), ["names process"], "a quote inside a regular expression begins no string");
	assert.deepEqual(findRuntimeUses("const s = 'process';\n"), [], "a name inside a string is not a finding");
	assert.deepEqual(findRuntimeUses("const g = global; const r = require;\n").map((f) => f.finding), ["names global", "names require"], "contextual keywords are names too");
	assert.deepEqual(findRuntimeUses("if (Math.PI) /'/.test(''); globalThis.x = 1; //'\n").map((f) => f.finding), ["names globalThis"], "a regular expression after ) is no division");
	assert.deepEqual(findRuntimeUses("{} /'/.test(''); process.exit(); //'\n").map((f) => f.finding), ["names process"], "a regular expression after a block's } is no division");
	assert.deepEqual(findRuntimeUses("const o = { self: 1 };\n").map((f) => f.finding), ["names self"], "an object-literal key is counted");
	assert.deepEqual(findRuntimeUses("const a = {}; const m = import.meta.url; const n = a?.process;\n"), [], "import.meta is no dynamic import, and an optional member is a member");
	assert.deepEqual(findRuntimeUses('const x = {}, y = {}, o = {}; const a = x.eval; const b = y.Function; const s = "eval(Function)"; const c = o.constructor; const d = o.constructor === Object; // eval\n'), [], "eval and Function as members, in strings and comments, and a constructor read but not called, pass");
	assert.deepEqual(findRuntimeUses('const g = eval("this");\n').map((f) => f.finding), ["names eval"]);
	assert.deepEqual(findRuntimeUses('const g = new Function("return this")();\n').map((f) => f.finding), ["names Function"]);
	assert.deepEqual(findRuntimeUses('const f = () => 0; const g = f.constructor("return this")();\n').map((f) => f.finding), ["calls through a property named constructor, which reaches Function"]);
	assert.throws(() => findRuntimeUses('const s = "open;\n'), /could not parse/);
});

test("I12: the clock and chance check passes over dist, and fails on a clock, a timer, chance or a network planted in a built file -- by bracket or by destructuring too", () => {
	assert.equal(run("check-clock-and-chance.mjs").status, 0);
	const bad = [
		"export const a = Date.now();\n",
		"export const b = Math.random();\n",
		'export const c = Math["random"]();\n',
		"const { random } = Math; export const d = random();\n",
		"const { random: chance } = Math; export const e = chance();\n",
		"let r; ({ random: r } = Math); export const f = r();\n",
		"const m = Math; export const g = m.random();\n",
		'export const h = Math["max"](1, 2);\n',
		"export const i = [Math][0].random();\n",
		"const { now } = Date; export const j = now();\n",
		"const { now } = performance; export const k = now();\n",
		"export const l = performance.now();\n",
		"setTimeout(() => 0, 1);\n",
		"queueMicrotask(() => 0);\n",
		"export const n = crypto.getRandomValues(new Uint8Array(1));\n",
		"export const o = new Date();\n",
		"export const p = `${Math[`random`]()}`;\n",
		"function q({ random } = Math) { return random(); }\nexport { q };\n",
		"export const r = new Intl.DateTimeFormat().format();\n",
		"const { DateTimeFormat } = Intl; export const s = DateTimeFormat;\n",
		"export const u = Temporal.Now.instant();\n",
		"export const v = new WeakRef({});\n",
		"export const w = new FinalizationRegistry(() => 0);\n",
	];
	for (const text of bad) assert.ok(findClockAndChance(text).length > 0, text);
	// every plant a file of its own in one copy, run through the tool once: each must be reported
	const dir = scratch(Object.fromEntries(bad.map((text, i) => [`plant-${String(i).padStart(2, "0")}.js`, text])));
	try {
		const r = run("check-clock-and-chance.mjs", dir);
		assert.equal(r.status, 1);
		assert.match(r.stdout, /FAIL/);
		bad.forEach((text, i) => assert.match(r.stdout, new RegExp(`plant-${String(i).padStart(2, "0")}\\.js:`), text));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I12: the clock and chance check reads code only, and passes a direct member access by identifier", () => {
	const clean = [
		"export const a = Math.max(1, 2);\n",
		"export const b = Math.min(...[3, 4]) + Math.floor(1.5) + Math.abs(-1);\n",
		"// Date.now(), Math.random() and setTimeout in a comment\nexport const c = 'Math.random() and Date.now()';\n",
		"export const d = options.Date + record.performance + x.random;\n",
		"const { random } = other; export const e = random;\n",
		"export const f = options.Intl + record.Temporal + held.WeakRef + held.FinalizationRegistry;\n",
		"// Intl.DateTimeFormat, Temporal.Now, new WeakRef and FinalizationRegistry in a comment\nexport const g = 'Intl Temporal WeakRef';\n",
	];
	for (const text of clean) assert.deepEqual(findClockAndChance(text), [], text);
	assert.deepEqual(findClockAndChance('export const c = Math["random"]();\n').map((f) => f.finding), ["reads Math.random by brackets", "uses Math as a value, not as a direct member access by identifier"]);
	assert.deepEqual(findClockAndChance("const { random } = Math; random();\n").map((f) => f.finding), ["destructures from Math", "uses Math as a value, not as a direct member access by identifier"]);
	assert.throws(() => findClockAndChance('const s = "open;\n'), /could not parse/);
});

/** A copy of the repository's src/ and tsconfig.json, with `plant` applied, checked by the source check. */
function sourceCheckOf(plant) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vector-scene-source-"));
	try {
		fs.cpSync(path.join(root, "src"), path.join(dir, "src"), { recursive: true });
		fs.copyFileSync(path.join(root, "tsconfig.json"), path.join(dir, "tsconfig.json"));
		plant(dir);
		return { problems: sourceProblems(dir), run: run("check-source.mjs", dir) };
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

test("I12: the source check passes over this repository", () => {
	assert.deepEqual(sourceProblems(root), []);
	assert.equal(run("check-source.mjs").status, 0);
});

test("I12: the source check fails on every declare form planted in src -- var, let, const, function, class, enum, namespace, module, global, type, interface, a class field", () => {
	const forms = [
		["const", "declare const window: any;\nexport {};\n"],
		["let", "declare let x: number;\nexport {};\n"],
		["var", "declare var x: number;\nexport {};\n"],
		["function", "declare function f(): void;\nexport {};\n"],
		["class", "declare class C {}\nexport {};\n"],
		["enum", "declare enum E { A }\nexport {};\n"],
		["namespace", "declare namespace N {}\nexport {};\n"],
		["module", "declare module \"m\" {}\nexport {};\n"],
		["global", "declare global { var x: number; }\nexport {};\n"],
		["type", "declare type T = number;\nexport {};\n"],
		["interface", "declare interface I {}\nexport {};\n"],
		["class field", "export class C { declare x: number; }\n"],
	];
	for (const [kind, text] of forms) assert.deepEqual(findSourceProblems(text).map((f) => f.finding), [`declares with \`declare\` (${kind})`], kind);
	// three of them planted in a copy of the repository and run through the tool, as the gate runs it
	for (const [kind, text] of forms.filter(([kind]) => ["const", "global", "class field"].includes(kind))) {
		const { problems, run: r } = sourceCheckOf((dir) => fs.writeFileSync(path.join(dir, "src", "planted.ts"), text));
		assert.ok(problems.some((p) => p.startsWith("src/planted.ts:") && p.includes("declare")), `${kind}: ${problems.join("; ")}`);
		assert.equal(r.status, 1);
		assert.match(r.stdout, /FAIL/);
	}
});

test("I12: the source check fails on `declare const window: any;` and `/// <reference lib=\"dom\" />` planted in an existing src file", () => {
	for (const plant of ["declare const window: any;\n", '/// <reference lib="dom" />\n']) {
		const { problems, run: r } = sourceCheckOf((dir) => {
			const file = path.join(dir, "src", "conversion.ts");
			fs.writeFileSync(file, plant + fs.readFileSync(file, "utf8"));
		});
		assert.equal(r.status, 1, plant);
		assert.ok(problems.some((p) => p.startsWith("src/conversion.ts:1:")), problems.join("; "));
		if (plant.startsWith("///")) assert.ok(problems.some((p) => p.includes("lib.dom.d.ts, a platform library")), "TypeScript's own program would compile the DOM library");
	}
});

test("I12: the source check finds a triple-slash directive's form after a template literal with a substitution, and at the end of a source file that holds one", () => {
	// a bare scanner reads a template's text after its first substitution as code, so the comments after it went unseen
	assert.ok(findSourceProblems('export const a = `${1}`;\n/// <reference lib="dom" />\n').some((f) => f.line === 2 && f.finding.includes("triple-slash")));
	assert.ok(findSourceProblems('export function f(n: number) {\n\tconst t = `${n}`;\n\t/// <reference types="web" />\n\treturn t;\n}\n').some((f) => f.line === 3));
	assert.deepEqual(findSourceProblems("export const a = `${1}\n/// <reference lib=\"dom\" />\n`;\n"), [], "the form inside a template's text is no comment");
	assert.deepEqual(findSourceProblems("/// no directive here\nexport {};\n"), [], "a triple-slash comment of no directive's form passes");
	const { problems, run: r } = sourceCheckOf((dir) => {
		const file = path.join(dir, "src", "conversion.ts");
		fs.writeFileSync(file, `${fs.readFileSync(file, "utf8")}/// <reference lib="dom" />\n`);
	});
	assert.equal(r.status, 1);
	assert.ok(problems.some((p) => /^src\/conversion\.ts:\d+: holds a comment of a triple-slash directive's form$/.test(p)), problems.join("; "));
});

test("I12: the source check fails on every triple-slash directive, a declaration file, and a file that is no ES module", () => {
	for (const text of ['/// <reference lib="dom" />\nexport {};\n', '/// <reference types="web" />\nexport {};\n', '/// <reference path="./x.d.ts" />\nexport {};\n', '/// <reference no-default-lib="true" />\nexport {};\n', 'export const a = 1;\n/// <reference lib="dom" />\n']) {
		assert.ok(findSourceProblems(text).some((f) => f.finding.includes("triple-slash")), text);
	}
	assert.deepEqual(findSourceProblems('export const s = "/// <reference lib=\\"dom\\" />";\n'), [], "the form inside a string is no directive");
	assert.ok(findSourceProblems("interface Window { x: number }\n").some((f) => f.finding.includes("no ES module")));
	assert.ok(findSourceProblems("const s = ;\nexport {};\n").some((f) => f.finding.includes("could not parse")));
	const { problems } = sourceCheckOf((dir) => fs.writeFileSync(path.join(dir, "src", "globals.d.ts"), "export {};\n"));
	assert.ok(problems.includes("src/globals.d.ts: is a declaration file"), problems.join("; "));
});

test("I12: the source check fails on tsconfig settings that would bring a DOM library back", () => {
	const good = { compilerOptions: { lib: ["ES2022"], types: [] }, include: ["src"] };
	assert.deepEqual(findConfigProblems(good), []);
	const bad = [
		{ ...good, compilerOptions: { lib: ["ES2022", "DOM"], types: [] } },
		{ ...good, compilerOptions: { types: [] } },
		{ ...good, compilerOptions: { lib: ["ES2022"] } },
		{ ...good, compilerOptions: { lib: ["ES2022"], types: ["web"] } },
		{ ...good, compilerOptions: { lib: ["ES2022"], types: [], typeRoots: ["./types"] } },
		{ ...good, extends: "./base.json" },
		{ ...good, files: ["globals.d.ts"] },
		{ ...good, include: ["src", "globals.d.ts"] },
		{ ...good, references: [{ path: "../other" }] },
	];
	for (const config of bad) assert.ok(findConfigProblems(config).length > 0, JSON.stringify(config));
	const { problems, run: r } = sourceCheckOf((dir) => {
		const file = path.join(dir, "tsconfig.json");
		const config = JSON.parse(fs.readFileSync(file, "utf8"));
		delete config.compilerOptions.lib;
		fs.writeFileSync(file, JSON.stringify(config));
	});
	assert.equal(r.status, 1);
	assert.ok(problems.some((p) => p.startsWith("tsconfig.json: compilerOptions.lib")), problems.join("; "));
	assert.ok(problems.some((p) => p.includes("lib.dom.d.ts")), "with no lib, the target's default libraries bring the DOM back, and the program check sees it");
});
