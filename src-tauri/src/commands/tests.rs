use crate::test_support::UiText;
use std::collections::HashMap;
use std::path::Path;

use super::merge::{self, Side};
use super::{branch, file_ops, files, history, repo as repo_commands, safe_join, stash, status, workspace};
use crate::error::AppError;
use crate::git::conflicts;
use crate::git::diff::DiffArea;
use crate::git::files::FolderListing;
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

    let log = block_on(history::get_log(repo.path_string(), 0, usize::MAX, true, None)).unwrap().commits.unwrap();
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

// Windows has no executable bit (git runs with core.filemode=false there).
#[cfg(unix)]
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

#[cfg(unix)]
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
fn stage_unstage_and_discard_pass_any_number_of_paths_on_stdin() {
    let repo = TestRepo::new();
    repo.write("keep.txt", "keep\n");
    repo.commit_all("first");
    // Long names so the list is far over ARG_MAX (1 MB on macOS, 32 KB on Windows) as arguments.
    // Shorter on Windows, where git refuses paths over 260 characters by default.
    let padding = "p".repeat(if cfg!(windows) { 100 } else { 200 });
    let mut untracked: Vec<String> = (0..6000).map(|index| format!("many/{padding}-{index:05}.txt")).collect();
    for file_path in &untracked {
        repo.write(file_path, "x");
    }
    // Spaces, quotes and a newline reach git unchanged with NUL-separated pathspecs.
    // Windows file names cannot hold `"` or a newline.
    let odd_names: &[&str] = if cfg!(windows) { &["with space.txt", "it's.txt"] } else { &["with space.txt", "quote\"d.txt", "new\nline.txt"] };
    for odd in odd_names {
        repo.write(odd, "odd");
        untracked.push(odd.to_string());
    }
    let arg_max = if cfg!(windows) { 32 * 1024 } else { 1024 * 1024 };
    assert!(untracked.iter().map(|file_path| file_path.len() + 1).sum::<usize>() > arg_max);

    block_on(status::stage_files(repo.path_string(), untracked.clone())).unwrap();
    let staged = repo.git(&["diff", "--cached", "--name-only", "-z"]);
    assert_eq!(staged.split('\0').filter(|name| !name.is_empty()).count(), untracked.len());

    block_on(status::unstage_files(repo.path_string(), untracked.clone())).unwrap();
    assert_eq!(repo.git(&["diff", "--cached", "--name-only"]), "");

    // An empty list never turns into "every file".
    block_on(status::stage_files(repo.path_string(), Vec::new())).unwrap();
    assert_eq!(repo.git(&["diff", "--cached", "--name-only"]), "");

    repo.write("keep.txt", "changed\n");
    block_on(status::discard_files(repo.path_string(), strings(&["keep.txt"]), Vec::new())).unwrap();
    assert_eq!(repo.read_text("keep.txt"), "keep\n");
}

#[test]
fn unstage_many_paths_in_an_unborn_repository() {
    let repo = TestRepo::new();
    let file_paths: Vec<String> = (0..50).map(|index| format!("dir/{index}.txt")).collect();
    for file_path in &file_paths {
        repo.write(file_path, "x");
    }
    repo.git(&["add", "-A"]);
    block_on(status::unstage_files(repo.path_string(), file_paths)).unwrap();
    assert_eq!(repo.porcelain(), "?? dir/\n");
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
    let snapshot = block_on(status::get_status(repo.path_string(), None)).unwrap();
    let status = snapshot.status.unwrap();
    assert_eq!(status.files.len(), 1);
    assert_eq!(status.head.branch.as_deref(), Some("main"));
    let diff_of = |known_version: Option<String>| {
        block_on(status::get_file_diff(repo.path_string(), "a.txt".to_string(), None, DiffArea::Unstaged, known_version))
            .unwrap()
    };
    let diff = diff_of(None).expect("a diff without a known version");
    assert_eq!((diff.original.as_str(), diff.modified.as_str()), ("one\n", "two\n"));
    assert_eq!(diff.hunks, vec![[0, 1, 0, 1]]);
    // The same sides again: nothing is sent.
    assert!(diff_of(diff.version.clone()).is_none());
    repo.write("a.txt", "three\n");
    let changed = diff_of(diff.version.clone()).expect("the work tree changed");
    assert_eq!(changed.modified, "three\n");

    let info = block_on(repo_commands::open_repo(repo.path_string())).unwrap();
    assert_eq!(canonical(Path::new(&info.root)), repo.path);
    assert_eq!(info.relative_path, "");
}

#[test]
fn get_status_answers_unchanged_for_the_hash_the_caller_holds() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\n");
    repo.commit_all("first");
    repo.write("a.txt", "two\n");
    let first = block_on(status::get_status(repo.path_string(), None)).unwrap();
    assert!(first.status.is_some());

    let same = block_on(status::get_status(repo.path_string(), Some(first.hash.clone()))).unwrap();
    assert_eq!(same.hash, first.hash);
    assert!(same.status.is_none());
    // Editing a modified file again does not change what status shows.
    repo.write("a.txt", "three\n");
    assert!(block_on(status::get_status(repo.path_string(), Some(first.hash.clone()))).unwrap().status.is_none());

    // Staging, a new file, a branch switch or a stale hash all send the status again.
    let mut seen = vec![first.hash.clone()];
    let mut expect_new = |label: &str| {
        let next = block_on(status::get_status(repo.path_string(), Some(seen.last().unwrap().clone()))).unwrap();
        assert!(next.status.is_some(), "{label}");
        assert!(!seen.contains(&next.hash), "{label}");
        seen.push(next.hash);
    };
    repo.git(&["add", "a.txt"]);
    expect_new("staged");
    repo.write("b.txt", "new\n");
    expect_new("untracked");
    repo.git(&["switch", "-q", "-c", "other"]);
    expect_new("branch");
    let stale = block_on(status::get_status(repo.path_string(), Some("0".to_string()))).unwrap();
    assert!(stale.status.is_some());
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

// refresh fingerprints

#[test]
fn refs_snapshot_answers_unchanged_until_something_the_sidebar_shows_changes() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.commit_all("first");
    let read = |known: Option<&str>| block_on(branch::get_refs_snapshot(repo.path_string(), known.map(str::to_string))).unwrap();
    let first = read(None);
    assert_eq!(first.refs.as_ref().map(|refs| refs.local.len()), Some(1));
    assert!(read(Some(&first.fingerprint)).refs.is_none());

    // Work tree and index changes leave branches alone.
    repo.write("a.txt", "changed\n");
    repo.write("new.txt", "new\n");
    repo.git(&["add", "new.txt"]);
    let staged = read(Some(&first.fingerprint));
    assert!(staged.refs.is_none());
    assert_eq!(staged.tips, first.tips);

    // Each of these changes the fingerprint; only ref moves change the tips.
    let mut current = first;
    let mut step = |label: &str, change: &dyn Fn(), tips_change: bool| {
        change();
        let next = read(Some(&current.fingerprint));
        assert!(next.refs.is_some(), "{label}");
        assert_eq!(next.tips != current.tips, tips_change, "{label}");
        current = next;
    };
    step("commit", &|| { repo.commit_all("second"); }, true);
    step("branch", &|| repo.branch("topic"), true);
    step("tag", &|| { repo.git(&["tag", "v1"]); }, true);
    step("switch", &|| repo.checkout("topic"), true);
    step("stash", &|| {
        repo.write("a.txt", "stash me\n");
        repo.git(&["stash", "push", "-q"]);
        repo.write("a.txt", "stash me too\n");
        repo.git(&["stash", "push", "-q"]);
    }, false);
    step("drop an older stash", &|| { repo.git(&["stash", "drop", "-q", "stash@{1}"]); }, false);
    step("config", &|| { repo.git(&["config", "remote.origin.url", "https://example.com/x.git"]); }, false);
    let linked = repo.path.parent().unwrap().join("linked").ui();
    step("worktree", &|| { repo.git(&["worktree", "add", "-q", "-b", "linked", &linked]); }, true);
    step("lock", &|| { repo.git(&["worktree", "lock", &linked]); }, false);
}

#[test]
fn get_log_skips_the_walk_while_the_tips_are_unchanged() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.commit_all("first");
    let log = |known: Option<&str>, all_refs: bool| {
        block_on(history::get_log(repo.path_string(), 0, 100, all_refs, known.map(str::to_string))).unwrap()
    };
    let first = log(None, false);
    assert_eq!(first.commits.as_ref().map(Vec::len), Some(1));
    assert!(log(Some(&first.tips), false).commits.is_none());
    // The other walk has its own fingerprint.
    assert!(log(Some(&first.tips), true).commits.is_some());

    repo.write("a.txt", "changed\n");
    repo.git(&["add", "a.txt"]);
    repo.git(&["stash", "push", "-q"]);
    assert!(log(Some(&first.tips), false).commits.is_none(), "index and stash changes keep the log");

    repo.git(&["tag", "v1"]);
    let tagged = log(Some(&first.tips), false);
    assert_eq!(tagged.commits.unwrap()[0].refs.len(), 2, "a new label reloads");
    repo.write("b.txt", "b\n");
    repo.commit_all("second");
    assert_eq!(log(Some(&tagged.tips), false).commits.map(|commits| commits.len()), Some(2));
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
    let deleted_tip = block_on(branch::delete_branch(repo.path_string(), "renamed".to_string(), false)).unwrap();
    assert_eq!(deleted_tip, first, "the deleted tip comes back for Restore");
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

fn list_dirs(
    root_path: &str,
    dir_paths: &[&str],
    repo_roots: &[String],
    known: Option<HashMap<String, String>>,
) -> Vec<FolderListing> {
    block_on(files::list_directories(
        root_path.to_string(),
        strings(dir_paths),
        repo_roots.to_vec(),
        known,
    ))
    .unwrap()
}

fn list_one(root_path: &str, dir_path: &str, repo_roots: &[String]) -> FolderListing {
    let mut listings = list_dirs(root_path, &[dir_path], repo_roots, None);
    assert_eq!(listings.len(), 1);
    let listing = listings.remove(0);
    assert_eq!(listing.error, None, "{dir_path}");
    listing
}

#[test]
fn list_directories_sorts_folders_first_and_marks_ignored_entries() {
    let repo = TestRepo::new();
    repo.write(".gitignore", "target/\n*.log\n");
    repo.write("src/main.rs", "fn main() {}\n");
    repo.write("target/debug/out", "binary");
    repo.write("b.txt", "b\n");
    repo.write("A.md", "a\n");
    repo.write("debug.log", "noise\n");
    let repo_roots = vec![repo.path_string()];

    let root = list_one(&repo.path_string(), "", &repo_roots);
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
    assert!(!root.truncated && !root.unchanged);

    let src = list_one(&repo.path_string(), "src", &repo_roots);
    assert_eq!(src.dir_path, "src");
    assert_eq!(src.entries.len(), 1);
    assert_eq!(src.entries[0].name, "main.rs");
}

#[test]
fn list_directories_refuses_paths_outside_the_work_tree_per_folder() {
    let repo = TestRepo::new();
    repo.write("src/main.rs", "fn main() {}\n");
    let listings = list_dirs(&repo.path_string(), &["../", "src", "gone", "src/main.rs"], &[repo.path_string()], None);
    assert_eq!(listings.len(), 4);
    assert!(listings[0].error.as_deref().is_some_and(|error| error.starts_with("Invalid path")), "{:?}", listings[0]);
    assert_eq!(listings[1].error, None);
    assert_eq!(listings[1].entries.len(), 1);
    assert!(listings[2].error.is_some());
    assert!(listings[3].error.as_deref().is_some_and(|error| error.starts_with("Not a folder")));

    let missing = block_on(files::list_directories(format!("{}/nope", repo.path_string()), strings(&[""]), Vec::new(), None));
    assert!(matches!(missing, Err(AppError::Invalid(_))));
}

#[test]
fn list_directories_answers_unchanged_until_something_the_listing_depends_on_changes() {
    let dir = TestDir::new();
    let parent = dir.init_repo("parent");
    dir.write("parent/src/a.txt", "a\n");
    dir.write("parent/src/.gitignore", "");
    let repo_roots = vec![text(&parent)];
    let root_path = dir.path_string();
    let check = |dir_path: &str, stamp: &str| -> FolderListing {
        let known = HashMap::from([(dir_path.to_string(), stamp.to_string())]);
        list_dirs(&root_path, &[dir_path], &repo_roots, Some(known)).remove(0)
    };

    let first = list_one(&root_path, "parent/src", &repo_roots);
    assert!(!first.unchanged && !first.stamp.is_empty());
    let again = check("parent/src", &first.stamp);
    assert!(again.unchanged && again.entries.is_empty());
    assert_eq!(again.stamp, first.stamp);
    // A stamp for another folder is never taken for this one.
    let other = list_dirs(
        &root_path,
        &["parent/src", "parent"],
        &repo_roots,
        Some(HashMap::from([("parent".to_string(), first.stamp.clone())])),
    );
    assert!(!other[1].unchanged);

    // Each of these changes the listing or its flags, so each must change the stamp.
    let mut stamp = first.stamp.clone();
    let mut expect_change = |what: &str, change: &dyn Fn()| {
        change();
        let next = check("parent/src", &stamp);
        assert!(!next.unchanged, "{what} kept the stamp");
        assert_ne!(next.stamp, stamp, "{what}");
        stamp = next.stamp;
    };
    expect_change("a new entry", &|| dir.write("parent/src/b.log", "b\n"));
    // Edits inside files leave the folder's own time alone: these come from the ignore inputs.
    expect_change("the folder's .gitignore", &|| dir.write("parent/src/.gitignore", "*.log\n"));
    expect_change("the repository's .gitignore", &|| dir.write("parent/.gitignore", "*.txt\n"));
    expect_change("info/exclude", &|| dir.write("parent/.git/info/exclude", "b.*\n"));
    expect_change("a nested repository", &|| {
        dir.init_repo("parent/src/inner");
    });
    let inner = list_dirs(&root_path, &["parent/src"], &[text(&parent), dir.file_string("parent/src/inner")], None);
    assert!(inner[0].entries.iter().any(|entry| entry.name == "inner" && entry.is_repo));
    assert_ne!(inner[0].stamp, stamp, "a repository root showing up");
}

#[test]
fn read_worktree_file_normalizes_crlf_and_detects_binary() {
    let repo = TestRepo::new();
    repo.write("win.txt", "one\r\ntwo\r\n");
    repo.write("image.bin", [0u8, 1, 2, 3]);

    let text = block_on(files::read_worktree_file(repo.path_string(), "win.txt".to_string(), None)).unwrap();
    assert_eq!(text.content, "one\ntwo\n");
    assert_eq!(text.eol, Eol::Crlf);
    assert!(!text.binary);

    let binary = block_on(files::read_worktree_file(repo.path_string(), "image.bin".to_string(), None)).unwrap();
    assert!(binary.binary);
    assert!(binary.content.is_empty());
}

// Workspaces

fn open_workspace(folder: &Path) -> WorkspaceInfo {
    block_on(workspace::open_workspace(folder.ui())).unwrap()
}

/// `(root, relative_path)` of each repository, in order.
fn repo_list(repos: &[RepoInfo]) -> Vec<(String, String)> {
    repos
        .iter()
        .map(|repo| (repo.root.clone(), repo.relative_path.clone()))
        .collect()
}

fn text(path: &Path) -> String {
    path.ui()
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
fn list_directories_uses_the_deepest_repository_for_ignores() {
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
    let dir_paths = ["", "plain", "parent", "parent/child", "parent/child/src"];

    // One call answers every folder, in the order asked.
    let listings = list_dirs(&dir.path_string(), &dir_paths, &repo_roots, None);
    assert_eq!(listings.iter().map(|listing| listing.dir_path.as_str()).collect::<Vec<_>>(), dir_paths);
    let list = |index: usize| -> Vec<(String, bool, bool, bool)> {
        listings[index]
            .entries
            .iter()
            .map(|entry| (entry.name.clone(), entry.is_dir, entry.ignored, entry.is_repo))
            .collect()
    };
    let entry = |name: &str, is_dir: bool, ignored: bool, is_repo: bool| (name.to_string(), is_dir, ignored, is_repo);

    assert_eq!(
        list(0),
        vec![
            entry("parent", true, false, true),
            entry("plain", true, false, false),
            entry("notes.log", false, false, false),
        ]
    );
    assert_eq!(list(1), vec![entry("debug.log", false, false, false)]);
    assert_eq!(
        list(2),
        vec![
            entry("build-out", true, true, false),
            entry("child", true, false, true),
            entry(".gitignore", false, false, false),
            entry("a.log", false, true, false),
        ]
    );
    assert_eq!(list(3), vec![entry("src", true, false, false), entry("b.log", false, false, false)]);
    assert_eq!(list(4), vec![entry("c.log", false, false, false)]);

    // Without repositories nothing is ignored or flagged.
    let bare = list_one(&dir.path_string(), "parent", &[]);
    assert!(bare.entries.iter().all(|entry| !entry.ignored && !entry.is_repo));
}

#[test]
fn worktree_file_commands_work_in_a_plain_folder() {
    let dir = TestDir::new();
    dir.write("docs/a.txt", "a\r\nb\r\n");
    let read = |known_version: Option<String>| {
        block_on(files::read_worktree_file(dir.path_string(), "docs/a.txt".to_string(), known_version)).unwrap()
    };
    let file = read(None);
    assert_eq!((file.content.as_str(), file.eol), ("a\nb\n", Eol::Crlf));
    assert!(!file.unchanged);
    // Asked again with its version, the file answers unchanged and sends no text.
    let again = read(Some(file.version.clone()));
    assert!(again.unchanged);
    assert_eq!(again.content, "");

    let written = block_on(status::write_worktree_file(
        dir.path_string(),
        "docs/a.txt".to_string(),
        "x\n".to_string(),
        Eol::Crlf,
    ))
    .unwrap();
    assert_eq!(std::fs::read_to_string(dir.file("docs/a.txt")).unwrap(), "x\r\n");
    // Save returns the new version, so the editor's next refresh reads nothing.
    assert_ne!(written, file.version);
    assert!(read(Some(written.clone())).unchanged);
    // A change from outside the app, even of the same size, is a new version. The pause keeps
    // the two writes in different clock ticks on file systems with coarse timestamps.
    std::thread::sleep(std::time::Duration::from_millis(20));
    std::fs::write(dir.file("docs/a.txt"), "y\r\n").unwrap();
    let outside = read(Some(written));
    assert!(!outside.unchanged);
    assert_eq!(outside.content, "y\n");
}

// File operations (file_create, file_rename, file_copy, file_move, file_trash)

fn file_error<T: std::fmt::Debug>(result: crate::error::AppResult<T>) -> String {
    result.expect_err("expected an error").to_string()
}

async fn move_files(
    workspace_roots: Vec<String>,
    source_paths: Vec<String>,
    target_dir: String,
) -> crate::error::AppResult<Vec<crate::file_ops::FileMove>> {
    match file_ops::file_move(workspace_roots, source_paths, target_dir, None).await? {
        file_ops::MoveAnswer::Moved(moved) => Ok(moved),
        other => panic!("not a move: {other:?}"),
    }
}

fn move_clash(workspace_roots: &[String], source_paths: Vec<String>, target_dir: String) -> crate::error::AppResult<Option<String>> {
    match block_on(file_ops::file_move(workspace_roots.to_vec(), source_paths, target_dir, Some(true)))? {
        file_ops::MoveAnswer::Clash(clash) => Ok(clash),
        other => panic!("not a dry run: {other:?}"),
    }
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

    // An existing folder in the name is reused; a new folder can be nested too. Empty parts are
    // refused, as the dialog refuses them.
    let trailing = block_on(file_ops::file_create(roots.clone(), dir.path_string(), "src/lib/util/".to_string(), true));
    assert_eq!(file_error(trailing), "Each part between slashes needs a name");
    let doubled = block_on(file_ops::file_create(roots.clone(), dir.path_string(), "src//util".to_string(), true));
    assert_eq!(file_error(doubled), "Each part between slashes needs a name");
    let folder = block_on(file_ops::file_create(roots.clone(), dir.path_string(), "src/lib/util".to_string(), true))
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
    let conflict = block_on(move_files(
        roots.clone(),
        vec![dir.file_string("a/cart.ts"), dir.file_string("a/lib")],
        dir.file_string("b"),
    ));
    assert_eq!(file_error(conflict), "lib already exists in b");
    assert!(dir.file("a/cart.ts").is_file());

    // A dry run names the clash, gives other refusals as errors and moves nothing.
    let sources = vec![dir.file_string("a/cart.ts"), dir.file_string("a/lib")];
    assert_eq!(move_clash(&roots, sources.clone(), dir.file_string("b")).unwrap().as_deref(), Some("lib"));
    assert_eq!(move_clash(&roots, sources.clone(), dir.file_string("c")).unwrap(), None);
    let dry_into_itself = move_clash(&roots, vec![dir.file_string("a")], dir.file_string("a/lib"));
    assert_eq!(file_error(dry_into_itself), "Cannot move a into itself");
    assert!(dir.file("a/cart.ts").is_file() && dir.file("a/lib/x.ts").is_file());
    assert_eq!(child_names(&dir.file("c")), Vec::<String>::new());
    let as_json = |answer: file_ops::MoveAnswer| serde_json::to_string(&answer).unwrap();
    assert_eq!(as_json(file_ops::MoveAnswer::Clash(None)), "null");
    assert_eq!(as_json(file_ops::MoveAnswer::Clash(Some("lib".to_string()))), "\"lib\"");
    assert_eq!(as_json(file_ops::MoveAnswer::Moved(Vec::new())), "[]");

    let into_itself = block_on(move_files(roots.clone(), vec![dir.file_string("a")], dir.file_string("a/lib")));
    assert_eq!(file_error(into_itself), "Cannot move a into itself");

    // Already in the target: skipped. A file inside a moved folder goes with it.
    let moved = block_on(move_files(
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

    let moved = block_on(move_files(
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

    let no_op = block_on(move_files(roots, vec![dir.file_string("c/cart.ts")], dir.file_string("c"))).unwrap();
    assert!(no_op.is_empty());
    assert!(dir.file("c/cart.ts").is_file());
}

#[test]
fn file_move_works_across_the_folders_of_a_two_folder_workspace() {
    let dir = TestDir::new();
    dir.write("one/src/cart.ts", "cart");
    dir.write("two/readme.md", "readme");
    let roots = vec![dir.file_string("one"), dir.file_string("two")];

    let moved = block_on(move_files(roots.clone(), vec![dir.file_string("one/src")], dir.file_string("two")))
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
    let outside_dir = outside.ui();
    let outside_file = outside.join("o.ts").ui();

    let rename_root = block_on(file_ops::file_rename(roots.clone(), dir.path_string(), "x".to_string()));
    assert_eq!(file_error(rename_root), "workspace is a workspace folder");
    let trash_root = block_on(file_ops::file_trash(roots.clone(), vec![dir.file_string("holder/nested")]));
    assert_eq!(file_error(trash_root), "nested is a workspace folder");
    let move_holder =
        block_on(move_files(roots.clone(), vec![dir.file_string("holder")], dir.file_string("repo")));
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
        block_on(move_files(roots.clone(), vec![dir.file_string("repo/a.ts")], outside_dir.clone()));
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

#[test]
fn real_files_name_files_the_way_the_disk_does() {
    let dir = TestDir::new();
    let roots = vec![dir.path_string()];
    dir.write("src/App.ts", "a");
    let asked = vec![dir.file_string("src/App.ts"), dir.file_string("src/../src/App.ts"), dir.file_string("src/missing.ts")];
    let answers = block_on(file_ops::real_files(roots.clone(), asked)).unwrap();
    assert_eq!(answers, vec![Some(dir.file_string("src/App.ts")), None, None]);

    // Other letter case: the same file where the disk ignores case (Windows, macOS), with its own name.
    let other_case = dir.file_string("SRC/app.TS");
    let real = block_on(file_ops::real_files(roots, vec![other_case.clone()])).unwrap();
    if std::path::Path::new(&other_case).is_file() {
        let found = real[0].clone().expect("the file, under any case");
        assert!(found.eq_ignore_ascii_case(&dir.file_string("src/App.ts")), "{found}");
        if cfg!(windows) {
            assert_eq!(found, dir.file_string("src/App.ts"), "Windows reports the name as stored");
        }
    } else {
        assert_eq!(real, vec![None], "a case-sensitive disk has no such file");
    }
}

#[test]
fn files_exist_reports_only_files_inside_the_workspace() {
    let dir = TestDir::new();
    let roots = vec![dir.path_string()];
    dir.write("src/a.ts", "a");
    dir.write(".git/config", "[core]");
    dir.mkdir("src/lib");
    // Beside the workspace folder, in the same temporary folder.
    let outside = dir.path.parent().unwrap().join("o.ts");
    std::fs::write(&outside, "o").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, dir.file("out-link.ts")).unwrap();

    let asked = vec![
        dir.file_string("src/a.ts"),
        dir.file_string("src/missing.ts"),
        dir.file_string("src/lib"),
        dir.file_string(".git/config"),
        outside.ui(),
        dir.file_string("out-link.ts"),
        "src/a.ts".to_string(),
        dir.file_string("src/../src/a.ts"),
    ];
    let answers = block_on(file_ops::files_exist(roots.clone(), asked)).unwrap();
    assert_eq!(answers, vec![true, false, false, false, false, false, false, false]);

    // No workspace: nothing exists, and the call still succeeds.
    let none = block_on(file_ops::files_exist(Vec::new(), vec![dir.file_string("src/a.ts")])).unwrap();
    assert_eq!(none, vec![false]);

    // Past the limit nothing is looked at.
    let many = vec![dir.file_string("src/a.ts"); crate::file_ops::MAX_EXISTS_CHECKS + 2];
    let answers = block_on(file_ops::files_exist(roots, many)).unwrap();
    assert_eq!(answers.iter().filter(|exists| **exists).count(), crate::file_ops::MAX_EXISTS_CHECKS);
    assert!(!answers[crate::file_ops::MAX_EXISTS_CHECKS]);
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
