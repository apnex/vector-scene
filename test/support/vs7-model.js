// vs7-model - VS7 written apart from the component (CONTRACT.md I4): given the layers' element serials and
// what each put and removal is asked, the platform calls VS7 says it makes, in the fake platform's log form,
// and the elements' tree it leaves, attributes in the order a platform keeps them. It shares no code with
// src/: it holds plain shapes as the tests generate them, and its own node per element.

/** The entries an attribute record yields, each value written as String writes a number. */
const attributesOf = (shape) => Object.entries(shape.attrs ?? {}).map(([name, value]) => [name, String(value)]);
const textOf = (shape) => shape.text ?? "";
const childrenOf = (shape) => shape.children ?? [];

/**
 * A model scene over layers [{ name, serial, foreign }] whose element serials the fake document gave, its
 * next element serial following `serial`.
 */
export function vs7Model(layers, serial) {
	let next = serial;
	const byName = new Map(layers.map((layer) => [layer.name, { serial: layer.serial, items: [] }]));

	/** A new element for a shape: made, its attributes set, its text written, each child made and appended. */
	function build(shape, calls) {
		const node = { serial: ++next, tag: shape.tag, attrs: [], text: "", kids: [] };
		calls.push(["create", shape.tag, node.serial]);
		for (const [name, value] of attributesOf(shape)) {
			calls.push(["set", node.serial, name, value]);
			node.attrs.push([name, value]);
		}
		if (textOf(shape) !== "") {
			calls.push(["text", node.serial, textOf(shape)]);
			node.text = textOf(shape);
		}
		for (const child of childrenOf(shape)) {
			const kid = build(child, calls);
			calls.push(["append", node.serial, kid.serial]);
			node.kids.push(kid);
		}
		return node;
	}

	/** An attribute set on an element the platform holds: in place when it has one of that name, last otherwise. */
	function setOn(node, name, value) {
		const at = node.attrs.findIndex(([held]) => held === name);
		if (at < 0) node.attrs.push([name, value]);
		else node.attrs[at] = [name, value];
	}

	/** An element kept: its attributes, then its content by VS7 step 4's four cases. */
	function patch(node, was, now, calls) {
		const before = new Map(attributesOf(was));
		const after = new Map(attributesOf(now));
		for (const [name, value] of after) {
			if (before.get(name) === value) continue;
			calls.push(["set", node.serial, name, value]);
			setOn(node, name, value);
		}
		for (const name of before.keys()) {
			if (after.has(name)) continue;
			calls.push(["unset", node.serial, name]);
			node.attrs = node.attrs.filter(([held]) => held !== name);
		}
		const oldKids = childrenOf(was), newKids = childrenOf(now);
		if (oldKids.length === 0 && newKids.length === 0) {
			if (textOf(was) !== textOf(now)) {
				calls.push(["text", node.serial, textOf(now)]);
				node.text = textOf(now);
			}
			return;
		}
		if (oldKids.length === 0) {
			if (textOf(was) !== "") calls.push(["text", node.serial, ""]);
			node.text = "";
			node.kids = newKids.map((child) => {
				const kid = build(child, calls);
				calls.push(["append", node.serial, kid.serial]);
				return kid;
			});
			return;
		}
		if (newKids.length === 0) {
			for (const kid of node.kids) calls.push(["remove", kid.serial]);
			node.kids = [];
			if (textOf(now) !== "") calls.push(["text", node.serial, textOf(now)]);
			node.text = textOf(now);
			return;
		}
		node.kids = lists(node.serial, node.kids, oldKids, newKids, calls, (kid) => calls.push(["append", node.serial, kid.serial]));
	}

	/** Two lists compared position by position, as VS7 step 3 says; `pastEnd` places a new element past the old list's end. */
	function lists(parent, nodes, was, now, calls, pastEnd) {
		const out = [];
		for (let index = 0; index < Math.max(was.length, now.length); index++) {
			const oldShape = was[index], newShape = now[index], node = nodes[index];
			if (oldShape && newShape && oldShape.tag === newShape.tag) {
				patch(node, oldShape, newShape, calls);
				out.push(node);
				continue;
			}
			if (newShape) {
				const made = build(newShape, calls);
				if (node) calls.push(["insert", parent, made.serial, node.serial]);
				else pastEnd(made);
				out.push(made);
			}
			if (node) calls.push(["remove", node.serial]);
		}
		return out;
	}

	const placeIn = (items, item, before) => {
		if (before === null || before === undefined) items.push(item);
		else items.splice(items.findIndex((other) => other.key === before), 0, item);
	};

	return {
		/** The calls a put makes; `place` as the scene takes it, or undefined. */
		put(layerName, key, shapes, place) {
			const layer = byName.get(layerName);
			const calls = [];
			const moves = place !== undefined && Object.hasOwn(place, "before");
			const before = moves ? place.before : null;
			const reference = before === null ? null : layer.items.find((item) => item.key === before).nodes[0].serial;
			const placeAt = (node) => calls.push(reference === null ? ["append", layer.serial, node.serial] : ["insert", layer.serial, node.serial, reference]);
			const at = layer.items.findIndex((item) => item.key === key);
			if (at < 0) {
				const item = { key, shapes, nodes: [] };
				for (const shape of shapes) {
					const node = build(shape, calls);
					placeAt(node);
					item.nodes.push(node);
				}
				placeIn(layer.items, item, before);
				return calls;
			}
			const item = layer.items[at];
			const following = layer.items[at + 1];
			item.nodes = lists(layer.serial, item.nodes, item.shapes, shapes, calls, (node) =>
				calls.push(following === undefined ? ["append", layer.serial, node.serial] : ["insert", layer.serial, node.serial, following.nodes[0].serial]),
			);
			if (moves) for (const node of item.nodes) placeAt(node);
			item.shapes = shapes;
			if (moves) {
				layer.items.splice(at, 1);
				placeIn(layer.items, item, before);
			}
			return calls;
		},
		/** The calls a removal makes. */
		remove(layerName, key) {
			const layer = byName.get(layerName);
			const at = layer.items.findIndex((item) => item.key === key);
			if (at < 0) return [];
			const [item] = layer.items.splice(at, 1);
			return item.nodes.map((node) => ["remove", node.serial]);
		},
		/** The elements' tree the model holds under a layer, as fake-dom's treeOf writes one. */
		tree(layerName) {
			const tree = (node) => ({ tag: node.tag, attrs: node.attrs.map(([name, value]) => [name, value]), text: node.kids.length ? "" : node.text, children: node.kids.map(tree) });
			return byName.get(layerName).items.flatMap((item) => item.nodes.map(tree));
		},
		keys: (layerName) => byName.get(layerName).items.map((item) => item.key),
	};
}
