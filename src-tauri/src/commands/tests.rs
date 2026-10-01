use std::path::Path;

use super::merge::{self, Side};
use super::{branch, files, history, repo as repo_commands, safe_join, stash, status, workspace};
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
    let invalid = block_on(history::reset_to(repo.path_string(), first.clone(), "keep".to_string()));
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
    block_on(status::commit(repo.path_string(), message.to_string(), false)).unwrap();
    assert_eq!(repo.head_message(), message.to_string() + "\n");
    assert_eq!(block_on(status::get_head_message(repo.path_string())).unwrap(), message);
    let first = repo.head();

    repo.write("b.txt", "b\n");
    repo.git(&["add", "b.txt"]);
    block_on(status::commit(repo.path_string(), "Reworded\n".to_string(), true)).unwrap();
    assert_ne!(repo.head(), first);
    assert_eq!(repo.parent_count("HEAD"), 0);
    assert_eq!(repo.head_message().trim_end(), "Reworded");

    repo.write("c.txt", "c\n");
    repo.git(&["add", "c.txt"]);
    block_on(status::commit(repo.path_string(), "  \n".to_string(), true)).unwrap();
    assert_eq!(repo.head_message().trim_end(), "Reworded");
    assert_eq!(repo.git(&["rev-list", "--count", "HEAD"]).trim(), "1");
    assert_eq!(repo.git(&["ls-tree", "--name-only", "HEAD"]), "a.txt\nb.txt\nc.txt\n");

    let empty = block_on(status::commit(repo.path_string(), "".to_string(), false));
    assert!(empty.is_err(), "empty non-amend commit must fail: {empty:?}");
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
