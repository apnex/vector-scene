// shape-at-element - VS9 (I7): the item and path a platform element belongs to, or null, read by identity
// alone, so it runs no application code; answering every element made, at every depth, after patches and
// moves, and nothing else.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openScene } from "@apnex/vector-scene";
import { elementsBeneath, fakeElement, fakeRoot } from "../support/fake-dom.js";
import { isFrozenToDepth } from "../support/frozen.js";
import { randomOperation, seededRandom } from "../support/generate.js";

const LAYERS = [{ name: "back" }, { name: "items" }, { name: "free", foreign: true }];

function rooted() {
	const platform = fakeRoot();
	const { scene } = openScene({ root: platform.root, layers: LAYERS });
	const [back, items, free] = platform.root.children;
	return { ...platform, scene, back, items, free };
}

/** Every element a shape describes, with its path, walked from the item's own shapes down, beside the elements the scene made. */
function expectedPaths(elements, shapes, layer, key, path = []) {
	const out = [];
	shapes.forEach((shape, index) => {
		const element = elements[index];
		out.push([element, { layer, key, path: [...path, index] }]);
		out.push(...expectedPaths(element.children, shape.children ?? [], layer, key, [...path, index]));
	});
	return out;
}

/** Every element under a scene layer against itemOf, each item's elements found by walking its descriptions in order. */
function answersEveryElement(scene, layerElement, layer) {
	let offset = 0;
	let count = 0;
	for (const item of scene.items(layer)) {
		const own = layerElement.children.slice(offset, offset + item.shapes.length);
		offset += item.shapes.length;
		for (const [element, expected] of expectedPaths(own, item.shapes, layer, item.key)) {
			assert.deepEqual(scene.itemOf(element), expected);
			count++;
		}
	}
	assert.equal(offset, layerElement.children.length);
	return count;
}

test("VS9: itemOf answers an element at every depth with its layer, key and path from the item's own shapes down, a fresh frozen record", () => {
	const { scene, items, back } = rooted();
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect" }, { tag: "g", children: [{ tag: "text", text: "t" }] }] }, { tag: "circle" }]);
	scene.put("back", "a", [{ tag: "path" }]);
	const [g, circle] = items.children;
	const [rect, inner] = g.children;
	const [text] = inner.children;
	assert.deepEqual(scene.itemOf(g), { layer: "items", key: "a", path: [0] });
	assert.deepEqual(scene.itemOf(rect), { layer: "items", key: "a", path: [0, 0] });
	assert.deepEqual(scene.itemOf(inner), { layer: "items", key: "a", path: [0, 1] });
	assert.deepEqual(scene.itemOf(text), { layer: "items", key: "a", path: [0, 1, 0] });
	assert.deepEqual(scene.itemOf(circle), { layer: "items", key: "a", path: [1] });
	assert.deepEqual(scene.itemOf(back.children[0]), { layer: "back", key: "a", path: [0] }, "the same key in another layer is another item");
	const answer = scene.itemOf(text);
	assert.ok(isFrozenToDepth(answer));
	assert.deepEqual(Object.keys(answer), ["layer", "key", "path"]);
	assert.notEqual(scene.itemOf(text), answer, "made afresh by each call");
	assert.notEqual(scene.itemOf(text).path, answer.path);
});

test("VS9: shapes nested 32 deep -- the element at depth 32 answers a path of 32 indices", () => {
	const { scene, items } = rooted();
	const nest = (depth) => (depth === 32 ? { tag: "rect" } : { tag: "g", children: [{ tag: "title", text: "x" }, nest(depth + 1)] });
	scene.put("items", "deep", [nest(1)]);
	let element = items.children[0];
	for (let depth = 2; depth <= 32; depth++) element = element.children[1];
	assert.equal(element.tag, "rect");
	assert.deepEqual(scene.itemOf(element).path, [0, ...Array(31).fill(1)]);
});

test("I7: itemOf answers every element made after patches, moves, replacements and removals, over generated sequences, and null for every element the scene made and removed, at any depth", () => {
	const { scene, items, back } = rooted();
	const rnd = seededRandom(11);
	const ever = new Set();
	let checked = 0, gone = 0;
	for (let n = 0; n < 300; n++) {
		const layer = n % 3 === 0 ? "back" : "items";
		const op = randomOperation(rnd, scene.items(layer).map((item) => item.key));
		if (op.kind === "put") scene.put(layer, op.key, op.shapes, op.place);
		else scene.remove(layer, op.key);
		checked += answersEveryElement(scene, items, "items") + answersEveryElement(scene, back, "back");
		const present = new Set([...elementsBeneath(items), ...elementsBeneath(back)]);
		for (const element of present) ever.add(element);
		for (const element of ever) {
			if (present.has(element)) continue;
			assert.equal(scene.itemOf(element), null, `step ${n}: an element removed, ${element.tag} ${element.serial}, still answers`);
			gone++;
		}
	}
	assert.ok(checked > 5000, `${checked} elements answered`);
	assert.ok(gone > 5000, `${gone} answers for removed elements`);
});

test("I7: an element removed answers null with every element beneath it -- by remove, by a replacement of another tag, by children giving way to text", () => {
	const { scene, items } = rooted();
	const nested = [{ tag: "g", children: [{ tag: "g", children: [{ tag: "rect" }, { tag: "g", children: [{ tag: "circle" }] }] }] }];
	for (const takeAway of [() => scene.remove("items", "a"), () => scene.put("items", "a", [{ tag: "path" }]), () => scene.put("items", "a", [{ tag: "g", text: "text now" }])]) {
		scene.remove("items", "a");
		scene.put("items", "a", nested);
		const top = items.children[0];
		const beneath = elementsBeneath(top);
		assert.equal(beneath.length, 4);
		assert.deepEqual(beneath.map((element) => scene.itemOf(element).path), [[0, 0], [0, 0, 0], [0, 0, 1], [0, 0, 1, 0]]);
		takeAway();
		for (const element of beneath) assert.equal(scene.itemOf(element), null, `${element.tag} ${element.serial}`);
	}
});

test("I7: an element keeps its answer while it is kept, and answers null once the scene removed it -- by remove, by a replacement, by a shorter list, by text in place of children", () => {
	const { scene, items } = rooted();
	scene.put("items", "a", [{ tag: "g", children: [{ tag: "rect" }, { tag: "circle" }, { tag: "path" }] }, { tag: "line" }]);
	scene.put("items", "b", [{ tag: "text", text: "b" }]);
	const [g, line, text] = items.children;
	const [rect, circle, path] = g.children;
	scene.put("items", "a", [{ tag: "g", attrs: { moved: 1 }, children: [{ tag: "rect", attrs: { x: 1 } }, { tag: "ellipse" }] }, { tag: "line" }], { before: null });
	assert.deepEqual(scene.itemOf(g), { layer: "items", key: "a", path: [0] }, "kept across a patch and a move");
	assert.deepEqual(scene.itemOf(rect), { layer: "items", key: "a", path: [0, 0] });
	assert.deepEqual(scene.itemOf(line), { layer: "items", key: "a", path: [1] });
	assert.equal(scene.itemOf(circle), null, "replaced by another tag");
	assert.equal(scene.itemOf(path), null, "past the shorter list's end");
	assert.deepEqual(scene.itemOf(g.children[1]), { layer: "items", key: "a", path: [0, 1] }, "the element made in its place");
	scene.put("items", "a", [{ tag: "g", text: "now text" }, { tag: "line" }]);
	assert.equal(scene.itemOf(rect), null, "children to text removed each child");
	assert.deepEqual(scene.itemOf(g), { layer: "items", key: "a", path: [0] });
	scene.remove("items", "a");
	assert.equal(scene.itemOf(g), null);
	assert.equal(scene.itemOf(line), null);
	assert.deepEqual(scene.itemOf(text), { layer: "items", key: "b", path: [0] });
	scene.put("items", "a", [{ tag: "g" }]);
	assert.equal(scene.itemOf(g), null, "an item put again under a removed key makes new elements; the old one stays forgotten");
});

test("I7: null for a layer's element, a foreign layer's content, the root, an element the scene did not make, a primitive, and a Proxy whose traps never run", () => {
	const { scene, root, items, back, free, log } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	const drawn = fakeElement("canvas", 77, log);
	free.appendChild(drawn);
	const made = items.children[0];
	const trapsThrow = new Proxy({}, new Proxy({}, { get: () => () => assert.fail("a trap ran") }));
	const ofMade = new Proxy(made, new Proxy({}, { get: () => () => assert.fail("a trap of an element's Proxy ran") }));
	const others = [items, back, free, drawn, root, root.ownerDocument, fakeElement("g", 1, []), {}, [], () => 0, Object.freeze({}), 0, -0, 1, "", "a", true, false, null, undefined, Symbol("s"), 1n, NaN, trapsThrow, ofMade, Object.create(made)];
	for (const value of others) assert.equal(scene.itemOf(value), null, typeof value);
	assert.equal(scene.itemOf(), null, "no argument");
	assert.deepEqual(scene.itemOf(made, new Proxy({}, new Proxy({}, { get: () => () => assert.fail("an argument beyond its form was read") }))), { layer: "items", key: "a", path: [0] }, "an argument beyond its form is not read");
	assert.deepEqual(scene.itemOf(made), { layer: "items", key: "a", path: [0] });
});

test("VS9: with no root, itemOf answers null for every value", () => {
	const { scene } = openScene({ layers: LAYERS });
	scene.put("items", "a", [{ tag: "g" }]);
	for (const value of [{}, null, 5, fakeElement("g", 1, [])]) assert.equal(scene.itemOf(value), null);
});

test("I7: itemOf throws once the scene is closed or failed, after its value is judged by typeof alone", () => {
	const { scene, items, hooks } = rooted();
	scene.put("items", "a", [{ tag: "g" }]);
	const made = items.children[0];
	hooks.before = (entry) => {
		if (entry[0] === "set") throw new Error("the platform throws");
	};
	assert.throws(() => scene.put("items", "a", [{ tag: "g", attrs: { x: 1 } }]), /the platform throws/);
	for (const value of [made, {}, 5, null]) assert.throws(() => scene.itemOf(value), (e) => e.constructor === Error && e.message.startsWith("itemOf: "), "failed");
	scene.close();
	for (const value of [made, {}, 5, null]) assert.throws(() => scene.itemOf(value), (e) => e.constructor === Error && e.message.startsWith("itemOf: "), "closed");
	const elements = elementsBeneath(items);
	assert.ok(elements.length >= 0);
});
