// i10-page - the page I10 drives (CONTRACT.md I10): a scene opened on an SVG root scaled, letterboxed and
// offset in its page, after the ground the application drew; generated puts, patches, moves and removals
// checked against the elements Chrome holds after every call; a transition run on an element kept across a
// sibling item's insertion; the target of each trusted press recorded with what itemOf answers for it; and
// the conversions held to DOMPoint's matrixTransform over the root's screen transform.
import { openScene } from "@apnex/vector-scene";

import { randomOperation, randomTools, seededRandom } from "../support/generate.js";

const SVG = "http://www.w3.org/2000/svg";
const root = document.getElementById("root");
const found = root.innerHTML;
const LAYERS = [{ name: "back", attrs: { id: "back" } }, { name: "items", attrs: { id: "items", class: "items" } }, { name: "top" }, { name: "free", foreign: true, attrs: { id: "free" } }];
const SCENE_LAYERS = ["back", "items", "top"];
const page = (globalThis.page = { found, refused: null, scene: null, presses: [], ready: false });

const opened = openScene({ root, layers: LAYERS });
if (opened.ok) page.scene = opened.scene;
else page.refused = opened.problems;
const scene = page.scene;

/** The layer elements the scene appended after the ground, each its id, namespace and attributes. */
page.appended = () => [...root.children].map((child) => ({ local: child.localName, svg: child.namespaceURI === SVG, attrs: [...child.attributes].map((a) => [a.name, a.value]) }));

/** One element against its description, as I4 compares them; an element `made` this call holds its attributes in description order. */
function compare(element, shape, made, where, out) {
	if (element.namespaceURI !== SVG || element.localName !== shape.tag) out.push(`${where}: ${element.namespaceURI} ${element.localName} against ${shape.tag}`);
	const attrs = [...element.attributes].map((a) => [a.name, a.value]);
	const wanted = Object.entries(shape.attrs);
	const asMap = (list) => JSON.stringify([...list].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
	if (asMap(attrs) !== asMap(wanted)) out.push(`${where}: attributes ${JSON.stringify(attrs)} against ${JSON.stringify(wanted)}`);
	if (made.has(element) && JSON.stringify(attrs) !== JSON.stringify(wanted)) out.push(`${where}: an element made holds ${JSON.stringify(attrs)}, not in description order ${JSON.stringify(wanted)}`);
	const kids = shape.children ?? [];
	if (kids.length > 0) {
		if (element.childNodes.length !== kids.length || element.children.length !== kids.length) out.push(`${where}: ${element.childNodes.length} child nodes against ${kids.length} children`);
		kids.forEach((kid, i) => element.children[i] && compare(element.children[i], kid, made, `${where}/${i}`, out));
	} else if ((shape.text ?? "") === "") {
		if (element.childNodes.length !== 0) out.push(`${where}: ${element.childNodes.length} child nodes where none is described`);
	} else if (element.childNodes.length !== 1 || element.firstChild.nodeType !== Node.TEXT_NODE || element.firstChild.data !== shape.text) out.push(`${where}: text ${JSON.stringify(element.textContent)} against ${JSON.stringify(shape.text)}`);
}

/** Every scene layer's elements against items; `seen` holds every element met before, so one not met is one made since. */
function check(seen, out) {
	SCENE_LAYERS.forEach((name, index) => {
		const layerElement = root.children[index + 1];
		const shapes = scene.items(name).flatMap((item) => item.shapes);
		const all = layerElement.querySelectorAll("*");
		const made = new Set([...all].filter((element) => !seen.has(element)));
		if (layerElement.childNodes.length !== shapes.length) out.push(`${name}: ${layerElement.childNodes.length} elements against ${shapes.length} shapes`);
		shapes.forEach((shape, i) => layerElement.children[i] && compare(layerElement.children[i], shape, made, `${name}/${i}`, out));
		for (const element of all) seen.add(element);
	});
}

// every element any check has met, kept across calls: an element a check meets for the first time was made since the last
const seen = new WeakSet();

/** Generated puts, patches, moves and removals over the three scene layers, every layer checked after every call. */
page.sequence = (seed, steps) => {
	const rnd = seededRandom(seed);
	const { pick } = randomTools(rnd);
	const out = [];
	let calls = 0;
	for (let n = 0; n < steps && out.length === 0; n++) {
		const layer = pick(SCENE_LAYERS);
		const op = randomOperation(rnd, scene.items(layer).map((item) => item.key));
		if (op.kind === "put") scene.put(layer, op.key, op.shapes, op.place);
		else scene.remove(layer, op.key);
		calls++;
		check(seen, out);
		if (out.length) out.unshift(`seed ${seed}, step ${n}: ${JSON.stringify(op)}`);
	}
	return { calls, elements: SCENE_LAYERS.reduce((sum, _, i) => sum + root.children[i + 1].querySelectorAll("*").length, 0), out: out.slice(0, 8) };
};

/** Takes every item out of every scene layer. */
page.clear = () => {
	for (const name of SCENE_LAYERS) for (const item of scene.items(name)) scene.remove(name, item.key);
	return SCENE_LAYERS.map((name, i) => root.children[i + 1].childNodes.length);
};

/** A transition started on an element, then a sibling item inserted before its item: the element and its running transition kept. */
page.transition = () => {
	const style = (opacity) => `opacity: ${opacity}; transition: opacity 30s linear`;
	scene.put("back", "t", [{ tag: "rect", attrs: { id: "t", x: -100, y: -50, width: 10, height: 10, style: style(1) } }]);
	const element = document.getElementById("t");
	const start = getComputedStyle(element).opacity;
	scene.put("back", "t", [{ tag: "rect", attrs: { id: "t", x: -100, y: -50, width: 10, height: 10, style: style(0) } }]);
	const started = getComputedStyle(element).opacity;
	const [transition] = element.getAnimations();
	const before = { count: element.getAnimations().length, type: transition?.constructor.name, state: transition?.playState };
	scene.put("back", "s", [{ tag: "rect", attrs: { id: "s", x: -90, y: -50, width: 10, height: 10 } }, { tag: "circle", attrs: { r: 1 } }], { before: "t" });
	scene.put("back", "u", [{ tag: "rect", attrs: { id: "u" } }]);
	scene.put("back", "t", [{ tag: "rect", attrs: { id: "t", x: -100, y: -50, width: 10, height: 10, style: style(0), class: "lit" } }]);
	const after = element.getAnimations();
	return {
		start,
		started,
		before,
		kept: document.getElementById("t") === element && element.isConnected,
		order: [...root.children[1].children].map((child) => child.id || child.localName),
		afterCount: after.length,
		same: after[0] === transition,
		state: after[0]?.playState,
		time: after[0]?.currentTime ?? null,
		itemOf: scene.itemOf(element),
	};
};

/** Draws the press targets: a child shape and an item's own shape in a scene layer, and a dot the application draws in the foreign layer. */
page.targets = () => {
	scene.put("top", "group", [{ tag: "g", attrs: { id: "group" }, children: [{ tag: "title", text: "a group" }, { tag: "rect", attrs: { id: "inner", x: -90, y: -40, width: 30, height: 30, fill: "#c33" } }] }]);
	scene.put("top", "own", [{ tag: "circle", attrs: { id: "own", cx: 20, cy: 0, r: 12, fill: "#3c3" } }]);
	const dot = document.createElementNS(SVG, "circle");
	for (const [name, value] of [["id", "dot"], ["cx", "70"], ["cy", "20"], ["r", "10"], ["fill", "#33c"]]) dot.setAttribute(name, value);
	scene.layerElement("free").appendChild(dot);
	const centre = (id) => {
		const box = document.getElementById(id).getBoundingClientRect();
		return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
	};
	const ground = document.getElementById("ground").getBoundingClientRect();
	return { inner: centre("inner"), own: centre("own"), dot: centre("dot"), ground: [Math.round(ground.left + 30), Math.round(ground.bottom - 10)] };
};

// every trusted press: its target, and what itemOf answers for it
window.addEventListener("pointerdown", (event) => {
	page.presses.push({ target: event.target.id || event.target.localName, trusted: event.isTrusted, at: scene.itemOf(event.target) });
}, { capture: true });

/**
 * The conversions against DOMPoint's matrixTransform over the root's screen transform, for `count` points
 * each way: a scene answer equal under Object.is wherever DOMPoint's is finite, and an Error beginning with
 * the function's name wherever it is not.
 */
page.conversions = (seed, count) => {
	const rnd = seededRandom(seed);
	const special = [0, -0, 1, -1, 0.5, 1e-300, -1e-300, 5e-324, 1e15, -1e15, 1e300, -1e300, 1.7976931348623157e308];
	const out = [];
	let compared = 0, refused = 0;
	const value = (n) => (n < special.length * special.length ? special[n % special.length] : (rnd() - 0.5) * 10 ** Math.floor(rnd() * 8));
	for (let n = 0; n < count; n++) {
		const point = { x: value(n), y: n < special.length * special.length ? special[Math.floor(n / special.length)] : value(n) };
		for (const [fn, matrix] of [["toDrawing", root.getScreenCTM().inverse()], ["toScreen", root.getScreenCTM()]]) {
			const expected = new DOMPoint(point.x, point.y).matrixTransform(matrix);
			let answer;
			try {
				answer = scene[fn](point);
			} catch (error) {
				answer = error;
			}
			if (Number.isFinite(expected.x) && Number.isFinite(expected.y)) {
				if (!(answer && Object.is(answer.x, expected.x) && Object.is(answer.y, expected.y) && Object.isFrozen(answer))) out.push(`${fn}(${point.x}, ${point.y}): ${answer?.x}, ${answer?.y} against ${expected.x}, ${expected.y}`);
				compared++;
			} else {
				if (!(answer instanceof Error && Object.getPrototypeOf(answer) === Error.prototype && answer.message.startsWith(`${fn}: `))) out.push(`${fn}(${point.x}, ${point.y}): answered ${answer?.x}, ${answer?.y} where DOMPoint answers ${expected.x}, ${expected.y}`);
				refused++;
			}
		}
	}
	const m = root.getScreenCTM();
	return { compared, refused, out: out.slice(0, 8), matrix: [m.a, m.b, m.c, m.d, m.e, m.f] };
};

page.ready = true;
