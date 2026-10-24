/**
 * Reading the arguments of every function but openScene (CONTRACT.md, "Errors" and VS2 rules 1 and 3).
 *
 * Each argument is read once, in its function's order, each read judged as it is made, and the first that
 * is malformed throws a TypeError whose message begins with the function's name and a colon, reading
 * nothing after it. A record and an array are read as input-binding reads one, by descriptor, so no getter
 * of them runs; a reflection a Proxy's trap makes throw is rethrown as the function's own TypeError, the
 * thrown value named by its typeof alone, so none of its own code runs after the point of refusal.
 */
import { judgeArray } from "./reflection.js";
/**
 * The name of a value a getter or a trap threw, made from its typeof alone for an object or a function:
 * reading its message, its prototype or its string form could run its getters, its traps or its
 * toString, the application's code, after the argument was refused.
 */
export function nameOfThrown(thrown) {
    if (typeof thrown === "object" && thrown !== null)
        return "an object";
    if (typeof thrown === "function")
        return "a function";
    return String(thrown);
}
/** A TypeError whose message begins with the function's name and a colon. */
export function malformed(fn, what) {
    return new TypeError(`${fn}: ${what}`);
}
/** The TypeError for a value whose reading threw. */
export function unreadable(fn, label, thrown) {
    return malformed(fn, `${label} could not be read: ${nameOfThrown(thrown)}`);
}
/** VS2 rule 6 and IC2 rule 5: an object is a non-null value whose typeof is 'object', so a function never is one. */
export const isObject = (value) => typeof value === "object" && value !== null;
/** A function is a value whose typeof is 'function'. */
export const isFunction = (value) => typeof value === "function";
/**
 * A plain object holding only the properties `named` lists, read by descriptor: its prototype, then its own
 * keys -- a string-named key `named` does not list refusing it there -- then the descriptor of each named
 * property its own keys hold, in `named`'s order, an accessor or a value present as undefined refusing it,
 * and a key whose descriptor reads undefined absent. Answers the values present, by name.
 */
export function readRecordArgument(fn, value, named, label) {
    if (!isObject(value))
        throw malformed(fn, `${label} must be a plain object`);
    let proto;
    let keys;
    try {
        proto = Object.getPrototypeOf(value);
    }
    catch (error) {
        throw unreadable(fn, label, error);
    }
    if (proto !== Object.prototype && proto !== null)
        throw malformed(fn, `${label} must be a plain object, its prototype Object.prototype or null`);
    try {
        keys = Reflect.ownKeys(value);
    }
    catch (error) {
        throw unreadable(fn, label, error);
    }
    const held = new Set();
    for (const key of keys) {
        if (typeof key !== "string")
            continue;
        if (!named.includes(key))
            throw malformed(fn, `${label} holds ${JSON.stringify(key)}, which is not ${named.join(", ")}`);
        held.add(key);
    }
    const present = new Map();
    for (const name of named) {
        if (!held.has(name))
            continue;
        let descriptor;
        try {
            descriptor = Reflect.getOwnPropertyDescriptor(value, name);
        }
        catch (error) {
            throw unreadable(fn, label, error);
        }
        // a key its own keys list whose descriptor reads undefined -- which only a Proxy can give -- is absent
        if (descriptor === undefined)
            continue;
        if (!("value" in descriptor))
            throw malformed(fn, `${label}'s ${name} must be an own data property, not an accessor`);
        if (descriptor.value === undefined)
            throw malformed(fn, `${label}'s ${name} is present as undefined, which no form admits`);
        present.set(name, descriptor.value);
    }
    return present;
}
/** An array argument, read as VS2 rule 1 reads one: Array.isArray, its prototype, its own keys, its length's descriptor and its elements' in index order. */
export function readArrayArgument(fn, value, label) {
    const judged = judgeArray(value);
    if (judged.refused === false)
        return judged.elements;
    if (judged.refused === "thrown")
        throw unreadable(fn, label, judged.error);
    throw malformed(fn, `${label} must be a dense array of Array.prototype, holding no own property but its indices and length`);
}
//# sourceMappingURL=argument-reading.js.map