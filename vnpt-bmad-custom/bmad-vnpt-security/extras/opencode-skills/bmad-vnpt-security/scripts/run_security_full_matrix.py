#!/usr/bin/env python3
from __future__ import annotations
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> int:
    proc = subprocess.run(['python3', str(HERE / 'infer_security_stack.py')], capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr)
        return proc.returncode
    data = json.loads(proc.stdout)
    detected = data.get('detected_stacks', [])
    review_plan = ['appsec', 'auth', 'api', 'devsecops', 'cloud-k8s', 'compliance']
    stack_to_command = {stack: f'bmad-vnpt-security-{stack}' for stack in detected}
    print(json.dumps({
        'detected_stacks': detected,
        'review_plan': review_plan,
        'stack_commands': stack_to_command,
        'full_command': 'bmad-vnpt-security'
    }, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
