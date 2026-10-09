//! The current app's git tools in the native control server (src-tauri/src/mcp/tools/git_read.rs, included by
//! path): listed with their own schemas, run inside the window's workspace folders, refused outside them.

use std::ffi::{c_char, CStr, CString};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{json, Value};

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("gm-tools-test-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir.canonicalize().unwrap()
}

fn git(repo: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(["-c", "user.name=Tools Test", "-c", "user.email=tools@example.com", "-c", "commit.gpgsign=false"])
        .args(args)
        .current_dir(repo)
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?}");
}

/// Two commits on main, a feature branch one commit ahead.
fn repository(name: &str) -> PathBuf {
    let repo = temp_dir(name);
    git(&repo, &["init", "-q", "-b", "main"]);
    std::fs::write(repo.join("a.txt"), "one\n").unwrap();
    git(&repo, &["add", "a.txt"]);
    git(&repo, &["commit", "-q", "-m", "first"]);
    std::fs::write(repo.join("a.txt"), "two\n").unwrap();
    git(&repo, &["commit", "-q", "-am", "second"]);
    git(&repo, &["checkout", "-q", "-b", "feature"]);
    std::fs::write(repo.join("b.txt"), "new\n").unwrap();
    git(&repo, &["add", "b.txt"]);
    git(&repo, &["commit", "-q", "-m", "feature work"]);
    repo
}

/// Stands in for Control.swift: the workspace is the folder in GM_TOOLS_FOLDER.
extern "C" fn ui_handler(request: *const c_char) -> *mut c_char {
    // SAFETY: the server passes a NUL-terminated string.
    let request: Value = serde_json::from_str(&unsafe { CStr::from_ptr(request) }.to_string_lossy()).unwrap();
    let reply = match request["action"].as_str() {
        Some("get_state") => json!({
            "ok": true,
            "structured": { "workspace": { "folders": [std::env::var("GM_TOOLS_FOLDER").unwrap()] } },
        }),
        _ => json!({ "ok": false, "text": "not in this test" }),
    };
    let text = CString::new(reply.to_string()).unwrap();
    // SAFETY: strdup returns a malloc'd copy, which the server frees with free().
    unsafe { libc::strdup(text.as_ptr()) }
}

fn call_tool(port: u16, token: &str, name: &str, arguments: Value) -> Value {
    let body = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": { "name": name, "arguments": arguments } }).to_string();
    let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
    let head = format!("POST /mcp HTTP/1.1\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json");
    write!(stream, "{head}\r\nContent-Length: {}\r\n\r\n{body}", body.len()).unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).unwrap();
    let json = response.split_once("\r\n\r\n").map(|(_, rest)| rest).unwrap_or_default();
    serde_json::from_str::<Value>(json).unwrap()["result"].clone()
}

#[test]
fn git_tools_run_inside_the_workspace() {
    let home = temp_dir("home");
    let repo = repository("repo");
    let outside = repository("outside");
    // Only this test in this binary reads HOME and GM_TOOLS_FOLDER.
    std::env::set_var("HOME", &home);
    std::env::set_var("GM_TOOLS_FOLDER", &repo);
    gm_bridge::gm_control_install(ui_handler);
    let status = gm_bridge::control::configure(gm_bridge::control::Switches { enabled: true, cli_enabled: false,
                                                                              port: 0 });
    let token = status.token.unwrap();
    let repo_path = repo.to_string_lossy().to_string();

    let log = call_tool(status.port, &token, "git_log", json!({ "repoPath": repo_path }));
    assert_eq!(log["isError"], false, "{log}");
    let subjects: Vec<&str> = log["structuredContent"]["commits"].as_array().unwrap().iter()
        .map(|commit| commit["summary"].as_str().unwrap()).collect();
    assert_eq!(subjects, ["feature work", "second", "first"]);

    let branches = call_tool(status.port, &token, "git_branches", json!({ "repoPath": repo_path }));
    assert_eq!(branches["isError"], false, "{branches}");

    let compared = call_tool(status.port, &token, "git_compare_branches",
                             json!({ "repoPath": repo_path, "branchName": "feature", "baseName": "main" }));
    assert_eq!(compared["isError"], false, "{compared}");
    assert_eq!(compared["structuredContent"]["branchOnly"].as_array().unwrap().len(), 1);
    assert_eq!(compared["structuredContent"]["files"][0]["path"], "b.txt");

    let diff = call_tool(status.port, &token, "git_diff",
                         json!({ "repoPath": repo_path, "mode": "commit", "commitId": "HEAD" }));
    assert_eq!(diff["isError"], false, "{diff}");
    assert!(diff["content"][0]["text"].as_str().unwrap().contains("+new"), "{diff}");

    let remotes = call_tool(status.port, &token, "git_remotes", json!({ "repoPath": repo_path }));
    assert_eq!(remotes["structuredContent"]["remotes"], json!([]));

    let refused = call_tool(status.port, &token, "git_log", json!({ "repoPath": outside.to_string_lossy() }));
    assert_eq!(refused["isError"], true, "{refused}");
    gm_bridge::control::configure(gm_bridge::control::Switches::default());
}
