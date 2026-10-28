"""Two repositories kept the same, in both directions (TASK-325, ADR-0285,
docs/TEAM_WORKFLOW.md, «I due repository»): LPPL1316/MUW and
rockydalbianco/shaperoute, run by .github/workflows/mirror.yml.

For every branch of either side:

- on both at the same commit: nothing;
- on both, one behind the other: the one behind is moved forward (a push
  that git accepts only as a fast-forward);
- on both and diverged, with commits on each side the other lacks: nothing,
  and the run fails naming the branch: somebody merges by hand, on either
  side, and the next run carries the result across;
- on one side only: created on the other, unless it is merged already in a
  main (its tip an ancestor of either main, and not a main itself): then it
  was deleted after its merge, and it is deleted here too. A branch
  abandoned without a merge, or merged with a squash, comes back from the
  other side until it is deleted on both.

`main` is never deleted. Nothing is ever forced: a push that is not a
fast-forward is refused by git, and the refusal is reported. Tags are not
mirrored.

    python3 tools/mirror_repos.py URL_OR_PATH_A URL_OR_PATH_B

The two can be any git remotes: URLs with a token, or paths (the tests use
bare repositories on disk). The URLs are never printed: only branches are.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

MAIN = "main"
SIDES = ("a", "b")


@dataclass(frozen=True)
class Push:
    """`branch` of `source` goes to `target`, where it is new or behind."""

    source: str
    target: str
    branch: str


@dataclass(frozen=True)
class Delete:
    """`branch`, merged in a main and gone from the other side, goes from
    `side` too."""

    side: str
    branch: str


@dataclass(frozen=True)
class Diverged:
    """`branch` has commits on each side the other lacks: a hand is needed."""

    branch: str


Action = Push | Delete | Diverged
# Whether the first commit is an ancestor of (or the same as) the second.
IsAncestor = Callable[[str, str], bool]


def plan(
    a: Mapping[str, str], b: Mapping[str, str], is_ancestor: IsAncestor
) -> list[Action]:
    """What to do, branch by branch, from the heads of the two sides
    (branch name to commit). Pure: the git questions go through
    `is_ancestor`."""
    heads = {"a": a, "b": b}
    mains = [heads[side][MAIN] for side in SIDES if MAIN in heads[side]]
    actions: list[Action] = []
    for branch in sorted(set(a) | set(b)):
        on_a, on_b = a.get(branch), b.get(branch)
        if on_a is not None and on_b is not None:
            if on_a == on_b:
                continue
            if is_ancestor(on_a, on_b):
                actions.append(Push("b", "a", branch))
            elif is_ancestor(on_b, on_a):
                actions.append(Push("a", "b", branch))
            else:
                actions.append(Diverged(branch))
            continue
        side, other = ("a", "b") if on_a is not None else ("b", "a")
        sha = on_a if on_a is not None else on_b
        assert sha is not None
        merged = branch != MAIN and any(
            sha != main and is_ancestor(sha, main) for main in mains
        )
        actions.append(Delete(side, branch) if merged else Push(side, other, branch))
    return actions


def git(repo: Path, *args: str) -> str:
    """One git command in `repo`; its stdout. A failure raises."""
    done = subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    )
    return done.stdout


def heads_of(repo: Path, remote: str) -> dict[str, str]:
    """The branches fetched from `remote`, name to commit."""
    prefix = f"refs/remotes/{remote}/"
    found: dict[str, str] = {}
    for line in git(
        repo, "for-each-ref", "--format=%(refname) %(objectname)", prefix
    ).splitlines():
        ref, sha = line.split()
        name = ref[len(prefix) :]
        if name != "HEAD":
            found[name] = sha
    return found


def mirror(url_a: str, url_b: str, workdir: Path) -> int:
    """Both sides fetched into `workdir`, the plan applied; the exit code:
    0 when every branch is now the same on both sides, 1 otherwise."""
    git(workdir, "init", "-q")
    for side, url in zip(SIDES, (url_a, url_b), strict=True):
        git(workdir, "remote", "add", side, url)
        git(
            workdir,
            "fetch",
            "-q",
            "--prune",
            side,
            f"+refs/heads/*:refs/remotes/{side}/*",
        )
    heads = {side: heads_of(workdir, side) for side in SIDES}

    def is_ancestor(ancestor: str, descendant: str) -> bool:
        done = subprocess.run(
            [
                "git",
                "-C",
                str(workdir),
                "merge-base",
                "--is-ancestor",
                ancestor,
                descendant,
            ],
            capture_output=True,
        )
        return done.returncode == 0

    problems = 0
    for action in plan(heads["a"], heads["b"], is_ancestor):
        if isinstance(action, Diverged):
            print(
                f"diverged: {action.branch} has commits on both sides: merge it by hand"
            )
            problems += 1
            continue
        try:
            if isinstance(action, Push):
                sha = heads[action.source][action.branch]
                git(
                    workdir,
                    "push",
                    "-q",
                    action.target,
                    f"{sha}:refs/heads/{action.branch}",
                )
                print(f"{action.branch}: {action.source} -> {action.target}")
            else:
                git(workdir, "push", "-q", action.side, f":refs/heads/{action.branch}")
                print(f"{action.branch}: merged, deleted on {action.side}")
        except subprocess.CalledProcessError as error:
            # The remote changed since the fetch, or refuses: the next run sees.
            print(f"refused: {action.branch}: {refusal_reason(error.stderr)}")
            problems += 1
    return 1 if problems else 0


def refusal_reason(stderr: str) -> str:
    """Why git could not push, from its stderr: what the server said
    (`remote: …`) and the line of the ref refused (` ! …`), or the last line
    when there is neither. Never a URL: git names the remote by its URL only
    in a line this leaves out."""
    lines = [line.strip() for line in stderr.splitlines() if line.strip()]
    said = [
        line for line in lines if line.startswith("remote:") or line.startswith("!")
    ]
    said = [line for line in said if "https://" not in line]
    return " | ".join(said) if said else (lines[-1] if lines else "no reason given")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: mirror_repos.py URL_OR_PATH_A URL_OR_PATH_B", file=sys.stderr)
        return 2
    with tempfile.TemporaryDirectory() as workdir:
        return mirror(argv[1], argv[2], Path(workdir))


if __name__ == "__main__":
    sys.exit(main(sys.argv))
