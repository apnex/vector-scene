// i21-page - the page I21 drives (CONTRACT.md I21): a viewed scene on each of three roots, each with a foreign layer
// beneath its items and one above them, the items at known drawing coordinates, and the functions the test calls
// to set a view and read back what the platform shows -- the layers' transforms, the elements' boxes, the platform's
// hit test -- and to hold the conversions against DOMPoint over the root's screen transform and the view.
import { openScene } from "@apnex/vector-scene";

const SVG = "http://www.w3.org/2000/svg";
const page = (globalThis.page = { refused: {}, scenes: {}, ready: false });

/** The items, in drawing coordinates: a and b rects, c a group holding a circle; and the foreign rects drawn beneath and above. */
export const ITEMS = { a: { x: 0, y: 0, w: 40, h: 30 }, b: { x: 100, y: -50, w: 60, h: 40 } };
for (const id of ["moved", "scaled", "resized"]) {
	const root = document.getElementById(id);
	const opened = openScene({ root, layers: [{ name: "under", foreign: true }, { name: "items" }, { name: "over", foreign: true }], view: true });
	if (!opened.ok) {
		page.refused[id] = opened.problems;
		continue;
	}
	const scene = (page.scenes[id] = opened.scene);
	for (const [key, r] of Object.entries(ITEMS)) scene.put("items", key, [{ tag: "rect", attrs: { id: `${id}-${key}`, x: r.x, y: r.y, width: r.w, height: r.h, fill: "#c33" } }]);
	scene.put("items", "c", [{ tag: "g", attrs: { id: `${id}-c` }, children: [{ tag: "circle", attrs: { id: `${id}-c-dot`, cx: -80, cy: 60, r: 12, fill: "#33c" } }] }]);
	// the foreign rects: one beneath, under nothing of the scene's, and one above, drawn over item b's right half
	const under = document.createElementNS(SVG, "rect");
	for (const [name, value] of [["id", `${id}-under`], ["x", "200"], ["y", "100"], ["width", "30"], ["height", "20"], ["fill", "#888"]]) under.setAttribute(name, value);
	scene.layerElement("under").appendChild(under);
	const over = document.createElementNS(SVG, "rect");
	for (const [name, value] of [["id", `${id}-over`], ["x", "130"], ["y", "-50"], ["width", "30"], ["height", "40"], ["fill", "#888"]]) over.setAttribute(name, value);
	scene.layerElement("over").appendChild(over);
}

/** Sets a view on one root's scene, and answers what the platform then shows. */
page.show = (id, view) => {
	const scene = page.scenes[id];
	const root = document.getElementById(id);
	const answered = scene.setView(view);
	const layers = [...root.children].filter((e) => e.localName === "g");
	const box = (e) => {
		const r = e.getBoundingClientRect();
		return { left: r.left, top: r.top, width: r.width, height: r.height };
	};
	const visible = scene.visible();
	return {
		answered,
		transforms: layers.map((g) => g.getAttribute("transform")),
		layerElements: layers.length,
		topLeft: scene.toScreen({ x: view.x, y: view.y }),
		rootBox: box(root),
		boxes: { a: box(document.getElementById(`${id}-a`)), b: box(document.getElementById(`${id}-b`)), dot: box(document.getElementById(`${id}-c-dot`)) },
		visible,
		corners: { topLeft: scene.toDrawing({ x: root.getBoundingClientRect().left, y: root.getBoundingClientRect().top }), bottomRight: scene.toDrawing({ x: root.getBoundingClientRect().right, y: root.getBoundingClientRect().bottom }) },
	};
};

/** What the scene and the platform answer at each screen point: itemAt, and itemOf of the platform's own topmost element. */
page.hits = (id, points) => {
	const scene = page.scenes[id];
	return points.map(([x, y]) => {
		const element = document.elementFromPoint(x, y);
		return { at: scene.itemAt({ x, y }), of: scene.itemOf(element), element: element ? element.id || element.localName : null };
	});
};

/**
 * The conversions under the current view against DOMPoint over the root's screen transform: toScreen(p) against
 * new DOMPoint(s * (p.x - x), s * (p.y - y)).matrixTransform(ctm), toDrawing(q) against (r.x / s + x, r.y / s + y)
 * for r = new DOMPoint(q.x, q.y).matrixTransform(ctm.inverse()), each under Object.is; and toScreen against the
 * platform's own composition, DOMPoint over the layer element's getScreenCTM, within a part in 10^5.
 */
page.conversions = (id, count, seed) => {
	const scene = page.scenes[id];
	const root = document.getElementById(id);
	const layer = [...root.children].find((e) => e.localName === "g");
	const { x, y, scale: s } = scene.view();
	const ctm = root.getScreenCTM();
	const inverse = ctm.inverse();
	const drawn = layer.getScreenCTM();
	let state = seed >>> 0;
	const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
	const wrong = [];
	let compared = 0, platform = 0;
	for (let i = 0; i < count; i++) {
		const p = { x: x + (random() - 0.25) * 2000 / s, y: y + (random() - 0.25) * 2000 / s };
		const want = new DOMPoint(s * (p.x - x), s * (p.y - y)).matrixTransform(ctm);
		const got = scene.toScreen(p);
		if (!(Object.is(got.x, want.x) && Object.is(got.y, want.y))) wrong.push(`toScreen(${p.x}, ${p.y}): ${got.x}, ${got.y} against ${want.x}, ${want.y}`);
		const q = { x: (random() - 0.2) * 1200, y: (random() - 0.2) * 900 };
		const r = new DOMPoint(q.x, q.y).matrixTransform(inverse);
		const back = scene.toDrawing(q);
		if (!(Object.is(back.x, r.x / s + x) && Object.is(back.y, r.y / s + y))) wrong.push(`toDrawing(${q.x}, ${q.y}): ${back.x}, ${back.y} against ${r.x / s + x}, ${r.y / s + y}`);
		const seen = new DOMPoint(p.x, p.y).matrixTransform(drawn);
		const tolerance = 1e-5 * Math.max(1, Math.abs(want.x), Math.abs(want.y));
		if (!(Math.abs(seen.x - got.x) <= tolerance && Math.abs(seen.y - got.y) <= tolerance)) wrong.push(`toScreen(${p.x}, ${p.y}): ${got.x}, ${got.y} where the layer's own transform puts it at ${seen.x}, ${seen.y}`);
		compared += 2;
		platform++;
	}
	return { compared, platform, wrong: wrong.slice(0, 5), wrongCount: wrong.length };
};

/** Resizes a root, its width and height attributes, with no setView. */
page.resize = (id, width, height) => {
	const root = document.getElementById(id);
	root.setAttribute("width", String(width));
	root.setAttribute("height", String(height));
	return { clientWidth: root.clientWidth, clientHeight: root.clientHeight };
};

page.visible = (id) => page.scenes[id].visible();
page.ready = true;
