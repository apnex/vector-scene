/**
 * A scene's declaration, read and judged (CONTRACT.md, VS2 rule 2 and VS3): every problem it has, each at
 * its pointer, or the root's members and the layers a scene is opened from.
 *
 * The declaration is read breadth first, as input-binding reads one: its prototype, its own keys, the
 * descriptors of root and layers its own keys hold, in that order -- never a getter of it, an inherited
 * property absent, a symbol-named property ignored, a key whose descriptor reads undefined absent, and a
 * reflection that throws refusing the whole declaration, nothing further read. Then, when root's
 * descriptor holds an object, its ownerDocument, that document's createElementNS, and its own appendChild
 * and getScreenCTM, each through ordinary property access and judged as read, the reading of root stopping
 * at the first refused. Then layers, as an array is read, and each layer in index order, read whole before
 * the next: its prototype, its own keys, the descriptors of name, attrs and foreign its own keys hold, and,
 * unless it is refused at its own pointer, the values those held, attrs as an attribute record is read.
 * Nothing here calls a platform method.
 */
import { childPointer, notAnObject, ProblemList } from "./declaration-problems.js";
import { dataValue, judgeArray, judgeRecord } from "./reflection.js";
import { readAttributeRecord } from "./shape-reading.js";
import type { OpenSceneResult } from "./types.js";

/** A platform method as read when the scene opens: the function, called with its object as receiver every time. */
export type PlatformMethod = (...args: unknown[]) => unknown;

/** The root and what the scene read of it as it opened (VS1). */
export interface PlatformRoot {
	readonly root: object;
	readonly rootDocument: object;
	readonly createElementNS: PlatformMethod;
	readonly appendChild: PlatformMethod;
	readonly getScreenCTM: PlatformMethod;
}

/** One layer as judged: its name, its attributes in order, and whether it is foreign. */
export interface JudgedLayer {
	readonly name: string;
	readonly attrs: readonly (readonly [string, string])[];
	readonly foreign: boolean;
}

/** A declaration with no problem: what a scene is opened from. */
export interface JudgedDeclaration {
	readonly ok: true;
	readonly platform: PlatformRoot | null;
	readonly layers: readonly JudgedLayer[];
}

const DECLARATION_FORM: readonly string[] = ["root", "layers"];
const LAYER_FORM: readonly string[] = ["name", "attrs", "foreign"];

/** An object is a non-null value whose typeof is 'object', so a function never is one. */
const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;
const isFunction = (value: unknown): value is PlatformMethod => typeof value === "function";

/** One member of a platform object, read through ordinary property access; not read when the read throws. */
function readMember(object: object, name: string): { readonly read: true; readonly value: unknown } | { readonly read: false } {
	try {
		return { read: true, value: (object as Record<string, unknown>)[name] };
	} catch {
		return { read: false };
	}
}

/** VS2 rule 2: the root's members, each judged as read; null at the first refused, nothing after it read. */
function readRoot(root: object): PlatformRoot | null {
	const ownerDocument = readMember(root, "ownerDocument");
	if (!ownerDocument.read || !isObject(ownerDocument.value)) return null;
	const rootDocument = ownerDocument.value;
	const createElementNS = readMember(rootDocument, "createElementNS");
	if (!createElementNS.read || !isFunction(createElementNS.value)) return null;
	const appendChild = readMember(root, "appendChild");
	if (!appendChild.read || !isFunction(appendChild.value)) return null;
	const getScreenCTM = readMember(root, "getScreenCTM");
	if (!getScreenCTM.read || !isFunction(getScreenCTM.value)) return null;
	return { root, rootDocument, createElementNS: createElementNS.value, appendChild: appendChild.value, getScreenCTM: getScreenCTM.value };
}

/** VS2 rule 2 and VS3: every problem a declaration has, or what a scene is opened from. Never throws. */
export function judgeDeclaration(declaration: unknown): JudgedDeclaration | { readonly ok: false; readonly refusal: OpenSceneResult } {
	// step 1: a plain object, its prototype, own keys and descriptors read, or not-an-object at "" and nothing further read
	const top = judgeRecord(declaration, DECLARATION_FORM);
	if (top.refused !== false) return { ok: false, refusal: notAnObject() };

	const problems = new ProblemList();
	// step 2
	for (const name of top.unknown) problems.add(childPointer("", name), "unknown-property");
	if (!top.properties.has("layers")) problems.add("/layers", "missing-property");

	// step 3: the root, read when its descriptor holds an object
	let platform: PlatformRoot | null = null;
	const rootProperty = top.properties.get("root");
	if (rootProperty !== undefined) {
		const root = dataValue(rootProperty);
		const read = rootProperty.data && isObject(root) ? readRoot(root) : null;
		if (read === null) problems.add("/root", "invalid-value");
		else platform = read;
	}

	// step 4: the layers, as an array is read, and not empty
	const layers: JudgedLayer[] = [];
	const layersProperty = top.properties.get("layers");
	if (layersProperty !== undefined) {
		const judged = layersProperty.data ? judgeArray(layersProperty.value) : null;
		if (judged === null || judged.refused !== false || judged.elements.length === 0) problems.add("/layers", "invalid-value");
		else {
			const names: { readonly name: string; readonly pointer: string }[] = [];
			judged.elements.forEach((element, index) => {
				const pointer = childPointer("/layers", index);
				// step 5: the layer itself
				const record = judgeRecord(element, LAYER_FORM);
				if (record.refused !== false) {
					problems.add(pointer, "not-an-object");
					return;
				}
				for (const name of record.unknown) problems.add(childPointer(pointer, name), "unknown-property");
				if (!record.properties.has("name")) problems.add(childPointer(pointer, "name"), "missing-property");
				// step 6: name
				let name: string | null = null;
				const nameProperty = record.properties.get("name");
				if (nameProperty !== undefined) {
					const value = dataValue(nameProperty);
					if (nameProperty.data && typeof value === "string" && value.length > 0) {
						name = value;
						names.push({ name, pointer: childPointer(pointer, "name") });
					} else problems.add(childPointer(pointer, "name"), "invalid-value");
				}
				// step 7: attrs, an attribute record
				let attrs: readonly (readonly [string, string])[] = [];
				const attrsProperty = record.properties.get("attrs");
				if (attrsProperty !== undefined) {
					if (!attrsProperty.data) problems.add(childPointer(pointer, "attrs"), "not-an-object");
					else {
						const reading = readAttributeRecord(attrsProperty.value);
						if (reading.ok) attrs = reading.entries;
						else problems.add(childPointer(pointer, "attrs"), reading.kind);
					}
				}
				// step 6: foreign
				let foreign = false;
				const foreignProperty = record.properties.get("foreign");
				if (foreignProperty !== undefined) {
					const value = dataValue(foreignProperty);
					if (foreignProperty.data && typeof value === "boolean") foreign = value;
					else problems.add(childPointer(pointer, "foreign"), "invalid-value");
				}
				if (name !== null) layers.push({ name, attrs, foreign });
			});
			// step 8: a valid name equal to an earlier one
			const seen = new Set<string>();
			for (const { name, pointer } of names) {
				if (seen.has(name)) problems.add(pointer, "duplicate-name");
				else seen.add(name);
			}
		}
	}

	if (problems.size > 0) return { ok: false, refusal: problems.refusal() };
	return { ok: true, platform, layers };
}
