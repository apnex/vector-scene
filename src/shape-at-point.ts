/**
 * The shape at a screen point, by the platform's own hit test (CONTRACT.md, VS12).
 *
 * The root's document's elementsFromPoint, read as the scene opened, is called with the document as its
 * receiver and the point's x and y. Its answer is refused unless Array.isArray accepts it; then its length
 * is read once, through ordinary property access, and refused unless a safe non-negative integer; then the
 * indices from 0 below it are read in order, through ordinary property access, stopping at the first
 * element the scene made for a shape of an item it still holds, which the scene knows by the element's
 * identity alone. Every other element -- one made for an item since removed, the root, a layer's element, a
 * foreign layer's content, anything else on the page -- is passed over, and nothing of any element is read.
 * Each refusal is an Error of the base constructor; an error the platform or a getter throws propagates
 * unchanged.
 */
import { isObject } from "./argument-reading.js";
import type { PlatformMethod } from "./declaration-reading.js";

/** The answer's length and indices, read through ordinary property access. */
interface ReadableAnswer {
	readonly length?: unknown;
	readonly [index: number]: unknown;
}

/**
 * VS12 steps 3 and 4: the record `recordOf` answers for the first element of the platform's hit stack at the
 * point that it answers any record for, or undefined when none does.
 */
export function firstHeldAtPoint<R>(fn: string, rootDocument: object, elementsFromPoint: PlatformMethod, point: { readonly x: number; readonly y: number }, recordOf: (element: object) => R | undefined): R | undefined {
	const answer: unknown = Reflect.apply(elementsFromPoint, rootDocument, [point.x, point.y]);
	if (!Array.isArray(answer)) throw new Error(`${fn}: the root's document's elementsFromPoint answered no array`);
	const length: unknown = (answer as ReadableAnswer).length;
	if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) throw new Error(`${fn}: the hit stack's length is not a safe non-negative integer`);
	for (let index = 0; index < length; index++) {
		const element: unknown = (answer as ReadableAnswer)[index];
		if (!isObject(element) && typeof element !== "function") continue;
		const record = recordOf(element);
		if (record !== undefined) return record;
	}
	return undefined;
}
