// fake-dom - a platform of plain objects with a browser's semantics where the scene could tell (CONTRACT.md
// VS1, VS7): appendChild and insertBefore detaching a child they move, insertBefore refusing a reference
// that is no child, setAttribute keeping an attribute's place and adding a new one last, textContent
// replacing the children, remove detaching. Every element carries a serial, and every call the scene makes
// is written into the document's log, so a test can hold the scene's calls, in order, against a model. A test
// may set the document's hooks.before and hooks.after, each called with a call's log entry before and after
// its effect, to make the platform throw or to call the scene from inside a platform method.

const SVG = "http://www.w3.org/2000/svg";

/** A document whose createElementNS makes fake elements; `options.ctm` is what each root's getScreenCTM answers. */
export function fakeDocument() {
	const log = [];
	const hooks = {};
	let serial = 0;
	const document = {
		log,
		hooks,
		get serial() {
			return serial;
		},
		createElementNS(namespace, tag) {
			if (namespace !== SVG) throw new Error(`fake-dom: createElementNS given the namespace ${namespace}`);
			const entry = ["create", tag, serial + 1];
			log.push(entry);
			hooks.before?.(entry);
			const element = fakeElement(tag, ++serial, log, hooks);
			hooks.after?.(entry, element);
			return element;
		},
	};
	return document;
}

/** A fake element: its tag, ordered attributes, children, parent and text, its calls logged and hooked. */
export function fakeElement(tag, serial, log, hooks = {}) {
	const called = (entry, effect) => {
		log.push(entry);
		hooks.before?.(entry);
		const answer = effect();
		hooks.after?.(entry);
		return answer;
	};
	const element = {
		tag,
		serial,
		attributes: new Map(),
		children: [],
		parent: null,
		text: "",
		setAttribute(name, value) {
			called(["set", element.serial, name, value], () => {
				if (typeof value !== "string") throw new Error("fake-dom: setAttribute given no string");
				element.attributes.set(name, value);
			});
		},
		removeAttribute(name) {
			called(["unset", element.serial, name], () => element.attributes.delete(name));
		},
		appendChild(child) {
			return called(["append", element.serial, child.serial], () => {
				detach(child);
				element.children.push(child);
				child.parent = element;
				element.text = "";
				return child;
			});
		},
		insertBefore(child, reference) {
			return called(["insert", element.serial, child.serial, reference === null ? null : reference.serial], () => {
				if (reference !== null && reference.parent !== element) throw new Error("fake-dom: insertBefore's reference is no child of this element");
				detach(child);
				if (reference === null) element.children.push(child);
				else element.children.splice(element.children.indexOf(reference), 0, child);
				child.parent = element;
				element.text = "";
				return child;
			});
		},
		remove() {
			called(["remove", element.serial], () => detach(element));
		},
		set textContent(text) {
			called(["text", element.serial, text], () => {
				for (const child of element.children) child.parent = null;
				element.children = [];
				element.text = String(text ?? "");
			});
		},
	};
	return element;
}

function detach(node) {
	if (node.parent === null) return;
	node.parent.children.splice(node.parent.children.indexOf(node), 1);
	node.parent = null;
}

/**
 * A fake root: an svg element of a fake document, with the platform members the scene reads. With `hits`,
 * the document also holds elementsFromPoint, which logs ["hits", x, y] and answers `hits(x, y)`; without it,
 * the document holds only createElementNS, as 0.1.0's slice did.
 */
export function fakeRoot(ctm = { a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }, hits = null) {
	const document = fakeDocument();
	if (hits !== null) {
		document.elementsFromPoint = (x, y) => {
			document.log.push(["hits", x, y]);
			return hits(x, y);
		};
	}
	const root = fakeElement("svg", 0, document.log, document.hooks);
	root.ownerDocument = document;
	root.ctm = ctm;
	root.getScreenCTM = function () {
		document.log.push(["getScreenCTM"]);
		return root.ctm === null ? null : matrix(root.ctm);
	};
	return { root, document, log: document.log, hooks: document.hooks };
}

/** A transform of the six numbers, with an inverse computed as a browser's DOMMatrix computes one for a two-dimensional matrix. */
export function matrix({ a, b, c, d, e, f }) {
	return {
		a,
		b,
		c,
		d,
		e,
		f,
		inverse() {
			const det = a * d - b * c;
			return matrix({ a: d / det, b: -b / det, c: -c / det, d: a / det, e: (c * f - d * e) / det, f: (b * e - a * f) / det });
		},
	};
}

/** An element's subtree as data: tag, attributes in order, text, children. */
export const treeOf = (element) => ({ tag: element.tag, attrs: [...element.attributes], text: element.children.length ? "" : element.text, children: element.children.map(treeOf) });

/** A description as the same data, for comparing a layer's elements with what items answers. */
export const treeOfShape = (shape) => ({ tag: shape.tag, attrs: Object.entries(shape.attrs), text: shape.text ?? "", children: (shape.children ?? []).map(treeOfShape) });

/** Every element beneath an element, in document order. */
export const elementsBeneath = (element, out = []) => {
	for (const child of element.children) {
		out.push(child);
		elementsBeneath(child, out);
	}
	return out;
};
