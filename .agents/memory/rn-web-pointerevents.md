---
name: React Native Web pointer-events gotcha
description: How box-none / pointer-events works (and breaks) on RN Web — CSS stacking vs prop system
---

## The rule

`pointerEvents="box-none"` as a **prop** on a View works correctly in React Native Web (handled internally by the component system). When set as a **style** value (`style={{ pointerEvents: "box-none" }}`), browsers silently ignore it because `"box-none"` is not a valid CSS `pointer-events` value, effectively leaving the element as `pointer-events: auto`.

## Why this is dangerous

An element with `left: 0, right: 0` (full-width) that is rendered later in JSX than another interactive element will sit on top of it in the CSS stacking order. If its `pointerEvents: "box-none"` in style doesn't work, it intercepts all mouse/touch events over the element beneath it.

## How to apply

- Use `pointerEvents="box-none"` (prop, not style) on any full-width/full-height overlay wrappers.
- For PanResponder/Responder elements that must receive events: render them **after** any full-width wrappers in JSX so they have higher z-order. Later in JSX = on top in CSS stacking when both are `position: absolute`.
- `"none"` and `"auto"` in style work fine (valid CSS values). Only `"box-none"` and `"box-only"` are RN-specific and must use the prop form.
