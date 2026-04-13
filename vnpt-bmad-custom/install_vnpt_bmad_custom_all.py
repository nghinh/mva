#!/usr/bin/env python3
from __future__ import annotations

import argparse
import getpass
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


UIUX_REPO = "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git"
SERENA_REPO = "https://github.com/oraios/serena.git"
SERENA_DIR = Path.home() / "serena"
SERENA_CONFIG_TEMPLATE = Path("src") / "serena" / "resources" / "serena_config.template.yml"

CORE_BUNDLE_PACKAGES = [
    "bmad-vnpt-deep-review",
    "bmad-vnpt-web-react",
    "bmad-vnpt-web-angular",
    "bmad-vnpt-web-vue",
    "bmad-vnpt-mobile-react",
    "bmad-vnpt-mobile-flutter",
    "bmad-vnpt-dotnet",
    "bmad-vnpt-python",
    "bmad-vnpt-c-cpp",
    "bmad-vnpt-devops",
    "bmad-vnpt-golang",
    "bmad-vnpt-java-springboot",
    "bmad-vnpt-nodejs",
    "bmad-vnpt-php",
    "bmad-vnpt-security",
]


LEGACY_REFERENCE_PATTERNS = [
    "springboot-patterns",
    "bmad-vnpt-java-springboot-custom",
]

def info(msg: str) -> None:
    print(f"[INFO] {msg}")


def warn(msg: str) -> None:
    print(f"[WARN] {msg}")


def fail(msg: str, code: int = 1) -> int:
    print(f"[ERROR] {msg}", file=sys.stderr)
    return code


def run(
    cmd: list[str],
    cwd: Optional[Path] = None,
    check: bool = True,
    input_text: Optional[str] = None,
) -> subprocess.CompletedProcess:
    info("$ " + " ".join(str(c) for c in cmd))
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        check=check,
        text=True,
        input=input_text,
    )


def backup_if_exists(path: Path) -> None:
    if not path.exists():
        return
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = path.with_name(path.name + f".bak-{timestamp}")
    shutil.copy2(path, backup)
    info(f"Backed up {path} -> {backup}")


def copy_file(src: Path, dst: Path) -> None:
    if not src.is_file():
        raise FileNotFoundError(f"Missing source file: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    info(f"Copied {src} -> {dst}")


def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Missing source path: {src}")
    if dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)
    info(f"Copied {src} -> {dst}")


def ensure_repo_root(repo: Path) -> None:
    repo.mkdir(parents=True, exist_ok=True)
    (repo / ".opencode" / "skills").mkdir(parents=True, exist_ok=True)
    (repo / ".opencode" / "commands").mkdir(parents=True, exist_ok=True)
    (repo / ".opencode" / "agents").mkdir(parents=True, exist_ok=True)
    (repo / "_bmad" / "_config" / "agents").mkdir(parents=True, exist_ok=True)
    (repo / "docs").mkdir(parents=True, exist_ok=True)


def ensure_uv() -> Path:
    candidates = [shutil.which("uv"), str(Path.home() / ".local" / "bin" / "uv")]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            uv_path = Path(candidate).expanduser().resolve()
            info(f"Using uv: {uv_path}")
            return uv_path

    if sys.platform.startswith("linux") or sys.platform == "darwin":
        curl = shutil.which("curl")
        if not curl:
            raise EnvironmentError(
                "uv is not installed and curl is not available to auto-install it."
            )
        info("uv not found. Installing uv...")
        run(["bash", "-lc", "curl -LsSf https://astral.sh/uv/install.sh | sh"])
        installed = Path.home() / ".local" / "bin" / "uv"
        if installed.exists():
            info(f"Installed uv: {installed}")
            return installed.resolve()

    raise EnvironmentError(
        "uv is required for Serena. Install uv first, then rerun this script."
    )


def ensure_yaml_scalar(text: str, key: str, value: str) -> str:
    pattern = re.compile(rf"(?m)^(?P<indent>[ \t]*){re.escape(key)}:\s*.*$")
    replacement = f"{key}: {value}"
    if pattern.search(text):
        return pattern.sub(replacement, text, count=1)
    if text and not text.endswith("\n"):
        text += "\n"
    return text + replacement + "\n"


def ensure_serena_project(config_path: Path, repo: Path) -> None:
    repo_str = str(repo)
    text = config_path.read_text(encoding="utf-8") if config_path.exists() else ""

    project_block = re.compile(r"(?ms)^projects:\s*\n(?P<body>(?:^[ \t]*-[^\n]*\n?)*)")
    match = project_block.search(text)
    if match:
        body = match.group("body")
        lines = [line.rstrip("\n") for line in body.splitlines() if line.strip()]
        if not any(repo_str in line for line in lines):
            insertion = f"  - path: {repo_str}\n"
            text = text[: match.end("body")] + insertion + text[match.end("body") :]
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        text += f"projects:\n  - path: {repo_str}\n"

    text = ensure_yaml_scalar(text, "default_project", f'"{repo_str}"')
    config_path.write_text(text, encoding="utf-8")
    info(f"Updated Serena project config: {config_path}")


def install_serena(repo: Path) -> None:
    uv_path = ensure_uv()
    git = shutil.which("git")
    if not git:
        raise EnvironmentError("git is required to install Serena")

    if (SERENA_DIR / ".git").exists():
        info(f"Serena already exists at {SERENA_DIR}. Updating repository...")
        run([git, "-C", str(SERENA_DIR), "pull", "--ff-only"], check=False)
    elif SERENA_DIR.exists():
        info(f"Serena directory already exists at {SERENA_DIR}. Reusing it.")
    else:
        info(f"Cloning Serena into {SERENA_DIR}...")
        run([git, "clone", SERENA_REPO, str(SERENA_DIR)])

    template = SERENA_DIR / SERENA_CONFIG_TEMPLATE
    config_path = SERENA_DIR / "serena_config.yml"
    if not config_path.exists():
        if template.exists():
            copy_file(template, config_path)
        else:
            warn(
                f"Serena config template not found at {template}. Creating a minimal config instead."
            )
            config_path.write_text("", encoding="utf-8")

    ensure_serena_project(config_path, repo)

    run(
        [str(uv_path), "run", "--directory", str(SERENA_DIR), "serena", "--help"],
        check=True,
    )
    info("Serena installed and ready for OpenCode MCP startup.")


def resolve_bundle(bundle: Optional[str]) -> Path:
    root = Path(bundle).expanduser().resolve() if bundle else Path(__file__).resolve().parent
    if not root.is_dir():
        raise FileNotFoundError(f"Bundle folder not found: {root}")
    expected = [
        root / "bmad-architect-custom",
        root / "bmad-data-architect-custom",
        root / "bmad-dev-custom",
        root / "bmad-ui-design-concept",
        root / "bmad-ux-designer-custom",
        root / "opencode_config",
        root / "vnpt-review-orchestrator",
        root / "vnpt-dev-story-orchestrator",
    ]
    missing = [str(p) for p in expected if not p.exists()]
    if missing:
        raise FileNotFoundError("Bundle root is missing expected folders:\n- " + "\n- ".join(missing))
    return root


def ensure_minimal_project_context(repo: Path) -> Path:
    path = repo / "docs" / "project-context.md"
    if path.exists():
        return path
    content = """# Project Context

This is an initial placeholder project context created automatically for a brand new repository.

## Status
- BMAD custom bundle installed
- Detailed project context has not been generated yet

## Notes
- Replace this file later by running the normal BMAD project-context generation flow
- Until then, agents should treat this as a minimal bootstrap context only

## Temporary Working Rules
- Follow the active story and architecture documents as the primary source of truth
- If architecture docs do not exist yet, prefer minimal, incremental changes
- Do not infer broad product scope from this placeholder file
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    info(f"Created starter project context: {path}")
    return path


def install_agent_customizations(repo: Path, root: Path) -> None:
    mapping = {
        root / "bmad-dev-custom" / "extras" / "agent-customization" / "bmm-dev.customize.yaml": repo / "_bmad" / "_config" / "agents" / "bmm-dev.customize.yaml",
        root / "bmad-ux-designer-custom" / "extras" / "agent-customization" / "bmm-ux-designer.customize.yaml": repo / "_bmad" / "_config" / "agents" / "bmm-ux-designer.customize.yaml",
        root / "bmad-architect-custom" / "extras" / "agent-customization" / "bmm-architect.customize.yaml": repo / "_bmad" / "_config" / "agents" / "bmm-architect.customize.yaml",
    }
    for src, dst in mapping.items():
        copy_file(src, dst)


def run_bmad_install(repo: Path, root: Path, username: str) -> None:
    _ = root
    npx = shutil.which("npx")
    if not npx:
        raise EnvironmentError("npx not found in PATH")
    cmd = [
        npx,
        "bmad-method@6.2.0",
        "install",
        "--directory",
        str(repo),
        "--modules",
        "bmm",
        "--tools",
        "opencode",
        "--user-name",
        username,
        "--communication-language",
        "English",
        "--document-output-language",
        "English",
        "--output-folder",
        "docs",
        "--yes",
    ]
    run(cmd, cwd=repo, check=True)

def install_uiux_skill(repo: Path) -> None:
    target = repo / ".opencode" / "skills" / "ui-ux-pro-max"
    if target.exists():
        info(f"ui-ux-pro-max already exists at {target}")
        return

    git = shutil.which("git")
    if not git:
        raise EnvironmentError("git is required to auto-install ui-ux-pro-max")

    temp_dir = repo / ".tmp_uiux_skill_clone"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)

    try:
        run([git, "clone", "--depth", "1", UIUX_REPO, str(temp_dir)])
        candidates = [
            temp_dir / ".opencode" / "skills" / "ui-ux-pro-max",
            temp_dir / ".claude" / "skills" / "ui-ux-pro-max",
            temp_dir / "ui-ux-pro-max",
            temp_dir / "src" / "ui-ux-pro-max",
        ]
        picked = next((c for c in candidates if c.exists()), None)
        if picked is None:
            raise FileNotFoundError("Could not locate ui-ux-pro-max skill folder in cloned repository.")
        copy_tree(picked, target)
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


def install_ui_design_workflow(repo: Path, root: Path) -> None:
    pkg = root / "bmad-ui-design-concept"
    copy_file(pkg / "extras" / "opencode-commands" / "bmad-create-ui-design-concept.md", repo / ".opencode" / "commands" / "bmad-create-ui-design-concept.md")
    copy_file(pkg / "src" / "workflows" / "bmad-create-ui-design-concept" / "workflow.md", repo / ".opencode" / "skills" / "bmad-create-ui-design-concept" / "SKILL.md")


def install_data_architect_custom(repo: Path, root: Path) -> None:
    pkg = root / "bmad-data-architect-custom"
    copy_file(pkg / "extras" / "opencode-commands" / "bmad-create-data-architecture.md", repo / ".opencode" / "commands" / "bmad-create-data-architecture.md")
    copy_file(pkg / "src" / "workflows" / "bmad-create-data-architecture" / "workflow.md", repo / ".opencode" / "skills" / "bmad-create-data-architecture" / "SKILL.md")





def install_orchestrator_package(
    repo: Path,
    root: Path,
    package_name: str,
    example_target_name: str,
    docs_target_name: str,
) -> None:
    pkg = root / package_name
    if not pkg.exists():
        info(f"{package_name} not found in bundle. Skipping.")
        return

    commands_dir = pkg / ".opencode" / "commands"
    if commands_dir.exists():
        for command_src in sorted(commands_dir.glob("*.md")):
            copy_file(command_src, repo / ".opencode" / "commands" / command_src.name)

    agents_dir = pkg / ".opencode" / "agents"
    if agents_dir.exists():
        for agent_src in sorted(agents_dir.glob("*.md")):
            copy_file(agent_src, repo / ".opencode" / "agents" / agent_src.name)

    example_src = pkg / "opencode.jsonc.example"
    if example_src.exists():
        copy_file(example_src, repo / ".opencode" / example_target_name)

    readme_src = pkg / "README.md"
    if readme_src.exists():
        copy_file(readme_src, repo / "docs" / docs_target_name)


def install_review_orchestrator(repo: Path, root: Path) -> None:
    install_orchestrator_package(
        repo,
        root,
        "vnpt-review-orchestrator",
        "opencode.review-orchestrator.jsonc.example",
        "vnpt-review-orchestrator.README.md",
    )


def install_dev_story_orchestrator(repo: Path, root: Path) -> None:
    install_orchestrator_package(
        repo,
        root,
        "vnpt-dev-story-orchestrator",
        "opencode.dev-story-orchestrator.jsonc.example",
        "vnpt-dev-story-orchestrator.README.md",
    )

def install_global_opencode_configs(root: Path) -> None:
    config_root = Path.home() / ".config" / "opencode"
    config_root.mkdir(parents=True, exist_ok=True)
    source_root = root / "opencode_config"
    if not source_root.exists():
        raise FileNotFoundError(f"Missing opencode_config directory in bundle: {source_root}")
    for src in sorted(source_root.glob("*")):
        if src.is_file():
            dst = config_root / src.name
            backup_if_exists(dst)
            copy_file(src, dst)
        elif src.is_dir():
            dst = config_root / src.name
            if dst.exists():
                backup = dst.with_name(dst.name + f".bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
                shutil.move(str(dst), str(backup))
                info(f"Backed up {dst} -> {backup}")
            copy_tree(src, dst)


def copy_text_with_replacements(src: Path, dst: Path, replacements: dict[str, str]) -> None:
    text = src.read_text(encoding="utf-8")
    for old, new in replacements.items():
        text = text.replace(old, new)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(text, encoding="utf-8")
    info(f"Copied {src} -> {dst} with replacements")


def copy_tree_with_replacements(src: Path, dst: Path, replacements: dict[str, str]) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Missing source path: {src}")
    if dst.exists():
        shutil.rmtree(dst)
    for item in src.rglob('*'):
        rel = item.relative_to(src)
        target = dst / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            data = item.read_text(encoding='utf-8')
            for old, new in replacements.items():
                data = data.replace(old, new)
            target.write_text(data, encoding='utf-8')
        except UnicodeDecodeError:
            shutil.copy2(item, target)
        info(f"Copied {item} -> {target}")


def install_opencode_package(repo: Path, pkg: Path, source_name: str, canonical_name: str) -> list[str]:
    installed: list[str] = []

    command_src = pkg / "extras" / "opencode-commands" / f"{source_name}.md"
    skill_src = pkg / "extras" / "opencode-skills" / source_name
    workflow_src = pkg / "src" / "workflows" / source_name / "workflow.md"

    if source_name == canonical_name:
        if command_src.exists():
            copy_file(command_src, repo / ".opencode" / "commands" / f"{canonical_name}.md")
            installed.append(canonical_name)
        if skill_src.exists():
            copy_tree(skill_src, repo / ".opencode" / "skills" / canonical_name)
            if canonical_name not in installed:
                installed.append(canonical_name)
        if workflow_src.exists():
            copy_file(workflow_src, repo / ".opencode" / "skills" / canonical_name / "workflow.md")
            if canonical_name not in installed:
                installed.append(canonical_name)
        return installed

    replacements = {source_name: canonical_name}
    if command_src.exists():
        copy_text_with_replacements(command_src, repo / ".opencode" / "commands" / f"{canonical_name}.md", replacements)
        installed.append(canonical_name)
    if skill_src.exists():
        copy_tree_with_replacements(skill_src, repo / ".opencode" / "skills" / canonical_name, replacements)
        if canonical_name not in installed:
            installed.append(canonical_name)
    if workflow_src.exists():
        copy_text_with_replacements(workflow_src, repo / ".opencode" / "skills" / canonical_name / "workflow.md", replacements)
        if canonical_name not in installed:
            installed.append(canonical_name)
    return installed


def install_bundle_package(repo: Path, root: Path, package_dir_name: str) -> list[str]:
    pkg = root / package_dir_name
    if not pkg.exists():
        info(f"{package_dir_name} not found in bundle. Skipping.")
        return []


    installed: list[str] = []
    cmd_dir = pkg / "extras" / "opencode-commands"
    skill_root = pkg / "extras" / "opencode-skills"
    workflow_root = pkg / "src" / "workflows"

    command_names = {p.stem for p in cmd_dir.glob("*.md")} if cmd_dir.exists() else set()
    skill_names = {p.name for p in skill_root.iterdir() if p.is_dir()} if skill_root.exists() else set()
    workflow_names = {
        p.name for p in workflow_root.iterdir() if p.is_dir() and (p / "workflow.md").exists()
    } if workflow_root.exists() else set()

    all_names = sorted(command_names | skill_names | workflow_names)
    for name in all_names:
        installed.extend(install_opencode_package(repo, pkg, name, name))

    unique: list[str] = []
    for name in installed:
        if name not in unique:
            unique.append(name)
    return unique


def install_all_bundle_packages(repo: Path, root: Path) -> list[str]:
    installed: list[str] = []
    for package_dir_name in CORE_BUNDLE_PACKAGES:
        installed.extend(install_bundle_package(repo, root, package_dir_name))

    # Catch future packages added later without needing installer edits.
    for pkg in sorted(root.glob("bmad-vnpt-*")):
        if not pkg.is_dir() or pkg.name in CORE_BUNDLE_PACKAGES:
            continue
        installed.extend(install_bundle_package(repo, root, pkg.name))

    unique: list[str] = []
    for name in installed:
        if name not in unique:
            unique.append(name)
    return unique


def audit_bundle_consistency(root: Path) -> None:
    warnings: list[str] = []

    for legacy in LEGACY_REFERENCE_PATTERNS:
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix in {".pyc", ".png", ".jpg", ".jpeg", ".webp", ".zip"}:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            if legacy in text:
                warnings.append(f"Legacy reference '{legacy}' found in {path.relative_to(root)}")

    for pkg in sorted(root.glob("bmad-vnpt-*")):
        if not pkg.is_dir():
            continue
        name = pkg.name
        cmd = pkg / "extras" / "opencode-commands" / f"{name}.md"
        skill = pkg / "extras" / "opencode-skills" / name / "SKILL.md"
        wf = pkg / "src" / "workflows" / name / "workflow.md"
        if not cmd.exists():
            warnings.append(f"Missing canonical command for {name}: {cmd.relative_to(root)}")
        if not skill.exists():
            warnings.append(f"Missing canonical skill for {name}: {skill.relative_to(root)}")
        if not wf.exists():
            warnings.append(f"Missing canonical workflow for {name}: {wf.relative_to(root)}")

    if warnings:
        warn("Bundle consistency audit found issues:")
        for item in warnings:
            warn(f"- {item}")


def verify(repo: Path, installed_names: list[str], verify_global_config: bool = True, verify_serena: bool = True) -> None:
    checks = [
        repo / "_bmad" / "_config" / "agents" / "bmm-dev.customize.yaml",
        repo / "_bmad" / "_config" / "agents" / "bmm-ux-designer.customize.yaml",
        repo / "_bmad" / "_config" / "agents" / "bmm-architect.customize.yaml",
        repo / ".opencode" / "skills" / "ui-ux-pro-max",
        repo / ".opencode" / "skills" / "bmad-vnpt-java-springboot" / "SKILL.md",
        repo / ".opencode" / "skills" / "bmad-create-ui-design-concept" / "SKILL.md",
        repo / ".opencode" / "commands" / "bmad-create-ui-design-concept.md",
        repo / ".opencode" / "skills" / "bmad-create-data-architecture" / "SKILL.md",
        repo / ".opencode" / "commands" / "bmad-create-data-architecture.md",
        repo / ".opencode" / "commands" / "vnpt-review-loop.md",
        repo / ".opencode" / "agents" / "vnpt-review-orchestrator.md",
        repo / ".opencode" / "agents" / "vnpt-review-auditor.md",
        repo / ".opencode" / "agents" / "vnpt-fix-worker.md",
        repo / ".opencode" / "commands" / "vnpt-dev-story-loop.md",
        repo / ".opencode" / "agents" / "vnpt-dev-story-orchestrator.md",
        repo / ".opencode" / "agents" / "vnpt-story-implementer.md",
    ]

    if verify_global_config:
        checks.append(Path.home() / ".config" / "opencode" / "opencode.json")
    if verify_serena:
        checks.append(SERENA_DIR / "serena_config.yml")

    for name in installed_names:
        checks.extend([
            repo / ".opencode" / "skills" / name / "SKILL.md",
            repo / ".opencode" / "commands" / f"{name}.md",
            repo / ".opencode" / "skills" / name / "workflow.md",
        ])

    missing = [str(p) for p in checks if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing installed files:\n- " + "\n- ".join(missing))


def install_gitnexus() -> None:
    info("Installing gitnexus...")
    try:
        run(["npm", "install", "-g", "gitnexus"], check=True)
        print()
        info("gitnexus installed successfully.")
        info("Next step: run 'gitnexus analyze' to index the source code in your repo.")
    except subprocess.CalledProcessError:
        print()
        warn("npm install -g gitnexus failed (likely due to Node.js version incompatibility).")
        info("gitnexus MCP is already configured in opencode.json.")
        info("You can still use gitnexus via npx: 'npx -y gitnexus@latest analyze'")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="One-command installer for the VNPT BMAD custom bundle + BMAD 6.2.0")
    p.add_argument("--repo", default=".", help="Target project repo (defaults to current directory)")
    p.add_argument("--bundle", default=None, help="Path to the vnpt-bmad-custom folder. If omitted, uses the folder containing this script.")
    p.add_argument("--skip-serena", action="store_true", help="Skip Serena installation and configuration")
    p.add_argument("--skip-gitnexus", action="store_true", help="Skip GitNexus installation")
    p.add_argument("--skip-global-opencode-config", action="store_true", help="Do not overwrite ~/.config/opencode from the bundle")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    repo = Path(args.repo).expanduser().resolve()
    try:
        ensure_repo_root(repo)
        root = resolve_bundle(args.bundle)
        info(f"Resolved bundle root: {root}")
        audit_bundle_consistency(root)
        ensure_minimal_project_context(repo)

        username = getpass.getuser() or os.environ.get("USER") or "Team"
        info(f"Using system username for BMAD install: {username}")

        install_agent_customizations(repo, root)
        run_bmad_install(repo, root, username)
        install_uiux_skill(repo)
        install_ui_design_workflow(repo, root)
        install_data_architect_custom(repo, root)
        installed_names = install_all_bundle_packages(repo, root)
        install_review_orchestrator(repo, root)
        install_dev_story_orchestrator(repo, root)

        skipped: list[str] = []
        if args.skip_global_opencode_config:
            skipped.append("global opencode config")
        else:
            install_global_opencode_configs(root)

        if args.skip_serena:
            skipped.append("serena")
        else:
            install_serena(repo)

        if args.skip_gitnexus:
            skipped.append("gitnexus")
        else:
            install_gitnexus()

        verify(
            repo,
            installed_names,
            verify_global_config=not args.skip_global_opencode_config,
            verify_serena=not args.skip_serena,
        )

        print()
        info("Installation completed successfully.")
        info("Installed workflow/skill commands: " + ", ".join(installed_names))
        if skipped:
            info("Skipped optional components: " + ", ".join(skipped))
        info("Next step: restart OpenCode in this repo so it reloads skills, commands, and configs.")
        info("A starter docs/project-context.md was created automatically if your repo was brand new.")
        return 0
    except Exception as exc:
        return fail(str(exc))


if __name__ == "__main__":
    sys.exit(main())
