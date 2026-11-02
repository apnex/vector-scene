# Decisions

One ruling per entry, append-only.\
A ruling is never edited; a later one supersedes it and says so.

Rulings that shape this component together with its first consumer are held in draw's `dev/DECISIONS.md` (`apnex/drawv2`), and cited here as "draw's `Hn-m`".

---

## D1 - The component stands in its own public repository

**Ruled by:** the director, 2026-10-20 (draw's `H26-1` and `H26-2`), and 2026-10-23 (draw's `H26-11`, the design's D11).\
**Affects:** this repository, its package and its releases.

**Ruling.**\
vector-scene is a component of its own, in the public repository `apnex/vector-scene`, its package `@apnex/vector-scene`, released from its own CI as `0.1.0`, its one export path `.`, and taken by draw as a release file pinned by its hash.\
Its versions are `0.x` until mission-kit admits it to the component registry.

**Why.**\
Each component holds its own boundary and its own history from the start, so a consumer composes it through a declared contract rather than a copy, and a second consumer can adopt it without a fork.

---

## D2 - The contract of record is draw's ratified design

**Ruled by:** the director, 2026-10-23 (draw's `H26-11`).\
**Affects:** `CONTRACT.md`, `VISION.md`, `src/`, `test/`, `tools/` and `.github/workflows/`.

**Ruling.**\
The contract of record is section 3 of draw's `dev/design/components/VECTOR-SCENE.md`, revision 3, ratified with all thirteen of its decisions as recommended, D1, D6 and D8 as the director answered them; `CONTRACT.md` carries it, its section 4 holds the invariants and tests, and its section 7 states where this repository differs from the shared parts `snap-grid` settled and `input-binding` and `input-capture` built again.\
`VISION.md` is that design's appendix A, ratified as written.\
Its sections 5 and 6 and appendix B are draw's move onto the component, made in draw, not here.

**Choices made at build.**\
Where section 3 was silent or left a choice open, the build made these; each that a test can hold is held by one, and each that a consumer can observe is stated here:
- The TypeScript declarations are generic in `E`, the kind of element the root's document makes: `ElementSlice<E>` states what VS1 touches of an element, `SceneElement` is the slice over its own kind, and `SceneRoot<E>`, `SceneDocument<E>`, `SceneDeclaration<E>`, `Scene<E>` and `OpenSceneResult<E>` carry it, each defaulting to `SceneElement`. A structural type of the scene's own cannot be what a browser's `appendChild` takes -- it takes the platform's own kind of object -- so a browser's `<svg>` was not assignable to a slice whose elements were of one fixed type; carried through, a browser's root makes `E` its `Element`, and `layerElement` answers the platform's own element, drawn beneath with the platform's own types. The members that take an element are function-typed properties, not methods, so `E` is inferred from what `createElementNS` answers: a method's parameters are compared both ways, so TypeScript inferred from a browser's `appendChild` too and widened `E` past `Element`.
- What a put keeps of its shapes is a tree of its own, from which its frozen description is made, so the scene compares, writes and answers from these and never reads the application's values again. A description's attribute record is made by defining each attribute, never assigning it, so a name such as `__proto__` is an own property like any other, and the record's prototype is `Object.prototype`.
- Putting the scene's own description again makes a new frozen copy of it, equal and not identical, since a description is "made when the item is put"; it calls nothing on the platform.
- A `createElementNS` answering a value that is not an object is a platform failure: it throws `Error` beginning with the function's name -- `openScene: `, `put: ` -- inside a put it fails the scene as a throw would, and while the scene opens it takes back the layers made, as lifecycle rule 2 says.
- The scene writes only during the platform calls of one put or removal; a scene with no root makes none, so it is never writing, and nothing re-enters it there.
- `put` reads its layer, its key, its shapes and its place, then judges the scene's state, then looks for the item `before` names, which throws `Error` when the layer holds none, and only then writes. `place` passed as `undefined` is the same as no `place`; `null` is malformed, as any value that is no plain object is.
- `remove` of a key the layer does not hold judges the scene's state first, so it throws `Error` on a closed or failed scene, and otherwise calls nothing.
- `itemOf` judges its value by `typeof` -- an object or a function can be an element -- then the scene's state, then looks the value up by identity in a `WeakMap` from each element made to its item and path; a `Proxy` of an element is not that element, and none of its traps runs.
- `layerElement` judges its name -- a foreign layer's, or the `TypeError` -- then the scene's state, then whether there is a root, the `Error` when there is none.
- `close` on a closed scene answers `undefined` before anything else, so a `close` made from inside a removal, the scene being closed already, calls nothing; on a failed scene it removes the layers like any other first call.
- A layer's `attrs` present as `undefined` is `not-an-object` at `/layers/<i>/attrs`, as any value that is no plain object is.
- The problems are ordered by pointer by UTF-16 code unit, so `/layers/10/name` comes before `/layers/2/name`, and `/layers/0/nam` before `/layers/0/name`.
- The runtime check (`tools/check-runtime.mjs`) gains a platform-member pass: every member TypeScript's own `lib.dom.d.ts` declares on `Document`, `XMLDocument`, `DOMMatrix`, `DOMMatrixReadOnly` and every SVG element interface, and on every interface they extend -- 98 interfaces and 700 member names, as TypeScript 5.9.3 declares them -- is a platform member, and a built file may name only VS1's slice among them, and `x` and `y`, which the scene reads of a point and an SVG element also holds. A member named by dot, by brackets with a string literal, in a destructuring pattern, on the left of `in`, or as the literal key of a `Reflect` call is found; a member reached by a computed key is beyond any static check, and the recording test (I3) holds what the scene touches at run time. Falsifiers and controls are in `test/tools/gate-checks.test.js`, `getAttribute`, `childNodes` and `getBoundingClientRect` among them.
- The runtime check refuses an identifier named `document` anywhere but as a member's name, so the source names the root's document `rootDocument`.
- The source check (`tools/check-source.mjs`), copied from `input-capture`, found a comment of a triple-slash directive's form with a bare TypeScript scanner, which reads a template literal's text after its first substitution as code, so a directive anywhere after such a template went unseen: planted at the end of `src/conversion.ts`, `/// <reference lib="dom" />` passed. It now collects every comment from the parsed tree -- the leading and trailing comment ranges of each token, the end-of-file token's among them -- and `test/tools/gate-checks.test.js` holds the plant, which fails the copied check and passes this one. A note: `input-capture`'s copy has the same hole.
- The I3 recording test is in `test/contract/keyed-shapes.test.js`, as section 4 lists I3 there; its platform is `test/support/recording-platform.js`, a root, a document, the elements it makes and the transforms it answers, each a `Proxy` that logs every trap and each method logging its call into one log, a value named there by a label looked up by identity, so the log reads nothing of what it names. Calling an element's method reads that method, so the log holds `<element> get appendChild` before each call; it holds no other read of a made element.
- I4's model of VS7 is `test/support/vs7-model.js`, written from VS7's text and importing nothing of `src/`; the generated sequences are `test/support/generate.js`, a seeded xorshift128+ source whose seed `VECTOR_SCENE_SEED` changes, run as 60 sequences of 60 calls over two scene layers, beside a scene with no root (I6); the fake platform is `test/support/fake-dom.js`, its `appendChild` and `insertBefore` detaching a child they move, its `setAttribute` keeping an attribute's place and adding a new one last, its `textContent` replacing the children.
- I7 holds, over generated sequences, every element the scene made and then removed, at any depth, to `null`, beside every element it holds to its item and path; and a test removes an item, replaces its shape with one of another tag, and gives its children way to text, each time finding every element beneath the one removed answering `null`. A mutation of the build that forgot a removed element's children, but not the element, survived the first tests, which asked only of elements the scene removed directly.
- I11's consumer is `test/types/scene-consumer.mts`; beyond compiling it, `test/contract/public-types.test.js` compiles it again with every `@ts-expect-error` directive taken out, in a scratch project that links the package, and finds each expected error on its own line and no other line failing, so no expected error passes for a reason not its own.
- I10's root lies 40 pixels right and 20 down its page, 437 by 300 pixels showing a `viewBox` of 200 by 100 units, so it is scaled by 2.185 and letterboxed 40.75 pixels down, and its screen transform is no identity. The page runs the generator the Node.js tests use, which the test's static server answers from `test/support/`, and checks every scene layer after each of 600 calls, an element first met since the last call holding its attributes in description order. The transition runs on a `style` attribute patched from one opacity to another, then a sibling item is inserted before its item, another put after it, and its own item patched again; the transition is the same object, still running. The presses are dispatched through the DevTools protocol's `Input` domain at the centres of the targets' boxes; the conversions compare 3,000 points each way against `DOMPoint`, special values `-0` and extremes among them, at two widths of the root, and where `DOMPoint` answers a number that is not finite, the scene's answer is the `Error`.
- I10's teardown, `input-capture`'s, also removes the directory Chrome makes in the scratch directory for its singleton socket, named by the link `SingletonSocket` in its profile -- only a directory directly in the scratch directory and named as Chrome names it -- since a Chrome whose process group is killed never removes it, and one was left behind by every run; `test/browser/teardown.test.js` holds what it removes and what it leaves. The consumer test's Chrome exits of itself and removes its own. A note: `input-capture`'s driver leaves one such directory per run.
- The consumer test's exercise opens a scene with no root in Node.js and on an `<svg>` element in the page, as section 7 says; in the page it finds the element made by its id, asks `itemOf` of its child, compares `toDrawing` with `DOMPoint` over the element's own screen transform, and finds the root as it was after `close`.
- Beyond the four capability files the design's section 4 names, `test/contract/` holds `returned-values-and-errors.test.js`, `public-types.test.js`, `public-surface.test.js` and `contract-coverage.test.js`.
- `CONTRACT.md` carries section 3 with the design's section and decision references written "the design's", each rule followed by the tests that hold it, section 4's invariants, and section 3.5's Reference under its own heading, as SC6 orders the six.
- The vocabulary lists are `snap-grid`'s, both of them, unchanged; no word of either is needed, so no allowance is asked. Section 7's traps are held by `test/tools/gate-checks.test.js`.
- `tools/measure-size.mjs` measures the built size, every built module being loaded together through the one export path.

**Errata to raise against draw's design** (`VECTOR-SCENE.md`, for its section 10):
1. VS11 says the declarations state the slice as structural types "so a browser's `<svg>` element is assignable as a root". With one fixed element type that holds only if the members taking an element take `never` or `any`: `never` leaves the scene's own calls untypeable, `any` gives up the scene's own typing of what it passes, and either way `layerElement` answers the scene's own element type rather than the browser's `Element` the application draws beneath with. So the generic is chosen, and the sentence should say the slice is generic in the kind of element the root's document makes, as the first choice above records.
2. I3 says the log holds "no read of a made element", and VS7 that a put "reads nothing of the platform"; calling an element's method reads that method. The sentences should say: no read of a made element but of the methods VS1 calls on it.
3. VS4 says `layers` is "a frozen copy of the declaration's layers, each `{ name, attrs, foreign }`"; the build answers each layer's `attrs` as VS5 writes attributes -- `{ n: 2, z: -0 }` as `{ "n": "2", "z": "0" }` -- and `{}` when none were declared, and `foreign` as `false` when absent, so `layers` is data of one form, as a description's attributes are. The sentence should say so.
4. VS7 step 4 says each old attribute the new lacks is removed "in the old order"; the build removes them in the old description's order, which is the order the platform holds them in only on an element made, since on an element kept an added attribute stands last. The sentence should say "in the old description's order".

**After the run-verifier's seal of `831ea6a`.**\
An independent run-verifier sealed the build and left notes S1, S2 and N1 to N6; each is settled here:
- S1 -- erratum 1 above gives why a fixed element type does not serve: only `never` or `any` parameters make a browser's `<svg>` assignable, losing the scene's own typing and making `layerElement` answer the scene's own type rather than the browser's, so the generic is chosen.
- S2 -- `scene.layers[i].attrs` holds the layer's attributes as VS5 writes them, `{ n: 2, z: -0 }` answered as `{ "n": "2", "z": "0" }`, and `{}` when none were declared; `test/contract/declared-scene.test.js` holds it, and erratum 3 raises it.
- N1 -- old attributes are removed in the old description's order, not the order the platform holds them in, which differs on an element kept once an attribute was added to it; `test/contract/keyed-shapes.test.js` holds a case where the two orders differ, and erratum 4 raises VS7 step 4's wording.
- N2 -- an array is judged as its keys are read: a stray key -- an own string-named key that is neither `length` nor an index -- refuses it at its own keys, before the descriptor of `length` is read, and a sparse array is refused right after that descriptor is read, before any index's. The note placed both after `length`; the stray key's refusal is one step sooner, and the recording tests in `keyed-shapes.test.js` (an item's shapes) and `declared-scene.test.js` (a declaration's layers) hold each place.
- N3 -- an element the root's document made that holds no function by one of VS1's method names, or whose `textContent` cannot be written, is a platform failure like an answer of `createElementNS` that is no object: an `Error` beginning with the function's name -- `put: `, `remove: `, `openScene: `, `close: ` -- the scene failed within a put or a removal, the layers taken back within an opening, and every removal still attempted within `close`. The first build called the method, so the engine's `TypeError` came out, which reads as a malformed argument. Each method is still read once, as it is called, by name, so the recording test's log is unchanged; the text is written by `Reflect.set`, whose answer says whether the element took it. `test/contract/returned-values-and-errors.test.js` holds an element with no method at all, one missing each method in turn where VS7 calls it, one whose text cannot be written, a layer that cannot take its attributes, and a layer that cannot be removed; the test fails against the first build.
- N4 -- the runtime check's platform-member pass also finds a DOM member outside VS1's slice named as the literal key of `Object.getOwnPropertyDescriptor`, `Object.hasOwn` or `Object.defineProperty`, beside `Reflect.has`, `Reflect.get` and the rest of `Reflect`'s keyed calls and `in`, which it found already, and as the literal argument of `hasOwnProperty`, `propertyIsEnumerable` or a `__lookupGetter__`-like method, called directly or through `call`; `test/tools/gate-checks.test.js` holds a falsifier for each form and controls for a variable key and for the slice's own members.
- N5 -- the runtime check allows only the globals the build uses, where it banned a list of names: every identifier that TypeScript's checker, over the file alone and with no library, finds refers to no declaration of the file must be one of `ALLOWED_GLOBALS` -- `Array`, `Error`, `JSON`, `Map`, `Math`, `Number`, `Object`, `Reflect`, `Set`, `String`, `TypeError`, `WeakMap` and `undefined` -- so `MessageChannel`, `EventSource`, `Worker`, `BroadcastChannel`, `RTCPeerConnection`, `Atomics` and every other platform global fail, named, constructed, under `typeof` or as a shorthand property. A test holds the list to exactly the globals the built files name, so a built-in the build stops using leaves the list too; the controls hold a name the file declares in the scope, a parameter, a destructured binding, an import, a member, an object key, a label, a string and a comment, and a name declared in another function, which does not cover a free one here. The banned list's pass is kept beside it, so `{ self: 1 }` is still found. `input-capture`, `input-binding` and `snap-grid` should take the allow-list, and N4's forms, at their next release; the run-verifier registers it.
- N6 -- `input-capture`'s source check misses `/// <reference lib="dom" />` placed after a template literal with a substitution, and its I10 teardown leaves Chrome's singleton-socket directory in the temporary directory at every run; both are fixed here, as the choices above record, and are to be fixed in `input-capture` at its next release; the run-verifier registers them.

**The tag `v0.1.0`, moved before any release was published.**\
The first release run of `v0.1.0`, at `2b819a3`, created its draft and then failed: the list of releases it reads to find the draft's id did not yet hold the draft, which GitHub's API shows a few seconds after the create.\
No release was published; the draft was deleted, the lookup made to retry for up to a minute (the commit after `2b819a3`), and the tag deleted and pushed again at the commit holding this record, by the repository's administrator, the one bypass the tag ruleset allows -- as `input-capture`'s was.\
The same lookup stands unretried in `snap-grid`'s, `input-binding`'s and `input-capture`'s release workflows, to be fixed at their next release.

**Built size.**\
Measured by `tools/measure-size.mjs` over `dist/` as built after the run-verifier's notes, as the design's section 7 asks: every built module is loaded wherever `openScene` is imported.\
Bytes as shipped, comments included, then with comments removed, each also gzipped at level 9:

| Files | Bytes | Gzip | No comments | Gzip |
|---|---|---|---|---|
| `open-scene.js` | 13,803 | 3,760 | 10,517 | 2,585 |
| `shape-reading.js` | 7,669 | 2,522 | 5,194 | 1,652 |
| `declaration-reading.js` | 7,556 | 2,103 | 5,415 | 1,325 |
| `scene-writing.js` | 5,849 | 1,695 | 4,919 | 1,313 |
| `reflection.js` | 5,569 | 1,853 | 3,113 | 931 |
| `argument-reading.js`, `conversion.js`, `declaration-problems.js`, `index.js`, `types.js` | 10,413 | 4,148 | 5,653 | 2,046 |
| every built module | 50,859 | 16,081 | 34,811 | 9,852 |

---

## D3 - The contract of record for 0.2.0 is draw's ratified RELEASES-0.2.md, revision 4

**Ruled by:** the director, 2026-10-24 (draw's `H26-14`, every decision RD1 to RD19 at its recommendation).\
**Affects:** `CONTRACT.md`, `README.md`, `src/`, `test/`, `tools/`, `export-map.json` and `package.json`.

**Ruling.**\
The contract of record for `0.2.0` is section 3.3 of draw's `dev/design/components/RELEASES-0.2.md`, revision 4, with what its section 3.5 gives every component -- the contract freed of draw's files and design (RD15), the consumer reference (RD16), the gate's checks of B424 stated for this component (RD13), and the vocabulary list renamed -- under its guardrails GR1 to GR5.\
`CONTRACT.md` carries VS1 and VS2 widened by the document's `elementsFromPoint`, VS12 (`itemAt`, RD10), VS13 (the root's attributes the application's, RD11), the scene's ten keys, the capability row `shape-at-point`, the new fit criterion and Edges sentence, and I13 to I15 as the design gives them, each rule stated on its own terms with one provenance line under Reference.\
D2 stands for everything `0.2.0` leaves unchanged.

**Choices made at build.**\
Where section 3.3 was silent or left a choice open, the build made these; each a test can hold is held by one:
- `elementsFromPoint` is read by the same guarded ordinary access as the root's other members (`readMember` in `src/declaration-reading.ts`); a read that throws refuses the root, a value that is no function is kept as `null`, and the function kept is the one each `itemAt` calls.
- The walk of the hit stack is its own module, `src/shape-at-point.ts`, named for the capability; it reads the answer through ordinary access, `length` once and then each index by number, and passes over a primitive without looking it up, since only an object or a function can be an element the scene made.
- `itemAt` refuses a scene with no root before one whose document held no `elementsFromPoint`, so a scene with no root says so whatever it was opened from; step 5 judges `state` alone, since a scene cannot be writing there, a write being finished before any getter of the answer can run.
- `itemAt` and `itemOf` share one function that makes the frozen `{ layer, key, path }` from an element's record, so the two answer the same record for the same element.
- The types: `SceneDocument` gains `elementsFromPoint?(x: number, y: number): readonly unknown[]`, optional, so a browser's `Document` and a document of plain objects with or without it are each assignable; `Scene` gains `itemAt: (screen: ScreenOrDrawingPoint) => ShapeAtElement | null` after `itemOf`. I11's consumer passes `svg.ownerDocument` as a `SceneDocument<Element>`, calls `itemOf(target) ?? itemAt(point)`, and expects errors for an element given to `itemAt` and for an `elementsFromPoint` answering no array.
- The vocabulary gains "hit stack", the words VS12's source uses for the platform's answer.
- The design names the new fit criterion "a new row"; the table of the wrong tool lists only where to reach elsewhere, so the criterion -- what lies under a captured pointer, `itemAt` -- is a line of "Does my project want this at all?" instead.
- I3's recording platform answers `itemAt` from a recorded hit stack, and I3's sentence names `itemAt` and the hit stack, since VS1 now holds both; its log holds the document's `elementsFromPoint` read as the scene opens, the call with the document and the point, and the answer's `length` and indices up to the first held element.
- I13 is `test/contract/shape-at-point.test.js`, over the fake platform with a document whose `elementsFromPoint` records its receiver and arguments, and recording proxies for each order; `test/support/fake-dom.js`'s `fakeRoot` takes an optional hit test, and without one its document holds `createElementNS` alone, as draw's harness's does.
- I14 is `test/browser/captured-pointer.test.js` and its page `test/browser/i14-page.html`, beside I10's, launching its own Chrome through `test/browser/chrome-driver.js`. The root lies 30 pixels right and 40 down, 400 by 300 pixels showing a `viewBox` of 200 by 150; two scene layers hold the items, a third, declared `pointer-events` `none`, lies over one of them, and a foreign layer receives an opaque rect over another. The press that takes the pointer calls the root's `setPointerCapture`, as `input-capture`'s `takePointer` takes it, and seven trusted moves with the button held follow: over a nested shape, its group's other shape, the high layer's item, the item beneath the veil, the ground and beyond the root. The grid is 14 by 11 presses over the root and 15 pixels around it, before the foreign rect is drawn. The `viewBox` is set to `60 0 100 75` after the scene has converted under the first, so a transform cached at the first conversion fails it (M13 below).
- I15 is `test/contract/beside-0.1.0.test.js`, against the `0.1.0` release's built modules kept in `test/fixtures/v0.1.0/`, byte for byte: they were taken from the release's tarball as npm's cache holds it, whose SHA-512 is the integrity draw's `package-lock.json` records for the `v0.1.0` release file, and they equal draw's installed copy file by file; the source maps and declarations are left out, since no test reads them. Its tables are VS3's declarations, I1's cases among them; VS2 rule 2's order through recording proxies; three seeds of 150 generated calls on a rooted and a rootless scene, with every platform call, every `items` answer, `itemOf` of every element ever made and conversions; Errors, each malformed argument, a throw at each call of opening, a scene failed while writing and re-entered, a closed one, elements lacking methods; VS10 over recorded transforms; and I3's recording platform. Each answer is transcribed -- every key, value, prototype and frozen flag, each error's constructor and whole message -- with every log, and the two transcripts must be equal once `itemAt` is taken from the scene's keys, checked to stand after `itemOf`, and the read of `elementsFromPoint` from the logs, checked to stand directly after `createElementNS`; each is counted, and a root whose `elementsFromPoint` getter throws is held apart.
- The runtime check's `PLATFORM_SLICE` holds `elementsFromPoint` in the document's row (B424, RD13); `test/tools/gate-checks.test.js` holds the control -- a built file naming it by dot, by brackets, by destructuring or through `Reflect.apply`, and the build itself, passes -- and the falsifier -- `elementFromPoint` named in any of three forms, and planted in a copy of the built `shape-at-point.js`, fails. The check's other passes and the release workflow's retried lookup of the draft were already this repository's, so section 3.5's table asks nothing more of it.
- The consumer test's page also asks `itemAt` at the centre of the element it made, and beyond the root, so the packed release is held to VS12 in Chrome through an import map.
- The README's consumer reference states, beside VS12's traps, one the guide states for a strict browser rule: a `style` attribute written by script is refused under `style-src 'self'`, so a shape's look is given by a class or presentation attributes, the scene writing every attribute with `setAttribute`.
- The vocabulary lists are renamed as section 3.5 says: `gesture-tester` is `input-tester`, its words `keyboard` and `keycap` kept; the tester has no source yet, so no noun of its own joins them. No word of either list is needed, so no allowance is asked.

**Errata against draw's design** (`RELEASES-0.2.md` revision 4, section 3.3):
1. GR1 holds a `0.1.0` root to `0.1.0`'s every read but for the changes the closing paragraph lists, and the paragraph lists the refused root whose `elementsFromPoint` getter throws but not the read that refuses it, which every opening with a root now makes -- seen only by a getter or a `Proxy` on the document. The build makes the read VS1 and VS2 rule 2 require; I15 takes it as part of the first listed change, as `input-capture`'s closing paragraph lists its `timeStamp` read with its refusal, and `CONTRACT.md`'s closing paragraph says so. The paragraph should list: "the root's document's `elementsFromPoint` is read once as the scene opens".
2. The design calls the new fit criterion "a new row", where the only table lists the wrong tool; it is placed as a line of the list above the table, as the choices record.

**Mutants planted (GR2).**\
Each mutant was planted in a copy of this repository by an exact replacement of one span of source, built, and run against the tests of the rule it breaks; each failed them, so each new rule's tests can fail:
- M1, VS2 rule 2 -- a throwing `elementsFromPoint` getter kept as none, the root opened: 3 tests failed, I13's refusal, I1's table of roots and I15's listed change.
- M2, VS2 rule 2 -- `elementsFromPoint` read after `getScreenCTM`: 6 failed, VS2 rule 2's order, I3, I13's two order tests and two of I15.
- M3, VS1 -- a value that is no function refusing the root: 19 failed, I13's opening, every I15 table, and every test that opens a scene on the fake platform without a hit test.
- M4, VS12 steps 1 and 2 -- the state judged before the point: 2 failed, I13's state test and I2's closed scene meeting the `TypeError` first.
- M5, VS12 step 5 -- the second judgement of the state removed: 1 failed, I13's getter that closes or fails the scene.
- M6, VS12 step 4 -- `length` read again on every index: 4 failed, I13's `length` once, its appending getter and its closing getter, and I3's log.
- M7, VS12 step 4 -- the walk stopping at the first element of any kind, so the topmost hit: 6 failed, among them I13's looking through foreign content and I14's opaque foreign element in Chrome.
- M8, VS12 step 3 -- any object accepted for `Array.isArray`: 1 failed, I13's answers that are no array.
- M9, VS1 and VS12 step 3 -- `elementsFromPoint` called with no receiver: 7 failed, I13's receiver, I3, and all four of I14's tests, Chrome's own method refusing a call without its document.
- M10, VS12 step 3 -- the point's `y` passed for `x`: 7 failed, I13's arguments, I3, and all four of I14's tests.
- M11, the scene's form -- `itemAt` placed after `layerElement`: 3 failed, the record keys test and two of I15.
- M12, VS12 step 4 -- an element of a removed item still known: 3 failed, I13's removed item and its removing getter, and I3.
- M13, VS13 -- each scene's first screen transform cached and used for every later conversion: 1 failed, I14's `viewBox` set after opening; it survived the first I14, which never converted before the `viewBox` changed, and the test was strengthened.
- M14, B424 -- `elementsFromPoint` taken out of the runtime check's document row: 3 failed, the slice, the control, and the check over the build.
- M15, B424 -- `elementFromPoint` added to the document row: 2 failed, the slice and the falsifier.
- M16, GR1 -- the message of a closed scene's refusal reworded past its beginning, which no other test pins: 1 failed, I15's Errors table.
- M17, GR1 -- `elementsFromPoint` read before `createElementNS`: 4 failed, two of I15 and two of I13.

**Built size.**\
Measured by `tools/measure-size.mjs` over `dist/` as built for `0.2.0`, as D2 measured `0.1.0`: every built module is loaded wherever `openScene` is imported.\
Bytes as shipped, comments included, then with comments removed, each also gzipped at level 9:

| Files | Bytes | Gzip | No comments | Gzip |
|---|---|---|---|---|
| `open-scene.js` | 15,154 | 4,057 | 11,421 | 2,749 |
| `declaration-reading.js` | 8,147 | 2,265 | 5,688 | 1,375 |
| `shape-reading.js` | 7,669 | 2,522 | 5,194 | 1,652 |
| `scene-writing.js` | 5,849 | 1,695 | 4,919 | 1,313 |
| `reflection.js` | 5,569 | 1,853 | 3,113 | 931 |
| `argument-reading.js`, `conversion.js`, `declaration-problems.js`, `index.js`, `shape-at-point.js`, `types.js` | 12,473 | 5,105 | 6,524 | 2,478 |
| every built module | 54,861 | 17,497 | 36,859 | 10,498 |

---

## D4 - The tests run on test-harness

**Ruled by:** the director, 2026-10-31 (draw's `H26-19` as amended: no test run may leave anything behind, and what the repositories' copies share is one component, `test-harness`, taken by each in its tests alone, pinned to its release file).\
**Affects:** `package.json` and its lockfile, `test/browser/`, `tools/consumer-test.mjs` and the tests that make scratch folders; nothing in `src/`, and nothing the package ships.

**Ruling.**\
`@apnex/test-harness` `0.1.0` is a development dependency, pinned to its release file by its URL and, in the lockfile, by its hash; `files` is unchanged, so no file of it is packed.\
`npm test` runs the tests under its runner, `test-harness run`, and `npm run consumer` the consumer test under `test-harness exec`, so each run has a folder of its own and fails on anything left in it or still running after it.\
I10's and I14's tests launch Chrome with its `launchChrome`, in a folder of its own, drive it through its `connectToPage`, and serve the pages, the built files and `test/support/`, whose generator I10's page imports, with its `serveStatic`; the pages, their exercises and `test/support/` are this repository's own, as before.\
`test/browser/chrome-driver.js`, `teardown.test.js` and `fake-browser.mjs` are gone (235, 119 and 33 lines): what they held -- Chrome's whole process group stopped, its profile removed, the server's connections ended, and the lock folder Chrome makes in the temporary folder removed by either name -- this repository's copy knew only the dotted name Chrome 136 gives it, so on a later Chrome, as GitHub's runner holds, every run left the undotted one behind -- is `test-harness`'s, held by its own tests, and the four tests of `teardown.test.js` with it, so the run counts 147 to 143 tests.\
The run again with `--experimental-websocket` is gone: the tests' floor is `test-harness`'s, Node.js 22.4, whose `WebSocket` is global, and on an earlier Node.js `connectToPage` says so.\
The consumer test serves the page and the installed files with `serveStatic` and loads them in a one-shot Chrome with `dumpDom`, in a folder of its own -- so Chrome's lock folder, crash reporter and keyring use no longer reach the caller's temporary folder or the user's own -- and its scratch folder is a `scratchFolder`, removed however the test ends; its `--keep` is gone, since a folder kept would be one the run fails on.\
The tests' scratch folders are `scratchFolder`s too.\
The runner is not given `--test-force-exit`, which `test-harness`'s README recommends: on Node.js 22 it cut the results a test file reports when they are many -- `snap-grid`'s `test/contract/declared-grid.test.js` reported 61 of its 78 tests with it -- and no test here leaves anything running for it to end.

---

## D5 - The tests run on clean-runner and headless-chromium

**Ruled by:** the director, 2026-10-31 (draw's `H26-19`, amended again: the shared component split by its two duties into `clean-runner` and `headless-chromium`, and purged, no legacy retained).\
**Affects:** `package.json` and its lockfile, `README.md`, `test/browser/`, `tools/consumer-test.mjs` and the tests that import either; nothing in `src/`, and nothing the package ships.

**Ruling.**\
The development dependency `D4` names is replaced by two, each pinned to its release file by its URL and, in the lockfile, by its hash: `@apnex/clean-runner` `0.2.0`, for the runner -- `clean-runner run` and `clean-runner exec`, and `scratchFolder` -- and `@apnex/headless-chromium` `0.1.0`, for `launchChrome`, `connectToPage`, `dumpDom` and `serveStatic`; `files` is unchanged, so neither is packed.\
The calls are `D4`'s, each now from the component that holds it, and the runner is still given no `--test-force-exit`.

---

## D6 - The contract of record for 0.3.0 is draw's ratified PAN-ZOOM.md, revision 10

**Ruled by:** the director, 2026-11-01 (draw's `H26-23`, the design ratified as it stands, every decision at its recommendation but the director's seven rulings).\
**Affects:** `CONTRACT.md`, `README.md`, `src/`, `test/`, `tools/check-runtime.mjs`, `export-map.json` and `package.json`.

**Ruling.**\
The contract of record for `0.3.0` is section 3.2 of draw's `dev/design/components/PAN-ZOOM.md`, revision 10, its `vector-scene` paragraph, with PZ22 and appendix A's five rows for its move 1: a view of the scene, asked beside a root.\
`CONTRACT.md` carries VS14 (the view, its transform, `setView`, `view` and the range the scene supports), VS15 (`visible`), VS16 (`zoomAbout`) and VS17 (`onView`); VS1 widened by the root's `clientWidth` and `clientHeight` and the layers' `transform`, VS2 by `view`'s descriptor and the new functions' arguments, VS3 by `view` and its refusals `view-without-root` and `layer-transform`, VS10 by the view composed, VS13 by the view written on the layers and never on the root; the scene's fifteen keys, the capability row `scene-view`, its fit criterion, and I16 to I20; each rule stated on its own terms, with one provenance line under Reference.\
This move builds the contract and its Node tests on a recording root; the browser invariants in Chrome and the release by this repository's CI are the next move's, so `0.3.0` is the version of the package and the contract, untagged here.\
D2 and D3 stand for everything `0.3.0` leaves unchanged: every rule of `0.2.0` reads unchanged for a scene declared without a view.

**Choices made at build.**\
Where section 3.2 was silent or left a choice open, the build made these; each a test can hold is held by one:
- The view is its own module, `src/scene-view.ts`: reading a view, its transform's members and their range, the transform's text, and what `visible()` answers judged apart from how it is read, so the far-edge check is tested directly on synthetic rectangles through `dist/scene-view.js`, which the package does not export.
- VS3's two new rows are steps `4a` and `7a`, so every step of `0.2.0` keeps its number; `view` is judged from its descriptor before the layers are read, which reads nothing more, so `layer-transform` knows whether `view` is accepted.
- The scene's five new functions follow `toScreen`, before `close`, on every scene: a scene declared without a view refuses each with an `Error` once its arguments are read, as the design asks of `setView` and `visible`.
- `setView` reads `x`, `y` and `scale` in turn, each descriptor judged as read, a missing one refused in its turn; a symbol-named key is ignored and a prototype of `null` accepted, as VS2 rule 1 reads every record. It answers a frozen view of the numbers it read, the record `view()` answers until the next.
- The opening transform is written after a layer's declared attributes and before it is appended, `matrix(1, 0, 0, 1, 0, 0)`, `-1 * 0` being `-0`, which `String` writes `0`.
- `visible()` reads `clientWidth` and judges it, then `clientHeight`, then the screen transform as VS10 reads one for `toScreen`, all six members, with no `inverse`; its scale is `s * Math.hypot(a, b)`.
- A composed `toDrawing` is refused with VS10's `Error` unless both members are finite, as VS10 step 6 refuses its own answer.
- The runtime check's root row gains `clientWidth` and `clientHeight`, and a `view` row names `x`, `y` and `scale`, `scale` being a platform member's name as `x` and `y` are; `test/tools/gate-checks.test.js` holds the control -- a built file naming them passes -- and the falsifier -- `clientLeft`, `scrollWidth` and `getBoundingClientRect` named, and `scrollWidth` planted in a copy of the built `open-scene.js`, each fail.
- The types: `SceneRoot` gains `clientWidth` and `clientHeight`, optional, since a scene without a view reads neither, so every root of `0.2.0` stays assignable; `SceneDeclaration` gains `view?: boolean`; `SceneView`, `SceneVisible` and `SceneRegion` are exported; I11's consumer opens a viewed scene on an `SVGSVGElement` and hands `visible()` to a function typed as `snap-grid`'s view form, with four more expected errors.
- The recording platform takes a `size` whose `w` and `h` its root's `clientWidth` and `clientHeight` getters answer, and reads its transform's numbers at each call, so a test resizes the root between two calls.
- I15's listed changes gain the five keys; the `0.1.0` tables, every one declared without a view, otherwise run unchanged against this build. Every other test of `0.2.0` runs unchanged but for its pins of what the contract states, each grown with it: the two lists of the scene's keys (`returned-values-and-errors.test.js`, `beside-0.1.0.test.js`), the capability list and the rule and invariant counts (`contract-coverage.test.js`), the export map's `serves`, the count of rows and the version (`public-surface.test.js`), and the runtime check's allowed-members table (`gate-checks.test.js`); the recording platform and I11's consumer gain additions alone.
- The vocabulary gains "view", "region" and "listener", the words VS14 to VS17's source uses.
- The README's consumer reference gains the view's section, with its traps.

**Errata against draw's design** (`PAN-ZOOM.md` revision 10, section 3.2), each a behaviour the design does not name, built at its nearest faithful reading and reported:
1. "The listeners registered then are called": read as the listeners registered once `setView` has written, so a listener registered or removed while they are told takes effect from the next `setView` -- one removed meanwhile is still told, one added is not (I19, mutant M41).
2. While listeners are told, the design names `setView`, `put`, `remove` and `close` as refused and every reading function as answering, and names neither `onView` nor the function it answers: both answer, as neither is among the four.
3. `zoomAbout` "judges the state as `setView` does", yet it sets nothing and every reading function answers while listeners are told: it is read as a reading function, refused when closed, failed, writing or declared without a view, and answering while listeners are told.
4. "Each with one `visible()` read after the write": read as one answer, read once after the write and handed to each listener; it is read only when a listener is registered, so a `setView` with none reads nothing of the platform, as appendix A's recording row asks.
5. A `visible()` that fails within `setView` -- the root's width `NaN`, say -- is not named: as a listener's throw is, its `Error`, beginning `setView`, propagates with the view written and the scene open, before any listener is told.
6. The function `onView` answers is never refused, even once the scene is closed: removing a listener changes nothing the scene shows; after the verifier's reading this is stated in VS17 rule 5 and tested.

**Mutants planted.**\
Each mutant was planted in a copy of this repository by an exact replacement of one span of source, built, and run against the tests of the rule it breaks; each failed them, so each new rule's tests can fail.\
The first run's two survivors each named a test too weak, which was strengthened and the mutant run again: M22, whose test met an inverse underflowed to infinity before the composed check, and M41, whose test removed a listener that had already been told; and its M4 did not compile, so it was planted again as one that does.\
Every count below is from the final run, every mutant against the final tests.
- M1, VS2 rule 2 -- `view`'s descriptor read before `layers'`: 1 failed, I16's order.
- M2, VS3 4a -- `view-without-root` for a root refused, not only absent: 1 failed, I16's table.
- M3, VS3 7a -- `layer-transform` reported while `view` is refused: 1 failed, I16's table.
- M4, VS3 4a -- any truthy `view` accepted: 1 failed, I16's table.
- M5, VS14 rule 1 -- the opening transform not written: 2 failed, I17's opening and I20's recording.
- M6, VS14 rule 1 -- the opening transform written after the layer is appended: 2 failed, the same.
- M7, VS14 rule 2 -- the translation's members swapped: 4 failed, I17's strings, I20 and I19.
- M8, VS14 rule 2 -- the transform written on scene layers alone: 7 failed.
- M9, VS14 rule 3 -- `y` read before `x`: 1 failed, I17's reading order.
- M10, VS14 rule 3 -- a scale at or below 0 left to the range: 1 failed, I17's closed scene meeting the `TypeError`.
- M11, VS14 rule 3 -- the members judged after the write: 1 failed, I17's range, something written.
- M12, VS14 rule 4 -- the members not judged: 2 failed, I17's range and I18's `zoomAbout` refusals.
- M13, VS14 rule 4 -- a member of 2^24 refused: 3 failed, I17's strings and range and I18's `zoomAbout` at the edge.
- M14, VS14 rule 4 -- the vertical member not judged: 1 failed.
- M15, VS14 rule 4 -- no upper bound on the scale: 1 failed.
- M16, VS14 rule 4 -- no lower bound on the scale: 1 failed.
- M17, VS14 -- a view written by a scene declared without one: 1 failed, I20.
- M18, VS3 lifecycle rule 4 -- `setView` not refused while the scene writes: 2 failed, I17's re-entry and its closed scene.
- M19, VS14 rule 6 -- `view()` answering a copy, not the record written: 4 failed.
- M20, VS10 -- `toScreen` not composing the view: 1 failed, I18's arithmetic.
- M21, VS10 -- `toDrawing` composed in another order: 1 failed.
- M22, VS10 -- a composed `toDrawing` not judged finite: 1 failed, I18's composed answer, once strengthened.
- M23, VS15 -- the region's width `W * s`: 2 failed, I18's `visible()` and I19's answer told.
- M24, VS15 -- the scale from `hypot(a, c)`: 1 failed, I18's skewed transform.
- M25, VS15 -- the root's screen scale left out: 4 failed, two of I18 and two of I19.
- M26, VS15 rule 2 -- `clientHeight` read before `clientWidth`: 1 failed, I20's recording.
- M27, VS15 rule 2 -- a width below 0 accepted: 1 failed.
- M28, VS15 rule 5 -- the far edges not judged: 1 failed, the synthetic rectangles.
- M29, VS15 rule 5 -- a scale of 0 accepted: 2 failed, the singular transform and the synthetic rectangles.
- M30, VS16 -- `x'` from the current scale: 1 failed, I18's `zoomAbout`.
- M31, VS16 -- the answer not judged: 1 failed, `Number.MIN_VALUE` and the range.
- M32, VS16 -- the state judged before the arguments: 2 failed, a malformed scale to a closed scene and to a scene without a view.
- M33, VS17 rule 2 -- the listeners told before the write: 3 failed.
- M34, VS17 rule 2 -- `visible()` read with no listener registered: 3 failed, I20's recording and two of I17 whose writes it logs.
- M35, VS17 rule 4 -- a throwing listener not stopping the rest: 1 failed.
- M36, VS17 rule 3 -- `setView` not refused while listeners are told: 1 failed.
- M37, VS17 rule 3 -- `put` not refused while listeners are told: 1 failed.
- M38, VS17 rule 3 -- `close` not refused while listeners are told: 1 failed.
- M39, VS17 rule 3 -- `view()` refused while listeners are told: 2 failed.
- M40, VS17 rule 5 -- the removal removing nothing: 1 failed.
- M41, VS17 rule 2 -- the listeners of the moment each is called told, not those of the write: 1 failed, once strengthened.
- M42, VS17 rule 2 -- each listener handed a `visible()` of its own: 1 failed.
- M43, VS1 -- `clientWidth` taken out of the runtime check's root row: 4 failed, the slice, the control, the check over the build and `elementsFromPoint`'s row test, which runs the check over the build.
- M44, the scene's form -- the view's functions after `close`: 3 failed, the record keys and two of I15.

**Built size.**\
Measured by `tools/measure-size.mjs` over `dist/` as built for `0.3.0`, as D3 measured `0.2.0`: every built module is loaded wherever `openScene` is imported, `scene-view.js` the new one.\
Bytes as shipped, comments included, then with comments removed, each also gzipped at level 9:

| Files | Bytes | Gzip | No comments | Gzip |
|---|---|---|---|---|
| `open-scene.js` | 22,449 | 5,848 | 16,018 | 3,690 |
| `scene-view.js` | 6,235 | 2,135 | 3,994 | 1,291 |
| every built module | 69,928 | 21,825 | 46,346 | 12,929 |

**After the independent verifier's reading.**\
The verifier failed move 1 on one blocking finding and four test gaps, the gate, the guard and the six errata judged sound; each was reproduced by a test failing or a mutant surviving before the change, and each mutant was planted in a copy, built and run against the tests before and after:
- B1 -- the opening view was one frozen module-level record, so two scenes' `view()` answered the same object before their first `setView`, against "What is returned": each scene now makes its own as it opens (`openingView` in `src/scene-view.ts`), VS14 rules 1 and 6 say so, and I17's new test, "each viewed scene's opening view is its own record", failed on the old code; the shared record planted again survives the old tests and fails that test.
- S1 -- `setView`'s plain-object check was untested, a mutant removing it surviving: the malformed list gains a class's instance and another realm's object, each holding own `x`, `y` and `scale`; the mutant now fails I17's reading test.
- S2 -- a removal of one of two registrations of one function was untested, a mutant removing the function's first registration surviving: f, g, f registered, the second f removed, a `setView` tells f then g; the mutant fails that test.
- S3 -- erratum 1 was untested at the write, a mutant taking the listeners before the write surviving: a platform method removing a listener during the write, that listener is not told; the mutant fails that test.
- S4 -- erratum 6 was in this record alone: VS17 rule 5 now states that the remover answers in every state, and a test removes listeners after `close` and after a failed write, and during a write; a mutant making the remover throw once closed fails it.
- This entry's sentence on which tests of `0.2.0` changed named the lists of the scene's keys alone; it now names every pin that grew with the contract.

---

## D7 - The view in Chrome, and the release of 0.3.0 by this repository's CI

**Ruled by:** the director, 2026-11-01 (draw's `H26-23`, `PAN-ZOOM.md` revision 10, section 5.1's move 2 and appendix A's five rows for it).\
**Affects:** `CONTRACT.md`, `test/browser/`, `test/contract/`, `tools/consumer-test.mjs` and `package.json` and its lockfile.

**Ruling.**\
The view `D6` contracted is held in Chrome: I21, a viewed scene on a root placed by a translation, on one under a CSS `scale(2)` and on one resized between views, against screen positions calculated from the page's layout and the view alone; I22, the range's edges drawn and hit through the scene's own writes, and nothing written past them; and I23, `visible()` handed straight to `snap-grid`'s `inView`.\
The consumer test opens a viewed scene in its page, on the packed file as a release does.\
`0.3.0` is released by this repository's own CI on the tag `v0.3.0` once the move's verifier passes it, as `0.2.0` was; the release workflow takes the version from `package.json` and refuses a tag that differs, so it needs no change.

**Choices made at build.**\
Each a test can hold is held by one:
- I21 is `test/browser/viewed-scene.test.js` and its page `test/browser/i21-page.html`: three roots with no `viewBox`, each a scene layer between a foreign layer beneath and one above, the items at known drawing coordinates; the root moved 37 pixels right and 23 down, 400 by 300; one 200 by 150 inside a box moved 480 right and 20 down and scaled by 2 with CSS; and one 300 by 200 at 41 and 360, resized to 360 by 240 between views.
- The screen positions are calculated in the test from the layout's numbers and the view, never from the scene or `getScreenCTM`: a drawing point's screen position is the root's corner plus the root's scale times the view's times its distance from the view's top-left; the platform's own boxes of the items are held to them within 0.02 pixels, and the view's top-left to the root's corner exactly.
- The conversions are held to `DOMPoint` over the root's screen transform and the view under `Object.is`, 400 points each way at each of four views on each root, and `toScreen` also to `DOMPoint` over the layer element's own `getScreenCTM`, the platform's composition of the transform the scene wrote, within a part in 10^5.
- `itemOf` is asked of the platform's topmost element at each point, `document.elementFromPoint`, and `itemAt` of the point; the hit test's views are each a region holding every point asked -- a panned view at the root's own pixel a unit, one zoomed in and one out -- since a point beyond the root is answered by nothing of it.
- I22 is `test/browser/transform-range.test.js` and its page `test/browser/i22-page.html`, the drafter's `transform-range.mjs` through the scene: the view written by `setView`, the bar by `put`, the drawn edges read from a screenshot of the row as the probe reads them, and the hit by `itemAt` by eighths of a pixel; a write past an edge is looked for by a `MutationObserver` over the root's subtree.
- The member edges are held at scales 1 and 4, each sign: at a scale of 2^-16 a member of 2^24 puts a shape at 2^40 drawing units, which single precision draws nowhere, as section 3.2 says of a shape far out -- the range bounds what the scene writes, not where a shape lies -- and as the probe measured.
- I22's budgets: within a tenth of a pixel drawn and a quarter hit at the scale's edges, and at a member of 2^24 within single precision's resolution there, a pixel drawn and two hit; measured, the scale at 2^16 is drawn 0 and 0.004 pixels from its edges and hit 0 and 0.125, at 2^-16 drawn 0 and 0 and hit 0.125 and 0, a member of -2^24 drawn 1 and 1 and hit 0 and 2, as the probe measured, and a member of 2^24 drawn 0 and 0 and hit 0.375 on either side.
- `snap-grid` `0.1.0`, the release draw pins, is a development dependency pinned to its release file by its URL and, in the lockfile, by its hash, which equals the release's published SHA-512; the tests alone import it, and the packed file holds nothing of it.
- I23 is in `test/contract/scene-view.test.js`, in Node over the fake platform: the positions `inView` answers are computed in the test, by row then by column, and its stride at a least spacing.

**Faults planted.**\
Each fault was planted in the transform in a copy of this repository, built, and run against I21's and I22's Chrome tests alone; each was failed by them:
- F1 -- the translation written with its sign flipped: 9 of 9 failed.
- F2 -- the transform written on scene layers alone, not foreign ones: 7 of 9 failed, every test of I21.
- F3 -- the translation not scaled, `-x` and `-y` written for `-s * x` and `-s * y`: 9 of 9 failed.
- F4 -- the scale written a thousandth short: 7 of 9 failed, both of I22 and the drawing and conversion tests of I21.
