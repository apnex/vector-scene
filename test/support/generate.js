// generate - seeded random shapes and sequences of puts, moves and removals (CONTRACT.md I4, I6), so a failure
// reproduces; VECTOR_SCENE_SEED changes the seed.

/** A seeded random source in [0, 1) (xorshift128+). */
export function seededRandom(seed = Number(process.env.VECTOR_SCENE_SEED ?? 20261023)) {
	let s0 = BigInt(seed) | 1n, s1 = 0x9e3779b97f4a7c15n;
	const mask = (1n << 64n) - 1n;
	return () => {
		let x = s0;
		const y = s1;
		s0 = y;
		x = (x ^ (x << 23n)) & mask;
		s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n);
		return Number(((s1 + y) & mask) >> 11n) / 2 ** 53;
	};
}

/** Helpers over a random source. */
export function randomTools(rnd) {
	const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
	const pick = (list) => list[Math.floor(rnd() * list.length)];
	const chance = (p) => rnd() < p;
	return { int, pick, chance };
}

const TAGS = ["g", "rect", "text", "circle", "path"];
const NAMES = ["id", "class", "x", "y", "fill", "d", "data-k", "stroke"];
const VALUES = ["a", "b", "0", "1", 1, 2.5, -0, "", "M0 0"];
const TEXTS = ["", "", "hi", "ho", "x"];

/** A random shape at a depth, its tags, attributes, text and children drawn from small sets so puts often keep, patch and replace. */
export function randomShape(rnd, depth = 1) {
	const { int, pick, chance } = randomTools(rnd);
	const shape = { tag: pick(TAGS) };
	if (chance(0.8)) {
		const attrs = {};
		for (let i = int(0, 3); i > 0; i--) attrs[pick(NAMES)] = pick(VALUES);
		shape.attrs = attrs;
	}
	const content = depth < 4 ? int(0, 3) : int(0, 1);
	if (content === 1) shape.text = pick(TEXTS);
	else if (content >= 2) shape.children = Array.from({ length: int(0, 3) }, () => randomShape(rnd, depth + 1));
	return shape;
}

/** An item's random shapes: one to three. */
export const randomShapes = (rnd) => Array.from({ length: randomTools(rnd).int(1, 3) }, () => randomShape(rnd));

/**
 * A random operation on a layer whose keys are `keys`: a put of a new item or an existing one, placed
 * nowhere, last, or before another item; or a removal, of an item held or of a key no item holds.
 */
export function randomOperation(rnd, keys) {
	const { int, pick, chance } = randomTools(rnd);
	if (keys.length > 0 && chance(0.2)) return { kind: "remove", key: chance(0.9) ? pick(keys) : `gone${int(0, 9)}` };
	const key = keys.length > 0 && chance(0.6) ? pick(keys) : `k${int(0, 9)}`;
	const others = keys.filter((other) => other !== key);
	let place;
	const choice = int(0, 4);
	if (choice === 1) place = {};
	else if (choice === 2) place = { before: null };
	else if (choice >= 3 && others.length > 0) place = { before: pick(others) };
	return { kind: "put", key, shapes: randomShapes(rnd), place };
}
