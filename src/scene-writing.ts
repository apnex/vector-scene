/**
 * Bringing the platform to a description (CONTRACT.md, VS7), and which item an element belongs to (VS9).
 *
 * Each put and removal makes exactly these platform calls, in this order, and reads nothing of the platform:
 * a shape's element is made by createElementNS with its tag, each attribute set in order, its text written
 * when it has text, each child made the same way, depth first, and appended, and only then is it inserted
 * where it goes. An item put again is brought from its old shapes to its new list by list -- its own shapes,
 * and the children of every element kept -- position by position: where both lists hold a shape of the same
 * tag the element is kept and patched; where the new list holds a shape and the old none, or one of another
 * tag, a new element is made and inserted before the old element at that position or, past the old list's
 * end, appended to its parent; then the old element there, if any, is removed; and the old elements past
 * the new list's end are removed, in order.
 *
 * An element is patched by setting each new attribute whose value differs or which the old lacked, in the
 * new order, and removing each old attribute the new lacks, in the old order; then its content, by the four
 * cases VS7 step 4 names. Every element made is answered by an element record, held in a WeakMap by the
 * element's identity alone, so which item an element belongs to is answered without reading the element.
 */
import type { Spec } from "./shape-reading.js";
import type { PlatformMethod } from "./declaration-reading.js";
import type { DescribedShape, SceneElement } from "./types.js";

/** The SVG namespace, in which the scene makes every element. */
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** An item: the shapes held under one key in one scene layer, and, with a root, its elements. */
export interface ItemRecord {
	readonly layer: string;
	readonly key: string;
	specs: readonly Spec[];
	shapes: readonly DescribedShape[];
	elements: ElementRecord[];
}

/** One element the scene made for a shape of an item: its parent's record, its index among its siblings, and its own children's records. */
export interface ElementRecord {
	readonly element: SceneElement;
	readonly parent: ElementRecord | null;
	readonly index: number;
	readonly holder: ItemRecord;
	kids: ElementRecord[];
}

/** Where a new element at a position past the old list's end goes: before an element, or appended to its parent. */
type Append = (element: SceneElement) => void;

/** Makes and patches elements for one scene, through the root's document's createElementNS read as the scene opened. */
export interface ElementWriter {
	/** Makes a shape's element and its children's, depth first, registering each; does not insert it. */
	make(spec: Spec, parent: ElementRecord | null, index: number, holder: ItemRecord): ElementRecord;
	/** Brings a list of elements from old shapes to new, position by position; answers the new list's records. */
	reconcile(records: readonly ElementRecord[], olds: readonly Spec[], news: readonly Spec[], parent: ElementRecord | null, holder: ItemRecord, container: SceneElement, append: Append): ElementRecord[];
	/** Removes an element and forgets it and every element beneath it. */
	removeElement(record: ElementRecord): void;
	/** The record of an element the scene made and still holds, by identity alone. */
	recordOf(value: object): ElementRecord | undefined;
}

/** VS7 and VS9: the element writer of one scene. `fn` names the function whose writing a refusal reports. */
export function elementWriter(rootDocument: object, createElementNS: PlatformMethod, fn: () => string): ElementWriter {
	const owner = new WeakMap<object, ElementRecord>();

	const forget = (record: ElementRecord): void => {
		owner.delete(record.element);
		for (const kid of record.kids) forget(kid);
	};

	const create = (tag: string): SceneElement => {
		const made = Reflect.apply(createElementNS, rootDocument, [SVG_NAMESPACE, tag]);
		if (typeof made !== "object" || made === null) throw new Error(`${fn()}: the root's document's createElementNS answered no element`);
		return made as SceneElement;
	};

	const make = (spec: Spec, parent: ElementRecord | null, index: number, holder: ItemRecord): ElementRecord => {
		const element = create(spec.tag);
		const record: ElementRecord = { element, parent, index, holder, kids: [] };
		owner.set(element, record);
		for (const [name, written] of spec.attrs) element.setAttribute(name, written);
		if (spec.text !== "") element.textContent = spec.text;
		appendKids(record, spec.kids);
		return record;
	};

	/** Each child made and appended, in order. */
	const appendKids = (record: ElementRecord, kids: readonly Spec[]): void => {
		kids.forEach((kid, index) => {
			const made = make(kid, record, index, record.holder);
			record.kids.push(made);
			record.element.appendChild(made.element);
		});
	};

	const removeElement = (record: ElementRecord): void => {
		record.element.remove();
		forget(record);
	};

	/** VS7 step 4: an element patched from its old shape to its new. */
	const patch = (record: ElementRecord, old: Spec, now: Spec): void => {
		const { element } = record;
		for (const [name, written] of now.attrs) if (old.attrMap.get(name) !== written) element.setAttribute(name, written);
		for (const [name] of old.attrs) if (!now.attrMap.has(name)) element.removeAttribute(name);
		const hadKids = old.kids.length > 0;
		const hasKids = now.kids.length > 0;
		if (!hadKids && !hasKids) {
			// text to text: the new text written when it differs, "" among them
			if (old.text !== now.text) element.textContent = now.text;
		} else if (!hadKids) {
			// text to children: "" written when the old text was not, then each child made and appended
			if (old.text !== "") element.textContent = "";
			record.kids = [];
			appendKids(record, now.kids);
		} else if (!hasKids) {
			// children to text or to none: each old child removed, in order, then the new text written when there is one
			for (const kid of record.kids) removeElement(kid);
			record.kids = [];
			if (now.text !== "") element.textContent = now.text;
		} else {
			// children to children: the lists compared as VS7 step 3 compares them
			record.kids = reconcile(record.kids, old.kids, now.kids, record, record.holder, element, (made) => {
				element.appendChild(made);
			});
		}
	};

	/** VS7 step 3: position by position. */
	const reconcile = (records: readonly ElementRecord[], olds: readonly Spec[], news: readonly Spec[], parent: ElementRecord | null, holder: ItemRecord, container: SceneElement, append: Append): ElementRecord[] => {
		const kept: ElementRecord[] = [];
		const positions = Math.max(olds.length, news.length);
		for (let index = 0; index < positions; index++) {
			const old = olds[index];
			const now = news[index];
			const record = records[index];
			if (old !== undefined && now !== undefined && record !== undefined && old.tag === now.tag) {
				patch(record, old, now);
				kept.push(record);
				continue;
			}
			if (now !== undefined) {
				const made = make(now, parent, index, holder);
				if (record !== undefined) container.insertBefore(made.element, record.element);
				else append(made.element);
				kept.push(made);
			}
			if (record !== undefined) removeElement(record);
		}
		return kept;
	};

	return { make, reconcile, removeElement, recordOf: (value) => owner.get(value) };
}
