#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

STACK_RULES = {
    "java-spring": ["pom.xml", "build.gradle", "build.gradle.kts", "src/main/java", "src/main/kotlin"],
    "dotnet": ["*.sln", "*.csproj", "Program.cs", "appsettings.json"],
    "nodejs": ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json"],
    "python": ["pyproject.toml", "requirements.txt", "poetry.lock", "Pipfile"],
    "go": ["go.mod", "go.sum"],
    "c-cpp": ["CMakeLists.txt", "Makefile", "meson.build", "conanfile.*", "vcpkg.json"],
    "php": ["composer.json", "artisan", "bin/console", "public/index.php"],
    "frontend-react": ["package.json", "vite.config.*", "next.config.*"],
    "frontend-vue": ["package.json", "nuxt.config.*", "vite.config.*"],
    "frontend-angular": ["angular.json", "package.json"],
    "mobile-flutter": ["pubspec.yaml", "android/app/build.gradle", "ios/Runner"],
    "mobile-react": ["app.json", "metro.config.*", "android/app/src", "ios/Podfile"],
}


def has_any(root: Path, patterns: list[str]) -> bool:
    for pattern in patterns:
        if any(root.glob(pattern)):
            return True
        if (root / pattern).exists():
            return True
    return False


def main() -> int:
    root = Path('.').resolve()
    detected = []
    for stack, patterns in STACK_RULES.items():
        if has_any(root, patterns):
            detected.append(stack)
    print(json.dumps({"root": str(root), "detected_stacks": detected}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
