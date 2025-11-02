# Contributing to obsct

Thanks for your interest in contributing to **obsct** — a Deno-based CLI that extracts TODO/FIXME/NOTE comments from source code and appends them as tasks to a Markdown note inside an Obsidian vault.

This document outlines code style, development workflow, and test conventions for contributors.

---

## Project Naming & Structure

- The project name is **obsct**.
- Keep folders small and purpose-scoped:
  - `src/` for source code
  - `test/` for unit tests
  - `scripts/` optional helper scripts
- Keep the codebase dependency-light. Prefer the Deno Standard Library.

---

## Coding Guidelines

- Use **Deno v2+** and **JSR imports with pinned versions**, for example:

  ```ts
  import { walk } from "jsr:@std/fs@1.0.5/walk";
  import * as path from "jsr:@std/path@1.0.6";
