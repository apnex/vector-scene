/**
 * The public types of vector-scene, one per noun of CONTRACT.md's vocabulary (VS11).
 *
 * The platform slice VS1 touches is stated here as vector-scene's own structural types, with no DOM
 * library: a browser's svg element is assignable as a root, and so are plain objects of its shape. The
 * slice is generic in E, the kind of element the root's document makes, since every element the scene
 * makes goes back into the platform's own methods -- a browser's appendChild takes only the platform's own
 * kind of object, which no structural type of the scene's can promise -- so a browser's root makes E its
 * Element, and a root of plain objects, or none, makes E SceneElement. Every value the scene makes is frozen, so every property
 * it answers is read-only; a description the scene answers is assignable to what put takes.
 */
export {};
//# sourceMappingURL=types.js.map