from __future__ import annotations

import re
import sys
from pathlib import Path


REVISION_RE = re.compile(r'^\s*revision\s*=\s*"([^"]+)"\s*$')
DOWN_REVISION_RE = re.compile(r'^\s*down_revision\s*=\s*"([^"]+)"\s*$')


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    versions_dir = repo_root / "alembic" / "versions"
    if not versions_dir.exists():
        print(f"Missing alembic versions dir: {versions_dir}")
        return 2

    failures: list[str] = []

    for path in sorted(versions_dir.glob("*.py")):
        revision: str | None = None
        down_revision: str | None = None
        content = path.read_text(encoding="utf-8")
        for line in content.splitlines():
            if revision is None:
                m = REVISION_RE.match(line)
                if m:
                    revision = m.group(1)
                    continue
            if down_revision is None:
                m = DOWN_REVISION_RE.match(line)
                if m:
                    down_revision = m.group(1)

        if revision is None:
            failures.append(f"{path}: missing revision = ...")
        elif len(revision) > 32:
            failures.append(f"{path}: revision too long ({len(revision)}): {revision}")

        if down_revision is not None and len(down_revision) > 32:
            failures.append(
                f"{path}: down_revision too long ({len(down_revision)}): {down_revision}"
            )

        # Alembic op.execute is not consistently compatible with (stmt, params).
        if "op.execute(" in content and "sa.text(" in content and "),\n" in content:
            if re.search(r"op\.execute\(\s*sa\.text\([\s\S]+?\)\s*,", content):
                failures.append(
                    f"{path}: op.execute(stmt, params) detected; use op.get_bind().execute(...)"
                )

    if failures:
        print("Alembic revision check failed:")
        for item in failures:
            print(f"- {item}")
        return 1

    print("Alembic revision check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

