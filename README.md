# vector-scene

Show an application's shapes, held as data in declared layers under its keys, exactly as described, and say which shape a platform element belongs to and where a point lies.

**Status: experimental until mission-kit admits it; runs in the Node versions `package.json`'s `engines` names, and in browsers that support ES2022 and import maps.**

---

## Install

vector-scene is released only as a tarball attached to a GitHub release, made by its own CI, so a consumer names the release file and its lockfile pins the file's hash.

Choose a release from the repository's Releases page, `https://github.com/apnex/vector-scene/releases`, and name its file in your `package.json`, writing that release's version for `<version>`:
```json
"dependencies": {
  "@apnex/vector-scene": "https://github.com/apnex/vector-scene/releases/download/v<version>/apnex-vector-scene-<version>.tgz"
}
```

Then install, which records the file's `integrity` in `package-lock.json`, so every `npm ci` refuses a file whose hash differs:
```bash
npm install
```

A browser loads it as ES2022 modules through an import map, so it needs a browser that supports both.\
The page maps the package's one export path to its file with one import-map entry, never a trailing-slash prefix.

---

## Use

Open a scene on an `<svg>` element with your layers, back to front; put items of shapes under your keys, and the scene makes the platform show exactly what they describe, writing only what changed.

Open a scene on an SVG element, with a layer of shapes and a foreign layer you draw into yourself, and put two items:
```js
import { openScene } from "@apnex/vector-scene";

const opened = openScene({ root: svg, layers: [{ name: "things", attrs: { class: "things" } }, { name: "effects", foreign: true }] });
if (!opened.ok) throw new Error(JSON.stringify(opened.problems));
const scene = opened.scene;

scene.put("things", "box-1", [{ tag: "g", attrs: { class: "box" }, children: [{ tag: "rect", attrs: { x: 10, y: 10, width: 40, height: 30 } }, { tag: "text", attrs: { x: 14, y: 30 }, text: "one" }] }]);
scene.put("things", "box-2", [{ tag: "rect", attrs: { x: 60, y: 10, width: 40, height: 30 } }], { before: "box-1" });
```

Put an item again to change it: an element is kept while its shape keeps its position and its tag, so a transition or a captured pointer on it outlasts the put; `{ before: key }` moves an item before another, `{ before: null }` to the end, and `scene.remove("things", "box-2")` takes it out.\
`scene.items("things")` answers every item's key and description as frozen data, each a valid argument to `put` again.

Ask which item a pointer landed on, and where it landed in drawing coordinates:
```js
svg.addEventListener("pointerdown", (event) => {
  const at = scene.itemOf(event.target);
  const point = scene.toDrawing({ x: event.clientX, y: event.clientY });
  if (at !== null) console.log(at.key, at.path, point.x, point.y);
});
```

`scene.layerElement("effects")` answers the foreign layer's element to draw beneath yourself, `scene.toScreen(point)` converts the other way, and `scene.close()` removes every layer the scene added; `CONTRACT.md` gives each rule, VS1 to VS11.

Two refusals the types cannot show.\
An attribute named `on...`, in any case, is refused, since a description is data; the scene judges a shape's form, never its meaning, so it is no sanitizer, and what you draw from an untrusted source you sanitize first.\
A declaration or a shape made in another realm -- an iframe's object, or one `node:vm` made -- has that realm's `Object.prototype`, so it is refused as not a plain object; make it in the realm that calls the scene, the root being free to come from anywhere.

With no root, the same calls hold the descriptions alone, so the same code draws where there is no browser, and a test or an export reads `items`:
```js
const { scene } = openScene({ layers: [{ name: "things" }] });
scene.put("things", "a", [{ tag: "circle", attrs: { r: 5 } }]);
console.log(JSON.stringify(scene.items("things")));
```

---

## Test

The gate builds, runs every test -- among them a test in headless Chrome driven over the DevTools protocol -- then the vocabulary, source, runtime, clock and chance, and export-map checks, and mission-kit's style checks over the Markdown.

Run the gate with a mission-kit checkout beside this repository, or with `MISSION_KIT` naming one, and with `google-chrome` on `PATH` or `CHROME` naming a Chrome:
```bash
npm ci
npm run gate
```

The consumer test packs the package, installs the file into an empty project, imports every export in Node, and loads every export in headless Chrome through an import map:
```bash
npm run consumer
```

The built size is measured after a build:
```bash
node tools/measure-size.mjs
```

---

## Remove

Close every scene you opened, then remove the dependency, and with it the lockfile's entry:
```bash
npm uninstall @apnex/vector-scene
```

Then remove the import-map entry of each page that loads it.

---

## Documents

- `VISION.md` - why it exists, and what it will never be.
- `CONTRACT.md` - what a consumer can depend on, one capability per row, and every rule.
- `docs/DECISIONS.md` - the rulings about this component, the choices made at build, and its built size.
