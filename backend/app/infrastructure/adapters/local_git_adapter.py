"""
Adapter: LocalGitAdapter

Implements GitPort using the local ``git`` CLI.
All diff parsing is done in pure Python — zero LLM token cost.
"""
from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone

from app.application.ports.git_port import GitPort
from app.domain.exceptions import DiffParseError
from app.domain.models import CodeDiff, FileDiff


# ---------------------------------------------------------------------------
# Demo-mode synthetic diffs
# Returned when the requested branch does not exist locally, so the full
# pipeline can run end-to-end during the hackathon demo without needing the
# actual feature branches checked out.
# ---------------------------------------------------------------------------

_DEMO_DIFFS: dict[str, list[FileDiff]] = {
    "feature/auth-refactor": [
        FileDiff(
            path="app/auth/jwt_handler.py",
            additions=42,
            deletions=18,
            patch=(
                "@@ -10,7 +10,12 @@\n"
                "-def verify_token(token: str) -> dict:\n"
                "+def verify_token(token: str, strict: bool = True) -> dict:\n"
                "+    \"\"\"Verify JWT; raises AuthError on failure.\"\"\"\n"
                "-    payload = jwt.decode(token, SECRET)\n"
                "+    payload = jwt.decode(token, SECRET, algorithms=['HS256'])\n"
                "+    if strict and payload.get('exp', 0) < time.time():\n"
                "+        raise AuthError('Token expired')\n"
                "     return payload\n"
            ),
        ),
        FileDiff(
            path="app/auth/middleware.py",
            additions=15,
            deletions=5,
            patch=(
                "@@ -3,5 +3,15 @@\n"
                "-def auth_required(f):\n"
                "+def auth_required(f, roles=None):\n"
                "+    \"\"\"Decorator — optionally restricts to specific roles.\"\"\"\n"
                "     @wraps(f)\n"
                "     def wrapper(*args, **kwargs):\n"
                "-        verify_token(request.headers['Authorization'])\n"
                "+        token = request.headers.get('Authorization', '')\n"
                "+        payload = verify_token(token, strict=True)\n"
                "+        if roles and payload.get('role') not in roles:\n"
                "+            raise PermissionError('Insufficient role')\n"
                "         return f(*args, **kwargs)\n"
                "     return wrapper\n"
            ),
        ),
    ],
    "feature/new-payment-service": [
        FileDiff(
            path="app/payments/processor.py",
            additions=88,
            deletions=0,
            patch=(
                "@@ -0,0 +1,88 @@\n"
                "+class PaymentProcessor:\n"
                "+    \"\"\"Handles charge, refund and subscription operations.\"\"\"\n"
                "+\n"
                "+    def charge(self, amount: float, card_token: str) -> dict:\n"
                "+        ...\n"
                "+\n"
                "+    def refund(self, transaction_id: str) -> bool:\n"
                "+        ...\n"
                "+\n"
                "+    def subscribe(self, plan_id: str, customer_id: str) -> dict:\n"
                "+        ...\n"
            ),
        ),
        FileDiff(
            path="app/payments/models.py",
            additions=34,
            deletions=0,
            patch=(
                "@@ -0,0 +1,34 @@\n"
                "+from dataclasses import dataclass\n"
                "+\n"
                "+@dataclass\n"
                "+class Transaction:\n"
                "+    id: str\n"
                "+    amount: float\n"
                "+    status: str\n"
                "+    customer_id: str\n"
            ),
        ),
    ],
    "feature/notifications": [
        FileDiff(
            path="app/notifications/sender.py",
            additions=55,
            deletions=0,
            patch=(
                "@@ -0,0 +1,55 @@\n"
                "+class NotificationError(Exception):\n"
                "+    \"\"\"Raised when a notification cannot be sent.\"\"\"\n"
                "+\n"
                "+def send_email(to: str, subject: str, body: str) -> bool:\n"
                "+    if not to or '@' not in to:\n"
                "+        raise NotificationError(f'Email inválido: {to!r}')\n"
                "+    if not subject:\n"
                "+        raise NotificationError('El asunto no puede estar vacío')\n"
                "+    print(f'[EMAIL] -> {to} | {subject} | {len(body)} chars')\n"
                "+    return True\n"
                "+\n"
                "+def send_sms(phone: str, message: str) -> bool:\n"
                "+    if not phone.startswith('+'):\n"
                "+        raise NotificationError('El teléfono debe incluir prefijo internacional (+XX)')\n"
                "+    if len(message) > 160:\n"
                "+        raise NotificationError(f'SMS demasiado largo: {len(message)} chars (máx 160)')\n"
                "+    print(f'[SMS] -> {phone} | {message[:30]}...')\n"
                "+    return True\n"
                "+\n"
                "+def send_push(device_id: str, title: str, payload: dict | None = None) -> bool:\n"
                "+    if not device_id:\n"
                "+        raise NotificationError('device_id es obligatorio')\n"
                "+    print(f'[PUSH] -> {device_id} | {title}')\n"
                "+    return True\n"
            ),
        ),
    ],
    "feature/api-breaking-change": [
        FileDiff(
            path="app/api/v2/endpoints.py",
            additions=30,
            deletions=25,
            patch=(
                "@@ -12,10 +12,15 @@\n"
                "-def get_user(user_id: int):\n"
                "+def get_user(user_id: str):  # breaking: int → str\n"
                "     user = db.query(User).filter_by(id=user_id).first()\n"
                "-    return user.to_dict()\n"
                "+    if not user:\n"
                "+        raise HTTPException(status_code=404)\n"
                "+    return UserSchema.from_orm(user)\n"
                "\n"
                "-def list_users():\n"
                "+def list_users(page: int = 1, limit: int = 20):\n"
                "+    \"\"\"Paginated — replaces full-list endpoint.\"\"\"\n"
                "     return db.query(User).all()\n"
            ),
        ),
        FileDiff(
            path="tests/test_api_users.py",
            additions=5,
            deletions=12,
            patch=(
                "@@ -8,12 +8,5 @@\n"
                "-def test_get_user_int_id():\n"
                "-    resp = client.get('/users/1')\n"
                "-    assert resp.status_code == 200\n"
                "+def test_get_user_str_id():\n"
                "+    resp = client.get('/users/abc-123')\n"
                "+    assert resp.status_code == 200\n"
            ),
        ),
    ],
}


class LocalGitAdapter(GitPort):
    """Reads diffs from a local git repository via subprocess."""

    def __init__(self, repo_path: str = ".") -> None:
        self._repo_path = repo_path

    # ------------------------------------------------------------------
    # GitPort implementation
    # ------------------------------------------------------------------

    def get_diff(self, base: str, head: str) -> CodeDiff:
        try:
            raw = self._run_git(["diff", f"{base}...{head}", "--unified=3"])
        except DiffParseError:
            # Branch does not exist locally — fall back to demo synthetic diff
            return self._demo_diff(base, head)

        files = _parse_unified_diff(raw)

        # If git succeeded but returned nothing, also use demo data so the
        # pipeline has something meaningful to analyse.
        if not files:
            return self._demo_diff(base, head)

        # Resolve HEAD commit SHA locally
        try:
            sha = self._run_git(["rev-parse", "--short", head]).strip()
        except Exception:
            sha = head[:8]

        # Resolve current branch name
        try:
            branch = self._run_git(["rev-parse", "--abbrev-ref", head]).strip()
        except Exception:
            branch = head

        return CodeDiff(
            commit_sha=sha,
            branch=branch,
            base_branch=base,
            files=files,
            created_at=datetime.now(timezone.utc),
        )

    def get_changed_files(self, base: str, head: str) -> list[str]:
        try:
            raw = self._run_git(["diff", "--name-only", f"{base}...{head}"])
        except DiffParseError:
            return [f.path for f in _DEMO_DIFFS.get(head, [])]
        return [line.strip() for line in raw.splitlines() if line.strip()]

    def get_file_diff(self, base: str, head: str, file_path: str) -> str:
        """
        Return only the modified hunks for *file_path* between *base* and *head*.

        Extracts just the ``+``/``-`` lines and hunk headers from the unified diff,
        stripping the file-level header. This keeps prompts small — only the delta
        is sent to LLM agents, never the entire file content.
        """
        try:
            raw = self._run_git([
                "diff", f"{base}...{head}", "--unified=3", "--", file_path,
            ])
        except DiffParseError:
            # Return the patch from demo data when the branch is missing
            for fd in _DEMO_DIFFS.get(head, []):
                if fd.path == file_path:
                    return fd.patch
            return ""
        return _extract_hunks(raw)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _demo_diff(base: str, head: str) -> CodeDiff:
        """Return a plausible synthetic CodeDiff for demo presets."""
        files = _DEMO_DIFFS.get(head, [
            # Generic fallback when head is not a known preset
            FileDiff(
                path="app/main.py",
                additions=10,
                deletions=3,
                patch="@@ -1,3 +1,10 @@\n+# changes\n",
            )
        ])
        # Derive a stable fake SHA from the branch name
        sha = head.replace("feature/", "")[:8].replace("-", "")[:7] or "demo000"
        return CodeDiff(
            commit_sha=sha,
            branch=head,
            base_branch=base,
            files=files,
            created_at=datetime.now(timezone.utc),
        )

    def _run_git(self, args: list[str]) -> str:
        try:
            result = subprocess.run(
                ["git"] + args,
                cwd=self._repo_path,
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            # git binary not available (e.g. Vercel serverless) — trigger demo fallback
            raise DiffParseError("git executable not found")
        if result.returncode != 0:
            raise DiffParseError(result.stderr.strip() or f"git {' '.join(args)} failed")
        return result.stdout


# ---------------------------------------------------------------------------
# Pure-Python unified-diff helpers (zero LLM cost)
# ---------------------------------------------------------------------------

_FILE_HEADER = re.compile(r"^diff --git a/(.+) b/(.+)$")
_HUNK_HEADER = re.compile(r"^@@")


def _extract_hunks(raw: str) -> str:
    """
    Strip the file-level header from a unified diff and return only the hunk
    content (lines starting with ``@@``, ``+``, ``-``, or a context space).

    This is the token-efficient representation sent to LLM prompts: it contains
    only what changed, not the entire file.
    """
    lines: list[str] = []
    in_hunk = False
    for line in raw.splitlines(keepends=True):
        if _HUNK_HEADER.match(line):
            in_hunk = True
        elif _FILE_HEADER.match(line) or line.startswith(("diff ", "index ", "--- ", "+++ ")):
            in_hunk = False
            continue
        if in_hunk:
            lines.append(line)
    return "".join(lines)


def _parse_unified_diff(raw: str) -> list[FileDiff]:
    """Parse a unified git diff into FileDiff objects without any LLM call."""
    files: list[FileDiff] = []
    current_path: str | None = None
    additions = deletions = 0
    patch_lines: list[str] = []

    def _flush() -> None:
        if current_path is not None:
            files.append(
                FileDiff(
                    path=current_path,
                    additions=additions,
                    deletions=deletions,
                    patch="".join(patch_lines),
                )
            )

    for line in raw.splitlines(keepends=True):
        m = _FILE_HEADER.match(line)
        if m:
            _flush()
            current_path = m.group(2)
            additions = deletions = 0
            patch_lines = []
            continue
        if line.startswith("+") and not line.startswith("+++"):
            additions += 1
        elif line.startswith("-") and not line.startswith("---"):
            deletions += 1
        if current_path is not None:
            patch_lines.append(line)

    _flush()
    return files
