// keyed-shapes - VS1 and VS5 to VS8 (I3, I4, I5, I6, I8): items of shapes put, replaced, moved and removed by
// key within a layer; the platform brought to show exactly the description by exactly VS7's calls, held
// against a model written apart over generated sequences; the description read back as data that can be put
// again; the platform slice held by a recording test; and every reading of a shape and a place, each order
// held by a Proxy that records each trap.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openScene } from "@apnex/vector-scene";
import { elementsBeneath, fakeRoot, treeOf, treeOfShape } from "../support/fake-dom.js";
import { isFrozenToDepth } from "../support/frozen.js";
import { randomOperation, randomTools, seededRandom } from "../support/generate.js";
import { recordingPlatform } from "../support/recording-platform.js";
import { phantom, recorded, revoked, trapping } from "../support/recording-proxy.js";
import { vs7Model } from "../support/vs7-model.js";

const LAYERS = [{ name: "back", attrs: { id: "back" } }, { name: "items" }, { name: "free", foreign: true }];
const refusedPut = (call, label) => assert.throws(call, (e) => e.constructor === TypeError && e.message.startsWith("put: "), label);

/** A rooted scene over a fake platform: the scene, the root, its log, and the items layer's element. */
function rooted(layers = LAYERS) {
	const platform = fakeRoot();
	const opened = openScene({ root: platform.root, layers });
	assert.equal(opened.ok, true);
	const layerOf = (name) => platform.root.children[layers.findIndex((layer) => layer.name === name)];
	return { ...platform, scene: opened.scene, layerOf, items: layerOf("items") };
}

/** Each element under a layer against the descriptions items answers, attributes compared as maps. */
function showsItems(scene, layerElement, layer = "items") {
	const asMaps = (tree) => ({ ...tree, attrs: Object.fromEntries(tree.attrs), children: tree.children.map(asMaps) });
	assert.deepEqual(layerElement.children.map(treeOf).map(asMaps), scene.items(layer).flatMap((item) => item.shapes).map(treeOfShape).map(asMaps));
}

test("VS5: a shape's form -- a tag, attrs, and text or children -- and its description: tag and attrs, then text or children only when not empty", () => {
	const { scene } = rooted();
	scene.put("items", "a", [{ tag: "g", attrs: { id: "a", x: 1.5, y: -0, big: 1e21, small: 5e-324 }, children: [{ tag: "text", text: "hi" }, { tag: "rect", text: "" }, { tag: "g", children: [] }] }]);
	const [shape] = scene.items("items")[0].shapes;
	assert.deepEqual(shape, { tag: "g", attrs: { id: "a", x: "1.5", y: "0", big: "1e+21", small: "5e-324" }, children: [{ tag: "text", attrs: {}, text: "hi" }, { tag: "rect", attrs: {} }, { tag: "g", attrs: {} }] });
	assert.deepEqual(Object.keys(shape), ["tag", "attrs", "children"]);
	assert.deepEqual(Object.keys(shape.attrs), ["id", "x", "y", "big", "small"], "the record's own keys' order");
	assert.deepEqual(shape.children.map((child) => Object.keys(child)), [["tag", "attrs", "text"], ["tag", "attrs"], ["tag", "attrs"]]);
	assert.ok(isFrozenToDepth(shape));
	scene.put("items", "p", [{ tag: "path", attrs: Object.defineProperty({}, "__proto__", { value: "kept", enumerable: true }) }]);
	const [path] = scene.items("items")[1].shapes;
	assert.equal(Object.getPrototypeOf(path.attrs), Object.prototype, "an attribute named __proto__ is an own property, not the prototype");
	assert.deepEqual(Object.getOwnPropertyNames(path.attrs), ["__proto__"]);
	for (const tag of ["a", "Z9", "font-face", "x-y-1", "feGaussianBlur"]) scene.put("items", "t", [{ tag }]);
	for (const name of ["_x", "x.y", "xml-space", "a0", "Data_.-1", "o", "no", "xon"]) scene.put("items", "n", [{ tag: "g", attrs: { [name]: "v" } }]);
});

test("VS5: shapes refused -- a tag, an attribute's name or value, text, children, both, an unknown key, an accessor, present undefined, no shapes", () => {
	const { scene, log } = rooted();
	log.length = 0;
	const bad = [
		["not an array", { tag: "g" }],
		["no shapes", []],
		["a hole", new Array(1)],
		["no tag", [{}]],
		["a tag of another form", [{ tag: "1g" }]],
		["a tag with a colon", [{ tag: "svg:g" }]],
		["an empty tag", [{ tag: "" }]],
		["a tag no string", [{ tag: 5 }]],
		["an unknown key", [{ tag: "g", style: "x" }]],
		["both text and children", [{ tag: "g", text: "", children: [] }]],
		["text no string", [{ tag: "g", text: 5 }]],
		["children no array", [{ tag: "g", children: {} }]],
		["a child of another kind", [{ tag: "g", children: [5] }]],
		["attrs no object", [{ tag: "g", attrs: [] }]],
		["attrs of another prototype", [{ tag: "g", attrs: new Map() }]],
		["an attribute named on...", [{ tag: "g", attrs: { onclick: "x" } }]],
		["an attribute named ON... in any case", [{ tag: "g", attrs: { ONLOAD: "x" } }]],
		["an attribute named On", [{ tag: "g", attrs: { On: "x" } }]],
		["an attribute with a colon", [{ tag: "g", attrs: { "xlink:href": "#a" } }]],
		["an attribute beginning with a digit", [{ tag: "g", attrs: { "1x": "a" } }]],
		["an attribute beginning with a hyphen", [{ tag: "g", attrs: { "-x": "a" } }]],
		["an attribute holding a space", [{ tag: "g", attrs: { "a b": "a" } }]],
		["an attribute NaN", [{ tag: "g", attrs: { x: NaN } }]],
		["an attribute Infinity", [{ tag: "g", attrs: { x: Infinity } }]],
		["an attribute null", [{ tag: "g", attrs: { x: null } }]],
		["an attribute undefined", [{ tag: "g", attrs: { x: undefined } }]],
		["an attribute true", [{ tag: "g", attrs: { x: true } }]],
		["an attribute a BigInt", [{ tag: "g", attrs: { x: 1n } }]],
		["a tag present as undefined", [{ tag: undefined }]],
		["attrs present as undefined", [{ tag: "g", attrs: undefined }]],
		["text present as undefined", [{ tag: "g", text: undefined }]],
		["a shape of another realm's prototype", [Object.create({ tag: "g" })]],
		["a function as a shape", [Object.assign(() => 0, { tag: "g" })]],
		["a revoked shape", [revoked({ tag: "g" })]],
		["a shape whose ownKeys trap throws", [trapping({ tag: "g" }, "ownKeys")]],
		["an array holding another key", [Object.assign([{ tag: "g" }], { extra: 1 })]],
	];
	for (const [label, shapes] of bad) refusedPut(() => scene.put("items", "a", shapes), label);
	refusedPut(() => scene.put("items", "a", [Object.defineProperty({}, "tag", { get: () => assert.fail("a shape's getter ran"), enumerable: true })]), "an accessor tag");
	refusedPut(() => scene.put("items", "a", [{ tag: "g", attrs: Object.defineProperty({}, "x", { get: () => assert.fail("an attribute's getter ran"), enumerable: true }) }]), "an accessor attribute, no getter run");
	assert.deepEqual(log, [], "nothing written for a refused put");
	assert.deepEqual(scene.items("items"), []);
	assert.equal(scene.put("items", "a", [phantom({ tag: "g" }, "text", "children")]), undefined, "a phantom text or children is absent");
	assert.deepEqual(scene.items("items")[0].shapes, [{ tag: "g", attrs: {} }]);
});

test("VS5, I5: shapes nest at most 32 deep; a shape at depth 33 is refused with nothing of it read", () => {
	const { scene } = rooted();
	const nest = (depth, innermost) => (depth === 1 ? innermost : { tag: "g", children: [nest(depth - 1, innermost)] });
	scene.put("items", "deep", [nest(32, { tag: "rect", children: [] })]);
	let depth = 0;
	for (let shape = scene.items("items")[0].shapes[0]; shape; shape = shape.children?.[0]) depth++;
	assert.equal(depth, 32);
	const log = [];
	refusedPut(() => scene.put("items", "deeper", [nest(32, { tag: "g", children: [recorded({ tag: "rect" }, "depth33", log)] })]), "depth 33");
	assert.deepEqual(log, [], "nothing of the shape at depth 33 was read");
});

test("I5: a shape is read -- prototype, own keys, the four descriptors held, then tag, attrs, text, children -- and refused before its values when it holds both text and children", () => {
	const { scene } = rooted();
	const log = [];
	const attrs = recorded({ x: 1, y: "2" }, "attrs", log);
	const child = recorded({ tag: "text", text: "t" }, "child", log);
	const children = recorded([child], "children", log);
	const shape = recorded({ children, attrs, tag: "g" }, "shape", log);
	const shapes = recorded([shape], "shapes", log);
	const place = recorded({ before: null }, "place", log);
	scene.put("items", "k", shapes, place);
	assert.deepEqual(log, [
		"shapes getPrototypeOf",
		"shapes ownKeys",
		"shapes getOwnPropertyDescriptor length",
		"shapes getOwnPropertyDescriptor 0",
		"shape getPrototypeOf",
		"shape ownKeys",
		"shape getOwnPropertyDescriptor tag",
		"shape getOwnPropertyDescriptor attrs",
		"shape getOwnPropertyDescriptor children",
		"attrs getPrototypeOf",
		"attrs ownKeys",
		"attrs getOwnPropertyDescriptor x",
		"attrs getOwnPropertyDescriptor y",
		"children getPrototypeOf",
		"children ownKeys",
		"children getOwnPropertyDescriptor length",
		"children getOwnPropertyDescriptor 0",
		"child getPrototypeOf",
		"child ownKeys",
		"child getOwnPropertyDescriptor tag",
		"child getOwnPropertyDescriptor text",
		"place getPrototypeOf",
		"place ownKeys",
		"place getOwnPropertyDescriptor before",
	]);
	const both = [];
	refusedPut(() => scene.put("items", "k", [recorded({ tag: "g", attrs: recorded({ x: 1 }, "attrs", both), text: "", children: [] }, "shape", both)]), "both");
	assert.deepEqual(both, ["shape getPrototypeOf", "shape ownKeys", "shape getOwnPropertyDescriptor tag", "shape getOwnPropertyDescriptor attrs", "shape getOwnPropertyDescriptor text", "shape getOwnPropertyDescriptor children"], "refused before attrs is read");
	const unknown = [];
	refusedPut(() => scene.put("items", "k", [recorded({ tag: "g", extra: 1 }, "shape", unknown)]), "an unknown key");
	assert.deepEqual(unknown, ["shape getPrototypeOf", "shape ownKeys"], "an unknown key refuses at the own keys, no descriptor read");
});

test("I5: each refusal stops the reading there -- an attribute's name before its descriptor, the first shape before the second, the shapes before the place", () => {
	const { scene } = rooted();
	const atName = [];
	refusedPut(() => scene.put("items", "k", [{ tag: "g", attrs: recorded({ ok: "1", onx: "2", later: "3" }, "attrs", atName) }]), "an on name");
	assert.deepEqual(atName, ["attrs getPrototypeOf", "attrs ownKeys", "attrs getOwnPropertyDescriptor ok"], "the bad name refuses before its descriptor, and the later key is never read");
	const atValue = [];
	refusedPut(() => scene.put("items", "k", [{ tag: "g", attrs: recorded({ a: NaN, b: "2" }, "attrs", atValue) }]), "a NaN value");
	assert.deepEqual(atValue, ["attrs getPrototypeOf", "attrs ownKeys", "attrs getOwnPropertyDescriptor a"]);
	const second = [];
	const place = recorded({}, "place", second);
	refusedPut(() => scene.put("items", "k", [{ tag: "!" }, recorded({ tag: "g" }, "second", second)], place), "a bad first shape");
	assert.deepEqual(second, [], "neither the second shape nor the place was read");
	const placeLog = [];
	refusedPut(() => scene.put("items", "k", [{ tag: "g" }], recorded({ before: "x", after: "y" }, "place", placeLog)), "a place holding another key");
	assert.deepEqual(placeLog, ["place getPrototypeOf", "place ownKeys"]);
	const order = [];
	assert.throws(() => scene.put(recorded({}, "layer", order), recorded({}, "key", order), recorded([], "shapes", order)), /^TypeError: put: /);
	assert.deepEqual(order, [], "a layer of another kind is refused first, by typeof, reading nothing");
});

test("I5: a place -- at most before, null or another item's non-empty key; omitted and undefined the same", () => {
	const { scene } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	const bad = [
		["null", null],
		["a number", 5],
		["a string", "a"],
		["an array", []],
		["a function", () => 0],
		["of another prototype", Object.create({ before: null })],
		["before empty", { before: "" }],
		["before a number", { before: 5 }],
		["before present as undefined", { before: undefined }],
		["another key", { before: "a", other: 1 }],
		["before an accessor, no getter run", Object.defineProperty({}, "before", { get: () => assert.fail("a place getter ran"), enumerable: true })],
	];
	for (const [label, place] of bad) refusedPut(() => scene.put("items", "b", [{ tag: "g" }], place), label);
	refusedPut(() => scene.put("items", "a", [{ tag: "g" }], { before: "a" }), "before naming the item itself");
	assert.equal(scene.put("items", "b", [{ tag: "g" }], undefined), undefined);
	assert.equal(scene.put("items", "c", [{ tag: "g" }], phantom({}, "before")), undefined, "a phantom before is absent");
	assert.deepEqual(scene.items("items").map((item) => item.key), ["a", "b", "c"]);
});

test("I5: a trap that calls the scene while put's arguments are read takes effect first, and the put then sees what it left", () => {
	const { scene, items } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	const shape = new Proxy({ tag: "rect" }, {
		ownKeys(target) {
			scene.put("items", "inner", [{ tag: "circle" }]);
			return Reflect.ownKeys(target);
		},
	});
	scene.put("items", "outer", [shape], { before: "inner" });
	assert.deepEqual(scene.items("items").map((item) => item.key), ["a", "outer", "inner"], "the put placed outer before the item the trap put");
	showsItems(scene, items);
});

test("VS6: a new item is placed before the item named, or last; an item put again keeps its place, or moves before the item named or last, whether or not it stands there", () => {
	const { scene, items, log } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	scene.put("items", "b", [{ tag: "g" }]);
	scene.put("items", "c", [{ tag: "g" }], { before: "a" });
	scene.put("items", "d", [{ tag: "g" }], { before: null });
	scene.put("items", "e", [{ tag: "g" }], {});
	assert.deepEqual(scene.items("items").map((item) => item.key), ["c", "a", "b", "d", "e"]);
	scene.put("items", "c", [{ tag: "rect" }]);
	assert.deepEqual(scene.items("items").map((item) => item.key), ["c", "a", "b", "d", "e"], "no before: kept in place");
	scene.put("items", "c", [{ tag: "rect" }], { before: "b" });
	assert.deepEqual(scene.items("items").map((item) => item.key), ["a", "c", "b", "d", "e"]);
	const [, c, b] = items.children;
	log.length = 0;
	scene.put("items", "c", [{ tag: "rect" }], { before: "b" });
	assert.deepEqual(log, [["insert", items.serial, c.serial, b.serial]], "before where it stands already: moved again");
	log.length = 0;
	scene.put("items", "e", [{ tag: "g" }], { before: null });
	assert.deepEqual(log, [["append", items.serial, items.children.at(-1).serial]], "last where it stands already: appended again");
	showsItems(scene, items);
});

test("VS6: a before naming no item of the layer throws Error, after the arguments are read and before anything changes", () => {
	const { scene, log } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	scene.put("back", "z", [{ tag: "g" }]);
	log.length = 0;
	for (const key of ["a", "new"]) {
		assert.throws(() => scene.put("items", key, [{ tag: "rect" }], { before: "z" }), (e) => e.constructor === Error && e.message.startsWith("put: "), "another layer's item is no item of this one");
	}
	refusedPut(() => scene.put("items", "a", [{ tag: "!" }], { before: "z" }), "a malformed argument first");
	assert.deepEqual(log, []);
	assert.deepEqual(scene.items("items")[0].shapes, [{ tag: "g", attrs: {} }]);
});

test("VS6: remove takes the item out, its elements with it, in order; a key the layer does not hold changes nothing and calls nothing", () => {
	const { scene, items, log } = rooted();
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect" }] }, { tag: "circle" }]);
	scene.put("items", "b", [{ tag: "g" }]);
	const [g, circle] = items.children;
	log.length = 0;
	assert.equal(scene.remove("items", "a"), undefined);
	assert.deepEqual(log, [["remove", g.serial], ["remove", circle.serial]]);
	log.length = 0;
	assert.equal(scene.remove("items", "nothing"), undefined);
	assert.deepEqual(log, []);
	assert.deepEqual(scene.items("items").map((item) => item.key), ["b"]);
	assert.throws(() => scene.remove("items", ""), /^TypeError: remove: /);
	assert.throws(() => scene.remove("free", "b"), /^TypeError: remove: /, "a foreign layer takes no item");
});

test("VS7 steps 1 and 2: a new item's elements -- each made, its attributes set, its text written, each child made depth first and appended, then inserted", () => {
	const { scene, items, log } = rooted();
	scene.put("items", "z", [{ tag: "g" }]);
	const z = items.children[0];
	log.length = 0;
	const base = log.length;
	void base;
	const first = z.serial + 1;
	scene.put("items", "a", [{ tag: "g", attrs: { id: "a", class: "c" }, children: [{ tag: "rect", attrs: { x: 1 }, children: [{ tag: "title", text: "t" }] }, { tag: "text", text: "hi" }] }, { tag: "circle", attrs: { r: 2 } }], { before: "z" });
	const [g, rect, title, text, circle] = [first, first + 1, first + 2, first + 3, first + 4];
	assert.deepEqual(log, [
		["create", "g", g],
		["set", g, "id", "a"],
		["set", g, "class", "c"],
		["create", "rect", rect],
		["set", rect, "x", "1"],
		["create", "title", title],
		["text", title, "t"],
		["append", rect, title],
		["append", g, rect],
		["create", "text", text],
		["text", text, "hi"],
		["append", g, text],
		["insert", items.serial, g, z.serial],
		["create", "circle", circle],
		["set", circle, "r", "2"],
		["insert", items.serial, circle, z.serial],
	]);
	showsItems(scene, items);
});

test("VS7 step 4: a kept element's attributes -- each new one that differs or is new, in the new order; each old one the new lacks, in the old order", () => {
	const { scene, items, log } = rooted();
	scene.put("items", "a", [{ tag: "rect", attrs: { a: "1", b: "2", c: "3", d: "4" } }]);
	const rect = items.children[0];
	log.length = 0;
	scene.put("items", "a", [{ tag: "rect", attrs: { e: "5", c: "3", a: "9", f: "6" } }]);
	assert.deepEqual(log, [["set", rect.serial, "e", "5"], ["set", rect.serial, "a", "9"], ["set", rect.serial, "f", "6"], ["unset", rect.serial, "b"], ["unset", rect.serial, "d"]]);
	assert.equal(items.children[0], rect, "kept");
	assert.deepEqual([...rect.attributes], [["a", "9"], ["c", "3"], ["e", "5"], ["f", "6"]], "an added attribute last, as the platform orders them");
	log.length = 0;
	scene.put("items", "a", [{ tag: "rect", attrs: { e: 5, c: "3", a: "9", f: "6" } }]);
	assert.deepEqual(log, [], "5 written as \"5\" is no change");
	scene.put("items", "a", [{ tag: "rect", attrs: { x: -0 } }]);
	assert.equal(rect.attributes.get("x"), "0");
});

test("VS7 step 4: content -- text to text, text to children, children to text or none, children to children", () => {
	const { scene, items, log } = rooted();
	scene.put("items", "a", [{ tag: "text", text: "one" }]);
	const el = items.children[0];
	const s = el.serial;
	const step = (shape) => {
		log.length = 0;
		scene.put("items", "a", [shape]);
		assert.equal(items.children[0], el, "the element is kept");
		return [...log];
	};
	assert.deepEqual(step({ tag: "text", text: "two" }), [["text", s, "two"]], "text to other text");
	assert.deepEqual(step({ tag: "text", text: "two" }), [], "the same text: nothing");
	assert.deepEqual(step({ tag: "text" }), [["text", s, ""]], "text to none: \"\" written");
	assert.deepEqual(step({ tag: "text", text: "" }), [], "none to none");
	const kids = step({ tag: "text", children: [{ tag: "tspan", text: "a" }] });
	assert.deepEqual(kids, [["create", "tspan", s + 1], ["text", s + 1, "a"], ["append", s, s + 1]], "none to children: no text written");
	step({ tag: "text", children: [] });
	assert.deepEqual(step({ tag: "text", text: "back" }), [["text", s, "back"]]);
	assert.deepEqual(step({ tag: "text", children: [{ tag: "tspan" }, { tag: "tspan" }] }), [["text", s, ""], ["create", "tspan", s + 2], ["append", s, s + 2], ["create", "tspan", s + 3], ["append", s, s + 3]], "text to children: \"\" written first");
	assert.deepEqual(step({ tag: "text", text: "end" }), [["remove", s + 2], ["remove", s + 3], ["text", s, "end"]], "children to text: each removed in order, then the text");
	step({ tag: "text", children: [{ tag: "tspan" }] });
	assert.deepEqual(step({ tag: "text" }), [["remove", s + 4]], "children to none: no text written");
	showsItems(scene, items);
});

test("VS7 step 3: position by position -- same tag kept and patched, another tag made before the old one and the old removed, past the end appended, the rest removed in order", () => {
	const { scene, items, log } = rooted();
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect", attrs: { x: 1 } }, { tag: "circle" }, { tag: "path" }, { tag: "line" }] }]);
	const g = items.children[0];
	const [rect, circle, path, line] = g.children;
	log.length = 0;
	const s = line.serial;
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect", attrs: { x: 2 } }, { tag: "ellipse" }] }]);
	assert.deepEqual(log, [
		["set", rect.serial, "x", "2"],
		["create", "ellipse", s + 1],
		["insert", g.serial, s + 1, circle.serial],
		["remove", circle.serial],
		["remove", path.serial],
		["remove", line.serial],
	]);
	assert.equal(g.children[0], rect);
	log.length = 0;
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect", attrs: { x: 2 } }, { tag: "ellipse" }, { tag: "use" }, { tag: "image" }] }]);
	assert.deepEqual(log, [["create", "use", s + 2], ["append", g.serial, s + 2], ["create", "image", s + 3], ["append", g.serial, s + 3]], "past the old list's end, appended to its parent");
	showsItems(scene, items);
});

test("VS7 step 3: an item's own shapes -- a new one past the end inserted before the next item's first element, or appended to the layer when the item is last; the next item untouched", () => {
	const { scene, items, log } = rooted();
	scene.put("items", "a", [{ tag: "rect" }]);
	scene.put("items", "b", [{ tag: "circle" }, { tag: "path" }]);
	const [rect, circle, path] = items.children;
	log.length = 0;
	scene.put("items", "a", [{ tag: "rect" }, { tag: "line" }, { tag: "g" }]);
	const s = path.serial;
	assert.deepEqual(log, [["create", "line", s + 1], ["insert", items.serial, s + 1, circle.serial], ["create", "g", s + 2], ["insert", items.serial, s + 2, circle.serial]]);
	assert.equal(items.children[0], rect);
	log.length = 0;
	scene.put("items", "b", [{ tag: "circle" }, { tag: "path" }, { tag: "text" }]);
	assert.deepEqual(log, [["create", "text", s + 3], ["append", items.serial, s + 3]], "the last item's new shape appended to the layer");
	log.length = 0;
	scene.put("items", "a", [{ tag: "ellipse" }]);
	assert.deepEqual(log, [["create", "ellipse", s + 4], ["insert", items.serial, s + 4, rect.serial], ["remove", rect.serial], ["remove", s + 1], ["remove", s + 2]]);
	assert.deepEqual(scene.items("items").map((item) => item.key), ["a", "b"]);
	showsItems(scene, items);
});

test("VS7 step 5: an item moved is brought to its new shapes first, then its elements inserted, in order, before the named item's first element, or appended", () => {
	const { scene, items, log } = rooted();
	scene.put("items", "a", [{ tag: "rect" }]);
	scene.put("items", "b", [{ tag: "circle" }]);
	scene.put("items", "c", [{ tag: "path" }]);
	const [rect, circle] = items.children;
	log.length = 0;
	scene.put("items", "c", [{ tag: "path", attrs: { d: "M1" } }, { tag: "line" }], { before: "b" });
	const path = items.children.find((child) => child.tag === "path");
	const s = path.serial;
	assert.deepEqual(log, [["set", s, "d", "M1"], ["create", "line", s + 1], ["append", items.serial, s + 1], ["insert", items.serial, s, circle.serial], ["insert", items.serial, s + 1, circle.serial]]);
	log.length = 0;
	scene.put("items", "a", [{ tag: "rect" }], { before: null });
	assert.deepEqual(log, [["append", items.serial, rect.serial]]);
	assert.deepEqual(scene.items("items").map((item) => item.key), ["c", "b", "a"]);
	showsItems(scene, items);
});

test("I8: a description put again to its own item, with no place, calls nothing; with no place it keeps its place", () => {
	const { scene, log } = rooted();
	scene.put("items", "a", [{ tag: "g", attrs: { id: "a", n: 1 }, children: [{ tag: "text", text: "t", attrs: { x: -0 } }, { tag: "rect", children: [] }] }]);
	scene.put("items", "b", [{ tag: "circle" }]);
	log.length = 0;
	for (const item of scene.items("items")) scene.put("items", item.key, item.shapes);
	assert.deepEqual(log, []);
	assert.deepEqual(scene.items("items").map((item) => item.key), ["a", "b"]);
});

/** Runs a generated sequence on a rooted scene, a model of VS7 and a scene with no root together, checking all three after every call. */
function runSequence(seed, steps) {
	const rnd = seededRandom(seed);
	const layers = [{ name: "items" }, { name: "other", foreign: true }, { name: "more", attrs: { class: "m" } }];
	const { scene, root, log, document } = (() => {
		const platform = fakeRoot();
		return { ...platform, scene: openScene({ root: platform.root, layers }).scene };
	})();
	const headless = openScene({ layers }).scene;
	const model = vs7Model(layers.map((layer, index) => ({ ...layer, serial: root.children[index].serial })), document.serial);
	const { pick } = randomTools(rnd);
	let calls = 0;
	for (let n = 0; n < steps; n++) {
		const layer = pick(["items", "items", "more"]);
		const keys = scene.items(layer).map((item) => item.key);
		const op = randomOperation(rnd, keys);
		log.length = 0;
		let expected;
		if (op.kind === "remove") {
			scene.remove(layer, op.key);
			headless.remove(layer, op.key);
			expected = model.remove(layer, op.key);
		} else {
			scene.put(layer, op.key, op.shapes, op.place);
			headless.put(layer, op.key, op.shapes, op.place);
			expected = model.put(layer, op.key, op.shapes, op.place);
		}
		calls += log.length;
		assert.deepEqual(log, expected, `seed ${seed}, step ${n}: ${JSON.stringify(op)}`);
		for (const name of ["items", "more"]) {
			const element = root.children[layers.findIndex((l) => l.name === name)];
			assert.deepEqual(element.children.map(treeOf), model.tree(name), `seed ${seed}, step ${n}: the platform's tree is the model's, attributes in order`);
			showsItems(scene, element, name);
			assert.deepEqual(headless.items(name), scene.items(name), `seed ${seed}, step ${n}: no root gives equal items`);
			assert.deepEqual(scene.items(name).map((item) => item.key), model.keys(name));
		}
	}
	return calls;
}

test("I4, I6: over generated sequences of puts, moves and removals, every call makes exactly VS7's calls against a model written apart, the elements equal the descriptions, and a scene with no root gives equal items", () => {
	let calls = 0;
	for (let seed = 1; seed <= 60; seed++) calls += runSequence(seed, 60);
	assert.ok(calls > 20000, `${calls} platform calls compared`);
});

test("I8, VS8: putting each layer's items, in order, into a fresh scene opened with the same layers gives equal items, rooted or not", () => {
	const { scene } = rooted();
	const rnd = seededRandom(7);
	for (let n = 0; n < 80; n++) {
		const op = randomOperation(rnd, scene.items("items").map((item) => item.key));
		if (op.kind === "put") scene.put("items", op.key, op.shapes, op.place);
		else scene.remove("items", op.key);
	}
	for (const fresh of [rooted().scene, openScene({ layers: LAYERS }).scene]) {
		for (const item of scene.items("items")) fresh.put("items", item.key, item.shapes);
		assert.deepEqual(fresh.items("items"), scene.items("items"));
		assert.deepEqual(fresh.layers, scene.layers);
	}
});

test("VS7: with no root, put and remove change the descriptions alone, as they would with one", () => {
	const headless = openScene({ layers: LAYERS }).scene;
	const { scene } = rooted();
	for (const s of [headless, scene]) {
		s.put("items", "a", [{ tag: "g", attrs: { n: 1 } }]);
		s.put("items", "b", [{ tag: "rect" }], { before: "a" });
		s.put("items", "a", [{ tag: "circle" }], { before: "b" });
		s.remove("items", "b");
		s.put("back", "z", [{ tag: "text", text: "t" }]);
	}
	assert.deepEqual(headless.items("items"), scene.items("items"));
	assert.deepEqual(headless.items("back"), scene.items("back"));
	assert.equal(headless.itemOf({}), null);
});

test("I3: the scene touches nothing of the platform outside VS1 -- an opening, puts that create, patch, move and replace, a removal, both conversions and close log exactly VS1's reads, once each, and VS7's calls in order", () => {
	const { root, log } = recordingPlatform();
	const opened = openScene({ root, layers: [{ name: "back", attrs: { id: "back" } }, { name: "items" }, { name: "free", foreign: true }] });
	assert.equal(opened.ok, true);
	const { scene } = opened;
	scene.put("items", "a", [{ tag: "g", attrs: { id: "a" }, children: [{ tag: "rect", attrs: { x: 1 } }, { tag: "text", text: "hi" }] }]);
	scene.put("items", "b", [{ tag: "circle", attrs: { r: 2 } }]);
	scene.put("items", "a", [{ tag: "g", attrs: { id: "a", class: "on" }, children: [{ tag: "rect" }, { tag: "path", attrs: { d: "M0 0" } }] }]);
	scene.put("items", "b", [{ tag: "circle", attrs: { r: 2 } }], { before: "a" });
	scene.remove("items", "a");
	assert.deepEqual(scene.toDrawing({ x: 12, y: 24 }), { x: 1, y: 2 });
	assert.deepEqual(scene.toScreen({ x: 1, y: 2 }), { x: 12, y: 24 });
	scene.close();
	const method = (label, name, args) => [`${label} get ${name}`, `${label}.${name}(${args})`];
	assert.deepEqual(log, [
		// the opening: VS1's reads of the root and its document, once each, then each layer made, its attributes set, and appended
		"root get ownerDocument",
		"document get createElementNS",
		"root get appendChild",
		"root get getScreenCTM",
		"document.createElementNS(\"svg\", \"g\")",
		"  -> e1",
		...method("e1", "setAttribute", "\"id\", \"back\""),
		"root.appendChild(e1)",
		"document.createElementNS(\"svg\", \"g\")",
		"  -> e2",
		"root.appendChild(e2)",
		"document.createElementNS(\"svg\", \"g\")",
		"  -> e3",
		"root.appendChild(e3)",
		// a put that creates
		"document.createElementNS(\"svg\", \"g\")",
		"  -> e4",
		...method("e4", "setAttribute", "\"id\", \"a\""),
		"document.createElementNS(\"svg\", \"rect\")",
		"  -> e5",
		...method("e5", "setAttribute", "\"x\", \"1\""),
		...method("e4", "appendChild", "e5"),
		"document.createElementNS(\"svg\", \"text\")",
		"  -> e6",
		"e6 set textContent \"hi\"",
		...method("e4", "appendChild", "e6"),
		...method("e2", "appendChild", "e4"),
		"document.createElementNS(\"svg\", \"circle\")",
		"  -> e7",
		...method("e7", "setAttribute", "\"r\", \"2\""),
		...method("e2", "appendChild", "e7"),
		// a put that patches and replaces
		...method("e4", "setAttribute", "\"class\", \"on\""),
		...method("e5", "removeAttribute", "\"x\""),
		"document.createElementNS(\"svg\", \"path\")",
		"  -> e8",
		...method("e8", "setAttribute", "\"d\", \"M0 0\""),
		...method("e4", "insertBefore", "e8, e6"),
		...method("e6", "remove", ""),
		// a put that moves
		...method("e2", "insertBefore", "e7, e4"),
		// a removal
		...method("e4", "remove", ""),
		// toDrawing: the root's screen transform, its inverse, and a to f in order
		"root.getScreenCTM()",
		"  -> t1",
		"t1 get inverse",
		"t1.inverse()",
		"  -> t2",
		...["a", "b", "c", "d", "e", "f"].map((m) => `t2 get ${m}`),
		// toScreen
		"root.getScreenCTM()",
		"  -> t3",
		...["a", "b", "c", "d", "e", "f"].map((m) => `t3 get ${m}`),
		// close: every layer element removed, in reverse
		...method("e3", "remove", ""),
		...method("e2", "remove", ""),
		...method("e1", "remove", ""),
	]);
});
