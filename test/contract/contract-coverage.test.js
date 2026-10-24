// contract-coverage - one test file per row of CONTRACT.md's capability table, so the contract reads as a
// list of tests (the design's section 4: "one file per capability").
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { contractRows } from "../../tools/check-export-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const rows = contractRows(fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8"));

test("CONTRACT.md has its five capabilities", () => {
	assert.deepEqual(rows, ["declared-scene", "keyed-shapes", "shape-at-element", "shape-at-point", "screen-conversion"]);
});

for (const row of rows) {
	test(`${row} has its contract test file`, () => {
		assert.ok(fs.existsSync(path.join(here, `${row}.test.js`)), `test/contract/${row}.test.js is missing`);
	});
}

test("CONTRACT.md carries the six headings of a component entry, in order", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
	assert.deepEqual(headings, ["Duty", "Contract", "Reference", "Fit criteria", "Adjustment policy", "Edges"]);
	for (const field of ["id: unminted", "category: component", "status: draft", "sovereignty: internal", "supersedes: []", "related: [C0, A3]"]) {
		assert.ok(text.includes(`\n${field}\n`), `the frontmatter holds ${field}`);
	}
});

test("CONTRACT.md states every rule, VS1 to VS13, and every invariant, I1 to I15", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	for (let n = 1; n <= 13; n++) assert.match(text, new RegExp(`\\*\\*VS${n} -- `), `VS${n}`);
	for (let n = 1; n <= 15; n++) assert.match(text, new RegExp(`^\\| I${n} \\|`, "m"), `I${n}`);
});

test("CONTRACT.md names no file or design of draw's but its one provenance line (GR4)", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	const naming = text.split("\n").filter((line) => /drawv2|draw's|VECTOR-SCENE\.md|SNAP-GRID\.md|INPUT-BINDING\.md|INPUT-CAPTURE\.md|RELEASES-0\.2\.md|the design's|H26/.test(line));
	assert.equal(naming.length, 1, naming.join("\n"));
	assert.match(naming[0], /^The design of record and the rulings are kept in draw's records, `apnex\/drawv2`/);
});

test("the tests the invariants name are where Reference names them: the contract's beside the capability files, I15's beside them with the 0.1.0 release's files in test/fixtures/, I10's and I14's pages in test/browser/, I11's consumer in test/types/", () => {
	for (const file of ["returned-values-and-errors.test.js", "public-types.test.js", "beside-0.1.0.test.js"]) assert.ok(fs.existsSync(path.join(here, file)), file);
	for (const file of ["browser/real-chrome.test.js", "browser/i10-page.html", "browser/i10-page.js", "browser/captured-pointer.test.js", "browser/i14-page.html", "browser/i14-page.js", "types/scene-consumer.mts", "fixtures/v0.1.0/index.js"]) assert.ok(fs.existsSync(path.join(here, "..", file)), file);
});
