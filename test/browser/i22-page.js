// i22-page - the page I22 drives (CONTRACT.md I22): the drafter's transform-range cases through the scene's own writes.
// One viewed scene on a root whose screen transform is the identity; for a case of scale s at drawing x D, the view
// places D at the root's horizontal centre and 0 at its vertical centre -- so the vertical member, -s * y, stays 300 --
// and a black bar 100 screen pixels wide and tall is put with its left edge 7 screen pixels right of D, as the probe
// puts it; its edges by 3.2's arithmetic in binary64, and the scene's own hit test along row 300, are answered here.
import { openScene } from "@apnex/vector-scene";

const W = 800, H = 600, ROW = 300;
const root = document.getElementById("root");
const page = (globalThis.page = { refused: null, scene: null, ready: false });
const opened = openScene({ root, layers: [{ name: "bars" }], view: true });
if (opened.ok) page.scene = opened.scene;
else page.refused = opened.problems;
const scene = page.scene;

/** Every attribute the scene writes on the root's subtree, recorded as it is written. */
const observer = new MutationObserver(() => {});
observer.observe(root, { subtree: true, attributes: true, childList: true });

/** The view and the bar of a case, written through setView and put; its edges by the arithmetic, and the view's members. */
page.place = (D, s) => {
	const view = { x: D - W / 2 / s, y: -H / 2 / s, scale: s };
	const left = D + 7 / s, width = 100 / s;
	scene.put("bars", "bar", [{ tag: "rect", attrs: { id: "bar", x: left, y: -50 / s, width, height: 100 / s, fill: "#000" } }]);
	scene.setView(view);
	observer.takeRecords();
	return { view, members: [s, -s * view.x, -s * view.y], eL: s * (left - view.x), eR: s * (left + width - view.x), transform: root.querySelector("g").getAttribute("transform") };
};

/** The scene's own hit test along the row: the first point from `from` to `to`, by eighths of a pixel, at which itemAt answers the bar. */
page.hit = (from, to) => {
	const step = from < to ? 1 / 8 : -1 / 8;
	for (let k = 0; k <= 8 * Math.abs(to - from); k++) {
		const x = from + k * step;
		if (scene.itemAt({ x, y: ROW })?.key === "bar") return x;
	}
	return null;
};

/** A view setView must refuse: what it threw, and every write the platform recorded meanwhile. */
page.refuse = (view) => {
	observer.takeRecords();
	const before = root.querySelector("g").getAttribute("transform");
	let thrown = null;
	try {
		scene.setView(view);
	} catch (error) {
		thrown = `${error.constructor.name}: ${error.message}`;
	}
	return { thrown, records: observer.takeRecords().length, kept: root.querySelector("g").getAttribute("transform") === before, view: scene.view() };
};

page.frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))));
page.ready = true;
