//! The Log's reads through gm_call over a real temporary repository with a branch, a merge, a tag and a remote
//! branch: get_log (all branches or HEAD only, pages, unchanged tips), get_commit_details and get_commit_file_diff.

use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{json, Value};

fn git(repo: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(["-c", "user.name=Log Test", "-c", "user.email=log@example.com", "-c", "commit.gpgsign=false"])
        .args(["-c", "tag.gpgsign=false"])
        .args(args)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .current_dir(repo)
        .output()
        .unwrap();
    assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

fn commit(repo: &Path, file_name: &str, text: &str, message: &str, days_ago: i64) {
    std::fs::write(repo.join(file_name), text).unwrap();
    git(repo, &["add", "-A"]);
    let when = format!("{} +0000", 1_790_000_000 - days_ago * 86_400);
    let output = Command::new("git")
        .args(["-c", "user.name=Log Test", "-c", "user.email=log@example.com", "-c", "commit.gpgsign=false"])
        .args(["commit", "-q", "-m", message])
        .env("GIT_AUTHOR_DATE", &when)
        .env("GIT_COMMITTER_DATE", &when)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .current_dir(repo)
        .output()
        .unwrap();
    assert!(output.status.success(), "commit {message}: {}", String::from_utf8_lossy(&output.stderr));
}

/// main: first, second, merge of topic (one commit), tagged v1; a remote branch origin/main at second;
/// a branch `side` off first that HEAD never reaches.
fn repository(name: &str) -> PathBuf {
    let repo = std::env::temp_dir().join(format!("gm-bridge-log-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&repo);
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q", "-b", "main"]);
    commit(&repo, "a.txt", "one\n", "first", 5);
    git(&repo, &["branch", "side"]);
    git(&repo, &["checkout", "-q", "-b", "topic"]);
    commit(&repo, "b.txt", "topic\n", "topic work", 4);
    git(&repo, &["checkout", "-q", "main"]);
    commit(&repo, "a.txt", "one\ntwo\n", "second\n\nWith a body.\n", 3);
    git(&repo, &["update-ref", "refs/remotes/origin/main", "HEAD"]);
    git(&repo, &["merge", "-q", "--no-ff", "-m", "Merge topic", "topic"]);
    git(&repo, &["tag", "v1"]);
    git(&repo, &["checkout", "-q", "side"]);
    commit(&repo, "c.txt", "side\n", "side work", 1);
    git(&repo, &["checkout", "-q", "main"]);
    repo
}

fn call(command: &str, args: Value) -> Value {
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

fn summaries(page: &Value) -> Vec<String> {
    page["commits"].as_array().unwrap().iter().map(|commit| commit["summary"].as_str().unwrap().to_string()).collect()
}

#[test]
fn get_log_walks_head_or_every_branch() {
    let repo = repository("walk");
    let args = |all_refs: bool| json!({ "repoPath": repo, "offset": 0, "limit": 300, "allRefs": all_refs });
    let all = call("get_log", args(true));
    assert_eq!(all["ok"], true, "{all}");
    // The merge is made now (no fixed date), so it is the newest.
    assert_eq!(summaries(&all["value"]), ["Merge topic", "side work", "second", "topic work", "first"]);
    let head = call("get_log", args(false));
    assert_eq!(summaries(&head["value"]), ["Merge topic", "second", "topic work", "first"]);

    let merge = &head["value"]["commits"][0];
    assert_eq!(merge["parents"].as_array().unwrap().len(), 2);
    assert_eq!(merge["refs"], json!([{ "name": "main", "kind": "head" }, { "name": "v1", "kind": "tag" }]));
    assert_eq!(merge["shortId"].as_str().unwrap().len(), 8);
    assert_eq!(merge["authorName"], "Log Test");
    assert_eq!(head["value"]["commits"][1]["time"], 1_790_000_000 - 3 * 86_400);
    assert_eq!(head["value"]["commits"][1]["refs"], json!([{ "name": "origin/main", "kind": "remote" }]));

    // The same tips: nothing walked; a page further on: the rest.
    let tips = head["value"]["tips"].as_str().unwrap();
    let known = json!({ "repoPath": repo, "offset": 0, "limit": 300, "allRefs": false, "knownTips": tips });
    assert_eq!(call("get_log", known)["value"]["commits"], Value::Null);
    let rest = call("get_log", json!({ "repoPath": repo, "offset": 3, "limit": 300, "allRefs": false }));
    assert_eq!(summaries(&rest["value"]), ["first"]);
}

#[test]
fn commit_details_and_file_diff() {
    let repo = repository("details");
    let second = git(&repo, &["rev-parse", "HEAD^1"]);
    let details = call("get_commit_details", json!({ "repoPath": repo, "commitId": second }));
    assert_eq!(details["ok"], true, "{details}");
    let value = &details["value"];
    assert_eq!(value["message"], "second\n\nWith a body.\n");
    assert_eq!(value["files"], json!([{ "path": "a.txt", "origPath": null, "status": "modified" }]));
    assert_eq!(value["parents"].as_array().unwrap().len(), 1);
    assert_eq!(value["authorTime"], 1_790_000_000 - 3 * 86_400);

    let args = json!({ "repoPath": repo, "commitId": second, "filePath": "a.txt" });
    let diff = call("get_commit_file_diff", args);
    assert_eq!(diff["ok"], true, "{diff}");
    assert_eq!(diff["value"]["original"], "one\n");
    assert_eq!(diff["value"]["modified"], "one\ntwo\n");
    assert!(!diff["value"]["hunks"].as_array().unwrap().is_empty());

    let missing = call("get_commit_details", json!({ "repoPath": repo, "commitId": "0123456789" }));
    assert_eq!(missing["ok"], false);

    let resolved = call("resolve_revision", json!({ "repoPath": repo, "revision": "HEAD^1" }));
    assert_eq!(resolved["value"], second.as_str());
    let refused = call("resolve_revision", json!({ "repoPath": repo, "revision": "--all" }));
    assert_eq!(refused["ok"], false);
}
