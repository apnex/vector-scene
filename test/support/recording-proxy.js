// recording-proxy - a transparent Proxy that writes each trap it runs into a log, so a test can hold the
// exact order in which the scene reads a declaration, a shape, a place or a point (VS2, I5), and inject the
// application's code into a trap.

const TRAPS = ["getPrototypeOf", "setPrototypeOf", "isExtensible", "preventExtensions", "getOwnPropertyDescriptor", "defineProperty", "has", "get", "set", "deleteProperty", "ownKeys", "apply", "construct"];

const show = (key) => (typeof key === "symbol" ? key.toString() : key);

/**
 * A Proxy of `target` that logs `<label> <trap>[ <key>]` into `log` for every trap, then answers as the
 * target would -- or as `hooks[trap](target, ...args)` answers, when a hook is given for that trap.
 */
export function recorded(target, label, log, hooks = {}) {
	const handler = {};
	for (const trap of TRAPS) {
		handler[trap] = (t, ...args) => {
			const key = ["getOwnPropertyDescriptor", "defineProperty", "has", "get", "set", "deleteProperty"].includes(trap) ? ` ${show(args[0])}` : "";
			log.push(`${label} ${trap}${key}`);
			if (hooks[trap]) return hooks[trap](t, ...args);
			return Reflect[trap](t, ...args);
		};
	}
	return new Proxy(target, handler);
}

/** A Proxy whose `trap` throws, every other trap transparent. */
export function trapping(target, trap, message = `the ${trap} trap throws`) {
	return new Proxy(target, {
		[trap]() {
			throw new Error(message);
		},
	});
}

/** A revoked Proxy of a target: every reflection of it throws. */
export function revoked(target) {
	const { proxy, revoke } = Proxy.revocable(target, {});
	revoke();
	return proxy;
}

/** A Proxy whose own keys also list `phantoms`, keys whose descriptors read undefined: only a Proxy can make one. */
export function phantom(target, ...phantoms) {
	return new Proxy(target, {
		ownKeys(t) {
			return [...Reflect.ownKeys(t), ...phantoms];
		},
	});
}
