// beside-0.1.0 - I15 (GR1): beside the 0.1.0 release, 0.1.0's contract tables give the same answers and
// calls but for the changes VS12's closing paragraph lists. Each table below is run once against the 0.1.0
// release's built files, kept byte for byte in test/fixtures/v0.1.0/ (docs/DECISIONS.md, D3), and once
// against this build, each run over a fresh platform; every answer, every error's constructor and message,
// every platform call and every read a recording Proxy logs is transcribed, and the two transcripts must be
// equal once this build's listed changes are taken out, each counted where it is taken:
// - the scene's keys hold itemAt, after itemOf;
// - the root's document's elementsFromPoint is read as the scene opens, after createElementNS -- the read
//   that refuses a root whose getter throws, which 0.1.0 opened (held on its own below).
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";

import { openScene as openScene020 } from "@apnex/vector-scene";
import { openScene as openScene010 } from "../fixtures/v0.1.0/index.js";
import { fakeRoot, matrix } from "../support/fake-dom.js";
import { randomOperation, randomTools, seededRandom } from "../support/generate.js";
import { recordingPlatform } from "../support/recording-platform.js";
import { phantom, recorded, revoked, trapping } from "../support/recording-proxy.js";

const SCENE_KEYS_010 = ["layers", "put", "remove", "items", "itemOf", "layerElement", "toDrawing", "toScreen", "close"];
const EXTRA_READ = "document get elementsFromPoint";

/**
 * A run of a table against one release: `note(label, thunk)` transcribes what the thunk answers or throws,
 * `logged(label, log)` a log's entries, and `names` labels values -- a recording platform's elements -- that
 * must be named without being read.
 */
function transcriber(open, release) {
	const entries = [];
	const names = new WeakMap();
	const counts = { sceneKeys: 0, extraReads: 0 };
	const describe = (value, seen = new Set()) => {
		if (typeof value === "number") return Object.is(value, -0) ? "number -0" : `number ${value}`;
		if (typeof value === "bigint") return `bigint ${value}`;
		if (typeof value === "symbol") return `symbol ${String(value)}`;
		if (typeof value !== "object" && typeof value !== "function") return `${typeof value} ${String(value)}`;
		if (value === null) return "null";
		if (names.has(value)) return names.get(value);
		if (typeof value === "function") return `function ${value.name}${Object.isFrozen(value) ? " frozen" : ""}`;
		if (value instanceof Error) return `${Object.getPrototypeOf(value).constructor.name}: ${value.message}`;
		if (Object.hasOwn(value, "serial") && Object.hasOwn(value, "tag")) return `element ${value.tag} ${value.serial}`;
		if (seen.has(value)) return "cycle";
		seen.add(value);
		let keys = Reflect.ownKeys(value);
		if (release === "0.2.0" && keys.includes("itemAt")) {
			// the listed change: the scene gains itemAt after itemOf, and nothing else
			assert.deepEqual(keys, [...SCENE_KEYS_010.slice(0, 5), "itemAt", ...SCENE_KEYS_010.slice(5)], "the scene's keys, itemAt after itemOf");
			keys = keys.filter((key) => key !== "itemAt");
			counts.sceneKeys++;
		}
		const frozen = Object.isFrozen(value) ? "frozen " : "";
		const prototype = Object.getPrototypeOf(value) === Array.prototype ? "array" : Object.getPrototypeOf(value) === Object.prototype ? "object" : "other";
		return `${frozen}${prototype} {${keys.map((key) => `${String(key)}: ${describe(value[key], seen)}`).join(", ")}}`;
	};
	/** Transcribes what the thunk answers or throws, and answers the value itself, or undefined when it threw. */
	const note = (label, thunk) => {
		let value, answer;
		try {
			value = thunk();
			answer = { answered: describe(value) };
		} catch (error) {
			answer = { threw: describe(error) };
		}
		entries.push([label, answer]);
		return value;
	};
	const logged = (label, log) => {
		let lines = log.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry, (k, v) => (Object.is(v, -0) ? "-0" : v))));
		if (release === "0.2.0") {
			// the listed change: elementsFromPoint read once as the scene opens, directly after createElementNS
			lines = lines.filter((line, index) => {
				if (line !== EXTRA_READ) return true;
				assert.equal(lines[index - 1], "document get createElementNS", `${label}: elementsFromPoint read directly after createElementNS`);
				counts.extraReads++;
				return false;
			});
		} else assert.ok(!lines.includes(EXTRA_READ), "0.1.0 never reads elementsFromPoint");
		entries.push([label, { log: lines }]);
	};
	return { open, note, logged, names, entries, counts };
}

/** Runs `table` against both releases and answers both transcripts, 0.2.0's with its listed changes taken out and counted. */
function beside(table) {
	const older = transcriber(openScene010, "0.1.0");
	const newer = transcriber(openScene020, "0.2.0");
	table(older);
	table(newer);
	return { older, newer };
}

const LAYERS = [{ name: "back", attrs: { id: "back", class: "b", n: -0 } }, { name: "items" }, { name: "free", foreign: true, attrs: { id: "free" } }];
const otherRealm = (source) => vm.runInNewContext(`(${source})`);
const member = (overrides) => ({ ownerDocument: { createElementNS() {} }, appendChild() {}, getScreenCTM() {}, ...overrides });

/** VS3's table of declarations, I1's cases among them; each made afresh for each run. */
const DECLARATIONS = [
	() => undefined, () => null, () => 0, () => "layers", () => [], () => () => 0, () => new Map(),
	() => Object.create({ layers: [{ name: "a" }] }), () => otherRealm("{ layers: [{ name: 'a' }] }"),
	() => revoked({ layers: [{ name: "a" }] }), () => trapping({ layers: [{ name: "a" }] }, "ownKeys"), () => trapping({ layers: [{ name: "a" }] }, "getOwnPropertyDescriptor"),
	() => ({}), () => ({ layers: [{ name: "a" }], zeta: 1, alpha: undefined, "a/b~c": 0 }), () => ({ layer: [{ name: "a" }] }),
	() => phantom({ layers: [{ name: "a" }] }, "extra"), () => phantom({ layers: [{ name: "a" }] }, "root"), () => ({ layers: [{ name: "a" }], [Symbol("s")]: 1 }),
	() => ({ root: undefined, layers: [{ name: "a" }] }), () => ({ root: 5, layers: [{ name: "a" }] }), () => ({ root: () => 0, layers: [{ name: "a" }] }), () => ({ root: {}, layers: [{ name: "a" }] }),
	() => ({ root: member({ ownerDocument: null }), layers: [{ name: "a" }] }), () => ({ root: member({ ownerDocument: {} }), layers: [{ name: "a" }] }),
	() => ({ root: member({ ownerDocument: { createElementNS: "f" } }), layers: [{ name: "a" }] }), () => ({ root: member({ appendChild: {} }), layers: [{ name: "a" }] }),
	() => ({ root: member({ getScreenCTM: 1 }), layers: [{ name: "a" }] }), () => ({ root: revoked(member({})), layers: [{ name: "a" }] }), () => ({ root: trapping(member({}), "get"), layers: [{ name: "a" }] }),
	() => ({ root: member({}), layers: [{ name: "a" }] }), () => ({ root: Object.create(fakeRoot().root), layers: [{ name: "a" }] }),
	() => ({ layers: undefined }), () => ({ layers: {} }), () => ({ layers: [] }), () => ({ layers: [{ name: "a" }, , { name: "b" }] }), () => ({ layers: Object.assign([{ name: "a" }], { more: 1 }) }), // eslint-disable-line no-sparse-arrays
	() => ({ layers: otherRealm("[{ name: 'a' }]") }), () => ({ layers: trapping([{ name: "a" }], "ownKeys") }),
	() => ({ layers: [5] }), () => ({ layers: [[]] }), () => ({ layers: [Object.create({ name: "a" })] }), () => ({ layers: [{}] }), () => ({ layers: [{ name: "a", z: 1, b: 2 }] }),
	() => ({ layers: [{ name: "" }] }), () => ({ layers: [{ name: 5 }] }), () => ({ layers: [{ name: "a", foreign: "yes" }] }), () => ({ layers: [{ name: "a", attrs: 5 }] }),
	() => ({ layers: [{ name: "a", attrs: { onload: "x" } }] }), () => ({ layers: [{ name: "a", attrs: { x: NaN } }] }), () => ({ layers: [{ name: "a", attrs: { "xlink:href": "#", onclick: 1, y: null } }] }),
	() => ({ layers: [5, { name: "" }, { x: 1 }] }), () => ({ layers: [{ name: 7, foreign: 1, attrs: 2, extra: 3 }] }),
	() => ({ layers: [{ name: "a" }, { name: "a" }, { name: "a", foreign: true }] }), () => ({ layers: Array.from({ length: 12 }, () => ({ name: "x" })) }),
	() => ({ layers: [{ name: "a", attrs: { n: 2, z: -0, s: "x" } }, { name: "b" }, { name: "c", foreign: true }] }),
];

test("I15: VS3's table of declarations gives 0.1.0's problems, in order, and 0.1.0's open scene", () => {
	const { older, newer } = beside((run) => {
		DECLARATIONS.forEach((make, index) => {
			run.note(`declaration ${index}`, () => run.open(make()));
		});
	});
	assert.deepEqual(newer.entries, older.entries);
	assert.ok(newer.counts.sceneKeys >= 4, `${newer.counts.sceneKeys} scenes`);
});

test("I15: VS2 rule 2's reading order -- the declaration, the root's members and the layers, each read logged by a recording Proxy -- is 0.1.0's but for elementsFromPoint read after createElementNS", () => {
	const { older, newer } = beside((run) => {
		const log = [];
		const { root: fake } = fakeRoot();
		const document = recorded(fake.ownerDocument, "document", log);
		const root = recorded(Object.assign(Object.create(null), { ownerDocument: document, appendChild: fake.appendChild, getScreenCTM: fake.getScreenCTM }), "root", log);
		const layers = recorded([recorded({ foreign: false, attrs: recorded({ id: "a", n: 1 }, "attrs0", log), name: "a" }, "layer0", log), recorded({ name: "b", foreign: true }, "layer1", log)], "layers", log);
		run.note("opened", () => run.open(recorded({ layers, root }, "declaration", log)).ok);
		run.logged("reads", log);
		const refused = [];
		const refusing = recorded({ ownerDocument: recorded({ createElementNS: 5 }, "document", refused), appendChild() {}, getScreenCTM() {} }, "root", refused);
		run.note("refused", () => run.open({ root: refusing, layers: [{ name: "a", foreign: "no" }] }));
		run.logged("refused reads", refused);
	});
	assert.deepEqual(newer.entries, older.entries);
	assert.equal(newer.counts.extraReads, 1, "elementsFromPoint read once, and not after a refused createElementNS");
});

/** A rooted scene over a fake platform, 0.1.0's slice -- no elementsFromPoint, as draw's harness's fake document -- with every answer, call and element transcribed. */
function generatedSequences(run, seed) {
	const platform = fakeRoot();
	const live = run.note("open", () => run.open({ root: platform.root, layers: LAYERS })).scene;
	const rootless = run.note("open rootless", () => run.open({ layers: LAYERS })).scene;
	run.logged("open calls", platform.log.splice(0));
	const rnd = seededRandom(seed);
	const { int, pick } = randomTools(rnd);
	const ever = new Set();
	for (let n = 0; n < 150; n++) {
		const layer = pick(["back", "items"]);
		const op = randomOperation(rnd, live.items(layer).map((item) => item.key));
		for (const [which, target] of [["rooted", live], ["rootless", rootless]]) {
			run.note(`${n} ${which} ${op.kind}`, () => (op.kind === "put" ? target.put(layer, op.key, op.shapes, op.place) : target.remove(layer, op.key)));
			run.note(`${n} ${which} items`, () => [target.items("back"), target.items("items")]);
		}
		run.logged(`${n} calls`, platform.log.splice(0));
		for (const element of platform.root.children.flatMap((layerElement) => [layerElement, ...walk(layerElement)])) ever.add(element);
		if (n % 10 === 0) {
			for (const element of ever) run.note(`${n} itemOf ${element.serial}`, () => live.itemOf(element));
			const point = { x: int(-50, 50), y: int(-50, 50) };
			run.note(`${n} toDrawing`, () => live.toDrawing(point));
			run.note(`${n} toScreen`, () => live.toScreen(point));
			run.note(`${n} layerElement`, () => live.layerElement("free"));
		}
	}
	run.note("close", () => live.close());
	run.logged("close calls", platform.log.splice(0));
	run.note("closed again", () => live.close());
	run.note("rootless close", () => rootless.close());
}
const walk = (element) => element.children.flatMap((child) => [child, ...walk(child)]);

test("I15: generated puts, moves and removals over 0.1.0's fake document give 0.1.0's answers, platform calls, itemOf answers and conversions, rooted and rootless", () => {
	for (const seed of [3, 17, 2026]) {
		const { older, newer } = beside((run) => generatedSequences(run, seed));
		assert.deepEqual(newer.entries, older.entries, `seed ${seed}`);
		assert.ok(older.entries.length > 1000, `seed ${seed}: ${older.entries.length} entries`);
	}
});

test("I15: Errors -- each function's malformed argument, a getter's or trap's error, a state that does not allow the call, re-entry while writing, and a platform's throw -- give 0.1.0's errors and calls", () => {
	const { older, newer } = beside((run) => {
		const platform = fakeRoot();
		const scene = run.open({ root: platform.root, layers: LAYERS }).scene;
		const malformed = [
			["put", [5, "a", [{ tag: "g" }]]], ["put", ["free", "a", [{ tag: "g" }]]], ["put", ["items", "", [{ tag: "g" }]]], ["put", ["items", "a", "g"]], ["put", ["items", "a", []]],
			["put", ["items", "a", [{ tag: "g" }], null]], ["put", ["items", "a", [{ tag: "g" }], { before: "a" }]], ["put", ["items", "a", [{ tag: "g", attrs: { onclick: "x" } }]]],
			["put", ["items", "a", [{ tag: "g", text: "", children: [] }]]], ["put", ["items", "a", [trapping({ tag: "g" }, "ownKeys", "hidden")]]], ["put", ["items", "a", [{ tag: "g" }], { before: "none" }]],
			["remove", ["nothing", "a"]], ["remove", ["items", null]], ["items", [undefined]], ["items", ["free"]], ["layerElement", ["items"]], ["layerElement", [{}]],
			["toDrawing", [null]], ["toDrawing", [{ x: 1, y: "2" }]], ["toScreen", [[1, 2]]], ["toDrawing", [{ get x() { throw new Error("hidden"); }, y: 0 }]],
		];
		for (const [fn, args] of malformed) run.note(`${fn} ${args.length}`, () => scene[fn](...args));
		run.logged("calls", platform.log.splice(0));
		// a platform throw at each call of opening, before and after its effect
		for (let at = 1; at <= 9; at++) {
			for (const phase of ["before", "after"]) {
				const throwing = fakeRoot();
				let calls = 0;
				throwing.hooks[phase] = (entry) => {
					if (entry[0] !== "remove" && ++calls === at) throw new Error(`at ${at} ${phase}`);
				};
				run.note(`open throws ${at} ${phase}`, () => run.open({ root: throwing.root, layers: LAYERS }));
				run.logged(`open throws ${at} ${phase} calls`, throwing.log);
			}
		}
		// a throw while writing fails the scene; re-entry while writing is refused; close removes in reverse
		const writing = fakeRoot();
		const failing = run.open({ root: writing.root, layers: LAYERS }).scene;
		failing.put("items", "a", [{ tag: "g" }, { tag: "rect" }]);
		writing.hooks.before = (entry) => {
			if (entry[0] === "set") {
				writing.hooks.before = undefined;
				for (const [fn, args] of [["put", ["items", "x", [{ tag: "g" }]]], ["items", ["items"]], ["itemOf", [{}]], ["toDrawing", [{ x: 0, y: 0 }]], ["close", []]]) run.note(`re-entered ${fn}`, () => failing[fn](...args));
				throw new Error("the platform throws");
			}
		};
		run.note("failing put", () => failing.put("items", "a", [{ tag: "g", attrs: { x: 1 } }, { tag: "circle" }]));
		for (const [fn, args] of [["put", ["items", "b", [{ tag: "g" }]]], ["remove", ["items", "a"]], ["items", ["items"]], ["itemOf", [{}]], ["layerElement", ["free"]], ["toDrawing", [{ x: 0, y: 0 }]], ["toScreen", [{ x: 0, y: 0 }]]]) run.note(`failed ${fn}`, () => failing[fn](...args));
		run.note("failed close", () => failing.close());
		run.logged("failing calls", writing.log);
		// close's removals throwing, and every function once closed
		const closing = fakeRoot();
		const closed = run.open({ root: closing.root, layers: LAYERS }).scene;
		closing.hooks.before = (entry) => {
			if (entry[0] === "remove" && entry[1] === 2) throw new Error("a removal throws");
		};
		run.note("close throws", () => closed.close());
		for (const [fn, args] of [["put", ["items", "b", [{ tag: "g" }]]], ["remove", ["items", "a"]], ["items", ["items"]], ["itemOf", [5]], ["layerElement", ["free"]], ["toDrawing", [{ x: 0, y: 0 }]], ["toScreen", [{ x: NaN, y: 0 }]]]) run.note(`closed ${fn}`, () => closed[fn](...args));
		run.logged("closing calls", closing.log);
		// a document answering no element, and elements lacking methods
		const answering = fakeRoot();
		answering.root.ownerDocument.createElementNS = () => null;
		run.note("no element", () => run.open({ root: answering.root, layers: LAYERS }));
		const bare = fakeRoot();
		const make = bare.root.ownerDocument.createElementNS;
		let broken = false;
		bare.root.ownerDocument.createElementNS = (namespace, tag) => (broken ? {} : make(namespace, tag));
		const bareScene = run.open({ root: bare.root, layers: LAYERS }).scene;
		broken = true;
		run.note("bare put", () => bareScene.put("items", "a", [{ tag: "g", attrs: { x: 1 } }]));
		run.logged("bare calls", bare.log);
		// with no root
		const rootless = run.open({ layers: LAYERS }).scene;
		for (const [fn, args] of [["layerElement", ["free"]], ["toDrawing", [{ x: 1, y: 2 }]], ["toScreen", [{ x: 1, y: 2 }]], ["itemOf", [{}]]]) run.note(`rootless ${fn}`, () => rootless[fn](...args));
	});
	assert.deepEqual(newer.entries, older.entries);
});

test("I15: VS10's conversions over recorded transforms -- extremes, -0, a singular inverse, members not numbers, throwing getters, an overflow -- give 0.1.0's answers and reads", () => {
	const transforms = [
		{ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }, { a: -0, b: 1, c: -1, d: -0, e: 0, f: -0 }, { a: 1e300, b: 0, c: 0, d: 1e300, e: 0, f: 0 },
		{ a: 0, b: 0, c: 0, d: 0, e: 1, f: 1 }, { a: 1, b: 0, c: 0, d: 1, e: "0", f: 0 }, { a: 1, b: 0, c: 0, d: 1, e: 0, f: NaN },
	];
	const points = [{ x: 0, y: 0 }, { x: -0, y: 5e-324 }, { x: 1.7976931348623157e308, y: 1 }, { x: -12.5, y: 3 }, { x: NaN, y: 0 }, { x: 1, y: Infinity }];
	const { older, newer } = beside((run) => {
		for (const [t, ctm] of transforms.entries()) {
			const platform = fakeRoot(ctm);
			const scene = run.open({ root: platform.root, layers: LAYERS }).scene;
			for (const [p, point] of points.entries()) {
				run.note(`${t} ${p} toDrawing`, () => scene.toDrawing(point));
				run.note(`${t} ${p} toScreen`, () => scene.toScreen(point));
			}
			run.logged(`${t} calls`, platform.log);
		}
		const odd = [() => null, () => 5, () => ({ ...matrix({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), inverse: 5 }), () => ({ ...matrix({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), inverse: () => null })];
		for (const [i, answer] of odd.entries()) {
			const platform = fakeRoot();
			platform.root.getScreenCTM = answer;
			const scene = run.open({ root: platform.root, layers: LAYERS }).scene;
			run.note(`odd ${i} toDrawing`, () => scene.toDrawing({ x: 1, y: 2 }));
			run.note(`odd ${i} toScreen`, () => scene.toScreen({ x: 1, y: 2 }));
		}
		const log = [];
		const platform = fakeRoot();
		platform.root.getScreenCTM = () => recorded(matrix({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }), "transform", log);
		const scene = run.open({ root: platform.root, layers: LAYERS }).scene;
		run.note("recorded toScreen", () => scene.toScreen(recorded({ x: 1, y: 2 }, "point", log)));
		run.logged("recorded reads", log);
	});
	assert.deepEqual(newer.entries, older.entries);
});

test("I15: I3's recording platform, whose document holds no elementsFromPoint, logs 0.1.0's reads and calls but for elementsFromPoint read once as the scene opens", () => {
	const { older, newer } = beside((run) => {
		const { root, log } = recordingPlatform();
		const opened = run.open({ root, layers: [{ name: "back", attrs: { id: "back" } }, { name: "items" }, { name: "free", foreign: true }] });
		const { scene } = opened;
		run.names.set(scene.layerElement("free"), "the free layer's element");
		scene.put("items", "a", [{ tag: "g", attrs: { id: "a" }, children: [{ tag: "rect", attrs: { x: 1 } }, { tag: "text", text: "hi" }] }]);
		scene.put("items", "b", [{ tag: "circle", attrs: { r: 2 } }]);
		scene.put("items", "a", [{ tag: "g", attrs: { id: "a", class: "on" }, children: [{ tag: "rect" }, { tag: "path", attrs: { d: "M0 0" } }] }]);
		scene.put("items", "b", [{ tag: "circle", attrs: { r: 2 } }], { before: "a" });
		scene.remove("items", "a");
		run.note("toDrawing", () => scene.toDrawing({ x: 12, y: 24 }));
		run.note("toScreen", () => scene.toScreen({ x: 1, y: 2 }));
		run.note("close", () => scene.close());
		run.logged("log", log);
	});
	assert.deepEqual(newer.entries, older.entries);
	assert.equal(newer.counts.extraReads, 1);
});

test("I15, the listed change: a root whose document's elementsFromPoint getter throws, which 0.1.0 opened, is refused, invalid-value at /root", () => {
	const root = () => member({
		ownerDocument: {
			createElementNS: fakeRoot().root.ownerDocument.createElementNS,
			get elementsFromPoint() {
				throw new Error("the getter throws");
			},
		},
	});
	assert.equal(openScene010({ root: root(), layers: [{ name: "a" }] }).ok, true, "0.1.0 opened it");
	assert.deepEqual(openScene020({ root: root(), layers: [{ name: "a" }] }), { ok: false, problems: [{ pointer: "/root", problem: "invalid-value" }] });
	const { createElementNS } = fakeRoot().root.ownerDocument;
	const opened = openScene020({ root: member({ ownerDocument: { createElementNS, elementsFromPoint: 5 } }), layers: [{ name: "a" }] });
	assert.equal(opened.ok, true, "a value that is no function opens, as 0.1.0 opened it");
});
