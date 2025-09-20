# ADR 0002: Extension Package Name & OSS Import Stance

**Date:** 2025-09-15  
**Status:** Accepted

## Context
During scaffold we briefly created `/packages/vscode`, but the active extension resides at `/packages/vscode-extension`. To avoid duplication and confusion, we standardize on **`vscode-extension`** as the package name.

We intend to **reuse as much as possible from Cline OSS (MIT licence)** for speed, while keeping Striker’s orchestration and Pro features independent.

## Decision
- The official VS Code extension lives at: `/packages/vscode-extension`.
- Remove/avoid any duplicate `/packages/vscode`.
- Proceed with **Cline-first OSS imports**, respecting MIT licence:
  - Retain licence notices in imported files.
  - Keep Striker’s own licence and attribution clear.
  - Wrap imports behind a thin adapter layer (future ADR).

## Consequences
- Single, unambiguous extension location.
- Faster delivery by leveraging Cline OSS code.
- Clear path to layer Striker-specific differentiators without vendor lock-in.

## Notes
- A follow-up ADR will define the “Cline Adapter” module boundaries (planner/executor IO, tool abstractions, cancellation & sandboxing).
