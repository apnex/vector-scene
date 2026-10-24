/**
 * Converting points between the screen and drawing coordinates (CONTRACT.md, VS10).
 *
 * A point is judged by typeof, its x and then its y read through ordinary property access, both before
 * either is judged, and refused -- the function's TypeError -- unless both are finite numbers. Once the
 * scene's state is judged, the root's getScreenCTM, read as the scene opened, is called with the root as its
 * receiver; for toDrawing the answer's inverse is read, refused unless a function, and called with the
 * answer as its receiver; a, b, c, d, e and f of the transform used are read in order, all before any is
 * judged; and the answer is the frozen point { x: a * x + c * y + e, y: b * x + d * y + f }, each evaluated
 * left to right in binary64 -- the arithmetic of DOMPoint's matrixTransform for a two-dimensional matrix.
 * Each refusal after the point is an Error of the base constructor; an error the platform throws propagates
 * unchanged, and leaves the scene as it was.
 */
import { isFunction, isObject, malformed, unreadable } from "./argument-reading.js";
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
/** VS10 step 1 and VS2 rule 6: the point's x then y, both read before either is judged, or the function's TypeError. */
export function readPoint(fn, value) {
    if (!isObject(value))
        throw malformed(fn, "the point must be a non-null object, not a function, with finite numbers x and y");
    let x, y;
    try {
        x = value.x;
        y = value.y;
    }
    catch (error) {
        throw unreadable(fn, "the point", error);
    }
    if (!isFiniteNumber(x) || !isFiniteNumber(y))
        throw malformed(fn, "the point must hold finite numbers x and y");
    return { x, y };
}
/** VS10 steps 3 to 6: the point converted through the root's screen transform, or its inverse for toDrawing. */
export function convertPoint(fn, platform, point, inverted) {
    let transform = Reflect.apply(platform.getScreenCTM, platform.root, []);
    if (!isObject(transform))
        throw new Error(`${fn}: the root answers no screen transform`);
    if (inverted) {
        const inverse = transform.inverse;
        if (!isFunction(inverse))
            throw new Error(`${fn}: the screen transform's inverse is not a function`);
        transform = Reflect.apply(inverse, transform, []);
        if (!isObject(transform))
            throw new Error(`${fn}: the screen transform's inverse answered no transform`);
    }
    const used = transform;
    const a = used.a;
    const b = used.b;
    const c = used.c;
    const d = used.d;
    const e = used.e;
    const f = used.f;
    if (!isFiniteNumber(a) || !isFiniteNumber(b) || !isFiniteNumber(c) || !isFiniteNumber(d) || !isFiniteNumber(e) || !isFiniteNumber(f))
        throw new Error(`${fn}: the screen transform's a to f must be six finite numbers`);
    const x = a * point.x + c * point.y + e;
    const y = b * point.x + d * point.y + f;
    if (!isFiniteNumber(x) || !isFiniteNumber(y))
        throw new Error(`${fn}: the converted point is not finite`);
    return Object.freeze({ x, y });
}
//# sourceMappingURL=conversion.js.map