"""Deterministic tests of tools/ci_changes.py (TASK-393, ADR-0331): the rule
on made-up paths, and the merge commit on small repositories on disk, no
network."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest
from ci_changes import changed_paths, is_document, main, touches_code

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

needs_git = pytest.mark.skipif(shutil.which("git") is None, reason="needs git")


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", "-C", str(repo), "-c", "commit.gpgsign=false", *args],
        check=True,
        capture_output=True,
        text=True,
        env=ENV,
    )
    return done.stdout


def commit(repo: Path, files: dict[str, str], message: str) -> None:
    for name, text in files.items():
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", message)


def merge_repo(tmp_path: Path, change: dict[str, str]) -> Path:
    """A repository whose HEAD is a merge commit like GitHub's for a pull
    request: first parent the base, second the branch that made `change`."""
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    commit(repo, {"README.md": "a\n", "services/api/app.py": "x = 1\n"}, "base")
    git(repo, "checkout", "-q", "-b", "feature")
    commit(repo, change, "feature")
    git(repo, "checkout", "-q", "main")
    commit(repo, {"apps/mobile/App.tsx": "export {};\n"}, "main moves on")
    git(repo, "merge", "-q", "--no-ff", "-m", "merge", "feature")
    return repo


def run_main(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, repo: Path, event: str
) -> str:
    output = tmp_path / "github_output"
    output.write_text("", encoding="utf-8")
    monkeypatch.chdir(repo)
    for name, value in ENV.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("GITHUB_EVENT_NAME", event)
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    assert main() == 0
    return output.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "path",
    [
        "docs/STATUS.md",
        "docs/tasks/TASK-339/feed-dark.png",
        "docs/sports/README.md",
        "README.md",
        "CLAUDE.md",
        "samples/LOG.md",
        "catalog/README.md",
        ".github/pull_request_template.md",
    ],
)
def test_documents(path: str) -> None:
    assert is_document(path)


@pytest.mark.parametrize(
    "path",
    [
        # prettier checks apps/ and packages/, markdown included.
        "apps/mobile/README.md",
        "packages/shared-types/README.md",
        # engine.zip takes every file of the package.
        "services/route-engine/route_engine/NOTES.md",
        "tools/sport_bench/README.md",
        "site/README.md",
        "deploy/README.md",
        "services/api/shaperoute_api/app.py",
        ".github/workflows/ci.yml",
        "catalog/seed/heart.json",
        "Dockerfile",
        "package.json",
        "docs.md.py",
        "documents/x.md.txt",
    ],
)
def test_code(path: str) -> None:
    assert not is_document(path)


def test_only_documents_skip_the_tests() -> None:
    assert not touches_code(["docs/STATUS.md", "docs/tasks/TASK-001.md", ""])


def test_one_code_file_runs_everything() -> None:
    assert touches_code(["docs/STATUS.md", "apps/mobile/App.tsx"])


def test_no_paths_run_everything() -> None:
    assert touches_code([])
    assert touches_code([""])


@needs_git
def test_a_file_moved_into_docs_lists_where_it_came_from(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    commit(repo, {"services/api/notes.py": "x = 1\n" * 20}, "base")
    (repo / "docs").mkdir()
    git(repo, "mv", "services/api/notes.py", "docs/notes.py")
    git(repo, "commit", "-q", "-m", "move")
    monkeypatch.chdir(repo)
    paths = changed_paths("HEAD^1", "HEAD")
    assert sorted(paths) == ["docs/notes.py", "services/api/notes.py"]
    assert touches_code(paths)


@needs_git
def test_a_pull_request_of_documents_writes_false(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    repo = merge_repo(tmp_path, {"docs/STATUS.md": "done\n", "docs/caffè.md": "x\n"})
    assert run_main(monkeypatch, tmp_path, repo, "pull_request") == "code=false\n"


@needs_git
def test_a_pull_request_with_code_writes_true(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    repo = merge_repo(tmp_path, {"docs/STATUS.md": "done\n", "tools/x.py": "y = 2\n"})
    assert run_main(monkeypatch, tmp_path, repo, "pull_request") == "code=true\n"


@needs_git
def test_the_base_moving_on_does_not_count(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """main gained apps/mobile/App.tsx after the branch: not the PR's change."""
    repo = merge_repo(tmp_path, {"README.md": "b\n"})
    assert run_main(monkeypatch, tmp_path, repo, "pull_request") == "code=false\n"


@needs_git
def test_without_a_merge_commit_everything_runs(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    commit(repo, {"README.md": "a\n"}, "one")
    commit(repo, {"docs/STATUS.md": "b\n"}, "two")
    assert run_main(monkeypatch, tmp_path, repo, "pull_request") == "code=true\n"


@needs_git
def test_a_push_runs_everything(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    repo = merge_repo(tmp_path, {"docs/STATUS.md": "done\n"})
    assert run_main(monkeypatch, tmp_path, repo, "push") == "code=true\n"
