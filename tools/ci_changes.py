"""Whether a pull request touches code, for .github/workflows/ci.yml
(TASK-393, ADR-0331).

Each job of ci.yml runs this first and its other steps only when it writes
`code=true` to $GITHUB_OUTPUT: a pull request that changes only documents
skips the tests, and the required checks still report, green. A push to main
always runs everything.

On a pull request the checkout is GitHub's merge commit (fetch-depth 2): its
first parent is the base, so the diff between the two is exactly what the
pull request would change in main. Whenever the answer is not certain (no
merge commit, git fails, an empty diff) the answer is `code=true`.

Standard library only: it runs on the runner's own Python, before any setup.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Iterable

# Markdown under these folders is read by a job: prettier checks apps/ and
# packages/, engine.zip takes every file of the route_engine package, and the
# others hold code. Anywhere else a .md file is only read by people.
CODE_ROOTS = ("apps/", "packages/", "services/", "tools/", "site/", "deploy/")


def is_document(path: str) -> bool:
    """docs/ is never read by ci.yml; a .md file elsewhere outside CODE_ROOTS
    (README.md, CLAUDE.md, samples/LOG.md, ...) neither."""
    if path.startswith("docs/"):
        return True
    return path.endswith(".md") and not path.startswith(CODE_ROOTS)


def touches_code(paths: Iterable[str]) -> bool:
    """True unless there are paths and every one is a document."""
    paths = [path for path in paths if path]
    return not paths or not all(is_document(path) for path in paths)


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout


def changed_paths(base: str, head: str) -> list[str]:
    """Every path that differs. No renames, so a file moved into docs/ also
    lists where it came from; -z, so no path comes back quoted."""
    out = git("diff", "--name-only", "--no-renames", "-z", base, head)
    return [path for path in out.split("\0") if path]


def pull_request_paths() -> list[str] | None:
    """The paths the merge commit at HEAD changes in its base, or None when
    HEAD is not a merge commit or git cannot tell."""
    try:
        git("rev-parse", "--verify", "--quiet", "HEAD^2")
        return changed_paths("HEAD^1", "HEAD")
    except (subprocess.CalledProcessError, OSError):
        return None


def main() -> int:
    event = os.environ.get("GITHUB_EVENT_NAME", "")
    if event != "pull_request":
        code, why = True, f"event {event or '(none)'}: everything runs"
    else:
        paths = pull_request_paths()
        if paths is None:
            code, why = True, "no merge commit to compare: everything runs"
        else:
            code = touches_code(paths)
            listed = "\n".join(f"  {path}" for path in paths)
            why = f"{len(paths)} paths changed:\n{listed}"
            if not code:
                print("::notice::Only documents changed: the tests are skipped.")
    print(why)
    line = f"code={'true' if code else 'false'}"
    print(line)
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as file:
            file.write(line + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
