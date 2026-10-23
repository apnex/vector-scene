---
id: unminted
category: component
title: vector-scene - show an application's shapes, held as data in declared layers under its keys, exactly as described
status: draft
hydrate-when: An application draws its own content as SVG and must keep that drawing in step with its data, draw it where there is no browser, or say which of its things a pointer landed on
sovereignty: internal
supersedes: []
related: [C0, A3]
---

# vector-scene

The contract of record for vector-scene, made from section 3 of its design of record, ratified by the director as draw's ruling `H26-11` (`docs/DECISIONS.md` here, `D2`).\
It also carries the fields of a mission-kit registry entry, and that entry is generated from this file when the component is filed, never written as a second copy.\
The registry id is unminted on purpose; one is minted only when the entry is admitted to the registry.

---

## Duty

Show an application's shapes, held as data in declared layers under its keys, exactly as described, and say which shape a platform element belongs to and where a point lies.

That is the whole duty: one scene, kept equal to its description.\
It does not decide what anything looks like or means, find a shape by geometry, read a clock, animate, style or sanitize -- each is the application's or another component's.\
Panning and zooming the viewport, which draw's `H26-1` names in the duty, are held until their first consumer is designed (the design's D6).

---

## Contract

**Vocabulary.**\
These are the only nouns vector-scene's source uses for what it handles.

| Word | Meaning |
|---|---|
| platform | what shows elements and owns the root: a browser, or anything of the same shape |
| root | the platform's element the scene draws into, an `<svg>` in a browser; absent for a scene with no platform |
| layer | a declared, named place in the root, drawn back to front in declared order |
| scene layer | a layer whose content is the scene's items |
| foreign layer | a layer the scene creates and orders, whose content the application draws itself |
| shape | data describing one element: its tag, its attributes, and its text or its child shapes |
| item | the shapes held under one key in one scene layer, shown as sibling elements |
| key | the application's name for an item, unique within its layer |
| description | what the scene holds of an item: its shapes, as last put |
| path | the indices from an item's first list of shapes down to one shape |
| screen point | a point in the platform's screen units |
| drawing coordinates | the coordinates the layers are drawn in: the root's own, while no view is declared (the design's D6) |
| point | a frozen record of finite numbers `x` and `y` |
| screen transform | the platform's affine map from the root's coordinates to the screen |

**Capabilities.**\
What a consumer can depend on, one capability per row.\
A capability is named for what it offers, not for who offers it, so two components that provide the same capability share its name, and the overlap is visible.\
**Provides** means this component implements the capability.\
**Requires** names the capabilities of other components a row depends on, as `component:capability`.\
The trait column names any trait a system takes on by using the capability.

| Capability | Relation | Requires | What a consumer can depend on | Trait |
|---|---|---|---|---|
| `declared-scene` | provides | none | A scene opened from declared layers, on a root or with none, or refused with every problem; closed by removing exactly what it added (VS2 to VS4). | stateful |
| `keyed-shapes` | provides | none | Items of shapes put, replaced, moved and removed by key within a layer, the platform brought to show exactly the description, and the description read back as data that can be put again (VS5 to VS8). | stateful |
| `shape-at-element` | provides | none | The item and path a platform element belongs to, or none -- so the platform's own hit test answers what lies under a point (VS9). | none |
| `screen-conversion` | provides | none | Where a screen point lies in drawing coordinates, and back, through the root's screen transform at the moment asked (VS10). | none |

One capability per row; none requires another component's capability.\
A scene writes its items, reads them back and is relied on to show them, so `declared-scene` and `keyed-shapes` are stateful in T1's sense (the design's section 9).

**Errors.**\
`openScene` never throws while it reads and judges a declaration: it refuses with problems; it throws only an error a platform method threw while it created the layers, after removing every layer it made (VS3).\
Every other function reads and judges its arguments first, in VS2's order, and only then reads the scene's state; `close` takes none.\
A malformed argument throws a `TypeError` whose message begins with the function's name and a colon -- `put: ` -- so a malformed argument to a closed scene meets the `TypeError`; an error a getter or a trap threw while an argument is read is rethrown as that `TypeError`, the thrown value named by its `typeof` alone: a primitive as `String` writes it, an object as "an object", a function as "a function".\
A call the scene's state does not allow throws an `Error`, the base constructor, beginning with the function's name: any call but `close` on a closed or failed scene, any call, `close` among them, made while a put or a removal writes to the platform, a `before` naming no item of the layer, and a conversion or `layerElement` the root cannot answer (VS4, VS10).\
An error a platform method throws propagates unchanged: thrown while the scene writes, it leaves the scene failed (VS7); thrown while it converts, it leaves the scene as it was.\
A message's beginning is the contract and the rest is prose, as `input-binding` and `input-capture` settled.\
Tested by: `test/contract/returned-values-and-errors.test.js`, and each capability's own file.

**What is returned.**\
Every value the scene makes -- an open result, a problem list, a scene, its `layers`, an `items` answer, an `itemOf` answer, a point -- is made afresh by the call that first returns it and frozen to its depth.\
A description is the scene's own frozen copy, made when the item is put and returned by reference afterwards; each shape in it holds `tag` and `attrs`, then `text` when it has text or `children` when it has child shapes, and nothing else, each attribute's value a string, so every description the scene returns is a valid argument to `put`, and putting it again to its own item, with no `place`, calls nothing (VS8).\
Every record holds its properties in the order its form is written here and nothing else; an open result holds `ok`, then `scene` or `problems`; a scene is a frozen object of exactly `layers`, `put`, `remove`, `items`, `itemOf`, `layerElement`, `toDrawing`, `toScreen` and `close`.\
Every function the scene makes needs no receiver and reads no argument beyond those its form names; nothing the application passes is kept, frozen or changed, but the root and the elements it holds.\
Tested by: `test/contract/returned-values-and-errors.test.js` (I8), and each capability's own file.

**VS1 -- What the scene touches of the platform.**\
The scene reaches the platform only through the root the application hands it, and touches exactly:
- of the root: `ownerDocument`, `appendChild` and `getScreenCTM`, each read once, as the scene opens (VS2), the function read being the one it calls, with the root as its receiver, every time;
- of the root's document: `createElementNS`, read once likewise, called with the document as its receiver, the SVG namespace `http://www.w3.org/2000/svg` and a tag;
- of each element it makes: `setAttribute`, `removeAttribute`, `appendChild`, `insertBefore` and `remove`, each called as that element's method when it is used, and its `textContent`, only ever written;
- of a screen transform the root answers, once for each conversion: for `toDrawing` its `inverse`, read and called with the transform as its receiver, and of the transform used, `a`, `b`, `c`, `d`, `e` and `f`, read in that order (VS10).

It reads no other member, reads nothing of an element it made, writes nothing beneath a foreign layer, writes nothing on the root but the layers it appends, and names no global: no `window`, no `document`, no constructor of the platform's.\
So it cannot reach beyond the root it is given, and the same code runs over a browser's elements and over plain objects of their shape.\
Tested by: `test/contract/keyed-shapes.test.js` (I3, the recording test over the root, its document, the elements made and the transforms answered), and the runtime check's platform-member pass (`tools/check-runtime.mjs`, I12).

**VS2 -- How values are read.**\
These are the rules the first three components settled (`SNAP-GRID.md`, `INPUT-BINDING.md` and `INPUT-CAPTURE.md` section 11, each component's decision record, D2), adopted whole:
1. Every value but a point and a screen transform is read as `input-binding` reads one (`INPUT-BINDING.md` section 3.3, IB2 rules 1 to 4, 6, 8 and 9): a plain object's own data properties by descriptor, a property read only where its own keys hold it, an accessor of no form, an inherited property absent, a symbol-named property ignored, a property present as `undefined` of no form, a key whose descriptor reads `undefined` absent, an array dense, of `Array.prototype` and holding no other own string-named key, an index a canonical integer below 2^32 - 1, and a value made in another realm no plain object.
2. A declaration is read breadth first, as IB2 rule 8 reads one: its prototype, its own keys, the descriptors of `root` and `layers` its own keys hold, in that order; then, when `root`'s descriptor holds an object, its `ownerDocument`, that document's `createElementNS`, and its own `appendChild` and `getScreenCTM`, each through ordinary property access and judged as read, the reading of `root` stopping at the first refused; then `layers`, as an array is read -- `Array.isArray`, its prototype, its own keys, the descriptor of its `length`, then of each index in order; then each layer in index order, read whole before the next: its prototype, its own keys, the descriptors of `name`, `attrs` and `foreign` its own keys hold, in that order, and then, unless it is refused at its own pointer, the values those held, in the same order, `attrs` as rule 5 reads a record; a reflection that throws refuses the value it was made on, and nothing beneath a value refused at its pointer is read.
3. Every other function reads its arguments once each, in their order, judging each read as it is made, and throws at the first that is malformed, reading nothing after it: `remove` reads its layer and then its key, `items` and `layerElement` their one name, `itemOf` its value by `typeof` and identity alone, running no trap, and `put` its layer, its key, its shapes as an array is read, each shape whole before the next, and last its `place` -- its prototype, its own keys, the descriptor of `before`.
4. A shape at a depth is read thus: its depth judged first, so a shape nested deeper than VS5 allows is refused with nothing of it read; then its prototype; its own keys, any key but `tag`, `attrs`, `text` and `children` refusing it; the descriptors of those four its own keys hold, in that order, each judged as read; `tag` absent, or both `text` and `children` present, refusing it; and only then its values, in the same order -- `tag`, `attrs` as rule 5 reads a record, `text`, and `children` as an array, each child read whole, at the next depth, before the next.
5. An attribute record is read thus: its prototype; its own keys; then each own string-named key in their order -- its name judged against VS5, then its descriptor read and judged, then its value -- the reading stopping at the first refused.
6. A point given to a conversion, and a screen transform the root answers, are each judged by `typeof` and read through ordinary property access, a browser's being getters: a point's `x` and then its `y`, a transform's `a` to `f` in order, all read before any is judged, as `snap-grid` reads a point.
7. A getter or a trap met while arguments are read is the application's code and may call the scene: the call takes effect at once, and the function reads the scene's state only after its arguments are read and judged (IB2 rule 9).

Tested by: `test/contract/declared-scene.test.js` (the declaration), `test/contract/keyed-shapes.test.js` (shapes, attribute records and places) and `test/contract/screen-conversion.test.js` (points and transforms), each reading order held by a `Proxy` that records each trap.

**VS3 -- Opening and closing.**\
`openScene(declaration)` returns `{ ok: true, scene }` or `{ ok: false, problems }`.\
A declaration is a plain object holding `layers` and, optionally, `root`:
- `root`, an object whose `ownerDocument` is an object whose `createElementNS` is a function, and whose `appendChild` and `getScreenCTM` are functions;
- `layers`, a non-empty array of plain objects, each holding `name`, a non-empty string unique among them, and optionally `attrs`, an attribute record of VS5's form written on the layer's element, and `foreign`, a boolean, `false` when absent.

A problem is `{ pointer, problem }` as `input-binding`'s IB3 defines one, ordered by pointer and then by problem by UTF-16 code unit, no record twice; a check that fails at a pointer suppresses every check beneath it, and none at a sibling's:

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object, or a reflection on it throws | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `root` and `layers`; `layers` absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/layers` |
| 3 | `root` an accessor or not an object, or a member refused as VS2 rule 2 reads it | `invalid-value` at `/root` |
| 4 | `layers` an accessor, not an array of VS2's form, or empty | `invalid-value` at `/layers` |
| 5 | a layer not a plain object, or a reflection on it throws; a property other than `name`, `attrs` and `foreign`; `name` absent | `not-an-object` at `/layers/<i>`; `unknown-property` or `missing-property` at `/layers/<i>/<name>` |
| 6 | `name` an accessor or not a non-empty string; `foreign` an accessor or not a boolean | `invalid-value` at its pointer |
| 7 | `attrs` an accessor, not a plain object, or a reflection on it throws; an attribute of it refused as VS2 rule 5 reads it | `not-an-object` at `/layers/<i>/attrs`; `invalid-value` there |
| 8 | among valid names, one equal to an earlier one | `duplicate-name` at the later one's `/layers/<i>/name` |

**The lifecycle,** each rule stated here once:
1. With a root, `openScene` calls no platform method until the declaration is judged; then, for each layer in order, it makes a `<g>`, sets the layer's attributes on it in order, and appends it to the root, after whatever the root already holds.
2. If a platform method throws while it does so, it calls `remove` on every layer element it made -- the one in progress first, which does nothing to an element the root never took -- and then the others in reverse of the order made, attempting each, and throws the error first thrown, unchanged; nothing is left in the root.
3. With no root it makes nothing; its scene holds and reads back data alone.
4. A scene is *open* until `close` is first called, *closed* from then on, and *failed* from the moment a platform method throws while it writes (VS7); every function but `close` throws Errors' `Error` once it is closed or failed, and every function, `close` among them, throws it while a put or a removal writes to the platform, changing nothing, since it is not re-entrant there.
5. `close()`, on its first call not made while a put or a removal writes, marks the scene closed first, then calls `remove` on every layer element it made, in reverse of the order made, attempting each, and throws the first error a removal threw, unchanged, or returns `undefined`; every later call -- one made from inside a removal among them -- returns `undefined` and calls nothing, as `input-capture`'s IC3 settled, and any other function called from inside a removal throws, the scene being closed; removing a layer removes every element the scene made beneath it.

So no element the scene made outlives a failed opening or a close unless a removal threw.\
Tested by: `test/contract/declared-scene.test.js` (I1, I2).

**VS4 -- Layers.**\
A scene layer holds items, back to front in the order VS6 places them; a foreign layer holds whatever the application draws beneath the element `layerElement(name)` answers, which the scene never writes beneath, reads or removes but as VS3 removes every layer.\
A layer's element is the scene's: the application writes nothing on it, foreign or not, and nothing beneath a scene layer's, so the scene can give every layer what a view needs when one arrives (the design's D6).\
`layers` is a frozen copy of the declaration's layers, each `{ name, attrs, foreign }`.\
`layerElement(name)` answers a foreign layer's element; a name that is no foreign layer is malformed, and a scene with no root refuses.\
A function taking a layer takes the name of a scene layer; any other value, a foreign layer's name among them, is malformed.\
Tested by: `test/contract/declared-scene.test.js`.

**VS5 -- Shapes.**\
A shape is a plain object holding `tag`, and optionally `attrs`, and `text` or `children`, but not both, and nothing else:
- `tag`, a string of an ASCII letter followed by ASCII letters, digits and hyphens, the element's local name in the SVG namespace;
- `attrs`, an attribute record: a plain object whose every own string-named property is a data property whose name is an ASCII letter or underscore followed by ASCII letters, digits, underscores, periods and hyphens, not beginning with `on` in any case, and whose value is a string, or a finite number written as JavaScript's `String` writes it, so `-0` is written `0`;
- `text`, a string, the element's text content, `""` meaning none;
- `children`, an array of VS2's form of shapes, the element's children in order, empty meaning none.

An item's shapes are an array of at least one shape; shapes nest at most 32 deep, an item's own shapes at depth 1.\
No attribute name can be an array index, so a description's attributes keep the order the record's own keys gave them.\
The scene judges a shape's form, never its meaning: it refuses an event-handler attribute, since a description is data, but it is no sanitizer -- a `script` element, a `javascript:` URL or an animation that sets one is the application's to keep out of what it describes, and an application drawing what it does not trust sanitizes it first.\
Tested by: `test/contract/keyed-shapes.test.js` (I5).

**VS6 -- Putting and removing.**\
`put(layer, key, shapes, place?)` makes `shapes` the description of the item `key` in `layer`, and returns `undefined`:
- `key` is a non-empty string; `place`, when given, is a plain object holding at most `before`, which is `null` or a non-empty string other than `key`;
- an item not in the layer is placed before the item `before` names, or last when `before` is `null` or `place` holds none;
- an item in the layer keeps its place when `place` holds no `before`, and otherwise is moved before the item `before` names, or last when `before` is `null`, whether or not it stands there already, as draw's stacking inserts each element it places;
- a `before` naming no item of the layer throws Errors' `Error`, after the arguments are read and before anything changes.

`remove(layer, key)` takes the item out of the layer, its elements with it, and returns `undefined`; a key the layer does not hold changes nothing.\
`items(layer)` answers a frozen array of frozen `{ key, shapes }`, one per item, back to front, `shapes` its description.\
Tested by: `test/contract/keyed-shapes.test.js`.

**VS7 -- Bringing the platform to the description.**\
With a root, each put and removal makes exactly these platform calls, in this order, and reads nothing of the platform:
1. A shape's element is made by `createElementNS` with its tag; then each attribute set, in order; then its text written to `textContent` when it has text; then each child's element made the same way, depth first, and appended; and only then is it inserted where it goes.
2. A new item's elements are inserted, in order, before the first element of the item it is placed before, or appended to the layer.
3. An item put again is brought from its old shapes to its new list by list -- its own shapes, and the children of every element kept -- position by position: where both lists hold a shape of the same tag, the element is kept and patched (step 4); where the new list holds a shape and the old none, or one of another tag, a new element is made and inserted before the old element at that position or, past the old list's end, appended to its parent, an item's own shapes being inserted before the next item's first element or appended to the layer when the item is last; then the old element there, if any, is removed; and the old elements past the new list's end are removed, in order.
4. An element is patched by setting each new attribute whose value differs or which the old lacked, in the new order, and removing each old attribute the new lacks, in the old order; then its content: text to text, the new text written when it differs, `""` among them; text to children, `""` written when the old text was not, then each child made and appended; children to text or to none, each old child removed, in order, then the new text written when there is one; children to children, the lists compared as step 3 compares them.
5. An item moved has its elements inserted, in order, before the first element of the item named, or appended to the layer, once step 3 has brought them to their new shapes.
6. An item removed has each of its elements removed, in order.

So every element under a scene layer shows exactly its description -- attributes in description order on an element made, an added attribute last on an element kept, as the platform orders them -- and the scene writes only what its descriptions differ by, so it neither reads nor restores what anything else writes on an element it made.\
An element keeps its identity while its shape keeps its position and its tag, so a pointer captured to it, a transition running on it and a hover on it outlast every put that keeps it; an application whose shapes gain or lose a sibling before an element it needs kept puts that element in an item of its own.\
If a platform method throws, the scene is failed, the error propagates unchanged, no further call is made, and what was written stays; only `close` is left, so what the scene holds of a half-written put is never read.\
With no root, put and remove change the descriptions alone, as they would with one.\
For arguments whose reading runs no application code, the same sequence of calls gives the same platform calls and the same descriptions.\
Tested by: `test/contract/keyed-shapes.test.js` (I4, against a model of VS7 written apart, `test/support/vs7-model.js`; I6), and in Chrome by `test/browser/real-chrome.test.js` (I10).

**VS8 -- Reading back.**\
`items` and `layers` are the scene's whole state but which elements it made: putting each layer's items, in order, into a fresh scene opened with the same layers gives equal items, and a scene with no root answers them as one with a root would.\
Tested by: `test/contract/keyed-shapes.test.js` (I6, I8).

**VS9 -- The shape at an element.**\
`itemOf(value)` answers a frozen `{ layer, key, path }` when `value` is an element the scene made for a shape of an item it holds, `path` a frozen array of the shape's indices from the item's own shapes down; and `null` for any other value -- a layer's element, a foreign layer's content, the root, an element the scene removed, anything the scene did not make.\
It reads nothing of `value`, so it runs no application code; given the target of a pointer event, it answers what the platform found under the point; like every function but `close`, it throws once the scene is closed or failed, and while a put or a removal writes.\
Tested by: `test/contract/shape-at-element.test.js` (I7), and in Chrome with trusted presses by `test/browser/real-chrome.test.js` (I10).

**VS10 -- Conversions.**\
`toDrawing(screen)` answers where a screen point lies in drawing coordinates, and `toScreen(point)` the reverse:
1. the point is read as VS2 rule 6 says, and refused unless its `x` and `y` are finite numbers;
2. the scene's state is judged, and a scene with no root refused;
3. the root's `getScreenCTM` is called, and an answer that is not an object refused;
4. for `toDrawing`, the answer's `inverse` is read, refused unless a function, and called with the answer as its receiver, and what it answers refused unless an object;
5. `a`, `b`, `c`, `d`, `e` and `f` of that transform are read as VS2 rule 6 says, and refused unless each is a finite number;
6. the answer is the frozen point `{ x: a * x + c * y + e, y: b * x + d * y + f }`, each evaluated left to right in binary64, and refused unless both are finite.

Each refusal of steps 2 to 6 is Errors' `Error`; an error the platform throws at steps 3 to 5 propagates unchanged and leaves the scene open; a call the transform's getters make on the scene takes effect, and the conversion answers from the transform it read.\
So a singular transform -- a root scaled to nothing -- is refused either way: a `DOMMatrix`'s inverse answers `NaN` members, which step 5 refuses, and Chrome's `SVGMatrix` throws `InvalidStateError` from `inverse`, which propagates.\
That is the arithmetic of `DOMPoint`'s `matrixTransform` for a two-dimensional matrix, so over a transform of finite numbers a conversion answers exactly what `new DOMPoint(x, y).matrixTransform(matrix)` answers, and follows whatever the platform's screen transform includes -- the root's place on the screen, its `viewBox`, its letterboxing.\
Tested by: `test/contract/screen-conversion.test.js` (I9), and against `DOMPoint` in Chrome by `test/browser/real-chrome.test.js` (I10).

**VS11 -- Exports.**\
`@apnex/vector-scene` exports `openScene`, and nothing else; it has no subpath.\
It imports no package and no module particular to one runtime, names and declares no global, touches no platform object but those VS1 names, and reads no clock and no randomness and holds no timer, so it runs over a browser's elements and, where there is no browser, over plain objects of their shape or with no root at all.\
Its TypeScript declarations state the platform slice VS1 touches as its own structural types, so a browser's `<svg>` element is assignable as a root; a shape's properties are read-only, and the type of a returned description is assignable to `put`'s.\
The slice is generic in the kind of element the root's document makes, so a browser's root makes `layerElement` answer its `Element`, and a root of plain objects, or none, the slice's own `SceneElement` (`docs/DECISIONS.md`, `D2`).\
Tested by: `test/contract/public-surface.test.js`, `test/contract/public-types.test.js` (I11, compiled from `test/types/`), the source check (`tools/check-source.mjs`), the runtime check (`tools/check-runtime.mjs`), the clock and chance check (`tools/check-clock-and-chance.mjs`), the real-Chrome test (`test/browser/`, I10) and the consumer test (`tools/consumer-test.mjs`).

**Invariants.**\
There is no conformance kit (the design's D10): nothing in vector-scene is a port another party implements.\
*vector-scene* marks what the component's own tests hold; *gate* what its gate holds.

| # | Invariant | Held by |
|---|---|---|
| I1 | `openScene` never throws while it judges a declaration, and answers every declaration with exactly VS3's problems, from a table of cases: present `undefined`, accessors, a phantom key, a revoked and a trapping `Proxy`, a declaration whose descriptor read throws -- `not-an-object` at `""`, nothing further read -- a function as the root, a root lacking each member in turn, each layer refusal, `attrs` refused whole and nothing beneath it checked, a duplicate name beside an invalid one, a value from another realm. | vector-scene |
| I2 | A rooted scene's layers are made and appended in order with their attributes; a throw at each platform call of opening, before or after the root takes the layer, leaves the root as it was and throws that error; `close` removes every layer in reverse, attempting each when one throws, then throws the first; a second `close` calls nothing, as does a `close` made from inside a removal, while a `put` made from there throws and, uncaught, is that removal's error; every other function throws once closed or failed; a platform method re-entering any function, `close` among them, while a put or a removal writes is refused and changes nothing. | vector-scene |
| I3 | The scene touches nothing of the platform outside VS1: with a recording root, document, made elements and transforms, an opening, puts that create, patch, move and replace, a removal, both conversions and `close` log exactly VS1's reads, once each, and VS7's calls in order, and no read of a made element. | vector-scene |
| I4 | Over generated sequences of puts, moves and removals on a rooted scene, after every call the elements under each scene layer equal the descriptions `items` answers, each element's attributes compared as a map from name to value and an element made holding them in description order; each call made exactly VS7's platform calls, against a model of VS7 written apart. | vector-scene |
| I5 | Every reading of VS2 and VS5 from a table of arguments, each order held by a `Proxy` that records each trap: each refusal at each place stopping the reading there, a malformed argument refused before a closed scene's state is read, an accessor attribute refused with no getter run, a shape at depth 33 refused with nothing of it read, a shape holding both `text` and `children` refused before its `attrs` is read, a trap that calls the scene taking effect first, an `on` attribute in any case refused, a number written as `String` writes it, `-0` as `0`. | vector-scene |
| I6 | The same sequence on a scene with no root and on a rooted one gives equal `items` after every call. | vector-scene |
| I7 | `itemOf` answers every element made, at every depth, with its item and path, after patches and moves; `null` for a layer element, a foreign layer's content, the root, a removed element, a primitive and a `Proxy`, whose traps never run; and throws once the scene is closed or failed. | vector-scene |
| I8 | Every returned value is fresh and frozen to its depth; a description is the very value `items` answers again, holds `text` or `children` only when not empty, and is accepted by `put`, putting it again calling nothing; putting each layer's items into a fresh scene gives equal items; keys in their written order; no function needs a receiver. | vector-scene |
| I9 | Conversions compute VS10's arithmetic over recorded transforms, `-0` and extreme values among them; refuse a point that is no object, holds a non-finite coordinate or is read through a throwing getter; refuse with `Error` no transform, an `inverse` that is no function or answers no object, a member not a finite number -- a string, or the `NaN` a singular `DOMMatrix` inverse answers -- and an answer that overflows; and let a throwing getter's or `inverse`'s error out unchanged, the scene still open. | vector-scene |
| I10 | In headless Chrome, on an SVG root scaled and offset in its page: puts, patches, moves and removals leave each layer's elements equal to `items` as I4 compares them; an element kept across a sibling item's insertion keeps a running transition; a trusted press on a child shape, on an item's own shape, on the ground and in a foreign layer is mapped by `itemOf` of its target to that item and path, or `null`; `toDrawing` and `toScreen` equal `DOMPoint`'s `matrixTransform` over the root's screen transform for thousands of points; `close` leaves the root as found; Chrome is launched and torn down as `input-capture`'s I10 settled, so the test can neither fail nor hang on teardown. | gate |
| I11 | A consumer compiled with `tsc --noEmit` under strict settings, with and without `exactOptionalPropertyTypes`, passes an `SVGSVGElement` as `root` and an `items` answer's shapes to `put`, and lines that write a shape's property or give both `text` and `children` must fail to compile. | vector-scene |
| I12 | The source names no consumer's vocabulary and declares no global; the built files import no package, name no runtime global, no clock, timer or source of chance, and no route to `Function` (the design's section 7). | gate |

I10 is held by `test/browser/real-chrome.test.js`, which the gate runs; I12 by `tools/check-vocabulary.mjs`, `tools/check-source.mjs`, `tools/check-runtime.mjs` and `tools/check-clock-and-chance.mjs`, whose own tests are `test/tools/gate-checks.test.js`.

---

## Reference

This repository, `apnex/vector-scene`, and its package `@apnex/vector-scene`, released only by its own CI as a tarball attached to a GitHub release, drafted, verified and then published (`.github/workflows/release.yml`).\
The package exports `openScene` from its one path, as `export-map.json` records.\
The code is TypeScript in `src/`, built to `dist/`, which only a release holds.\
The tests are in `test/`: one file per capability in `test/contract/`, with `returned-values-and-errors.test.js`, `public-types.test.js`, `public-surface.test.js` and `contract-coverage.test.js` beside them; I10's page and its test in `test/browser/`; I11's consumer in `test/types/`; the fake platform, the recording platform, the model of VS7 and the generator in `test/support/`; and the gate checks' own tests in `test/tools/`.\
The gate, `npm run gate`, builds, runs the tests -- the real-Chrome test among them -- then the vocabulary, source, runtime, clock and chance, and export-map checks in `tools/`, and mission-kit's style checks.\
The design of record is draw's `dev/design/components/VECTOR-SCENE.md` (`apnex/drawv2`), whose section 3 this contract carries, whose section 4 holds the invariants above, and whose section 7 states where this repository differs from the shared parts `snap-grid` settled and `input-binding` and `input-capture` built again.

---

## Fit criteria

**Does my project want this at all?**
- An application draws its own content as SVG and keeps that drawing in step with its data as the data changes.
- The same drawing must also be produced where there is no browser, from the same code.
- Something must say which of its things a pointer landed on, by the platform's own hit test.

**It is the wrong tool when:**

| You need | Reach elsewhere, because vector-scene is |
|---|---|
| what an input means, or a pointer's events as facts | not an input layer: that is `input-binding` and `input-capture` |
| what a thing looks like, its styles or its state's meaning | not a theme: the application describes every attribute |
| a shape found by geometry, with no platform | not a geometry engine: it answers by the platform's elements (the design's D4) |
| panning or zooming the view | not yet: held until its first consumer is designed (the design's D6) |
| animation run frame by frame, or a canvas or WebGL drawing | not an animator: draw it in a foreign layer (the design's D5) |
| HTML elements | not a page builder: every shape is an SVG element |
| SVG from an untrusted source drawn safely | not a sanitizer: it judges a shape's form, never its meaning (VS5) |

---

## Adjustment policy

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting vector-scene or by fracturing it if the gap reveals a second duty; never forked.

---

## Edges

**Contains:** the layers, the descriptions, the bringing of the platform to them, the element-to-item map, the conversions.\
**Consumes:** nothing.\
**Consumed-by:** draw (H26.4), then the gesture tester (H26.5); named later, zorg's web canvas (zorg D31, D35).

The tester draws its keys and mouse as items, lights one by putting it again with another class, asks `itemOf` with `input-capture`'s target to know which key a pointer is over, and hands `toDrawing` to `input-capture` as its conversion.
