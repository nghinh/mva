#!/usr/bin/env bash
set -euo pipefail

if command -v pnpm >/dev/null 2>&1; then
  PM=pnpm
elif command -v npm >/dev/null 2>&1; then
  PM=npm
else
  echo "No supported package manager found" >&2
  exit 1
fi

if [ -f package.json ]; then
  if jq -e '.scripts.lint' package.json >/dev/null 2>&1; then $PM run lint; fi
  if jq -e '.scripts.typecheck' package.json >/dev/null 2>&1; then $PM run typecheck; fi
  if jq -e '.scripts.test' package.json >/dev/null 2>&1; then $PM run test; fi
  if jq -e '.scripts.build' package.json >/dev/null 2>&1; then $PM run build; fi
fi
