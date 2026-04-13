\
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

COMPONENT_EXTS = {".tsx", ".ts"}
IGNORE_DIRS = {
    "node_modules", ".git", ".next", "dist", "build", "coverage", ".turbo",
    ".opencode", "_bmad", ".idea", ".vscode"
}

LISTENER_PATTERNS = [
    "addEventListener(",
    "setInterval(",
    "setTimeout(",
]
CLEANUP_PATTERNS = [
    "removeEventListener(",
    "clearInterval(",
    "clearTimeout(",
]
FETCH_PATTERNS = [
    "fetch(",
    "axios.",
    "axios(",
]
INLINE_OBJECT_PROP_RE = re.compile(r"<[A-Z][A-Za-z0-9_]*[^>]*\w=\{\{")
INLINE_ARRAY_PROP_RE = re.compile(r"<[A-Z][A-Za-z0-9_]*[^>]*\w=\{\[")
REGEX_IN_RENDER_RE = re.compile(r"new\s+RegExp\(")
KEBAB_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HOOK_NAME_RE = re.compile(r"\bfunction\s+(use[A-Z]\w*)\b|\bconst\s+(use[A-Z]\w*)\s*=\s*\(")
ANY_RE = re.compile(r":\s*any\b|\bas\s+any\b|\b<any>\b")
SORT_MUTATION_RE = re.compile(r"\.sort\(")

def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""

def is_source_file(path: Path) -> bool:
    return path.suffix in COMPONENT_EXTS and path.is_file()

def should_skip_dir(path: Path) -> bool:
    return any(part in IGNORE_DIRS for part in path.parts)

def find_source_root(repo: Path, explicit: str | None) -> Path:
    if explicit:
        return (repo / explicit).resolve() if not Path(explicit).is_absolute() else Path(explicit).resolve()
    candidates = [
        repo / "src",
        repo / "app",
        repo / "apps" / "web" / "src",
        repo / "frontend" / "src",
    ]
    for c in candidates:
        if c.exists():
            return c.resolve()
    return repo.resolve()

def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))

def add_violation(violations: list[dict[str, Any]], rule_id: str, severity: str, path: str, message: str, line: int | None = None):
    item = {
        "rule_id": rule_id,
        "severity": severity,
        "path": path,
        "message": message,
    }
    if line is not None:
        item["line"] = line
    violations.append(item)

def line_of(text: str, needle: str) -> int | None:
    idx = text.find(needle)
    if idx == -1:
        return None
    return text[:idx].count("\n") + 1

def inspect_component_directory(directory: Path, violations: list[dict[str, Any]], repo: Path):
    files = {p.name for p in directory.iterdir() if p.is_file()}
    tsx_files = [p for p in directory.iterdir() if p.is_file() and p.suffix == ".tsx"]
    has_index_tsx = "index.tsx" in files
    has_types = "types.ts" in files
    has_hooks = "hooks.ts" in files
    has_barrel = "index.ts" in files
    has_test = any(name.endswith(".test.tsx") or name.endswith(".spec.tsx") for name in files)

    rel_dir = str(directory.relative_to(repo))
    if not KEBAB_RE.match(directory.name):
        add_violation(violations, "structure.kebab_case_folder", "warning", rel_dir,
                      f"Folder '{directory.name}' is not kebab-case.")

    if tsx_files or has_index_tsx:
        missing = []
        if not has_index_tsx:
            missing.append("index.tsx")
        if not has_types:
            add_violation(violations, "typing.missing_types_file", "warning", rel_dir, "Missing types.ts in component package.")
        if not has_hooks:
            missing.append("hooks.ts")
        if not has_barrel:
            add_violation(violations, "exports.barrel_file", "warning", rel_dir, "Missing index.ts barrel export.")
        if not has_test:
            add_violation(violations, "tests.missing_component_test", "warning", rel_dir, "Missing component test scaffold.")
        if missing:
            add_violation(violations, "structure.component_files", "warning", rel_dir,
                          "Component package is missing expected files: " + ", ".join(missing))

def inspect_source_file(path: Path, violations: list[dict[str, Any]], repo: Path):
    text = read_text(path)
    if not text:
        return
    rel = str(path.relative_to(repo))

    if ANY_RE.search(text):
        add_violation(violations, "typing.any_usage", "warning", rel, "Detected explicit any usage.",
                      line_of(text, ANY_RE.search(text).group(0)))

    hook_defs = HOOK_NAME_RE.findall(text)
    if "hooks.ts" in path.name:
        # hooks.ts exists; naming violations are harder. Detect const/function names not starting with use if exported hooks file has exported symbols.
        exported_fn = re.findall(r"\bexport\s+(?:function|const)\s+([A-Za-z_]\w*)", text)
        for name in exported_fn:
            if not name.startswith("use"):
                add_violation(violations, "hooks.naming", "warning", rel,
                              f"Exported hook-like symbol '{name}' in hooks file does not use useXxx naming.")

    if "useEffect(" in text:
        suspicious = False
        has_listener = any(pattern in text for pattern in LISTENER_PATTERNS)
        has_cleanup = any(pattern in text for pattern in CLEANUP_PATTERNS) or "return () =>" in text
        if has_listener and not has_cleanup:
            suspicious = True
            add_violation(violations, "hooks.missing_cleanup", "error", rel,
                          "Effect appears to add listeners/timers without cleanup.")
        if "useEffect(() => {" in text and "}, []" in text and ("props." in text or "state" in text or "set" in text):
            add_violation(violations, "hooks.missing_dependencies", "warning", rel,
                          "Detected empty dependency array in effect with possibly dynamic references.")
        if suspicious:
            pass

    if any(pattern in text for pattern in FETCH_PATTERNS):
        if path.name.endswith(".tsx") or "component" in path.parts:
            add_violation(violations, "data_fetching.fetch_in_component", "warning", rel,
                          "Detected direct fetch/axios usage in a component-oriented file.")

    if INLINE_OBJECT_PROP_RE.search(text):
        add_violation(violations, "performance.inline_array_object_prop", "info", rel,
                      "Detected inline object prop in JSX; review rerender impact.")
    if INLINE_ARRAY_PROP_RE.search(text):
        add_violation(violations, "performance.inline_array_object_prop", "info", rel,
                      "Detected inline array prop in JSX; review rerender impact.")
    if REGEX_IN_RENDER_RE.search(text):
        add_violation(violations, "performance.regex_in_render", "info", rel,
                      "Detected RegExp construction in source; review render-path cost.")
    if SORT_MUTATION_RE.search(text):
        add_violation(violations, "performance.sort_mutation", "info", rel,
                      "Detected .sort(); review immutable sorting expectations.")

    line_count = text.count("\n") + 1
    if path.suffix == ".tsx" and line_count > 250:
        add_violation(violations, "architecture.oversized_component", "warning", rel,
                      f"Large component file ({line_count} lines); review component responsibilities.")

    if path.suffix == ".tsx" and "fetch(" not in text and "axios" not in text:
        if ("onClick" in text or "useEffect(" in text) and not (path.with_name("hooks.ts").exists()):
            add_violation(violations, "data_fetching.missing_query_layer", "info", rel,
                          "Interactive component without nearby hooks.ts; review whether logic should be extracted.")

def generate_markdown(report: dict[str, Any]) -> str:
    lines = ["# VNPT React Developer Audit Report", ""]
    lines.append(f"- Source root: `{report['source_root']}`")
    lines.append(f"- Files scanned: {report['files_scanned']}")
    lines.append(f"- Violations found: {report['violation_count']}")
    lines.append("")
    sev_counts = report["summary"]["by_severity"]
    lines.append("## Summary by severity")
    for sev in ("error", "warning", "info"):
        lines.append(f"- {sev}: {sev_counts.get(sev, 0)}")
    lines.append("")
    rule_counts = report["summary"]["by_rule"]
    lines.append("## Summary by rule")
    for rule, count in sorted(rule_counts.items(), key=lambda x: (-x[1], x[0])):
        lines.append(f"- {rule}: {count}")
    lines.append("")
    lines.append("## Detailed findings")
    for item in report["violations"]:
        loc = f" (line {item['line']})" if "line" in item else ""
        lines.append(f"- **{item['severity'].upper()}** `{item['rule_id']}` — `{item['path']}`{loc}: {item['message']}")
    if not report["violations"]:
        lines.append("- No machine-detectable violations found.")
    lines.append("")
    lines.append("## Manual review handoff")
    lines.append("Use this report with the bundled `bmad-vnpt-web-react` workflow for second-layer AI review and mandatory quality gating.")
    lines.append("Focus manual review on semantics, architecture boundaries, rule selection trade-offs, and refactor design.")
    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Audit a React codebase against the VNPT React Developer machine-checkable rules.")
    parser.add_argument("--repo", default=".", help="Repository root.")
    parser.add_argument("--source", default=None, help="Optional source root relative to repo (for example src or apps/web/src).")
    parser.add_argument("--manifest", default=None, help="Optional rules manifest path.")
    parser.add_argument("--out-dir", default="reports/react-skill-audit", help="Output report directory relative to repo.")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    source_root = find_source_root(repo, args.source)
    out_dir = (repo / args.out_dir).resolve() if not Path(args.out_dir).is_absolute() else Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = Path(args.manifest).resolve() if args.manifest else Path(__file__).resolve().parent / "rules_manifest.json"
    manifest = load_manifest(manifest_path)

    violations: list[dict[str, Any]] = []
    files_scanned = 0

    for current, dirs, files in os.walk(source_root):
        cur_path = Path(current)
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        if should_skip_dir(cur_path):
            continue

        # inspect this directory as potential component directory
        try:
            inspect_component_directory(cur_path, violations, repo)
        except Exception:
            pass

        for file_name in files:
            path = cur_path / file_name
            if is_source_file(path):
                files_scanned += 1
                inspect_source_file(path, violations, repo)

    summary = {
        "by_severity": defaultdict(int),
        "by_rule": defaultdict(int),
    }
    for v in violations:
        summary["by_severity"][v["severity"]] += 1
        summary["by_rule"][v["rule_id"]] += 1

    report = {
        "tool": "vnpt-react-developer-audit",
        "version": "1.0.0",
        "source_root": str(source_root),
        "files_scanned": files_scanned,
        "violation_count": len(violations),
        "rules_manifest": str(manifest_path),
        "manifest_version": manifest.get("version"),
        "violations": violations,
        "summary": {
            "by_severity": dict(summary["by_severity"]),
            "by_rule": dict(summary["by_rule"]),
        },
    }

    json_path = out_dir / "react-skill-audit.json"
    md_path = out_dir / "react-skill-audit.md"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    md_path.write_text(generate_markdown(report), encoding="utf-8")

    print(f"Wrote JSON report: {json_path}")
    print(f"Wrote Markdown report: {md_path}")
    print("Next step: run the manual review workflow using the generated report.")
if __name__ == "__main__":
    main()
