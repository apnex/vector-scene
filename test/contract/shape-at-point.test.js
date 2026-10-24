// shape-at-point - VS12, with VS1 and VS2 rule 2 widened by the document's elementsFromPoint (I13): read
// once as the scene opens, after createElementNS and before the root's appendChild; a getter that throws
// refusing the root, a value that is no function opening it with itemAt refused; and itemAt answering the
// first element of the platform's hit stack at a screen point that the scene made for a shape of an item it
// still holds, the point read first, the state judged before anything of the scene, the answer's length
// read once and its indices in order, and the state judged again.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openScene } from "@apnex/vector-scene";
import { fakeElement, fakeRoot } from "../support/fake-dom.js";
import { describe, isFrozenToDepth } from "../support/frozen.js";
import { recorded } from "../support/recording-proxy.js";

const LAYERS = [{ name: "back" }, { name: "items" }, { name: "free", foreign: true }];
const isBaseError = (e) => Object.getPrototypeOf(e) === Error.prototype && e.message.startsWith("itemAt: ");
const isTypeError = (e) => Object.getPrototypeOf(e) === TypeError.prototype && e.message.startsWith("itemAt: ");
/** A value every trap of which fails the test: an element the scene must know by identity alone. */
const untouchable = (label) => new Proxy({}, new Proxy({}, { get: () => () => assert.fail(`${label} was read`) }));

/**
 * A rooted scene whose document's elementsFromPoint logs each call -- its receiver, as `document` or
 * `other`, and its arguments -- and answers what `answer.next(x, y)` makes; `answer.next` may be replaced
 * between calls.
 */
function rooted() {
	const platform = fakeRoot();
	const answer = { next: () => [], calls: [] };
	const document = platform.root.ownerDocument;
	document.elementsFromPoint = function (...args) {
		answer.calls.push([this === document ? "document" : "other", ...args]);
		return answer.next(...args);
	};
	const opened = openScene({ root: platform.root, layers: LAYERS });
	assert.equal(opened.ok, true);
	const [back, items, free] = platform.root.children;
	return { ...platform, scene: opened.scene, answer, back, items, free };
}

test("VS1, VS2 rule 2, I13: elementsFromPoint is read once as the scene opens, after createElementNS and before the root's appendChild and getScreenCTM, through ordinary property access", () => {
	const log = [];
	const { root: fake } = fakeRoot();
	const document = recorded(Object.assign(Object.create({ elementsFromPoint: () => [] }), { createElementNS: fake.ownerDocument.createElementNS }), "document", log);
	const root = recorded({ ownerDocument: document, appendChild: fake.appendChild, getScreenCTM: fake.getScreenCTM }, "root", log);
	const { scene } = openScene({ root, layers: [{ name: "a" }] });
	const reads = log.filter((entry) => !entry.includes(" apply"));
	assert.deepEqual(reads.slice(0, 5), ["root get ownerDocument", "document get createElementNS", "document get elementsFromPoint", "root get appendChild", "root get getScreenCTM"], "an inherited member read too, as a browser's is");
	assert.equal(reads.filter((entry) => entry === "document get elementsFromPoint").length, 1);
	log.length = 0;
	assert.equal(scene.itemAt({ x: 1, y: 2 }), null);
	assert.equal(scene.itemAt({ x: 3, y: 4 }), null);
	assert.deepEqual(log.filter((entry) => entry.startsWith("document get") || entry.startsWith("root get")), [], "never read again");
});

test("VS2 rule 2, I13: a getter of elementsFromPoint that throws refuses the root, invalid-value at /root, and the reading of the root stops there", () => {
	const log = [];
	const document = recorded({
		createElementNS() {},
		get elementsFromPoint() {
			throw new Error("the getter throws");
		},
	}, "document", log);
	const root = recorded({ ownerDocument: document, appendChild() {}, getScreenCTM() {} }, "root", log);
	const refused = openScene({ root, layers: [{ name: "a" }] });
	assert.deepEqual(refused, { ok: false, problems: [{ pointer: "/root", problem: "invalid-value" }] });
	assert.deepEqual(log, ["root get ownerDocument", "document get createElementNS", "document get elementsFromPoint"], "appendChild and getScreenCTM unread");
	const throwingTrap = new Proxy({ createElementNS() {} }, {
		get(target, key) {
			if (key === "elementsFromPoint") throw new Error("the trap throws");
			return target[key];
		},
	});
	assert.deepEqual(openScene({ root: { ownerDocument: throwingTrap, appendChild() {}, getScreenCTM() {} }, layers: [{ name: "a" }] }).problems, [{ pointer: "/root", problem: "invalid-value" }], "a trap that throws, as a getter does");
});

test("VS1, VS12 step 2, I13: a value of elementsFromPoint that is no function -- absent, undefined among them -- is kept as none; the root opens and itemAt refuses with Error, the platform never asked", () => {
	for (const value of ["absent", undefined, null, 0, "elementsFromPoint", {}, [], Symbol("s")]) {
		const platform = fakeRoot();
		if (value !== "absent") platform.root.ownerDocument.elementsFromPoint = value;
		const opened = openScene({ root: platform.root, layers: LAYERS });
		assert.equal(opened.ok, true, String(value));
		opened.scene.put("items", "a", [{ tag: "g" }]);
		platform.root.ownerDocument.elementsFromPoint = () => assert.fail("a function set after opening is never called");
		assert.throws(() => opened.scene.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("elementsFromPoint"), String(value));
		assert.deepEqual(opened.scene.items("items").map((item) => item.key), ["a"], "the scene still open");
	}
});

test("VS1, VS12 step 3, I13: the function read is the one called, once per itemAt, with the document as its receiver and the point's x and y", () => {
	const { scene, answer, root } = rooted();
	root.ownerDocument.elementsFromPoint = () => assert.fail("a function set after opening is called");
	assert.equal(scene.itemAt({ x: 12.5, y: -0 }), null);
	assert.equal(scene.itemAt({ x: -1e300, y: 7 }), null);
	assert.equal(answer.calls.length, 2);
	assert.deepEqual(answer.calls[0], ["document", 12.5, -0]);
	assert.ok(Object.is(answer.calls[0][2], -0), "the point's own numbers, -0 kept");
	assert.deepEqual(answer.calls[1], ["document", -1e300, 7]);
});

test("VS12, I13: the first element the scene made for an item it still holds answers, with its path, nested shapes among them, looking through every other element", () => {
	const { scene, answer, root, back, items, free } = rooted();
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect" }, { tag: "g", children: [{ tag: "text", text: "t" }] }] }, { tag: "circle" }]);
	scene.put("back", "z", [{ tag: "path" }]);
	const [g, circle] = items.children;
	const [rect, inner] = g.children;
	const [text] = inner.children;
	const drawn = fakeElement("canvas", 90, []);
	free.appendChild(drawn);
	const page = fakeElement("body", 91, []);
	const cases = [
		[[text, inner, g, items, root, page], { layer: "items", key: "a", path: [0, 1, 0] }],
		[[rect, g], { layer: "items", key: "a", path: [0, 0] }],
		[[circle], { layer: "items", key: "a", path: [1] }],
		[[drawn, free, text], { layer: "items", key: "a", path: [0, 1, 0] }, "a foreign layer's content looked through"],
		[[free, items, back, root, page, back.children[0], circle], { layer: "back", key: "z", path: [0] }, "layers and the root looked through, the first held answering"],
		[[untouchable("a foreign element"), 5, null, "text", undefined, Symbol("s"), circle], { layer: "items", key: "a", path: [1] }, "anything else passed over, nothing of it read"],
	];
	for (const [stack, expected, label] of cases) {
		answer.next = () => stack;
		const at = scene.itemAt({ x: 1, y: 2 });
		assert.deepEqual(at, expected, label);
		assert.ok(isFrozenToDepth(at));
		assert.deepEqual(Object.keys(at), ["layer", "key", "path"]);
		assert.deepEqual(at, scene.itemOf(stack.find((element) => scene.itemOf(element) !== null)), "as itemOf recognises it");
	}
});

test("VS12, I13: null when no element of the stack is one the scene made for an item it still holds -- an empty stack, foreign content, an element of a removed item", () => {
	const { scene, answer, root, items, free } = rooted();
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect" }] }]);
	scene.put("items", "b", [{ tag: "circle" }]);
	const [g, circle] = items.children;
	const [rect] = g.children;
	const drawn = fakeElement("canvas", 90, []);
	free.appendChild(drawn);
	for (const stack of [[], [root], [drawn, free, items, root], [{}, fakeElement("rect", 99, [])]]) {
		answer.next = () => stack;
		assert.equal(scene.itemAt({ x: 0, y: 0 }), null);
	}
	scene.remove("items", "a");
	answer.next = () => [rect, g, root];
	assert.equal(scene.itemAt({ x: 0, y: 0 }), null, "an element of a removed item, and every element beneath it, passed over");
	answer.next = () => [rect, g, circle];
	assert.deepEqual(scene.itemAt({ x: 0, y: 0 }), { layer: "items", key: "b", path: [0] }, "passed over for the held item beneath it");
	scene.put("items", "b", [{ tag: "path" }]);
	assert.equal(scene.itemAt({ x: 0, y: 0 }), null, "an element replaced by another tag is no longer held");
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect" }] }]);
	answer.next = () => [rect, g];
	assert.equal(scene.itemAt({ x: 0, y: 0 }), null, "an item put again under a removed key makes new elements; the old stay forgotten");
});

test("VS12 step 1, I13: the point is read as a conversion reads one -- x then y through ordinary access, both before either is judged -- and refused with the TypeError unless both are finite numbers", () => {
	const { scene, answer } = rooted();
	for (const point of [undefined, null, 5, "1,2", () => 0, {}, { x: 1 }, { x: "1", y: 2 }, { x: 1, y: NaN }, { x: Infinity, y: 0 }, { x: 1, y: 2n }]) {
		assert.throws(() => scene.itemAt(point), isTypeError, describe(point));
	}
	assert.deepEqual(answer.calls, [], "the platform never asked for a malformed point");
	const log = [];
	const point = recorded({ x: "bad", y: 2 }, "point", log);
	assert.throws(() => scene.itemAt(point), isTypeError);
	assert.deepEqual(log, ["point get x", "point get y"], "both read before either is judged");
	const inherited = Object.create({ x: 3, y: 4 });
	assert.equal(scene.itemAt(inherited), null, "read through ordinary property access");
	assert.deepEqual(answer.calls.at(-1), ["document", 3, 4]);
});

test("VS12 step 2, I13: the state is judged before anything of the scene is read -- closed and failed refused as every function refuses them, a malformed point meeting the TypeError first; then no root, or no member, refused with Error", () => {
	const closed = rooted();
	closed.scene.close();
	assert.throws(() => closed.scene.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("closed"));
	assert.throws(() => closed.scene.itemAt({ x: NaN, y: 0 }), isTypeError, "a malformed point meets the TypeError first");
	assert.deepEqual(closed.answer.calls, []);
	const failed = rooted();
	failed.scene.put("items", "a", [{ tag: "g" }]);
	failed.hooks.before = (entry) => {
		if (entry[0] === "set") throw new Error("the platform throws");
	};
	assert.throws(() => failed.scene.put("items", "a", [{ tag: "g", attrs: { x: 1 } }]), /the platform throws/);
	assert.throws(() => failed.scene.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("failed"));
	assert.deepEqual(failed.answer.calls, []);
	const rootless = openScene({ layers: LAYERS }).scene;
	assert.throws(() => rootless.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("no root"));
	assert.throws(() => rootless.itemAt({ x: 0 }), isTypeError);
	const noMember = openScene({ root: fakeRoot().root, layers: LAYERS }).scene;
	assert.throws(() => noMember.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("elementsFromPoint"));
	rootless.close();
	assert.throws(() => rootless.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("closed"), "closed judged before the root");
});

test("VS12 step 3, I13: an answer Array.isArray does not accept is refused with Error -- an array-like, a typed array, an arguments object, a string, nothing", () => {
	const { scene, answer, items } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	const [g] = items.children;
	const answers = [undefined, null, g, { length: 1, 0: g }, new Set([g]), "g", 1, (function () {
		return arguments;
	})(g)];
	for (const value of answers) {
		answer.next = () => value;
		assert.throws(() => scene.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("no array"), typeof value);
	}
	answer.next = () => new Proxy([g], {});
	assert.deepEqual(scene.itemAt({ x: 0, y: 0 }), { layer: "items", key: "a", path: [0] }, "a Proxy of an array is an array");
	answer.next = () => Object.setPrototypeOf([g], null);
	assert.deepEqual(scene.itemAt({ x: 0, y: 0 }), { layer: "items", key: "a", path: [0] }, "an array of any prototype is an array");
});

test("VS12 step 4, I13: the answer's length is read once, by ordinary access, and refused with Error unless a safe non-negative integer", () => {
	const { scene, answer, items } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	const [g] = items.children;
	for (const length of [-1, 1.5, NaN, Infinity, 2 ** 53, "1", null, undefined, 1n, { valueOf: () => 1 }]) {
		answer.next = () => new Proxy([g], { get: (target, key) => (key === "length" ? length : target[key]) });
		assert.throws(() => scene.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("length"), String(length));
	}
	answer.next = () => new Proxy([g], { get: (target, key) => (key === "length" ? -0 : target[key]) });
	assert.equal(scene.itemAt({ x: 0, y: 0 }), null, "-0 is a length of 0");
	const log = [];
	answer.next = () => recorded([{}, {}, g, {}], "stack", log);
	assert.deepEqual(scene.itemAt({ x: 0, y: 0 }), { layer: "items", key: "a", path: [0] });
	assert.deepEqual(log, ["stack get length", "stack get 0", "stack get 1", "stack get 2"], "length once, then indices in order up to the first held, nothing else");
	log.length = 0;
	answer.next = () => recorded([{}, {}], "stack", log);
	assert.equal(scene.itemAt({ x: 0, y: 0 }), null);
	assert.deepEqual(log, ["stack get length", "stack get 0", "stack get 1"], "every index below length when none is held");
});

test("VS12 step 4, I13: length is read once, so an answer whose index getter appends an owned element answers null; an index getter that removes the item beneath passes it over", () => {
	const { scene, answer, items } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	scene.put("items", "b", [{ tag: "circle" }]);
	const [g, circle] = items.children;
	answer.next = () => {
		const stack = [];
		Object.defineProperty(stack, "0", {
			get() {
				stack.push(g);
				return {};
			},
			enumerable: true,
			configurable: true,
		});
		return stack;
	};
	assert.equal(scene.itemAt({ x: 0, y: 0 }), null, "the element appended past the length read is never read");
	answer.next = () => {
		const stack = [{}, circle];
		Object.defineProperty(stack, "0", {
			get() {
				scene.remove("items", "b");
				return {};
			},
			enumerable: true,
			configurable: true,
		});
		return stack;
	};
	assert.equal(scene.itemAt({ x: 0, y: 0 }), null, "an item the getter removed is no longer held when its element is read");
	assert.deepEqual(scene.items("items").map((item) => item.key), ["a"], "the getter's call took effect");
});

test("VS12, I13: an error the platform or a getter throws propagates unchanged and leaves the scene open", () => {
	const { scene, answer, items } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	const thrown = new RangeError("the platform's own");
	const throwers = [
		() => {
			throw thrown;
		},
		() => new Proxy([], {
			get(target, key) {
				if (key === "length") throw thrown;
				return target[key];
			},
		}),
		() => Object.defineProperty([items.children[0]], "0", {
			get() {
				throw thrown;
			},
		}),
	];
	for (const next of throwers) {
		answer.next = next;
		assert.throws(() => scene.itemAt({ x: 0, y: 0 }), (e) => e === thrown);
		assert.deepEqual(scene.items("items").map((item) => item.key), ["a"], "open");
	}
	answer.next = () => [items.children[0]];
	assert.deepEqual(scene.itemAt({ x: 0, y: 0 }), { layer: "items", key: "a", path: [0] });
});

test("VS12 step 5, I13: a getter that closes the scene, or fails it, is refused with Error, even when it answers a held element", () => {
	const closing = rooted();
	closing.scene.put("items", "a", [{ tag: "g" }]);
	const [g] = closing.items.children;
	closing.answer.next = () => Object.defineProperty([], "0", {
		get() {
			closing.scene.close();
			return g;
		},
		enumerable: true,
	});
	assert.throws(() => closing.scene.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("closed"));
	const failing = rooted();
	failing.scene.put("items", "a", [{ tag: "g" }]);
	const [h] = failing.items.children;
	failing.answer.next = () => new Proxy([h], {
		get(target, key) {
			if (key === "length") {
				failing.hooks.before = () => {
					throw new Error("the platform throws");
				};
				assert.throws(() => failing.scene.put("items", "b", [{ tag: "g" }]), /the platform throws/);
				failing.hooks.before = undefined;
			}
			return target[key];
		},
	});
	assert.throws(() => failing.scene.itemAt({ x: 0, y: 0 }), (e) => isBaseError(e) && e.message.includes("failed"));
	const opening = rooted();
	opening.answer.next = () => Object.defineProperty([], "0", {
		get() {
			opening.scene.put("items", "late", [{ tag: "rect" }]);
			return opening.items.children[0];
		},
		enumerable: true,
	});
	assert.deepEqual(opening.scene.itemAt({ x: 0, y: 0 }), { layer: "items", key: "late", path: [0] }, "a getter's put takes effect, and the scene stays open");
});

test("VS12, I13: nothing of any element is read -- each is known by identity alone, a Proxy of an element is not that element, and no trap runs", () => {
	const { scene, answer, items } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	const [g] = items.children;
	const ofMade = new Proxy(g, new Proxy({}, { get: () => () => assert.fail("a trap of an element's Proxy ran") }));
	answer.next = () => [untouchable("an element"), ofMade, Object.create(g)];
	assert.equal(scene.itemAt({ x: 0, y: 0 }), null);
	answer.next = () => [ofMade, g];
	assert.deepEqual(scene.itemAt({ x: 0, y: 0 }), { layer: "items", key: "a", path: [0] });
});
