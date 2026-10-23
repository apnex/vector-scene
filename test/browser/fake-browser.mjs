// fake-browser - a stand-in for Chrome's process tree, for teardown.test.js: it starts a writer -- in its own
// process group, as Chrome's storage and network services are -- that writes files into <profile>/Default
// without end, then waits forever itself. Killing this process alone leaves the writer writing, which is
// what made a removal of Chrome's profile fail with ENOTEMPTY after the main process alone was killed.
//
// Usage:  node test/browser/fake-browser.mjs <profile>            (the leader)
//         node test/browser/fake-browser.mjs <profile> --writer   (the writer it starts)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [profile, role] = process.argv.slice(2);
const store = path.join(profile, "Default");
fs.mkdirSync(store, { recursive: true });
if (role === "--writer") {
	let n = 0;
	const write = () => {
		for (let i = 0; i < 50; i++) {
			try {
				fs.mkdirSync(store, { recursive: true });
				fs.writeFileSync(path.join(store, `entry-${n++ % 200}`), "x");
			} catch {
				// the directory was being removed: write again
			}
		}
		setImmediate(write);
	};
	write();
} else {
	spawn(process.execPath, [process.argv[1], profile, "--writer"], { stdio: "ignore" });
	fs.writeFileSync(path.join(profile, "leader-ready"), String(process.pid));
	setInterval(() => {}, 1000);
}
