//! Opening a folder as a workspace through gm_call: the repositories inside it, as the current app finds them.

use std::ffi::{CStr, CString};
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{json, Value};

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("gm-bridge-workspace-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn init(repo: &Path) {
    std::fs::create_dir_all(repo).unwrap();
    let status = Command::new("git").args(["init", "-q", "-b", "main"]).current_dir(repo).status().unwrap();
    assert!(status.success());
}

fn call(command: &str, args: &str) -> Value {
    let command = CString::new(command).unwrap();
    let args = CString::new(args).unwrap();
    // SAFETY: NUL-terminated strings in, and the reply is freed once.
    unsafe {
        let reply = gm_bridge::gm_call(command.as_ptr(), args.as_ptr());
        assert!(!reply.is_null());
        let text = CStr::from_ptr(reply).to_string_lossy().into_owned();
        gm_bridge::gm_free_string(reply);
        serde_json::from_str(&text).unwrap()
    }
}

fn names(repos: &Value) -> Vec<String> {
    repos.as_array().unwrap().iter().map(|repo| repo["relativePath"].as_str().unwrap().to_string()).collect()
}

#[test]
fn open_workspace_lists_the_repositories_inside_a_folder() {
    let folder = temp_dir("acme");
    init(&folder.join("storefront"));
    init(&folder.join("payments-api"));
    std::fs::create_dir_all(folder.join("notes")).unwrap();
    let reply = call("open_workspace", &json!({ "folderPath": folder }).to_string());
    assert_eq!(reply["ok"], true, "{reply}");
    let info = &reply["value"];
    assert_eq!(info["name"], folder.file_name().unwrap().to_str().unwrap());
    assert_eq!(names(&info["repos"]), ["payments-api", "storefront"]);
    assert_eq!(info["repos"][0]["name"], "payments-api");
    assert_eq!(info["repos"][0]["submodule"], false);

    init(&folder.join("notes"));
    let root = info["root"].as_str().unwrap();
    let again = call("discover_repositories", &json!({ "workspaceRoot": root }).to_string());
    assert_eq!(again["ok"], true, "{again}");
    assert_eq!(names(&again["value"]), ["notes", "payments-api", "storefront"]);
    let _ = std::fs::remove_dir_all(&folder);
}

#[test]
fn open_workspace_on_a_repository_is_that_repository() {
    let repo = temp_dir("single");
    init(&repo);
    let reply = call("open_workspace", &json!({ "folderPath": repo }).to_string());
    assert_eq!(reply["ok"], true, "{reply}");
    assert_eq!(names(&reply["value"]["repos"]), [""]);
    let _ = std::fs::remove_dir_all(&repo);
}
