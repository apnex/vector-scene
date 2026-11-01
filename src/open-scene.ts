/**
 * Opening a scene, and every function of an open one (CONTRACT.md, VS3, VS4, VS6, VS8, VS9, VS10 and VS12).
 *
 * openScene reads and judges the declaration first, calling no platform method; then, with a root, for each
 * layer in order it makes a <g>, sets the layer's attributes on it in order, and appends it to the root. If a
 * platform method throws meanwhile, it calls remove on every layer element it made -- the one in progress
 * first -- and then the others in reverse of the order made, attempting each, and throws the error first
 * thrown; nothing is left in the root. With no root it makes nothing, and its scene holds data alone.
 *
 * A scene is open until close is first called, closed from then on, and failed from the moment a platform
 * method throws while it writes. Every function but close reads and judges its arguments first, and only
 * then the scene's state: it throws once the scene is closed or failed, and every function, close among
 * them, throws while a put or a removal writes to the platform, since the scene is not re-entrant there.
 * close marks the scene closed first, then removes every layer element in reverse, attempting each, and
 * throws the first error a removal threw; every later call answers undefined and calls nothing.
 *
 * A scene declared with a view (VS14 to VS17) writes the view's transform on each layer's element as it is
 * made, and again on every one at each setView, holding its writing state while it writes; then it tells the
 * listeners registered at that moment, in order, what is visible, and while it tells them setView, put,
 * remove and close throw, every reading function answering. Its conversions compose the view with the root's
 * screen transform. A scene declared without one is exactly a scene of 0.2.0 but for the five functions the
 * view adds, each of which it refuses.
 */
import { isObject, malformed, readRecordArgument } from "./argument-reading.js";
import { convertPoint, readPoint, readTransform } from "./conversion.js";
import { judgeDeclaration } from "./declaration-reading.js";
import { elementCalls, elementWriter, SVG_NAMESPACE, type ElementRecord, type ElementWriter, type ItemRecord } from "./scene-writing.js";
import { OPENING_VIEW, readView, transformText, unwritable, visibleAnswer } from "./scene-view.js";
import { firstHeldAtPoint } from "./shape-at-point.js";
import { frozenAttributes, readShapes } from "./shape-reading.js";
import type { ElementSlice, OpenSceneResult, Scene, SceneDeclaration, SceneElement, SceneItem, SceneLayer, ScenePoint, SceneView, SceneVisible, ShapeAtElement } from "./types.js";

/** The lifecycle: open until close is first called, closed from then on, failed once a platform method throws while the scene writes. */
type SceneState = "open" | "closed" | "failed";

/**
 * VS3: opens a scene from declared layers, on a root or with none; or refuses the declaration with every
 * problem it has. Never throws while it judges the declaration; it throws only the error a platform method
 * threw while it made the layers, after removing every layer element it made. E, the kind of element the
 * root's document makes, is the type's alone: the scene treats every element as VS1's slice.
 */
export function openScene<E extends ElementSlice<E> = SceneElement>(declaration: SceneDeclaration<E>): OpenSceneResult<E> {
	return openSceneOver(declaration) as unknown as OpenSceneResult<E>;
}

/** openScene over elements of the slice's own kind. */
function openSceneOver(declaration: unknown): OpenSceneResult {
	const judged = judgeDeclaration(declaration);
	if (!judged.ok) return judged.refusal;
	const { platform } = judged;
	// VS14: a view, asked beside a root -- which judging the declaration ensures -- so a viewed scene always has a platform
	const viewed = judged.view && platform !== null;

	const layers: readonly SceneLayer[] = Object.freeze(judged.layers.map((layer) => Object.freeze({ name: layer.name, attrs: frozenAttributes(layer.attrs), foreign: layer.foreign })));
	const sceneLayers = new Map<string, ItemRecord[]>();
	const foreignLayers = new Set<string>();
	for (const layer of judged.layers) {
		if (layer.foreign) foreignLayers.add(layer.name);
		else sceneLayers.set(layer.name, []);
	}

	// the lifecycle's rules 1 and 2: each layer's <g> made, its attributes set, and appended; on a throw, every one taken back
	const layerElements = new Map<string, SceneElement>();
	const made: SceneElement[] = [];
	const opening = elementCalls(() => "openScene");
	if (platform !== null) {
		for (const layer of judged.layers) {
			let inProgress: SceneElement | null = null;
			try {
				const element: unknown = Reflect.apply(platform.createElementNS, platform.rootDocument, [SVG_NAMESPACE, "g"]);
				if (!isObject(element)) throw new Error("openScene: the root's document's createElementNS answered no element");
				inProgress = element as SceneElement;
				for (const [name, written] of layer.attrs) opening.setAttribute(inProgress, name, written);
				// VS14: the opening view written as the layer is made, so no frame shows a layer unviewed
				if (viewed) opening.setAttribute(inProgress, "transform", transformText(OPENING_VIEW));
				Reflect.apply(platform.appendChild, platform.root, [inProgress]);
			} catch (error) {
				const takeBack = inProgress === null ? [...made].reverse() : [inProgress, ...[...made].reverse()];
				for (const element of takeBack) {
					try {
						opening.remove(element);
					} catch {
						// every removal is attempted; the error thrown is the one first thrown
					}
				}
				throw error;
			}
			made.push(inProgress);
			layerElements.set(layer.name, inProgress);
		}
	}

	let state: SceneState = "open";
	let writing = false;
	let writingFor = "";
	// VS17: true while setView tells its listeners, when setView, put, remove and close throw
	let telling = false;
	// VS14: the view written, and VS17: the listeners, each its own entry, so one function registered twice is two
	let current: SceneView = OPENING_VIEW;
	const listeners: { readonly listener: (visible: SceneVisible) => unknown }[] = [];
	const writer: ElementWriter | null = platform === null ? null : elementWriter(platform.rootDocument, platform.createElementNS, () => writingFor);
	const placing = elementCalls(() => writingFor);
	const closing = elementCalls(() => "close");

	/** The scene's state, judged once a function's arguments are read: closed, failed, or writing refuses the call. */
	const judgeState = (fn: string): void => {
		if (writing) throw new Error(`${fn}: called while the scene writes to the platform, where it is not re-entrant`);
		if (state === "closed") throw new Error(`${fn}: the scene is closed`);
		if (state === "failed") throw new Error(`${fn}: the scene failed when the platform threw while it wrote; only close is left`);
	};

	/** VS17: a call that changes the scene, refused while setView tells its listeners. */
	const judgeNotTelling = (fn: string): void => {
		if (telling) throw new Error(`${fn}: called while the scene tells its view's listeners, where it is not re-entrant`);
	};

	/** VS14: the scene's state, then a scene declared without a view refused; a call that changes the scene refused while listeners are told. */
	const judgeViewed = (fn: string, changes: boolean): void => {
		judgeState(fn);
		if (changes) judgeNotTelling(fn);
		if (!viewed) throw new Error(`${fn}: the scene was declared without a view`);
	};

	/** Runs the platform calls of one put, removal or setView; a throw fails the scene and propagates unchanged. */
	const write = (fn: string, work: () => void): void => {
		writing = true;
		writingFor = fn;
		try {
			work();
		} catch (error) {
			state = "failed";
			throw error;
		} finally {
			writing = false;
		}
	};

	/** VS4: a function taking a layer takes the name of a scene layer; any other value, a foreign layer's name among them, is malformed. */
	const readLayer = (fn: string, value: unknown): { readonly name: string; readonly items: ItemRecord[] } => {
		const items = typeof value === "string" ? sceneLayers.get(value) : undefined;
		if (items === undefined) throw malformed(fn, "the layer must be the name of a scene layer the scene declares");
		return { name: value as string, items };
	};

	/** VS6: a key is a non-empty string. */
	const readKey = (fn: string, value: unknown): string => {
		if (typeof value !== "string" || value.length === 0) throw malformed(fn, "the key must be a non-empty string");
		return value;
	};

	/** The layer element an item's elements are written beneath. */
	const elementOfLayer = (name: string): SceneElement => layerElements.get(name) as SceneElement;

	/** The first element of an item, which a new or moved item is inserted before. */
	const firstElementOf = (item: ItemRecord): SceneElement => (item.elements[0] as ElementRecord).element;

	/** Inserts an element before another in a layer, or appends it to the layer. */
	const place = (layer: SceneElement, element: SceneElement, before: SceneElement | null): void => {
		if (before === null) placing.appendChild(layer, element);
		else placing.insertBefore(layer, element, before);
	};

	/** VS6 and VS7: makes `shapes` the description of the item `key` in `layer`. */
	const put = (layer: unknown, key: unknown, shapes: unknown, where?: unknown): undefined => {
		const fn = "put";
		const target = readLayer(fn, layer);
		const name = readKey(fn, key);
		const specs = readShapes(fn, shapes);
		let moves = false;
		let before: string | null = null;
		if (where !== undefined) {
			const present = readRecordArgument(fn, where, ["before"], "place");
			if (present.has("before")) {
				const given = present.get("before");
				if (!(given === null || (typeof given === "string" && given.length > 0 && given !== name))) throw malformed(fn, "place's before must be null or a non-empty string naming another item");
				moves = true;
				before = given as string | null;
			}
		}
		judgeState(fn);
		judgeNotTelling(fn);
		const items = target.items;
		let ahead: ItemRecord | null = null;
		if (before !== null) {
			ahead = items.find((item) => item.key === before) ?? null;
			if (ahead === null) throw new Error(`${fn}: the layer holds no item ${JSON.stringify(before)} to place the item before`);
		}
		const shapesDescribed = Object.freeze(specs.map((spec) => spec.described));
		const at = items.findIndex((item) => item.key === name);
		if (at < 0) {
			const item: ItemRecord = { layer: target.name, key: name, specs, shapes: shapesDescribed, elements: [] };
			if (writer !== null) {
				write(fn, () => {
					const layerElement = elementOfLayer(target.name);
					const reference = ahead === null ? null : firstElementOf(ahead);
					specs.forEach((spec, index) => {
						const record = writer.make(spec, null, index, item);
						item.elements.push(record);
						place(layerElement, record.element, reference);
					});
				});
			}
			if (ahead === null) items.push(item);
			else items.splice(items.indexOf(ahead), 0, item);
			return undefined;
		}
		const item = items[at] as ItemRecord;
		if (writer !== null) {
			write(fn, () => {
				const layerElement = elementOfLayer(target.name);
				const next = items[at + 1];
				const append = (element: SceneElement): void => place(layerElement, element, next === undefined ? null : firstElementOf(next));
				item.elements = writer.reconcile(item.elements, item.specs, specs, null, item, layerElement, append);
				if (moves) {
					const reference = ahead === null ? null : firstElementOf(ahead);
					for (const record of item.elements) place(layerElement, record.element, reference);
				}
			});
		}
		item.specs = specs;
		item.shapes = shapesDescribed;
		if (moves) {
			items.splice(at, 1);
			if (ahead === null) items.push(item);
			else items.splice(items.indexOf(ahead), 0, item);
		}
		return undefined;
	};

	/** VS6 and VS7: takes the item out of the layer, its elements with it. */
	const remove = (layer: unknown, key: unknown): undefined => {
		const fn = "remove";
		const target = readLayer(fn, layer);
		const name = readKey(fn, key);
		judgeState(fn);
		judgeNotTelling(fn);
		const at = target.items.findIndex((item) => item.key === name);
		if (at < 0) return undefined;
		const item = target.items[at] as ItemRecord;
		if (writer !== null) {
			write(fn, () => {
				for (const record of item.elements) writer.removeElement(record);
			});
		}
		target.items.splice(at, 1);
		return undefined;
	};

	/** VS6 and VS8: the layer's items, back to front, each its key and its description. */
	const items = (layer: unknown): readonly SceneItem[] => {
		const fn = "items";
		const target = readLayer(fn, layer);
		judgeState(fn);
		return Object.freeze(target.items.map((item) => Object.freeze({ key: item.key, shapes: item.shapes })));
	};

	/** VS9 and VS12: the frozen item and path of an element the scene made and still holds. */
	const shapeOf = (record: ElementRecord): ShapeAtElement => {
		const path: number[] = [];
		for (let at: ElementRecord | null = record; at !== null; at = at.parent) path.unshift(at.index);
		return Object.freeze({ layer: record.holder.layer, key: record.holder.key, path: Object.freeze(path) });
	};

	/** VS9: the item and path an element the scene made belongs to, read by identity alone, or null. */
	const itemOf = (value: unknown): ShapeAtElement | null => {
		const holdsIdentity = (typeof value === "object" && value !== null) || typeof value === "function";
		judgeState("itemOf");
		if (!holdsIdentity || writer === null) return null;
		const record = writer.recordOf(value as object);
		return record === undefined ? null : shapeOf(record);
	};

	/**
	 * VS12: the item and path of the first element of the platform's hit stack at a screen point that the
	 * scene made for a shape of an item it still holds, or null: the point read first, then the scene's state,
	 * then the platform asked, and the state judged again, since a getter of its answer may close the scene.
	 */
	const itemAt = (screen: unknown): ShapeAtElement | null => {
		const fn = "itemAt";
		const point = readPoint(fn, screen);
		judgeState(fn);
		if (platform === null || writer === null) throw new Error(`${fn}: the scene has no root, so no point has an element`);
		if (platform.elementsFromPoint === null) throw new Error(`${fn}: the root's document held no elementsFromPoint function when the scene opened`);
		const record = firstHeldAtPoint(fn, platform.rootDocument, platform.elementsFromPoint, point, writer.recordOf);
		if (state !== "open") throw new Error(`${fn}: the scene ${state === "closed" ? "was closed" : "failed"} while the platform's answer was read`);
		return record === undefined ? null : shapeOf(record);
	};

	/** VS4: a foreign layer's element. */
	const layerElement = (name: unknown): SceneElement => {
		const fn = "layerElement";
		if (typeof name !== "string" || !foreignLayers.has(name)) throw malformed(fn, "the name must be the name of a foreign layer the scene declares");
		judgeState(fn);
		if (platform === null) throw new Error(`${fn}: the scene has no root, so no layer has an element`);
		return layerElements.get(name) as SceneElement;
	};

	/**
	 * VS10: a conversion, its point read first, then the scene's state, then the root's screen transform; a viewed
	 * scene's composed with its view, each step in binary64 in this order: toScreen applies the root's transform
	 * to (s * (p.x - x), s * (p.y - y)), and toDrawing answers (r.x / s + x, r.y / s + y) for r the root point VS10
	 * answers.
	 */
	const convert = (fn: string, point: unknown, inverted: boolean): ScenePoint => {
		const read = readPoint(fn, point);
		judgeState(fn);
		if (platform === null) throw new Error(`${fn}: the scene has no root, so no screen transform`);
		if (!viewed) return convertPoint(fn, platform, read, inverted);
		const { x, y, scale: s } = current;
		if (!inverted) return convertPoint(fn, platform, { x: s * (read.x - x), y: s * (read.y - y) }, false);
		const r = convertPoint(fn, platform, read, true);
		const answer = { x: r.x / s + x, y: r.y / s + y };
		if (!Number.isFinite(answer.x) || !Number.isFinite(answer.y)) throw new Error(`${fn}: the converted point is not finite`);
		return Object.freeze(answer);
	};

	/**
	 * VS15: what the root shows -- its clientWidth and then its clientHeight read at the call, each judged as
	 * read, then its screen transform read as VS10 reads one -- judged whole by visibleAnswer.
	 */
	const visibleNow = (fn: string): SceneVisible => {
		const root = (platform as NonNullable<typeof platform>).root as { readonly clientWidth?: unknown; readonly clientHeight?: unknown };
		const width = root.clientWidth;
		if (typeof width !== "number" || !Number.isFinite(width) || !(width >= 0)) throw new Error(`${fn}: the root's clientWidth must be a finite number at least 0`);
		const height = root.clientHeight;
		if (typeof height !== "number" || !Number.isFinite(height) || !(height >= 0)) throw new Error(`${fn}: the root's clientHeight must be a finite number at least 0`);
		const { a, b } = readTransform(fn, platform as NonNullable<typeof platform>, false);
		const { x, y, scale: s } = current;
		return visibleAnswer(fn, x, y, width / s, height / s, s * Math.hypot(a, b));
	};

	/**
	 * VS14: writes a view: its argument read first, then the scene's state, then its transform's members judged,
	 * all before any platform write; then the transform written on every layer's element, scene and foreign
	 * alike, in declared order, while the scene holds its writing state; then the listeners told (VS17).
	 */
	const setView = (value: unknown): SceneView => {
		const fn = "setView";
		const read = readView(fn, value);
		judgeViewed(fn, true);
		const refused = unwritable(read);
		if (refused !== null) throw malformed(fn, refused);
		const text = transformText(read);
		write(fn, () => {
			for (const element of made) placing.setAttribute(element, "transform", text);
		});
		current = Object.freeze({ x: read.x, y: read.y, scale: read.scale });
		const told = [...listeners];
		if (told.length > 0) {
			telling = true;
			try {
				const seen = visibleNow(fn);
				for (const { listener } of told) Reflect.apply(listener, undefined, [seen]);
			} finally {
				telling = false;
			}
		}
		return current;
	};

	/** VS14: the view written. */
	const view = (): SceneView => {
		judgeViewed("view", false);
		return current;
	};

	/** VS15: what the root shows, in snap-grid's view form. */
	const visible = (): SceneVisible => {
		judgeViewed("visible", false);
		return visibleNow("visible");
	};

	/**
	 * VS16: the view at `scale` that keeps the drawing point under `screen` where it is, setting nothing: the root
	 * point r under the screen point read as toDrawing reads it through the root's screen transform, the drawing
	 * point p under it, and x' = p.x - r.x / scale; an answer setView would refuse is refused with Errors' Error.
	 */
	const zoomAbout = (screen: unknown, scale: unknown): SceneView => {
		const fn = "zoomAbout";
		const point = readPoint(fn, screen);
		if (typeof scale !== "number" || !Number.isFinite(scale) || !(scale > 0)) throw malformed(fn, "the scale must be a finite number above 0");
		judgeViewed(fn, false);
		const r = convertPoint(fn, platform as NonNullable<typeof platform>, point, true);
		const { x, y, scale: s } = current;
		const p = { x: r.x / s + x, y: r.y / s + y };
		const answer = { x: p.x - r.x / scale, y: p.y - r.y / scale, scale };
		const refused = unwritable(answer);
		if (refused !== null) throw new Error(`${fn}: ${refused}`);
		return Object.freeze(answer);
	};

	/** VS17: registers a listener told after each setView; answers a function that removes it, a second call doing nothing. */
	const onView = (listener: unknown): (() => undefined) => {
		const fn = "onView";
		if (typeof listener !== "function") throw malformed(fn, "the listener must be a function");
		judgeViewed(fn, false);
		const entry = { listener: listener as (visible: SceneVisible) => unknown };
		listeners.push(entry);
		let registered = true;
		const removeListener = (): undefined => {
			if (!registered) return undefined;
			registered = false;
			listeners.splice(listeners.indexOf(entry), 1);
			return undefined;
		};
		return Object.freeze(removeListener);
	};

	/** VS3's rule 5: closes the scene, then removes every layer element it made, in reverse. */
	const close = (): undefined => {
		if (state === "closed") return undefined;
		if (writing) throw new Error("close: called while the scene writes to the platform, where it is not re-entrant");
		judgeNotTelling("close");
		state = "closed";
		let failed = false;
		let first: unknown;
		for (const element of [...made].reverse()) {
			try {
				closing.remove(element);
			} catch (error) {
				if (!failed) {
					failed = true;
					first = error;
				}
			}
		}
		if (failed) throw first;
		return undefined;
	};

	const toDrawing = (screen: unknown): ScenePoint => convert("toDrawing", screen, true);
	const toScreen = (point: unknown): ScenePoint => convert("toScreen", point, false);
	for (const fn of [put, remove, items, itemOf, itemAt, layerElement, toDrawing, toScreen, setView, view, visible, zoomAbout, onView, close]) Object.freeze(fn);
	const scene: Scene = Object.freeze({ layers, put, remove, items, itemOf, itemAt, layerElement, toDrawing, toScreen, setView, view, visible, zoomAbout, onView, close });
	return Object.freeze({ ok: true as const, scene });
}
