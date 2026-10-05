use crate::test_support::UiText;
use std::path::Path;

use super::diff::{self, DiffArea};
use super::log::{self, RefKind};
use super::opstate::{self, OpKind};
use super::status::{self, ChangeKind, FileStatus};
use super::{cli, conflicts, refs, stash};
use crate::error::AppError;
use crate::merge::model::{ChunkKind, Eol, FileConflictKind};
use crate::test_support::*;

fn find<'a>(files: &'a [FileStatus], file_path: &str) -> &'a FileStatus {
    files
        .iter()
        .find(|file| file.path == file_path)
        .unwrap_or_else(|| panic!("{file_path} missing from status: {files:?}"))
}

// status::read

#[test]
fn status_reports_staged_unstaged_and_untracked_changes() {
    let repo = TestRepo::new();
    for name in ["modified.txt", "deleted.txt", "worktree_mod.txt", "worktree_del.txt"] {
        repo.write(name, format!("{name}\n"));
    }
    repo.write("old_name.txt", "a file that will be renamed\nwith several lines\nof content\n");
    repo.commit_all("base");

    repo.write("added.txt", "new\n");
    repo.write("modified.txt", "changed\n");
    repo.git(&["add", "added.txt", "modified.txt"]);
    repo.git(&["rm", "-q", "deleted.txt"]);
    repo.git(&["mv", "old_name.txt", "new_name.txt"]);
    repo.write("new_name.txt", "a file that will be renamed\nwith several lines\nof content\nand more\n");
    repo.write("worktree_mod.txt", "changed in work tree\n");
    repo.remove("worktree_del.txt");
    repo.write("untracked.txt", "?\n");
    repo.write("nested/dir/untracked.txt", "?\n");

    let status = status::read(&repo.open()).unwrap();
    let files = &status.files;
    assert_eq!(find(files, "added.txt").staged, Some(ChangeKind::Added));
    assert_eq!(find(files, "modified.txt").staged, Some(ChangeKind::Modified));
    assert_eq!(find(files, "modified.txt").unstaged, None);
    assert_eq!(find(files, "deleted.txt").staged, Some(ChangeKind::Deleted));
    assert_eq!(find(files, "worktree_mod.txt").unstaged, Some(ChangeKind::Modified));
    assert_eq!(find(files, "worktree_mod.txt").staged, None);
    assert_eq!(find(files, "worktree_del.txt").unstaged, Some(ChangeKind::Deleted));
    assert_eq!(find(files, "untracked.txt").unstaged, Some(ChangeKind::Untracked));
    assert_eq!(find(files, "nested/dir/untracked.txt").unstaged, Some(ChangeKind::Untracked));

    let renamed = find(files, "new_name.txt");
    assert_eq!(renamed.staged, Some(ChangeKind::Renamed));
    assert_eq!(renamed.orig_path.as_deref(), Some("old_name.txt"));
    assert_eq!(renamed.unstaged, Some(ChangeKind::Modified));
    assert!(files.iter().all(|file| file.path != "old_name.txt"), "{files:?}");

    assert!(files.iter().all(|file| !file.conflicted));
    let paths: Vec<&str> = files.iter().map(|file| file.path.as_str()).collect();
    let mut sorted = paths.clone();
    sorted.sort();
    assert_eq!(paths, sorted);
    assert_eq!(status.op.kind, OpKind::None);
}

#[test]
fn status_head_on_branch_unborn_and_detached() {
    let repo = TestRepo::new();
    let head = status::read(&repo.open()).unwrap().head;
    assert!(head.unborn);
    assert_eq!(head.branch.as_deref(), Some("main"));
    assert_eq!(head.short_id, None);

    repo.write("a.txt", "a\n");
    let first = repo.commit_all("first");
    let head = status::read(&repo.open()).unwrap().head;
    assert!(!head.unborn);
    assert_eq!(head.branch.as_deref(), Some("main"));
    assert_eq!(head.short_id.as_deref(), Some(&first[..8]));
    assert_eq!(head.upstream, None);

    repo.write("a.txt", "b\n");
    repo.commit_all("second");
    repo.git(&["switch", "-q", "--detach", &first]);
    let head = status::read(&repo.open()).unwrap().head;
    assert!(!head.unborn);
    assert_eq!(head.branch, None);
    assert_eq!(head.short_id.as_deref(), Some(&first[..8]));
}

#[test]
fn status_head_ahead_and_behind_upstream() {
    let remote = BareRemote::new();
    let repo = TestRepo::new();
    repo.add_remote("origin", &remote);
    repo.write("a.txt", "a\n");
    let base = repo.commit_all("base");
    repo.git(&["push", "-q", "-u", "origin", "main"]);

    let head = status::head_info(&repo.open());
    assert_eq!(head.upstream.as_deref(), Some("origin/main"));
    assert_eq!((head.ahead, head.behind), (0, 0));

    // Diverge: one local commit, one different commit on the remote.
    repo.git(&["switch", "-q", "-c", "other", &base]);
    repo.write("b.txt", "remote only\n");
    let remote_commit = repo.commit_all("remote only");
    repo.git(&["push", "-q", "origin", &format!("{remote_commit}:refs/heads/main")]);
    repo.checkout("main");
    repo.write("c.txt", "local only\n");
    repo.commit_all("local one");
    repo.write("c.txt", "local two\n");
    repo.commit_all("local two");
    repo.git(&["fetch", "-q", "origin"]);

    let head = status::read(&repo.open()).unwrap().head;
    assert_eq!(head.branch.as_deref(), Some("main"));
    assert_eq!((head.ahead, head.behind), (2, 1));
}

// conflicts::list / opstate::read for a merge

#[test]
fn merge_conflicts_are_listed_with_kinds_and_binary_flags() {
    let repo = merge_conflict_repo();
    let summary = conflicts::list(&repo.open()).unwrap();
    let listed: Vec<(&str, FileConflictKind, bool)> = summary
        .files
        .iter()
        .map(|file| (file.path.as_str(), file.kind, file.binary))
        .collect();
    assert_eq!(
        listed,
        vec![
            ("added.txt", FileConflictKind::BothAdded, false),
            ("both.txt", FileConflictKind::BothModified, false),
            ("crlf.txt", FileConflictKind::BothModified, false),
            ("deleted_by_them.txt", FileConflictKind::DeletedByThem, false),
            ("deleted_by_us.txt", FileConflictKind::DeletedByUs, false),
            ("image.bin", FileConflictKind::BothModified, true),
        ]
    );

    assert_eq!(summary.op.kind, OpKind::Merge);
    assert!(summary.op.ours_label.contains("main"), "{:?}", summary.op);
    assert!(summary.op.theirs_label.contains("feature"), "{:?}", summary.op);
    assert!(summary.op.description.contains("feature") && summary.op.description.contains("main"));

    let status = status::read(&repo.open()).unwrap();
    let conflicted: Vec<&str> = status
        .files
        .iter()
        .filter(|file| file.conflicted)
        .map(|file| file.path.as_str())
        .collect();
    assert_eq!(conflicted.len(), 6, "{:?}", status.files);
    assert_eq!(status.op.kind, OpKind::Merge);
}

#[test]
fn merge_labels_fall_back_to_merge_head_branch_without_merge_msg() {
    let repo = merge_conflict_repo();
    std::fs::remove_file(repo.path.join(".git/MERGE_MSG")).unwrap();
    let op = opstate::read(&repo.open());
    assert_eq!(op.kind, OpKind::Merge);
    assert!(op.theirs_label.contains("feature"), "{op:?}");
}

// conflicts::load

#[test]
fn load_both_modified_reports_clean_and_conflicting_chunks() {
    let repo = merge_conflict_repo();
    let document = conflicts::load(&repo.open(), "both.txt", false).unwrap();
    assert_eq!(document.kind, FileConflictKind::BothModified);
    assert!(!document.binary);
    assert_eq!(document.base, BOTH_BASE);
    assert_eq!(document.ours, BOTH_OURS);
    assert_eq!(document.theirs, BOTH_THEIRS);
    assert_eq!(document.eol, Eol::Lf);
    let kinds: Vec<ChunkKind> = document.chunks.iter().map(|chunk| chunk.kind).collect();
    assert_eq!(kinds, vec![ChunkKind::OursOnly, ChunkKind::Conflict, ChunkKind::TheirsOnly]);
    assert_eq!((document.chunks[1].base.start, document.chunks[1].base.end), (7, 8));
    assert!(document.ours_label.contains("main"));
    assert!(document.theirs_label.contains("feature"));
}

#[test]
fn load_crlf_file_detects_eol_and_normalizes_text() {
    let repo = merge_conflict_repo();
    let document = conflicts::load(&repo.open(), "crlf.txt", false).unwrap();
    assert_eq!(document.eol, Eol::Crlf);
    for text in [&document.base, &document.ours, &document.theirs] {
        assert!(!text.contains('\r'), "{text:?}");
    }
    assert_eq!(document.ours, "one\ntwo ours\nthree\n");
    let kinds: Vec<ChunkKind> = document.chunks.iter().map(|chunk| chunk.kind).collect();
    assert_eq!(kinds, vec![ChunkKind::Conflict]);
}

#[test]
fn load_both_added_has_empty_base() {
    let repo = merge_conflict_repo();
    let document = conflicts::load(&repo.open(), "added.txt", false).unwrap();
    assert_eq!(document.kind, FileConflictKind::BothAdded);
    assert_eq!(document.base, "");
    assert_eq!(document.ours, ADDED_OURS);
    assert_eq!(document.theirs, ADDED_THEIRS);
    assert!(document.chunks.iter().any(|chunk| chunk.kind == ChunkKind::Conflict));
}

#[test]
fn load_deleted_sides_and_binary() {
    let repo = merge_conflict_repo();
    let git_repo = repo.open();

    let by_us = conflicts::load(&git_repo, "deleted_by_us.txt", false).unwrap();
    assert_eq!(by_us.kind, FileConflictKind::DeletedByUs);
    assert_eq!(by_us.ours, "");
    assert_eq!(by_us.theirs, DELETED_BY_US_THEIRS);

    let by_them = conflicts::load(&git_repo, "deleted_by_them.txt", false).unwrap();
    assert_eq!(by_them.kind, FileConflictKind::DeletedByThem);
    assert_eq!(by_them.ours, DELETED_BY_THEM_OURS);
    assert_eq!(by_them.theirs, "");

    let image = conflicts::load(&git_repo, "image.bin", false).unwrap();
    assert!(image.binary);
    assert!(image.chunks.is_empty());
}

#[test]
fn load_rejects_a_path_that_is_not_in_conflict() {
    let repo = merge_conflict_repo();
    let result = conflicts::load(&repo.open(), "clean.txt", false);
    assert!(matches!(result, Err(AppError::Invalid(_))), "{result:?}");
}

#[test]
fn load_ignore_whitespace_hides_indent_only_conflict() {
    let repo = TestRepo::new();
    repo.write("code.rs", "fn main() {\n  first();\n  second();\n}\n");
    repo.commit_all("base");
    repo.branch("feature");
    repo.write("code.rs", "fn main() {\n    first();\n    second();\n}\n");
    repo.commit_all("reindent");
    repo.checkout("feature");
    repo.write("code.rs", "fn main() {\n  first();\n  changed();\n}\n");
    repo.commit_all("change");
    repo.checkout("main");
    repo.merge_expecting_conflict("feature");

    let strict = conflicts::load(&repo.open(), "code.rs", false).unwrap();
    assert!(strict.chunks.iter().any(|chunk| chunk.kind == ChunkKind::Conflict));
    let relaxed = conflicts::load(&repo.open(), "code.rs", true).unwrap();
    assert!(relaxed.ignore_whitespace);
    assert!(relaxed.chunks.iter().all(|chunk| chunk.kind != ChunkKind::Conflict), "{:?}", relaxed.chunks);
}

// conflicts::load_files (mergetool mode)

#[test]
fn load_files_with_empty_base_is_both_added() {
    let dir = tempfile::TempDir::new().unwrap();
    let dir = canonical(dir.path());
    let (base, local, remote, merged) = (dir.join("BASE"), dir.join("LOCAL"), dir.join("REMOTE"), dir.join("MERGED"));
    std::fs::write(&base, "").unwrap();
    std::fs::write(&local, "ours\r\n").unwrap();
    std::fs::write(&remote, "theirs\r\n").unwrap();
    std::fs::write(&merged, "conflict markers\n").unwrap();

    let document = conflicts::load_files(&base, &local, &remote, &merged, false);
    assert_eq!(document.kind, FileConflictKind::BothAdded);
    assert_eq!(document.base, "");
    assert_eq!(document.ours, "ours\n");
    assert_eq!(document.theirs, "theirs\n");
    assert_eq!(document.eol, Eol::Crlf);
    assert_eq!(document.path, merged.ui());
    assert!(!document.binary);

    std::fs::remove_file(&base).unwrap();
    let missing_base = conflicts::load_files(&base, &local, &remote, &merged, false);
    assert_eq!(missing_base.kind, FileConflictKind::BothAdded);

    std::fs::write(&base, "base\n").unwrap();
    std::fs::write(&local, "ours\n").unwrap();
    std::fs::write(&remote, "base\n").unwrap();
    let modified = conflicts::load_files(&base, &local, &remote, &merged, false);
    assert_eq!(modified.kind, FileConflictKind::BothModified);
    let kinds: Vec<ChunkKind> = modified.chunks.iter().map(|chunk| chunk.kind).collect();
    assert_eq!(kinds, vec![ChunkKind::OursOnly]);

    std::fs::write(&remote, [0u8, 1, 2]).unwrap();
    assert!(conflicts::load_files(&base, &local, &remote, &merged, false).binary);
}

// opstate for rebase, cherry-pick and revert

#[test]
fn rebase_conflict_labels_upstream_as_ours() {
    let repo = diverged_repo();
    let output = repo.git_raw(&["rebase", "main"]);
    assert!(!output.status.success());

    let op = opstate::read(&repo.open());
    assert_eq!(op.kind, OpKind::Rebase);
    assert_eq!(op.ours_label, "Upstream (main)");
    assert!(op.theirs_label.contains("feature change"), "{op:?}");
    assert_eq!(op.description, "Rebasing feature onto main");

    let document = conflicts::load(&repo.open(), "f.txt", false).unwrap();
    assert_eq!(document.ours, "main\n");
    assert_eq!(document.theirs, "feature\n");
}

#[test]
fn cherry_pick_and_revert_conflicts_are_detected() {
    let repo = diverged_repo();
    let picked = repo.rev_parse("feature~1");
    repo.checkout("main");
    assert!(!repo.git_raw(&["cherry-pick", &picked]).status.success());
    let op = opstate::read(&repo.open());
    assert_eq!(op.kind, OpKind::CherryPick);
    assert!(op.ours_label.contains("main"));
    assert!(op.theirs_label.contains("feature change"), "{op:?}");
    repo.git(&["cherry-pick", "--abort"]);
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::None);

    repo.write("f.txt", "newer\n");
    repo.commit_all("newer");
    let reverted = repo.rev_parse("HEAD~1");
    assert!(!repo.git_raw(&["revert", "--no-edit", &reverted]).status.success());
    let op = opstate::read(&repo.open());
    assert_eq!(op.kind, OpKind::Revert);
    assert!(op.theirs_label.contains("main change"), "{op:?}");
}

// log

fn linear_history(repo: &TestRepo) -> Vec<String> {
    (1..=5)
        .map(|number| {
            repo.write("log.txt", format!("{number}\n"));
            repo.commit_all(&format!("commit {number}"))
        })
        .collect()
}

#[test]
fn log_page_orders_newest_first_and_pages() {
    let repo = TestRepo::new();
    let commits = linear_history(&repo);
    let git_repo = repo.open();

    let all = log::page(&git_repo, 0, 100, false).unwrap();
    let ids: Vec<&str> = all.iter().map(|commit| commit.id.as_str()).collect();
    let expected: Vec<&str> = commits.iter().rev().map(String::as_str).collect();
    assert_eq!(ids, expected);
    assert_eq!(all[0].summary, "commit 5");
    assert_eq!(all[0].author_name, "Test User");
    assert_eq!(all[0].author_email, "test@example.com");
    assert_eq!(all[0].parents, vec![commits[3].clone()]);
    assert!(all[4].parents.is_empty());
    assert!(all[0].time > all[4].time);

    let page = log::page(&git_repo, 1, 2, false).unwrap();
    let summaries: Vec<&str> = page.iter().map(|commit| commit.summary.as_str()).collect();
    assert_eq!(summaries, vec!["commit 4", "commit 3"]);
    assert!(log::page(&git_repo, 10, 5, false).unwrap().is_empty());
}

#[test]
fn log_page_in_unborn_repo_is_empty() {
    let repo = TestRepo::new();
    assert!(log::page(&repo.open(), 0, 10, true).unwrap().is_empty());
}

#[test]
fn log_page_labels_refs_and_includes_all_refs() {
    let remote = BareRemote::new();
    let repo = TestRepo::new();
    repo.add_remote("origin", &remote);
    let commits = linear_history(&repo);
    repo.git(&["tag", "v1", &commits[0]]);
    repo.git(&["tag", "-a", "-m", "annotated", "v2", &commits[1]]);
    repo.git(&["branch", "other", &commits[2]]);
    repo.git(&["push", "-q", "origin", "main"]);
    repo.git(&["switch", "-q", "-c", "side", &commits[2]]);
    repo.write("side.txt", "side\n");
    let side = repo.commit_all("side commit");
    repo.checkout("main");

    let git_repo = repo.open();
    let page = log::page(&git_repo, 0, 100, false).unwrap();
    assert_eq!(page.len(), 5);
    let labels = |id: &str| -> Vec<(String, RefKind)> {
        page.iter()
            .find(|commit| commit.id == id)
            .map(|commit| commit.refs.iter().map(|label| (label.name.clone(), label.kind)).collect())
            .unwrap_or_default()
    };
    let tip = labels(&commits[4]);
    assert!(tip.iter().any(|(name, kind)| name == "main" && matches!(kind, RefKind::Head)), "{tip:?}");
    assert!(tip.iter().any(|(name, kind)| name == "origin/main" && matches!(kind, RefKind::Remote)), "{tip:?}");
    let middle = labels(&commits[2]);
    assert!(middle.iter().any(|(name, kind)| name == "other" && matches!(kind, RefKind::Local)), "{middle:?}");
    assert!(labels(&commits[0]).iter().any(|(name, kind)| name == "v1" && matches!(kind, RefKind::Tag)));
    assert!(labels(&commits[1]).iter().any(|(name, kind)| name == "v2" && matches!(kind, RefKind::Tag)));
    assert!(page.iter().all(|commit| commit.id != side));

    let all = log::page(&git_repo, 0, 100, true).unwrap();
    assert_eq!(all.len(), 6);
    assert!(all.iter().any(|commit| commit.id == side));

    repo.git(&["switch", "-q", "--detach", &commits[3]]);
    let detached = log::page(&repo.open(), 0, 100, false).unwrap();
    assert_eq!(detached[0].id, commits[3]);
    assert!(detached[0]
        .refs
        .iter()
        .any(|label| label.name == "HEAD" && matches!(label.kind, RefKind::Head)));
}

#[test]
fn log_details_lists_files_with_rename() {
    let repo = TestRepo::new();
    let content = "line one of a longer file\nline two\nline three\nline four\nline five\n";
    repo.write("before.txt", content);
    repo.write("edit.txt", "edit\n");
    repo.write("gone.txt", "gone\n");
    let root = repo.commit_all("root");
    repo.git(&["mv", "before.txt", "after.txt"]);
    repo.write("edit.txt", "edited\n");
    repo.remove("gone.txt");
    repo.write("fresh.txt", "fresh\n");
    let commit = repo.commit_all("rename and edit\n\nbody text");

    let details = log::details(&repo.open(), &commit).unwrap();
    assert_eq!(details.id, commit);
    assert_eq!(details.message.trim_end(), "rename and edit\n\nbody text");
    assert_eq!(details.parents, vec![root.clone()]);
    assert_eq!(details.author_name, "Test User");
    let mut files: Vec<(String, Option<String>, String)> = details
        .files
        .iter()
        .map(|file| (file.path.clone(), file.orig_path.clone(), file.status.clone()))
        .collect();
    files.sort();
    assert_eq!(
        files,
        vec![
            ("after.txt".to_string(), Some("before.txt".to_string()), "renamed".to_string()),
            ("edit.txt".to_string(), None, "modified".to_string()),
            ("fresh.txt".to_string(), None, "added".to_string()),
            ("gone.txt".to_string(), None, "deleted".to_string()),
        ]
    );

    let root_details = log::details(&repo.open(), &root).unwrap();
    assert!(root_details.parents.is_empty());
    assert!(root_details.files.iter().all(|file| file.status == "added"));
    assert_eq!(root_details.files.len(), 3);

    assert!(log::details(&repo.open(), "not-a-commit").is_err());
}

// diff

#[test]
fn diff_commit_file_sides() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\n");
    repo.write("old.txt", "renamed content line\nsecond line\nthird line\n");
    repo.write("image.bin", image_bytes(&[1]));
    repo.commit_all("first");
    repo.write("a.txt", "two\r\n");
    repo.write("new.txt", "new\n");
    repo.git(&["mv", "old.txt", "moved.txt"]);
    repo.write("image.bin", image_bytes(&[2]));
    let commit = repo.commit_all("second");
    let git_repo = repo.open();

    let modified = diff::commit_file(&git_repo, &commit, "a.txt", None).unwrap();
    assert_eq!((modified.original.as_str(), modified.modified.as_str()), ("one\n", "two\n"));
    assert_eq!((modified.original_eol, modified.modified_eol), (Eol::Lf, Eol::Crlf));
    assert!(!modified.binary && !modified.too_large);

    let added = diff::commit_file(&git_repo, &commit, "new.txt", None).unwrap();
    assert_eq!((added.original.as_str(), added.modified.as_str()), ("", "new\n"));

    let moved = diff::commit_file(&git_repo, &commit, "moved.txt", Some("old.txt")).unwrap();
    assert_eq!(moved.original, moved.modified);
    assert!(moved.original.starts_with("renamed content line"));

    let binary = diff::commit_file(&git_repo, &commit, "image.bin", None).unwrap();
    assert!(binary.binary);
    assert!(binary.original.is_empty() && binary.modified.is_empty());

    let first = repo.rev_parse("HEAD~1");
    let root_file = diff::commit_file(&git_repo, &first, "a.txt", None).unwrap();
    assert_eq!((root_file.original.as_str(), root_file.modified.as_str()), ("", "one\n"));
}

#[test]
fn diff_working_file_staged_and_unstaged() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\n");
    repo.write("deleted.txt", "deleted\n");
    repo.write("image.bin", image_bytes(&[1]));
    repo.commit_all("first");
    repo.write("a.txt", "two\n");
    repo.git(&["add", "a.txt"]);
    repo.write("a.txt", "three\n");
    repo.remove("deleted.txt");
    repo.write("untracked.txt", "untracked\n");
    repo.write("image.bin", image_bytes(&[2]));
    let git_repo = repo.open();

    let staged = diff::working_file(&git_repo, "a.txt", None, DiffArea::Staged).unwrap();
    assert_eq!((staged.original.as_str(), staged.modified.as_str()), ("one\n", "two\n"));
    let unstaged = diff::working_file(&git_repo, "a.txt", None, DiffArea::Unstaged).unwrap();
    assert_eq!((unstaged.original.as_str(), unstaged.modified.as_str()), ("two\n", "three\n"));

    let deleted = diff::working_file(&git_repo, "deleted.txt", None, DiffArea::Unstaged).unwrap();
    assert_eq!((deleted.original.as_str(), deleted.modified.as_str()), ("deleted\n", ""));
    let untracked = diff::working_file(&git_repo, "untracked.txt", None, DiffArea::Unstaged).unwrap();
    assert_eq!((untracked.original.as_str(), untracked.modified.as_str()), ("", "untracked\n"));

    let binary = diff::working_file(&git_repo, "image.bin", None, DiffArea::Unstaged).unwrap();
    assert!(binary.binary);

    repo.git(&["mv", "a.txt", "renamed.txt"]);
    let git_repo = repo.open();
    let renamed = diff::working_file(&git_repo, "renamed.txt", Some("a.txt"), DiffArea::Staged).unwrap();
    assert_eq!((renamed.original.as_str(), renamed.modified.as_str()), ("one\n", "two\n"));
}

#[test]
fn diff_versions_change_only_when_a_side_changes() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\n");
    repo.write("b.txt", "b\n");
    repo.commit_all("first");
    repo.write("a.txt", "two\n");
    repo.git(&["add", "a.txt"]);
    let staged = diff::working_file(&repo.open(), "a.txt", None, DiffArea::Staged).unwrap();
    let known = staged.version.clone();
    let check = || diff::working_file_if_changed(&repo.open(), "a.txt", None, DiffArea::Staged, known.as_deref()).unwrap();
    assert!(check().is_none());
    // Work tree edits and other files leave the staged diff alone.
    repo.write("a.txt", "three\n");
    repo.write("b.txt", "b2\n");
    repo.git(&["add", "b.txt"]);
    assert!(check().is_none());
    // Staging this file changes its staged diff.
    repo.git(&["add", "a.txt"]);
    let changed = check().expect("the index side changed");
    assert_eq!(changed.modified, "three\n");
    assert_eq!(changed.hunks, vec![[0, 1, 0, 1]]);
}

#[test]
fn diff_hunks_follow_the_line_ranges_of_both_sides() {
    let repo = TestRepo::new();
    let base: Vec<String> = (0..40).map(|index| format!("line {index}")).collect();
    repo.write("a.txt", base.join("\n"));
    repo.commit_all("first");
    let mut edited = base.clone();
    edited[5] = "changed".to_string();
    edited.insert(30, "inserted".to_string());
    edited.remove(1);
    repo.write("a.txt", edited.join("\n"));
    let diff = diff::working_file(&repo.open(), "a.txt", None, DiffArea::Unstaged).unwrap();
    assert_eq!(diff.hunks, vec![[1, 2, 1, 1], [5, 6, 4, 5], [30, 30, 29, 30]]);
    // Binary and identical sides have none.
    assert!(diff::from_bytes("x", Some(vec![0, 1]), Some(vec![0, 2])).hunks.is_empty());
    assert!(diff::from_bytes("x", Some(b"same".to_vec()), Some(b"same".to_vec())).hunks.is_empty());
}

#[test]
fn diff_working_file_staged_in_unborn_repo() {
    let repo = TestRepo::new();
    repo.write("a.txt", "first\n");
    repo.git(&["add", "a.txt"]);
    let staged = diff::working_file(&repo.open(), "a.txt", None, DiffArea::Staged).unwrap();
    assert_eq!((staged.original.as_str(), staged.modified.as_str()), ("", "first\n"));
}

// refs

#[test]
fn refs_read_local_remote_and_tags() {
    let remote = BareRemote::new();
    let publisher = TestRepo::new();
    publisher.add_remote("origin", &remote);
    publisher.write("a.txt", "a\n");
    publisher.commit_all("first");
    publisher.git(&["push", "-q", "origin", "main"]);
    publisher.git(&["switch", "-q", "-c", "feature/login"]);
    publisher.write("login.txt", "login\n");
    publisher.commit_all("login");
    publisher.git(&["push", "-q", "origin", "feature/login"]);

    let repo = TestRepo::clone_from(&remote);
    repo.write("b.txt", "b\n");
    repo.commit_all("local ahead");
    repo.git(&["branch", "topic"]);
    repo.git(&["tag", "v2.0"]);
    repo.git(&["tag", "-a", "-m", "release", "v1.0", "HEAD~1"]);
    repo.git(&["remote", "add", "team/up", &remote.path_string()]);
    repo.git(&["fetch", "-q", "team/up"]);

    let refs = refs::read(&repo.open()).unwrap();
    let local: Vec<(&str, bool, Option<&str>, usize, usize)> = refs
        .local
        .iter()
        .map(|branch| {
            (
                branch.name.as_str(),
                branch.is_head,
                branch.upstream.as_deref(),
                branch.ahead,
                branch.behind,
            )
        })
        .collect();
    assert_eq!(
        local,
        vec![("main", true, Some("origin/main"), 1, 0), ("topic", false, None, 0, 0)]
    );
    assert!(refs.local.iter().all(|branch| branch.short_id.as_ref().map(String::len) == Some(8)));

    let remote_branches: Vec<(&str, &str, &str)> = refs
        .remote
        .iter()
        .map(|branch| (branch.name.as_str(), branch.remote.as_str(), branch.branch.as_str()))
        .collect();
    assert_eq!(
        remote_branches,
        vec![
            ("origin/feature/login", "origin", "feature/login"),
            ("origin/main", "origin", "main"),
            ("team/up/feature/login", "team/up", "feature/login"),
            ("team/up/main", "team/up", "main"),
        ]
    );
    assert_eq!(refs.tags, vec!["v1.0".to_string(), "v2.0".to_string()]);
    let mut remotes = refs.remotes.clone();
    remotes.sort();
    assert_eq!(remotes, vec!["origin".to_string(), "team/up".to_string()]);
}

// stash

#[test]
fn stash_list_newest_first() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.commit_all("base");
    repo.write("a.txt", "first stash\n");
    repo.git(&["stash", "push", "-q", "-m", "first"]);
    repo.write("a.txt", "second stash\n");
    repo.git(&["stash", "push", "-q", "-m", "second"]);

    let entries = stash::list(&mut repo.open()).unwrap();
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].index, 0);
    assert!(entries[0].message.contains("second"), "{entries:?}");
    assert_eq!(entries[1].index, 1);
    assert!(entries[1].message.contains("first"), "{entries:?}");
    assert_eq!(entries[0].short_id, repo.rev_parse("stash@{0}")[..8]);
}

// cli

#[test]
fn run_streaming_push_and_fetch_against_local_remote() {
    let remote = BareRemote::new();
    let repo = TestRepo::new();
    repo.add_remote("origin", &remote);
    repo.write("a.txt", "a\n");
    repo.commit_all("first");

    let mut lines = Vec::new();
    let output = cli::run_streaming(&repo.path, &["push", "--progress", "-u", "origin", "main"], |line| {
        lines.push(line.to_string());
    })
    .unwrap();
    assert!(output.success);
    assert!(!lines.is_empty());
    assert!(output.text().contains("main -> main"), "{}", output.text());
    assert!(lines.iter().all(|line| !line.contains('\r') && !line.contains('\n')));

    let clone = TestRepo::clone_from(&remote);
    repo.write("a.txt", "b\n");
    repo.commit_all("second");
    repo.git(&["push", "-q"]);
    let mut progress = 0;
    let fetched = cli::run_streaming(&clone.path, &["fetch", "--all", "--prune", "--progress"], |_| {
        progress += 1;
    })
    .unwrap();
    assert!(fetched.success);
    assert!(progress > 0);
    assert_eq!(clone.rev_parse("origin/main"), repo.head());
}

#[test]
fn run_streaming_failure_carries_git_message() {
    let repo = TestRepo::new();
    let result = cli::run_streaming(&repo.path, &["fetch", "no-such-remote"], |_| {});
    match result {
        Err(AppError::Command { message }) => assert!(message.contains("no-such-remote"), "{message}"),
        other => panic!("expected a command error, got {other:?}"),
    }
}

#[test]
fn run_reports_failure_and_stdin_is_passed() {
    let repo = TestRepo::new();
    let hashed = cli::run_with_stdin(&repo.path, &["hash-object", "--stdin"], b"hello\n").unwrap();
    assert_eq!(hashed.stdout.trim(), "ce013625030ba8dba906f756967f9e9ca394464a");
    let result = cli::run(&repo.path, &["rev-parse", "--verify", "no-such-ref"]);
    assert!(matches!(result, Err(AppError::Command { .. })), "{result:?}");
    let raw = cli::run_raw(&repo.path, &["rev-parse", "--verify", "no-such-ref"], None).unwrap();
    assert!(!raw.success);
}

#[test]
fn repo_discover_finds_root_from_subdirectory() {
    let repo = TestRepo::new();
    repo.write("sub/dir/file.txt", "x\n");
    let info = super::repo::discover(&repo.file("sub/dir").ui()).unwrap();
    assert_eq!(canonical(Path::new(&info.root)), repo.path);
    assert_eq!(info.name, "repo");
    assert!(!info.root.ends_with('/'));

    let outside = tempfile::TempDir::new().unwrap();
    assert!(super::repo::discover(&outside.path().ui()).is_err());
}

// scripts/make-conflict-repo.sh

fn run_demo_script(extra_args: &[&str]) -> (tempfile::TempDir, std::path::PathBuf) {
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../scripts/make-conflict-repo.sh");
    let dir = tempfile::TempDir::new().unwrap();
    let target = canonical(dir.path()).join("demo");
    // Constructing a TestRepo first sets up the isolated git environment.
    drop(TestRepo::new());
    let output = std::process::Command::new("bash")
        .arg(&script)
        .arg(&target)
        .args(extra_args)
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    (dir, target)
}

#[test]
#[cfg_attr(windows, ignore = "the demo scripts are macOS and Linux tools")]
fn demo_script_builds_every_conflict_type() {
    let (_dir, target) = run_demo_script(&[]);
    let git_repo = git2::Repository::open(&target).unwrap();
    let summary = conflicts::list(&git_repo).unwrap();
    assert_eq!(summary.op.kind, OpKind::Merge);
    let listed: Vec<(&str, FileConflictKind, bool)> = summary
        .files
        .iter()
        .map(|file| (file.path.as_str(), file.kind, file.binary))
        .collect();
    assert_eq!(
        listed,
        vec![
            ("assets/logo.png", FileConflictKind::BothModified, true),
            ("docs/legacy.md", FileConflictKind::DeletedByUs, false),
            ("server/routes.py", FileConflictKind::BothModified, false),
            ("src/app.ts", FileConflictKind::BothModified, false),
            ("src/config.json", FileConflictKind::BothAdded, false),
            ("src/layout.ts", FileConflictKind::BothModified, false),
            ("src/old-utils.ts", FileConflictKind::DeletedByThem, false),
            ("src/report.ts", FileConflictKind::BothModified, false),
            ("windows/setup.bat", FileConflictKind::BothModified, false),
        ]
    );

    let app = conflicts::load(&git_repo, "src/app.ts", false).unwrap();
    let kinds: Vec<ChunkKind> = app.chunks.iter().map(|chunk| chunk.kind).collect();
    use ChunkKind::*;
    assert_eq!(
        kinds,
        vec![OursOnly, Conflict, OursOnly, BothSame, TheirsOnly, Conflict, TheirsOnly, OursOnly, TheirsOnly]
    );

    let report = conflicts::load(&git_repo, "src/report.ts", false).unwrap();
    let report_kinds: Vec<ChunkKind> = report.chunks.iter().map(|chunk| chunk.kind).collect();
    assert_eq!(report_kinds, vec![OursOnly, OursOnly, Conflict, TheirsOnly, TheirsOnly, Conflict]);
    assert!(report.ours.lines().count() > 2000);

    let routes = conflicts::load(&git_repo, "server/routes.py", false).unwrap();
    let routes_conflicts = routes.chunks.iter().filter(|chunk| chunk.kind == Conflict).count();
    assert_eq!(routes_conflicts, 5);
    assert_eq!(routes.chunks.len(), 11);

    let layout_strict = conflicts::load(&git_repo, "src/layout.ts", false).unwrap();
    assert!(layout_strict.chunks.iter().any(|chunk| chunk.kind == Conflict));
    let layout_relaxed = conflicts::load(&git_repo, "src/layout.ts", true).unwrap();
    let relaxed: Vec<ChunkKind> = layout_relaxed.chunks.iter().map(|chunk| chunk.kind).collect();
    assert_eq!(relaxed, vec![TheirsOnly]);

    let bat = conflicts::load(&git_repo, "windows/setup.bat", false).unwrap();
    assert_eq!(bat.eol, Eol::Crlf);
}

#[test]
#[cfg_attr(windows, ignore = "the demo scripts are macOS and Linux tools")]
fn demo_script_rebase_mode_and_refuses_non_empty_target() {
    let (_dir, target) = run_demo_script(&["--rebase"]);
    let op = opstate::read(&git2::Repository::open(&target).unwrap());
    assert_eq!(op.kind, OpKind::Rebase);
    assert_eq!(op.ours_label, "Upstream (main)");

    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../scripts/make-conflict-repo.sh");
    let again = std::process::Command::new("bash").arg(&script).arg(&target).output().unwrap();
    assert!(!again.status.success());
    assert!(String::from_utf8_lossy(&again.stderr).contains("not empty"));
}

// workspace helpers

#[test]
fn workspace_relative_paths_and_deepest_repo() {
    use super::workspace::{deepest_repo_index, relative_slash_path};
    use std::path::PathBuf;

    let base = Path::new("/w");
    assert_eq!(relative_slash_path(base, Path::new("/w/apps/web")), "apps/web");
    assert_eq!(relative_slash_path(base, Path::new("/w")), "");
    assert_eq!(relative_slash_path(base, Path::new("/elsewhere")), "");
    assert_eq!(relative_slash_path(base, Path::new("/w-other/x")), "");

    let roots = vec![PathBuf::from("/w/apps/web"), PathBuf::from("/w"), PathBuf::from("/w/apps/webby")];
    assert_eq!(deepest_repo_index(&roots, Path::new("/w/apps/web/src/a.ts")), Some(0));
    assert_eq!(deepest_repo_index(&roots, Path::new("/w/apps/web")), Some(0));
    assert_eq!(deepest_repo_index(&roots, Path::new("/w/apps/webby/x")), Some(2));
    assert_eq!(deepest_repo_index(&roots, Path::new("/w/apps/other")), Some(1));
    assert_eq!(deepest_repo_index(&roots, Path::new("/x")), None);
}

#[test]
fn status_skips_nested_repositories_but_keeps_untracked_folders() {
    let repo = TestRepo::new();
    repo.write("tracked.txt", "a\n");
    repo.commit_all("base");
    repo.write("nested/inner.txt", "x\n");
    git_in(&repo.file("nested"), &["init", "-q"]);
    repo.write("plain/new.txt", "y\n");

    let current = status::read(&repo.open()).unwrap();
    let paths: Vec<&str> = current.files.iter().map(|file| file.path.as_str()).collect();
    assert_eq!(paths, vec!["plain/new.txt"]);
}
