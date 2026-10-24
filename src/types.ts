/**
 * The public types of vector-scene, one per noun of CONTRACT.md's vocabulary (VS11).
 *
 * The platform slice VS1 touches is stated here as vector-scene's own structural types, with no DOM
 * library: a browser's svg element is assignable as a root, and so are plain objects of its shape. The
 * slice is generic in E, the kind of element the root's document makes, since every element the scene
 * makes goes back into the platform's own methods -- a browser's appendChild takes only the platform's own
 * kind of object, which no structural type of the scene's can promise -- so a browser's root makes E its
 * Element, and a root of plain objects, or none, makes E SceneElement. Every value the scene makes is frozen, so every property
 * it answers is read-only; a description the scene answers is assignable to what put takes.
 */

/** A point: a frozen record of finite numbers x and y. */
export interface ScenePoint {
	readonly x: number;
	readonly y: number;
}

/** What a conversion and itemAt take: an object whose x and y are finite numbers, read through ordinary access, so a point with getters answers. */
export interface ScreenOrDrawingPoint {
	readonly x: number;
	readonly y: number;
}

/** A screen transform as the root answers one (VS1, VS10): six numbers, and for toDrawing its inverse. */
export interface SceneMatrix {
	readonly a: number;
	readonly b: number;
	readonly c: number;
	readonly d: number;
	readonly e: number;
	readonly f: number;
	inverse(): SceneMatrix;
}

/**
 * What the scene touches of an element it makes (VS1), E being the kind of element the root's document
 * makes: it calls these methods on it, each given elements of that kind, writes its text, and reads
 * nothing of it. A member taking an element is written as a function-typed property, not a method, so E is
 * inferred from what the document makes: a method's parameters are compared both ways, so TypeScript
 * would infer from a browser's appendChild too, and widen E past Element to the type that method takes.
 */
export interface ElementSlice<E> {
	setAttribute(name: string, value: string): void;
	removeAttribute(name: string): void;
	readonly appendChild: (child: E) => unknown;
	readonly insertBefore: (child: E, before: E | null) => unknown;
	remove(): void;
	textContent: string | null;
}

/** An element of plain objects' shape: the slice over elements of its own kind, the kind a root of plain objects, or none, makes. */
export interface SceneElement extends ElementSlice<SceneElement> {}

/**
 * The root's document (VS1): the scene makes every element through it, in the SVG namespace, and asks it
 * which elements lie at a screen point (VS12) -- optional, a document holding none opening a scene whose
 * itemAt refuses. Of the hit test's answer the scene reads its length and its indices, and of each element
 * nothing but its identity.
 */
export interface SceneDocument<E extends ElementSlice<E> = SceneElement> {
	createElementNS(namespace: string, tag: string): E;
	elementsFromPoint?(x: number, y: number): readonly unknown[];
}

/** The root (VS1): the platform's element the scene draws into, an svg element in a browser. */
export interface SceneRoot<E extends ElementSlice<E> = SceneElement> {
	readonly ownerDocument: SceneDocument<E>;
	readonly appendChild: (layer: E) => unknown;
	getScreenCTM(): SceneMatrix | null;
}

/** An attribute record (VS5): names of a letter or underscore followed by letters, digits, underscores, periods and hyphens, none beginning "on"; values strings or finite numbers. */
export interface AttributeRecord {
	readonly [name: string]: string | number;
}

/** What every shape holds: its tag, and optionally its attributes. */
interface ShapeBase {
	/** The element's local name in the SVG namespace: an ASCII letter followed by ASCII letters, digits and hyphens. */
	readonly tag: string;
	readonly attrs?: AttributeRecord;
}

/** A shape holding text, the element's text content, "" meaning none. */
export interface TextShape extends ShapeBase {
	readonly text: string;
	readonly children?: never;
}

/** A shape holding child shapes, the element's children in order, an empty list meaning none. */
export interface ParentShape extends ShapeBase {
	readonly children: readonly Shape[];
	readonly text?: never;
}

/** A shape holding neither text nor children. */
export interface EmptyShape extends ShapeBase {
	readonly text?: never;
	readonly children?: never;
}

/** Data describing one element (VS5): a tag, attributes, and text or child shapes, never both. */
export type Shape = TextShape | ParentShape | EmptyShape;

/** A shape as the scene answers it, in a description: tag and attrs, then text when it has text or children when it has child shapes. */
export type DescribedShape =
	| { readonly tag: string; readonly attrs: { readonly [name: string]: string }; readonly text: string; readonly children?: never }
	| { readonly tag: string; readonly attrs: { readonly [name: string]: string }; readonly children: readonly DescribedShape[]; readonly text?: never }
	| { readonly tag: string; readonly attrs: { readonly [name: string]: string }; readonly text?: never; readonly children?: never };

/** Where put places an item (VS6): before the item named, or last when before is null. */
export interface ScenePlace {
	readonly before?: string | null;
}

/** One declared layer (VS3, VS4). */
export interface LayerDeclaration {
	/** A non-empty string, unique among the layers. */
	readonly name: string;
	/** Attributes written on the layer's element. */
	readonly attrs?: AttributeRecord;
	/** A layer the application draws beneath itself; false when absent. */
	readonly foreign?: boolean;
}

/** A scene's declaration (VS3): its layers, back to front, and optionally the root it draws into. */
export interface SceneDeclaration<E extends ElementSlice<E> = SceneElement> {
	readonly root?: SceneRoot<E>;
	readonly layers: readonly LayerDeclaration[];
}

/** A layer as the scene answers it: a frozen copy of its declaration. */
export interface SceneLayer {
	readonly name: string;
	readonly attrs: { readonly [name: string]: string };
	readonly foreign: boolean;
}

/** One item as items answers it: its key, and its description, the shapes as last put. */
export interface SceneItem {
	readonly key: string;
	readonly shapes: readonly DescribedShape[];
}

/** Which shape an element belongs to (VS9), or lies at a screen point (VS12): its layer, its item's key, and the path of indices from the item's own shapes down. */
export interface ShapeAtElement {
	readonly layer: string;
	readonly key: string;
	readonly path: readonly number[];
}

/** An open scene (VS3 to VS10, VS12), E the kind of element its root's document makes. */
export interface Scene<E extends ElementSlice<E> = SceneElement> {
	readonly layers: readonly SceneLayer[];
	/** Makes `shapes` the description of item `key` in `layer`, placing it as `place` says (VS6, VS7). */
	readonly put: (layer: string, key: string, shapes: readonly Shape[], place?: ScenePlace) => undefined;
	/** Takes the item out of the layer, its elements with it (VS6). */
	readonly remove: (layer: string, key: string) => undefined;
	/** The layer's items, back to front (VS6, VS8). */
	readonly items: (layer: string) => readonly SceneItem[];
	/** The shape an element the scene made belongs to, or null (VS9). */
	readonly itemOf: (value: unknown) => ShapeAtElement | null;
	/** The shape of the first element the scene made for an item it holds in the platform's hit stack at a screen point, or null (VS12). */
	readonly itemAt: (screen: ScreenOrDrawingPoint) => ShapeAtElement | null;
	/** A foreign layer's element, which the application draws beneath (VS4). */
	readonly layerElement: (name: string) => E;
	/** Where a screen point lies in drawing coordinates (VS10). */
	readonly toDrawing: (screen: ScreenOrDrawingPoint) => ScenePoint;
	/** Where a point in drawing coordinates lies on the screen (VS10). */
	readonly toScreen: (point: ScreenOrDrawingPoint) => ScenePoint;
	/** Closes the scene and removes every layer element it made; later calls do nothing (VS3). */
	readonly close: () => undefined;
}

/** The codes a refused declaration's problems carry (VS3). */
export type DeclarationProblemCode = "not-an-object" | "unknown-property" | "missing-property" | "invalid-value" | "duplicate-name";

/** One problem of a refused declaration: an RFC 6901 pointer into it, and a code. */
export interface DeclarationProblem {
	readonly pointer: string;
	readonly problem: DeclarationProblemCode;
}

/** What openScene returns: the open scene, or every problem of its declaration (VS3). */
export type OpenSceneResult<E extends ElementSlice<E> = SceneElement> = { readonly ok: true; readonly scene: Scene<E> } | { readonly ok: false; readonly problems: readonly DeclarationProblem[] };
