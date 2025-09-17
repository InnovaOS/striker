#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

pnpm -C "$ROOT_DIR/packages/cline-adapter" run compile
pnpm -C "$ROOT_DIR/packages/vscode-extension" run compile
code "$ROOT_DIR/packages/vscode-extension"
