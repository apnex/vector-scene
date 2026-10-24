/**
 * Shapes and attribute records, read and judged (CONTRACT.md, VS2 rules 4 and 5, and VS5).
 *
 * A shape at a depth is read thus: its depth judged first, so a shape nested deeper than 32 is refused with
 * nothing of it read; then its prototype; its own keys, any key but tag, attrs, text and children refusing
 * it; the descriptors of those four its own keys hold, in that order, each judged as read; tag absent, or
 * both text and children present, refusing it; and only then its values, in the same order -- tag, attrs
 * as an attribute record is read, text, and children as an array, each child read whole, at the next depth,
 * before the next.
 *
 * An attribute record is read thus: its prototype; its own keys; then each own string-named key in their
 * order -- its name judged, then its descriptor read and judged, then its value -- the reading stopping at
 * the first refused. A finite number is written as String writes it, so -0 is written "0".
 *
 * What a put keeps of its shapes is a tree of its own (Spec), from which its frozen description is made: the
 * scene compares, writes and answers from these, never from the application's values again.
 */
import { malformed, readArrayArgument, readRecordArgument, unreadable } from "./argument-reading.js";
/** The deepest a shape may nest, an item's own shapes at depth 1 (VS5). */
export const DEEPEST = 32;
/** VS5: a tag is an ASCII letter followed by ASCII letters, digits and hyphens. */
const TAG = /^[A-Za-z][A-Za-z0-9-]*$/;
/** VS5: an attribute's name is an ASCII letter or underscore followed by ASCII letters, digits, underscores, periods and hyphens... */
const ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
/** ...not beginning with "on" in any case, since a description is data and an event handler is code. */
const EVENT_HANDLER = /^on/i;
const SHAPE_FORM = ["tag", "attrs", "text", "children"];
/** True when a name is an attribute name VS5 admits. */
export const isAttributeName = (name) => ATTRIBUTE_NAME.test(name) && !EVENT_HANDLER.test(name);
/** VS2 rule 5: an attribute record, read and judged; never throws. */
export function readAttributeRecord(value) {
    const notAnObject = (why) => ({ ok: false, kind: "not-an-object", why, threw: false });
    const threw = (thrown) => ({ ok: false, kind: "not-an-object", why: "could not be read", threw: true, thrown });
    const invalid = (why) => ({ ok: false, kind: "invalid-value", why, threw: false });
    if (typeof value !== "object" || value === null)
        return notAnObject("must be a plain object");
    let keys;
    try {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null)
            return notAnObject("must be a plain object, its prototype Object.prototype or null");
        keys = Reflect.ownKeys(value);
    }
    catch (error) {
        return threw(error);
    }
    const entries = [];
    for (const key of keys) {
        if (typeof key !== "string")
            continue;
        if (!isAttributeName(key))
            return invalid(`holds ${JSON.stringify(key)}, which is no attribute name: a letter or underscore, then letters, digits, underscores, periods and hyphens, not beginning "on"`);
        let descriptor;
        try {
            descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        }
        catch (error) {
            return threw(error);
        }
        // a key its own keys list whose descriptor reads undefined -- which only a Proxy can give -- is absent
        if (descriptor === undefined)
            continue;
        if (!("value" in descriptor))
            return invalid(`holds ${JSON.stringify(key)} as an accessor, not a data property`);
        const written = descriptor.value;
        if (typeof written === "string")
            entries.push([key, written]);
        else if (typeof written === "number" && Number.isFinite(written))
            entries.push([key, String(written)]);
        else
            return invalid(`holds ${JSON.stringify(key)} as neither a string nor a finite number`);
    }
    return { ok: true, entries };
}
/** An attribute record argument, read as VS2 rule 5 says, or the function's TypeError. */
function readAttributesArgument(fn, value, label) {
    const reading = readAttributeRecord(value);
    if (reading.ok)
        return reading.entries;
    if (reading.threw)
        throw unreadable(fn, label, reading.thrown);
    throw malformed(fn, `${label} ${reading.why}`);
}
/** A frozen plain object of the attributes, in their order; defined, never assigned, so a name such as __proto__ is an own property like any other. */
export function frozenAttributes(entries) {
    const attrs = {};
    for (const [name, written] of entries)
        Object.defineProperty(attrs, name, { value: written, enumerable: true, writable: true, configurable: true });
    return Object.freeze(attrs);
}
/** VS2 rule 4: one shape at a depth, read and judged, or the function's TypeError. */
function readShape(fn, value, depth, label) {
    if (depth > DEEPEST)
        throw malformed(fn, `${label} nests deeper than ${DEEPEST} shapes`);
    const present = readRecordArgument(fn, value, SHAPE_FORM, label);
    if (!present.has("tag"))
        throw malformed(fn, `${label} holds no tag`);
    if (present.has("text") && present.has("children"))
        throw malformed(fn, `${label} holds both text and children`);
    const tag = present.get("tag");
    if (typeof tag !== "string" || !TAG.test(tag))
        throw malformed(fn, `${label}'s tag must be an ASCII letter followed by ASCII letters, digits and hyphens`);
    const attrs = present.has("attrs") ? readAttributesArgument(fn, present.get("attrs"), `${label}.attrs`) : [];
    let text = "";
    if (present.has("text")) {
        const given = present.get("text");
        if (typeof given !== "string")
            throw malformed(fn, `${label}'s text must be a string`);
        text = given;
    }
    let kids = [];
    if (present.has("children")) {
        const list = readArrayArgument(fn, present.get("children"), `${label}.children`);
        const read = [];
        for (let index = 0; index < list.length; index++)
            read.push(readShape(fn, list[index], depth + 1, `${label}.children[${index}]`));
        kids = read;
    }
    return specOf(tag, attrs, text, kids);
}
/** A shape as the scene keeps it, with its frozen description: tag and attrs, then text when it has text or children when it has child shapes. */
function specOf(tag, attrs, text, kids) {
    const frozenAttrs = frozenAttributes(attrs);
    let described;
    if (text !== "")
        described = Object.freeze({ tag, attrs: frozenAttrs, text });
    else if (kids.length > 0)
        described = Object.freeze({ tag, attrs: frozenAttrs, children: Object.freeze(kids.map((kid) => kid.described)) });
    else
        described = Object.freeze({ tag, attrs: frozenAttrs });
    return Object.freeze({ tag, attrs: Object.freeze(attrs.map((entry) => Object.freeze([entry[0], entry[1]]))), attrMap: new Map(attrs), text, kids: Object.freeze([...kids]), described });
}
/** VS5 and VS2 rule 3: an item's shapes, an array of at least one shape, each read whole before the next, or the function's TypeError. */
export function readShapes(fn, value) {
    const list = readArrayArgument(fn, value, "shapes");
    if (list.length === 0)
        throw malformed(fn, "shapes must hold at least one shape");
    const specs = [];
    for (let index = 0; index < list.length; index++)
        specs.push(readShape(fn, list[index], 1, `shapes[${index}]`));
    return specs;
}
//# sourceMappingURL=shape-reading.js.map