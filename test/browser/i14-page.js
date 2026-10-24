// i14-page - the page I14 drives (CONTRACT.md I14): a scene on an SVG root, its items in two scene layers,
// a third scene layer declared with pointer-events none lying over one of them, and a foreign layer the page
// draws into. Every trusted press and move is recorded with its target, what itemOf answers of the target and
// what itemAt answers of the event's screen point; a press may take the pointer, as input-capture's
// takePointer takes it, on the root.
import { openScene } from "@apnex/vector-scene";

const SVG = "http://www.w3.org/2000/svg";
const root = document.getElementById("root");
const LAYERS = [{ name: "low" }, { name: "high" }, { name: "veil", attrs: { "pointer-events": "none" } }, { name: "over", foreign: true }];
const page = (globalThis.page = { refused: null, scene: null, presses: [], moves: [], capturing: false, ready: false });

const opened = openScene({ root, layers: LAYERS });
if (opened.ok) page.scene = opened.scene;
else page.refused = opened.problems;
const scene = page.scene;

// the items: a and a nested group in the low layer, one in the high layer, one beneath the veil, one the page will cover
scene.put("low", "a", [{ tag: "rect", attrs: { id: "a", x: 10, y: 10, width: 50, height: 50, fill: "#c33" } }]);
scene.put("low", "b", [{ tag: "g", attrs: { id: "b" }, children: [{ tag: "rect", attrs: { id: "b-back", x: 70, y: 10, width: 50, height: 50, fill: "#3c3" } }, { tag: "g", children: [{ tag: "circle", attrs: { id: "b-dot", cx: 80, cy: 20, r: 6, fill: "#363" } }] }] }]);
scene.put("high", "c", [{ tag: "rect", attrs: { id: "c", x: 130, y: 10, width: 50, height: 50, fill: "#33c" } }]);
scene.put("low", "d", [{ tag: "rect", attrs: { id: "d", x: 20, y: 75, width: 60, height: 30, fill: "#cc3" } }]);
scene.put("low", "e", [{ tag: "rect", attrs: { id: "e", x: 120, y: 75, width: 60, height: 30, fill: "#3cc" } }]);
scene.put("veil", "v", [{ tag: "rect", attrs: { id: "v", x: 0, y: 70, width: 200, height: 40, fill: "#000", opacity: 0.3 } }]);

const hit = (event) => ({ target: event.target.id || event.target.localName, trusted: event.isTrusted, buttons: event.buttons, captured: root.hasPointerCapture(event.pointerId), x: event.clientX, y: event.clientY, of: scene.itemOf(event.target), at: scene.itemAt({ x: event.clientX, y: event.clientY }) });

root.addEventListener("pointerdown", (event) => {
	if (page.capturing) root.setPointerCapture(event.pointerId);
	page.presses.push(hit(event));
});
window.addEventListener("pointermove", (event) => page.moves.push(hit(event)), { capture: true });

/** The centre of an element on the screen, rounded to a pixel. */
page.centre = (id) => {
	const box = document.getElementById(id).getBoundingClientRect();
	return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
};

/** The root's box on the screen. */
page.box = () => {
	const box = root.getBoundingClientRect();
	return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
};

/** Draws an opaque rect the scene did not make in the foreign layer, over item e. */
page.occlude = () => {
	const cover = document.createElementNS(SVG, "rect");
	for (const [name, value] of [["id", "occluder"], ["x", "110"], ["y", "70"], ["width", "80"], ["height", "40"], ["fill", "#888"]]) cover.setAttribute(name, value);
	scene.layerElement("over").appendChild(cover);
	return page.centre("e");
};

/** Sets another viewBox on the root, as an application may after the scene opened (VS13), and answers the root's new screen transform. */
page.reframe = (viewBox) => {
	root.setAttribute("viewBox", viewBox);
	const m = root.getScreenCTM();
	return [m.a, m.b, m.c, m.d, m.e, m.f];
};

/** The conversions against DOMPoint's matrixTransform over the root's screen transform as it stands, for a few points each way, under Object.is. */
page.conversions = () => {
	const out = [];
	for (const point of [{ x: 0, y: 0 }, { x: 31.5, y: 47 }, { x: 250, y: 300 }, { x: -12, y: 400.25 }]) {
		for (const [fn, m] of [["toDrawing", root.getScreenCTM().inverse()], ["toScreen", root.getScreenCTM()]]) {
			const expected = new DOMPoint(point.x, point.y).matrixTransform(m);
			const answer = scene[fn](point);
			if (!Object.is(answer.x, expected.x) || !Object.is(answer.y, expected.y)) out.push(`${fn}(${point.x}, ${point.y}): ${answer.x}, ${answer.y} against ${expected.x}, ${expected.y}`);
		}
	}
	return out;
};

/** What itemAt answers at each listed element's centre on the screen. */
page.itemsAtCentres = (ids) => Object.fromEntries(ids.map((id) => [id, scene.itemAt(Object.fromEntries(page.centre(id).map((v, i) => [i === 0 ? "x" : "y", v])))]));

page.ready = true;
