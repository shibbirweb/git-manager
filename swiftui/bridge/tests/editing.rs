//! The file editor's Save and change marks through gm_call over real temporary repositories: write_worktree_file and
//! line_change_marks. Its own test binary (own process), so git can point at an empty global config first.

use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use serde_json::{json, Value};

/// Isolates every git the bridge starts from the user's own config, like src-tauri/src/test_support.rs does.
fn sandbox() -> &'static PathBuf {
    static HOME: OnceLock<PathBuf> = OnceLock::new();
    HOME.get_or_init(|| {
        let home = std::env::temp_dir().join(format!("gm-bridge-editing-{}", std::process::id()));
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

/// A repository with src/app.ts committed ("Add the app").
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
fn write_worktree_file_saves_in_the_files_line_endings() {
    let repo = repository("write");
    let reply = call(
        "write_worktree_file",
        json!({ "repoPath": repo, "filePath": "src/app.ts", "content": "const a = 3;\n", "eol": "lf" }),
    );
    assert_eq!(reply["ok"], true, "{reply}");
    assert!(reply["value"].as_str().is_some_and(|version| !version.is_empty()));
    assert_eq!(std::fs::read_to_string(repo.join("src/app.ts")).unwrap(), "const a = 3;\n");

    let crlf = json!({ "repoPath": repo, "filePath": "win.txt", "content": "one\ntwo\n", "eol": "crlf" });
    assert_eq!(call("write_worktree_file", crlf)["ok"], true);
    assert_eq!(std::fs::read(repo.join("win.txt")).unwrap(), b"one\r\ntwo\r\n");

    let outside = json!({ "repoPath": repo, "filePath": "../out.txt", "content": "x", "eol": "lf" });
    let refused = call("write_worktree_file", outside);
    assert_eq!(refused["ok"], false);
    assert_eq!(refused["error"]["kind"], "invalid");
}

#[test]
fn line_change_marks_compare_the_text_with_head() {
    let repo = repository("marks");
    let text = "const a = 1;\nconst typed = 0;\nconst b = 3;\n";
    let reply = call("line_change_marks", json!({ "repoPath": repo, "filePath": "src/app.ts", "text": text }));
    assert_eq!(reply["ok"], true, "{reply}");
    let marks = reply["value"]["marks"].as_array().unwrap();
    assert_eq!(marks.len(), 1, "{reply}");
    assert_eq!((marks[0]["from"].as_u64(), marks[0]["to"].as_u64()), (Some(1), Some(3)));
    assert_eq!(marks[0]["kind"], "modified");
    assert!(reply["value"]["head"]["blobId"].is_string(), "{reply}");

    let same = call(
        "line_change_marks",
        json!({ "repoPath": repo, "filePath": "src/app.ts", "text": "const a = 1;\nconst b = 2;\n" }),
    );
    assert_eq!(same["value"]["marks"], json!([]));

    let added = call("line_change_marks", json!({ "repoPath": repo, "filePath": "new.ts", "text": "x\ny\n" }));
    let added_marks = added["value"]["marks"].as_array().unwrap();
    assert_eq!(added_marks[0]["kind"], "added", "{added}");
}
