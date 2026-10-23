/**
 * Opening a scene, and every function of an open one (CONTRACT.md, VS3, VS4, VS6, VS8, VS9 and VS10).
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
 */
import { isObject, malformed, readRecordArgument } from "./argument-reading.js";
import { convertPoint, readPoint } from "./conversion.js";
import { judgeDeclaration } from "./declaration-reading.js";
import { elementWriter, SVG_NAMESPACE, type ElementRecord, type ElementWriter, type ItemRecord } from "./scene-writing.js";
import { frozenAttributes, readShapes } from "./shape-reading.js";
import type { ElementSlice, OpenSceneResult, Scene, SceneDeclaration, SceneElement, SceneItem, SceneLayer, ScenePoint, ShapeAtElement } from "./types.js";

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
	if (platform !== null) {
		for (const layer of judged.layers) {
			let inProgress: SceneElement | null = null;
			try {
				const element: unknown = Reflect.apply(platform.createElementNS, platform.rootDocument, [SVG_NAMESPACE, "g"]);
				if (!isObject(element)) throw new Error("openScene: the root's document's createElementNS answered no element");
				inProgress = element as SceneElement;
				for (const [name, written] of layer.attrs) inProgress.setAttribute(name, written);
				Reflect.apply(platform.appendChild, platform.root, [inProgress]);
			} catch (error) {
				const takeBack = inProgress === null ? [...made].reverse() : [inProgress, ...[...made].reverse()];
				for (const element of takeBack) {
					try {
						element.remove();
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
	const writer: ElementWriter | null = platform === null ? null : elementWriter(platform.rootDocument, platform.createElementNS, () => writingFor);

	/** The scene's state, judged once a function's arguments are read: closed, failed, or writing refuses the call. */
	const judgeState = (fn: string): void => {
		if (writing) throw new Error(`${fn}: called while the scene writes to the platform, where it is not re-entrant`);
		if (state === "closed") throw new Error(`${fn}: the scene is closed`);
		if (state === "failed") throw new Error(`${fn}: the scene failed when the platform threw while it wrote; only close is left`);
	};

	/** Runs the platform calls of one put or removal; a throw fails the scene and propagates unchanged. */
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
		if (before === null) layer.appendChild(element);
		else layer.insertBefore(element, before);
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

	/** VS9: the item and path an element the scene made belongs to, read by identity alone, or null. */
	const itemOf = (value: unknown): ShapeAtElement | null => {
		const holdsIdentity = (typeof value === "object" && value !== null) || typeof value === "function";
		judgeState("itemOf");
		if (!holdsIdentity || writer === null) return null;
		const record = writer.recordOf(value as object);
		if (record === undefined) return null;
		const path: number[] = [];
		for (let at: ElementRecord | null = record; at !== null; at = at.parent) path.unshift(at.index);
		return Object.freeze({ layer: record.holder.layer, key: record.holder.key, path: Object.freeze(path) });
	};

	/** VS4: a foreign layer's element. */
	const layerElement = (name: unknown): SceneElement => {
		const fn = "layerElement";
		if (typeof name !== "string" || !foreignLayers.has(name)) throw malformed(fn, "the name must be the name of a foreign layer the scene declares");
		judgeState(fn);
		if (platform === null) throw new Error(`${fn}: the scene has no root, so no layer has an element`);
		return layerElements.get(name) as SceneElement;
	};

	/** VS10: a conversion, its point read first, then the scene's state, then the root's screen transform. */
	const convert = (fn: string, point: unknown, inverted: boolean): ScenePoint => {
		const read = readPoint(fn, point);
		judgeState(fn);
		if (platform === null) throw new Error(`${fn}: the scene has no root, so no screen transform`);
		return convertPoint(fn, platform, read, inverted);
	};

	/** VS3's rule 5: closes the scene, then removes every layer element it made, in reverse. */
	const close = (): undefined => {
		if (state === "closed") return undefined;
		if (writing) throw new Error("close: called while the scene writes to the platform, where it is not re-entrant");
		state = "closed";
		let failed = false;
		let first: unknown;
		for (const element of [...made].reverse()) {
			try {
				element.remove();
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
	for (const fn of [put, remove, items, itemOf, layerElement, toDrawing, toScreen, close]) Object.freeze(fn);
	const scene: Scene = Object.freeze({ layers, put, remove, items, itemOf, layerElement, toDrawing, toScreen, close });
	return Object.freeze({ ok: true as const, scene });
}
