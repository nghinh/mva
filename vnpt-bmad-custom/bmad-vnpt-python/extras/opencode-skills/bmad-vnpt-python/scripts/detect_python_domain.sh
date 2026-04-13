#!/usr/bin/env bash
set -euo pipefail
if [ -f "manage.py" ] || grep -q "django" pyproject.toml 2>/dev/null; then echo django; exit 0; fi
if grep -q "fastapi" pyproject.toml 2>/dev/null; then echo fastapi; exit 0; fi
if grep -q "pyside6" pyproject.toml 2>/dev/null; then echo pyside6; exit 0; fi
if grep -q "torch" pyproject.toml 2>/dev/null; then echo pytorch; exit 0; fi
if grep -q "scikit-learn" pyproject.toml 2>/dev/null; then echo sklearn; exit 0; fi
echo python-generic
