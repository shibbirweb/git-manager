//! The merge tool's commands through gm_call over a real repository stopped in a merge. Its own test binary, so
//! the sandbox can point git at an empty global config before any test runs git (like writes.rs).

use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use serde_json::{json, Value};

fn sandbox() -> &'static PathBuf {
    static HOME: OnceLock<PathBuf> = OnceLock::new();
    HOME.get_or_init(|| {
        let home = std::env::temp_dir().join(format!("gm-bridge-merge-{}", std::process::id()));
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

fn git(repo: &Path, args: &[&str]) -> (bool, String) {
    sandbox();
    let output = Command::new("git").args(args).current_dir(repo).output().unwrap();
    (output.status.success(), String::from_utf8_lossy(&output.stdout).into_owned())
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

/// a.txt and b.txt changed on both branches, so `git merge feature` stops with two conflicts.
fn conflicted(name: &str) -> PathBuf {
    let repo = sandbox().join(name);
    std::fs::create_dir_all(&repo).unwrap();
    let run = |args: &[&str]| assert!(git(&repo, args).0, "git {args:?}");
    run(&["init", "-q", "-b", "main"]);
    std::fs::write(repo.join("a.txt"), "one\ntwo\nthree\nfour\n").unwrap();
    std::fs::write(repo.join("b.txt"), "base\n").unwrap();
    run(&["add", "."]);
    run(&["commit", "-q", "-m", "base"]);
    run(&["checkout", "-q", "-b", "feature"]);
    std::fs::write(repo.join("a.txt"), "one\nTWO feature\nthree\nfour, feature\n").unwrap();
    std::fs::write(repo.join("b.txt"), "feature\n").unwrap();
    run(&["commit", "-q", "-am", "feature"]);
    run(&["checkout", "-q", "main"]);
    std::fs::write(repo.join("a.txt"), "one\nTWO main\nthree\nfour\n").unwrap();
    std::fs::write(repo.join("b.txt"), "main\n").unwrap();
    run(&["commit", "-q", "-am", "main"]);
    assert!(!git(&repo, &["merge", "-q", "feature"]).0, "the merge stops with conflicts");
    repo
}

#[test]
fn lists_and_loads_a_conflict_as_chunks() {
    let repo = conflicted("load");
    let summary = ok(call("list_conflicts", json!({ "repoPath": repo })));
    assert_eq!(summary["op"]["kind"], "merge");
    let paths: Vec<_> = summary["files"].as_array().unwrap().iter().map(|file| file["path"].clone()).collect();
    assert_eq!(paths, [json!("a.txt"), json!("b.txt")]);
    assert_eq!(summary["files"][0]["kind"], "bothModified");

    let args = json!({ "repoPath": repo, "conflictPath": "a.txt", "ignoreWhitespace": false });
    let document = ok(call("load_conflict", args));
    assert_eq!(document["base"], "one\ntwo\nthree\nfour\n");
    assert_eq!(document["ours"], "one\nTWO main\nthree\nfour\n");
    let kinds: Vec<_> = document["chunks"].as_array().unwrap().iter().map(|chunk| chunk["kind"].clone()).collect();
    assert_eq!(kinds, [json!("conflict"), json!("theirsOnly")]);
    assert_eq!(document["chunks"][1]["theirs"], json!({ "start": 3, "end": 4 }));
}

#[test]
fn saving_or_taking_a_side_resolves_the_file() {
    let repo = conflicted("save");
    let content = "one\nTWO both\nthree\nfour, feature\n";
    ok(call("save_resolution", json!({ "repoPath": repo, "conflictPath": "a.txt", "content": content, "eol": "lf" })));
    assert_eq!(std::fs::read_to_string(repo.join("a.txt")).unwrap(), content);
    ok(call("accept_side", json!({ "repoPath": repo, "conflictPaths": ["b.txt"], "side": "theirs" })));
    assert_eq!(std::fs::read_to_string(repo.join("b.txt")).unwrap(), "feature\n");
    let summary = ok(call("list_conflicts", json!({ "repoPath": repo })));
    assert_eq!(summary["files"], json!([]));
}

#[test]
fn loads_the_four_mergetool_files() {
    let folder = sandbox().join("mergetool");
    std::fs::create_dir_all(&folder).unwrap();
    for (name, text) in [("BASE", "a\nb\n"), ("LOCAL", "a\nB\n"), ("REMOTE", "a\nb\nc\n"), ("MERGED", "")] {
        std::fs::write(folder.join(name), text).unwrap();
    }
    let path = |name: &str| folder.join(name).to_string_lossy().into_owned();
    let args = json!({
        "basePath": path("BASE"), "localPath": path("LOCAL"), "remotePath": path("REMOTE"),
        "mergedPath": path("MERGED"), "ignoreWhitespace": false,
    });
    let document = ok(call("load_mergetool", args));
    assert_eq!(document["oursLabel"], "Local (yours)");
    assert_eq!(document["kind"], "bothModified");
    // The two edits touch, so git and the engine make them one conflict.
    assert_eq!(document["chunks"][0]["kind"], "conflict");
    let save = json!({ "mergedPath": path("MERGED"), "content": "a\nB\nc\n", "eol": "crlf" });
    ok(call("save_mergetool", save));
    assert_eq!(std::fs::read_to_string(folder.join("MERGED")).unwrap(), "a\r\nB\r\nc\r\n");
}
