// teardown - I10's teardown can neither fail the run nor hang it (chrome-driver.js). A fake browser whose
// writer outlives its leader and goes on writing to the profile (fake-browser.mjs) stands in for Chrome's
// process tree, whose storage and network processes outlived a kill of the main process alone and made a
// release run's removal of the profile fail with ENOTEMPTY, after which the static server, never closed,
// held the run open.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { closeServer, launchGroup, removeProfile, serveRepository, sleep } from "./chrome-driver.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const fake = path.join(here, "fake-browser.mjs");
const TEST = { timeout: 30000 };

/** The live processes whose command line names the profile. */
function namingProcesses(profile) {
	try {
		return execFileSync("pgrep", ["-f", profile], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

/** A fake browser started in a process group of its own, once its leader and its writer are both at work. */
async function startFake() {
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vector-scene-teardown-"));
	const browser = launchGroup(process.execPath, [fake, profile]);
	for (let i = 0; i < 400 && !(fs.existsSync(path.join(profile, "leader-ready")) && fs.existsSync(path.join(profile, "Default", "entry-1"))); i++) await sleep(25);
	assert.ok(fs.existsSync(path.join(profile, "Default", "entry-1")), "the writer is writing to the profile");
	return { profile, browser };
}

test("teardown: stopping the group ends the writer that outlives its leader, and the profile it was writing is then removed", TEST, async () => {
	const { profile, browser } = await startFake();
	try {
		assert.equal(namingProcesses(profile).length, 2, "the leader and its writer");
		assert.equal(await browser.stop(), true, "the whole group ended within the bound");
		assert.deepEqual(namingProcesses(profile), [], "no process of the group is left");
		assert.equal(removeProfile(profile), true);
		assert.equal(fs.existsSync(profile), false);
		assert.equal(await browser.stop(), true, "stopping again does nothing and never throws");
	} finally {
		try {
			process.kill(-browser.child.pid, "SIGKILL");
		} catch {
			// already gone, as it should be
		}
		fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
	}
});

test("teardown: a profile that cannot be removed is a warning, never an exception", TEST, (t) => {
	if (process.getuid?.() === 0) {
		t.skip("root removes a directory whatever its mode");
		return;
	}
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vector-scene-teardown-"));
	const locked = path.join(profile, "Default");
	fs.mkdirSync(locked);
	fs.writeFileSync(path.join(locked, "entry"), "x");
	fs.chmodSync(locked, 0o500);
	const warnings = [];
	try {
		assert.equal(removeProfile(profile, (message) => warnings.push(message)), false);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0], /^left the scratch profile .*vector-scene-teardown-/);
	} finally {
		fs.chmodSync(locked, 0o700);
		fs.rmSync(profile, { recursive: true, force: true });
	}
});

test("teardown: closing the static server ends its kept-alive connections at once, and never throws, even twice", TEST, async () => {
	const server = await serveRepository(root);
	const agent = await fetch(`${server.origin}/test/browser/i10-page.html`, { headers: { connection: "keep-alive" } });
	assert.equal(agent.status, 200);
	await agent.text();
	const started = Date.now();
	await server.close();
	await server.close();
	assert.ok(Date.now() - started < 1500, "no kept-alive connection held the close");
	await assert.rejects(fetch(`${server.origin}/test/browser/i10-page.html`), "closed");
	await closeServer({ closeAllConnections() {
		throw new Error("a server that throws");
	}, close() {} }, 50);
});
