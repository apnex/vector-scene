# vector-scene

Show an application's shapes, held as data in declared layers under its keys, exactly as described, and say which shape a platform element belongs to and where a point lies.

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

The package has one export path, `@apnex/vector-scene`, and it maps to `index.js` in the package's `dist` folder, as `package.json`'s `exports` gives; `index.js` imports the other files of `dist` by relative path.\
A browser loads it as ES2022 modules, so a page either maps the bare name to that file with one import-map entry, never a trailing-slash prefix, or imports `dist/index.js` by its own relative path where the page serves a copy of the release's files.

Map the bare name in the page's import map, writing where the page serves the package for `/vendor/vector-scene`:
```html
<script type="importmap">{ "imports": { "@apnex/vector-scene": "/vendor/vector-scene/dist/index.js" } }</script>
```

---

## Use

Open a scene on an `<svg>` element with your layers, back to front; put items of shapes under your keys, and the scene makes the platform show exactly what they describe, writing only what changed.\
This section is the whole surface a consumer handles: one function, the scene it opens, and the shapes both take and answer; `CONTRACT.md` gives every rule, VS1 to VS13.

### Opening a scene

Open a scene on an SVG element, with two layers of items and a foreign layer you draw into yourself:
```js
import { openScene } from "@apnex/vector-scene";

const opened = openScene({ root: svg, layers: [{ name: "things", attrs: { class: "things" } }, { name: "marks" }, { name: "effects", foreign: true }] });
if (!opened.ok) throw new Error(JSON.stringify(opened.problems));
const scene = opened.scene;
```

`openScene(declaration)` answers `{ ok: true, scene }` or `{ ok: false, problems }`, and never throws for a declaration it refuses, so check `ok`; it throws only an error the platform threw while it made the layers, after taking them back.

| Shape | Holds |
|---|---|
| declaration | `layers`, and optionally `root`; nothing else |
| `root` | your `<svg>` element, or any object of its shape: `ownerDocument` holding `createElementNS` and, optionally, `elementsFromPoint`; `appendChild`; `getScreenCTM` |
| layer | `name`, a non-empty string unique among the layers; optionally `attrs`, an attribute record written on the layer's `<g>`; optionally `foreign`, `true` for a layer whose content you draw yourself |
| problem | `pointer`, a JSON Pointer into the declaration, `""` the declaration itself; `problem`, one of `not-an-object`, `unknown-property`, `missing-property`, `invalid-value`, `duplicate-name` |

Each layer is a `<g>` appended to the root after whatever the root already holds, so what you drew in the root before opening lies beneath every layer.\
A declaration, a layer or a shape made in another realm -- an iframe's object, or one `node:vm` made -- has that realm's `Object.prototype`, so it is refused as not a plain object; make it in the realm that calls the scene, the root being free to come from anywhere.\
A root whose document's `elementsFromPoint` getter throws is refused at `/root`; a document holding no `elementsFromPoint` opens, and only `itemAt` then refuses.

### Shapes and items

Put items of shapes under your keys, and put one again to change it:
```js
scene.put("things", "box-1", [{ tag: "g", attrs: { class: "box" }, children: [{ tag: "rect", attrs: { x: 10, y: 10, width: 40, height: 30 } }, { tag: "text", attrs: { x: 14, y: 30 }, text: "one" }] }]);
scene.put("things", "box-2", [{ tag: "rect", attrs: { x: 60, y: 10, width: 40, height: 30 } }], { before: "box-1" });
scene.put("things", "box-2", [{ tag: "rect", attrs: { x: 60, y: 10, width: 40, height: 30, class: "lit" } }]);
scene.remove("things", "box-1");
```

| Shape | Holds |
|---|---|
| shape | `tag`, the SVG element's local name: an ASCII letter, then letters, digits and hyphens; optionally `attrs`; optionally `text` or `children`, never both; nothing else |
| attribute record | own properties named by an ASCII letter or underscore, then letters, digits, underscores, periods and hyphens, none beginning `on` in any case; each value a string, or a finite number written as `String` writes it, so `-0` is `"0"` |
| `text` | the element's text content, `""` meaning none |
| `children` | an array of shapes, the element's children in order; shapes nest at most 32 deep |
| item | the shapes held under one key in one layer, an array of at least one, shown as sibling elements |
| place | `put`'s optional fourth argument: `{ before: key }` puts the item before another, `{ before: null }` last; `{}` or none keeps an item where it stands, and puts a new one last |
| description | what `items` answers for an item: each shape as `{ tag, attrs }`, then `text` when it has text or `children` when it has child shapes, every attribute value a string -- a valid argument to `put` again, which then calls nothing |

The traps that bite here:
- An element is kept only while its shape keeps its position and its tag in its list, so a captured pointer, a running transition or a hover on it outlasts a put only then; put an element you need kept in an item of its own, so a sibling gained or lost before it cannot replace it.
- An attribute named `on...`, in any case, is refused, since a description is data; the scene judges a shape's form, never its meaning, so it is no sanitizer, and what you draw from an untrusted source you sanitize first.
- The scene writes every attribute with `setAttribute`, so under a browser rule with `style-src 'self'` a `style` attribute is refused by the browser; give a shape its look by a class or by presentation attributes such as `fill` and `opacity`.
- Write nothing on a layer's element, and nothing beneath a scene layer's: the scene neither reads nor restores what anything else writes there; a layer's attributes are set only by its declaration.
- The root and its attributes are yours: set its `viewBox`, its size, its `preserveAspectRatio`, its classes and its styles before or after opening, and every conversion and `itemAt` follows the root as it stands.

### Which item, and where

Ask which item a pointer is over, by the event's target and, when that answers `null`, by its screen point -- the only answer while the pointer is captured, since every captured event targets the element holding the capture:
```js
svg.addEventListener("pointerdown", (event) => svg.setPointerCapture(event.pointerId));
svg.addEventListener("pointermove", (event) => {
  const screen = { x: event.clientX, y: event.clientY };
  const at = scene.itemOf(event.target) ?? scene.itemAt(screen);
  const point = scene.toDrawing(screen);
  if (at !== null) console.log(at.layer, at.key, at.path, point.x, point.y);
});
```

| Function | Takes | Answers |
|---|---|---|
| `scene.itemOf(value)` | any value, usually an event's target, read by identity alone | `{ layer, key, path }` for an element the scene made for an item it holds, `path` the shape's indices from the item's own shapes down; `null` for anything else -- a layer's element, a foreign layer's content, the root, an element since removed |
| `scene.itemAt(screen)` | a screen point `{ x, y }` | `{ layer, key, path }` for the first element in the platform's hit stack at that point that the scene made for an item it holds, or `null` |
| `scene.toDrawing(screen)` | a screen point `{ x, y }` | the point `{ x, y }` in drawing coordinates, the root's own, through the root's screen transform as it stands |
| `scene.toScreen(point)` | a point `{ x, y }` in drawing coordinates | the point `{ x, y }` on the screen |

The traps that bite here:
- A screen point is in the viewport's units: a pointer event's `clientX` and `clientY`, and `input-capture`'s `screen`.
- `itemAt` is the platform's own hit test, asked by `document.elementsFromPoint`: it names the first item the scene holds anywhere under the point, looking through what the scene did not make, so it is not the topmost hit -- under an opaque element you drew in a foreign layer it answers the item beneath, where `itemOf` of the target answers `null`.
- The platform leaves out every element whose `pointer-events` is `none`, so a layer declared with `attrs: { "pointer-events": "none" }` is looked through by both.
- A root scaled to nothing has no inverse, so `toDrawing` throws.

### Everything else the scene holds

| Member | Answers |
|---|---|
| `scene.layers` | a frozen copy of the declared layers, each `{ name, attrs, foreign }`, `attrs` written as strings |
| `scene.put(layer, key, shapes, place?)` | `undefined`; makes `shapes` the item's description and the platform show it |
| `scene.remove(layer, key)` | `undefined`; takes the item out, its elements with it; a key the layer does not hold changes nothing |
| `scene.items(layer)` | a frozen array of `{ key, shapes }`, one per item, back to front, `shapes` its description |
| `scene.layerElement(name)` | a foreign layer's `<g>`, for you to draw beneath with the platform's own methods |
| `scene.close()` | `undefined`; removes every layer the scene added, and does nothing when called again |

A layer argument names a layer of items; a foreign layer's name is refused there, and is taken by `layerElement` alone.\
Every answer is frozen, and every function needs no receiver, so `const { put } = scene` works.

With no root, the same calls hold the descriptions alone, so the same code draws where there is no browser, and a test or an export reads `items`:
```js
const { scene } = openScene({ layers: [{ name: "things" }] });
scene.put("things", "a", [{ tag: "circle", attrs: { r: 5 } }]);
console.log(JSON.stringify(scene.items("things")));
```

A scene with no root answers `itemOf` with `null`, and refuses `itemAt`, the conversions and `layerElement`.

### Errors

A malformed argument throws a `TypeError` whose message begins with the function's name and a colon, `put: `, judged before the scene's state, so a closed scene meets it too.\
A call the scene's state does not allow throws an `Error` beginning the same way: any call but `close` once the scene is closed or failed, a `before` naming no item of the layer, `itemAt`, a conversion or `layerElement` with no root, `itemAt` whose document held no `elementsFromPoint`.\
An error the platform throws comes out unchanged; thrown while a put or a removal writes, it leaves the scene failed, and only `close` is left.\
A call made from inside a platform method while the scene writes -- a fake platform's hook calling back, say -- throws, since the scene is not re-entrant there.

---

## Test

The gate builds, runs every test -- among them two tests in headless Chrome driven over the DevTools protocol with trusted input -- then the vocabulary, source, runtime, clock and chance, and export-map checks, and mission-kit's style checks over the Markdown.\
The tests, and the consumer test, run under `clean-runner`'s runner, a development dependency pinned to its release file, which fails a run that leaves a file, a folder or a process behind.

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

Then remove the import-map entry of each page that loads it, or the copy of its files the page serves.

---

## Status

Experimental until mission-kit admits it; it runs in the Node versions `package.json`'s `engines` names, and in browsers that support ES2022 modules.

---

## Documents

- `VISION.md` - why it exists, and what it will never be.
- `CONTRACT.md` - what a consumer can depend on, one capability per row, and every rule.
- `docs/DECISIONS.md` - the rulings about this component, the choices made at each build, and its built size.
- The guide to using `input-capture`, `input-binding`, `vector-scene` and `snap-grid` together, with the tester as its worked example: `docs/GUIDE.md` in `https://github.com/apnex/input-tester`, written with the tester's first release.
