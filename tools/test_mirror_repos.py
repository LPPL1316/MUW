"""Deterministic tests of tools/mirror_repos.py (TASK-325, ADR-0285): the plan
on made-up heads, and the mirror on bare repositories on disk, no network."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest
from mirror_repos import Delete, Diverged, Push, mirror, plan, refusal_reason

pytestmark = pytest.mark.skipif(shutil.which("git") is None, reason="needs git")

# A commit's author, whatever the machine has.
ENV = {
    **os.environ,
    "GIT_AUTHOR_NAME": "Test",
    "GIT_AUTHOR_EMAIL": "test@example.com",
    "GIT_COMMITTER_NAME": "Test",
    "GIT_COMMITTER_EMAIL": "test@example.com",
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_SYSTEM": os.devnull,
}


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", "-C", str(repo), "-c", "commit.gpgsign=false", *args],
        check=True,
        capture_output=True,
        text=True,
        env=ENV,
    )
    return done.stdout.strip()


def heads(bare: Path) -> dict[str, str]:
    found: dict[str, str] = {}
    for line in git(
        bare, "for-each-ref", "--format=%(refname:short) %(objectname)"
    ).splitlines():
        name, sha = line.split()
        found[name] = sha
    return found


class Sides:
    """Two bare repositories, each with a clone to make commits in."""

    def __init__(self, root: Path) -> None:
        self.a, self.b = root / "a.git", root / "b.git"
        self.work_a, self.work_b = root / "work_a", root / "work_b"
        for bare in (self.a, self.b):
            git(root, "init", "-q", "--bare", "-b", "main", str(bare))
        git(root, "clone", "-q", str(self.a), str(self.work_a))
        git(self.work_a, "checkout", "-q", "-b", "main")
        self.commit(self.work_a, "first")
        git(self.work_a, "push", "-q", "origin", "main")
        self.mirror()
        git(root, "clone", "-q", str(self.b), str(self.work_b))

    def commit(self, work: Path, name: str) -> str:
        (work / f"{name}.txt").write_text(name + "\n")
        git(work, "add", name + ".txt")
        git(work, "commit", "-q", "-m", name)
        return git(work, "rev-parse", "HEAD")

    def mirror(self) -> int:
        workdir = self.a.parent / "mirror"
        shutil.rmtree(workdir, ignore_errors=True)
        workdir.mkdir()
        return mirror(str(self.a), str(self.b), workdir)


@pytest.fixture
def sides(tmp_path: Path) -> Sides:
    return Sides(tmp_path)


# --- The plan, without git ---


def never(_ancestor: str, _descendant: str) -> bool:
    return False


def test_the_same_commit_on_both_sides_needs_nothing() -> None:
    assert plan({"main": "1"}, {"main": "1"}, never) == []


def test_the_side_behind_is_moved_forward() -> None:
    def older_first(ancestor: str, descendant: str) -> bool:
        return ancestor < descendant

    assert plan({"main": "1"}, {"main": "2"}, older_first) == [Push("b", "a", "main")]
    assert plan({"main": "2"}, {"main": "1"}, older_first) == [Push("a", "b", "main")]


def test_a_branch_with_commits_on_both_sides_is_left_alone() -> None:
    assert plan({"main": "1", "x": "2"}, {"main": "1", "x": "3"}, never) == [
        Diverged("x")
    ]


def test_a_new_branch_is_created_on_the_other_side() -> None:
    assert plan({"main": "1", "feat": "2"}, {"main": "1"}, never) == [
        Push("a", "b", "feat")
    ]
    assert plan({"main": "1"}, {"main": "1", "feat": "2"}, never) == [
        Push("b", "a", "feat")
    ]
    # An empty repository on one side takes everything.
    assert plan({"main": "1"}, {}, never) == [Push("a", "b", "main")]


def test_a_branch_merged_and_gone_on_the_other_side_is_deleted() -> None:
    def merged_in_two(ancestor: str, descendant: str) -> bool:
        return (ancestor, descendant) == ("1", "2")

    # Merged in a's main (2), gone on b: deleted on a.
    assert plan({"main": "2", "feat": "1"}, {"main": "2"}, merged_in_two) == [
        Delete("a", "feat")
    ]
    # Merged in a's main, still on b with b's main behind: deleted on b, and
    # b's main moved forward, in the same run.
    assert plan({"main": "2"}, {"main": "1", "feat": "1"}, merged_in_two) == [
        Delete("b", "feat"),
        Push("a", "b", "main"),
    ]
    # A branch at main's own commit is new, not merged: created.
    assert plan({"main": "2", "feat": "2"}, {"main": "2"}, merged_in_two) == [
        Push("a", "b", "feat")
    ]
    # main is never deleted, whatever the other side has.
    assert plan({"main": "1"}, {"main": "2"}, merged_in_two) == [Push("b", "a", "main")]


# --- The mirror, on bare repositories ---


def test_the_first_run_fills_the_empty_side(sides: Sides) -> None:
    assert heads(sides.b) == heads(sides.a)
    assert set(heads(sides.b)) == {"main"}


def test_a_commit_on_either_side_reaches_the_other(sides: Sides) -> None:
    second = sides.commit(sides.work_a, "second")
    git(sides.work_a, "push", "-q", "origin", "main")
    assert sides.mirror() == 0
    assert heads(sides.b)["main"] == second
    git(sides.work_b, "pull", "-q", "origin", "main")
    third = sides.commit(sides.work_b, "third")
    git(sides.work_b, "push", "-q", "origin", "main")
    assert sides.mirror() == 0
    assert heads(sides.a)["main"] == third
    # Nothing to do, and still fine.
    assert sides.mirror() == 0


def test_a_new_branch_is_created_and_a_merged_one_deleted(sides: Sides) -> None:
    git(sides.work_a, "checkout", "-q", "-b", "feat/x")
    tip = sides.commit(sides.work_a, "x")
    git(sides.work_a, "push", "-q", "origin", "feat/x")
    assert sides.mirror() == 0
    assert heads(sides.b)["feat/x"] == tip

    # Merged on a with a merge commit, as GitHub's button does, then deleted
    # there: deleted on b too, whose main moves forward.
    git(sides.work_a, "checkout", "-q", "main")
    git(sides.work_a, "merge", "-q", "--no-ff", "-m", "merge x", "feat/x")
    merged = git(sides.work_a, "rev-parse", "HEAD")
    git(sides.work_a, "push", "-q", "origin", "main")
    git(sides.work_a, "push", "-q", "origin", "--delete", "feat/x")
    assert sides.mirror() == 0
    assert heads(sides.a) == {"main": merged}
    assert heads(sides.b) == {"main": merged}


def test_a_branch_diverged_is_left_alone_and_reported(sides: Sides) -> None:
    on_a = sides.commit(sides.work_a, "from a")
    git(sides.work_a, "push", "-q", "origin", "main")
    on_b = sides.commit(sides.work_b, "from b")
    git(sides.work_b, "push", "-q", "origin", "main")
    assert sides.mirror() == 1
    assert heads(sides.a)["main"] == on_a
    assert heads(sides.b)["main"] == on_b
    # The others still go across in the same run.
    git(sides.work_a, "checkout", "-q", "-b", "feat/y")
    tip = sides.commit(sides.work_a, "y")
    git(sides.work_a, "push", "-q", "origin", "feat/y")
    assert sides.mirror() == 1
    assert heads(sides.b)["feat/y"] == tip


def test_nothing_is_forced_when_a_side_moves_meanwhile(
    sides: Sides, tmp_path: Path
) -> None:
    """Fetched, then the other side moves before the push: git refuses the
    push that is no longer a fast-forward, and the run says so."""
    sides.commit(sides.work_a, "second")
    git(sides.work_a, "push", "-q", "origin", "main")
    # A mirror whose fetch happened before b moved: done by hand here.
    workdir = tmp_path / "late"
    workdir.mkdir()
    git(workdir, "init", "-q")
    git(workdir, "remote", "add", "a", str(sides.a))
    git(workdir, "remote", "add", "b", str(sides.b))
    git(workdir, "fetch", "-q", "a", "+refs/heads/*:refs/remotes/a/*")
    git(workdir, "fetch", "-q", "b", "+refs/heads/*:refs/remotes/b/*")
    on_b = sides.commit(sides.work_b, "meanwhile")
    git(sides.work_b, "push", "-q", "origin", "main")
    stale = git(workdir, "rev-parse", "refs/remotes/a/main")
    done = subprocess.run(
        ["git", "-C", str(workdir), "push", "-q", "b", f"{stale}:refs/heads/main"],
        capture_output=True,
        text=True,
        env=ENV,
    )
    assert done.returncode != 0
    assert heads(sides.b)["main"] == on_b


def test_the_reason_of_a_refusal_is_what_the_server_said() -> None:
    stderr = (
        "remote: error: refusing to allow a Personal Access Token to create or"
        " update workflow `.github/workflows/mirror.yml` without `workflow` scope\n"
        "To https://github.com/owner/repo\n"
        " ! [remote rejected] abc123 -> refs/heads/x (refusing to allow)\n"
        "error: failed to push some refs to 'https://github.com/owner/repo'\n"
    )
    reason = refusal_reason(stderr)
    assert "without `workflow` scope" in reason
    assert "[remote rejected]" in reason
    assert "https://" not in reason
    assert refusal_reason("error: failed to push some refs to 'x'\n") == (
        "error: failed to push some refs to 'x'"
    )
    assert refusal_reason("") == "no reason given"
