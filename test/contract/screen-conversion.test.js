// screen-conversion - VS10 (I9): where a screen point lies in drawing coordinates, and back, through the
// root's screen transform at the moment asked: the point read and refused first, then the scene's state,
// then the transform, its inverse for toDrawing, its six members read in order before any is judged, and
// DOMPoint's arithmetic for a two-dimensional matrix, each refusal after the point an Error, an error the
// platform throws let out unchanged, the scene still open.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openScene } from "@apnex/vector-scene";
import { fakeRoot, matrix } from "../support/fake-dom.js";
import { isFrozenToDepth } from "../support/frozen.js";
import { randomTools, seededRandom } from "../support/generate.js";
import { recorded } from "../support/recording-proxy.js";

const LAYERS = [{ name: "items" }];

/** A scene on a root whose getScreenCTM answers what `answer()` answers, called with the root as its receiver. */
function sceneAnswering(answer) {
	const platform = fakeRoot();
	const receivers = [];
	platform.root.getScreenCTM = function () {
		receivers.push(this);
		return answer();
	};
	const { scene } = openScene({ root: platform.root, layers: LAYERS });
	return { ...platform, scene, receivers };
}

/** DOMPoint's matrixTransform for a two-dimensional matrix, written as the spec writes it: x' = a*x + c*y + e, y' = b*x + d*y + f. */
const transformed = (m, { x, y }) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
/** The six numbers of a two-dimensional matrix's inverse, as a browser's DOMMatrix computes them. */
const inverted = ({ a, b, c, d, e, f }) => {
	const det = a * d - b * c;
	return { a: d / det, b: -b / det, c: -c / det, d: a / det, e: (c * f - d * e) / det, f: (b * e - a * f) / det };
};
const same = (actual, expected, label) => {
	assert.ok(Object.is(actual.x, expected.x) && Object.is(actual.y, expected.y), `${label}: ${actual.x},${actual.y} against ${expected.x},${expected.y}`);
};

test("VS10 step 6: toScreen answers a * x + c * y + e and b * x + d * y + f, left to right in binary64, over recorded transforms, -0 and extremes among them", () => {
	const transforms = [
		{ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
		{ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 },
		{ a: 0.8, b: 0, c: 0, d: 0.8, e: 113.5, f: 64.25 },
		{ a: 0.7071067811865476, b: 0.7071067811865475, c: -0.7071067811865475, d: 0.7071067811865476, e: 3, f: -4 },
		{ a: -0, b: -0, c: -0, d: -0, e: -0, f: -0 },
		{ a: 1, b: -0, c: -0, d: 1, e: -0, f: -0 },
		{ a: 1e308, b: 0, c: 0, d: 1e-308, e: 5e-324, f: -5e-324 },
		{ a: 9007199254740991, b: 1, c: 1, d: 9007199254740991, e: 0.1, f: 0.2 },
	];
	const points = [{ x: 0, y: 0 }, { x: -0, y: -0 }, { x: 1, y: 1 }, { x: 0.1, y: 0.2 }, { x: -1.5, y: 1e-300 }, { x: 5e-324, y: -5e-324 }, { x: 1, y: -0 }];
	let compared = 0;
	for (const ctm of transforms) {
		const { scene } = sceneAnswering(() => matrix(ctm));
		for (const point of points) {
			const expected = transformed(ctm, point);
			if (!Number.isFinite(expected.x) || !Number.isFinite(expected.y)) continue;
			same(scene.toScreen(point), expected, `${JSON.stringify(ctm)} ${point.x},${point.y}`);
			compared++;
		}
	}
	assert.ok(compared >= 50);
	const { scene } = sceneAnswering(() => matrix({ a: 1, b: 1, c: 1, d: 1, e: -0, f: -0 }));
	const kept = scene.toScreen({ x: -0, y: -0 });
	assert.ok(Object.is(kept.x, -0) && Object.is(kept.y, -0), "-0 + -0 + -0 is -0, kept, not normalised");
	const toZero = sceneAnswering(() => matrix({ a: 1, b: 1, c: 1, d: 1, e: 0, f: -0 })).scene.toScreen({ x: -0, y: -0 });
	assert.ok(Object.is(toZero.x, 0) && Object.is(toZero.y, -0), "-0 + -0 + 0 is 0");
});

test("VS10 step 4: toDrawing calls the transform's inverse with the transform as its receiver, and answers its arithmetic over what the inverse answers", () => {
	const rnd = seededRandom(3);
	const { int, chance } = randomTools(rnd);
	let compared = 0;
	for (let n = 0; n < 400; n++) {
		const scale = chance(0.5) ? rnd() * 4 + 0.01 : int(1, 8);
		const ctm = { a: scale, b: chance(0.3) ? rnd() - 0.5 : 0, c: chance(0.3) ? rnd() - 0.5 : 0, d: scale, e: rnd() * 2000 - 1000, f: rnd() * 2000 - 1000 };
		const { scene } = sceneAnswering(() => matrix(ctm));
		const point = { x: rnd() * 4000 - 2000, y: rnd() * 4000 - 2000 };
		same(scene.toDrawing(point), transformed(inverted(ctm), point), `toDrawing ${n}`);
		same(scene.toScreen(point), transformed(ctm, point), `toScreen ${n}`);
		compared += 2;
	}
	assert.equal(compared, 800);
	const receivers = [];
	const ctm = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
	const { scene, root, receivers: rootReceivers } = sceneAnswering(() => ({
		...ctm,
		inverse() {
			receivers.push(this);
			return { a: 7, b: 0, c: 0, d: 7, e: 1, f: 1 };
		},
	}));
	assert.deepEqual(scene.toDrawing({ x: 1, y: 2 }), { x: 8, y: 15 }, "the answer is the arithmetic of what inverse answers, never its own inverse");
	assert.equal(receivers.length, 1);
	assert.equal(receivers[0].a, 2, "inverse called with the transform as its receiver");
	assert.deepEqual(rootReceivers, [root], "getScreenCTM called with the root as its receiver, once");
});

test("VS10: each conversion asks the root's screen transform afresh, once, so it follows the transform at the moment asked", () => {
	const { scene, root, log } = sceneAnswering(() => matrix(root.ctm));
	void log;
	root.ctm = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
	assert.deepEqual(scene.toScreen({ x: 3, y: 4 }), { x: 3, y: 4 });
	root.ctm = { a: 2, b: 0, c: 0, d: 2, e: 1, f: 1 };
	assert.deepEqual(scene.toScreen({ x: 3, y: 4 }), { x: 7, y: 9 });
	assert.deepEqual(scene.toDrawing({ x: 7, y: 9 }), { x: 3, y: 4 });
	const answer = scene.toDrawing({ x: 7, y: 9 });
	assert.ok(isFrozenToDepth(answer));
	assert.deepEqual(Object.keys(answer), ["x", "y"]);
	assert.notEqual(scene.toDrawing({ x: 7, y: 9 }), answer, "made afresh");
});

test("VS10 step 1, VS2 rule 6, I9: a point that is no object or holds a non-finite coordinate is the TypeError; x then y read by ordinary property access, both before either is judged", () => {
	const { scene, log } = sceneAnswering(() => matrix({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }));
	for (const fn of ["toDrawing", "toScreen"]) {
		const bad = [undefined, null, 5, "1,2", () => 0, Object.assign(() => 0, { x: 1, y: 2 }), {}, { x: 1 }, { y: 1 }, { x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: -Infinity, y: 0 }, { x: "1", y: 2 }, { x: 1n, y: 2 }, { x: null, y: 0 }, { x: new Number(1), y: 2 }];
		for (const point of bad) assert.throws(() => scene[fn](point), (e) => e.constructor === TypeError && e.message.startsWith(`${fn}: `), `${fn} ${String(point?.x)}`);
		const order = [];
		assert.throws(() => scene[fn](recorded({ x: NaN, y: 1 }, "point", order)), /^TypeError/);
		assert.deepEqual(order, ["point get x", "point get y"], "y read though x is refused");
		class Point {
			get x() {
				return 3;
			}
			get y() {
				return 4;
			}
		}
		assert.deepEqual(scene[fn](new Point()), { x: 3, y: 4 }, "a getter-backed point, as DOMPoint's");
		assert.deepEqual(scene[fn](Object.create({ x: 1, y: 2 })), { x: 1, y: 2 }, "inherited members read");
	}
	log.length = 0;
	assert.throws(() => scene.toDrawing({ x: NaN, y: 0 }), TypeError);
	assert.deepEqual(log, [], "a refused point asks no transform");
});

test("Errors, I9: a point read through a throwing getter is rethrown as the function's TypeError, the thrown value named by its typeof alone", () => {
	const { scene } = sceneAnswering(() => matrix({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }));
	const throwing = (thrown, at = "x") => Object.defineProperty({ x: 1, y: 1 }, at, {
		get() {
			throw thrown;
		},
	});
	const hostile = { get message() { return assert.fail("the thrown object's message was read"); }, toString: () => assert.fail("its toString ran") };
	const named = [[new Error("boom"), "an object"], [hostile, "an object"], [() => 0, "a function"], ["text", "text"], [42, "42"], [undefined, "undefined"], [Symbol.iterator, "Symbol(Symbol.iterator)"]];
	for (const fn of ["toDrawing", "toScreen"]) {
		for (const [thrown, name] of named) {
			assert.throws(() => scene[fn](throwing(thrown)), (e) => e.constructor === TypeError && e.message.startsWith(`${fn}: `) && e.message.endsWith(`: ${name}`), `${fn} ${name}`);
		}
		assert.throws(() => scene[fn](throwing(new Error("y"), "y")), (e) => e.constructor === TypeError && e.message.startsWith(`${fn}: `));
	}
});

test("VS10 steps 3 to 5, I9: no transform, an inverse that is no function or answers no object, and a member not a finite number are refused with Error, all six read before any is judged", () => {
	const point = { x: 1, y: 2 };
	const good = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
	const noTransform = [null, undefined, 5, "matrix", () => good, Symbol("m")];
	for (const answer of noTransform) {
		const { scene } = sceneAnswering(() => answer);
		for (const fn of ["toDrawing", "toScreen"]) assert.throws(() => scene[fn](point), (e) => e.constructor === Error && e.message.startsWith(`${fn}: `), `${fn} ${String(answer)}`);
	}
	for (const inverse of [undefined, null, 5, {}, "inverse"]) {
		const { scene } = sceneAnswering(() => ({ ...good, inverse }));
		assert.throws(() => scene.toDrawing(point), (e) => e.constructor === Error && e.message.startsWith("toDrawing: "));
		assert.deepEqual(scene.toScreen(point), point, "toScreen never reads inverse");
	}
	for (const answered of [null, undefined, 1, "m", () => good]) {
		const { scene } = sceneAnswering(() => ({ ...good, inverse: () => answered }));
		assert.throws(() => scene.toDrawing(point), (e) => e.constructor === Error && e.message.startsWith("toDrawing: "), `inverse answering ${String(answered)}`);
	}
	for (const member of ["a", "b", "c", "d", "e", "f"]) {
		for (const value of ["1", NaN, Infinity, -Infinity, undefined, null, 1n, new Number(1)]) {
			const { scene } = sceneAnswering(() => ({ ...good, [member]: value }));
			assert.throws(() => scene.toScreen(point), (e) => e.constructor === Error && e.message.startsWith("toScreen: "), `${member} ${String(value)}`);
			const inverse = sceneAnswering(() => ({ ...good, inverse: () => ({ ...good, [member]: value }) })).scene;
			assert.throws(() => inverse.toDrawing(point), (e) => e.constructor === Error && e.message.startsWith("toDrawing: "));
		}
	}
	const singular = sceneAnswering(() => matrix({ a: 0, b: 0, c: 0, d: 0, e: 5, f: 5 })).scene;
	assert.throws(() => singular.toDrawing(point), (e) => e.constructor === Error && e.message.startsWith("toDrawing: "), "the NaN members a singular DOMMatrix inverse answers");
	const order = [];
	const { scene } = sceneAnswering(() => recorded({ a: "1", b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => good }, "ctm", order));
	assert.throws(() => scene.toScreen(point), Error);
	assert.deepEqual(order, ["ctm get a", "ctm get b", "ctm get c", "ctm get d", "ctm get e", "ctm get f"], "all six read, in order, before a is judged");
	order.length = 0;
	const inverseOrder = sceneAnswering(() => recorded({ ...good, inverse: () => recorded({ ...good }, "inv", order) }, "ctm", order)).scene;
	inverseOrder.toDrawing(point);
	assert.deepEqual(order, ["ctm get inverse", "inv get a", "inv get b", "inv get c", "inv get d", "inv get e", "inv get f"], "of the transform answered only inverse, of the inverse only a to f");
});

test("VS10 step 6, I9: an answer that overflows is refused with Error", () => {
	const { scene } = sceneAnswering(() => matrix({ a: 1e308, b: 0, c: 0, d: 1e308, e: 0, f: 0 }));
	assert.throws(() => scene.toScreen({ x: 10, y: 0 }), (e) => e.constructor === Error && e.message.startsWith("toScreen: "));
	assert.throws(() => scene.toScreen({ x: 0, y: 10 }), (e) => e.constructor === Error && e.message.startsWith("toScreen: "));
	const cancelling = sceneAnswering(() => matrix({ a: 1e308, b: 0, c: 1e308, d: 1, e: -1e308, f: 0 })).scene;
	assert.throws(() => cancelling.toScreen({ x: 1, y: 1 }), (e) => e.constructor === Error, "evaluated left to right: (1e308 + 1e308) overflows before -1e308 is added");
	assert.deepEqual(scene.toScreen({ x: 1, y: 1 }), { x: 1e308, y: 1e308 });
});

test("Errors, I9: an error getScreenCTM, inverse or a member's getter throws propagates unchanged and leaves the scene open", () => {
	const point = { x: 1, y: 2 };
	const thrown = new Error("the platform throws");
	const throwingGetter = () => {
		throw thrown;
	};
	// each answer, and the conversions that reach its throw: toScreen never reads inverse, and toDrawing reads the members of what inverse answers
	const answers = [
		[() => throwingGetter(), ["toDrawing", "toScreen"]],
		[() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: throwingGetter }), ["toDrawing"]],
		[() => Object.defineProperty({ a: 1, b: 0, c: 0, d: 1, e: 0 }, "f", { get: throwingGetter }), ["toScreen"]],
		[() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => Object.defineProperty({ a: 1, b: 0, c: 0, d: 1, e: 0 }, "f", { get: throwingGetter }) }), ["toDrawing"]],
		[() => Object.defineProperty({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, "inverse", { get: throwingGetter }), ["toDrawing"]],
	];
	for (const [answer, reaching] of answers) {
		const { scene, root } = sceneAnswering(answer);
		for (const fn of reaching) assert.throws(() => scene[fn](point), (e) => e === thrown, `${fn}: unchanged`);
		scene.put("items", "a", [{ tag: "g" }]);
		assert.equal(scene.items("items").length, 1, "the scene still open");
		assert.equal(root.children.length, 1);
	}
	const domException = Object.assign(new Error("Failed to execute 'inverse'"), { name: "InvalidStateError" });
	const { scene } = sceneAnswering(() => ({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, inverse: () => { throw domException; } }));
	assert.throws(() => scene.toDrawing(point), (e) => e === domException, "Chrome's SVGMatrix throws InvalidStateError from inverse, which propagates");
});

test("VS10, VS2 rule 7: a call the transform's getters make on the scene takes effect, and the conversion answers from the transform it read", () => {
	let scene;
	const answer = () => ({
		get a() {
			scene.put("items", "from-a", [{ tag: "g" }]);
			return 2;
		},
		b: 0,
		c: 0,
		d: 2,
		e: 0,
		f: 0,
	});
	({ scene } = sceneAnswering(answer));
	assert.deepEqual(scene.toScreen({ x: 1, y: 1 }), { x: 2, y: 2 });
	assert.deepEqual(scene.items("items").map((item) => item.key), ["from-a"]);
	const closing = sceneAnswering(() => ({
		get a() {
			closing.scene.close();
			return 1;
		},
		b: 0,
		c: 0,
		d: 1,
		e: 0,
		f: 0,
	}));
	assert.deepEqual(closing.scene.toScreen({ x: 5, y: 6 }), { x: 5, y: 6 }, "answers from the transform it read, though a getter closed the scene");
	assert.throws(() => closing.scene.toScreen({ x: 5, y: 6 }), (e) => e.constructor === Error && e.message.startsWith("toScreen: "));
	const pointCloses = sceneAnswering(() => matrix({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }));
	const point = {
		x: 1,
		get y() {
			pointCloses.scene.close();
			return 1;
		},
	};
	assert.throws(() => pointCloses.scene.toDrawing(point), (e) => e.constructor === Error && e.message.startsWith("toDrawing: "), "the state judged after the point is read: a getter that closed the scene is seen");
});
