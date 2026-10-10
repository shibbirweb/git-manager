//! Remotes for Git > GitHub through gm_call over real temporary repositories: list_remotes, push_with_options to a
//! local bare repository (tracking it on first push) and fetch_all. Its own test binary (own process), so git runs
//! against an empty global config.

use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use serde_json::{json, Value};

fn sandbox() -> &'static PathBuf {
    static HOME: OnceLock<PathBuf> = OnceLock::new();
    HOME.get_or_init(|| {
        let home = std::env::temp_dir().join(format!("gm-bridge-remote-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(&home).unwrap();
        let config = home.join("gitconfig");
        let identity = "[user]\n\tname = Bridge Test\n\temail = bridge@example.com\n[commit]\n\tgpgsign = false\n\
                        [init]\n\tdefaultBranch = main\n";
        std::fs::write(&config, identity).unwrap();
        std::env::set_var("HOME", &home);
        std::env::set_var("XDG_CONFIG_HOME", home.join(".config"));
        std::env::set_var("GIT_CONFIG_NOSYSTEM", "1");
        std::env::set_var("GIT_CONFIG_GLOBAL", &config);
        std::env::set_var("LC_ALL", "C");
        home
    })
}

fn git(dir: &Path, args: &[&str]) -> String {
    sandbox();
    let output = Command::new("git").args(args).current_dir(dir).output().unwrap();
    assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
    String::from_utf8_lossy(&output.stdout).trim().to_string()
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

/// A repository with one commit and a bare repository added as `origin`, nothing pushed yet.
fn repository_with_remote(name: &str) -> (PathBuf, PathBuf) {
    let root = sandbox().join(name);
    let repo = root.join("work");
    let bare = root.join("server.git");
    std::fs::create_dir_all(&repo).unwrap();
    std::fs::create_dir_all(&bare).unwrap();
    git(&bare, &["init", "--bare", "-q"]);
    git(&repo, &["init", "-q"]);
    std::fs::write(repo.join("a.txt"), "a\n").unwrap();
    git(&repo, &["add", "a.txt"]);
    git(&repo, &["commit", "-q", "-m", "first"]);
    git(&repo, &["remote", "add", "origin", bare.to_str().unwrap()]);
    (repo, bare)
}

#[test]
fn remotes_are_listed_with_their_urls() {
    let (repo, bare) = repository_with_remote("list");
    let remotes = ok(call("list_remotes", json!({"repoPath": repo})));
    assert_eq!(remotes[0]["name"], "origin", "{remotes}");
    assert_eq!(remotes[0]["fetchUrl"], bare.to_str().unwrap());
}

#[test]
fn a_first_push_tracks_the_remote_branch() {
    let (repo, bare) = repository_with_remote("push");
    let reply = call("push_with_options",
                     json!({"repoPath": repo, "remoteName": "origin", "remoteBranch": "main"}));
    ok(reply);
    assert_eq!(git(&bare, &["rev-parse", "main"]), git(&repo, &["rev-parse", "HEAD"]));
    assert_eq!(git(&repo, &["rev-parse", "--abbrev-ref", "@{upstream}"]), "origin/main");
    let fetched = call("fetch_all", json!({"repoPath": repo}));
    ok(fetched);
    assert_eq!(ok(call("git_progress", json!({}))), "");
}

#[test]
fn a_remote_name_like_an_option_is_refused() {
    let (repo, _) = repository_with_remote("option");
    let reply = call("push_with_options", json!({"repoPath": repo, "remoteName": "-x", "remoteBranch": "main"}));
    assert_eq!(reply["ok"], false, "{reply}");
}
