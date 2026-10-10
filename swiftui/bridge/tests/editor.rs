//! The file editor's reads through gm_call over real temporary repositories: read_worktree_file and blame_contents.
//! Its own test binary (own process), so git can point at an empty global config before any test runs it.

use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use serde_json::{json, Value};

/// Isolates every git the bridge starts from the user's own config, like src-tauri/src/test_support.rs does.
fn sandbox() -> &'static PathBuf {
    static HOME: OnceLock<PathBuf> = OnceLock::new();
    HOME.get_or_init(|| {
        let home = std::env::temp_dir().join(format!("gm-bridge-editor-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(&home).unwrap();
        let config = home.join("gitconfig");
        let identity = "[user]\n\tname = Ada Lovelace\n\temail = ada@example.com\n[commit]\n\tgpgsign = false\n";
        std::fs::write(&config, identity).unwrap();
        std::env::set_var("HOME", &home);
        std::env::set_var("XDG_CONFIG_HOME", home.join(".config"));
        std::env::set_var("GIT_CONFIG_NOSYSTEM", "1");
        std::env::set_var("GIT_CONFIG_GLOBAL", &config);
        std::env::set_var("LC_ALL", "C");
        home
    })
}

fn git(repo: &Path, args: &[&str]) {
    sandbox();
    let output = Command::new("git").args(args).current_dir(repo).output().unwrap();
    assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
}

/// A repository with src/app.ts committed ("Add the app"), then a line added in the work tree.
fn repository(name: &str) -> PathBuf {
    let repo = sandbox().join(name);
    std::fs::create_dir_all(repo.join("src")).unwrap();
    git(&repo, &["init", "-q", "-b", "main"]);
    std::fs::write(repo.join("src/app.ts"), "const a = 1;\nconst b = 2;\n").unwrap();
    git(&repo, &["add", "."]);
    git(&repo, &["commit", "-q", "-m", "Add the app"]);
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

#[test]
fn read_worktree_file_reads_text_like_the_tauri_command() {
    let repo = repository("read");
    std::fs::write(repo.join("win.txt"), "one\r\ntwo\r\n").unwrap();
    std::fs::write(repo.join("image.bin"), [0u8, 1, 2, 3]).unwrap();

    let reply = call("read_worktree_file", json!({ "repoPath": repo, "filePath": "src/app.ts" }));
    assert_eq!(reply["ok"], true, "{reply}");
    let file = &reply["value"];
    assert_eq!(file["path"], "src/app.ts");
    assert_eq!(file["content"], "const a = 1;\nconst b = 2;\n");
    assert_eq!(file["eol"], "lf");
    assert_eq!(file["binary"], false);
    assert_eq!(file["tooLarge"], false);
    assert_eq!(file["size"], 26);
    assert_eq!(file["unchanged"], false);

    // The version the caller holds: an unchanged file comes back without its text.
    let version = file["version"].as_str().unwrap();
    let known = json!({ "repoPath": repo, "filePath": "src/app.ts", "knownVersion": version });
    let again = call("read_worktree_file", known);
    assert_eq!(again["value"]["unchanged"], true);
    assert_eq!(again["value"]["content"], "");

    let crlf = call("read_worktree_file", json!({ "repoPath": repo, "filePath": "win.txt" }));
    assert_eq!(crlf["value"]["content"], "one\ntwo\n");
    assert_eq!(crlf["value"]["eol"], "crlf");

    let binary = call("read_worktree_file", json!({ "repoPath": repo, "filePath": "image.bin" }));
    assert_eq!(binary["value"]["binary"], true);
    assert_eq!(binary["value"]["content"], "");
}

#[test]
fn read_worktree_file_refuses_paths_outside_and_missing_files() {
    let repo = repository("outside");
    for file_path in ["../secret.txt", "/etc/hosts", ""] {
        let reply = call("read_worktree_file", json!({ "repoPath": repo, "filePath": file_path }));
        assert_eq!(reply["ok"], false, "{file_path}: {reply}");
        assert_eq!(reply["error"]["kind"], "invalid");
    }
    let missing = call("read_worktree_file", json!({ "repoPath": repo, "filePath": "src/gone.ts" }));
    assert_eq!(missing["ok"], false);
}

#[test]
fn blame_contents_blames_the_editor_text_unsaved_lines_included() {
    let repo = repository("blame");
    let text = "const a = 1;\nconst typed = 0;\nconst b = 2;\n";
    let reply = call(
        "blame_contents",
        json!({ "repoPath": repo, "filePath": "src/app.ts", "eol": "lf", "text": text }),
    );
    assert_eq!(reply["ok"], true, "{reply}");
    let commits = reply["value"]["commits"].as_array().unwrap();
    let committed = commits.iter().position(|commit| commit["uncommitted"] == false).unwrap();
    let typed = commits.iter().position(|commit| commit["uncommitted"] == true).unwrap();
    assert_eq!(commits[committed]["authorName"], "Ada Lovelace");
    assert_eq!(commits[committed]["summary"], "Add the app");
    assert!(commits[committed]["authorTime"].as_i64().unwrap() > 0);
    // [length, commit, originalStart] per run: line 1, the typed line, then line 2 of the commit.
    let runs: Vec<u64> = reply["value"]["runs"].as_array().unwrap().iter().map(|n| n.as_u64().unwrap()).collect();
    let (committed, typed) = (committed as u64, typed as u64);
    assert_eq!(runs.len(), 9);
    assert_eq!((runs[0], runs[1], runs[2]), (1, committed, 0));
    assert_eq!((runs[3], runs[4]), (1, typed));
    assert_eq!((runs[6], runs[7], runs[8]), (1, committed, 1));
}

#[test]
fn blame_contents_of_an_untracked_file_is_an_error() {
    let repo = repository("untracked");
    std::fs::write(repo.join("new.ts"), "x\n").unwrap();
    let reply = call("blame_contents", json!({ "repoPath": repo, "filePath": "new.ts", "eol": "lf", "text": "x\n" }));
    assert_eq!(reply["ok"], false, "{reply}");
}
