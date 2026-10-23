#!/usr/bin/env node
// consumer-test - the consumer test (SNAP-GRID.md section 7.3, as VECTOR-SCENE.md section 7 adapts it):
// the package as a consumer receives it.
//
// It packs the package -- or takes a tarball already packed, such as the one a release attaches --
// installs the file into an empty project with --omit=dev, imports every export by name in Node, then
// serves the installed files with a small static server and loads every export in headless Chrome
// through an import map made as draw makes its own: one entry per export, never a trailing-slash prefix,
// each export's address carrying the package's version. In Node and in the page alike, the exercise
// below opens a scene, puts an item, reads it back and puts the description again: in Node with no root,
// the scene holding data alone; and in the page on an <svg> element, where it also finds the element the
// scene made for a shape by itemOf, converts a point -- held to DOMPoint's matrixTransform over the
// element's own screen transform -- and closes, the root left as it found it.
//
// Chrome is $CHROME, or google-chrome on PATH. It runs with a profile of its own in a scratch directory,
// so it never touches another Chrome on the machine, detached in a process group of its own that is killed
// whole once it answers; the server's connections are closed, and a scratch directory that cannot be
// removed is a warning, never a failure. Nothing here needs an npm dependency.
//
// Usage:  node tools/consumer-test.mjs [--tarball FILE] [--keep]    (or VECTOR_SCENE_TARBALL=FILE)
import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const tarballAt = process.argv.indexOf("--tarball");
const given = tarballAt > -1 ? process.argv[tarballAt + 1] : process.env.VECTOR_SCENE_TARBALL || null;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "vector-scene-consumer-"));
const fail = (message) => {
	console.log(`consumer-test: FAIL -- ${message}`);
	process.exitCode = 1;
	throw new Error(message);
};
const step = (message) => console.log(`  ${message}`);

/**
 * Runs Chrome detached, the leader of a process group of its own, answering its stdout once it exits; on
 * its exit or after `timeoutMs` the whole group is killed, so none of Chrome's own processes outlives the
 * run to write to its profile or hold a connection to the server open.
 */
function runChrome(command, args, timeoutMs) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"], detached: true });
		const killGroup = () => {
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch {
				// the group has ended
			}
		};
		let stdout = "";
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk) => (stdout += chunk));
		const timer = setTimeout(() => {
			killGroup();
			reject(new Error(`Chrome gave no answer in ${timeoutMs / 1000} seconds`));
		}, timeoutMs);
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.on("close", (code, signal) => {
			clearTimeout(timer);
			killGroup();
			if (code === 0) resolve({ stdout });
			else reject(new Error(`Chrome exited ${code ?? signal}`));
		});
	});
}

/** Removes the scratch directory with retries; one that still cannot be removed is a warning, never a failure. */
function removeScratch(dir) {
	try {
		fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
	} catch (error) {
		process.stderr.write(`consumer-test: warning: left the scratch directory ${dir}: ${error?.message ?? error}\n`);
	}
}

/**
 * What a consumer does with the package, run in Node and in Chrome alike: open a scene, put an item, read
 * it back and put the description again; and, where the platform hands a root, find the element the scene
 * made for a shape, convert a point and close, the root left as found. Answers a summary, or throws.
 */
function exercise(openScene, platform) {
	const layers = [{ name: "shapes", attrs: { class: "shapes" } }];
	const opened = openScene(platform.root ? { root: platform.root, layers } : { layers });
	if (!opened.ok) throw new Error("openScene refused: " + JSON.stringify(opened.problems));
	const scene = opened.scene;
	const wrong = [];
	scene.put("shapes", "first", [{ tag: "g", attrs: { id: "first", opacity: 0.5 }, children: [{ tag: "text", attrs: { x: -0, y: 20 }, text: "hello" }] }]);
	const items = scene.items("shapes");
	const shapes = items.length === 1 ? items[0].shapes : [];
	const described = [{ tag: "g", attrs: { id: "first", opacity: "0.5" }, children: [{ tag: "text", attrs: { x: "0", y: "20" }, text: "hello" }] }];
	if (items.length !== 1 || items[0].key !== "first" || JSON.stringify(shapes) !== JSON.stringify(described)) wrong.push("items answered " + JSON.stringify(items));
	if (!Object.isFrozen(items) || !Object.isFrozen(shapes) || !Object.isFrozen(shapes[0].children[0].attrs)) wrong.push("an answer not frozen");
	scene.put("shapes", "first", shapes);
	if (JSON.stringify(scene.items("shapes")[0].shapes) !== JSON.stringify(described)) wrong.push("the description put again answered " + JSON.stringify(scene.items("shapes")));
	const done = ["put", "read back", "put again"];
	if (platform.root) {
		const group = platform.root.querySelector("#first");
		const text = group && group.firstElementChild;
		const at = scene.itemOf(text);
		if (!text || text.namespaceURI !== "http://www.w3.org/2000/svg" || text.textContent !== "hello" || group.parentNode.getAttribute("class") !== "shapes") wrong.push("the elements made: " + (group ? group.outerHTML : "none"));
		if (!at || at.layer !== "shapes" || at.key !== "first" || JSON.stringify(at.path) !== "[0,0]") wrong.push("itemOf answered " + JSON.stringify(at));
		const point = scene.toDrawing({ x: 50, y: 30 });
		const expected = new DOMPoint(50, 30).matrixTransform(platform.root.getScreenCTM().inverse());
		if (!Object.is(point.x, expected.x) || !Object.is(point.y, expected.y)) wrong.push("toDrawing answered " + JSON.stringify(point) + " where DOMPoint answers " + JSON.stringify([expected.x, expected.y]));
		if (scene.close() !== undefined || platform.root.innerHTML !== platform.found) wrong.push("close left " + platform.root.innerHTML);
		done.push("found its element at " + JSON.stringify(at && at.path), "converted (50,30) to (" + point.x + "," + point.y + ")", "closed");
	} else {
		if (scene.itemOf({}) !== null) wrong.push("itemOf answered for an object the scene did not make");
		let refused = "";
		try {
			scene.toDrawing({ x: 50, y: 30 });
		} catch (error) {
			refused = error.message;
		}
		if (!refused.startsWith("toDrawing: ")) wrong.push("toDrawing with no root answered");
		if (scene.close() !== undefined) wrong.push("close answered");
		done.push("no root, so no conversion", "closed");
	}
	if (wrong.length) throw new Error("the package answered wrongly: " + wrong.join("; "));
	return done.join(",").replace(/ /g, "_");
}

/** The Node platform: no root, so the scene holds and reads back data alone. */
const NODE_PLATFORM = "const platform = { root: null };";

/** The page's platform: an svg element, scaled by its viewBox and offset in the page, and what it held before the scene opened. */
const PAGE_PLATFORM = `const root = document.getElementById("root");
const platform = { root, found: root.innerHTML };`;

async function main() {
	// 1. the tarball given, or build and pack one, as a release does
	let tarball, shipped;
	if (given) {
		tarball = path.resolve(given);
		if (!fs.existsSync(tarball) || !fs.statSync(tarball).isFile()) fail(`no tarball at ${tarball}`);
		const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter((e) => e && !e.endsWith("/"));
		if (entries.some((e) => !e.startsWith("package/"))) fail(`${tarball} is not an npm package tarball`);
		shipped = entries.map((e) => e.slice("package/".length)).sort();
		step(`took the tarball given, ${path.basename(tarball)}: ${shipped.length} files`);
	} else {
		execFileSync("npm", ["run", "build"], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
		const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
		tarball = path.join(scratch, packed[0].filename);
		shipped = packed[0].files.map((f) => f.path).sort();
		step(`packed ${packed[0].filename}: ${shipped.length} files`);
	}
	const stray = shipped.filter((f) => !f.startsWith("dist/") && !["CONTRACT.md", "LICENSE", "README.md", "VISION.md", "package.json"].includes(f));
	if (stray.length) fail(`the tarball holds files outside dist and the documents: ${stray.join(", ")}`);
	if (shipped.some((f) => f.endsWith(".d.ts.map"))) fail("the tarball holds a declaration map");

	// 2. install the file into an empty project, without development dependencies
	const project = path.join(scratch, "project");
	fs.mkdirSync(project);
	fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "vector-scene-consumer", version: "0.0.0", private: true, type: "module" }, null, 2));
	execFileSync("npm", ["install", tarball, "--omit=dev", "--no-audit", "--no-fund"], { cwd: project, stdio: ["ignore", "ignore", "inherit"] });
	const installed = path.join(project, "node_modules", "@apnex", "vector-scene");
	const pkg = JSON.parse(fs.readFileSync(path.join(installed, "package.json"), "utf8"));
	const others = fs.readdirSync(path.join(project, "node_modules")).filter((d) => d !== "@apnex" && !d.startsWith("."));
	if (others.length) fail(`installing brought other packages: ${others.join(", ")}`);
	step(`installed ${pkg.name}@${pkg.version} into an empty project, with nothing else`);

	// 3. import every export by name in Node
	const map = JSON.parse(fs.readFileSync(path.join(root, "export-map.json"), "utf8"));
	const specifiers = Object.keys(pkg.exports).map((p) => (p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}`));
	const imports = Object.entries(map.paths).map(([p, e], i) => `import { ${Object.keys(e.exports).join(", ")} } from "${p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}`}"; const m${i} = { ${Object.keys(e.exports).join(", ")} };`);
	const nodeCheck = [
		...imports,
		"const all = Object.assign({}, " + Object.keys(map.paths).map((_, i) => `m${i}`).join(", ") + ");",
		'for (const [name, value] of Object.entries(all)) if (value === undefined) throw new Error(name + " is undefined");',
		exercise.toString(),
		NODE_PLATFORM,
		"const summary = exercise(all.openScene, platform);",
		'console.log("node-ok " + Object.keys(all).sort().join(",") + " " + summary);',
	].join("\n");
	fs.writeFileSync(path.join(project, "node-check.mjs"), nodeCheck);
	const { stdout: nodeOut } = await run(process.execPath, ["node-check.mjs"], { cwd: project });
	if (!nodeOut.startsWith("node-ok ")) fail(`Node: ${nodeOut}`);
	const [names, summary] = nodeOut.trim().slice(8).split(" ");
	step(`Node ${process.version} imported ${names} by name, and the exercise answered ${summary}`);

	// 4. an import map, one entry per export, each into the vendored files at the installed version
	const base = `/vendor/${pkg.name}@${pkg.version}/`;
	const entries = {};
	for (const [p, target] of Object.entries(pkg.exports)) {
		const file = typeof target === "string" ? target : target.default;
		const conditions = typeof target === "string" ? [] : Object.keys(target);
		if (conditions.some((c) => c !== "types" && c !== "default") || p.includes("*") || typeof file !== "string" || !file.startsWith("./dist/")) fail(`an exports form the map does not support: ${p}`);
		entries[p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}`] = base + file.slice("./dist/".length);
	}
	if (Object.keys(entries).some((k) => k.endsWith("/"))) fail("a trailing-slash entry in the import map");
	const bindings = Object.entries(map.paths).flatMap(([p, e]) => Object.keys(e.exports).map((name) => ({ name, from: p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}` })));
	const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>vector-scene consumer</title>
<script type="importmap">${JSON.stringify({ imports: entries })}</script>
<script type="module">
${[...new Set(bindings.map((b) => b.from))].map((from) => `import { ${bindings.filter((b) => b.from === from).map((b) => b.name).join(", ")} } from "${from}";`).join("\n")}
const names = { ${bindings.map((b) => b.name).join(", ")} };
const out = document.getElementById("result");
try {
	const missing = Object.entries(names).filter(([, v]) => v === undefined).map(([k]) => k);
	${PAGE_PLATFORM}
	const summary = exercise(openScene, platform);
	out.textContent = missing.length === 0 ? "vector-scene-ok " + Object.keys(names).sort().join(",") + " " + summary : "vector-scene-wrong " + missing.join(",");
} catch (e) {
	out.textContent = "vector-scene-error " + e.message;
}
${exercise.toString()}
</script></head><body style="margin:0"><svg id="root" width="400" height="200" viewBox="-10 -5 100 50" style="position:absolute;left:30px;top:15px"><rect id="ground" width="100" height="50" fill="#eee"/></svg><pre id="result">vector-scene-pending</pre></body></html>
`;

	// 5. a static server: the page, and the installed package's files under its versioned address
	const requests = [];
	const server = http.createServer((req, res) => {
		const url = new URL(req.url, "http://localhost");
		let status = 404, body = "not found", type = "text/plain";
		if (url.pathname === "/" || url.pathname === "/index.html") {
			status = 200;
			body = page;
			type = "text/html; charset=utf-8";
		} else if (url.pathname.startsWith(base)) {
			const rel = decodeURIComponent(url.pathname.slice(base.length));
			const file = path.resolve(installed, "dist", rel);
			if (file.startsWith(path.join(installed, "dist") + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
				status = 200;
				body = fs.readFileSync(file);
				type = file.endsWith(".js") ? "text/javascript; charset=utf-8" : file.endsWith(".map") ? "application/json" : "text/plain";
			}
		}
		requests.push({ path: url.pathname, status });
		res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
		res.end(body);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = `http://127.0.0.1:${server.address().port}/`;
	step(`serving the page and ${base} at ${address}`);

	// 6. headless Chrome, a profile of its own
	try {
		const chrome = process.env.CHROME || "google-chrome";
		const profile = path.join(scratch, "chrome-profile");
		const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", `--user-data-dir=${profile}`, "--virtual-time-budget=10000", "--dump-dom", address];
		const { stdout: dom } = await runChrome(chrome, args, 90000);
		const result = dom.match(/<pre id="result">([^<]*)<\/pre>/)?.[1] ?? "";
		const missed = requests.filter((r) => r.status !== 200 && r.path !== "/favicon.ico");
		if (missed.length) fail(`requests not answered 200: ${missed.map((r) => `${r.path} ${r.status}`).join(", ")}`);
		for (const address of Object.values(entries)) if (!requests.some((r) => r.path === address)) fail(`Chrome never asked for ${address}`);
		if (!result.startsWith("vector-scene-ok ")) fail(`Chrome's page says: ${result || dom.slice(0, 400)}`);
		const { stdout: version } = await run(chrome, ["--version"]);
		step(`${version.trim()} loaded ${specifiers.join(" and ")} through the import map: ${requests.length} requests, every one asked of the page answered 200`);
		step(`the page says: ${result}`);
	} finally {
		server.closeAllConnections();
		server.close();
	}
	console.log("consumer-test: PASS");
}

try {
	await main();
} catch (e) {
	if (!process.exitCode) {
		console.log(`consumer-test: FAIL -- ${e.message}`);
		process.exitCode = 1;
	}
} finally {
	if (!keep) removeScratch(scratch);
	else console.log(`  kept ${scratch}`);
}
