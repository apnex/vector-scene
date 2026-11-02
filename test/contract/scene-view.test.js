// scene-view - VS14 to VS17, with VS1, VS2, VS3 and VS10 as a view widens them (I16 to I20): a view asked beside
// a root and its two refusals; the transform written on every layer's element at opening and at each setView,
// its range judged before any write; the conversions composing the view with the root's screen transform;
// visible() in snap-grid's view form, its far edges judged; zoomAbout keeping the point under a screen point;
// onView telling each listener, the scene not re-entrant while it writes a view or tells; and a scene declared
// without a view refusing each of the five. Every expectation is computed here from the contract's arithmetic,
// over the fake platform (test/support/fake-dom.js) and the recording platform (test/support/recording-platform.js).
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";

import { openScene } from "@apnex/vector-scene";
import { visibleAnswer } from "../../dist/scene-view.js";
import { fakeRoot, matrix } from "../support/fake-dom.js";
import { recordingPlatform } from "../support/recording-platform.js";
import { recorded, revoked, trapping } from "../support/recording-proxy.js";

const LAYERS = [{ name: "back", attrs: { id: "back" } }, { name: "items" }, { name: "free", foreign: true }];
const isTypeError = (fn) => (e) => Object.getPrototypeOf(e) === TypeError.prototype && e.message.startsWith(`${fn}: `);
const isBaseError = (fn) => (e) => Object.getPrototypeOf(e) === Error.prototype && e.message.startsWith(`${fn}: `);
const OPENING = "matrix(1, 0, 0, 1, 0, 0)";

/** A viewed scene over the fake platform, its root 400 by 300 in its own units, its layers' elements in order. */
function viewed({ ctm = { a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }, layers = LAYERS } = {}) {
	const platform = fakeRoot(ctm);
	platform.root.clientWidth = 400;
	platform.root.clientHeight = 300;
	const opened = openScene({ root: platform.root, layers, view: true });
	assert.equal(opened.ok, true, JSON.stringify(opened.problems));
	return { ...platform, scene: opened.scene, layerElements: platform.root.children };
}

/** What a view's transform is, computed here from VS14's arithmetic. */
const expectedTransform = ({ x, y, scale: s }) => `matrix(${String(s)}, 0, 0, ${String(s)}, ${String(-s * x)}, ${String(-s * y)})`;

/** Each layer element's transform attribute. */
const transforms = (layerElements) => layerElements.map((element) => element.attributes.get("transform"));

// ---- VS2 rule 2 and VS3: the declaration ----

test("I16, VS2 rule 2: view's descriptor is read after root's and layers', and judging it reads nothing more", () => {
	const log = [];
	const { root } = fakeRoot();
	const declaration = recorded({ root, layers: [{ name: "a" }], view: true }, "declaration", log);
	const opened = openScene(declaration);
	assert.equal(opened.ok, true);
	assert.deepEqual(log, ["declaration getPrototypeOf", "declaration ownKeys", "declaration getOwnPropertyDescriptor root", "declaration getOwnPropertyDescriptor layers", "declaration getOwnPropertyDescriptor view"]);
	// a getter of view never runs: an accessor is refused by its descriptor
	let ran = false;
	const accessor = { root, layers: [{ name: "a" }] };
	Object.defineProperty(accessor, "view", { get: () => ((ran = true), true), enumerable: true });
	assert.deepEqual(openScene(accessor).problems, [{ pointer: "/view", problem: "invalid-value" }]);
	assert.equal(ran, false);
});

test("I16, VS3: view's refusals, each at its pointer -- invalid-value, view-without-root, layer-transform -- and layer-transform silent while view is refused or false", () => {
	const { root } = fakeRoot();
	const transformed = [{ name: "a", attrs: { transform: "scale(2)" } }];
	const cases = [
		["view not a boolean", { root, layers: [{ name: "a" }], view: 1 }, [["/view", "invalid-value"]]],
		["view a string", { root, layers: [{ name: "a" }], view: "true" }, [["/view", "invalid-value"]]],
		["view present as undefined", { root, layers: [{ name: "a" }], view: undefined }, [["/view", "invalid-value"]]],
		["view with no root", { layers: [{ name: "a" }], view: true }, [["/view", "view-without-root"]]],
		["view with a root refused: the root's problem alone", { root: 5, layers: [{ name: "a" }], view: true }, [["/root", "invalid-value"]]],
		["view with no root and no layers", { view: true }, [["/layers", "missing-property"], ["/view", "view-without-root"]]],
		["a viewed layer declaring transform", { root, layers: transformed, view: true }, [["/layers/0/attrs/transform", "layer-transform"]]],
		["a viewed layer declaring transform beside a refused root", { root: 5, layers: transformed, view: true }, [["/layers/0/attrs/transform", "layer-transform"], ["/root", "invalid-value"]]],
		["the second layer declaring transform, the first's attrs refused", { root, layers: [{ name: "a", attrs: { onclick: "x" } }, { name: "b", attrs: { id: "b", transform: "t" } }], view: true }, [["/layers/0/attrs", "invalid-value"], ["/layers/1/attrs/transform", "layer-transform"]]],
		["silent while view is refused: no root", { layers: transformed, view: true }, [["/view", "view-without-root"]]],
		["silent while view is refused: not a boolean", { root, layers: transformed, view: 0 }, [["/view", "invalid-value"]]],
		["silent while view is false", { root, layers: transformed, view: false }, null],
		["silent with no view", { root, layers: transformed }, null],
		["Transform, another attribute, accepted", { root, layers: [{ name: "a", attrs: { Transform: "t" } }], view: true }, null],
		["view false with no root: a scene with no platform", { layers: [{ name: "a" }], view: false }, null],
	];
	for (const [label, declaration, problems] of cases) {
		const opened = openScene(declaration);
		if (problems === null) assert.equal(opened.ok, true, label);
		else assert.deepEqual(opened.problems, problems.map(([pointer, problem]) => ({ pointer, problem })), label);
	}
	const accessor = { root, layers: transformed };
	Object.defineProperty(accessor, "view", { get: () => true, enumerable: true });
	assert.deepEqual(openScene(accessor).problems, [{ pointer: "/view", problem: "invalid-value" }], "an accessor view refused, and layer-transform silent");
});

// ---- VS14: the transform ----

test("I17, VS3 lifecycle rule 1, VS14: a viewed scene writes the opening view's transform on each layer's element, scene and foreign, after its attributes and before it is appended", () => {
	const { log, layerElements, scene } = viewed();
	assert.deepEqual(log, [
		["create", "g", 1], ["set", 1, "id", "back"], ["set", 1, "transform", OPENING], ["append", 0, 1],
		["create", "g", 2], ["set", 2, "transform", OPENING], ["append", 0, 2],
		["create", "g", 3], ["set", 3, "transform", OPENING], ["append", 0, 3],
	]);
	assert.deepEqual(transforms(layerElements), [OPENING, OPENING, OPENING]);
	assert.deepEqual(scene.view(), { x: 0, y: 0, scale: 1 });
	assert.ok(Object.isFrozen(scene.view()));
	// a scene declared without a view, or with view false, writes no transform
	for (const view of [undefined, false]) {
		const platform = fakeRoot();
		openScene(view === undefined ? { root: platform.root, layers: LAYERS } : { root: platform.root, layers: LAYERS, view });
		assert.equal(platform.log.some((entry) => entry[2] === "transform"), false);
	}
});

test("I17, What is returned, VS14 rule 1: each viewed scene's opening view is its own record, made as it opens -- two scenes' views are not one object -- and view() answers it by reference until a setView", () => {
	const first = viewed().scene;
	const second = viewed().scene;
	const a = first.view();
	const b = second.view();
	assert.deepEqual(a, { x: 0, y: 0, scale: 1 });
	assert.deepEqual(b, { x: 0, y: 0, scale: 1 });
	assert.notEqual(a, b, "two scenes' opening views are not the same object");
	assert.ok(Object.isFrozen(a) && Object.isFrozen(b));
	assert.equal(first.view(), a, "the scene's own record, answered again by reference");
	first.setView({ x: 1, y: 2, scale: 3 });
	assert.equal(second.view(), b, "a setView of one scene leaves the other's record as it was");
});

test("I17, VS14: setView writes matrix(s, 0, 0, s, -s * x, -s * y), each member by String, on every layer's element in declared order, and answers the view written", () => {
	const { log, layerElements, scene } = viewed();
	// 2^-16 as String writes it, assembled here so this file holds no long run of digits
	const tiny = ["0.0000", "152587890625"].join("");
	assert.equal(String(2 ** -16), tiny);
	const cases = [
		[{ x: 0.5, y: -0.25, scale: 1.5 }, "matrix(1.5, 0, 0, 1.5, -0.75, 0.375)"],
		[{ x: -100, y: 7, scale: 0.1 }, `matrix(0.1, 0, 0, 0.1, ${String(-0.1 * -100)}, ${String(-0.1 * 7)})`],
		[{ x: 2 ** 8, y: -0, scale: 2 ** 16 }, "matrix(65536, 0, 0, 65536, -16777216, 0)"],
		[{ x: -(2 ** 40), y: 2 ** 40, scale: 2 ** -16 }, `matrix(${tiny}, 0, 0, ${tiny}, 16777216, -16777216)`],
		[{ x: 1 / 3, y: 0, scale: 3e-5 }, `matrix(0.00003, 0, 0, 0.00003, ${String(-3e-5 * (1 / 3))}, 0)`],
		[{ x: 0, y: 0, scale: 1 }, OPENING],
	];
	for (const [view, text] of cases) {
		assert.equal(expectedTransform(view), text, "control: the arithmetic computed here gives the literal");
		log.length = 0;
		const answer = scene.setView(view);
		assert.deepEqual(log, [1, 2, 3].map((serial) => ["set", serial, "transform", text]), JSON.stringify(view));
		assert.deepEqual(transforms(layerElements), [text, text, text]);
		assert.deepEqual(answer, { x: view.x, y: view.y, scale: view.scale });
		assert.notEqual(answer, view, "the view written is the scene's own");
		assert.ok(Object.isFrozen(answer));
		assert.equal(scene.view(), answer, "view() answers the view written");
	}
	assert.deepEqual(Reflect.ownKeys(scene.view()), ["x", "y", "scale"]);
});

test("I17, VS2 rule 1, VS14: setView reads its argument by descriptor -- x, y, then scale, each judged as read -- and throws its TypeError at the first malformed, reading nothing after it and changing nothing", () => {
	const { log, layerElements, scene } = viewed();
	scene.setView({ x: 1, y: 2, scale: 3 });
	const before = scene.view();
	const writes = log.length;
	const proto = Object.create({ scale: 1 });
	proto.x = 0;
	proto.y = 0;
	const accessor = { x: 0, y: 0 };
	Object.defineProperty(accessor, "scale", { get: () => 1, enumerable: true });
	const malformed = [null, undefined, 5, "view", () => {}, [0, 0, 1], proto, accessor, revoked({}), trapping({ x: 0, y: 0, scale: 1 }, "ownKeys"), trapping({ x: 0, y: 0, scale: 1 }, "getOwnPropertyDescriptor"),
		{ x: 0, y: 0 }, { y: 0, scale: 1 }, { x: 0, y: 0, scale: 1, z: 0 }, { x: undefined, y: 0, scale: 1 }, { x: "1", y: 0, scale: 1 }, { x: NaN, y: 0, scale: 1 }, { x: 0, y: Infinity, scale: 1 },
		{ x: 0, y: 0, scale: 0 }, { x: 0, y: 0, scale: -0 }, { x: 0, y: 0, scale: -1 }, { x: 0, y: 0, scale: -Infinity }, { x: 0, y: 0, scale: 1n }];
	// own x, y and scale, but no plain object: a class's instance, and a plain object made in another realm (VS2 rule 1)
	const instance = new (class View {
		constructor() {
			this.x = 0;
			this.y = 0;
			this.scale = 1;
		}
	})();
	const foreign = vm.runInNewContext("({ x: 0, y: 0, scale: 1 })");
	assert.deepEqual(Reflect.ownKeys(instance), ["x", "y", "scale"], "control: the instance holds the view's own keys");
	assert.deepEqual(Reflect.ownKeys(foreign), ["x", "y", "scale"], "control: so does the other realm's object");
	malformed.push(instance, foreign);
	malformed.forEach((value, index) => assert.throws(() => scene.setView(value), isTypeError("setView"), `malformed view ${index}`));
	assert.equal(scene.view(), before);
	assert.equal(log.length, writes, "no refusal wrote anything");
	assert.deepEqual(transforms(layerElements), Array(3).fill(expectedTransform(before)));
	// a prototype of null, and a symbol-named key, are a view's form
	assert.deepEqual(scene.setView(Object.assign(Object.create(null), { x: 4, y: 5, scale: 6 })), { x: 4, y: 5, scale: 6 });
	assert.deepEqual(scene.setView({ x: 4, y: 5, scale: 6, [Symbol("s")]: 1 }), { x: 4, y: 5, scale: 6 });
	// the order: prototype, own keys, then each descriptor in turn, stopping at the first malformed
	const reads = [];
	scene.setView(recorded({ scale: 2, y: 1, x: 0 }, "view", reads));
	assert.deepEqual(reads, ["view getPrototypeOf", "view ownKeys", "view getOwnPropertyDescriptor x", "view getOwnPropertyDescriptor y", "view getOwnPropertyDescriptor scale"]);
	reads.length = 0;
	assert.throws(() => scene.setView(recorded({ x: NaN, y: 1, scale: 2 }, "view", reads)), isTypeError("setView"));
	assert.deepEqual(reads, ["view getPrototypeOf", "view ownKeys", "view getOwnPropertyDescriptor x"], "nothing read after x");
	reads.length = 0;
	assert.throws(() => scene.setView(recorded({ x: 0, y: 1, w: 2 }, "view", reads)), isTypeError("setView"));
	assert.deepEqual(reads, ["view getPrototypeOf", "view ownKeys"], "an unknown key refused at the own keys");
	// a malformed view to a closed scene meets the TypeError; a scale of 0 among them, before any state or range is judged
	scene.close();
	assert.throws(() => scene.setView({ x: 0, y: 0, scale: 0 }), isTypeError("setView"));
	assert.throws(() => scene.setView({ x: 0, y: 0, scale: 1 }), isBaseError("setView"));
});

test("I17, VS14: setView computes the transform's members and refuses -- a TypeError, nothing written, the view kept -- a member not finite or a view outside the range: scale 2^-16 to 2^16, each member at most 2^24", () => {
	const { log, scene } = viewed();
	const T = 2 ** 24;
	const next = (v) => v + 2 ** (Math.floor(Math.log2(v)) - 52);
	assert.equal(next(T), T + 2 ** -28, "control: the next representable number above 2^24, in binary64");
	const below = 2 ** -16 - 2 ** (-16 - 53);
	assert.ok(below < 2 ** -16 && below > 0, "control: the representable number just below 2^-16");
	const accepted = [{ x: 0, y: 0, scale: 2 ** 16 }, { x: 0, y: 0, scale: 2 ** -16 }, { x: -T, y: 0, scale: 1 }, { x: T, y: 0, scale: 1 }, { x: 0, y: -T, scale: 1 }, { x: 0, y: T, scale: 1 }, { x: -(T / 4), y: T / 4, scale: 4 }, { x: T * 2 ** 16, y: -T * 2 ** 16, scale: 2 ** -16 }];
	const refused = [{ x: 1e308, y: 0, scale: 2 }, { x: 0, y: -1e308, scale: 4 }, { x: 0, y: 0, scale: 2 ** 17 }, { x: 0, y: 0, scale: next(2 ** 16) }, { x: 0, y: 0, scale: below }, { x: -next(T), y: 0, scale: 1 }, { x: next(T), y: 0, scale: 1 }, { x: 0, y: -next(T), scale: 1 }, { x: 0, y: next(T), scale: 1 },
		{ x: 0, y: 0, scale: 1e39 }, { x: 0, y: 0, scale: 1e-50 }, { x: 0, y: 0, scale: Number.MIN_VALUE }, { x: 1e39, y: 0, scale: 1 }, { x: T / 2 + 1, y: 0, scale: 2 }];
	for (const view of accepted) {
		log.length = 0;
		assert.deepEqual(scene.setView(view), view, JSON.stringify(view));
		assert.equal(log.length, 3);
	}
	for (const view of refused) {
		const kept = scene.view();
		log.length = 0;
		assert.throws(() => scene.setView(view), isTypeError("setView"), JSON.stringify(view));
		assert.deepEqual(log, [], `${JSON.stringify(view)}: nothing written`);
		assert.equal(scene.view(), kept, `${JSON.stringify(view)}: the view kept`);
	}
});

test("I17, VS3 lifecycle rule 4, VS7, VS14: setView writes while the scene is not re-entrant, and a write that throws leaves the scene failed, the error unchanged", () => {
	const { hooks, scene, layerElements } = viewed();
	const refusals = [];
	let armed = true;
	hooks.before = (entry) => {
		if (!armed || entry[0] !== "set" || entry[2] !== "transform") return;
		armed = false;
		const attempts = [["setView", [{ x: 0, y: 0, scale: 1 }]], ["view", []], ["visible", []], ["zoomAbout", [{ x: 0, y: 0 }, 1]], ["onView", [() => {}]], ["put", ["items", "a", [{ tag: "g" }]]], ["items", ["items"]], ["toDrawing", [{ x: 0, y: 0 }]], ["close", []]];
		for (const [fn, args] of attempts) {
			try {
				scene[fn](...args);
				refusals.push(`${fn} answered`);
			} catch (error) {
				refusals.push(isBaseError(fn)(error) ? fn : `${fn} threw ${error}`);
			}
		}
	};
	scene.setView({ x: 1, y: 1, scale: 2 });
	assert.deepEqual(refusals, ["setView", "view", "visible", "zoomAbout", "onView", "put", "items", "toDrawing", "close"]);
	assert.deepEqual(scene.view(), { x: 1, y: 1, scale: 2 }, "the write completed, the scene open");
	// a platform write that throws: the scene failed, the error propagating unchanged, what was written staying
	const planted = new Error("the platform refused the transform");
	hooks.before = (entry) => {
		if (entry[0] === "set" && entry[1] === 2) throw planted;
	};
	assert.throws(() => scene.setView({ x: 5, y: 5, scale: 1 }), (e) => e === planted);
	assert.deepEqual(transforms(layerElements), ["matrix(1, 0, 0, 1, -5, -5)", "matrix(2, 0, 0, 2, -2, -2)", "matrix(2, 0, 0, 2, -2, -2)"]);
	hooks.before = undefined;
	for (const [fn, args] of [["setView", [{ x: 0, y: 0, scale: 1 }]], ["view", []], ["visible", []], ["zoomAbout", [{ x: 0, y: 0 }, 1]], ["onView", [() => {}]], ["items", ["items"]]]) assert.throws(() => scene[fn](...args), isBaseError(fn), fn);
	assert.equal(scene.close(), undefined, "only close is left");
});

test("I20, VS14: a scene declared without a view -- or with view false -- refuses setView, view, visible, zoomAbout and onView, each with an Error after its arguments are read, and is otherwise unchanged", () => {
	for (const declaration of [(root) => ({ root, layers: LAYERS }), (root) => ({ root, layers: LAYERS, view: false }), () => ({ layers: LAYERS })]) {
		const { root, log } = fakeRoot();
		root.clientWidth = 400;
		root.clientHeight = 300;
		const { scene } = openScene(declaration(root));
		const writes = log.length;
		assert.throws(() => scene.setView({ x: 0, y: 0, scale: 1 }), isBaseError("setView"));
		assert.throws(() => scene.view(), isBaseError("view"));
		assert.throws(() => scene.visible(), isBaseError("visible"));
		assert.throws(() => scene.zoomAbout({ x: 1, y: 1 }, 2), isBaseError("zoomAbout"));
		assert.throws(() => scene.onView(() => {}), isBaseError("onView"));
		assert.throws(() => scene.setView({ x: 0, y: 0 }), isTypeError("setView"), "a malformed argument meets the TypeError first");
		assert.throws(() => scene.zoomAbout({ x: 1, y: 1 }, 0), isTypeError("zoomAbout"));
		assert.throws(() => scene.onView(5), isTypeError("onView"));
		assert.equal(log.length, writes, "nothing written, nothing read");
		if (declaration.length === 1) assert.deepEqual(scene.toScreen({ x: 1, y: 2 }), { x: 12, y: 24 }, "the conversions as 0.2.0's, the view not composed");
	}
});

test("I20, VS1, VS14, VS15: on a recording root the opening logs the transform written, setView logs its writes alone and no read, and visible() reads clientWidth, clientHeight and the screen transform, nothing else", () => {
	const size = { w: 400, h: 300 };
	const { root, log } = recordingPlatform({ size });
	const { scene } = openScene({ root, layers: [{ name: "items" }, { name: "free", foreign: true }], view: true });
	const method = (label, name, args) => [`${label} get ${name}`, `${label}.${name}(${args})`];
	assert.deepEqual(log, [
		"root get ownerDocument", "document get createElementNS", "document get elementsFromPoint", "root get appendChild", "root get getScreenCTM",
		"document.createElementNS(\"svg\", \"g\")", "  -> e1", ...method("e1", "setAttribute", `"transform", "${OPENING}"`), "root.appendChild(e1)",
		"document.createElementNS(\"svg\", \"g\")", "  -> e2", ...method("e2", "setAttribute", `"transform", "${OPENING}"`), "root.appendChild(e2)",
	]);
	log.length = 0;
	scene.setView({ x: 3, y: 4, scale: 2 });
	assert.deepEqual(log, [...method("e1", "setAttribute", "\"transform\", \"matrix(2, 0, 0, 2, -6, -8)\""), ...method("e2", "setAttribute", "\"transform\", \"matrix(2, 0, 0, 2, -6, -8)\"")], "setView reads nothing of the platform");
	log.length = 0;
	scene.view();
	scene.zoomAbout({ x: 10, y: 20 }, 4);
	assert.deepEqual(log, ["root.getScreenCTM()", "  -> t1", "t1 get inverse", "t1.inverse()", "  -> t2", ...["a", "b", "c", "d", "e", "f"].map((m) => `t2 get ${m}`)], "view() reads nothing; zoomAbout reads the transform as toDrawing does");
	log.length = 0;
	scene.visible();
	assert.deepEqual(log, ["root get clientWidth", "root get clientHeight", "root.getScreenCTM()", "  -> t3", ...["a", "b", "c", "d", "e", "f"].map((m) => `t3 get ${m}`)]);
});

// ---- VS10: the conversions, composed ----

test("I18, VS10: a viewed scene's toScreen applies the root's transform to (s * (p.x - x), s * (p.y - y)), and its toDrawing answers (r.x / s + x, r.y / s + y), each step in binary64 as computed here", () => {
	const ctms = [{ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }, { a: 0.495, b: 0, c: 0, d: 0.495, e: -3.25, f: 117.5 }, { a: 1.6, b: 1.2, c: -1.2, d: 1.6, e: 7, f: -9 }];
	const views = [{ x: 0, y: 0, scale: 1 }, { x: -480.5, y: 270.25, scale: 0.38 }, { x: 1234.5, y: -987.25, scale: 2.5 }, { x: 1e6, y: -1e6, scale: 4 }, { x: -3e9, y: 3e9, scale: 2 ** -16 }];
	const points = [{ x: 0, y: 0 }, { x: 10.5, y: -3.25 }, { x: -1e6, y: 7e5 }, { x: 0.1, y: 0.2 }, { x: -0, y: -0 }];
	for (const ctm of ctms) {
		const { root, scene } = viewed({ ctm });
		const inverse = matrix(ctm).inverse();
		for (const view of views) {
			scene.setView(view);
			const { x, y, scale: s } = view;
			for (const p of points) {
				const px = s * (p.x - x), py = s * (p.y - y);
				const screen = { x: ctm.a * px + ctm.c * py + ctm.e, y: ctm.b * px + ctm.d * py + ctm.f };
				const got = scene.toScreen(p);
				assert.ok(Object.is(got.x, screen.x) && Object.is(got.y, screen.y), `toScreen ${JSON.stringify([ctm, view, p])}: ${JSON.stringify(got)} against ${JSON.stringify(screen)}`);
				const r = { x: inverse.a * p.x + inverse.c * p.y + inverse.e, y: inverse.b * p.x + inverse.d * p.y + inverse.f };
				const drawing = { x: r.x / s + x, y: r.y / s + y };
				const back = scene.toDrawing(p);
				assert.ok(Object.is(back.x, drawing.x) && Object.is(back.y, drawing.y), `toDrawing ${JSON.stringify([ctm, view, p])}: ${JSON.stringify(back)} against ${JSON.stringify(drawing)}`);
				assert.ok(Object.isFrozen(got) && Object.isFrozen(back));
			}
		}
		void root;
	}
	// a drawing point at a view's top-left lands where the root's own origin does
	const { scene } = viewed();
	scene.setView({ x: 300, y: -40, scale: 3 });
	assert.deepEqual(scene.toScreen({ x: 300, y: -40 }), { x: 10, y: 20 });
});

test("I18, VS10: a composed answer that is not finite is refused with Errors' Error, the scene open", () => {
	// the root point is finite -- 1e305 -- and the drawing point, divided by the view's scale of 2^-16, is not
	const { scene } = viewed({ ctm: { a: 1e-150, b: 0, c: 0, d: 1e-150, e: 0, f: 0 } });
	scene.setView({ x: 0, y: 0, scale: 2 ** -16 });
	assert.ok(Number.isFinite(matrix({ a: 1e-150, b: 0, c: 0, d: 1e-150, e: 0, f: 0 }).inverse().a * 1e155), "control: the root point is finite");
	assert.throws(() => scene.toDrawing({ x: 1e155, y: 1 }), (e) => isBaseError("toDrawing")(e) && /not finite/.test(e.message));
	const { scene: wide } = viewed({ ctm: { a: 1e300, b: 0, c: 0, d: 1e300, e: 0, f: 0 } });
	wide.setView({ x: 0, y: 0, scale: 2 ** 16 });
	assert.throws(() => wide.toScreen({ x: 1e10, y: 0 }), isBaseError("toScreen"));
	assert.deepEqual(wide.view(), { x: 0, y: 0, scale: 2 ** 16 }, "still open");
});

// ---- VS15: visible() ----

test("I18, VS15: visible() answers { region: { kind: 'rect', x, y, w: W / s, h: H / s }, scale: s * hypot(a, b) } from clientWidth, clientHeight and the screen transform read at the call -- a resize followed with no setView", () => {
	const { root, scene } = viewed({ ctm: { a: 2, b: 0, c: 1, d: 2, e: 10, f: 20 } });
	scene.setView({ x: -50.5, y: 25.25, scale: 0.75 });
	const first = scene.visible();
	assert.deepEqual(first, { region: { kind: "rect", x: -50.5, y: 25.25, w: 400 / 0.75, h: 300 / 0.75 }, scale: 0.75 * Math.hypot(2, 0) });
	assert.deepEqual(Reflect.ownKeys(first), ["region", "scale"]);
	assert.deepEqual(Reflect.ownKeys(first.region), ["kind", "x", "y", "w", "h"]);
	assert.ok(Object.isFrozen(first) && Object.isFrozen(first.region));
	assert.notEqual(scene.visible(), first, "made afresh");
	// the root resized and its screen transform changed, with no setView between
	root.clientWidth = 1366;
	root.clientHeight = 0;
	root.ctm = { a: 0.6, b: 0.8, c: -0.8, d: 0.6, e: 0, f: 0 };
	assert.deepEqual(scene.visible(), { region: { kind: "rect", x: -50.5, y: 25.25, w: 1366 / 0.75, h: 0 }, scale: 0.75 * Math.hypot(0.6, 0.8) });
	assert.deepEqual(scene.view(), { x: -50.5, y: 25.25, scale: 0.75 }, "the view unchanged");
	// a root not yet laid out answers a region of no width
	root.clientWidth = 0;
	assert.equal(scene.visible().region.w, 0);
});

test("I18, VS15: visible() refuses with Errors' Error a width or height not a finite number at least 0, a transform VS10 refuses, a singular one, and a scene closed or failed; a getter's error propagates, the scene open", () => {
	const { root, scene } = viewed();
	for (const [w, h] of [[NaN, 300], [400, NaN], [-1, 300], [400, -0.5], [Infinity, 300], ["400", 300], [400, null], [undefined, 300]]) {
		root.clientWidth = w;
		root.clientHeight = h;
		assert.throws(() => scene.visible(), isBaseError("visible"), `${w} by ${h}`);
	}
	root.clientWidth = 400;
	root.clientHeight = 300;
	for (const ctm of [null, { a: NaN, b: 0, c: 0, d: 2, e: 0, f: 0 }, { a: "2", b: 0, c: 0, d: 2, e: 0, f: 0 }, { a: 0, b: 0, c: 0, d: 0, e: 10, f: 20 }]) {
		root.ctm = ctm;
		assert.throws(() => scene.visible(), isBaseError("visible"), JSON.stringify(ctm));
	}
	root.ctm = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
	const planted = new Error("the platform's getter threw");
	Object.defineProperty(root, "clientHeight", { get: () => { throw planted; }, configurable: true });
	assert.throws(() => scene.visible(), (e) => e === planted);
	assert.deepEqual(scene.view(), { x: 0, y: 0, scale: 1 }, "the scene open");
	scene.close();
	assert.throws(() => scene.visible(), isBaseError("visible"));
});

test("I18, VS15: the far-edge check, on synthetic rectangles whose members are finite and whose far edge overflows -- no view within the range reaches one through visible()", () => {
	const max = Number.MAX_VALUE;
	assert.deepEqual(visibleAnswer("visible", 1, 2, 3, 4, 0.5), { region: { kind: "rect", x: 1, y: 2, w: 3, h: 4 }, scale: 0.5 }, "control");
	assert.deepEqual(visibleAnswer("visible", -max, 0, max, 0, 1).region.x, -max, "control: a far edge at 0");
	for (const [x, y, w, h] of [[max, 0, max, 0], [0, max / 2, 0, max], [max, max, max, max], [1e308, 0, 1e308, 1]]) {
		assert.ok([x, y, w, h].every(Number.isFinite), "every member finite");
		assert.throws(() => visibleAnswer("visible", x, y, w, h, 1), (e) => isBaseError("visible")(e) && /far edges/.test(e.message), JSON.stringify([x, y, w, h]));
	}
	for (const args of [[NaN, 0, 1, 1, 1], [0, 0, Infinity, 1, 1], [0, 0, 1, 1, 0], [0, 0, 1, 1, -1], [0, 0, 1, 1, NaN]]) assert.throws(() => visibleAnswer("visible", ...args), isBaseError("visible"), JSON.stringify(args));
});

// ---- VS16: zoomAbout ----

test("I18, VS16: zoomAbout answers, setting nothing, the view at a scale that keeps the drawing point under a screen point -- at a scale the application clamped first", () => {
	const ctm = { a: 0.784, b: 0, c: 0, d: 0.784, e: 12, f: 64 };
	const { log, scene } = viewed({ ctm });
	const inverse = matrix(ctm).inverse();
	const clamp = (scale) => Math.min(2 ** 16, Math.max(2 ** -16, scale));
	for (const [view, screen, wanted] of [[{ x: 0, y: 0, scale: 1 }, { x: 300, y: 200 }, 2], [{ x: -480, y: 270, scale: 0.495 }, { x: 683, y: 384 }, 0.165], [{ x: 40, y: -30, scale: 1.57 }, { x: 13.5, y: 70 }, 1e9], [{ x: 5, y: 5, scale: 2 ** -15 }, { x: 0, y: 0 }, 1e-12]]) {
		scene.setView(view);
		const scale = clamp(wanted);
		log.length = 0;
		const answer = scene.zoomAbout(screen, scale);
		assert.equal(log.some((entry) => entry[0] === "set"), false, "setting nothing");
		assert.deepEqual(scene.view(), view, "the view unchanged");
		const r = { x: inverse.a * screen.x + inverse.c * screen.y + inverse.e, y: inverse.b * screen.x + inverse.d * screen.y + inverse.f };
		const p = { x: r.x / view.scale + view.x, y: r.y / view.scale + view.y };
		assert.deepEqual(answer, { x: p.x - r.x / scale, y: p.y - r.y / scale, scale });
		assert.deepEqual(Reflect.ownKeys(answer), ["x", "y", "scale"]);
		assert.ok(Object.isFrozen(answer));
		// set, the drawing point under the screen point is where it was
		const before = scene.toDrawing(screen);
		scene.setView(answer);
		const after = scene.toDrawing(screen);
		for (const k of ["x", "y"]) assert.ok(Math.abs(after[k] - before[k]) <= 1e-9 * Math.max(1, Math.abs(before[k])), `${k}: ${after[k]} against ${before[k]}`);
	}
});

test("I18, VS16: zoomAbout reads its point then its scale, each a TypeError when malformed, then the state; an answer setView would refuse is an Error", () => {
	const { scene } = viewed();
	const reads = [];
	assert.throws(() => scene.zoomAbout(recorded({ x: 1, y: NaN }, "point", reads), recorded({}, "scale", reads)), isTypeError("zoomAbout"));
	assert.deepEqual(reads, ["point get x", "point get y"], "x and y both read before either is judged, and nothing after");
	for (const [screen, scale] of [[null, 1], [{ x: 1 }, 1], [{ x: 1, y: 1 }, 0], [{ x: 1, y: 1 }, -2], [{ x: 1, y: 1 }, NaN], [{ x: 1, y: 1 }, Infinity], [{ x: 1, y: 1 }, "2"], [{ x: 1, y: 1 }, undefined]]) {
		assert.throws(() => scene.zoomAbout(screen, scale), isTypeError("zoomAbout"), JSON.stringify([screen, scale]));
	}
	// Number.MIN_VALUE is a finite scale above 0, but the view it answers is not finite: an Error
	assert.throws(() => scene.zoomAbout({ x: 300, y: 200 }, Number.MIN_VALUE), isBaseError("zoomAbout"));
	// outside the range: a scale past 2^16, and a member past 2^24 at a scale within it
	assert.throws(() => scene.zoomAbout({ x: 300, y: 200 }, 2 ** 17), isBaseError("zoomAbout"));
	assert.throws(() => scene.zoomAbout({ x: 300, y: 200 }, 1e39), isBaseError("zoomAbout"));
	scene.setView({ x: 2 ** 24, y: 0, scale: 1 });
	assert.throws(() => scene.zoomAbout({ x: 10, y: 20 }, 2), isBaseError("zoomAbout"));
	assert.deepEqual(scene.zoomAbout({ x: 10, y: 20 }, 1), { x: 2 ** 24, y: 0, scale: 1 }, "control: at the edge, accepted");
	assert.deepEqual(scene.view(), { x: 2 ** 24, y: 0, scale: 1 }, "nothing set");
	scene.close();
	assert.throws(() => scene.zoomAbout({ x: 1, y: 1 }, 1), isBaseError("zoomAbout"));
	assert.throws(() => scene.zoomAbout({ x: 1, y: 1 }, 0), isTypeError("zoomAbout"), "a malformed scale to a closed scene meets the TypeError");
});

// ---- VS17: onView ----

test("I19, VS17: once setView has written every layer, the listeners registered then are called in order, synchronously, each with one visible() read after the write", () => {
	const { log, scene } = viewed();
	const calls = [];
	const seenView = [];
	const first = (visible, ...rest) => {
		calls.push(["first", visible, rest.length, log.filter((entry) => entry[2] === "transform").length]);
		seenView.push(scene.view());
	};
	const second = function (visible) {
		calls.push(["second", visible, this]);
	};
	scene.onView(first);
	scene.onView(second);
	scene.onView(first);
	log.length = 0;
	const answer = scene.setView({ x: 10, y: 20, scale: 2 });
	assert.equal(calls.length, 3);
	const told = calls[0][1];
	assert.deepEqual(told, { region: { kind: "rect", x: 10, y: 20, w: 200, h: 150 }, scale: 4 });
	assert.deepEqual(calls.map((c) => c[0]), ["first", "second", "first"], "in the order registered, one function twice being two listeners");
	assert.equal(calls[1][1], told, "one visible() read, handed to each");
	assert.equal(calls[2][1], told);
	assert.equal(calls[0][2], 0, "one argument");
	assert.equal(calls[0][3], 3, "every layer written before the first is told");
	assert.equal(calls[1][2], undefined, "called with no receiver");
	assert.equal(seenView[0], answer, "the view written, answered while the listeners are told");
});

test("I19, VS17: onView answers a function that removes its listener, a second call doing nothing; a listener added or removed while listeners are told takes effect at the next setView", () => {
	const { scene } = viewed();
	const calls = [];
	let removeB, removeC;
	const removeA = scene.onView(() => {
		calls.push("a");
		removeB();
		removeC ??= scene.onView(() => calls.push("c"));
	});
	removeB = scene.onView(() => calls.push("b"));
	assert.ok(Object.isFrozen(removeA) && Object.isFrozen(removeB));
	scene.setView({ x: 0, y: 0, scale: 2 });
	assert.deepEqual(calls, ["a", "b"], "the listeners registered when setView had written: b, removed meanwhile, told; c, added meanwhile, not");
	calls.length = 0;
	scene.setView({ x: 0, y: 0, scale: 3 });
	assert.deepEqual(calls, ["a", "c"], "from the next setView, b gone and c told");
	assert.equal(removeB(), undefined, "a second removal does nothing");
	assert.equal(removeA.call(undefined), undefined, "needs no receiver");
	calls.length = 0;
	scene.setView({ x: 0, y: 0, scale: 4 });
	assert.deepEqual(calls, ["c"]);
	assert.throws(() => scene.onView({}), isTypeError("onView"));
	assert.throws(() => scene.onView(), isTypeError("onView"));
});

test("I19, VS17 rule 5: one function registered twice is two listeners, and each removal removes its own registration -- f, g, f with the second f removed tells f then g", () => {
	const { scene } = viewed();
	const calls = [];
	const f = () => calls.push("f");
	const g = () => calls.push("g");
	scene.onView(f);
	scene.onView(g);
	const removeSecondF = scene.onView(f);
	scene.setView({ x: 0, y: 0, scale: 2 });
	assert.deepEqual(calls, ["f", "g", "f"], "control: three listeners, f twice");
	calls.length = 0;
	removeSecondF();
	scene.setView({ x: 0, y: 0, scale: 3 });
	assert.deepEqual(calls, ["f", "g"], "the second f removed, the first kept in its place");
});

test("I19, VS17 rule 2: the listeners told are those registered once every layer is written -- one removed by a platform method during the write is not told", () => {
	const { hooks, scene } = viewed();
	const calls = [];
	scene.onView(() => calls.push("a"));
	const removeB = scene.onView(() => calls.push("b"));
	scene.onView(() => calls.push("c"));
	let armed = true;
	hooks.before = (entry) => {
		if (!armed || entry[0] !== "set" || entry[2] !== "transform") return;
		armed = false;
		// the remover answers while the scene writes, where every function of the scene refuses
		assert.equal(removeB(), undefined);
		assert.throws(() => scene.view(), isBaseError("view"), "control: the scene is writing");
	};
	scene.setView({ x: 0, y: 0, scale: 2 });
	assert.equal(armed, false, "control: the platform method ran during the write");
	assert.deepEqual(calls, ["a", "c"], "b, removed during the write, not told");
});

test("I19, VS17 rule 5: the function onView answers removes its listener in every state of the scene -- writing, closed and failed included -- answering undefined and never throwing", () => {
	// closed
	const closing = viewed();
	const closedCalls = [];
	const removeOnClosed = closing.scene.onView(() => closedCalls.push("a"));
	const removeOnClosedTwice = closing.scene.onView(() => closedCalls.push("b"));
	closing.scene.close();
	assert.equal(removeOnClosed(), undefined, "after close");
	assert.equal(removeOnClosed(), undefined, "and a second time");
	assert.equal(removeOnClosedTwice.call(undefined), undefined, "with no receiver");
	// failed: a platform write that throws
	const failing = viewed();
	const removeOnFailed = failing.scene.onView(() => {});
	failing.hooks.before = (entry) => {
		if (entry[0] === "set" && entry[2] === "transform") throw new Error("the platform refused the transform");
	};
	assert.throws(() => failing.scene.setView({ x: 1, y: 1, scale: 1 }), /refused the transform/);
	assert.throws(() => failing.scene.view(), isBaseError("view"), "control: the scene failed");
	assert.equal(removeOnFailed(), undefined, "after a failure");
	assert.equal(removeOnFailed(), undefined, "and a second time");
});

test("I19, VS17: the first listener to throw stops the rest, its error propagating with the view written and the scene open; a visible() that fails is the same", () => {
	const { root, scene, layerElements } = viewed();
	const calls = [];
	const planted = new Error("a listener threw");
	scene.onView(() => calls.push("a"));
	scene.onView(() => {
		calls.push("b");
		throw planted;
	});
	scene.onView(() => calls.push("c"));
	assert.throws(() => scene.setView({ x: 1, y: 2, scale: 3 }), (e) => e === planted);
	assert.deepEqual(calls, ["a", "b"]);
	assert.deepEqual(scene.view(), { x: 1, y: 2, scale: 3 }, "the view written");
	assert.deepEqual(transforms(layerElements), Array(3).fill("matrix(3, 0, 0, 3, -3, -6)"));
	scene.put("items", "a", [{ tag: "rect" }]);
	assert.deepEqual(scene.items("items").map((i) => i.key), ["a"], "the scene open");
	calls.length = 0;
	root.clientWidth = NaN;
	assert.throws(() => scene.setView({ x: 0, y: 0, scale: 1 }), isBaseError("setView"));
	assert.deepEqual(calls, [], "no listener told");
	assert.deepEqual(scene.view(), { x: 0, y: 0, scale: 1 }, "the view written");
	root.clientWidth = 400;
	calls.length = 0;
	assert.throws(() => scene.setView({ x: 0, y: 0, scale: 2 }), (e) => e === planted, "the scene still tells");
});

test("I19, VS17: while listeners are told, setView, put, remove and close throw an Error, and every reading function answers", () => {
	const { scene } = viewed();
	scene.put("items", "a", [{ tag: "rect" }]);
	const outcomes = [];
	let once = true;
	scene.onView(() => {
		if (!once) return;
		once = false;
		const attempts = [["setView", [{ x: 0, y: 0, scale: 9 }]], ["put", ["items", "b", [{ tag: "g" }]]], ["remove", ["items", "a"]], ["close", []]];
		for (const [fn, args] of attempts) {
			try {
				scene[fn](...args);
				outcomes.push(`${fn} answered`);
			} catch (error) {
				outcomes.push(isBaseError(fn)(error) ? fn : `${fn} threw ${error}`);
			}
		}
		outcomes.push(scene.view().scale, scene.visible().scale, scene.items("items").length, scene.toDrawing({ x: 10, y: 20 }).x, scene.toScreen({ x: 0, y: 0 }).x, scene.zoomAbout({ x: 10, y: 20 }, 1).scale, scene.layers.length, typeof scene.layerElement("free"), scene.itemOf({}), typeof scene.onView(() => {}));
	});
	scene.setView({ x: 0, y: 0, scale: 2 });
	assert.deepEqual(outcomes, ["setView", "put", "remove", "close", 2, 4, 1, 0, 10, 1, 3, "object", null, "function"]);
	assert.deepEqual(scene.view(), { x: 0, y: 0, scale: 2 }, "the listener's setView changed nothing");
	assert.deepEqual(scene.items("items").map((i) => i.key), ["a"], "nor its put or remove");
	scene.put("items", "b", [{ tag: "g" }]);
	assert.equal(scene.close(), undefined, "outside the listeners, each answers again");
});
