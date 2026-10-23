// declared-scene - VS2 to VS4 (I1, I2): a scene opened from declared layers, on a root or with none, or
// refused with every problem; the declaration read breadth first in VS2 rule 2's order; the lifecycle --
// layers made and appended in order, taken back when the platform throws, closed by removing exactly what
// was added, failed when the platform throws while the scene writes, and not re-entrant while it writes.
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";

import { openScene } from "@apnex/vector-scene";
import { fakeElement, fakeRoot, treeOf } from "../support/fake-dom.js";
import { isFrozenToDepth } from "../support/frozen.js";
import { phantom, recorded, revoked, trapping } from "../support/recording-proxy.js";

const LAYERS = [{ name: "back", attrs: { id: "back", class: "b" } }, { name: "items" }, { name: "free", foreign: true, attrs: { id: "free" } }];
const problemsOf = (declaration) => {
	const result = openScene(declaration);
	assert.equal(result.ok, false, "refused");
	return result.problems.map(({ pointer, problem }) => `${problem} ${pointer}`);
};
const accessor = () => ({ get: () => assert.fail("a declaration's getter ran"), enumerable: true });
const withAccessor = (object, key) => Object.defineProperty(object, key, { get: () => assert.fail(`a getter of ${key} ran`), enumerable: true });
const goodRoot = () => fakeRoot().root;
const otherRealm = (source) => vm.runInNewContext(`(${source})`);

test("VS3 step 1, I1: a declaration that is not a plain object, or whose reflection throws, is not-an-object at \"\" and nothing else, nothing further read", () => {
	const cases = [undefined, null, 0, "layers", true, 1n, Symbol("s"), [], [{ name: "a" }], () => 0, new Map(), Object.create({ layers: [{ name: "a" }] }), otherRealm("{ layers: [{ name: 'a' }] }"), revoked({ layers: [{ name: "a" }] }), trapping({ layers: [{ name: "a" }] }, "ownKeys"), trapping({ layers: [{ name: "a" }] }, "getPrototypeOf"), trapping({ layers: [{ name: "a" }] }, "getOwnPropertyDescriptor")];
	for (const declaration of cases) assert.deepEqual(problemsOf(declaration), ["not-an-object "], String(typeof declaration));
	const log = [];
	const declaration = recorded({ layers: recorded([{ name: "a" }], "layers", log), extra: 1 }, "declaration", log, {
		getOwnPropertyDescriptor() {
			throw new Error("the descriptor read throws");
		},
	});
	assert.deepEqual(problemsOf(declaration), ["not-an-object "]);
	assert.deepEqual(log, ["declaration getPrototypeOf", "declaration ownKeys", "declaration getOwnPropertyDescriptor layers"], "nothing further read, no unknown-property beside it");
	const nullProto = Object.assign(Object.create(null), { layers: [{ name: "a" }] });
	assert.equal(openScene(nullProto).ok, true, "a null prototype is a plain object");
});

test("VS3 step 2: an own property other than root and layers is unknown-property, one each; layers absent is missing-property; a phantom key known by its key alone", () => {
	assert.deepEqual(problemsOf({}), ["missing-property /layers"]);
	assert.deepEqual(problemsOf({ root: goodRoot() }), ["missing-property /layers"]);
	assert.deepEqual(problemsOf({ layers: [{ name: "a" }], zeta: 1, alpha: undefined, "a/b~c": 0 }), ["unknown-property /alpha", "unknown-property /a~1b~0c", "unknown-property /zeta"], "by pointer, by UTF-16 code unit: l before ~");
	assert.deepEqual(problemsOf({ layer: [{ name: "a" }] }), ["unknown-property /layer", "missing-property /layers"]);
	assert.deepEqual(problemsOf(phantom({ layers: [{ name: "a" }] }, "extra")), ["unknown-property /extra"], "a key the form does not name, known by its key alone");
	assert.equal(openScene(phantom({ layers: [{ name: "a" }] }, "root")).ok, true, "a phantom root is absent");
	assert.deepEqual(problemsOf(phantom({}, "layers")), ["missing-property /layers"], "a phantom layers is absent");
	assert.equal(openScene({ layers: [{ name: "a" }], [Symbol("s")]: 1 }).ok, true, "a symbol-named property is ignored");
});

test("VS3 step 3, I1: root an accessor, not an object, a function, or lacking each member in turn is invalid-value at /root, the reading of root stopping at the first refused", () => {
	const layers = [{ name: "a" }];
	const document = { createElementNS() {} };
	const member = (overrides) => ({ ownerDocument: document, appendChild() {}, getScreenCTM() {}, ...overrides });
	const roots = [
		undefined,
		null,
		5,
		"svg",
		() => 0,
		{},
		member({ ownerDocument: undefined }),
		member({ ownerDocument: null }),
		member({ ownerDocument: () => 0 }),
		member({ ownerDocument: {} }),
		member({ ownerDocument: { createElementNS: "f" } }),
		member({ appendChild: undefined }),
		member({ appendChild: {} }),
		member({ getScreenCTM: undefined }),
		member({ getScreenCTM: 1 }),
		Object.defineProperty(member({}), "appendChild", {
			get() {
				throw new Error("appendChild's getter throws");
			},
		}),
		revoked(member({})),
		trapping(member({}), "get"),
	];
	for (const root of roots) assert.deepEqual(problemsOf({ root, layers }), ["invalid-value /root"]);
	assert.deepEqual(problemsOf(Object.defineProperty({ layers }, "root", accessor())), ["invalid-value /root"], "an accessor root, no getter run");
	const inherited = Object.create(goodRoot());
	assert.equal(openScene({ root: inherited, layers }).ok, true, "a root's members are read through ordinary property access, a browser's being inherited");
	const log = [];
	const root = recorded({ ownerDocument: recorded({ createElementNS: 5 }, "document", log), appendChild() {}, getScreenCTM() {} }, "root", log);
	assert.deepEqual(problemsOf({ root, layers: [{ name: "a", foreign: "no" }] }), ["invalid-value /layers/0/foreign", "invalid-value /root"]);
	assert.deepEqual(log, ["root get ownerDocument", "document get createElementNS"], "appendChild and getScreenCTM unread once createElementNS is refused");
});

test("VS3 step 4: layers an accessor, not an array of VS2's form, or empty is invalid-value at /layers", () => {
	const sparse = [{ name: "a" }, , { name: "b" }]; // eslint-disable-line no-sparse-arrays
	const extra = Object.assign([{ name: "a" }], { more: 1 });
	const cases = [undefined, null, {}, "a", [], sparse, extra, Object.setPrototypeOf([{ name: "a" }], Object.prototype), otherRealm("[{ name: 'a' }]"), revoked([{ name: "a" }]), trapping([{ name: "a" }], "ownKeys"), Object.defineProperty([], "0", { get: () => assert.fail("an index getter ran"), enumerable: true, configurable: true })];
	for (const layers of cases) assert.deepEqual(problemsOf({ layers }), ["invalid-value /layers"]);
	assert.deepEqual(problemsOf(Object.defineProperty({}, "layers", accessor())), ["invalid-value /layers"]);
	assert.deepEqual(problemsOf({ layers: [], other: 1 }), ["invalid-value /layers", "unknown-property /other"]);
});

test("VS3 steps 5 to 7, I1: each layer refusal at its own pointer, suppressing every check beneath it and none at a sibling's", () => {
	const cases = [
		[[5], ["not-an-object /layers/0"]],
		[[null], ["not-an-object /layers/0"]],
		[[[]], ["not-an-object /layers/0"]],
		[[() => 0], ["not-an-object /layers/0"]],
		[[Object.create({ name: "a" })], ["not-an-object /layers/0"]],
		[[otherRealm("{ name: 'a' }")], ["not-an-object /layers/0"]],
		[[revoked({ name: "a" })], ["not-an-object /layers/0"]],
		[[trapping({ name: "a" }, "getOwnPropertyDescriptor")], ["not-an-object /layers/0"]],
		[[{}], ["missing-property /layers/0/name"]],
		[[{ name: "a", z: 1, b: 2 }], ["unknown-property /layers/0/b", "unknown-property /layers/0/z"]],
		[[{ nam: "a" }], ["unknown-property /layers/0/nam", "missing-property /layers/0/name"], "a pointer before a longer one it begins"],
		[[{ name: "" }], ["invalid-value /layers/0/name"]],
		[[{ name: 5 }], ["invalid-value /layers/0/name"]],
		[[{ name: undefined }], ["invalid-value /layers/0/name"]],
		[[withAccessor({}, "name")], ["invalid-value /layers/0/name"]],
		[[{ name: "a", foreign: "yes" }], ["invalid-value /layers/0/foreign"]],
		[[{ name: "a", foreign: undefined }], ["invalid-value /layers/0/foreign"]],
		[[withAccessor({ name: "a" }, "foreign")], ["invalid-value /layers/0/foreign"]],
		[[{ name: "a", attrs: 5 }], ["not-an-object /layers/0/attrs"]],
		[[{ name: "a", attrs: undefined }], ["not-an-object /layers/0/attrs"]],
		[[{ name: "a", attrs: [] }], ["not-an-object /layers/0/attrs"]],
		[[{ name: "a", attrs: new Map() }], ["not-an-object /layers/0/attrs"]],
		[[{ name: "a", attrs: otherRealm("{ id: 'a' }") }], ["not-an-object /layers/0/attrs"]],
		[[{ name: "a", attrs: revoked({}) }], ["not-an-object /layers/0/attrs"]],
		[[withAccessor({ name: "a" }, "attrs")], ["not-an-object /layers/0/attrs"]],
		[[{ name: "a", attrs: { onload: "x" } }], ["invalid-value /layers/0/attrs"]],
		[[{ name: "a", attrs: { x: NaN } }], ["invalid-value /layers/0/attrs"]],
		[[{ name: "a", attrs: withAccessor({}, "x") }], ["invalid-value /layers/0/attrs"]],
		[[{ name: "a", attrs: { "xlink:href": "#", onclick: 1, y: null } }], ["invalid-value /layers/0/attrs"], "attrs refused whole, nothing beneath it checked"],
		[[5, { name: "" }, { x: 1 }], ["not-an-object /layers/0", "invalid-value /layers/1/name", "missing-property /layers/2/name", "unknown-property /layers/2/x"]],
		[[{ name: 7, foreign: 1, attrs: 2, extra: 3 }], ["not-an-object /layers/0/attrs", "unknown-property /layers/0/extra", "invalid-value /layers/0/foreign", "invalid-value /layers/0/name"]],
	];
	for (const [layers, expected, label] of cases) assert.deepEqual(problemsOf({ layers }), expected, label ?? JSON.stringify(expected));
});

test("VS3 step 8: among valid names, one equal to an earlier one is duplicate-name at the later one's name; a duplicate beside an invalid one", () => {
	assert.deepEqual(problemsOf({ layers: [{ name: "a" }, { name: "a" }, { name: "a", foreign: true }] }), ["duplicate-name /layers/1/name", "duplicate-name /layers/2/name"]);
	assert.deepEqual(problemsOf({ layers: [{ name: "a" }, { name: 5 }, { name: "a" }] }), ["invalid-value /layers/1/name", "duplicate-name /layers/2/name"]);
	assert.deepEqual(problemsOf({ layers: [{ name: "a", foreign: 1 }, { name: "a" }] }), ["invalid-value /layers/0/foreign", "duplicate-name /layers/1/name"], "a name valid beside an invalid foreign is still a name");
	assert.deepEqual(problemsOf({ layers: [5, { name: "a" }, { name: "a" }] }), ["not-an-object /layers/0", "duplicate-name /layers/2/name"]);
	const many = Array.from({ length: 12 }, () => ({ name: "x" }));
	assert.deepEqual(problemsOf({ layers: many }).slice(0, 3), ["duplicate-name /layers/1/name", "duplicate-name /layers/10/name", "duplicate-name /layers/11/name"], "ordered by pointer by UTF-16 code unit, so /layers/10 before /layers/2");
});

test("VS3, I1: openScene never throws while it judges a declaration, and calls no platform method on a declaration it refuses", () => {
	const { root, log } = fakeRoot();
	const hostile = [
		{ root, layers: [{ name: "a", attrs: trapping({}, "ownKeys") }] },
		{ root: trapping({}, "get"), layers: trapping([], "getPrototypeOf") },
		{ root, layers: [{ name: "a" }], extra: 1 },
		{ root, layers: [{ name: "a" }, { name: "a" }] },
		phantom({ root, layers: [phantom({ name: "a" }, "foreign", "attrs")] }, "zzz"),
	];
	for (const declaration of hostile) assert.doesNotThrow(() => openScene(declaration));
	assert.deepEqual(log, [], "nothing created for a refused declaration");
	const refused = openScene({ root, layers: [] });
	assert.ok(isFrozenToDepth(refused));
	assert.deepEqual(Object.keys(refused), ["ok", "problems"]);
	assert.deepEqual(Object.keys(refused.problems[0]), ["pointer", "problem"]);
});

test("VS2 rule 2: a declaration is read breadth first -- its descriptors, the root's members, then layers as an array, each layer whole before the next", () => {
	const log = [];
	const { root: fake } = fakeRoot();
	const document = recorded(fake.ownerDocument, "document", log);
	const root = recorded(Object.assign(Object.create(null), { ownerDocument: document, appendChild: fake.appendChild, getScreenCTM: fake.getScreenCTM }), "root", log);
	const attrs0 = recorded({ id: "a", n: 1 }, "attrs0", log);
	const layer0 = recorded({ foreign: false, attrs: attrs0, name: "a" }, "layer0", log);
	const layer1 = recorded({ name: "b", foreign: true }, "layer1", log);
	const layers = recorded([layer0, layer1], "layers", log);
	const declaration = recorded({ layers, root }, "declaration", log);
	const opened = openScene(declaration);
	assert.equal(opened.ok, true);
	const reads = log.filter((entry) => !entry.startsWith("root apply") && !entry.startsWith("document apply"));
	assert.deepEqual(reads.slice(0, 26), [
		"declaration getPrototypeOf",
		"declaration ownKeys",
		"declaration getOwnPropertyDescriptor root",
		"declaration getOwnPropertyDescriptor layers",
		"root get ownerDocument",
		"document get createElementNS",
		"root get appendChild",
		"root get getScreenCTM",
		"layers getPrototypeOf",
		"layers ownKeys",
		"layers getOwnPropertyDescriptor length",
		"layers getOwnPropertyDescriptor 0",
		"layers getOwnPropertyDescriptor 1",
		"layer0 getPrototypeOf",
		"layer0 ownKeys",
		"layer0 getOwnPropertyDescriptor name",
		"layer0 getOwnPropertyDescriptor attrs",
		"layer0 getOwnPropertyDescriptor foreign",
		"attrs0 getPrototypeOf",
		"attrs0 ownKeys",
		"attrs0 getOwnPropertyDescriptor id",
		"attrs0 getOwnPropertyDescriptor n",
		"layer1 getPrototypeOf",
		"layer1 ownKeys",
		"layer1 getOwnPropertyDescriptor name",
		"layer1 getOwnPropertyDescriptor foreign",
	]);
	assert.equal(reads.length, 26, "nothing of the declaration read again as the layers are made");
	const second = [];
	const refusedLayer = recorded({ name: "a", attrs: recorded({ id: "x" }, "attrs", second), other: 1 }, "layer", second, {
		ownKeys() {
			throw new Error("the layer's ownKeys throws");
		},
	});
	assert.deepEqual(problemsOf({ layers: [refusedLayer, { name: 5 }] }), ["not-an-object /layers/0", "invalid-value /layers/1/name"]);
	assert.deepEqual(second, ["layer getPrototypeOf", "layer ownKeys"], "nothing beneath a layer refused at its pointer is read; its sibling is");
});

test("VS3 lifecycle rule 1, VS4: with a root, each layer's <g> is made, its attributes set in order, and appended after what the root holds; layers is a frozen copy", () => {
	const { root, log } = fakeRoot();
	const ground = fakeElement("rect", 99, []);
	root.children.push(ground);
	ground.parent = root;
	const declared = [{ name: "back", attrs: { id: "back", class: "b", n: -0 } }, { name: "items" }, { name: "free", foreign: true, attrs: { id: "free" } }];
	const opened = openScene({ root, layers: declared });
	assert.equal(opened.ok, true);
	assert.deepEqual(log, [["create", "g", 1], ["set", 1, "id", "back"], ["set", 1, "class", "b"], ["set", 1, "n", "0"], ["append", 0, 1], ["create", "g", 2], ["append", 0, 2], ["create", "g", 3], ["set", 3, "id", "free"], ["append", 0, 3]]);
	assert.deepEqual(root.children.map((child) => child.serial), [99, 1, 2, 3]);
	const { scene } = opened;
	assert.deepEqual(scene.layers, [{ name: "back", attrs: { id: "back", class: "b", n: "0" }, foreign: false }, { name: "items", attrs: {}, foreign: false }, { name: "free", attrs: { id: "free" }, foreign: true }]);
	assert.deepEqual(scene.layers.map((layer) => Object.keys(layer)), [["name", "attrs", "foreign"], ["name", "attrs", "foreign"], ["name", "attrs", "foreign"]]);
	assert.ok(isFrozenToDepth(scene.layers));
	assert.equal(scene.layers, scene.layers, "the scene's own frozen copy");
	declared[0].attrs.id = "changed";
	declared.push({ name: "late" });
	assert.equal(scene.layers[0].attrs.id, "back", "nothing the application passes is kept");
	assert.equal(scene.layers.length, 3);
	assert.equal(scene.layerElement("free"), root.children[3]);
	for (const name of ["back", "items", "nothing", 5, null, undefined]) assert.throws(() => scene.layerElement(name), (e) => e.constructor === TypeError && e.message.startsWith("layerElement: "), String(name));
	for (const fn of ["items", "put", "remove"]) assert.throws(() => scene[fn]("free", "k", [{ tag: "g" }]), (e) => e.constructor === TypeError && e.message.startsWith(`${fn}: `), `${fn} refuses a foreign layer`);
	for (const fn of ["items", "put", "remove"]) assert.throws(() => scene[fn]("nothing", "k", [{ tag: "g" }]), (e) => e.constructor === TypeError && e.message.startsWith(`${fn}: `), `${fn} refuses an undeclared layer`);
	assert.deepEqual(scene.items("items"), []);
});

test("VS3 lifecycle rule 3, VS4: with no root the scene makes nothing and holds data alone; layerElement and the conversions refuse with Error", () => {
	const opened = openScene({ layers: LAYERS });
	assert.equal(opened.ok, true);
	const { scene } = opened;
	scene.put("items", "a", [{ tag: "g" }]);
	assert.deepEqual(scene.items("items"), [{ key: "a", shapes: [{ tag: "g", attrs: {} }] }]);
	assert.throws(() => scene.layerElement("free"), (e) => e.constructor === Error && e.message.startsWith("layerElement: "));
	assert.throws(() => scene.layerElement("back"), (e) => e.constructor === TypeError && e.message.startsWith("layerElement: "), "the name judged first");
	assert.throws(() => scene.toDrawing({ x: 1, y: 2 }), (e) => e.constructor === Error && e.message.startsWith("toDrawing: "));
	assert.throws(() => scene.toScreen({ x: 1, y: 2 }), (e) => e.constructor === Error && e.message.startsWith("toScreen: "));
	assert.equal(scene.close(), undefined);
	assert.equal(scene.close(), undefined);
});

/** Opens a scene whose platform throws at the `at`-th call of its opening, before or after that call's effect. */
function openThrowingAt(at, phase) {
	const platform = fakeRoot();
	const ground = fakeElement("rect", 99, []);
	platform.root.children.push(ground);
	ground.parent = platform.root;
	const thrown = new Error(`thrown at call ${at}, ${phase}`);
	let calls = 0;
	const removals = [];
	platform.hooks[phase] = (entry) => {
		if (entry[0] === "remove") removals.push(entry[1]);
		else if (++calls === at) throw thrown;
	};
	return { ...platform, thrown, removals, ground };
}

test("VS3 lifecycle rule 2, I2: a throw at each platform call of opening, before or after its effect, takes every layer back -- the one in progress first, then the others in reverse -- and throws that very error", () => {
	const opening = fakeRoot();
	openScene({ root: opening.root, layers: LAYERS });
	const calls = opening.log;
	assert.equal(calls.length, 9, "three creates, three attributes set, three appends");
	for (let at = 1; at <= calls.length; at++) {
		for (const phase of ["before", "after"]) {
			const { root, thrown, removals, ground } = openThrowingAt(at, phase);
			assert.throws(() => openScene({ root, layers: LAYERS }), (e) => e === thrown, `call ${at}, ${phase}`);
			assert.deepEqual(root.children, [ground], `call ${at}, ${phase}: the root as it was`);
			// the layers whose create came before the failing call; a failing create never answers its element
			const failing = calls[at - 1];
			const created = calls.slice(0, at).filter((entry) => entry[0] === "create").map((entry) => entry[2]);
			const answered = failing[0] === "create" ? created.slice(0, -1) : created;
			const inProgress = failing[0] === "create" ? [] : answered.slice(-1);
			const completed = failing[0] === "create" ? answered : answered.slice(0, -1);
			assert.deepEqual(removals, [...inProgress, ...completed.reverse()], `call ${at}, ${phase}: ${JSON.stringify(failing)}`);
		}
	}
});

test("VS3 lifecycle rule 2: every take-back is attempted when one throws, and the error first thrown is thrown, unchanged", () => {
	const { root, hooks } = fakeRoot();
	const first = new Error("the third layer's append throws");
	const removed = [];
	hooks.before = (entry) => {
		if (entry[0] === "append" && entry[2] === 3) throw first;
		if (entry[0] === "remove") {
			removed.push(entry[1]);
			if (entry[1] === 2) throw new Error("a take-back throws");
		}
	};
	assert.throws(() => openScene({ root, layers: LAYERS }), (e) => e === first);
	assert.deepEqual(removed, [3, 2, 1]);
	assert.deepEqual(root.children.map((child) => child.serial), [2], "a removal that threw leaves its layer, and only that");
	const answering = fakeRoot();
	answering.root.ownerDocument.createElementNS = () => null;
	assert.throws(() => openScene({ root: answering.root, layers: LAYERS }), (e) => e.constructor === Error && e.message.startsWith("openScene: "), "a createElementNS answering no element is a platform failure");
});

test("VS3 lifecycle rule 5, I2: close removes every layer in reverse, attempting each when one throws, then throws the first; a second close calls nothing", () => {
	const { root, log, hooks } = fakeRoot();
	const { scene } = openScene({ root, layers: LAYERS });
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect" }] }]);
	scene.layerElement("free").appendChild(fakeElement("canvas", 50, log));
	const first = new Error("the second removal throws");
	hooks.before = (entry) => {
		if (entry[0] === "remove" && entry[1] === 2) throw first;
		if (entry[0] === "remove" && entry[1] === 1) throw new Error("the third removal throws");
	};
	log.length = 0;
	assert.throws(() => scene.close(), (e) => e === first);
	assert.deepEqual(log, [["remove", 3], ["remove", 2], ["remove", 1]], "every layer element, in reverse; nothing beneath a layer removed of its own");
	log.length = 0;
	assert.equal(scene.close(), undefined);
	assert.deepEqual(log, [], "a second close calls nothing");
	const clean = fakeRoot();
	const ground = fakeElement("rect", 99, []);
	clean.root.children.push(ground);
	ground.parent = clean.root;
	const before = treeOf(clean.root);
	const opened = openScene({ root: clean.root, layers: LAYERS }).scene;
	opened.put("back", "z", [{ tag: "text", text: "t" }]);
	assert.equal(opened.close(), undefined);
	assert.deepEqual(treeOf(clean.root), before, "close leaves the root as found");
});

test("VS3 lifecycle rule 5, I2: a close made from inside a removal calls nothing; a put made there throws and, uncaught, is that removal's error", () => {
	const { root, log, hooks } = fakeRoot();
	const { scene } = openScene({ root, layers: LAYERS });
	let inner = "not called";
	let putError = null;
	hooks.before = (entry) => {
		if (entry[0] === "remove" && entry[1] === 3) {
			const mark = log.length;
			inner = scene.close();
			assert.equal(log.length, mark, "the inner close called nothing");
		}
		if (entry[0] === "remove" && entry[1] === 2) {
			try {
				scene.put("items", "a", [{ tag: "g" }]);
			} catch (error) {
				putError = error;
				throw error;
			}
		}
	};
	log.length = 0;
	assert.throws(() => scene.close(), (e) => e === putError && e.constructor === Error && e.message.startsWith("put: "));
	assert.equal(inner, undefined);
	assert.deepEqual(log, [["remove", 3], ["remove", 2], ["remove", 1]], "every removal still attempted");
	for (const [fn, args] of [["items", ["items"]], ["remove", ["items", "a"]], ["itemOf", [{}]], ["layerElement", ["free"]], ["toDrawing", [{ x: 0, y: 0 }]], ["toScreen", [{ x: 0, y: 0 }]]]) {
		assert.throws(() => scene[fn](...args), (e) => e.constructor === Error && e.message.startsWith(`${fn}: `), `${fn} once closed`);
	}
});

test("VS3 lifecycle rule 4, I2: once closed, every function but close throws Error; a malformed argument to a closed scene meets the TypeError first", () => {
	for (const rootless of [false, true]) {
		const { scene } = openScene(rootless ? { layers: LAYERS } : { root: goodRoot(), layers: LAYERS });
		scene.close();
		const calls = [["put", ["items", "a", [{ tag: "g" }]]], ["remove", ["items", "a"]], ["items", ["items"]], ["itemOf", [{}]], ["itemOf", [5]], ["layerElement", ["free"]], ["toDrawing", [{ x: 0, y: 0 }]], ["toScreen", [{ x: 0, y: 0 }]]];
		for (const [fn, args] of calls) assert.throws(() => scene[fn](...args), (e) => e.constructor === Error && e.message.startsWith(`${fn}: `), `${fn}, rootless ${rootless}`);
		const malformed = [["put", ["free", "a", [{ tag: "g" }]]], ["put", ["items", "", [{ tag: "g" }]]], ["put", ["items", "a", []]], ["put", ["items", "a", [{ tag: "g" }], null]], ["remove", ["items", 5]], ["items", [5]], ["layerElement", ["items"]], ["toDrawing", [{ x: NaN, y: 0 }]], ["toScreen", [5]]];
		for (const [fn, args] of malformed) assert.throws(() => scene[fn](...args), (e) => e.constructor === TypeError && e.message.startsWith(`${fn}: `), `${fn} malformed, rootless ${rootless}`);
	}
});

test("VS7, I2: a platform method throwing while a put or a removal writes fails the scene -- the error unchanged, no further call, what was written left -- and only close is left", () => {
	for (const fn of ["put", "remove"]) {
		const { root, log, hooks } = fakeRoot();
		const { scene } = openScene({ root, layers: LAYERS });
		scene.put("items", "a", [{ tag: "g" }, { tag: "rect" }]);
		const thrown = new Error("the platform throws");
		let count = 0;
		hooks.before = (entry) => {
			if (++count === 2) throw thrown;
			void entry;
		};
		log.length = 0;
		if (fn === "put") assert.throws(() => scene.put("items", "a", [{ tag: "g", attrs: { x: 1, y: 2 } }, { tag: "circle" }]), (e) => e === thrown);
		else assert.throws(() => scene.remove("items", "a"), (e) => e === thrown);
		assert.equal(log.length, 2, `${fn}: no further call once the platform threw`);
		hooks.before = undefined;
		for (const [name, args] of [["put", ["items", "b", [{ tag: "g" }]]], ["remove", ["items", "a"]], ["items", ["items"]], ["itemOf", [{}]], ["layerElement", ["free"]], ["toDrawing", [{ x: 0, y: 0 }]], ["toScreen", [{ x: 0, y: 0 }]]]) {
			assert.throws(() => scene[name](...args), (e) => e.constructor === Error && e.message.startsWith(`${name}: `), `${fn}: ${name} on a failed scene`);
		}
		log.length = 0;
		assert.equal(scene.close(), undefined, "close is left");
		assert.deepEqual(log, [["remove", 3], ["remove", 2], ["remove", 1]]);
		assert.deepEqual(root.children, []);
	}
});

test("VS3 lifecycle rule 4, I2: a platform method re-entering any function, close among them, while a put or a removal writes is refused with Error and changes nothing", () => {
	const { root, log, hooks } = fakeRoot();
	const { scene } = openScene({ root, layers: LAYERS });
	scene.put("items", "a", [{ tag: "g" }]);
	const element = root.children[1].children[0];
	const refusals = [];
	let armed = true;
	hooks.before = (entry) => {
		if (!armed || entry[0] !== "set") return;
		armed = false;
		const attempts = [["put", ["items", "x", [{ tag: "g" }]]], ["remove", ["items", "a"]], ["items", ["items"]], ["itemOf", [element]], ["layerElement", ["free"]], ["toDrawing", [{ x: 0, y: 0 }]], ["toScreen", [{ x: 0, y: 0 }]], ["close", []]];
		for (const [fn, args] of attempts) {
			try {
				scene[fn](...args);
				refusals.push(`${fn} answered`);
			} catch (error) {
				refusals.push(error.constructor === Error && error.message.startsWith(`${fn}: `) ? fn : `${fn} threw ${error}`);
			}
		}
	};
	log.length = 0;
	scene.put("items", "a", [{ tag: "g", attrs: { id: "a" } }]);
	assert.deepEqual(refusals, ["put", "remove", "items", "itemOf", "layerElement", "toDrawing", "toScreen", "close"]);
	assert.deepEqual(log, [["set", element.serial, "id", "a"]], "the refused calls made no platform call");
	assert.deepEqual(scene.items("items"), [{ key: "a", shapes: [{ tag: "g", attrs: { id: "a" } }] }]);
	assert.deepEqual(scene.itemOf(element), { layer: "items", key: "a", path: [0] }, "still open");
	armed = true;
	hooks.before = (entry) => {
		if (!armed || entry[0] !== "remove") return;
		armed = false;
		assert.throws(() => scene.close(), (e) => e.constructor === Error && e.message.startsWith("close: "));
	};
	scene.remove("items", "a");
	assert.deepEqual(scene.items("items"), [], "the removal completed, the scene open");
});
