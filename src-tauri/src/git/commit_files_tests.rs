use super::commit_files::ChangedFile;
use super::{diff, log};
use crate::error::AppError;
use crate::test_support::*;

fn paths(files: &[ChangedFile]) -> Vec<&str> {
    files.iter().map(|file| file.path.as_str()).collect()
}

/// main and feature both start from a.txt, b.txt and c.txt; `feature_text` is feature's a.txt.
fn diverged(main_text: &str, feature_text: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\ntwo\nthree\n");
    repo.write("b.txt", "b\n");
    repo.write("c.txt", "c\n");
    repo.commit_all("base");
    repo.branch("feature");
    repo.write("a.txt", main_text);
    repo.write("b.txt", "b main\n");
    repo.commit_all("main side");
    repo.checkout("feature");
    repo.write("a.txt", feature_text);
    repo.write("c.txt", "c feature\n");
    repo.commit_all("feature side");
    repo.checkout("main");
    repo
}

#[test]
fn merge_lists_files_that_differ_from_every_parent() {
    let repo = diverged("one\ntwo\nTHREE\n", "ONE\ntwo\nthree\n");
    repo.git(&["merge", "-q", "--no-edit", "feature"]);
    let merge = repo.head();

    let details = log::details(&repo.open(), &merge).unwrap();
    assert_eq!(details.parents.len(), 2);
    assert_eq!(paths(&details.files), ["a.txt", "c.txt"]);
    assert_eq!(details.later_parent_files.len(), 1);
    assert_eq!(paths(&details.later_parent_files[0]), ["a.txt", "b.txt"]);
    // Both sides changed a.txt, so the merge combined it; b.txt and c.txt came whole from one side.
    assert_eq!(paths(&details.merged_files), ["a.txt"]);
    assert_eq!(details.merged_files[0].status, "modified");
}

#[test]
fn resolved_conflict_is_a_merged_file() {
    let repo = diverged("one\ntwo\nmain\n", "one\ntwo\nfeature\n");
    repo.merge_expecting_conflict("feature");
    repo.write("a.txt", "one\ntwo\nmain and feature\n");
    repo.git(&["add", "a.txt"]);
    repo.git(&["commit", "-q", "--no-edit"]);

    let details = log::details(&repo.open(), &repo.head()).unwrap();
    assert_eq!(paths(&details.merged_files), ["a.txt"]);
}

#[test]
fn merge_taking_one_side_has_no_merged_files() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\n");
    repo.commit_all("base");
    repo.branch("feature");
    repo.write("b.txt", "main\n");
    repo.commit_all("main side");
    repo.checkout("feature");
    repo.write("a.txt", "two\n");
    repo.commit_all("feature side");
    repo.checkout("main");
    repo.git(&["merge", "-q", "--no-edit", "feature"]);

    let details = log::details(&repo.open(), &repo.head()).unwrap();
    assert_eq!(paths(&details.files), ["a.txt"]);
    assert_eq!(paths(&details.later_parent_files[0]), ["b.txt"]);
    assert!(details.merged_files.is_empty());
}

#[test]
fn single_parent_commit_has_no_merge_lists() {
    let repo = TestRepo::new();
    repo.write("a.txt", "one\n");
    let root = repo.commit_all("root");
    repo.write("a.txt", "two\n");
    let second = repo.commit_all("second");

    for commit_id in [root, second] {
        let details = log::details(&repo.open(), &commit_id).unwrap();
        assert_eq!(paths(&details.files), ["a.txt"]);
        assert!(details.later_parent_files.is_empty() && details.merged_files.is_empty());
    }
}

#[test]
fn commit_file_diffs_against_the_chosen_parent() {
    let repo = diverged("one\ntwo\nTHREE\n", "ONE\ntwo\nthree\n");
    repo.git(&["merge", "-q", "--no-edit", "feature"]);
    let merge = repo.head();
    let git_repo = repo.open();

    let first = diff::commit_file(&git_repo, &merge, "a.txt", None, 0).unwrap();
    assert_eq!((first.original.as_str(), first.modified.as_str()), ("one\ntwo\nTHREE\n", "ONE\ntwo\nTHREE\n"));
    let second = diff::commit_file(&git_repo, &merge, "a.txt", None, 1).unwrap();
    assert_eq!(second.original, "ONE\ntwo\nthree\n");

    let missing = diff::commit_file(&git_repo, &merge, "a.txt", None, 2);
    assert!(matches!(missing, Err(AppError::Invalid(_))), "{missing:?}");
}
