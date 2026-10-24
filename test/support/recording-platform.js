// recording-platform - a root, its document, the elements it makes and the transforms it answers, each a
// Proxy that writes every trap it runs into one log, and each method writing its call there too (CONTRACT.md
// I3): so a test holds exactly what the scene reads of the platform and every call it makes, in order. A
// value is named in the log by a label kept in a WeakMap, looked up by identity, so the log itself reads
// nothing of what it names.

const SVG = "http://www.w3.org/2000/svg";
const TRAPS = ["getPrototypeOf", "setPrototypeOf", "isExtensible", "preventExtensions", "getOwnPropertyDescriptor", "defineProperty", "has", "get", "set", "deleteProperty", "ownKeys", "apply", "construct"];

/**
 * A recording platform: `ctm` is the screen transform's six numbers. With `hits`, the document holds
 * elementsFromPoint, which logs its call -- naming its receiver, `document` when it is the document -- and
 * answers a recorded array of what `hits(x, y, elements)` answers, `elements` the elements made so far, in
 * the order made; without it, the document holds no such member, as a fake document of 0.1.0's slice.
 */
export function recordingPlatform({ ctm = { a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }, hits = null } = {}) {
	const log = [];
	const labels = new WeakMap();
	const nameOf = (value) => (typeof value === "object" && value !== null && labels.has(value) ? labels.get(value) : JSON.stringify(value));
	let elements = 0, transforms = 0, answers = 0;
	const made = [];

	/** A Proxy of `target` labelled `label`, logging each trap as `<label> <trap>[ <key>]`. */
	const recorded = (target, label) => {
		const handler = {};
		for (const trap of TRAPS) {
			handler[trap] = (t, ...args) => {
				const key = ["getOwnPropertyDescriptor", "defineProperty", "has", "get", "set", "deleteProperty"].includes(trap) ? ` ${String(args[0])}` : "";
				const value = trap === "set" ? ` ${nameOf(args[1])}` : "";
				log.push(`${label} ${trap}${key}${value}`);
				// a set lands on the target itself, so the receiver's own descriptor traps do not run as its consequence
				if (trap === "set") return Reflect.set(t, args[0], args[1]);
				return Reflect[trap](t, ...args);
			};
		}
		const proxy = new Proxy(target, handler);
		labels.set(proxy, label);
		return proxy;
	};

	const call = (label, method, args) => log.push(`${label}.${method}(${args.map(nameOf).join(", ")})`);

	const makeElement = (tag) => {
		const label = `e${++elements}`;
		const target = {
			setAttribute(name, value) {
				call(label, "setAttribute", [name, value]);
			},
			removeAttribute(name) {
				call(label, "removeAttribute", [name]);
			},
			appendChild(child) {
				call(label, "appendChild", [child]);
				return child;
			},
			insertBefore(child, before) {
				call(label, "insertBefore", [child, before]);
				return child;
			},
			remove() {
				call(label, "remove", []);
			},
			textContent: "",
		};
		void tag;
		const element = recorded(target, label);
		made.push(element);
		return element;
	};

	const makeTransform = ({ a, b, c, d, e, f }) => {
		const label = `t${++transforms}`;
		const target = {
			a,
			b,
			c,
			d,
			e,
			f,
			inverse() {
				const det = a * d - b * c;
				const inverse = makeTransform({ a: d / det, b: -b / det, c: -c / det, d: a / det, e: (c * f - d * e) / det, f: (b * e - a * f) / det });
				call(label, "inverse", []);
				log.push(`  -> ${nameOf(inverse)}`);
				return inverse;
			},
		};
		return recorded(target, label);
	};

	const documentTarget = {
		createElementNS(namespace, tag) {
			const element = makeElement(tag);
			call("document", "createElementNS", [namespace === SVG ? "svg" : namespace, tag]);
			log.push(`  -> ${nameOf(element)}`);
			return element;
		},
	};
	if (hits !== null) {
		documentTarget.elementsFromPoint = function (...args) {
			const answer = recorded(hits(args[0], args[1], [...made]), `a${++answers}`);
			call(this === document ? "document" : nameOf(this), "elementsFromPoint", args);
			log.push(`  -> ${nameOf(answer)}`);
			return answer;
		};
	}
	const document = recorded(documentTarget, "document");

	const root = recorded({
		ownerDocument: document,
		appendChild(layer) {
			call("root", "appendChild", [layer]);
			return layer;
		},
		getScreenCTM() {
			const transform = makeTransform(ctm);
			call("root", "getScreenCTM", []);
			log.push(`  -> ${nameOf(transform)}`);
			return transform;
		},
	}, "root");

	return { root, document, log, labels };
}
