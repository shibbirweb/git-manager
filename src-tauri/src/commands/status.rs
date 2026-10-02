use std::path::Path;

use super::commit_options::CommitOptions;
use super::{blocking, safe_join, with_paths};
use crate::error::{AppError, AppResult};
use crate::git::cli::{self, GitOutput};
use crate::git::diff::{self, DiffArea, FileDiff};
use crate::git::repo as git_repo;
use crate::git::status::{self, RepoStatus};
use crate::merge::model::Eol;

#[tauri::command]
pub async fn get_status(repo_path: String) -> AppResult<RepoStatus> {
    blocking(move || status::read(&git_repo::open(&repo_path)?)).await
}

#[tauri::command]
pub async fn get_file_diff(
    repo_path: String,
    file_path: String,
    orig_path: Option<String>,
    area: DiffArea,
) -> AppResult<FileDiff> {
    blocking(move || {
        let repo = git_repo::open(&repo_path)?;
        diff::working_file(&repo, &file_path, orig_path.as_deref(), area)
    })
    .await
}

#[tauri::command]
pub async fn stage_files(repo_path: String, file_paths: Vec<String>) -> AppResult<()> {
    blocking(move || {
        cli::run(Path::new(&repo_path), &with_paths(&["add", "-A"], &file_paths))?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn unstage_files(repo_path: String, file_paths: Vec<String>) -> AppResult<()> {
    blocking(move || {
        let repo = git_repo::open(&repo_path)?;
        let root = Path::new(&repo_path);
        if repo.head().is_ok() {
            cli::run(root, &with_paths(&["restore", "--staged"], &file_paths))?;
        } else {
            // No HEAD to restore from in a fresh repository.
            cli::run(root, &with_paths(&["rm", "--cached", "-r", "-q"], &file_paths))?;
        }
        Ok(())
    })
    .await
}

/// Discards unstaged changes: tracked files are restored from the index,
/// untracked files are deleted.
#[tauri::command]
pub async fn discard_files(repo_path: String, tracked_paths: Vec<String>, untracked_paths: Vec<String>) -> AppResult<()> {
    blocking(move || {
        if !tracked_paths.is_empty() {
            cli::run(Path::new(&repo_path), &with_paths(&["restore", "--worktree"], &tracked_paths))?;
        }
        for untracked_path in &untracked_paths {
            let full = safe_join(&repo_path, untracked_path)?;
            if full.is_dir() {
                std::fs::remove_dir_all(&full)?;
            } else if full.exists() {
                std::fs::remove_file(&full)?;
            }
        }
        Ok(())
    })
    .await
}

/// Writes `content` straight into the index for `file_path` (hunk staging).
#[tauri::command]
pub async fn stage_content(repo_path: String, file_path: String, content: String, eol: Eol) -> AppResult<()> {
    blocking(move || {
        safe_join(&repo_path, &file_path)?;
        let root = Path::new(&repo_path);
        let repo = git_repo::open(&repo_path)?;
        let mode = repo
            .index()?
            .get_path(Path::new(&file_path), 0)
            .map(|entry| entry.mode)
            .unwrap_or(0o100644);
        let body = eol.apply(&content);
        // stdin without --path hashes the bytes as-is (no filters), matching index content.
        let hashed = cli::run_with_stdin(root, &["hash-object", "-w", "--stdin"], body.as_bytes())?;
        let object_id = hashed.stdout.trim().to_string();
        let cache_info = format!("{mode:o},{object_id},{file_path}");
        cli::run(root, &["update-index", "--add", "--cacheinfo", &cache_info])?;
        Ok(())
    })
    .await
}

/// Overwrites a work tree file (used to discard a single hunk).
#[tauri::command]
pub async fn write_worktree_file(repo_path: String, file_path: String, content: String, eol: Eol) -> AppResult<()> {
    blocking(move || {
        let full = safe_join(&repo_path, &file_path)?;
        std::fs::write(full, eol.apply(&content))?;
        Ok(())
    })
    .await
}

/// `git commit`, amending HEAD when asked; `all` first stages every tracked change (`-a`).
fn run_commit(repo_path: &str, message: &str, amend: bool, all: bool, options: &CommitOptions) -> AppResult<GitOutput> {
    let root = Path::new(repo_path);
    let extra = options.args()?;
    let mut args = vec!["commit"];
    args.extend(extra.iter().map(String::as_str));
    if all {
        args.push("--all");
    }
    if amend {
        args.push("--amend");
    }
    if message.trim().is_empty() && amend {
        args.push("--no-edit");
        cli::run(root, &args)
    } else {
        args.extend(["-F", "-"]);
        cli::run_with_stdin(root, &args, message.as_bytes())
    }
}

#[tauri::command]
pub async fn commit(
    repo_path: String,
    message: String,
    amend: bool,
    options: Option<CommitOptions>,
) -> AppResult<GitOutput> {
    blocking(move || run_commit(&repo_path, &message, amend, false, &options.unwrap_or_default())).await
}

/// VS Code's Commit All: stages every tracked change, then commits. Untracked files stay out.
#[tauri::command]
pub async fn commit_all(
    repo_path: String,
    message: String,
    amend: bool,
    options: Option<CommitOptions>,
) -> AppResult<GitOutput> {
    blocking(move || run_commit(&repo_path, &message, amend, true, &options.unwrap_or_default())).await
}

/// Undoes the last commit with `git reset --soft HEAD~1`, keeping its changes
/// staged, and returns its message so the commit box can offer it again.
#[tauri::command]
pub async fn undo_last_commit(repo_path: String) -> AppResult<String> {
    blocking(move || {
        let message = {
            let repo = git_repo::open(&repo_path)?;
            let head = repo
                .head()
                .ok()
                .and_then(|head| head.peel_to_commit().ok())
                .ok_or_else(|| AppError::invalid("There is no commit to undo"))?;
            if head.parent_count() == 0 {
                return Err(AppError::invalid("The first commit has no parent, so it cannot be undone"));
            }
            head.message().ok().map(str::to_string).unwrap_or_default()
        };
        cli::run(Path::new(&repo_path), &["reset", "--soft", "HEAD~1"])?;
        Ok(message)
    })
    .await
}

/// Commits only `file_paths` with their work tree content (`git commit --only`),
/// staging them first so new files are included; other staged changes stay staged.
fn run_commit_files(
    repo_path: &str,
    file_paths: &[String],
    message: &str,
    amend: bool,
    options: &CommitOptions,
) -> AppResult<GitOutput> {
    let extra = options.args()?;
    if file_paths.is_empty() {
        return Err(AppError::invalid("Choose the files to commit"));
    }
    for file_path in file_paths {
        safe_join(repo_path, file_path)?;
    }
    let empty_message = message.trim().is_empty();
    if empty_message && !amend {
        return Err(AppError::invalid("Write a commit message first"));
    }
    let root = Path::new(repo_path);
    cli::run(root, &with_paths(&["add", "-A"], file_paths))?;
    let mut args = vec!["commit", "--only"];
    args.extend(extra.iter().map(String::as_str));
    if amend {
        args.push("--amend");
    }
    if empty_message {
        args.push("--no-edit");
        cli::run(root, &with_paths(&args, file_paths))
    } else {
        args.extend(["-F", "-"]);
        cli::run_with_stdin(root, &with_paths(&args, file_paths), message.as_bytes())
    }
}

#[tauri::command]
pub async fn commit_files(
    repo_path: String,
    file_paths: Vec<String>,
    message: String,
    amend: bool,
    options: Option<CommitOptions>,
) -> AppResult<GitOutput> {
    blocking(move || run_commit_files(&repo_path, &file_paths, &message, amend, &options.unwrap_or_default())).await
}

/// JetBrains' Rollback: files in HEAD get their HEAD version back in the index and
/// the work tree; files only in the index (added) are unstaged, and deleted from
/// disk when `delete_added`. Untracked files are left alone.
fn run_rollback(repo_path: &str, file_paths: &[String], delete_added: bool) -> AppResult<()> {
    let mut in_head = Vec::new();
    let mut added = Vec::new();
    {
        let repo = git_repo::open(repo_path)?;
        let head_tree = repo.head().ok().and_then(|head| head.peel_to_tree().ok());
        let index = repo.index()?;
        for file_path in file_paths {
            safe_join(repo_path, file_path)?;
            let relative = Path::new(file_path);
            let tracked_in_head = head_tree
                .as_ref()
                .is_some_and(|tree| tree.get_path(relative).is_ok());
            if tracked_in_head {
                in_head.push(file_path.clone());
            } else if index.get_path(relative, 0).is_some() {
                added.push(file_path.clone());
            }
        }
    }
    let root = Path::new(repo_path);
    if !in_head.is_empty() {
        cli::run(root, &with_paths(&["restore", "--source=HEAD", "--staged", "--worktree"], &in_head))?;
    }
    if !added.is_empty() {
        cli::run(root, &with_paths(&["rm", "--cached", "-q", "-f", "--ignore-unmatch"], &added))?;
        if delete_added {
            for added_path in &added {
                let full = safe_join(repo_path, added_path)?;
                if full.is_file() || full.is_symlink() {
                    std::fs::remove_file(&full)?;
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn rollback_files(repo_path: String, file_paths: Vec<String>, delete_added: bool) -> AppResult<()> {
    blocking(move || run_rollback(&repo_path, &file_paths, delete_added)).await
}

#[tauri::command]
pub async fn get_head_message(repo_path: String) -> AppResult<String> {
    blocking(move || {
        let repo = git_repo::open(&repo_path)?;
        let message = repo
            .head()
            .ok()
            .and_then(|head| head.peel_to_commit().ok())
            .and_then(|commit| commit.message().ok().map(str::to_string))
            .unwrap_or_default();
        Ok(message)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::TestRepo;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn none() -> CommitOptions {
        CommitOptions::default()
    }

    fn staged_names(repo: &TestRepo) -> String {
        repo.git(&["diff", "--cached", "--name-only"])
    }

    #[test]
    fn commit_files_commits_only_those_files() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a\n");
        repo.write("b.txt", "b\n");
        repo.commit_all("base");
        repo.write("a.txt", "a changed\n");
        repo.write("b.txt", "b changed\n");
        repo.git(&["add", "b.txt"]);
        repo.write("new.txt", "new\n");

        run_commit_files(&repo.path_string(), &strings(&["a.txt", "new.txt"]), "only a and new\n", false, &none()).unwrap();
        let committed = repo.git(&["show", "--name-only", "--format=%s", "HEAD"]);
        assert!(committed.starts_with("only a and new"));
        assert!(committed.contains("a.txt") && committed.contains("new.txt"));
        assert!(!committed.contains("b.txt"));
        assert_eq!(staged_names(&repo).trim(), "b.txt", "other staged changes stay staged");

        assert!(matches!(
            run_commit_files(&repo.path_string(), &strings(&["a.txt"]), "  ", false, &none()),
            Err(AppError::Invalid(_))
        ));
        assert!(run_commit_files(&repo.path_string(), &strings(&["../x"]), "m", false, &none()).is_err());
    }

    fn failing_pre_commit_hook(repo: &TestRepo) {
        let hook = repo.path.parent().expect("repo parent").join("hooks/pre-commit");
        std::fs::write(&hook, "#!/bin/sh\necho blocked by hook >&2\nexit 1\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
    }

    #[test]
    fn commit_options_sign_off_set_the_author_and_skip_hooks() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a\n");
        repo.commit_all("base");
        failing_pre_commit_hook(&repo);

        repo.write("a.txt", "a2\n");
        repo.git(&["add", "a.txt"]);
        let blocked = run_commit(&repo.path_string(), "hooked\n", false, false, &none());
        assert!(blocked.unwrap_err().to_string().contains("blocked by hook"));

        let options = CommitOptions {
            sign_off: true,
            author: Some("Ann Lee <ann@example.com>".to_string()),
            gpg_sign: super::super::commit_options::GpgSign::NoSign,
            no_verify: true,
        };
        run_commit(&repo.path_string(), "with options\n", false, false, &options).unwrap();
        let message = repo.head_message();
        assert!(message.starts_with("with options"));
        assert!(message.contains("Signed-off-by: Test User <test@example.com>"), "{message}");
        assert_eq!(repo.git(&["log", "-1", "--format=%an <%ae>"]).trim(), "Ann Lee <ann@example.com>");
        assert_eq!(repo.git(&["log", "-1", "--format=%cn"]).trim(), "Test User", "the committer stays");

        repo.write("a.txt", "a3\n");
        repo.write("b.txt", "b\n");
        let skip = CommitOptions {
            no_verify: true,
            ..none()
        };
        run_commit_files(&repo.path_string(), &strings(&["b.txt"]), "only b\n", false, &skip).unwrap();
        run_commit(&repo.path_string(), "all\n", false, true, &skip).unwrap();
        assert_eq!(repo.head_message().trim(), "all");
        assert_eq!(repo.porcelain().trim(), "");

        let bad = CommitOptions {
            author: Some("nobody".to_string()),
            ..none()
        };
        repo.write("c.txt", "c\n");
        let refused = run_commit_files(&repo.path_string(), &strings(&["c.txt"]), "c\n", false, &bad);
        assert!(matches!(refused, Err(AppError::Invalid(_))));
        assert!(repo.porcelain().contains("?? c.txt"), "a refused commit stages nothing");
    }

    #[test]
    fn commit_files_can_amend_with_the_same_message() {
        let repo = TestRepo::new();
        repo.write("a.txt", "a\n");
        repo.commit_all("base");
        repo.write("a.txt", "a2\n");
        run_commit_files(&repo.path_string(), &strings(&["a.txt"]), "", true, &none()).unwrap();
        assert_eq!(repo.head_message().trim(), "base");
        assert_eq!(repo.git(&["rev-list", "--count", "HEAD"]).trim(), "1");
        assert_eq!(repo.git(&["show", "HEAD:a.txt"]), "a2\n");
    }

    #[test]
    fn rollback_restores_head_and_unstages_added_files() {
        let repo = TestRepo::new();
        repo.write("modified.txt", "base\n");
        repo.write("staged.txt", "base\n");
        repo.write("old.txt", "renamed\n");
        repo.commit_all("base");
        repo.write("modified.txt", "changed\n");
        repo.write("staged.txt", "staged\n");
        repo.git(&["add", "staged.txt"]);
        repo.write("staged.txt", "staged and more\n");
        repo.write("added.txt", "added\n");
        repo.write("kept.txt", "kept\n");
        repo.git(&["add", "added.txt", "kept.txt"]);
        repo.git(&["mv", "old.txt", "new.txt"]);
        repo.write("untracked.txt", "untracked\n");

        let paths = strings(&["modified.txt", "staged.txt", "added.txt", "old.txt", "new.txt", "untracked.txt"]);
        run_rollback(&repo.path_string(), &paths, true).unwrap();
        assert_eq!(repo.read_text("modified.txt"), "base\n");
        assert_eq!(repo.read_text("staged.txt"), "base\n");
        assert_eq!(repo.read_text("old.txt"), "renamed\n");
        assert!(!repo.exists("added.txt"), "added files are deleted when asked");
        assert!(!repo.exists("new.txt"));
        assert!(repo.exists("untracked.txt"), "untracked files are left alone");
        assert_eq!(staged_names(&repo).trim(), "kept.txt");

        run_rollback(&repo.path_string(), &strings(&["kept.txt"]), false).unwrap();
        assert!(repo.exists("kept.txt"), "without delete the file stays on disk");
        assert_eq!(staged_names(&repo).trim(), "");
        assert!(repo.porcelain().contains("?? kept.txt"));
    }

    #[test]
    fn rollback_in_a_repository_without_commits_unstages_everything() {
        let repo = TestRepo::new();
        repo.write("first.txt", "first\n");
        repo.git(&["add", "first.txt"]);
        run_rollback(&repo.path_string(), &strings(&["first.txt"]), false).unwrap();
        assert!(repo.exists("first.txt"));
        assert!(repo.porcelain().contains("?? first.txt"));
    }
}
