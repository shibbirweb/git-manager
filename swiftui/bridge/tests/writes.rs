//! Stage, unstage, commit and Undo through gm_call over real temporary repositories. Its own test binary (own
//! process), so the sandbox below can point git at an empty global config before any test runs git.

use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use serde_json::{json, Value};

/// Isolates every git the bridge starts from the user's own config (hooks, signing, identity), like
/// src-tauri/src/test_support.rs does.
fn sandbox() -> &'static PathBuf {
    static HOME: OnceLock<PathBuf> = OnceLock::new();
    HOME.get_or_init(|| {
        let home = std::env::temp_dir().join(format!("gm-bridge-writes-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(&home).unwrap();
        let config = home.join("gitconfig");
        let identity = "[user]\n\tname = Bridge Test\n\temail = bridge@example.com\n[commit]\n\tgpgsign = false\n";
        std::fs::write(&config, identity).unwrap();
        std::env::set_var("HOME", &home);
        std::env::set_var("XDG_CONFIG_HOME", home.join(".config"));
        std::env::set_var("GIT_CONFIG_NOSYSTEM", "1");
        std::env::set_var("GIT_CONFIG_GLOBAL", &config);
        std::env::set_var("LC_ALL", "C");
        home
    })
}

fn git(repo: &Path, args: &[&str]) -> String {
    sandbox();
    let output = Command::new("git").args(args).current_dir(repo).output().unwrap();
    assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
    String::from_utf8_lossy(&output.stdout).into_owned()
}

/// One commit with a.txt, then a.txt changed and b.txt new.
fn repository(name: &str) -> PathBuf {
    let repo = sandbox().join(name);
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q", "-b", "main"]);
    std::fs::write(repo.join("a.txt"), "one\n").unwrap();
    git(&repo, &["add", "a.txt"]);
    git(&repo, &["commit", "-q", "-m", "first"]);
    std::fs::write(repo.join("a.txt"), "two\n").unwrap();
    std::fs::write(repo.join("b.txt"), "new\n").unwrap();
    repo
}

fn call(command: &str, args: Value) -> Value {
    sandbox();
    let command = CString::new(command).unwrap();
    let args = CString::new(args.to_string()).unwrap();
    // SAFETY: NUL-terminated strings in, and the reply is freed once.
    unsafe {
        let reply = gm_bridge::gm_call(command.as_ptr(), args.as_ptr());
        assert!(!reply.is_null());
        let text = CStr::from_ptr(reply).to_string_lossy().into_owned();
        gm_bridge::gm_free_string(reply);
        serde_json::from_str(&text).unwrap()
    }
}

fn ok(reply: Value) -> Value {
    assert_eq!(reply["ok"], true, "{reply}");
    reply["value"].clone()
}

/// Each changed file as (path, staged, unstaged), sorted.
fn changes(repo: &Path) -> Vec<(String, String, String)> {
    let status = ok(call("get_status", json!({ "repoPath": repo })));
    let text = |value: &Value| value.as_str().unwrap_or("").to_string();
    let mut files: Vec<_> = status["status"]["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|file| (text(&file["path"]), text(&file["staged"]), text(&file["unstaged"])))
        .collect();
    files.sort();
    files
}

fn change(path: &str, staged: &str, unstaged: &str) -> (String, String, String) {
    (path.to_string(), staged.to_string(), unstaged.to_string())
}

#[test]
fn stage_and_unstage_move_files_between_the_groups() {
    let repo = repository("stage");
    let staged = call("stage_files", json!({ "repoPath": repo, "filePaths": ["a.txt", "b.txt"] }));
    assert_eq!(ok(staged), Value::Null);
    assert_eq!(changes(&repo), [change("a.txt", "modified", ""), change("b.txt", "added", "")]);

    ok(call("unstage_files", json!({ "repoPath": repo, "filePaths": ["b.txt"] })));
    assert_eq!(changes(&repo), [change("a.txt", "modified", ""), change("b.txt", "", "untracked")]);

    // A deleted file stages as a deletion.
    std::fs::remove_file(repo.join("a.txt")).unwrap();
    ok(call("stage_files", json!({ "repoPath": repo, "filePaths": ["a.txt"] })));
    assert_eq!(changes(&repo)[0], change("a.txt", "deleted", ""));
}

#[test]
fn unstage_works_before_the_first_commit() {
    let repo = sandbox().join("unborn");
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q", "-b", "main"]);
    std::fs::write(repo.join("new.txt"), "new\n").unwrap();
    ok(call("stage_files", json!({ "repoPath": repo, "filePaths": ["new.txt"] })));
    assert_eq!(changes(&repo), [change("new.txt", "added", "")]);
    ok(call("unstage_files", json!({ "repoPath": repo, "filePaths": ["new.txt"] })));
    assert_eq!(changes(&repo), [change("new.txt", "", "untracked")]);
}

#[test]
fn commit_amend_and_undo() {
    let repo = repository("commit");
    ok(call("stage_files", json!({ "repoPath": repo, "filePaths": ["a.txt"] })));
    let output = ok(call("commit", json!({ "repoPath": repo, "message": "Second\n\nBody", "amend": false })));
    assert_eq!(output["success"], true);
    assert_eq!(git(&repo, &["log", "-1", "--format=%B"]).trim_end(), "Second\n\nBody");
    assert_eq!(ok(call("get_head_message", json!({ "repoPath": repo }))), "Second\n\nBody\n");
    assert_eq!(changes(&repo), [change("b.txt", "", "untracked")]);

    // Amend with an empty message keeps the old one and takes the newly staged file.
    ok(call("stage_files", json!({ "repoPath": repo, "filePaths": ["b.txt"] })));
    ok(call("commit", json!({ "repoPath": repo, "message": " ", "amend": true, "options": null })));
    assert_eq!(git(&repo, &["log", "-1", "--format=%s"]).trim(), "Second");
    assert_eq!(git(&repo, &["rev-list", "--count", "HEAD"]).trim(), "2");
    assert!(changes(&repo).is_empty());

    // Commit All takes tracked changes only; a new file stays untracked.
    std::fs::write(repo.join("a.txt"), "three\n").unwrap();
    std::fs::write(repo.join("c.txt"), "untracked\n").unwrap();
    ok(call("commit_all", json!({ "repoPath": repo, "message": "Third", "amend": false })));
    assert_eq!(changes(&repo), [change("c.txt", "", "untracked")]);
    std::fs::remove_file(repo.join("c.txt")).unwrap();
    ok(call("commit", json!({ "repoPath": repo, "message": "Third, fixed", "amend": true })));
    assert_eq!(git(&repo, &["rev-list", "--count", "HEAD"]).trim(), "3");

    // The toast's Undo: the last action is the amend; moving back keeps its changes staged.
    let last = ok(call("last_action", json!({ "repoPath": repo })));
    assert_eq!(last["entry"]["action"], "amend");
    assert_eq!(last["pushed"], false);
    let (head_id, commit_id) = (&last["entry"]["newId"], &last["entry"]["oldId"]);
    let args = json!({ "repoPath": repo, "headId": head_id, "commitId": commit_id, "mode": "soft" });
    assert_eq!(ok(call("move_head_back", args.clone())), "soft");
    assert_eq!(git(&repo, &["log", "-1", "--format=%s"]).trim(), "Third");
    let last = ok(call("last_action", json!({ "repoPath": repo })));
    assert_eq!(last["entry"]["action"], "reset");
    // Undo of a commit: back to the parent, and the commit's change is staged again.
    std::fs::write(repo.join("a.txt"), "four\n").unwrap();
    ok(call("stage_files", json!({ "repoPath": repo, "filePaths": ["a.txt"] })));
    ok(call("commit", json!({ "repoPath": repo, "message": "Fourth", "amend": false })));
    let last = ok(call("last_action", json!({ "repoPath": repo })));
    assert_eq!(last["entry"]["action"], "commit");
    let undo = json!({
        "repoPath": repo, "headId": last["entry"]["newId"], "commitId": last["entry"]["oldId"], "mode": "soft",
    });
    ok(call("move_head_back", undo));
    assert_eq!(changes(&repo), [change("a.txt", "modified", "")]);
    // Offered again later, it refuses: HEAD moved since.
    let again = call("move_head_back", args);
    assert_eq!(again["ok"], false);
    assert!(again["error"]["message"].as_str().unwrap().contains("changed since then"), "{again}");
}

#[test]
fn a_failed_commit_comes_back_with_gits_message() {
    let repo = repository("nothing");
    let empty = call("commit", json!({ "repoPath": repo, "message": "Nothing staged", "amend": false }));
    assert_eq!(empty["ok"], false);
    assert_eq!(empty["error"]["kind"], "command");
    assert!(empty["error"]["message"].as_str().unwrap().contains("no changes added to commit"), "{empty}");

    let author = json!({ "author": "not an author" });
    let bad = call("commit", json!({ "repoPath": repo, "message": "x", "amend": false, "options": author }));
    assert_eq!(bad["error"]["message"], "Write the author as Name <email>");

    // A failing pre-commit hook stops the commit; its output is the message.
    ok(call("stage_files", json!({ "repoPath": repo, "filePaths": ["a.txt"] })));
    let hook = repo.join(".git/hooks/pre-commit");
    std::fs::write(&hook, "#!/bin/sh\necho 'lint failed' >&2\nexit 1\n").unwrap();
    std::fs::set_permissions(&hook, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let hooked = call("commit", json!({ "repoPath": repo, "message": "Blocked", "amend": false }));
    assert_eq!(hooked["ok"], false);
    assert_eq!(hooked["error"]["message"], "lint failed");

    let refused = call("move_head_back", json!({ "repoPath": repo, "headId": "-x", "commitId": "1", "mode": "soft" }));
    assert_eq!(refused["error"]["kind"], "invalid");
}

#[test]
fn get_refs_lists_local_branches_and_checkout_branch_switches() {
    let repo = repository("branches");
    git(&repo, &["branch", "feature"]);
    let refs = ok(call("get_refs", json!({ "repoPath": repo })));
    let names: Vec<(String, bool)> = refs["local"]
        .as_array()
        .unwrap()
        .iter()
        .map(|branch| (branch["name"].as_str().unwrap_or_default().to_string(), branch["isHead"] == true))
        .collect();
    assert_eq!(names, vec![("feature".to_string(), false), ("main".to_string(), true)]);

    ok(call("checkout_branch", json!({ "repoPath": repo, "branchName": "feature" })));
    assert_eq!(git(&repo, &["branch", "--show-current"]).trim(), "feature");
    let missing = call("checkout_branch", json!({ "repoPath": repo, "branchName": "nope" }));
    assert_eq!(missing["ok"], false, "{missing}");
}

#[test]
fn init_repository_starts_one_in_a_plain_folder() {
    let folder = sandbox().join("plain");
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::write(folder.join("notes.md"), "hi\n").unwrap();
    let created = ok(call("init_repository", json!({ "folderPath": folder })));
    assert_eq!(created["name"], "plain", "{created}");
    assert!(folder.join(".git").is_dir());
    let found = ok(call("discover_repositories", json!({ "workspaceRoot": folder })));
    assert_eq!(found.as_array().map(Vec::len), Some(1), "{found}");
}

#[test]
fn workspace_files_round_trip_and_name_missing_folders() {
    let base = sandbox().join("ws");
    let first = base.join("first");
    let second = base.join("second");
    std::fs::create_dir_all(&first).unwrap();
    std::fs::create_dir_all(&second).unwrap();
    let file = base.join("team.gitmanager-workspace");
    ok(call("write_workspace_file", json!({ "filePath": file, "folders": [first, second] })));
    let saved = ok(call("read_workspace_file", json!({ "filePath": file })));
    assert_eq!(saved["name"], "team", "{saved}");
    assert_eq!(saved["folders"].as_array().map(Vec::len), Some(2), "{saved}");
    std::fs::remove_dir_all(&second).unwrap();
    let again = ok(call("read_workspace_file", json!({ "filePath": file })));
    assert_eq!(again["folders"].as_array().map(Vec::len), Some(1), "{again}");
    assert_eq!(again["missing"].as_array().map(Vec::len), Some(1), "{again}");
}

#[test]
fn clone_repository_clones_and_refuses_a_full_folder() {
    let origin = repository("clone-origin");
    git(&origin, &["add", "-A"]);
    git(&origin, &["commit", "-q", "-m", "second"]);
    let parent = sandbox().join("clones");
    std::fs::create_dir_all(&parent).unwrap();
    let args = json!({ "url": origin, "parentDir": parent, "folderName": "copy", "cancelId": "c1" });
    let cloned = ok(call("clone_repository", args.clone()));
    assert!(cloned.as_str().unwrap_or_default().ends_with("/copy"), "{cloned}");
    assert!(parent.join("copy/b.txt").exists());
    let again = call("clone_repository", args);
    assert_eq!(again["ok"], false, "{again}");
    let bad_url = json!({ "url": "-x", "parentDir": parent, "folderName": "y", "cancelId": "c2" });
    let bad = call("clone_repository", bad_url);
    assert_eq!(bad["ok"], false, "{bad}");
}
