// frozen - what every answer is held to ("What is returned"): frozen to its depth, down to but not into
// the application's own values it holds; and each record's keys in its written order.

/** True when the value and everything the scene made reachable from it is frozen; `callers` holds the application's own values, which are not entered. */
export function isFrozenToDepth(value, callers = new Set(), seen = new Set()) {
	if ((typeof value !== "object" || value === null) && typeof value !== "function") return true;
	if (callers.has(value) || seen.has(value)) return true;
	seen.add(value);
	if (!Object.isFrozen(value)) return false;
	for (const key of Reflect.ownKeys(value)) {
		const d = Object.getOwnPropertyDescriptor(value, key);
		if ("value" in d && !isFrozenToDepth(d.value, callers, seen)) return false;
		if ("get" in d && d.get !== undefined && !Object.isFrozen(d.get)) return false;
	}
	return true;
}

/** True when the value holds -0 anywhere the scene made; `callers` are not entered. */
export function holdsNegativeZero(value, callers = new Set(), seen = new Set()) {
	if (Object.is(value, -0)) return true;
	if (typeof value !== "object" || value === null || callers.has(value) || seen.has(value)) return false;
	seen.add(value);
	return Object.values(value).some((v) => holdsNegativeZero(v, callers, seen));
}

/** A value as JSON, -0 and BigInt told apart, for a diagnostic. */
export const describe = (value) => JSON.stringify(value, (k, v) => (Object.is(v, -0) ? "-0" : typeof v === "bigint" ? `${v}n` : typeof v === "function" ? `[function ${v.name}]` : v));
