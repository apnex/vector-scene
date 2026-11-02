/**
 * The scene's view (CONTRACT.md, VS14 to VS17): the drawing point at the root's top-left corner and the root's
 * own units per drawing unit, written as one transform on every layer's element.
 *
 * A view handed to setView is read as VS2 rule 1 reads a value -- a plain object of exactly x, y and scale, own
 * data properties, each a finite number and scale above 0 -- judged as each is read, the first malformed
 * throwing the function's TypeError with nothing after it read. Its transform's members, s, -s * x and -s * y,
 * are computed once each in binary64 and judged against the range the scene supports: scale from 2^-16 to
 * 2^16 and each member's magnitude at most 2^24, where single precision, in which the platform holds a
 * transform, still holds what is written. What visible() answers is judged here too, apart from how it is
 * read, so its far edges can be judged on rectangles no view within the range reaches.
 */
import { isObject, malformed, unreadable } from "./argument-reading.js";
import type { SceneView, SceneVisible } from "./types.js";

/** The least and the greatest scale the scene writes (VS14). */
export const SCALE_LEAST = 2 ** -16;
export const SCALE_GREATEST = 2 ** 16;

/** The greatest magnitude of a transform member the scene writes (VS14). */
export const MEMBER_GREATEST = 2 ** 24;

/** The view a viewed scene opens at (VS14): a fresh frozen record each call, so each scene's opening view is its own. */
export function openingView(): SceneView {
	return Object.freeze({ x: 0, y: 0, scale: 1 });
}

const VIEW_FORM: readonly string[] = ["x", "y", "scale"];

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * VS14 and VS2 rule 1: a view as setView reads one -- its prototype, its own keys, then each of x, y and scale
 * in that order, its descriptor read and judged before the next is read; or the function's TypeError.
 */
export function readView(fn: string, value: unknown): { readonly x: number; readonly y: number; readonly scale: number } {
	const label = "the view";
	if (!isObject(value)) throw malformed(fn, `${label} must be a plain object of finite numbers x, y and scale`);
	let proto: unknown;
	let keys: (string | symbol)[];
	try {
		proto = Object.getPrototypeOf(value);
	} catch (error) {
		throw unreadable(fn, label, error);
	}
	if (proto !== Object.prototype && proto !== null) throw malformed(fn, `${label} must be a plain object, its prototype Object.prototype or null`);
	try {
		keys = Reflect.ownKeys(value);
	} catch (error) {
		throw unreadable(fn, label, error);
	}
	const held = new Set<string>();
	for (const key of keys) {
		if (typeof key !== "string") continue;
		if (!VIEW_FORM.includes(key)) throw malformed(fn, `${label} holds ${JSON.stringify(key)}, which is not x, y or scale`);
		held.add(key);
	}
	const read = new Map<string, number>();
	for (const name of VIEW_FORM) {
		let descriptor: PropertyDescriptor | undefined;
		if (held.has(name)) {
			try {
				descriptor = Reflect.getOwnPropertyDescriptor(value, name);
			} catch (error) {
				throw unreadable(fn, label, error);
			}
		}
		// a key its own keys list whose descriptor reads undefined -- which only a Proxy can give -- is absent
		if (descriptor === undefined) throw malformed(fn, `${label} holds no ${name}; it is exactly x, y and scale`);
		if (!("value" in descriptor)) throw malformed(fn, `${label}'s ${name} must be an own data property, not an accessor`);
		const member: unknown = descriptor.value;
		if (!isFiniteNumber(member)) throw malformed(fn, `${label}'s ${name} must be a finite number`);
		if (name === "scale" && !(member > 0)) throw malformed(fn, `${label}'s scale must be above 0`);
		read.set(name, member);
	}
	return { x: read.get("x") as number, y: read.get("y") as number, scale: read.get("scale") as number };
}

/** VS14: the transform's members, s, -s * x and -s * y, each computed once in binary64. */
export function transformMembers(view: { readonly x: number; readonly y: number; readonly scale: number }): { readonly s: number; readonly e: number; readonly f: number } {
	const s = view.scale;
	return { s, e: -s * view.x, f: -s * view.y };
}

/**
 * VS14: why a view cannot be written, or null when it can -- a member of the view, or of its transform, not
 * finite, or the view outside the range the scene supports: scale from 2^-16 to 2^16, and each member of the
 * transform of magnitude at most 2^24.
 */
export function unwritable(view: { readonly x: number; readonly y: number; readonly scale: number }): string | null {
	if (!isFiniteNumber(view.x) || !isFiniteNumber(view.y) || !isFiniteNumber(view.scale)) return "the view's x, y and scale must be finite numbers";
	const { s, e, f } = transformMembers(view);
	if (!isFiniteNumber(e) || !isFiniteNumber(f)) return `the view's transform members, ${String(s)}, ${String(e)} and ${String(f)}, must be finite`;
	if (!(s >= SCALE_LEAST && s <= SCALE_GREATEST)) return `the view's scale, ${String(s)}, lies outside the range the scene supports, 2^-16 to 2^16`;
	if (Math.abs(e) > MEMBER_GREATEST || Math.abs(f) > MEMBER_GREATEST) return `the view's transform members, ${String(e)} and ${String(f)}, must each be of magnitude at most 2^24`;
	return null;
}

/** VS14: the transform attribute's value, `matrix(s, 0, 0, s, -s * x, -s * y)`, each member written by String. */
export function transformText(view: { readonly x: number; readonly y: number; readonly scale: number }): string {
	const { s, e, f } = transformMembers(view);
	return `matrix(${String(s)}, 0, 0, ${String(s)}, ${String(e)}, ${String(f)})`;
}

/**
 * VS15: what visible() answers, `{ region: { kind: 'rect', x, y, w, h }, scale }` frozen to its depth, or Errors'
 * Error when a member is not finite, a far edge -- x + w or y + h, computed in binary64 -- is not finite, or
 * the scale is not above 0.
 */
export function visibleAnswer(fn: string, x: number, y: number, w: number, h: number, scale: number): SceneVisible {
	if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h) || !isFiniteNumber(scale)) throw new Error(`${fn}: the visible region's x, y, w, h and scale must be finite`);
	if (!isFiniteNumber(x + w) || !isFiniteNumber(y + h)) throw new Error(`${fn}: the visible region's far edges, x + w and y + h, must be finite`);
	if (!(scale > 0)) throw new Error(`${fn}: the screen pixels per drawing unit, ${String(scale)}, must be above 0`);
	return Object.freeze({ region: Object.freeze({ kind: "rect" as const, x, y, w, h }), scale });
}
