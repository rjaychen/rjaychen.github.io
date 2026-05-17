---
title: Standing up Astro with Three.js seams
description: Notes on marrying static authoring with tactile geometry on the homepage.
date: '2026-05-15'
tags:
  - meta
draft: false
---

This post exists to demonstrate the Astro content collection powering **Writing**.
Drop new markdown files beside this one (`src/content/blog`) and Astro will hydrate the listing page automatically—no JSX ceremony required.

## What changes from Jekyll

- Frontmatter is validated with [`zod`](https://zod.dev), wired through `src/content/config.ts`.
- Type-safe props flow directly into layouts, so refactoring the resume stays boring (in the good way).

## Next experiments

Bring back legacy shader explorations once the GLB pipeline settles. Until then the fallback torus knot keeps the realtime HUD honest.
