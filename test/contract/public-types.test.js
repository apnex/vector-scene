// public-types - I11 (CONTRACT.md VS11): vector-scene's published types, compiled from a consumer in
// test/types/ with tsc --noEmit under strict settings, with and without exactOptionalPropertyTypes, and with
// the DOM library a page has: a browser's SVG element passed as the root, an items answer's shapes passed
// to put. Each of the consumer's expected-error lines must fail to compile, or tsc reports the directive
// unused; and, compiled again with the directives taken out, each must fail on its own line and no other
// line may, so no expected error passes for a reason other than its own.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsc = path.join(root, "node_modules", ".bin", "tsc");
const consumer = path.join(root, "test", "types", "scene-consumer.mts");
const flags = ["--noEmit", "--strict", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", "--lib", "ES2022,DOM", "--skipLibCheck", "false"];
const MODES = [["strict", []], ["strict, exactOptionalPropertyTypes", ["--exactOptionalPropertyTypes"]]];
const DIRECTIVE = /^\s*\/\/ @ts-expect-error -- (.*)$/;

/** tsc over a file: its diagnostics' output, empty when it compiles. */
function compile(file, extra, cwd) {
	try {
		execFileSync(tsc, [...extra, ...flags, file], { cwd, encoding: "utf8", stdio: "pipe" });
		return "";
	} catch (e) {
		return `${e.stdout}${e.stderr}`;
	}
}

for (const [label, extra] of MODES) {
	test(`I11: a consumer type-checks against the public entry point, every expected error failing (${label})`, () => {
		const output = compile(consumer, extra, root);
		assert.equal(output, "", `the consumer does not compile:\n${output}`);
	});
}

test("I11: the consumer holds the expected errors I11 names -- a shape's property written, both text and children -- and passes an SVGSVGElement as root and an items answer's shapes to put", () => {
	const source = readFileSync(consumer, "utf8");
	const reasons = source.split("\n").flatMap((line) => DIRECTIVE.exec(line)?.[1] ?? []);
	for (const needed of ["a shape's property cannot be written", "both text and children", "a described shape's property cannot be written"]) assert.ok(reasons.includes(needed), needed);
	assert.match(source, /declare const svg: SVGSVGElement;/);
	assert.match(source, /openScene\(\{ root: svg,/);
	assert.match(source, /scene\.put\("items", item\.key, item\.shapes\)/);
});

for (const [label, extra] of MODES) {
	test(`I11: with the directives taken out, each expected error fails on its own line and nothing else fails (${label})`, () => {
		const lines = readFileSync(consumer, "utf8").split("\n");
		const expected = [];
		const stripped = lines.map((line, index) => {
			if (!DIRECTIVE.test(line)) return line;
			expected.push(index + 2);
			return "";
		});
		const dir = mkdtempSync(path.join(os.tmpdir(), "vector-scene-types-"));
		try {
			mkdirSync(path.join(dir, "node_modules", "@apnex"), { recursive: true });
			symlinkSync(root, path.join(dir, "node_modules", "@apnex", "vector-scene"), "dir");
			writeFileSync(path.join(dir, "consumer.mts"), stripped.join("\n"));
			const output = compile("consumer.mts", extra, dir);
			const failing = [...output.matchAll(/^consumer\.mts\((\d+),\d+\): error/gm)].map((match) => Number(match[1]));
			assert.deepEqual([...new Set(failing)], expected, output);
			assert.ok(expected.length >= 12, `${expected.length} expected errors`);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
}
