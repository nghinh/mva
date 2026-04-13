#!/usr/bin/env python3
"""
Go Security Vulnerability Scanner
==================================
Detect common security vulnerabilities in Go code including:
- SQL Injection (string concatenation in queries)
- Hardcoded credentials/secrets
- Weak cryptography (md5, sha1)
- Command injection patterns
- SSRF vulnerabilities
- Insecure file permissions
- Missing input validation

Usage:
    python validate_security.py <path_to_go_file_or_directory>
    python validate_security.py features/workflow --json
    python validate_security.py features/workflow --strict
"""

import os
import sys
import re
import argparse
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Set, Tuple, Optional
from enum import Enum


class Severity(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


@dataclass
class SecurityIssue:
    """Represents a security vulnerability found in code."""
    severity: Severity
    category: str
    file: str
    line: int
    message: str
    code_snippet: str
    recommendation: str
    cwe_id: str = ""  # Common Weakness Enumeration ID


@dataclass
class SecurityReport:
    """Holds security scan results."""
    files_scanned: int = 0
    issues: List[SecurityIssue] = field(default_factory=list)
    
    def has_critical(self) -> bool:
        return any(i.severity == Severity.CRITICAL for i in self.issues)
    
    def has_high(self) -> bool:
        return any(i.severity == Severity.HIGH for i in self.issues)
    
    def count_by_severity(self) -> Dict[str, int]:
        counts = {s.value: 0 for s in Severity}
        for issue in self.issues:
            counts[issue.severity.value] += 1
        return counts


class GoSecurityScanner:
    """Security scanner for Go code following OWASP guidelines."""
    
    def __init__(self, strict_mode: bool = False):
        self.report = SecurityReport()
        self.strict_mode = strict_mode
        
        # SQL Injection patterns
        self.sql_injection_patterns = [
            # String concatenation in SQL queries
            (r'(?:Query|Exec|QueryRow|QueryContext|ExecContext)\s*\([^)]*\+\s*[^)]+\)', 
             "SQL query with string concatenation - potential SQL injection",
             "CWE-89"),
            # fmt.Sprintf in SQL queries
            (r'(?:Query|Exec|QueryRow|QueryContext|ExecContext)\s*\([^)]*fmt\.Sprintf\s*\([^)]*\)',
             "SQL query using fmt.Sprintf - potential SQL injection",
             "CWE-89"),
            # Raw SQL string building
            (r'(?:sql|query|stmt)\s*(?:\+|:)=\s*["\'].*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)',
             "Dynamic SQL query construction - potential SQL injection",
             "CWE-89"),
        ]
        
        # Hardcoded secrets patterns
        self.hardcoded_secrets_patterns = [
            # Password in code
            (r'(?:password|passwd|pwd|secret|apikey|api_key|token|auth)\s*(?::=|=)\s*["\'][^"\']{8,}["\']',
             "Hardcoded secret/password detected",
             "CWE-798"),
            # AWS credentials
            (r'(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}',
             "Potential AWS Access Key ID detected",
             "CWE-798"),
            # Private keys
            (r'-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----',
             "Private key embedded in code",
             "CWE-321"),
            # JWT secrets
            (r'(?:jwt|JWT).*(?:secret|Secret|SECRET)\s*(?::=|=)\s*["\'][^"\']+["\']',
             "Hardcoded JWT secret detected",
             "CWE-798"),
        ]
        
        # Weak crypto patterns
        self.weak_crypto_patterns = [
            (r'crypto/md5', "Use of weak MD5 hash function", "CWE-328"),
            (r'crypto/sha1', "Use of weak SHA1 hash function", "CWE-328"),
            (r'crypto/des', "Use of weak DES encryption", "CWE-327"),
            (r'crypto/rc4', "Use of weak RC4 cipher", "CWE-327"),
            (r'math/rand', "Use of math/rand for security-sensitive operations - use crypto/rand instead", "CWE-338"),
        ]
        
        # Command injection patterns
        self.command_injection_patterns = [
            (r'exec\.Command\s*\([^)]*\+\s*[^)]+\)',
             "Command execution with string concatenation - potential command injection",
             "CWE-78"),
            (r'exec\.Command\s*\([^)]*fmt\.Sprintf\s*\([^)]*\)',
             "Command execution using fmt.Sprintf - potential command injection",
             "CWE-78"),
            (r'os\.(?:system|popen)\s*\(',
             "Direct OS command execution - potential command injection",
             "CWE-78"),
        ]
        
        # SSRF patterns
        self.ssrf_patterns = [
            (r'http\.Get\s*\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\)',
             "HTTP request with user-controlled URL - potential SSRF",
             "CWE-918"),
            (r'http\.(?:Get|Post|Head)\s*\([^)]*\+\s*[^)]+\)',
             "HTTP request with string concatenation in URL - potential SSRF",
             "CWE-918"),
        ]
        
        # Insecure file operations
        self.file_security_patterns = [
            (r'os\.(?:Open|Create|OpenFile)\s*\([^)]*,\s*0[0-7]{3}\s*\)',
             "Check file permissions - ensure they are not world-writable",
             "CWE-732"),
            (r'ioutil\.WriteFile\s*\([^)]*,\s*[^)]*,\s*0777\s*\)',
             "World-writable file permissions (0777) - too permissive",
             "CWE-732"),
            (r'os\.Chmod\s*\([^)]*,\s*0777\s*\)',
             "Setting world-writable permissions (0777)",
             "CWE-732"),
        ]
        
        # Path traversal patterns
        self.path_traversal_patterns = [
            (r'filepath\.Join\s*\([^)]*,\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\)',
             "Filepath join with user input - ensure path traversal prevention",
             "CWE-22"),
            (r'os\.(?:Open|Create|ReadFile|WriteFile)\s*\([^)"\']*\+',
             "File operation with string concatenation - potential path traversal",
             "CWE-22"),
        ]
        
        # Missing input validation
        self.input_validation_patterns = [
            (r'ctx\.(?:Bind|BindJSON|BindXML)\s*\([^)]*\)\s*(?:\n|\r\n)\s*(?!if)',
             "Request binding without error check",
             "CWE-20"),
            (r'strconv\.(?:Atoi|ParseInt|ParseFloat)\s*\([^)]*\)\s*(?:\n|\r\n)\s*(?!if)',
             "String conversion without error handling",
             "CWE-20"),
        ]
        
        # XSS patterns (for APIs that return HTML)
        self.xss_patterns = [
            (r'template\.HTML\s*\([^)]*\)',
             "Raw HTML template output - ensure input is sanitized",
             "CWE-79"),
            (r'fmt\.Fprintf\s*\(\s*w\s*,[^)]*\+',
             "Direct response writing with concatenation - potential XSS",
             "CWE-79"),
        ]
        
        # Unsafe patterns
        self.unsafe_patterns = [
            (r'import\s+["\']unsafe["\']',
             "Use of unsafe package - requires careful review",
             "CWE-242"),
            (r'unsafe\.Pointer',
             "Use of unsafe.Pointer - may bypass memory safety",
             "CWE-242"),
            (r'reflect\.(?:SliceHeader|StringHeader)',
             "Use of deprecated reflect headers - use unsafe.Slice instead",
             "CWE-242"),
        ]
        
        # Timing attack vulnerable patterns
        self.timing_patterns = [
            (r'==\s*["\'][^"\']{8,}["\'].*(?:password|token|secret|key)',
             "String comparison for secrets - use constant-time comparison",
             "CWE-208"),
            (r'bytes\.Equal\s*\([^)]*(?:password|token|secret|key)',
             "Consider using subtle.ConstantTimeCompare for secret comparison",
             "CWE-208"),
        ]

    def scan_file(self, filepath: Path) -> None:
        """Scan a single Go file for security issues."""
        if not filepath.suffix == '.go':
            return
        if '_test.go' in filepath.name:
            return  # Skip test files unless strict mode
            
        try:
            content = filepath.read_text(encoding='utf-8', errors='replace')
        except Exception as e:
            print(f"Warning: Could not read {filepath}: {e}", file=sys.stderr)
            return
            
        self.report.files_scanned += 1
        lines = content.split('\n')
        
        # Run all pattern checks
        self._check_patterns(filepath, content, lines, self.sql_injection_patterns, 
                            "SQL Injection", Severity.CRITICAL)
        self._check_patterns(filepath, content, lines, self.hardcoded_secrets_patterns,
                            "Hardcoded Secrets", Severity.CRITICAL)
        self._check_patterns(filepath, content, lines, self.weak_crypto_patterns,
                            "Weak Cryptography", Severity.HIGH)
        self._check_patterns(filepath, content, lines, self.command_injection_patterns,
                            "Command Injection", Severity.CRITICAL)
        self._check_patterns(filepath, content, lines, self.ssrf_patterns,
                            "SSRF", Severity.HIGH)
        self._check_patterns(filepath, content, lines, self.file_security_patterns,
                            "Insecure File Operations", Severity.MEDIUM)
        self._check_patterns(filepath, content, lines, self.path_traversal_patterns,
                            "Path Traversal", Severity.HIGH)
        self._check_patterns(filepath, content, lines, self.xss_patterns,
                            "Cross-Site Scripting", Severity.HIGH)
        self._check_patterns(filepath, content, lines, self.unsafe_patterns,
                            "Unsafe Operations", Severity.MEDIUM)
        
        if self.strict_mode:
            self._check_patterns(filepath, content, lines, self.input_validation_patterns,
                                "Input Validation", Severity.MEDIUM)
            self._check_patterns(filepath, content, lines, self.timing_patterns,
                                "Timing Attack", Severity.LOW)
        
        # Additional semantic checks
        self._check_tls_config(filepath, content, lines)
        self._check_cors_config(filepath, content, lines)
        self._check_cookie_security(filepath, content, lines)

    def _check_patterns(self, filepath: Path, content: str, lines: List[str],
                       patterns: List[Tuple[str, str, str]], category: str,
                       severity: Severity) -> None:
        """Check content against a list of regex patterns."""
        for pattern, message, cwe_id in patterns:
            for match in re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE):
                line_num = content[:match.start()].count('\n') + 1
                code_snippet = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                
                # Get recommendation based on category
                recommendation = self._get_recommendation(category, cwe_id)
                
                issue = SecurityIssue(
                    severity=severity,
                    category=category,
                    file=str(filepath),
                    line=line_num,
                    message=message,
                    code_snippet=code_snippet[:100],  # Truncate long snippets
                    recommendation=recommendation,
                    cwe_id=cwe_id
                )
                self.report.issues.append(issue)

    def _check_tls_config(self, filepath: Path, content: str, lines: List[str]) -> None:
        """Check for insecure TLS configurations."""
        # Check for TLS 1.0/1.1
        if re.search(r'tls\.VersionTLS1[01]', content):
            line_num = self._find_line_number(content, 'tls.VersionTLS1')
            self.report.issues.append(SecurityIssue(
                severity=Severity.HIGH,
                category="TLS Configuration",
                file=str(filepath),
                line=line_num,
                message="Use of deprecated TLS version (1.0 or 1.1)",
                code_snippet=lines[line_num - 1].strip() if line_num <= len(lines) else "",
                recommendation="Use TLS 1.2 or higher: tls.VersionTLS12, tls.VersionTLS13",
                cwe_id="CWE-326"
            ))
        
        # Check for InsecureSkipVerify
        if re.search(r'InsecureSkipVerify\s*:\s*true', content):
            line_num = self._find_line_number(content, 'InsecureSkipVerify')
            self.report.issues.append(SecurityIssue(
                severity=Severity.CRITICAL,
                category="TLS Configuration",
                file=str(filepath),
                line=line_num,
                message="TLS certificate verification disabled - MITM vulnerability",
                code_snippet=lines[line_num - 1].strip() if line_num <= len(lines) else "",
                recommendation="Remove InsecureSkipVerify or ensure it's only used in tests",
                cwe_id="CWE-295"
            ))

    def _check_cors_config(self, filepath: Path, content: str, lines: List[str]) -> None:
        """Check for insecure CORS configurations."""
        # Check for wildcard CORS
        if re.search(r'(?:Access-Control-Allow-Origin|AllowOrigins).*\*', content):
            line_num = self._find_line_number(content, 'Access-Control-Allow-Origin') or \
                       self._find_line_number(content, 'AllowOrigins')
            if line_num:
                self.report.issues.append(SecurityIssue(
                    severity=Severity.MEDIUM,
                    category="CORS Configuration",
                    file=str(filepath),
                    line=line_num,
                    message="Wildcard CORS origin - allows requests from any domain",
                    code_snippet=lines[line_num - 1].strip() if line_num <= len(lines) else "",
                    recommendation="Specify allowed origins explicitly",
                    cwe_id="CWE-942"
                ))

    def _check_cookie_security(self, filepath: Path, content: str, lines: List[str]) -> None:
        """Check for insecure cookie configurations."""
        # Check for missing Secure flag
        if re.search(r'http\.Cookie\s*\{', content):
            if not re.search(r'Secure\s*:\s*true', content):
                line_num = self._find_line_number(content, 'http.Cookie')
                if line_num:
                    self.report.issues.append(SecurityIssue(
                        severity=Severity.MEDIUM,
                        category="Cookie Security",
                        file=str(filepath),
                        line=line_num,
                        message="Cookie without Secure flag - may be sent over HTTP",
                        code_snippet="",
                        recommendation="Add Secure: true to cookie configuration",
                        cwe_id="CWE-614"
                    ))
        
        # Check for missing HttpOnly flag
        if re.search(r'http\.Cookie\s*\{', content):
            if not re.search(r'HttpOnly\s*:\s*true', content):
                line_num = self._find_line_number(content, 'http.Cookie')
                if line_num:
                    self.report.issues.append(SecurityIssue(
                        severity=Severity.MEDIUM,
                        category="Cookie Security",
                        file=str(filepath),
                        line=line_num,
                        message="Cookie without HttpOnly flag - accessible via JavaScript",
                        code_snippet="",
                        recommendation="Add HttpOnly: true to prevent XSS cookie theft",
                        cwe_id="CWE-1004"
                    ))

    def _find_line_number(self, content: str, pattern: str) -> Optional[int]:
        """Find line number of first occurrence of pattern."""
        match = re.search(re.escape(pattern), content)
        if match:
            return content[:match.start()].count('\n') + 1
        return None

    def _get_recommendation(self, category: str, cwe_id: str) -> str:
        """Get remediation recommendation based on category."""
        recommendations = {
            "SQL Injection": "Use parameterized queries with ? placeholders. Example: db.Query(ctx, 'SELECT * FROM users WHERE id = ?', userID)",
            "Hardcoded Secrets": "Move secrets to environment variables or a secure secrets manager. Use os.Getenv() or a configuration service.",
            "Weak Cryptography": "Use modern cryptographic algorithms: SHA-256 or higher for hashing, AES-256 for encryption.",
            "Command Injection": "Validate and sanitize all user inputs. Use exec.Command with separate arguments instead of shell execution.",
            "SSRF": "Validate and whitelist allowed URLs/domains. Implement URL parsing and validation before making requests.",
            "Insecure File Operations": "Use restrictive file permissions (0644 for files, 0755 for directories). Never use 0777.",
            "Path Traversal": "Use filepath.Clean and validate paths are within allowed directories. Reject paths containing '..'",
            "Cross-Site Scripting": "Sanitize all user input before including in HTML responses. Use template escaping.",
            "Unsafe Operations": "Avoid unsafe package unless absolutely necessary. Document all unsafe usage with security review.",
            "Input Validation": "Always validate and sanitize user inputs. Check return values of parsing functions.",
            "Timing Attack": "Use subtle.ConstantTimeCompare() for comparing secrets, passwords, or tokens.",
            "TLS Configuration": "Use TLS 1.2+ and enable proper certificate verification.",
            "CORS Configuration": "Specify allowed origins explicitly instead of using wildcards.",
            "Cookie Security": "Set Secure, HttpOnly, and SameSite flags on sensitive cookies.",
        }
        return recommendations.get(category, f"Review and fix the security issue. See CWE-{cwe_id} for details.")

    def scan_directory(self, dirpath: Path) -> None:
        """Recursively scan all Go files in a directory."""
        for root, dirs, files in os.walk(dirpath):
            # Skip vendor and test directories
            dirs[:] = [d for d in dirs if d not in ('vendor', '.git', 'testdata', 'mocks')]
            
            for file in files:
                if file.endswith('.go'):
                    filepath = Path(root) / file
                    self.scan_file(filepath)

    def print_report(self) -> None:
        """Print the security scan report."""
        counts = self.report.count_by_severity()
        
        print("\n" + "=" * 70)
        print("🔒 GO SECURITY SCAN REPORT")
        print("=" * 70)
        print(f"\n📁 Files Scanned: {self.report.files_scanned}")
        print(f"🔍 Total Issues Found: {len(self.report.issues)}")
        print()
        
        # Summary by severity
        print("📊 Issues by Severity:")
        severity_icons = {
            "CRITICAL": "🔴",
            "HIGH": "🟠", 
            "MEDIUM": "🟡",
            "LOW": "🟢",
            "INFO": "ℹ️"
        }
        for sev, count in counts.items():
            if count > 0:
                print(f"   {severity_icons.get(sev, '•')} {sev}: {count}")
        
        print()
        
        if not self.report.issues:
            print("✅ No security issues found!")
            return
        
        # Group issues by category
        by_category: Dict[str, List[SecurityIssue]] = {}
        for issue in self.report.issues:
            if issue.category not in by_category:
                by_category[issue.category] = []
            by_category[issue.category].append(issue)
        
        # Print issues by category
        for category, issues in sorted(by_category.items()):
            print(f"\n{'─' * 70}")
            print(f"📁 {category} ({len(issues)} issues)")
            print(f"{'─' * 70}")
            
            for issue in sorted(issues, key=lambda x: (x.severity.value, x.line)):
                icon = severity_icons.get(issue.severity.value, '•')
                print(f"\n{icon} [{issue.severity.value}] {issue.message}")
                print(f"   📍 {issue.file}:{issue.line}")
                if issue.code_snippet:
                    print(f"   💻 {issue.code_snippet}")
                if issue.cwe_id:
                    print(f"   🔗 {issue.cwe_id}")
                print(f"   💡 {issue.recommendation}")
        
        print("\n" + "=" * 70)
        
        # Final status
        if self.report.has_critical():
            print("⛔ SECURITY SCAN FAILED: Critical vulnerabilities found!")
            print("   These issues MUST be fixed before deployment.")
        elif self.report.has_high():
            print("⚠️  SECURITY SCAN WARNING: High severity issues found.")
            print("   Review and fix these issues before production deployment.")
        else:
            print("✅ No critical/high severity issues found.")
        
        print("=" * 70 + "\n")

    def get_json_report(self) -> Dict:
        """Get report as JSON-serializable dictionary."""
        return {
            "summary": {
                "files_scanned": self.report.files_scanned,
                "total_issues": len(self.report.issues),
                "by_severity": self.report.count_by_severity(),
                "has_critical": self.report.has_critical(),
                "has_high": self.report.has_high()
            },
            "issues": [
                {
                    "severity": issue.severity.value,
                    "category": issue.category,
                    "file": issue.file,
                    "line": issue.line,
                    "message": issue.message,
                    "code_snippet": issue.code_snippet,
                    "recommendation": issue.recommendation,
                    "cwe_id": issue.cwe_id
                }
                for issue in self.report.issues
            ]
        }


def main():
    # Fix Unicode encoding on Windows
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    
    parser = argparse.ArgumentParser(
        description="Go Security Vulnerability Scanner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python validate_security.py features/workflow
    python validate_security.py features/workflow --strict
    python validate_security.py features/workflow --json
    python validate_security.py features/workflow -o security_report.json
        """
    )
    parser.add_argument("path", help="Path to Go file or directory to scan")
    parser.add_argument("--strict", action="store_true",
                       help="Enable strict mode with additional checks")
    parser.add_argument("--json", action="store_true",
                       help="Output results as JSON")
    parser.add_argument("-o", "--output", help="Save report to file")
    
    args = parser.parse_args()
    
    target = Path(args.path)
    if not target.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)
    
    scanner = GoSecurityScanner(strict_mode=args.strict)
    
    if target.is_file():
        scanner.scan_file(target)
    else:
        scanner.scan_directory(target)
    
    if args.json:
        report = scanner.get_json_report()
        output = json.dumps(report, indent=2)
        if args.output:
            Path(args.output).write_text(output)
            print(f"Report saved to {args.output}")
        else:
            print(output)
    else:
        scanner.print_report()
        if args.output:
            Path(args.output).write_text(json.dumps(scanner.get_json_report(), indent=2))
            print(f"JSON report saved to {args.output}")
    
    # Exit with appropriate code
    if scanner.report.has_critical():
        sys.exit(2)  # Critical issues found
    elif scanner.report.has_high():
        sys.exit(1)  # High severity issues found
    sys.exit(0)


if __name__ == "__main__":
    main()
