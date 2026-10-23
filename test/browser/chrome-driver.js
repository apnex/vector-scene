// chrome-driver - headless Chrome driven over the DevTools protocol, for I10 (CONTRACT.md; VECTOR-SCENE.md
// section 7, as input-capture's I10 settled its launch and its teardown): no dependency, the protocol
// spoken over Node.js's global WebSocket.
//
// Chrome is $CHROME, or google-chrome on PATH, launched as the consumer test launches it, headless with a
// profile of its own in a scratch directory and a debugging port of its own -- port 0, so Chrome chooses
// a free one and writes it to DevToolsActivePort in that profile -- so it never touches another Chrome on
// the machine. A static server answers the repository's dist/, test/browser/ and test/support/ files, so
// the page loads the built package through an import map, and the generator the Node.js tests use.
//
// Teardown can neither fail the run nor hang it. Chrome is spawned detached, the leader of a process group
// of its own, and the whole group is killed -- its renderer, GPU, network, crashpad and zygote processes
// with it, which outlive a kill of the main process alone and go on writing to the profile -- and the wait
// for the group to end is bounded. The profile is removed with retries, and a profile that still cannot be
// removed is a warning on stderr, never a failure: a leftover scratch directory is no fault of the
// component. The static server is unreferenced and its connections closed, the socket closed, each in a
// finally, so no cleanup error leaves a handle holding the process open.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".map": "application/json" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const warnOnStderr = (message) => process.stderr.write(`chrome-driver: warning: ${message}\n`);

/** A static server of the repository's dist/, test/browser/ and test/support/ files, on a port of its own; close() ends every connection and never throws. */
export async function serveRepository(root) {
	const server = http.createServer((req, res) => {
		const url = new URL(req.url, "http://localhost");
		const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
		const file = path.resolve(root, rel);
		const allowed = [path.join(root, "dist") + path.sep, path.join(root, "test", "browser") + path.sep, path.join(root, "test", "support") + path.sep].some((dir) => file.startsWith(dir));
		if (!allowed || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
			res.writeHead(404, { "content-type": "text/plain" });
			res.end("not found");
			return;
		}
		res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "text/plain", "cache-control": "no-store" });
		res.end(fs.readFileSync(file));
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	// the server never holds the process open by itself
	server.unref();
	return { origin: `http://127.0.0.1:${server.address().port}`, close: () => closeServer(server) };
}

/** Closes a server, ending its kept-alive connections, waiting at most `boundMs` for it; never throws. */
export async function closeServer(server, boundMs = 2000) {
	try {
		server.closeAllConnections?.();
		await Promise.race([new Promise((resolve) => server.close(() => resolve())), sleep(boundMs)]);
	} catch (error) {
		warnOnStderr(`the static server did not close cleanly: ${error?.message ?? error}`);
	}
}

/** True while any process of the group led by `pid` is alive. */
function groupAlive(pid) {
	try {
		process.kill(-pid, 0);
		return true;
	} catch (error) {
		return error.code === "EPERM";
	}
}

/**
 * Spawns a command detached, the leader of a process group of its own, unreferenced so it never holds the
 * process open; answers the child, whether it has exited, and stop().
 */
export function launchGroup(command, args) {
	const child = spawn(command, args, { stdio: "ignore", detached: true });
	let exited = null;
	child.on("exit", (code, signal) => (exited = { code, signal }));
	child.on("error", (error) => (exited = { error: error.message }));
	child.unref();
	return { child, exited: () => exited, stop: (boundMs) => stopGroup(child, boundMs) };
}

/**
 * Kills a detached child's whole process group -- falling back to the child alone where the group cannot
 * be signalled -- and waits at most `boundMs` for the group to end; answers whether it ended. Never throws.
 */
export async function stopGroup(child, boundMs = 5000) {
	if (child.pid === undefined) return true;
	try {
		process.kill(-child.pid, "SIGKILL");
	} catch {
		try {
			child.kill("SIGKILL");
		} catch {
			// already gone
		}
	}
	for (let waited = 0; waited < boundMs; waited += 25) {
		if (!groupAlive(child.pid)) return true;
		await sleep(25);
	}
	warnOnStderr(`process group ${child.pid} still had a live process after ${boundMs} ms`);
	return false;
}

/** Removes a scratch directory with retries; one that still cannot be removed is a warning, never a failure. Answers whether it went. */
export function removeProfile(profile, warn = warnOnStderr) {
	try {
		fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
		return true;
	} catch (error) {
		warn(`left the scratch profile ${profile}: ${error?.code ?? ""} ${error?.message ?? error}`);
		return false;
	}
}

/** Launches headless Chrome with a profile and a debugging port of its own, and connects to its first page. */
export async function launchChrome() {
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vector-scene-i10-"));
	const chrome = launchGroup(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--window-size=800,600", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"]);
	let stopped = false;
	/** Ends Chrome's whole process group, then removes its profile; idempotent, and never throws. */
	const stop = async () => {
		if (stopped) return;
		stopped = true;
		try {
			await chrome.stop();
		} finally {
			removeProfile(profile);
		}
	};
	try {
		let port = null;
		for (let i = 0; i < 300 && port === null; i++) {
			if (chrome.exited() !== null) throw new Error(`Chrome exited before it listened: ${JSON.stringify(chrome.exited())}`);
			try {
				port = Number(fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]) || null;
			} catch {
				await sleep(50);
			}
		}
		if (port === null) throw new Error("Chrome wrote no DevToolsActivePort");
		let target;
		for (let i = 0; i < 100 && !target; i++) {
			try {
				target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
			} catch {
				await sleep(50);
			}
		}
		if (!target) throw new Error("Chrome showed no page target");
		const session = await connect(target.webSocketDebuggerUrl);
		const close = async () => {
			try {
				session.close();
			} finally {
				await stop();
			}
		};
		return { ...session, pid: chrome.child.pid, profile, close };
	} catch (error) {
		await stop();
		throw error;
	}
}

/** A DevTools protocol session over Node.js's global WebSocket: send(method, params) answers the result, or throws the protocol's error. */
async function connect(url) {
	const socket = new WebSocket(url);
	await new Promise((resolve, reject) => {
		socket.addEventListener("open", resolve, { once: true });
		socket.addEventListener("error", () => reject(new Error(`could not connect to ${url}`)), { once: true });
	});
	let next = 0;
	const pending = new Map();
	socket.addEventListener("message", (message) => {
		const data = JSON.parse(String(message.data));
		const waiting = data.id === undefined ? undefined : pending.get(data.id);
		if (!waiting) return;
		pending.delete(data.id);
		if (data.error) waiting.reject(new Error(`${waiting.method}: ${data.error.message}`));
		else waiting.resolve(data.result);
	});
	const send = (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = ++next;
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(new Error(`${method}: no answer in 15 seconds`));
			}, 15000);
			pending.set(id, { method, resolve: (v) => (clearTimeout(timer), resolve(v)), reject: (e) => (clearTimeout(timer), reject(e)) });
			socket.send(JSON.stringify({ id, method, params }));
		});
	/** Evaluates an expression in the page, answering its value. */
	const evaluate = async (expression) => {
		const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
		if (exceptionDetails) throw new Error(`the page threw: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
		return result.value;
	};
	/** Closes the socket and fails every call still waiting; never throws. */
	const close = () => {
		try {
			socket.close();
		} catch {
			// already closed
		} finally {
			for (const [id, waiting] of pending) {
				pending.delete(id);
				waiting.reject(new Error(`${waiting.method}: the session closed`));
			}
		}
	};
	return { socket, send, evaluate, close };
}

export { sleep };
