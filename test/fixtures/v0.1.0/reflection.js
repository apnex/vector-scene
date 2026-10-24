/**
 * Judging a value at its own pointer, as input-binding's IB2 reads one and VS2 rule 1 adopts it
 * (CONTRACT.md, VS2).
 *
 * Every reflection is guarded: a value whose reflection throws -- a revoked or trapping Proxy, a throwing
 * trap -- is of no form, never an exception. A value is judged by the reflections that decide its own
 * form, in a fixed order, and the reading stops at the first that refuses it, so nothing beneath a value
 * refused at its pointer is read. No getter is ever called here: properties are read by descriptor.
 *
 * A key Reflect.ownKeys lists is judged by what IB2's order reads of it. Where the order reads its
 * descriptor -- a property a form names, an array's index -- a descriptor that reads undefined, which only
 * a Proxy can give, makes the key absent. Where the order reads no descriptor -- a property a form does not
 * name, a key of an array that is no index -- the key is known by its key alone (rule 8).
 *
 * A plain object is a value whose prototype is Object.prototype or null. An array is a value for which
 * Array.isArray is true and whose prototype is Array.prototype, dense -- every index from 0 to
 * length - 1 an own data property -- and holding no own string-named property but those indices and
 * length. A symbol-named property is ignored everywhere.
 */
const OF_ANOTHER_KIND = { refused: "kind" };
const CANONICAL_INDEX = /^(?:0|[1-9][0-9]*)$/;
/** The greatest array index plus one: an array index is a canonical integer string below 2^32 - 1, so "4294967295" is not one. */
const INDEX_LIMIT = 2 ** 32 - 1;
/** True when a key is an array index: a canonical non-negative integer string whose value is below 2^32 - 1. */
const isArrayIndex = (key) => CANONICAL_INDEX.test(key) && Number(key) < INDEX_LIMIT;
/** The value a data property holds, or undefined for an accessor or an absent property. */
export const dataValue = (property) => (property !== undefined && property.data ? property.value : undefined);
/** A descriptor read as an own property; an undefined descriptor is an absent property. */
const asOwnProperty = (descriptor) => ("value" in descriptor ? { data: true, value: descriptor.value } : { data: false });
/**
 * Judges a plain object at its own pointer: its prototype, then its own keys, then the descriptor of each
 * property `named` lists that its own keys hold, in the order `named` gives. A key it holds that `named`
 * does not list is known by its key alone. Stops at the first reflection that refuses it.
 */
export function judgeRecord(value, named) {
    if (typeof value !== "object" || value === null)
        return OF_ANOTHER_KIND;
    let keys;
    try {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null)
            return OF_ANOTHER_KIND;
        keys = Reflect.ownKeys(value);
    }
    catch (error) {
        return { refused: "thrown", error };
    }
    const held = new Set();
    const unknown = [];
    for (const key of keys) {
        if (typeof key !== "string")
            continue;
        held.add(key);
        if (!named.includes(key))
            unknown.push(key);
    }
    const properties = new Map();
    for (const name of named) {
        if (!held.has(name))
            continue;
        let descriptor;
        try {
            descriptor = Reflect.getOwnPropertyDescriptor(value, name);
        }
        catch (error) {
            return { refused: "thrown", error };
        }
        if (descriptor !== undefined)
            properties.set(name, asOwnProperty(descriptor));
    }
    return { refused: false, properties, unknown };
}
/**
 * Judges an array at its own pointer: Array.isArray first, then its prototype, its own keys, the
 * descriptor of its length and then of each index in order. Stops at the first reflection that refuses
 * it: an own string-named key that is neither length nor an index below it, a missing index, an accessor
 * element, or a reflection that throws.
 */
export function judgeArray(value) {
    if (typeof value !== "object" || value === null)
        return OF_ANOTHER_KIND;
    try {
        if (!Array.isArray(value))
            return OF_ANOTHER_KIND;
        if (Object.getPrototypeOf(value) !== Array.prototype)
            return OF_ANOTHER_KIND;
        const indices = [];
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== "string" || key === "length")
                continue;
            if (!isArrayIndex(key))
                return OF_ANOTHER_KIND;
            indices.push(Number(key));
        }
        const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, "length");
        if (lengthDescriptor === undefined || !("value" in lengthDescriptor))
            return OF_ANOTHER_KIND;
        const length = lengthDescriptor.value;
        if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0)
            return OF_ANOTHER_KIND;
        if (indices.length !== length || indices.some((index) => index >= length))
            return OF_ANOTHER_KIND;
        const elements = [];
        for (let index = 0; index < length; index++) {
            const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
            if (descriptor === undefined || !("value" in descriptor))
                return OF_ANOTHER_KIND;
            elements.push(descriptor.value);
        }
        return { refused: false, elements };
    }
    catch (error) {
        return { refused: "thrown", error };
    }
}
//# sourceMappingURL=reflection.js.map