// returned-values-and-errors - CONTRACT.md's "Errors" and "What is returned" (I8, with I1, I2 and I9):
// openScene refusing rather than throwing while it judges; every other function's malformed argument a
// TypeError beginning with its name, a getter's or a trap's error named by its typeof alone; a call the
// state does not allow an Error of the base constructor; a platform's error propagating unchanged; every
// value the scene makes fresh and frozen to its depth, its keys in their written order, a description the
// scene's own copy returned by reference; nothing the application passes kept, frozen or changed; and no
// function needing a receiver or reading an argument beyond its form.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openScene } from "@apnex/vector-scene";
import { fakeRoot } from "../support/fake-dom.js";
import { describe, isFrozenToDepth } from "../support/frozen.js";
import { recorded, revoked, trapping } from "../support/recording-proxy.js";

const LAYERS = [{ name: "items" }, { name: "free", foreign: true }];
const SCENE_KEYS = ["layers", "put", "remove", "items", "itemOf", "itemAt", "layerElement", "toDrawing", "toScreen", "close"];
const isTypeError = (fn) => (e) => Object.getPrototypeOf(e) === TypeError.prototype && e.message.startsWith(`${fn}: `);
const isBaseError = (fn) => (e) => Object.getPrototypeOf(e) === Error.prototype && e.message.startsWith(`${fn}: `);
/** A value every trap of which fails the test: an argument beyond a function's form, which must never be read. */
const unread = () => new Proxy({}, new Proxy({}, { get: () => () => assert.fail("an argument beyond the form was read") }));

/** A rooted scene over a fake platform whose hit test answers the items layer's elements, topmost first. */
function rooted() {
	let items = null;
	const platform = fakeRoot(undefined, () => [...items.children].reverse());
	const { scene } = openScene({ root: platform.root, layers: LAYERS });
	items = platform.root.children[0];
	return { ...platform, scene, items };
}

test("Errors: openScene never throws while it reads and judges a declaration, whatever its getters and traps do", () => {
	const throwingGetter = Object.defineProperty({}, "layers", {
		get() {
			throw new Error("a getter");
		},
		enumerable: true,
	});
	const hostileRoot = { get ownerDocument() { throw new Error("no document"); }, appendChild() {}, getScreenCTM() {} };
	const values = [undefined, null, 0, NaN, "", true, Symbol("s"), 1n, [], {}, () => ({}), revoked({}), trapping({}, "ownKeys"), throwingGetter, { root: hostileRoot, layers: [{ name: "a" }] }, { root: revoked({}), layers: trapping([], "get") }, { layers: [revoked({}), trapping({}, "getPrototypeOf"), { name: "a", attrs: revoked({}) }] }];
	values.forEach((value, index) => {
		assert.doesNotThrow(() => openScene(value), `case ${index}`);
		assert.equal(openScene(value).ok, false, `case ${index}`);
	});
});

test("Errors: openScene throws only the error a platform method threw while it made the layers, unchanged, after removing them", () => {
	const { root, hooks } = fakeRoot();
	const thrown = new RangeError("the platform's own");
	hooks.before = (entry) => {
		if (entry[0] === "append" && entry[2] === 2) throw thrown;
	};
	assert.throws(() => openScene({ root, layers: LAYERS }), (e) => e === thrown);
	assert.deepEqual(root.children, []);
});

test("Errors: each function's malformed argument is a TypeError beginning with its name and a colon", () => {
	const { scene } = rooted();
	const cases = [
		["put", [5, "a", [{ tag: "g" }]]],
		["put", ["free", "a", [{ tag: "g" }]]],
		["put", ["items", "", [{ tag: "g" }]]],
		["put", ["items", 1, [{ tag: "g" }]]],
		["put", ["items", "a", "g"]],
		["put", ["items", "a", [{ tag: "g" }], 5]],
		["remove", ["nothing", "a"]],
		["remove", ["items", null]],
		["items", [undefined]],
		["items", ["free"]],
		["layerElement", ["items"]],
		["layerElement", [{}]],
		["toDrawing", [null]],
		["toDrawing", [{ x: 1, y: "2" }]],
		["toScreen", [[1, 2]]],
		["itemAt", [null]],
		["itemAt", [{ x: 1, y: NaN }]],
		["itemAt", [() => ({ x: 1, y: 2 })]],
	];
	for (const [fn, args] of cases) assert.throws(() => scene[fn](...args), isTypeError(fn), `${fn} ${describe(args)}`);
});

test("Errors: an error a getter or a trap threw while an argument is read is rethrown as that TypeError, the thrown value named by its typeof alone, no code of it run", () => {
	const { scene } = rooted();
	const trapLog = [];
	const thrownProxy = recorded(new Error("hidden"), "thrown", trapLog);
	let read = false;
	const hostile = {
		get message() {
			read = true;
			return "m";
		},
		toString() {
			read = true;
			return "s";
		},
	};
	const throwingTrap = (thrown) => new Proxy({ tag: "g" }, {
		ownKeys() {
			throw thrown;
		},
	});
	const throwingPoint = (thrown) => ({
		get x() {
			throw thrown;
		},
		y: 0,
	});
	const named = [[thrownProxy, "an object"], [hostile, "an object"], [Object.assign(() => 0, { message: "m" }), "a function"], ["boom", "boom"], [404, "404"], [null, "null"], [undefined, "undefined"], [Symbol("s"), "Symbol(s)"], [7n, "7"], [false, "false"]];
	for (const [thrown, name] of named) {
		assert.throws(() => scene.put("items", "a", [throwingTrap(thrown)]), (e) => isTypeError("put")(e) && e.message.endsWith(`could not be read: ${name}`), `put, ${name}`);
		assert.throws(() => scene.put("items", "a", [{ tag: "g", attrs: throwingTrap(thrown) }]), (e) => isTypeError("put")(e) && e.message.endsWith(`could not be read: ${name}`), `attrs, ${name}`);
		assert.throws(() => scene.put("items", "a", [{ tag: "g" }], throwingTrap(thrown)), (e) => isTypeError("put")(e) && e.message.endsWith(`could not be read: ${name}`), `place, ${name}`);
		assert.throws(() => scene.toDrawing(throwingPoint(thrown)), (e) => isTypeError("toDrawing")(e) && e.message.endsWith(`could not be read: ${name}`), `toDrawing, ${name}`);
		assert.throws(() => scene.itemAt(throwingPoint(thrown)), (e) => isTypeError("itemAt")(e) && e.message.endsWith(`could not be read: ${name}`), `itemAt, ${name}`);
	}
	assert.deepEqual(trapLog, [], "no trap of the thrown Proxy ran");
	assert.equal(read, false, "neither the thrown object's message nor its string form was read");
});

test("Errors: a call the scene's state does not allow is an Error of the base constructor beginning with the function's name; a before naming no item is one", () => {
	const { scene } = rooted();
	assert.throws(() => scene.put("items", "a", [{ tag: "g" }], { before: "none" }), isBaseError("put"));
	const rootless = openScene({ layers: LAYERS }).scene;
	assert.throws(() => rootless.layerElement("free"), isBaseError("layerElement"));
	assert.throws(() => rootless.toScreen({ x: 0, y: 0 }), isBaseError("toScreen"));
	assert.throws(() => rootless.itemAt({ x: 0, y: 0 }), isBaseError("itemAt"));
	assert.throws(() => openScene({ root: fakeRoot().root, layers: LAYERS }).scene.itemAt({ x: 0, y: 0 }), isBaseError("itemAt"), "a root whose document held no elementsFromPoint");
	scene.close();
	for (const [fn, args] of [["put", ["items", "a", [{ tag: "g" }]]], ["remove", ["items", "a"]], ["items", ["items"]], ["itemOf", [null]], ["itemAt", [{ x: 0, y: 0 }]], ["layerElement", ["free"]], ["toDrawing", [{ x: 0, y: 0 }]], ["toScreen", [{ x: 0, y: 0 }]]]) {
		assert.throws(() => scene[fn](...args), isBaseError(fn), fn);
	}
});

test("Errors: a platform method's error propagates unchanged -- while the scene writes, failing it; while it converts, leaving it open; from close's removals, after every removal", () => {
	const writing = rooted();
	const thrown = new SyntaxError("the platform's own");
	writing.hooks.before = (entry) => {
		if (entry[0] === "create") throw thrown;
	};
	assert.throws(() => writing.scene.put("items", "a", [{ tag: "g" }]), (e) => e === thrown);
	writing.hooks.before = undefined;
	assert.throws(() => writing.scene.items("items"), isBaseError("items"), "failed");
	const converting = fakeRoot();
	converting.root.getScreenCTM = () => {
		throw thrown;
	};
	const convertingScene = openScene({ root: converting.root, layers: LAYERS }).scene;
	assert.throws(() => convertingScene.toScreen({ x: 0, y: 0 }), (e) => e === thrown);
	assert.deepEqual(convertingScene.items("items"), [], "open");
	const closing = rooted();
	closing.hooks.before = (entry) => {
		if (entry[0] === "remove") throw thrown;
	};
	assert.throws(() => closing.scene.close(), (e) => e === thrown);
});

/** A fake root whose document's createElementNS answers what `answer(made, tag)` makes of each element it would make, as `mode` says at the time. */
function rootWhoseElements(answer) {
	const platform = fakeRoot();
	const make = platform.root.ownerDocument.createElementNS;
	platform.root.ownerDocument.createElementNS = (namespace, tag) => answer(make(namespace, tag), tag);
	return platform;
}
const isPlatformFailure = (fn, method) => (e) => Object.getPrototypeOf(e) === Error.prototype && e.message.startsWith(`${fn}: `) && e.message.includes(method);

test("Errors: an element the root's document made that holds no element method, or refuses its text, is a platform failure -- an Error beginning with the function's name, the scene failed -- never the engine's TypeError", () => {
	// an object with no element method at all, answered once the scene is open: put fails the scene
	let broken = false;
	const bare = rootWhoseElements((made) => (broken ? {} : made));
	const scene = openScene({ root: bare.root, layers: LAYERS }).scene;
	broken = true;
	assert.throws(() => scene.put("items", "a", [{ tag: "g", attrs: { x: 1 } }]), isPlatformFailure("put", "setAttribute"));
	assert.throws(() => scene.items("items"), isBaseError("items"), "the scene is failed");
	assert.equal(scene.close(), undefined, "close is left, and removes the layers");
	assert.deepEqual(bare.root.children, []);
	// one method missing at a time, each met where VS7 calls it
	const missing = [
		["removeAttribute", (s) => s.put("items", "a", [{ tag: "rect" }]), "put"],
		["appendChild", (s) => s.put("items", "a", [{ tag: "rect", children: [{ tag: "rect" }] }]), "put"],
		["insertBefore", (s) => {
			s.put("items", "a", [{ tag: "rect", children: [{ tag: "circle" }] }]);
			s.put("items", "a", [{ tag: "rect", children: [{ tag: "path" }] }]);
		}, "put"],
		["remove", (s) => s.remove("items", "a"), "remove"],
	];
	for (const [method, call, fn] of missing) {
		const platform = rootWhoseElements((made, tag) => {
			if (tag === "rect") delete made[method];
			return made;
		});
		const opened = openScene({ root: platform.root, layers: LAYERS }).scene;
		opened.put("items", "a", [{ tag: "rect", attrs: { y: 1 } }]);
		assert.throws(() => call(opened), isPlatformFailure(fn, method), method);
		assert.throws(() => opened.items("items"), isBaseError("items"), `${method}: failed`);
	}
	// an element whose textContent cannot be written
	const unwritable = rootWhoseElements((made, tag) => (tag === "text" ? Object.defineProperty(made, "textContent", { value: "", writable: false }) : made));
	const texts = openScene({ root: unwritable.root, layers: LAYERS }).scene;
	assert.throws(() => texts.put("items", "a", [{ tag: "text", text: "hi" }]), isPlatformFailure("put", "textContent"));
	assert.throws(() => texts.items("items"), isBaseError("items"));
	// a layer that cannot take its attributes: openScene takes back what it made and throws the Error
	const opening = rootWhoseElements(() => ({}));
	assert.throws(() => openScene({ root: opening.root, layers: [{ name: "a", attrs: { id: "a" } }] }), isPlatformFailure("openScene", "setAttribute"));
	assert.deepEqual(opening.root.children, []);
	// a layer that cannot be removed: close attempts every removal, then throws the first Error
	const layers = rootWhoseElements((made) => {
		if (made.serial === 2) delete made.remove;
		return made;
	});
	const closing = openScene({ root: layers.root, layers: LAYERS }).scene;
	assert.throws(() => closing.close(), isPlatformFailure("close", "remove"));
	assert.deepEqual(layers.root.children.map((child) => child.serial), [2], "every other layer removed");
});

test("What is returned: every value the scene makes is made afresh by the call that first returns it and frozen to its depth", () => {
	const { scene, items } = rooted();
	const opened = openScene({ layers: LAYERS });
	assert.ok(isFrozenToDepth(opened));
	assert.notEqual(openScene({ layers: LAYERS }), opened);
	const refused = openScene({ layers: [] });
	assert.ok(isFrozenToDepth(refused));
	assert.notEqual(openScene({ layers: [] }).problems, refused.problems);
	assert.ok(isFrozenToDepth(scene));
	assert.ok(isFrozenToDepth(scene.layers));
	scene.put("items", "a", [{ tag: "g", attrs: { n: 1 }, children: [{ tag: "text", text: "t" }] }]);
	const answer = scene.items("items");
	assert.ok(isFrozenToDepth(answer));
	assert.notEqual(scene.items("items"), answer, "the array afresh");
	assert.notEqual(scene.items("items")[0], answer[0], "each record afresh");
	const at = scene.itemOf(items.children[0]);
	assert.ok(isFrozenToDepth(at));
	assert.notEqual(scene.itemOf(items.children[0]), at);
	const under = scene.itemAt({ x: 1, y: 2 });
	assert.deepEqual(under, at);
	assert.ok(isFrozenToDepth(under));
	assert.notEqual(scene.itemAt({ x: 1, y: 2 }), under);
	assert.notEqual(scene.itemAt({ x: 1, y: 2 }).path, under.path);
	const point = scene.toDrawing({ x: 1, y: 2 });
	assert.ok(isFrozenToDepth(point));
	assert.notEqual(scene.toDrawing({ x: 1, y: 2 }), point);
	for (const fn of SCENE_KEYS.slice(1)) assert.ok(Object.isFrozen(scene[fn]), `${fn} frozen`);
});

test("What is returned, I8: a description is the scene's own frozen copy, made when the item is put and returned by reference afterwards; it is accepted by put, and putting it again calls nothing", () => {
	const { scene, log } = rooted();
	const shapes = [{ tag: "g", attrs: { x: 1, y: "2" }, children: [{ tag: "text", text: "t" }, { tag: "rect", children: [] }] }];
	scene.put("items", "a", shapes);
	const [{ shapes: described }] = scene.items("items");
	assert.notEqual(described, shapes);
	assert.notEqual(described[0], shapes[0]);
	assert.equal(scene.items("items")[0].shapes, described, "the very value, answered again");
	assert.equal(scene.items("items")[0].shapes[0].children[0], described[0].children[0]);
	assert.ok(isFrozenToDepth(described));
	log.length = 0;
	scene.put("items", "a", described);
	assert.deepEqual(log, [], "putting it again to its own item, with no place, calls nothing");
	assert.equal(scene.items("items")[0].shapes === described, false, "a put makes a new copy, even of the scene's own");
	assert.deepEqual(scene.items("items")[0].shapes, described);
	scene.put("items", "a", [{ tag: "rect" }]);
	assert.deepEqual(described, [{ tag: "g", attrs: { x: "1", y: "2" }, children: [{ tag: "text", attrs: {}, text: "t" }, { tag: "rect", attrs: {} }] }], "an old description is unchanged by a later put");
});

test("What is returned: every record holds its properties in its written order and nothing else", () => {
	const { scene, items } = rooted();
	assert.deepEqual(Reflect.ownKeys(openScene({ layers: LAYERS })), ["ok", "scene"]);
	assert.deepEqual(Reflect.ownKeys(openScene({})), ["ok", "problems"]);
	assert.deepEqual(Reflect.ownKeys(openScene({}).problems[0]), ["pointer", "problem"]);
	assert.deepEqual(Reflect.ownKeys(scene), SCENE_KEYS);
	assert.deepEqual(Reflect.ownKeys(scene.layers[0]), ["name", "attrs", "foreign"]);
	scene.put("items", "a", [{ children: [], attrs: { b: 1, a: 2 }, tag: "g" }]);
	const [item] = scene.items("items");
	assert.deepEqual(Reflect.ownKeys(item), ["key", "shapes"]);
	assert.deepEqual(Reflect.ownKeys(item.shapes[0]), ["tag", "attrs"]);
	assert.deepEqual(Reflect.ownKeys(item.shapes[0].attrs), ["b", "a"]);
	assert.deepEqual(Reflect.ownKeys(scene.itemOf(items.children[0])), ["layer", "key", "path"]);
	assert.deepEqual(Reflect.ownKeys(scene.itemAt({ x: 0, y: 0 })), ["layer", "key", "path"]);
	assert.deepEqual(Reflect.ownKeys(scene.toScreen({ x: 0, y: 0 })), ["x", "y"]);
	assert.deepEqual(Reflect.ownKeys(scene.items("items")), ["0", "length"]);
	assert.equal(Object.getPrototypeOf(item.shapes[0]), Object.prototype);
	assert.equal(Object.getPrototypeOf(scene.items("items")), Array.prototype);
});

test("What is returned: put, remove and close return undefined", () => {
	const { scene } = rooted();
	assert.equal(scene.put("items", "a", [{ tag: "g" }]), undefined);
	assert.equal(scene.remove("items", "a"), undefined);
	assert.equal(scene.remove("items", "a"), undefined);
	assert.equal(scene.close(), undefined);
	assert.equal(scene.close(), undefined);
});

test("What is returned: no function the scene makes needs a receiver, and none reads an argument beyond those its form names", () => {
	const { scene, items } = rooted();
	const { put, remove, items: itemsOf, itemOf, itemAt, layerElement, toDrawing, toScreen, close } = scene;
	assert.equal(put("items", "a", [{ tag: "g" }], {}, unread()), undefined);
	assert.equal(Reflect.apply(put, { not: "the scene" }, ["items", "b", [{ tag: "g" }]]), undefined);
	assert.deepEqual(itemsOf("items", unread()).map((item) => item.key), ["a", "b"]);
	assert.deepEqual(itemOf(items.children[0], unread()), { layer: "items", key: "a", path: [0] });
	assert.deepEqual(Reflect.apply(itemAt, undefined, [{ x: 0, y: 0 }, unread()]), { layer: "items", key: "b", path: [0] });
	assert.equal(layerElement("free", unread()), scene.layerElement("free"));
	assert.deepEqual(toDrawing({ x: 12, y: 24 }, unread()), { x: 1, y: 2 });
	assert.deepEqual(Reflect.apply(toScreen, null, [{ x: 1, y: 2 }, unread()]), { x: 12, y: 24 });
	assert.equal(remove("items", "b", unread()), undefined);
	assert.equal(close(unread()), undefined);
	assert.equal(openScene({ layers: LAYERS }, unread()).ok, true);
});

test("What is returned: nothing the application passes is kept, frozen or changed -- a declaration, its attributes, shapes, a place, a point", () => {
	const { scene } = rooted();
	const declaration = { layers: [{ name: "items", attrs: { id: "x" } }] };
	const opened = openScene(declaration).scene;
	assert.ok(!Object.isFrozen(declaration) && !Object.isFrozen(declaration.layers) && !Object.isFrozen(declaration.layers[0].attrs));
	declaration.layers[0].attrs.id = "changed";
	assert.equal(opened.layers[0].attrs.id, "x");
	const attrs = { a: 1 };
	const child = { tag: "text", text: "t" };
	const shapes = [{ tag: "g", attrs, children: [child] }];
	const place = { before: null };
	const point = { x: 1, y: 2 };
	scene.put("items", "a", shapes, place);
	scene.toDrawing(point);
	scene.itemAt(point);
	for (const value of [attrs, child, shapes, shapes[0], place, point]) assert.ok(!Object.isFrozen(value), describe(value));
	assert.deepEqual(shapes, [{ tag: "g", attrs: { a: 1 }, children: [{ tag: "text", text: "t" }] }], "unchanged: a number not rewritten as a string");
	attrs.a = 2;
	child.text = "changed";
	shapes.push({ tag: "rect" });
	assert.deepEqual(scene.items("items")[0].shapes, [{ tag: "g", attrs: { a: "1" }, children: [{ tag: "text", attrs: {}, text: "t" }] }], "not kept");
});
