/**
 * The problem records of a refused declaration (CONTRACT.md, VS3): RFC 6901 pointers, and one order.
 */
import type { DeclarationProblem, DeclarationProblemCode, OpenSceneResult } from "./types.js";

/** A pointer to a member of the value a pointer names: "~" written "~0" and "/" written "~1". */
export function childPointer(parent: string, name: string | number): string {
	return `${parent}/${String(name).replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

/** Collects problems, then orders them by pointer and then by problem, by UTF-16 code unit, with no record twice. */
export class ProblemList {
	readonly #items: DeclarationProblem[] = [];

	add(pointer: string, problem: DeclarationProblemCode): void {
		this.#items.push({ pointer, problem });
	}

	get size(): number {
		return this.#items.length;
	}

	/** The refusal: a fresh, frozen `{ ok: false, problems }`, the list ordered, each record fresh and frozen. */
	refusal(): OpenSceneResult {
		const ordered = [...this.#items].sort((a, b) => (a.pointer < b.pointer ? -1 : a.pointer > b.pointer ? 1 : a.problem < b.problem ? -1 : a.problem > b.problem ? 1 : 0));
		const problems: DeclarationProblem[] = [];
		for (const p of ordered) {
			const last = problems[problems.length - 1];
			if (last !== undefined && last.pointer === p.pointer && last.problem === p.problem) continue;
			problems.push(Object.freeze({ pointer: p.pointer, problem: p.problem }));
		}
		return Object.freeze({ ok: false, problems: Object.freeze(problems) });
	}
}

/** The refusal of a declaration that is not a plain object, or whose reflection threw: `not-an-object` at "", and nothing else. */
export function notAnObject(): OpenSceneResult {
	const problems = new ProblemList();
	problems.add("", "not-an-object");
	return problems.refusal();
}
