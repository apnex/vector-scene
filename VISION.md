# vector-scene - Vision

**Status: ratified by the director as written, 2026-10-23 (draw's ruling `H26-11`, in draw's `dev/DECISIONS.md`); amended 2026-10-24 to absorb draw's ruling `H26-14` -- the item under a screen point; enduring.**\
This document states why vector-scene exists and what it will never be.\
It carries no current state, no roadmap, and no schedule.

Holding this document authorises nothing.\
A change of direction is recorded as a decision first and absorbed here afterwards.

---

**North star.**\
Let an application say what it shows as data, and have it shown exactly, in a browser or anywhere else.

**Why it exists.**\
Applications that draw build elements by hand and update them by hand, and every update that forgets a branch leaves the page a frame behind its data; they read the elements back to find what a pointer touched, and cannot draw the same picture where there is no browser without faking one.\
`vector-scene` holds the drawing once: the application describes its items, the scene makes the platform show exactly that, tells it which item an element belongs to, and draws the same description with no platform at all.

**What it is.**\
An embeddable library with one function: open a scene on a root, or on none, declare its layers, and put, move and remove items of shapes by key, read them back, map an element or a screen point to its item, and convert points through the root.

**What it is not.**
- Not a theme: what anything looks like is the application's.
- Not an input layer: what a pointer means is `input-binding`'s and `input-capture`'s.
- Not a geometry engine: it answers by the platform's own elements.
- Not an animator or a clock.
- Not a sanitizer: what it is handed is the application's own.
- Not a network service: it never listens and never sends.

**What success means.**
- **Fidelity:** the page shows exactly the description, and nothing else the scene wrote.
- **Containment:** no application code needs to build or read an element it shows.
- **Portability:** the same description draws in a browser and with no browser, from one code path.
- **Reuse:** a second, unrelated application adopts it without a variant, a fork or a change.

**Authority.**\
Held by the director; drafted by anyone, ratified only by the director; amended, never quietly rewritten.
