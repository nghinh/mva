#!/usr/bin/env python3
from __future__ import annotations
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

DEV_CUSTOM = 'extras/agent-customization/bmm-dev.customize.yaml'
OPTIONAL_SKILLS = [
    'bmad-vnpt-c-cpp',
    'bmad-vnpt-dotnet',
    'bmad-vnpt-golang',
    'bmad-vnpt-java-springboot',
    'bmad-vnpt-nodejs',
    'bmad-vnpt-php',
    'bmad-vnpt-python',
    'bmad-vnpt-mobile-flutter',
    'bmad-vnpt-mobile-react',
    'bmad-vnpt-web-angular',
    'bmad-vnpt-web-react',
    'bmad-vnpt-web-vue',
]


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f'Copied {src} -> {dst}')


def resolve_package(pkg_root: Path, skill_name: str, explicit: str | None) -> Path | None:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit).resolve())
    candidates.append((pkg_root.parent / skill_name).resolve())
    candidates.append((Path.cwd() / skill_name).resolve())
    for candidate in candidates:
        if (candidate / 'tools' / 'install_workflow.py').is_file():
            return candidate
    return None


def install_skill(repo: Path, skill_name: str, package_path: Path | None) -> bool:
    if package_path is None:
        print(f'Warning: package for {skill_name} not found. Skipping auto-install for this skill.')
        return False
    subprocess.run([
        sys.executable,
        str(package_path / 'tools' / 'install_workflow.py'),
        '--repo', str(repo),
        '--package', str(package_path),
    ], check=True)
    return True


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument('--repo', default='.')
    p.add_argument('--package', required=True)
    for skill in OPTIONAL_SKILLS:
        p.add_argument(f'--pkg-{skill}', default=None)
    args = p.parse_args()

    repo = Path(args.repo).resolve()
    pkg = Path(args.package).resolve()

    copy_file(pkg / DEV_CUSTOM, repo / '_bmad/_config/agents/bmm-dev.customize.yaml')

    installed = []
    missing = []
    for skill in OPTIONAL_SKILLS:
        explicit = getattr(args, f'pkg_{skill}'.replace('-', '_'))
        skill_pkg = resolve_package(pkg, skill, explicit)
        ok = install_skill(repo, skill, skill_pkg)
        (installed if ok else missing).append(skill)

    try:
        subprocess.run([sys.executable, str(pkg / 'tools/install_uiux_pro_max.py'), '--repo', str(repo)], check=True)
    except Exception:
        print('Warning: ui-ux-pro-max auto-install failed. Install it manually if needed.')

    print('
Installed skills:')
    for skill in installed:
        print(f'  - {skill}')
    if missing:
        print('
Missing packages not auto-installed:')
        for skill in missing:
            print(f'  - {skill}')
        print('Provide explicit --pkg-... arguments or place those packages next to bmad-dev-custom.')

    print('
Next BMAD step:')
    print('  npx bmad-method@6.2.0 install')
    print('  Then choose Recompile Agents')
    print('  Restart OpenCode in this repo after installation.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
