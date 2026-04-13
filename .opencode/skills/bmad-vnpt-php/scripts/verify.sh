#!/usr/bin/env bash
set -euo pipefail

if command -v composer >/dev/null 2>&1; then
  composer validate --no-check-publish || true
fi

if [ -x vendor/bin/phpstan ]; then
  vendor/bin/phpstan analyse
fi

if [ -x vendor/bin/phpunit ]; then
  vendor/bin/phpunit
fi
