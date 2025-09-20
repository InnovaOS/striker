# ADR 0001: Base Setup — Striker Monorepo & Extension Scaffold

**Date:** 2025-09-15  
**Status:** Accepted  
**Context:**  
Striker is being developed as an AI-powered developer assistant, initially delivered as a VS Code extension.  
We evaluated alternatives (e.g., Cline and other OSS agents). To keep the foundation clean and flexible,  
we decided to build Striker in a **pnpm monorepo** with a dedicated `packages/vscode` extension package.  

**Decision:**  
- Use `pnpm` workspaces for orchestration (`pnpm-workspace.yaml` at root).  
- Each component (extension, agents, tools) will live in `packages/*`.  
- Scaffolded a minimal VS Code extension (`Hello Striker` command verified).  
- Removed direct dependency on Cline to avoid vendor lock-in.  
- `vsce` replaced with `@vscode/vsce` for publishing.  

**Consequences:**  
- Contributors have a clean baseline to extend without legacy baggage.  
- New features (inline completion, project-aware search, etc.) can be added incrementally.  
- Clear separation: orchestration logic at root, extension logic under `packages/vscode`.  
- Parking of Cline means we are free to pull ideas, but Striker core remains independent.  

**Notes:**  
- Future ADRs will capture major feature decisions (e.g., inline completion design, multi-file context injection).  
- This ADR establishes the *foundation milestone*: **“Striker is ready ✅”**.
