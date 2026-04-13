#!/usr/bin/env python3
"""
Validate Event Patterns

Validates event-driven patterns for Kafka, NATS, and MQTT implementations.
Checks for proper event naming, serialization, error handling, and idempotency.

Usage:
    python validate_event_patterns.py --path <feature_path>

Checks:
    - Event naming conventions (past tense for events)
    - Event serialization/deserialization error handling
    - Idempotent consumer patterns
    - Dead letter queue handling
    - Context propagation in async handlers
    - Retry logic with backoff

Author: Expert Go Backend Developer Skill
"""

import argparse
import os
import re
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional


class Severity(Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class EventPatternIssue:
    file_path: str
    line_number: int
    category: str
    description: str
    severity: Severity
    suggestion: str


# Event naming patterns (should use past tense)
BAD_EVENT_NAMES = [
    r'Event[A-Z]\w+',        # EventCreated (should be CreatedEvent)
    r'_event\s*[:=]',        # snake_case_event
    r'event_[a-z]+',         # event_action
]

GOOD_EVENT_PATTERNS = [
    r'\w+CreatedEvent',
    r'\w+UpdatedEvent',
    r'\w+DeletedEvent',
    r'\w+PublishedEvent',
    r'\w+ReceivedEvent',
    r'\w+ProcessedEvent',
    r'\w+FailedEvent',
    r'\w+CompletedEvent',
]

# Anti-patterns in event handling
EVENT_ANTI_PATTERNS = [
    {
        "pattern": r"json\.Unmarshal\([^)]+\)\s*(?:\n|;|\))",
        "category": "Error Handling",
        "description": "JSON unmarshal error not checked",
        "severity": Severity.CRITICAL,
        "suggestion": "Always check error: if err := json.Unmarshal(data, &event); err != nil { ... }"
    },
    {
        "pattern": r"json\.Marshal\([^)]+\)\s*(?:\n|;|return\s+[^(])",
        "category": "Error Handling",
        "description": "JSON marshal error not checked",
        "severity": Severity.CRITICAL,
        "suggestion": "Always check error: data, err := json.Marshal(event); if err != nil { ... }"
    },
    {
        "pattern": r"go\s+func\s*\([^)]*\)\s*\{[^}]*nats\.Subscribe|kafka\.Consume",
        "category": "Concurrency",
        "description": "Subscription/Consumer in goroutine without context",
        "severity": Severity.WARNING,
        "suggestion": "Pass parent context to consumer for proper lifecycle management"
    },
    {
        "pattern": r"for\s+.*\{\s*(?:[^\}]*?)message\s*:?=\s*<-.*\s*(?:[^\}]*?)process\(",
        "category": "Idempotency",
        "description": "Message processing without idempotency check",
        "severity": Severity.WARNING,
        "suggestion": "Implement idempotent processing with message ID tracking"
    },
    {
        "pattern": r"nats\.Subscribe\([^,]+,\s*func\([^)]*\)\s*\{[^}]*context\.Background\(\)",
        "category": "Context Propagation",
        "description": "Using context.Background() in NATS handler",
        "severity": Severity.WARNING,
        "suggestion": "Use context from message headers or create derived context"
    },
    {
        "pattern": r"fmt\.Sprintf\s*\(\s*[\"'][^\"']*\{[^\"']*[\"']",
        "category": "Serialization",
        "description": "String formatting for event data (use JSON)",
        "severity": Severity.INFO,
        "suggestion": "Use json.Marshal for structured event data"
    },
    {
        "pattern": r"retry\s*[:=]\s*\d+",
        "category": "Retry Logic",
        "description": "Hardcoded retry count without backoff",
        "severity": Severity.INFO,
        "suggestion": "Use exponential backoff: retry.WithBackoff(maxRetries, initialDelay)"
    },
    {
        "pattern": r"panic\s*\([^)]*message",
        "category": "Error Handling",
        "description": "Panic in message handler will crash consumer",
        "severity": Severity.CRITICAL,
        "suggestion": "Return error and let DLQ handler deal with failures"
    },
]

# Required patterns for proper event handling
REQUIRED_PATTERNS = [
    {
        "pattern": r"type\s+\w+Event\s+struct",
        "category": "Event Definition",
        "description": "Event struct should be defined",
        "severity": Severity.INFO,
    },
    {
        "pattern": r"EventID|MessageID|TraceID",
        "category": "Tracing",
        "description": "Events should have unique ID for tracing",
        "severity": Severity.INFO,
    },
    {
        "pattern": r"Timestamp|CreatedAt|OccurredAt",
        "category": "Timing",
        "description": "Events should have timestamp",
        "severity": Severity.INFO,
    },
]


def validate_event_naming(content: str, file_path: str) -> list[EventPatternIssue]:
    """Validate event naming conventions."""
    issues = []

    # Check for bad event names
    for pattern in BAD_EVENT_NAMES:
        regex = re.compile(pattern)
        for match in regex.finditer(content):
            line_num = content[:match.start()].count('\n') + 1
            issues.append(EventPatternIssue(
                file_path=file_path,
                line_number=line_num,
                category="Naming Convention",
                description=f"Event name '{match.group()}' doesn't follow past-tense convention",
                severity=Severity.INFO,
                suggestion="Use past-tense: UserCreatedEvent, OrderPlacedEvent, PaymentProcessedEvent"
            ))

    return issues


def validate_file(file_path: Path) -> list[EventPatternIssue]:
    """Validate a single Go file for event patterns."""
    issues = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}", file=sys.stderr)
        return issues

    # Skip non-event files
    if not any(x in content.lower() for x in ['event', 'message', 'kafka', 'nats', 'mqtt', 'subscribe', 'publish', 'consume']):
        return issues

    # Check naming
    issues.extend(validate_event_naming(content, str(file_path)))

    # Check anti-patterns
    for pattern_def in EVENT_ANTI_PATTERNS:
        pattern = pattern_def["pattern"]
        regex = re.compile(pattern, re.IGNORECASE)

        for match in regex.finditer(content):
            line_num = content[:match.start()].count('\n') + 1
            issues.append(EventPatternIssue(
                file_path=str(file_path),
                line_number=line_num,
                category=pattern_def["category"],
                description=pattern_def["description"],
                severity=pattern_def["severity"],
                suggestion=pattern_def["suggestion"]
            ))

    return issues


def validate_directory(directory: Path) -> list[EventPatternIssue]:
    """Validate all Go files in a directory."""
    all_issues = []

    for file_path in directory.rglob('*.go'):
        if '_test.' in str(file_path) or 'vendor/' in str(file_path):
            continue
        issues = validate_file(file_path)
        all_issues.extend(issues)

    return all_issues


def check_required_patterns(directory: Path) -> list[dict]:
    """Check for required patterns in event definitions."""
    found_patterns = {p["category"]: False for p in REQUIRED_PATTERNS}

    for file_path in directory.rglob('*.go'):
        if '_test.' in str(file_path):
            continue
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            for pattern_def in REQUIRED_PATTERNS:
                if re.search(pattern_def["pattern"], content):
                    found_patterns[pattern_def["category"]] = True
        except Exception:
            pass

    return [
        {"category": k, "found": v}
        for k, v in found_patterns.items()
    ]


def generate_report(issues: list[EventPatternIssue], required: list[dict]) -> str:
    """Generate a validation report."""
    lines = ["# Event Pattern Validation Report\n"]

    # Summary
    critical = len([i for i in issues if i.severity == Severity.CRITICAL])
    warning = len([i for i in issues if i.severity == Severity.WARNING])
    info = len([i for i in issues if i.severity == Severity.INFO])

    lines.append("## Summary\n")
    lines.append(f"| Severity | Count |")
    lines.append(f"|----------|-------|")
    lines.append(f"| 🔴 Critical | {critical} |")
    lines.append(f"| 🟡 Warning | {warning} |")
    lines.append(f"| 🔵 Info | {info} |")

    if critical > 0:
        lines.append(f"\n⛔ **{critical} CRITICAL issues found - must fix before production**")

    # Required patterns
    lines.append("\n## Required Pattern Check\n")
    lines.append("| Pattern | Status |")
    lines.append("|---------|--------|")
    for r in required:
        status = "✅ Found" if r["found"] else "❌ Missing"
        lines.append(f"| {r['category']} | {status} |")

    # Issues by category
    if issues:
        lines.append("\n## Issues by Category\n")

        categories = {}
        for issue in issues:
            if issue.category not in categories:
                categories[issue.category] = []
            categories[issue.category].append(issue)

        for category, cat_issues in sorted(categories.items()):
            lines.append(f"\n### {category}\n")
            for issue in cat_issues:
                severity_emoji = {"CRITICAL": "🔴", "WARNING": "🟡", "INFO": "🔵"}
                emoji = severity_emoji.get(issue.severity.value, "")
                lines.append(f"- {emoji} **{issue.file_path}:{issue.line_number}**")
                lines.append(f"  - {issue.description}")
                lines.append(f"  - 💡 {issue.suggestion}")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Validate event-driven patterns'
    )
    parser.add_argument(
        '--path',
        required=True,
        help='Path to the feature directory'
    )
    parser.add_argument(
        '--output',
        help='Output file for report (default: stdout)'
    )
    parser.add_argument(
        '--strict',
        action='store_true',
        help='Exit with error code on any issues'
    )

    args = parser.parse_args()
    path = Path(args.path)

    if not path.exists():
        print(f"Error: Path does not exist: {path}", file=sys.stderr)
        sys.exit(1)

    # Validate
    if path.is_file():
        issues = validate_file(path)
        required = []
    else:
        issues = validate_directory(path)
        required = check_required_patterns(path)

    # Generate report
    report = generate_report(issues, required)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        print(f"Report written to {args.output}")
    else:
        print(report)

    # Exit code
    critical_count = len([i for i in issues if i.severity == Severity.CRITICAL])
    if critical_count > 0 or (args.strict and len(issues) > 0):
        sys.exit(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
