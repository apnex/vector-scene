/** The SVG namespace, in which the scene makes every element. */
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
/** VS1's calls on elements, a failure named for the function `fn` answers: an element holding no such function, or refusing its text, throws Error. */
export function elementCalls(fn) {
    const judged = (method, name) => {
        if (typeof method !== "function")
            throw new Error(`${fn()}: an element the root's document made holds no function ${name}`);
        return method;
    };
    return {
        setAttribute: (element, name, value) => void Reflect.apply(judged(element.setAttribute, "setAttribute"), element, [name, value]),
        removeAttribute: (element, name) => void Reflect.apply(judged(element.removeAttribute, "removeAttribute"), element, [name]),
        appendChild: (element, child) => void Reflect.apply(judged(element.appendChild, "appendChild"), element, [child]),
        insertBefore: (element, child, before) => void Reflect.apply(judged(element.insertBefore, "insertBefore"), element, [child, before]),
        remove: (element) => void Reflect.apply(judged(element.remove, "remove"), element, []),
        writeText: (element, text) => {
            if (!Reflect.set(element, "textContent", text))
                throw new Error(`${fn()}: an element the root's document made refused its textContent`);
        },
    };
}
/** VS7 and VS9: the element writer of one scene. `fn` names the function whose writing a refusal reports. */
export function elementWriter(rootDocument, createElementNS, fn) {
    const owner = new WeakMap();
    const calls = elementCalls(fn);
    const forget = (record) => {
        owner.delete(record.element);
        for (const kid of record.kids)
            forget(kid);
    };
    const create = (tag) => {
        const made = Reflect.apply(createElementNS, rootDocument, [SVG_NAMESPACE, tag]);
        if (typeof made !== "object" || made === null)
            throw new Error(`${fn()}: the root's document's createElementNS answered no element`);
        return made;
    };
    const make = (spec, parent, index, holder) => {
        const element = create(spec.tag);
        const record = { element, parent, index, holder, kids: [] };
        owner.set(element, record);
        for (const [name, written] of spec.attrs)
            calls.setAttribute(element, name, written);
        if (spec.text !== "")
            calls.writeText(element, spec.text);
        appendKids(record, spec.kids);
        return record;
    };
    /** Each child made and appended, in order. */
    const appendKids = (record, kids) => {
        kids.forEach((kid, index) => {
            const made = make(kid, record, index, record.holder);
            record.kids.push(made);
            calls.appendChild(record.element, made.element);
        });
    };
    const removeElement = (record) => {
        calls.remove(record.element);
        forget(record);
    };
    /** VS7 step 4: an element patched from its old shape to its new. */
    const patch = (record, old, now) => {
        const { element } = record;
        for (const [name, written] of now.attrs)
            if (old.attrMap.get(name) !== written)
                calls.setAttribute(element, name, written);
        for (const [name] of old.attrs)
            if (!now.attrMap.has(name))
                calls.removeAttribute(element, name);
        const hadKids = old.kids.length > 0;
        const hasKids = now.kids.length > 0;
        if (!hadKids && !hasKids) {
            // text to text: the new text written when it differs, "" among them
            if (old.text !== now.text)
                calls.writeText(element, now.text);
        }
        else if (!hadKids) {
            // text to children: "" written when the old text was not, then each child made and appended
            if (old.text !== "")
                calls.writeText(element, "");
            record.kids = [];
            appendKids(record, now.kids);
        }
        else if (!hasKids) {
            // children to text or to none: each old child removed, in order, then the new text written when there is one
            for (const kid of record.kids)
                removeElement(kid);
            record.kids = [];
            if (now.text !== "")
                calls.writeText(element, now.text);
        }
        else {
            // children to children: the lists compared as VS7 step 3 compares them
            record.kids = reconcile(record.kids, old.kids, now.kids, record, record.holder, element, (made) => {
                calls.appendChild(element, made);
            });
        }
    };
    /** VS7 step 3: position by position. */
    const reconcile = (records, olds, news, parent, holder, container, append) => {
        const kept = [];
        const positions = Math.max(olds.length, news.length);
        for (let index = 0; index < positions; index++) {
            const old = olds[index];
            const now = news[index];
            const record = records[index];
            if (old !== undefined && now !== undefined && record !== undefined && old.tag === now.tag) {
                patch(record, old, now);
                kept.push(record);
                continue;
            }
            if (now !== undefined) {
                const made = make(now, parent, index, holder);
                if (record !== undefined)
                    calls.insertBefore(container, made.element, record.element);
                else
                    append(made.element);
                kept.push(made);
            }
            if (record !== undefined)
                removeElement(record);
        }
        return kept;
    };
    return { make, reconcile, removeElement, recordOf: (value) => owner.get(value) };
}
//# sourceMappingURL=scene-writing.js.map