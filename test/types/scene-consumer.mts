// A TypeScript consumer of vector-scene's public entry point, compiled by public-types.test.js under strict
// settings, with and without exactOptionalPropertyTypes, and with the DOM library a page has (I11): a
// browser's SVG element is passed as the root, and the elements its document makes are what layerElement
// answers; an items answer's shapes are passed back to put; plain objects of the slice's shape, and no root,
// type-check too. Each line marked as an expected error must fail to compile, or the compile fails.
import { openScene, type DescribedShape, type ElementSlice, type OpenSceneResult, type Scene, type SceneDeclaration, type SceneDocument, type SceneElement, type SceneItem, type SceneLayer, type SceneMatrix, type ScenePoint, type SceneRoot, type Shape, type ShapeAtElement } from "@apnex/vector-scene";

declare const svg: SVGSVGElement;
declare const event: PointerEvent;

// A browser's svg element is a root, its document making Elements and answering elementsFromPoint.
const browserRoot: SceneRoot<Element> = svg;
const browserDocument: SceneDocument<Element> = svg.ownerDocument;
const matrix: SceneMatrix | null = svg.getScreenCTM();

const opened = openScene({ root: svg, layers: [{ name: "back", attrs: { id: "back", opacity: 0.5 } }, { name: "items" }, { name: "pipes", foreign: true }] });
if (opened.ok) {
	const scene: Scene<Element> = opened.scene;
	scene.put("items", "a", [{ tag: "g", attrs: { class: "node", x: 1 }, children: [{ tag: "text", text: "hi" }, { tag: "rect" }] }], { before: null });
	scene.put("items", "b", [{ tag: "circle", attrs: { r: 2 } }], { before: "a" });
	scene.put("items", "c", [{ tag: "path" }], {});

	// An items answer's shapes are put again as they are.
	const items: readonly SceneItem[] = scene.items("items");
	for (const item of items) scene.put("items", item.key, item.shapes);
	const described: readonly DescribedShape[] = items[0]?.shapes ?? [];
	const asShapes: readonly Shape[] = described;
	const first = described[0];
	if (first !== undefined) {
		const tag: string = first.tag;
		const value: string | undefined = first.attrs["class"];
		const text: string | undefined = first.text;
		const children: readonly DescribedShape[] | undefined = first.children;
		void [tag, value, text, children];
		// @ts-expect-error -- a described shape's property cannot be written
		first.tag = "rect";
		// @ts-expect-error -- nor its attributes'
		first.attrs["class"] = "other";
	}

	// A foreign layer's element is the platform's own element, drawn beneath with the DOM's own methods.
	const pipes: Element = scene.layerElement("pipes");
	pipes.append(document.createElementNS("http://www.w3.org/2000/svg", "path"));

	// The element a pointer event targets is asked of by identity.
	const at: ShapeAtElement | null = scene.itemOf(event.target);
	const path: readonly number[] = at === null ? [] : at.path;

	// The item at a screen point is asked of by the point, a captured pointer's among them.
	const under: ShapeAtElement | null = scene.itemAt({ x: event.clientX, y: event.clientY });
	const hit: ShapeAtElement | null = scene.itemOf(event.target) ?? scene.itemAt(new DOMPoint(event.clientX, event.clientY));
	void [under, hit];
	// @ts-expect-error -- itemAt takes a point, not an element
	scene.itemAt(event.target);

	// Conversions take a DOMPoint, or any point, and answer a frozen point.
	const drawing: ScenePoint = scene.toDrawing(new DOMPoint(event.clientX, event.clientY));
	const screen: ScenePoint = scene.toScreen({ x: drawing.x, y: drawing.y });
	const layers: readonly SceneLayer[] = scene.layers;
	const closed: undefined = scene.close();
	void [items, asShapes, at, path, screen, layers, closed];

	// @ts-expect-error -- a point's coordinates cannot be written
	drawing.x = 0;
	// @ts-expect-error -- a scene's functions cannot be replaced
	scene.put = () => undefined;
	// @ts-expect-error -- nor a layer's name written
	layers[0].name = "other";
} else {
	const pointers: readonly string[] = opened.problems.map((problem) => problem.pointer);
	void pointers;
}

// A shape's properties are read-only.
const shape: Shape = { tag: "g", attrs: { id: "a" }, children: [] };
// @ts-expect-error -- a shape's property cannot be written
shape.tag = "rect";
// @ts-expect-error -- nor its attributes'
shape.attrs = {};

// A shape holds text or children, never both.
// @ts-expect-error -- both text and children
const both: Shape = { tag: "g", text: "", children: [] };
// @ts-expect-error -- both, nested
const nestedBoth: Shape = { tag: "g", children: [{ tag: "text", text: "a", children: [] }] };
// @ts-expect-error -- an attribute's value is a string or a number
const badValue: Shape = { tag: "g", attrs: { x: true } };
// @ts-expect-error -- a shape has a tag
const noTag: Shape = { attrs: {} };
// @ts-expect-error -- put takes at least the layer, key and shapes
opened.ok && opened.scene.put("items", "a");
// @ts-expect-error -- a place's before is a string or null
opened.ok && opened.scene.put("items", "a", [{ tag: "g" }], { before: 5 });

// A root of plain objects of the slice's shape, its document with or without elementsFromPoint, and no root at all: E is SceneElement.
declare const plainRoot: SceneRoot;
declare const plainElement: SceneElement;
const withoutHits: SceneDocument = { createElementNS: () => plainElement };
const withHits: SceneDocument = { createElementNS: () => plainElement, elementsFromPoint: () => [plainElement] };
// @ts-expect-error -- a document's elementsFromPoint answers an array
const badHits: SceneDocument = { createElementNS: () => plainElement, elementsFromPoint: () => 5 };
const plain: OpenSceneResult = openScene({ root: plainRoot, layers: [{ name: "a" }] });
const rootless: OpenSceneResult<SceneElement> = openScene({ layers: [{ name: "a", foreign: false }] });
const declaration: SceneDeclaration = { layers: [{ name: "a" }] };
const declared = openScene(declaration);
if (declared.ok) {
	const element: SceneElement = declared.scene.layerElement("a");
	void element;
}

// An element kind of the application's own, carried through.
interface MyElement extends ElementSlice<MyElement> {
	readonly id: number;
}
declare const myRoot: SceneRoot<MyElement>;
const mine = openScene({ root: myRoot, layers: [{ name: "f", foreign: true }] });
if (mine.ok) {
	const id: number = mine.scene.layerElement("f").id;
	void id;
}

// A window is no root: it has no ownerDocument.
// @ts-expect-error -- not a root
openScene({ root: window, layers: [{ name: "a" }] });
// @ts-expect-error -- layers is required
openScene({ root: svg });

void [browserRoot, browserDocument, matrix, both, nestedBoth, badValue, noTag, plain, rootless, withoutHits, withHits, badHits];
