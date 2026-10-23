#!/usr/bin/env node
// check-runtime - the runtime check (SNAP-GRID.md section 7.2, as input-capture widened it and
// VECTOR-SCENE.md section 7 adopts it; CONTRACT.md VS1, VS11 and I12): fails when a built file of a component
// meant for every runtime imports a bare specifier or a `node:` module, holds a dynamic `import(`, or names
// `process`, `require`, `Buffer`, `window`, `document`, `self`, `global` or `globalThis` -- so the whole of
// the module graph loads with its first import, in Node and in a browser alike -- or names `eval` or
// `Function`, or calls or constructs through a property named `constructor` (`f.constructor("return
// this")`), each of which reaches the global object from a string of code.
//
// It also allows exactly the platform slice VS1 names, and nothing more. The members a browser's objects
// reachable through the slice hold -- every member TypeScript's own lib.dom.d.ts declares on Document,
// XMLDocument, every SVG element interface, DOMMatrix and DOMMatrixReadOnly, and every interface they extend,
// Element, Node and EventTarget among them -- are platform members; a built file may read, call, write or
// destructure only those VS1 names -- the root's ownerDocument, appendChild and getScreenCTM; the
// document's createElementNS; an element's setAttribute, removeAttribute, appendChild, insertBefore, remove
// and textContent; a transform's inverse and a to f -- and x and y, which the scene reads of the point an
// application hands a conversion (VS2 rule 6), names an svg element also holds. A platform member outside
// the slice -- getAttribute, childNodes, getBoundingClientRect, parentNode, querySelector, children,
// innerHTML and the rest -- is a finding wherever it is named as a member: by dot, by brackets with a string
// literal, in a destructuring pattern, on the left of `in`, or as the literal key of a Reflect call. A
// member reached by a computed key the walk cannot name is beyond any static check; the recording test
// (CONTRACT.md I3) holds what the scene touches at run time.
//
// Each file is parsed by TypeScript into a syntax tree (ts.createSourceFile, ScriptKind.JS, as a
// module), so comments, strings, template literals and regular-expression literals are what the
// language says they are, whatever token comes before them. The walk visits:
// - every import and export declaration, whose module specifier must be a relative file;
// - every call whose callee is the `import` keyword -- a dynamic import;
// - every identifier, except the name of a property access (`a.self`, `a?.self`), which is a member and
//   not the global; an object-literal key (`{ self: 1 }`) is an identifier and is counted;
// - every call or `new` whose callee is a property named `constructor`, by dot or by brackets with a
//   string literal -- any function's constructor being `Function`;
// - every member named as the paragraph above says, against the platform slice.
// A file TypeScript cannot parse without a diagnostic fails the check rather than being guessed at.
//
// Usage:  node tools/check-runtime.mjs [DIR_OR_FILE ...]    (default: dist, its .js files)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RUNTIME_NAMES = ["process", "require", "Buffer", "window", "document", "self", "global", "globalThis", "eval", "Function"];

/** VS1's platform slice, and the point's x and y (VS2 rule 6): the only platform members a built file may name. */
export const PLATFORM_SLICE = Object.freeze({
	root: ["ownerDocument", "appendChild", "getScreenCTM"],
	document: ["createElementNS"],
	element: ["setAttribute", "removeAttribute", "appendChild", "insertBefore", "remove", "textContent"],
	transform: ["inverse", "a", "b", "c", "d", "e", "f"],
	point: ["x", "y"],
});
const ALLOWED_MEMBERS = new Set(Object.values(PLATFORM_SLICE).flat());
const REFLECT_WITH_KEY = new Set(["get", "set", "has", "getOwnPropertyDescriptor", "defineProperty", "deleteProperty"]);

let platformMembers = null;

/**
 * Every member a browser's objects reachable through the slice hold, from TypeScript's own lib.dom.d.ts: the
 * members of Document, XMLDocument, DOMMatrix, DOMMatrixReadOnly and every SVG element interface, and of
 * every interface each extends, transitively.
 */
export function platformMemberNames() {
	if (platformMembers !== null) return platformMembers;
	const lib = path.join(path.dirname(ts.getDefaultLibFilePath({})), "lib.dom.d.ts");
	const file = ts.createSourceFile(lib, fs.readFileSync(lib, "utf8"), ts.ScriptTarget.Latest, true);
	const interfaces = new Map();
	for (const statement of file.statements) {
		if (!ts.isInterfaceDeclaration(statement)) continue;
		const entry = interfaces.get(statement.name.text) ?? { members: new Set(), extended: new Set() };
		for (const clause of statement.heritageClauses ?? []) for (const type of clause.types) entry.extended.add(type.expression.getText(file));
		for (const member of statement.members) if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) entry.members.add(member.name.text);
		interfaces.set(statement.name.text, entry);
	}
	const pending = ["Document", "XMLDocument", "DOMMatrix", "DOMMatrixReadOnly", ...[...interfaces.keys()].filter((name) => /^SVG\w*Element$/.test(name))];
	const reached = new Set();
	while (pending.length) {
		const name = pending.pop();
		if (reached.has(name) || !interfaces.has(name)) continue;
		reached.add(name);
		pending.push(...interfaces.get(name).extended);
	}
	platformMembers = new Set([...reached].flatMap((name) => [...interfaces.get(name).members]));
	if (!platformMembers.has("getAttribute") || !platformMembers.has("childNodes") || !platformMembers.has("createElementNS")) throw new Error(`check-runtime: ${lib} declares no platform members the walk can find`);
	return platformMembers;
}

/** The text of a string literal or a template with no substitution, or undefined. */
const literalText = (node) => (node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined);

/** True when a callee is a property named `constructor`, reached by dot or by brackets with a string literal. */
const isConstructorProperty = (callee) =>
	(ts.isPropertyAccessExpression(callee) && callee.name.text === "constructor") ||
	(ts.isElementAccessExpression(callee) && (ts.isStringLiteral(callee.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(callee.argumentExpression)) && callee.argumentExpression.text === "constructor");

/** A built file's syntax tree, parsed as an ES module; throws when TypeScript reports a parse diagnostic. */
export function parseModule(source, fileName = "built.js") {
	const file = ts.createSourceFile(fileName, source, { languageVersion: ts.ScriptTarget.Latest, impliedNodeFormat: ts.ModuleKind.ESNext }, true, ts.ScriptKind.JS);
	// parseDiagnostics is where createSourceFile keeps what the parser reported
	const diagnostics = file.parseDiagnostics ?? [];
	if (diagnostics.length) {
		const first = diagnostics[0];
		const line = file.getLineAndCharacterOfPosition(first.start ?? 0).line + 1;
		throw new Error(`check-runtime: TypeScript could not parse the file: line ${line}: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`);
	}
	return file;
}

/**
 * The member names a node names: a property access's name, a bracket access's literal key, a destructuring
 * pattern's property, a literal on the left of `in`, and the literal key of a Reflect call.
 */
function membersNamedBy(node) {
	if (ts.isPropertyAccessExpression(node)) return [node.name.text];
	if (ts.isElementAccessExpression(node)) return [literalText(node.argumentExpression)].filter((name) => name !== undefined);
	if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
		const key = node.propertyName ?? node.name;
		return ts.isIdentifier(key) || ts.isStringLiteral(key) ? [key.text] : [];
	}
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isObjectLiteralExpression(node.left)) {
		return node.left.properties.flatMap((property) => (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? [property.name.text] : []));
	}
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword) return [literalText(node.left)].filter((name) => name !== undefined);
	if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "Reflect" && REFLECT_WITH_KEY.has(node.expression.name.text)) {
		return [literalText(node.arguments[1])].filter((name) => name !== undefined);
	}
	return [];
}

/** Every runtime finding in a built file's source: [{ line, finding }], in source order. */
export function findRuntimeUses(source, fileName) {
	const file = parseModule(source, fileName);
	const members = platformMemberNames();
	const found = [];
	const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
	const visit = (node) => {
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
			const specifier = node.moduleSpecifier.text;
			if (!specifier.startsWith("./") && !specifier.startsWith("../")) found.push({ line: lineOf(node), finding: `imports "${specifier}", which is not a relative file` });
		}
		if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) found.push({ line: lineOf(node), finding: "holds a dynamic import(" });
		if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && isConstructorProperty(node.expression)) found.push({ line: lineOf(node), finding: "calls through a property named constructor, which reaches Function" });
		if (ts.isIdentifier(node) && RUNTIME_NAMES.includes(node.text)) {
			const member = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
			if (!member) found.push({ line: lineOf(node), finding: `names ${node.text}` });
		}
		for (const name of membersNamedBy(node)) {
			if (members.has(name) && !ALLOWED_MEMBERS.has(name)) found.push({ line: lineOf(node), finding: `names ${name}, a platform member outside VS1's slice` });
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
}

function jsFilesUnder(target) {
	const stat = fs.statSync(target);
	if (stat.isFile()) return target.endsWith(".js") ? [target] : [];
	return fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).flatMap((e) => jsFilesUnder(path.join(target, e.name)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const targets = process.argv.slice(2);
	const files = (targets.length ? targets : [path.join(root, "dist")]).flatMap((t) => jsFilesUnder(path.resolve(t)));
	if (files.length === 0) {
		console.log("check-runtime: FAIL -- no built .js files found; run npm run build first");
		process.exit(1);
	}
	let findings = 0;
	for (const file of files) {
		let uses;
		try {
			uses = findRuntimeUses(fs.readFileSync(file, "utf8"), path.basename(file));
		} catch (e) {
			uses = [{ line: 1, finding: e.message }];
		}
		for (const f of uses) {
			console.log(`  ${path.relative(process.cwd(), file)}:${f.line}  ${f.finding}`);
			findings++;
		}
	}
	if (findings) {
		console.log(`check-runtime: FAIL -- ${findings} runtime-specific use(s) in ${files.length} built file(s)`);
		process.exit(1);
	}
	console.log(`check-runtime: PASS -- ${files.length} built file(s) import only relative files, name no runtime's globals, and name no platform member outside VS1's slice`);
}
