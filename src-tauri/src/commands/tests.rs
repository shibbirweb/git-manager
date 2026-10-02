use std::path::Path;

use super::merge::{self, Side};
use super::{branch, file_ops, files, history, repo as repo_commands, safe_join, stash, status, workspace};
use crate::error::AppError;
use crate::git::conflicts;
use crate::git::diff::DiffArea;
use crate::git::opstate::{self, OpKind};
use crate::git::repo::RepoInfo;
use crate::git::workspace::WorkspaceInfo;
use crate::merge::model::Eol;
use crate::test_support::*;

fn conflict_paths(repo: &TestRepo) -> Vec<String> {
    conflicts::list(&repo.open())
        .unwrap()
        .files
        .into_iter()
        .map(|file| file.path)
        .collect()
}

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

// save_resolution / accept_side

#[test]
fn save_resolution_writes_content_and_stages_it() {
    let repo = merge_conflict_repo();
    let resolved = "alpha\nresolved\n";
    block_on(merge::save_resolution(
        repo.path_string(),
        "both.txt".to_string(),
        resolved.to_string(),
        Eol::Lf,
    ))
    .unwrap();
    assert_eq!(repo.read_text("both.txt"), resolved);
    assert_eq!(repo.index_text("both.txt"), resolved);

    block_on(merge::save_resolution(
        repo.path_string(),
        "crlf.txt".to_string(),
        "one\nresolved\nthree\n".to_string(),
        Eol::Crlf,
    ))
    .unwrap();
    assert_eq!(repo.read_text("crlf.txt"), "one\r\nresolved\r\nthree\r\n");
    assert_eq!(repo.index_text("crlf.txt"), "one\r\nresolved\r\nthree\r\n");

    let remaining = conflict_paths(&repo);
    assert!(!remaining.contains(&"both.txt".to_string()));
    assert!(!remaining.contains(&"crlf.txt".to_string()));
    assert_eq!(remaining.len(), 4);

    let escape = block_on(merge::save_resolution(
        repo.path_string(),
        "../outside.txt".to_string(),
        "x".to_string(),
        Eol::Lf,
    ));
    assert!(matches!(escape, Err(AppError::Invalid(_))), "{escape:?}");
    assert!(!repo.path.parent().unwrap().join("outside.txt").exists());
}

#[test]
fn accept_side_ours_resolves_whole_files() {
    let repo = merge_conflict_repo();
    block_on(merge::accept_side(
        repo.path_string(),
        strings(&["both.txt", "added.txt", "deleted_by_us.txt", "deleted_by_them.txt"]),
        Side::Ours,
    ))
    .unwrap();
    assert_eq!(repo.read_text("both.txt"), BOTH_OURS);
    assert_eq!(repo.index_text("both.txt"), BOTH_OURS);
    assert_eq!(repo.read_text("added.txt"), ADDED_OURS);
    assert_eq!(repo.read_text("deleted_by_them.txt"), DELETED_BY_THEM_OURS);
    assert!(!repo.exists("deleted_by_us.txt"));
    assert_eq!(repo.git(&["ls-files", "--", "deleted_by_us.txt"]), "");

    let mut remaining = conflict_paths(&repo);
    remaining.sort();
    assert_eq!(remaining, strings(&["crlf.txt", "image.bin"]));
}

#[test]
fn accept_side_theirs_resolves_whole_files() {
    let repo = merge_conflict_repo();
    block_on(merge::accept_side(
        repo.path_string(),
        strings(&["deleted_by_them.txt", "deleted_by_us.txt", "image.bin", "crlf.txt"]),
        Side::Theirs,
    ))
    .unwrap();
    assert!(!repo.exists("deleted_by_them.txt"));
    assert_eq!(repo.git(&["ls-files", "--", "deleted_by_them.txt"]), "");
    assert_eq!(repo.read_text("deleted_by_us.txt"), DELETED_BY_US_THEIRS);
    assert_eq!(repo.read("image.bin"), image_bytes(&[7, 7, 7]));
    assert_eq!(repo.index_bytes("image.bin"), image_bytes(&[7, 7, 7]));
    assert_eq!(repo.read_text("crlf.txt"), CRLF_THEIRS);

    let mut remaining = conflict_paths(&repo);
    remaining.sort();
    assert_eq!(remaining, strings(&["added.txt", "both.txt"]));
}

#[test]
fn accept_side_ignores_paths_not_in_conflict() {
    let repo = merge_conflict_repo();
    block_on(merge::accept_side(repo.path_string(), strings(&["clean.txt"]), Side::Ours)).unwrap();
    assert_eq!(conflict_paths(&repo).len(), 6);
    assert_eq!(repo.read_text("clean.txt"), "untouched\n");
}

// continue / abort

#[test]
fn continue_operation_completes_merge() {
    let repo = merge_conflict_repo();
    let premature = block_on(merge::continue_operation(repo.path_string())).unwrap();
    assert!(premature.conflicts);
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::Merge);

    block_on(merge::accept_side(repo.path_string(), conflict_paths(&repo), Side::Ours)).unwrap();
    assert!(conflict_paths(&repo).is_empty());
    let outcome = block_on(merge::continue_operation(repo.path_string())).unwrap();
    assert!(!outcome.conflicts, "{}", outcome.output);
    assert_eq!(repo.parent_count("HEAD"), 2);
    assert_eq!(repo.rev_parse("HEAD^2"), repo.rev_parse("feature"));
    assert!(repo.head_message().starts_with("Merge branch 'feature'"));
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::None);
    assert_eq!(repo.porcelain(), "");
    assert_eq!(repo.read_text("both.txt"), BOTH_OURS);
}

#[test]
fn abort_operation_restores_pre_merge_state() {
    let repo = merge_conflict_repo();
    let before = repo.rev_parse("HEAD");
    let outcome = block_on(merge::abort_operation(repo.path_string())).unwrap();
    assert!(!outcome.conflicts);
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::None);
    assert_eq!(repo.head(), before);
    assert_eq!(repo.porcelain(), "");
    assert_eq!(repo.read_text("both.txt"), BOTH_OURS);
    assert!(!repo.exists("deleted_by_us.txt"));
}

#[test]
fn continue_and_abort_without_operation_are_invalid() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.commit_all("first");
    let continued = block_on(merge::continue_operation(repo.path_string()));
    assert!(matches!(continued, Err(AppError::Invalid(_))), "{continued:?}");
    let aborted = block_on(merge::abort_operation(repo.path_string()));
    assert!(matches!(aborted, Err(AppError::Invalid(_))), "{aborted:?}");
}

#[test]
fn list_and_load_conflict_commands() {
    let repo = merge_conflict_repo();
    let summary = block_on(merge::list_conflicts(repo.path_string())).unwrap();
    assert_eq!(summary.files.len(), 6);
    let document = block_on(merge::load_conflict(repo.path_string(), "both.txt".to_string(), false)).unwrap();
    assert_eq!(document.base, BOTH_BASE);
}

// branch commands that start operations

#[test]
fn merge_branch_reports_conflicts_and_failures() {
    let repo = diverged_repo();
    repo.checkout("main");
    let outcome = block_on(branch::merge_branch(repo.path_string(), "feature".to_string())).unwrap();
    assert!(outcome.conflicts);
    assert!(outcome.output.contains("CONFLICT"), "{}", outcome.output);
    block_on(merge::abort_operation(repo.path_string())).unwrap();

    let missing = block_on(branch::merge_branch(repo.path_string(), "no-such-branch".to_string()));
    assert!(matches!(missing, Err(AppError::Command { .. })), "{missing:?}");
}

#[test]
fn rebase_conflict_continue_after_resolution() {
    let repo = diverged_repo();
    let outcome = block_on(branch::rebase_onto(repo.path_string(), "main".to_string())).unwrap();
    assert!(outcome.conflicts);
    let op = opstate::read(&repo.open());
    assert_eq!(op.kind, OpKind::Rebase);
    assert_eq!(op.ours_label, "Upstream (main)");
    assert!(op.theirs_label.contains("feature change"));

    block_on(merge::save_resolution(
        repo.path_string(),
        "f.txt".to_string(),
        "resolved\n".to_string(),
        Eol::Lf,
    ))
    .unwrap();
    let outcome = block_on(merge::continue_operation(repo.path_string())).unwrap();
    assert!(!outcome.conflicts, "{}", outcome.output);
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::None);
    assert_eq!(repo.git(&["branch", "--show-current"]).trim(), "feature");
    assert_eq!(repo.read_text("f.txt"), "resolved\n");
    assert_eq!(repo.read_text("other.txt"), "other\n");
    assert_eq!(repo.rev_parse("HEAD~2"), repo.rev_parse("main"));
    assert_eq!(repo.git(&["log", "-1", "--format=%s", "HEAD~1"]).trim(), "feature change");
}

#[test]
fn skip_rebase_commit_drops_the_conflicting_commit() {
    let repo = diverged_repo();
    let outcome = block_on(branch::rebase_onto(repo.path_string(), "main".to_string())).unwrap();
    assert!(outcome.conflicts);
    let skipped = block_on(merge::skip_rebase_commit(repo.path_string())).unwrap();
    assert!(!skipped.conflicts, "{}", skipped.output);
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::None);
    assert_eq!(repo.read_text("f.txt"), "main\n");
    assert_eq!(repo.read_text("other.txt"), "other\n");
    assert_eq!(repo.rev_parse("HEAD~1"), repo.rev_parse("main"));
    assert_eq!(repo.git(&["log", "-1", "--format=%s"]).trim(), "feature second");
}

#[test]
fn rebase_abort_restores_branch() {
    let repo = diverged_repo();
    let before = repo.head();
    block_on(branch::rebase_onto(repo.path_string(), "main".to_string())).unwrap();
    block_on(merge::abort_operation(repo.path_string())).unwrap();
    assert_eq!(repo.head(), before);
    assert_eq!(repo.git(&["branch", "--show-current"]).trim(), "feature");
}

// history commands

#[test]
fn cherry_pick_conflict_then_continue() {
    let repo = diverged_repo();
    let picked = repo.rev_parse("feature~1");
    repo.checkout("main");
    let outcome = block_on(history::cherry_pick(repo.path_string(), picked.clone())).unwrap();
    assert!(outcome.conflicts);
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::CherryPick);

    block_on(merge::accept_side(repo.path_string(), strings(&["f.txt"]), Side::Theirs)).unwrap();
    let outcome = block_on(merge::continue_operation(repo.path_string())).unwrap();
    assert!(!outcome.conflicts, "{}", outcome.output);
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::None);
    assert_eq!(repo.git(&["log", "-1", "--format=%s"]).trim(), "feature change");
    assert_eq!(repo.parent_count("HEAD"), 1);
    assert_eq!(repo.read_text("f.txt"), "feature\n");
}

#[test]
fn revert_conflict_then_continue() {
    let repo = diverged_repo();
    repo.checkout("main");
    repo.write("f.txt", "newer\n");
    repo.commit_all("newer");
    let reverted = repo.rev_parse("HEAD~1");
    let outcome = block_on(history::revert_commit(repo.path_string(), reverted)).unwrap();
    assert!(outcome.conflicts);
    let op = opstate::read(&repo.open());
    assert_eq!(op.kind, OpKind::Revert);
    assert!(op.theirs_label.contains("main change"));

    block_on(merge::save_resolution(repo.path_string(), "f.txt".to_string(), "base\n".to_string(), Eol::Lf)).unwrap();
    let outcome = block_on(merge::continue_operation(repo.path_string())).unwrap();
    assert!(!outcome.conflicts, "{}", outcome.output);
    assert_eq!(opstate::read(&repo.open()).kind, OpKind::None);
    assert!(repo.head_message().starts_with("Revert \"main change\""), "{}", repo.head_message());
}

#[test]
fn reset_and_checkout_commit() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\n");
    let first = repo.commit_all("first");
    repo.write("a.txt", "two\n");
    repo.commit_all("second");

    block_on(history::reset_to(repo.path_string(), first.clone(), "soft".to_string())).unwrap();
    assert_eq!(repo.head(), first);
    assert_eq!(repo.porcelain(), "M  a.txt\n");
    block_on(history::reset_to(repo.path_string(), first.clone(), "mixed".to_string())).unwrap();
    assert_eq!(repo.porcelain(), " M a.txt\n");
    block_on(history::reset_to(repo.path_string(), first.clone(), "hard".to_string())).unwrap();
    assert_eq!(repo.porcelain(), "");
    assert_eq!(repo.read_text("a.txt"), "one\n");
    let invalid = block_on(history::reset_to(repo.path_string(), first.clone(), "merge".to_string()));
    assert!(matches!(invalid, Err(AppError::Invalid(_))), "{invalid:?}");

    block_on(history::checkout_commit(repo.path_string(), first.clone())).unwrap();
    assert_eq!(repo.git(&["branch", "--show-current"]).trim(), "");
    assert_eq!(repo.head(), first);

    let log = block_on(history::get_log(repo.path_string(), 0, usize::MAX, true)).unwrap();
    assert_eq!(log.len(), 1);
    let details = block_on(history::get_commit_details(repo.path_string(), first.clone())).unwrap();
    assert_eq!(details.files.len(), 1);
    let diff = block_on(history::get_commit_file_diff(repo.path_string(), first, "a.txt".to_string(), None)).unwrap();
    assert_eq!(diff.modified, "one\n");
}

// status commands

#[test]
fn stage_content_updates_index_for_tracked_file() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\ntwo\nthree\n");
    repo.commit_all("first");
    repo.write("a.txt", "one\nTWO\nthree\nfour\n");

    block_on(status::stage_content(
        repo.path_string(),
        "a.txt".to_string(),
        "one\nTWO\nthree\n".to_string(),
        Eol::Lf,
    ))
    .unwrap();
    assert_eq!(repo.index_text("a.txt"), "one\nTWO\nthree\n");
    assert_eq!(repo.read_text("a.txt"), "one\nTWO\nthree\nfour\n");
    assert_eq!(repo.porcelain(), "MM a.txt\n");

    block_on(status::stage_content(
        repo.path_string(),
        "a.txt".to_string(),
        "crlf\nlines\n".to_string(),
        Eol::Crlf,
    ))
    .unwrap();
    assert_eq!(repo.index_bytes("a.txt"), b"crlf\r\nlines\r\n".to_vec());
}

#[test]
fn stage_content_adds_new_file_and_keeps_executable_mode() {
    let repo = TestRepo::new();
    repo.write("script.sh", "#!/bin/sh\necho one\n");
    set_executable(&repo.file("script.sh"));
    repo.write("readme.txt", "readme\n");
    repo.commit_all("first");
    assert!(repo.index_entry("script.sh").starts_with("100755 "));

    block_on(status::stage_content(
        repo.path_string(),
        "script.sh".to_string(),
        "#!/bin/sh\necho two\n".to_string(),
        Eol::Lf,
    ))
    .unwrap();
    assert!(repo.index_entry("script.sh").starts_with("100755 "), "{}", repo.index_entry("script.sh"));
    assert_eq!(repo.index_text("script.sh"), "#!/bin/sh\necho two\n");

    repo.write("dir/new.txt", "whole file\nwith more\n");
    block_on(status::stage_content(
        repo.path_string(),
        "dir/new.txt".to_string(),
        "whole file\n".to_string(),
        Eol::Lf,
    ))
    .unwrap();
    let entry = repo.index_entry("dir/new.txt");
    assert!(entry.starts_with("100644 ") && entry.ends_with("\tdir/new.txt"), "{entry}");
    assert_eq!(repo.index_text("dir/new.txt"), "whole file\n");
    assert_eq!(repo.porcelain(), "AM dir/new.txt\nMM script.sh\n");

    let escape = block_on(status::stage_content(
        repo.path_string(),
        "../x".to_string(),
        "x".to_string(),
        Eol::Lf,
    ));
    assert!(matches!(escape, Err(AppError::Invalid(_))), "{escape:?}");
}

fn set_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = std::fs::metadata(path).unwrap().permissions();
    permissions.set_mode(0o755);
    std::fs::set_permissions(path, permissions).unwrap();
}

#[test]
fn unstage_files_in_unborn_and_normal_repo() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.write("dir/b.txt", "b\n");
    repo.git(&["add", "-A"]);
    block_on(status::unstage_files(repo.path_string(), strings(&["a.txt", "dir"]))).unwrap();
    assert_eq!(repo.porcelain(), "?? a.txt\n?? dir/\n");
    assert!(repo.exists("a.txt"));

    repo.commit_all("first");
    repo.write("a.txt", "changed\n");
    repo.git(&["add", "a.txt"]);
    assert_eq!(repo.porcelain(), "M  a.txt\n");
    block_on(status::unstage_files(repo.path_string(), strings(&["a.txt"]))).unwrap();
    assert_eq!(repo.porcelain(), " M a.txt\n");
    assert_eq!(repo.read_text("a.txt"), "changed\n");
}

#[test]
fn stage_files_stages_modifications_and_deletions() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.write("b.txt", "b\n");
    repo.commit_all("first");
    repo.write("a.txt", "changed\n");
    repo.remove("b.txt");
    repo.write("c.txt", "new\n");
    block_on(status::stage_files(repo.path_string(), strings(&["a.txt", "b.txt", "c.txt"]))).unwrap();
    assert_eq!(repo.porcelain(), "M  a.txt\nD  b.txt\nA  c.txt\n");
}

#[test]
fn discard_files_restores_tracked_and_deletes_untracked() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.write("b.txt", "b\n");
    repo.commit_all("first");
    repo.write("a.txt", "changed\n");
    repo.remove("b.txt");
    repo.write("new.txt", "new\n");
    repo.write("new_dir/nested/file.txt", "nested\n");

    block_on(status::discard_files(
        repo.path_string(),
        strings(&["a.txt", "b.txt"]),
        strings(&["new.txt", "new_dir", "already_gone.txt"]),
    ))
    .unwrap();
    assert_eq!(repo.read_text("a.txt"), "a\n");
    assert_eq!(repo.read_text("b.txt"), "b\n");
    assert!(!repo.exists("new.txt"));
    assert!(!repo.exists("new_dir"));
    assert_eq!(repo.porcelain(), "");

    let outside = repo.path.parent().unwrap().join("keep.txt");
    std::fs::write(&outside, "keep").unwrap();
    let escape = block_on(status::discard_files(repo.path_string(), Vec::new(), strings(&["../keep.txt"])));
    assert!(matches!(escape, Err(AppError::Invalid(_))), "{escape:?}");
    assert!(outside.exists());
}

#[test]
fn safe_join_rejects_escaping_paths() {
    let root = "/tmp/repo";
    assert_eq!(safe_join(root, "a/b.txt").unwrap(), Path::new("/tmp/repo/a/b.txt"));
    assert_eq!(safe_join(root, "./a.txt").unwrap(), Path::new("/tmp/repo/./a.txt"));
    for bad in ["../x", "a/../../x", "a/..", "/etc/passwd", ""] {
        assert!(matches!(safe_join(root, bad), Err(AppError::Invalid(_))), "{bad} was accepted");
    }
}

#[test]
fn write_worktree_file_applies_eol() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\r\nb\r\n");
    block_on(status::write_worktree_file(
        repo.path_string(),
        "a.txt".to_string(),
        "x\ny\n".to_string(),
        Eol::Crlf,
    ))
    .unwrap();
    assert_eq!(repo.read_text("a.txt"), "x\r\ny\r\n");
}

#[test]
fn commit_with_multiline_message_and_amend() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.git(&["add", "a.txt"]);
    let message = "Subject line\n\nFirst body line\nSecond body line with 'quotes' and \"double\"\n";
    block_on(status::commit(repo.path_string(), message.to_string(), false, None)).unwrap();
    assert_eq!(repo.head_message(), message.to_string() + "\n");
    assert_eq!(block_on(status::get_head_message(repo.path_string())).unwrap(), message);
    let first = repo.head();

    repo.write("b.txt", "b\n");
    repo.git(&["add", "b.txt"]);
    block_on(status::commit(repo.path_string(), "Reworded\n".to_string(), true, None)).unwrap();
    assert_ne!(repo.head(), first);
    assert_eq!(repo.parent_count("HEAD"), 0);
    assert_eq!(repo.head_message().trim_end(), "Reworded");

    repo.write("c.txt", "c\n");
    repo.git(&["add", "c.txt"]);
    block_on(status::commit(repo.path_string(), "  \n".to_string(), true, None)).unwrap();
    assert_eq!(repo.head_message().trim_end(), "Reworded");
    assert_eq!(repo.git(&["rev-list", "--count", "HEAD"]).trim(), "1");
    assert_eq!(repo.git(&["ls-tree", "--name-only", "HEAD"]), "a.txt\nb.txt\nc.txt\n");

    let empty = block_on(status::commit(repo.path_string(), "".to_string(), false, None));
    assert!(empty.is_err(), "empty non-amend commit must fail: {empty:?}");
}

#[test]
fn commit_all_stages_tracked_changes_but_not_untracked_files() {
    let repo = TestRepo::new();
    repo.write("tracked.txt", "one\n");
    repo.write("gone.txt", "bye\n");
    repo.commit_all("base");

    repo.write("tracked.txt", "two\n");
    repo.remove("gone.txt");
    repo.write("new.txt", "new\n");
    block_on(status::commit_all(repo.path_string(), "All tracked".to_string(), false, None)).unwrap();
    assert_eq!(repo.head_message().trim_end(), "All tracked");
    assert_eq!(repo.git(&["ls-tree", "--name-only", "HEAD"]), "tracked.txt\n");
    assert_eq!(repo.porcelain(), "?? new.txt\n");

    repo.write("tracked.txt", "three\n");
    block_on(status::commit_all(repo.path_string(), "".to_string(), true, None)).unwrap();
    assert_eq!(repo.head_message().trim_end(), "All tracked", "amend without a message keeps it");
    assert_eq!(repo.git(&["show", "HEAD:tracked.txt"]), "three\n");
}

#[test]
fn undo_last_commit_keeps_changes_staged_and_refuses_the_first_commit() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.commit_all("first");
    let first = repo.head();

    let only = block_on(status::undo_last_commit(repo.path_string()));
    assert!(matches!(&only, Err(AppError::Invalid(message)) if message.contains("no parent")), "{only:?}");
    assert_eq!(repo.head(), first);

    repo.write("a.txt", "changed\n");
    repo.commit_all("second\n\nwith a body");
    let message = block_on(status::undo_last_commit(repo.path_string())).unwrap();
    assert_eq!(message.trim_end(), "second\n\nwith a body");
    assert_eq!(repo.head(), first);
    assert_eq!(repo.porcelain(), "M  a.txt\n");
    assert_eq!(repo.read_text("a.txt"), "changed\n");

    let unborn = TestRepo::new();
    let nothing = block_on(status::undo_last_commit(unborn.path_string()));
    assert!(matches!(nothing, Err(AppError::Invalid(_))), "{nothing:?}");
}

#[test]
fn get_status_and_file_diff_commands() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\n");
    repo.commit_all("first");
    repo.write("a.txt", "two\n");
    let status = block_on(status::get_status(repo.path_string())).unwrap();
    assert_eq!(status.files.len(), 1);
    assert_eq!(status.head.branch.as_deref(), Some("main"));
    let diff = block_on(status::get_file_diff(repo.path_string(), "a.txt".to_string(), None, DiffArea::Unstaged)).unwrap();
    assert_eq!((diff.original.as_str(), diff.modified.as_str()), ("one\n", "two\n"));

    let info = block_on(repo_commands::open_repo(repo.path_string())).unwrap();
    assert_eq!(canonical(Path::new(&info.root)), repo.path);
    assert_eq!(info.relative_path, "");
}

// stash commands

#[test]
fn stash_push_apply_with_conflict_and_drop() {
    let repo = TestRepo::new();
    repo.write("f.txt", "base\n");
    repo.commit_all("base");
    repo.write("f.txt", "stashed\n");
    repo.write("untracked.txt", "untracked\n");
    block_on(stash::stash_push(repo.path_string(), "work in progress".to_string(), true)).unwrap();
    assert_eq!(repo.porcelain(), "");
    let stashes = block_on(stash::get_stashes(repo.path_string())).unwrap();
    assert_eq!(stashes.len(), 1);
    assert!(stashes[0].message.contains("work in progress"), "{stashes:?}");

    repo.write("f.txt", "committed\n");
    repo.commit_all("conflicting change");
    let outcome = block_on(stash::stash_apply(repo.path_string(), 0, true)).unwrap();
    assert!(outcome.conflicts, "{}", outcome.output);
    assert!(!repo.unmerged().is_empty());
    let document = conflicts::load(&repo.open(), "f.txt", false).unwrap();
    assert_eq!(document.ours, "committed\n");
    assert_eq!(document.theirs, "stashed\n");
    // A conflicting pop keeps the stash entry.
    assert_eq!(block_on(stash::get_stashes(repo.path_string())).unwrap().len(), 1);

    repo.git(&["reset", "-q", "--hard"]);
    repo.git(&["clean", "-fdq"]);
    block_on(stash::stash_drop(repo.path_string(), 0)).unwrap();
    assert!(block_on(stash::get_stashes(repo.path_string())).unwrap().is_empty());
    let missing = block_on(stash::stash_apply(repo.path_string(), 0, false));
    assert!(matches!(missing, Err(AppError::Command { .. })), "{missing:?}");
}

#[test]
fn stash_apply_clean_reports_no_conflicts() {
    let repo = TestRepo::new();
    repo.write("f.txt", "base\n");
    repo.commit_all("base");
    repo.write("f.txt", "stashed\n");
    block_on(stash::stash_push(repo.path_string(), String::new(), false)).unwrap();
    let outcome = block_on(stash::stash_apply(repo.path_string(), 0, false)).unwrap();
    assert!(!outcome.conflicts);
    assert_eq!(repo.read_text("f.txt"), "stashed\n");
    assert_eq!(block_on(stash::get_stashes(repo.path_string())).unwrap().len(), 1);
}

// branch commands

#[test]
fn branch_create_switch_rename_delete() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    let first = repo.commit_all("first");
    repo.write("a.txt", "b\n");
    repo.commit_all("second");

    block_on(branch::create_branch(repo.path_string(), "old".to_string(), Some(first.clone()), false)).unwrap();
    assert_eq!(repo.rev_parse("old"), first);
    assert_eq!(repo.git(&["branch", "--show-current"]).trim(), "main");

    block_on(branch::create_branch(repo.path_string(), "work/topic".to_string(), None, true)).unwrap();
    assert_eq!(repo.git(&["branch", "--show-current"]).trim(), "work/topic");

    block_on(branch::checkout_branch(repo.path_string(), "old".to_string())).unwrap();
    assert_eq!(repo.head(), first);
    block_on(branch::rename_branch(repo.path_string(), "old".to_string(), "renamed".to_string())).unwrap();
    assert_eq!(repo.git(&["branch", "--show-current"]).trim(), "renamed");

    block_on(branch::checkout_branch(repo.path_string(), "main".to_string())).unwrap();
    block_on(branch::delete_branch(repo.path_string(), "renamed".to_string(), false)).unwrap();
    repo.git(&["switch", "-q", "-c", "unmerged", &first]);
    repo.write("c.txt", "c\n");
    repo.commit_all("unmerged");
    repo.checkout("main");
    let refused = block_on(branch::delete_branch(repo.path_string(), "unmerged".to_string(), false));
    assert!(matches!(refused, Err(AppError::Command { .. })), "{refused:?}");
    block_on(branch::delete_branch(repo.path_string(), "unmerged".to_string(), true)).unwrap();

    let refs = block_on(branch::get_refs(repo.path_string())).unwrap();
    let names: Vec<&str> = refs.local.iter().map(|branch| branch.name.as_str()).collect();
    assert_eq!(names, vec!["main", "work/topic"]);
}

#[test]
fn checkout_remote_branch_tracks_or_switches() {
    let remote = BareRemote::new();
    let publisher = TestRepo::new();
    publisher.add_remote("origin", &remote);
    publisher.write("a.txt", "a\n");
    publisher.commit_all("first");
    publisher.git(&["push", "-q", "origin", "main"]);
    publisher.git(&["switch", "-q", "-c", "feature/x"]);
    publisher.write("x.txt", "x\n");
    publisher.commit_all("x");
    publisher.git(&["push", "-q", "origin", "feature/x"]);

    let repo = TestRepo::clone_from(&remote);
    block_on(branch::checkout_remote_branch(
        repo.path_string(),
        "origin/feature/x".to_string(),
        "feature/x".to_string(),
    ))
    .unwrap();
    assert_eq!(repo.git(&["branch", "--show-current"]).trim(), "feature/x");
    assert_eq!(repo.git(&["rev-parse", "--abbrev-ref", "@{upstream}"]).trim(), "origin/feature/x");

    repo.checkout("main");
    block_on(branch::checkout_remote_branch(
        repo.path_string(),
        "origin/main".to_string(),
        "main".to_string(),
    ))
    .unwrap();
    assert_eq!(repo.git(&["branch", "--show-current"]).trim(), "main");
}

// File explorer

#[test]
fn list_directory_sorts_folders_first_and_marks_ignored_entries() {
    let repo = TestRepo::new();
    repo.write(".gitignore", "target/\n*.log\n");
    repo.write("src/main.rs", "fn main() {}\n");
    repo.write("target/debug/out", "binary");
    repo.write("b.txt", "b\n");
    repo.write("A.md", "a\n");
    repo.write("debug.log", "noise\n");

    let root = block_on(files::list_directory(repo.path_string(), String::new(), vec![repo.path_string()])).unwrap();
    let names: Vec<(&str, bool, bool)> = root
        .entries
        .iter()
        .map(|entry| (entry.name.as_str(), entry.is_dir, entry.ignored))
        .collect();
    assert_eq!(
        names,
        vec![
            ("src", true, false),
            ("target", true, true),
            (".gitignore", false, false),
            ("A.md", false, false),
            ("b.txt", false, false),
            ("debug.log", false, true),
        ]
    );
    assert!(root.entries.iter().all(|entry| !entry.is_repo));
    assert!(!root.truncated);

    let src = block_on(files::list_directory(repo.path_string(), "src".to_string(), vec![repo.path_string()])).unwrap();
    assert_eq!(src.entries.len(), 1);
    assert_eq!(src.entries[0].path, "src/main.rs");
}

#[test]
fn list_directory_rejects_paths_outside_the_work_tree() {
    let repo = TestRepo::new();
    let result = block_on(files::list_directory(repo.path_string(), "../".to_string(), vec![repo.path_string()]));
    assert!(matches!(result, Err(AppError::Invalid(_))));
}

#[test]
fn read_worktree_file_normalizes_crlf_and_detects_binary() {
    let repo = TestRepo::new();
    repo.write("win.txt", "one\r\ntwo\r\n");
    repo.write("image.bin", [0u8, 1, 2, 3]);

    let text = block_on(files::read_worktree_file(repo.path_string(), "win.txt".to_string())).unwrap();
    assert_eq!(text.content, "one\ntwo\n");
    assert_eq!(text.eol, Eol::Crlf);
    assert!(!text.binary);

    let binary = block_on(files::read_worktree_file(repo.path_string(), "image.bin".to_string())).unwrap();
    assert!(binary.binary);
    assert!(binary.content.is_empty());
}

#[test]
fn read_image_data_url_reads_workspace_images_only() {
    let repo = TestRepo::new();
    repo.write("docs/logo.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");
    repo.write("notes.md", "# Notes");

    let url = block_on(files::read_image_data_url(repo.path_string(), "docs/logo.svg".to_string())).unwrap();
    assert!(url.starts_with("data:image/svg+xml;base64,"));

    let not_image = block_on(files::read_image_data_url(repo.path_string(), "notes.md".to_string()));
    assert!(matches!(not_image, Err(AppError::Invalid(_))));
    let escape = block_on(files::read_image_data_url(repo.path_string(), "../logo.png".to_string()));
    assert!(matches!(escape, Err(AppError::Invalid(_))));
    let absolute = block_on(files::read_image_data_url(repo.path_string(), "/etc/hosts.png".to_string()));
    assert!(matches!(absolute, Err(AppError::Invalid(_))));
    let missing = block_on(files::read_image_data_url(repo.path_string(), "docs/none.png".to_string()));
    assert!(matches!(missing, Err(AppError::Io(_))));
}

#[test]
fn read_preview_file_reads_workspace_images_and_pdfs_only() {
    let repo = TestRepo::new();
    repo.write("docs/manual.pdf", "%PDF-1.7");
    repo.write("docs/logo.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");

    assert!(block_on(files::read_preview_file(repo.path_string(), "docs/manual.pdf".to_string())).is_ok());
    // SVG is text: it opens in the editor, not the preview.
    let svg = block_on(files::read_preview_file(repo.path_string(), "docs/logo.svg".to_string()));
    assert!(matches!(svg, Err(AppError::Invalid(_))));
    let escape = block_on(files::read_preview_file(repo.path_string(), "../manual.pdf".to_string()));
    assert!(matches!(escape, Err(AppError::Invalid(_))));
    let missing = block_on(files::read_preview_file(repo.path_string(), "docs/none.png".to_string()));
    assert!(matches!(missing, Err(AppError::Io(_))));
}

// Workspaces

fn open_workspace(folder: &Path) -> WorkspaceInfo {
    block_on(workspace::open_workspace(folder.to_string_lossy().into_owned())).unwrap()
}

/// `(root, relative_path)` of each repository, in order.
fn repo_list(repos: &[RepoInfo]) -> Vec<(String, String)> {
    repos
        .iter()
        .map(|repo| (repo.root.clone(), repo.relative_path.clone()))
        .collect()
}

fn text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[test]
fn open_workspace_on_a_repository() {
    let dir = TestDir::new();
    dir.init_repo("");
    let info = open_workspace(&dir.path);
    assert_eq!(info.root, dir.path_string());
    assert_eq!(info.name, "workspace");
    assert_eq!(repo_list(&info.repos), vec![(dir.path_string(), String::new())]);
    assert_eq!(info.repos[0].name, "workspace");
}

#[test]
fn open_workspace_finds_side_by_side_repositories_with_relative_paths() {
    let dir = TestDir::new();
    let web = dir.init_repo("apps/web");
    let api = dir.init_repo("apps/api");
    let tools = dir.init_repo("tools");
    dir.write("notes/readme.txt", "not a repo\n");

    let info = open_workspace(&dir.path);
    assert_eq!(
        repo_list(&info.repos),
        vec![
            (text(&api), "apps/api".to_string()),
            (text(&web), "apps/web".to_string()),
            (text(&tools), "tools".to_string()),
        ]
    );
    assert_eq!(info.repos[1].name, "web");
}

#[test]
fn open_workspace_finds_nested_repositories_parent_first() {
    let dir = TestDir::new();
    let parent = dir.init_repo("parent");
    let child = dir.init_repo("parent/libs/child");
    let info = open_workspace(&dir.path);
    assert_eq!(
        repo_list(&info.repos),
        vec![
            (text(&parent), "parent".to_string()),
            (text(&child), "parent/libs/child".to_string()),
        ]
    );
}

#[test]
fn open_workspace_inside_a_repository_includes_the_enclosing_repository() {
    let dir = TestDir::new();
    dir.init_repo("");
    let nested = dir.init_repo("src/app/nested");
    dir.mkdir("src/app/other");

    let info = open_workspace(&dir.file("src/app"));
    assert_eq!(info.root, dir.file_string("src/app"));
    assert_eq!(info.name, "app");
    assert_eq!(
        repo_list(&info.repos),
        vec![(dir.path_string(), String::new()), (text(&nested), "nested".to_string())]
    );
}

#[test]
fn open_workspace_skips_dependency_folders_deep_folders_and_symlinks() {
    let dir = TestDir::new();
    dir.init_repo("web/node_modules/pkg");
    dir.init_repo("vendor/lib");
    dir.init_repo(".git-like/target/x");
    let deepest = dir.init_repo("a/b/c/d/e/f");
    dir.init_repo("a/b/c/d/e/f/g/too-deep");
    #[cfg(unix)]
    std::os::unix::fs::symlink(&deepest, dir.file("linked")).unwrap();

    let info = open_workspace(&dir.path);
    assert_eq!(repo_list(&info.repos), vec![(text(&deepest), "a/b/c/d/e/f".to_string())]);
}

#[test]
fn open_workspace_finds_linked_worktrees() {
    let dir = TestDir::new();
    let main = dir.init_repo("main");
    git_in(
        &main,
        &["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "--allow-empty", "-m", "base"],
    );
    git_in(&main, &["worktree", "add", "-q", "../linked"]);
    assert!(dir.file("linked/.git").is_file());

    let info = open_workspace(&dir.path);
    assert_eq!(
        repo_list(&info.repos),
        vec![
            (dir.file_string("linked"), "linked".to_string()),
            (text(&main), "main".to_string()),
        ]
    );
}

#[test]
fn open_workspace_on_an_empty_folder_has_no_repositories() {
    let dir = TestDir::new();
    let info = open_workspace(&dir.path);
    assert!(info.repos.is_empty());
    assert_eq!(info.root, dir.path_string());
}

#[test]
fn open_workspace_rejects_missing_paths_and_files() {
    let dir = TestDir::new();
    let missing = block_on(workspace::open_workspace(dir.file_string("missing")));
    assert!(matches!(missing, Err(AppError::Invalid(_))), "{missing:?}");

    dir.write("file.txt", "x\n");
    let file = block_on(workspace::open_workspace(dir.file_string("file.txt")));
    assert!(matches!(file, Err(AppError::Invalid(_))), "{file:?}");
}

#[test]
fn init_repository_creates_a_repository_that_discovery_finds() {
    let dir = TestDir::new();
    dir.init_repo("existing");
    dir.mkdir("fresh");
    assert_eq!(block_on(workspace::discover_repositories(dir.path_string())).unwrap().len(), 1);

    let info = block_on(workspace::init_repository(dir.file_string("fresh"))).unwrap();
    assert_eq!((info.root.as_str(), info.name.as_str()), (dir.file_string("fresh").as_str(), "fresh"));
    assert_eq!(info.relative_path, "");
    assert!(dir.file("fresh/.git").is_dir());

    let repos = block_on(workspace::discover_repositories(dir.path_string())).unwrap();
    assert_eq!(
        repo_list(&repos),
        vec![
            (dir.file_string("existing"), "existing".to_string()),
            (dir.file_string("fresh"), "fresh".to_string()),
        ]
    );

    let missing = block_on(workspace::init_repository(dir.file_string("missing")));
    assert!(matches!(missing, Err(AppError::Invalid(_))), "{missing:?}");
}

#[test]
fn list_directory_uses_the_deepest_repository_for_ignores() {
    let dir = TestDir::new();
    dir.write("notes.log", "outside every repository\n");
    dir.write("plain/debug.log", "plain folder\n");
    let parent = dir.init_repo("parent");
    let child = dir.init_repo("parent/child");
    dir.write("parent/.gitignore", "*.log\nbuild-out/\nchild/\n");
    dir.write("parent/a.log", "ignored\n");
    dir.write("parent/build-out/x", "ignored\n");
    dir.write("parent/child/b.log", "not ignored by child\n");
    dir.write("parent/child/src/c.log", "not ignored by child\n");
    let repo_roots = vec![text(&parent), text(&child)];

    let list = |dir_path: &str| -> Vec<(String, bool, bool, bool)> {
        block_on(files::list_directory(dir.path_string(), dir_path.to_string(), repo_roots.clone()))
            .unwrap()
            .entries
            .into_iter()
            .map(|entry| (entry.path, entry.is_dir, entry.ignored, entry.is_repo))
            .collect()
    };
    let entry = |path: &str, is_dir: bool, ignored: bool, is_repo: bool| (path.to_string(), is_dir, ignored, is_repo);

    assert_eq!(
        list(""),
        vec![
            entry("parent", true, false, true),
            entry("plain", true, false, false),
            entry("notes.log", false, false, false),
        ]
    );
    assert_eq!(list("plain"), vec![entry("plain/debug.log", false, false, false)]);
    assert_eq!(
        list("parent"),
        vec![
            entry("parent/build-out", true, true, false),
            entry("parent/child", true, false, true),
            entry("parent/.gitignore", false, false, false),
            entry("parent/a.log", false, true, false),
        ]
    );
    assert_eq!(
        list("parent/child"),
        vec![entry("parent/child/src", true, false, false), entry("parent/child/b.log", false, false, false)]
    );
    assert_eq!(list("parent/child/src"), vec![entry("parent/child/src/c.log", false, false, false)]);

    // Without repositories nothing is ignored or flagged.
    let bare = block_on(files::list_directory(dir.path_string(), "parent".to_string(), Vec::new())).unwrap();
    assert!(bare.entries.iter().all(|entry| !entry.ignored && !entry.is_repo));
}

#[test]
fn worktree_file_commands_work_in_a_plain_folder() {
    let dir = TestDir::new();
    dir.write("docs/a.txt", "a\r\nb\r\n");
    let file = block_on(files::read_worktree_file(dir.path_string(), "docs/a.txt".to_string())).unwrap();
    assert_eq!((file.content.as_str(), file.eol), ("a\nb\n", Eol::Crlf));

    block_on(status::write_worktree_file(
        dir.path_string(),
        "docs/a.txt".to_string(),
        "x\n".to_string(),
        Eol::Crlf,
    ))
    .unwrap();
    assert_eq!(std::fs::read_to_string(dir.file("docs/a.txt")).unwrap(), "x\r\n");
}

// File operations (file_create, file_rename, file_copy, file_move, file_trash)

fn file_error<T: std::fmt::Debug>(result: crate::error::AppResult<T>) -> String {
    result.expect_err("expected an error").to_string()
}

fn child_names(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .unwrap()
        .map(|child| child.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

#[test]
fn file_create_makes_files_folders_and_nested_names() {
    let dir = TestDir::new();
    let roots = vec![dir.path_string()];
    let created = block_on(file_ops::file_create(roots.clone(), dir.path_string(), "a.ts".to_string(), false)).unwrap();
    assert_eq!(created, dir.file_string("a.ts"));
    assert_eq!(std::fs::read(dir.file("a.ts")).unwrap(), b"");

    let nested = block_on(file_ops::file_create(
        roots.clone(),
        dir.path_string(),
        "src/lib/cart.ts".to_string(),
        false,
    ))
    .unwrap();
    assert_eq!(nested, dir.file_string("src/lib/cart.ts"));
    assert!(dir.file("src/lib/cart.ts").is_file());

    // An existing folder in the name is reused; a new folder can be nested too.
    let folder = block_on(file_ops::file_create(roots.clone(), dir.path_string(), "src/lib/util/".to_string(), true))
        .unwrap();
    assert_eq!(folder, dir.file_string("src/lib/util"));
    assert!(dir.file("src/lib/util").is_dir());

    let exists = block_on(file_ops::file_create(roots.clone(), dir.file_string("src"), "lib".to_string(), true));
    assert_eq!(file_error(exists), "lib already exists");
    let through_file = block_on(file_ops::file_create(roots.clone(), dir.path_string(), "a.ts/b.ts".to_string(), false));
    assert_eq!(file_error(through_file), "a.ts is not a folder");
    let bad_name = block_on(file_ops::file_create(roots.clone(), dir.path_string(), "..".to_string(), false));
    assert_eq!(file_error(bad_name), "A name cannot be . or ..");
    let git_name = block_on(file_ops::file_create(roots, dir.path_string(), ".git/hooks".to_string(), true));
    assert_eq!(file_error(git_name), "Files inside .git cannot be changed");
}

#[test]
fn file_rename_renames_in_place_including_case_only_renames() {
    let dir = TestDir::new();
    let roots = vec![dir.path_string()];
    dir.write("src/cart.ts", "cart");
    dir.write("src/other.ts", "other");
    dir.write("lib/inner/x.ts", "x");

    let renamed = block_on(file_ops::file_rename(roots.clone(), dir.file_string("src/cart.ts"), "basket.ts".to_string()))
        .unwrap();
    assert_eq!(renamed, dir.file_string("src/basket.ts"));
    assert_eq!(child_names(&dir.file("src")), strings(&["basket.ts", "other.ts"]));

    let case_only =
        block_on(file_ops::file_rename(roots.clone(), dir.file_string("src/basket.ts"), "Basket.ts".to_string()))
            .unwrap();
    assert_eq!(case_only, dir.file_string("src/Basket.ts"));
    assert_eq!(child_names(&dir.file("src")), strings(&["Basket.ts", "other.ts"]));
    assert_eq!(std::fs::read_to_string(dir.file("src/Basket.ts")).unwrap(), "cart");

    let folder = block_on(file_ops::file_rename(roots.clone(), dir.file_string("lib"), "Lib".to_string())).unwrap();
    assert_eq!(folder, dir.file_string("Lib"));
    assert!(child_names(&dir.path).contains(&"Lib".to_string()));
    assert!(dir.file("Lib/inner/x.ts").is_file());

    let unchanged =
        block_on(file_ops::file_rename(roots.clone(), dir.file_string("src/other.ts"), "other.ts".to_string())).unwrap();
    assert_eq!(unchanged, dir.file_string("src/other.ts"));

    let taken = block_on(file_ops::file_rename(roots.clone(), dir.file_string("src/other.ts"), "Basket.ts".to_string()));
    assert_eq!(file_error(taken), "Basket.ts already exists");
    let slash = block_on(file_ops::file_rename(roots.clone(), dir.file_string("src/other.ts"), "a/b.ts".to_string()));
    assert_eq!(file_error(slash), "A name cannot contain /");
    let missing = block_on(file_ops::file_rename(roots, dir.file_string("src/gone.ts"), "x.ts".to_string()));
    assert_eq!(file_error(missing), "gone.ts does not exist");
}

#[test]
fn file_copy_uses_copy_names_and_copies_folders_and_symlinks() {
    let dir = TestDir::new();
    let roots = vec![dir.path_string()];
    dir.write("src/cart.ts", "cart");
    dir.write("src/lib/a.ts", "a");
    dir.write("src/lib/deep/b.ts", "b");
    dir.mkdir("dest");

    let first = block_on(file_ops::file_copy(roots.clone(), vec![dir.file_string("src/cart.ts")], dir.file_string("src")))
        .unwrap();
    let second = block_on(file_ops::file_copy(roots.clone(), vec![dir.file_string("src/cart.ts")], dir.file_string("src")))
        .unwrap();
    let of_copy = block_on(file_ops::file_copy(
        roots.clone(),
        vec![dir.file_string("src/cart copy.ts")],
        dir.file_string("src"),
    ))
    .unwrap();
    assert_eq!(first, vec![dir.file_string("src/cart copy.ts")]);
    assert_eq!(second, vec![dir.file_string("src/cart copy 2.ts")]);
    assert_eq!(of_copy, vec![dir.file_string("src/cart copy 3.ts")]);
    assert_eq!(std::fs::read_to_string(dir.file("src/cart copy 2.ts")).unwrap(), "cart");

    // Several sources keep their order; a folder is copied with everything inside.
    let copied = block_on(file_ops::file_copy(
        roots.clone(),
        vec![dir.file_string("src/lib"), dir.file_string("src/cart.ts")],
        dir.file_string("dest"),
    ))
    .unwrap();
    assert_eq!(copied, vec![dir.file_string("dest/lib"), dir.file_string("dest/cart.ts")]);
    assert_eq!(std::fs::read_to_string(dir.file("dest/lib/deep/b.ts")).unwrap(), "b");
    let folder_again =
        block_on(file_ops::file_copy(roots.clone(), vec![dir.file_string("src/lib")], dir.file_string("dest"))).unwrap();
    assert_eq!(folder_again, vec![dir.file_string("dest/lib copy")]);
    assert!(dir.file("src/lib/a.ts").is_file());

    let into_itself =
        block_on(file_ops::file_copy(roots.clone(), vec![dir.file_string("src")], dir.file_string("src/lib/deep")));
    assert_eq!(file_error(into_itself), "Cannot copy src into itself");

    #[cfg(unix)]
    {
        // A symlink is copied as a link, even one that points out of the workspace.
        let outside = dir.path.parent().unwrap().join("outside");
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(outside.join("secret.txt"), "secret").unwrap();
        std::os::unix::fs::symlink(&outside, dir.file("src/out-link")).unwrap();
        std::os::unix::fs::symlink("cart.ts", dir.file("src/cart-link")).unwrap();
        let links = block_on(file_ops::file_copy(
            roots.clone(),
            vec![dir.file_string("src/out-link"), dir.file_string("src/cart-link")],
            dir.file_string("dest"),
        ))
        .unwrap();
        assert_eq!(links, vec![dir.file_string("dest/out-link"), dir.file_string("dest/cart-link")]);
        assert!(std::fs::symlink_metadata(dir.file("dest/out-link")).unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_link(dir.file("dest/out-link")).unwrap(), outside);
        assert_eq!(std::fs::read_link(dir.file("dest/cart-link")).unwrap(), Path::new("cart.ts"));
        assert_eq!(child_names(&outside), strings(&["secret.txt"]));
    }
}

#[test]
fn file_move_moves_entries_and_refuses_conflicts_before_moving_anything() {
    let dir = TestDir::new();
    let roots = vec![dir.path_string()];
    dir.write("a/cart.ts", "cart");
    dir.write("a/lib/x.ts", "x");
    dir.write("b/lib/x.ts", "other");
    dir.mkdir("c");

    // The conflict on `lib` refuses the move before `cart.ts` moves.
    let conflict = block_on(file_ops::file_move(
        roots.clone(),
        vec![dir.file_string("a/cart.ts"), dir.file_string("a/lib")],
        dir.file_string("b"),
    ));
    assert_eq!(file_error(conflict), "lib already exists in b");
    assert!(dir.file("a/cart.ts").is_file());

    let into_itself = block_on(file_ops::file_move(roots.clone(), vec![dir.file_string("a")], dir.file_string("a/lib")));
    assert_eq!(file_error(into_itself), "Cannot move a into itself");

    // Already in the target: skipped. A file inside a moved folder goes with it.
    let moved = block_on(file_ops::file_move(
        roots.clone(),
        vec![
            dir.file_string("a/cart.ts"),
            dir.file_string("a/lib/x.ts"),
            dir.file_string("a/lib"),
            dir.file_string("c"),
        ],
        dir.file_string("c"),
    ))
    .unwrap_err();
    assert_eq!(moved.to_string(), "Cannot move c into itself");

    let moved = block_on(file_ops::file_move(
        roots.clone(),
        vec![dir.file_string("a/cart.ts"), dir.file_string("a/lib/x.ts"), dir.file_string("a/lib")],
        dir.file_string("c"),
    ))
    .unwrap();
    assert_eq!(
        moved,
        vec![
            crate::file_ops::FileMove {
                from: dir.file_string("a/cart.ts"),
                to: dir.file_string("c/cart.ts"),
            },
            crate::file_ops::FileMove {
                from: dir.file_string("a/lib"),
                to: dir.file_string("c/lib"),
            },
        ]
    );
    assert_eq!(child_names(&dir.file("a")), Vec::<String>::new());
    assert_eq!(std::fs::read_to_string(dir.file("c/lib/x.ts")).unwrap(), "x");

    let no_op = block_on(file_ops::file_move(roots, vec![dir.file_string("c/cart.ts")], dir.file_string("c"))).unwrap();
    assert!(no_op.is_empty());
    assert!(dir.file("c/cart.ts").is_file());
}

#[test]
fn file_move_works_across_the_folders_of_a_two_folder_workspace() {
    let dir = TestDir::new();
    dir.write("one/src/cart.ts", "cart");
    dir.write("two/readme.md", "readme");
    let roots = vec![dir.file_string("one"), dir.file_string("two")];

    let moved = block_on(file_ops::file_move(roots.clone(), vec![dir.file_string("one/src")], dir.file_string("two")))
        .unwrap();
    assert_eq!(moved[0].to, dir.file_string("two/src"));
    assert!(dir.file("two/src/cart.ts").is_file());
    assert!(!dir.file("one/src").exists());

    let copied = block_on(file_ops::file_copy(roots, vec![dir.file_string("two/readme.md")], dir.file_string("one")))
        .unwrap();
    assert_eq!(copied, vec![dir.file_string("one/readme.md")]);
}

#[test]
fn file_operations_refuse_roots_git_folders_and_paths_outside() {
    let dir = TestDir::new();
    dir.init_repo("repo");
    dir.write("repo/a.ts", "a");
    dir.write("holder/nested/n.ts", "n");
    let outside = dir.path.parent().unwrap().join("outside");
    std::fs::create_dir_all(&outside).unwrap();
    std::fs::write(outside.join("o.ts"), "o").unwrap();
    let roots = vec![dir.path_string(), dir.file_string("holder/nested")];
    let outside_dir = outside.to_string_lossy().into_owned();
    let outside_file = outside.join("o.ts").to_string_lossy().into_owned();

    let rename_root = block_on(file_ops::file_rename(roots.clone(), dir.path_string(), "x".to_string()));
    assert_eq!(file_error(rename_root), "workspace is a workspace folder");
    let trash_root = block_on(file_ops::file_trash(roots.clone(), vec![dir.file_string("holder/nested")]));
    assert_eq!(file_error(trash_root), "nested is a workspace folder");
    let move_holder =
        block_on(file_ops::file_move(roots.clone(), vec![dir.file_string("holder")], dir.file_string("repo")));
    assert_eq!(file_error(move_holder), "holder holds the workspace folder nested");
    let copy_root = block_on(file_ops::file_copy(roots.clone(), vec![dir.path_string()], dir.file_string("repo")));
    assert_eq!(file_error(copy_root), "workspace is a workspace folder");

    let git = "Files inside .git cannot be changed";
    let in_git = block_on(file_ops::file_create(roots.clone(), dir.file_string("repo/.git"), "x".to_string(), false));
    assert_eq!(file_error(in_git), git);
    let git_itself = block_on(file_ops::file_rename(roots.clone(), dir.file_string("repo/.git"), "git".to_string()));
    assert_eq!(file_error(git_itself), git);
    let rename_to_git = block_on(file_ops::file_rename(roots.clone(), dir.file_string("repo/a.ts"), ".git".to_string()));
    assert_eq!(file_error(rename_to_git), git);
    let copy_into_git =
        block_on(file_ops::file_copy(roots.clone(), vec![dir.file_string("repo/a.ts")], dir.file_string("repo/.git")));
    assert_eq!(file_error(copy_into_git), git);
    let trash_git = block_on(file_ops::file_trash(roots.clone(), vec![dir.file_string("repo/.git/HEAD")]));
    assert_eq!(file_error(trash_git), git);

    let outside_source =
        block_on(file_ops::file_copy(roots.clone(), vec![outside_file.clone()], dir.file_string("repo")));
    assert_eq!(file_error(outside_source), format!("{outside_file} is outside the workspace"));
    let outside_target =
        block_on(file_ops::file_move(roots.clone(), vec![dir.file_string("repo/a.ts")], outside_dir.clone()));
    assert_eq!(file_error(outside_target), format!("{outside_dir} is outside the workspace"));
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&outside, dir.file("repo/out-link")).unwrap();
        let through_link = block_on(file_ops::file_create(
            roots.clone(),
            dir.file_string("repo/out-link"),
            "x.ts".to_string(),
            false,
        ));
        assert!(file_error(through_link).ends_with("is outside the workspace"));
        let nested_through_link = block_on(file_ops::file_create(
            roots.clone(),
            dir.file_string("repo"),
            "out-link/x.ts".to_string(),
            false,
        ));
        assert_eq!(file_error(nested_through_link), "out-link is outside the workspace");
    }
    let climbing = block_on(file_ops::file_rename(roots.clone(), dir.file_string("repo/../repo/a.ts"), "b.ts".to_string()));
    assert!(file_error(climbing).starts_with("Invalid path"));
    let relative = block_on(file_ops::file_trash(roots.clone(), vec!["repo/a.ts".to_string()]));
    assert!(file_error(relative).starts_with("Invalid path"));
    let no_workspace = block_on(file_ops::file_trash(Vec::new(), vec![dir.file_string("repo/a.ts")]));
    assert_eq!(file_error(no_workspace), "Open a workspace folder first");

    // Nothing changed, and the link's target was never touched.
    assert!(dir.file("repo/a.ts").is_file());
    assert!(dir.file("holder/nested/n.ts").is_file());
    assert_eq!(child_names(&outside), strings(&["o.ts"]));
}

#[test]
fn file_trash_checks_every_path_and_drops_nested_ones() {
    let dir = TestDir::new();
    let roots = vec![dir.path_string()];
    dir.write("src/a.ts", "a");
    dir.write("src/lib/b.ts", "b");
    dir.write("c.ts", "c");
    dir.write("src-link", "a file named like a link");

    let mut handed: Vec<std::path::PathBuf> = Vec::new();
    crate::file_ops::trash_entries(
        &roots,
        &[
            dir.file_string("src/lib/b.ts"),
            dir.file_string("src"),
            dir.file_string("c.ts"),
            dir.file_string("src-link"),
        ],
        |real_paths| {
            handed = real_paths;
            Ok(())
        },
    )
    .unwrap();
    assert_eq!(handed, vec![dir.file("src"), dir.file("c.ts"), dir.file("src-link")]);

    // One bad path refuses the whole call before anything is handed on.
    let mut called = false;
    let refused = crate::file_ops::trash_entries(&roots, &[dir.file_string("c.ts"), dir.path_string()], |_| {
        called = true;
        Ok(())
    });
    assert_eq!(file_error(refused), "workspace is a workspace folder");
    assert!(!called);
}

/// Puts a small file in the real Trash of the user running the tests, so it only runs on request:
/// `cargo test file_trash_moves_entries_to_the_system_trash -- --ignored`.
#[cfg(unix)]
#[test]
#[ignore = "moves a file to the user's real Trash"]
fn file_trash_moves_entries_to_the_system_trash() {
    let dir = TestDir::new();
    let name = format!("git-manager-trash-test-{}.txt", std::process::id());
    let link = format!("git-manager-trash-link-{}", std::process::id());
    dir.write(&name, "trash me");
    std::os::unix::fs::symlink(&name, dir.file(&link)).unwrap();
    let roots = vec![dir.path_string()];

    // A link goes to the Trash as a link: its target stays.
    block_on(file_ops::file_trash(roots.clone(), vec![dir.file_string(&link)])).unwrap();
    assert!(std::fs::symlink_metadata(dir.file(&link)).is_err());
    assert!(dir.file(&name).is_file());

    block_on(file_ops::file_trash(roots, vec![dir.file_string(&name)])).unwrap();
    assert!(!dir.file(&name).exists());
}
