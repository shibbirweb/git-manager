//! Settings > GitHub and Git > GitHub through gm_call, without the network or the keychain: the account is read from
//! the native app's own folder, and requests that cannot be right are refused before anything is sent. Its own
//! test binary, so HOME points at a throwaway folder before any call.

use std::ffi::{CStr, CString};
use std::path::PathBuf;
use std::sync::OnceLock;

use serde_json::{json, Value};

fn home() -> &'static PathBuf {
    static HOME: OnceLock<PathBuf> = OnceLock::new();
    HOME.get_or_init(|| {
        let home = std::env::temp_dir().join(format!("gm-bridge-github-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(&home).unwrap();
        std::env::set_var("HOME", &home);
        home
    })
}

fn call(command: &str, args: Value) -> Value {
    home();
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

fn error_text(reply: &Value) -> String {
    assert_eq!(reply["ok"], false, "{reply}");
    reply["error"]["message"].as_str().unwrap_or_default().to_string()
}

#[test]
fn the_account_comes_from_the_native_folder() {
    let account_file = home().join(".gitmanager-native/github.json");
    let _ = std::fs::remove_file(&account_file);
    assert_eq!(call("github_account", json!({}))["value"], Value::Null);
    std::fs::create_dir_all(account_file.parent().unwrap()).unwrap();
    let saved = json!({"host": "github.com", "login": "octo", "name": "Octo Cat", "source": "ghCli",
                       "missingScopes": []});
    std::fs::write(&account_file, saved.to_string()).unwrap();
    let account = call("github_account", json!({}));
    assert_eq!(account["value"]["login"], "octo", "{account}");
    assert_eq!(account["value"]["source"], "ghCli");
    std::fs::remove_file(&account_file).unwrap();
}

#[test]
fn a_token_with_spaces_is_refused_before_github_is_asked() {
    let reply = call("github_sign_in_with_token", json!({"token": "ghp_not a token"}));
    assert!(error_text(&reply).contains("does not look like a token"), "{reply}");
}

#[test]
fn a_gist_needs_a_sign_in() {
    let request = json!({"fileName": "a.txt", "description": "", "public": false, "content": "a"});
    let reply = call("github_create_gist", json!({"request": request}));
    assert!(error_text(&reply).contains("Sign in to GitHub first"), "{reply}");
}

#[test]
fn a_repository_name_is_checked_first() {
    let request = json!({"repositoryName": "  ", "private": true, "remoteName": "origin"});
    let reply = call("github_share_project", json!({"repoPath": "/nowhere", "request": request}));
    assert!(error_text(&reply).contains("Enter a repository name"), "{reply}");
}
