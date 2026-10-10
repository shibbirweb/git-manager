//! The bridge from the outside, as the SwiftUI app uses it: gm_call over a real repository, and the
//! control server over HTTP with a stand-in for Swift's UI handler.

use std::ffi::{c_char, CStr, CString};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{json, Value};

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("gm-bridge-test-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn git(repo: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(["-c", "user.name=Bridge Test", "-c", "user.email=bridge@example.com", "-c", "commit.gpgsign=false"])
        .args(args)
        .current_dir(repo)
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?}");
}

/// One commit with a.txt, then a.txt changed and b.txt new.
fn repository(name: &str) -> PathBuf {
    let repo = temp_dir(name);
    git(&repo, &["init", "-q", "-b", "main"]);
    std::fs::write(repo.join("a.txt"), "one\n").unwrap();
    git(&repo, &["add", "a.txt"]);
    git(&repo, &["commit", "-q", "-m", "first"]);
    std::fs::write(repo.join("a.txt"), "two\n").unwrap();
    std::fs::write(repo.join("b.txt"), "new\n").unwrap();
    repo
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

#[test]
fn get_status_reads_a_repository() {
    let repo = repository("status");
    let reply = call("get_status", &json!({ "repoPath": repo }).to_string());
    assert_eq!(reply["ok"], true, "{reply}");
    let status = &reply["value"]["status"];
    assert_eq!(status["head"]["branch"], "main");
    let mut files: Vec<(String, String)> = status["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|file| (file["path"].as_str().unwrap().to_string(), file["unstaged"].as_str().unwrap_or("").to_string()))
        .collect();
    files.sort();
    assert_eq!(files, [("a.txt".to_string(), "modified".to_string()), ("b.txt".to_string(), "untracked".to_string())]);

    // The hash the caller holds: an unchanged status is not sent again.
    let hash = reply["value"]["hash"].as_str().unwrap();
    let again = call("get_status", &json!({ "repoPath": repo, "knownHash": hash }).to_string());
    assert_eq!(again["value"]["status"], Value::Null);
}

#[test]
fn list_directories_lists_folders_first_and_refuses_paths_outside() {
    let repo = repository("listing");
    std::fs::create_dir(repo.join("docs")).unwrap();
    std::fs::write(repo.join("docs/guide.md"), "# Guide\n").unwrap();
    let args = json!({ "rootPath": repo, "dirPaths": ["", "docs", "../outside"], "repoRoots": [repo] });
    let reply = call("list_directories", &args.to_string());
    assert_eq!(reply["ok"], true, "{reply}");
    let listings = reply["value"].as_array().unwrap();
    let names = |index: usize| -> Vec<String> {
        let entries = listings[index]["entries"].as_array().unwrap();
        entries.iter().map(|entry| entry["name"].as_str().unwrap().to_string()).collect()
    };
    // Folders first, then files; .git is not listed.
    assert_eq!(names(0), ["docs", "a.txt", "b.txt"]);
    assert_eq!(listings[0]["entries"][0]["isDir"], true);
    assert_eq!(names(1), ["guide.md"]);
    assert_eq!(listings[2]["error"], "Invalid path: ../outside");
}

#[test]
fn errors_come_back_as_kind_and_message() {
    let plain = temp_dir("plain");
    let not_repo = call("get_status", &json!({ "repoPath": plain }).to_string());
    assert_eq!(not_repo["ok"], false);
    assert_eq!(not_repo["error"]["kind"], "git");

    let unknown = call("no_such_command", "{}");
    assert_eq!(unknown["error"]["message"], "Unknown command: no_such_command");

    let bad_json = call("get_status", "{not json");
    assert_eq!(bad_json["error"]["kind"], "invalid");

    let missing = call("get_status", "{}");
    assert_eq!(missing["error"]["kind"], "invalid");
}

/// Stands in for Control.swift: answers get_state with the test repository.
extern "C" fn ui_handler(request: *const c_char) -> *mut c_char {
    // SAFETY: the server passes a NUL-terminated string.
    let request: Value = serde_json::from_str(&unsafe { CStr::from_ptr(request) }.to_string_lossy()).unwrap();
    let reply = match request["action"].as_str() {
        Some("get_state") => json!({
            "ok": true,
            "structured": { "repoPath": std::env::var("GM_TEST_REPO").unwrap(), "changedFiles": 2 },
        }),
        Some("open_settings") => json!({ "ok": true, "structured": { "section": request["args"]["section"] } }),
        _ => json!({ "ok": false, "text": "not in this test" }),
    };
    let text = CString::new(reply.to_string()).unwrap();
    // SAFETY: strdup returns a malloc'd copy, which the server frees with free().
    unsafe { libc::strdup(text.as_ptr()) }
}

fn post(port: u16, token: Option<&str>, body: &Value) -> (u16, Value) {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
    let body = body.to_string();
    let auth = token.map(|token| format!("Authorization: Bearer {token}\r\n")).unwrap_or_default();
    let head = format!("POST /mcp HTTP/1.1\r\nHost: 127.0.0.1\r\n{auth}Content-Type: application/json");
    write!(stream, "{head}\r\nContent-Length: {}\r\n\r\n{body}", body.len()).unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).unwrap();
    let status: u16 = response.split_whitespace().nth(1).unwrap().parse().unwrap();
    let json = response.split_once("\r\n\r\n").map(|(_, rest)| rest).unwrap_or_default();
    (status, serde_json::from_str(json).unwrap_or(Value::Null))
}

fn rpc(method: &str, params: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params })
}

#[test]
fn control_server_answers_like_the_current_app() {
    let home = temp_dir("home");
    let repo = repository("control");
    // Only this test reads HOME and GM_TEST_REPO, and the server starts once per process.
    std::env::set_var("HOME", &home);
    std::env::set_var("GM_TEST_REPO", &repo);
    gm_bridge::gm_control_install(ui_handler);
    // Both switches off: nothing listens and there is no server file.
    let off = gm_bridge::control::status();
    assert!(!off.running);
    assert!(!home.join(".gitmanager-native/.gitmanager/mcp.json").exists());
    let switches = |enabled: bool, cli_enabled: bool| gm_bridge::control::Switches { enabled, cli_enabled, port: 0 };
    let on = gm_bridge::control::configure(switches(true, false));
    assert!(on.running, "{on:?}");
    let port = on.port;
    assert!(port > 0);

    let server_file = std::fs::read_to_string(home.join(".gitmanager-native/.gitmanager/mcp.json")).unwrap();
    let file: Value = serde_json::from_str(&server_file).unwrap();
    assert_eq!(file["port"], port);
    assert_eq!(file["pid"], std::process::id());
    let token = file["token"].as_str().unwrap();
    assert_eq!(token.len(), 64);

    let (status, _) = post(port, None, &rpc("tools/list", json!({})));
    assert_eq!(status, 401);
    let (status, _) = post(port, Some("wrong"), &rpc("tools/list", json!({})));
    assert_eq!(status, 401);

    let (_, init) = post(port, Some(token), &rpc("initialize", json!({ "protocolVersion": "2025-06-18" })));
    assert_eq!(init["result"]["serverInfo"]["name"], "git-manager-native");
    assert_eq!(init["result"]["_meta"]["gitManager/mcpEnabled"], true);
    assert_eq!(init["result"]["_meta"]["gitManager/cliEnabled"], false);

    let (_, list) = post(port, Some(token), &rpc("tools/list", json!({})));
    let tools = list["result"]["tools"].as_array().unwrap();
    let names: Vec<&str> = tools.iter().map(|tool| tool["name"].as_str().unwrap()).collect();
    let expected = [
        "get_app_info", "app", "git_status", "get_memory_usage", "sample_memory", "take_screenshot", "open_settings",
        "close_dialog",
    ];
    assert_eq!(names[..expected.len()], expected);
    // Then the current app's git tools (tests/control_tools.rs), its git_status left to the native one.
    assert!(names.contains(&"git_log"));
    assert_eq!(names.iter().filter(|name| **name == "git_status").count(), 1);

    // git_status without repoPath asks the window which folder is open.
    let (_, status) = post(port, Some(token), &rpc("tools/call", json!({ "name": "git_status", "arguments": {} })));
    assert_eq!(status["result"]["isError"], false, "{status}");
    assert_eq!(status["result"]["structuredContent"]["files"].as_array().unwrap().len(), 2);

    let call = |name: &str, arguments: Value| rpc("tools/call", json!({ "name": name, "arguments": arguments }));
    let (_, memory) = post(port, Some(token), &call("get_memory_usage", json!({})));
    assert!(memory["result"]["structuredContent"]["totalBytes"].as_u64().unwrap() > 0);
    assert_eq!(memory["result"]["structuredContent"]["processes"][0]["label"], "Git Manager Native (app)");

    let (_, unknown) = post(port, Some(token), &rpc("tools/call", json!({ "name": "nope", "arguments": {} })));
    assert_eq!(unknown["result"]["isError"], true);

    let (_, settings) = post(port, Some(token), &call("open_settings", json!({ "section": "editor" })));
    assert_eq!(settings["result"]["structuredContent"]["section"], "editor", "{settings}");
    let (_, wrong) = post(port, Some(token), &call("open_settings", json!({ "section": "colors" })));
    assert_eq!(wrong["result"]["isError"], true);

    let (_, refused) = post(port, Some(token), &call("app", json!({ "action": "open_folder" })));
    assert_eq!(refused["result"]["isError"], true);

    let (_, method) = post(port, Some(token), &rpc("no/such/method", json!({})));
    assert_eq!(method["error"]["code"], -32601);

    switches_and_token(&home, token, port);
}

/// The command line tool's requests need its switch; the token stays in mcp.json when the server stops and starts
/// again, and New Token replaces it.
fn switches_and_token(home: &std::path::Path, token: &str, port: u16) {
    use gm_bridge::control::{configure, Switches};
    let server_file = home.join(".gitmanager-native/.gitmanager/mcp.json");
    let cli_call = |port: u16, token: &str| {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        let body = rpc("tools/list", json!({})).to_string();
        let head = format!("POST /mcp HTTP/1.1\r\nAuthorization: Bearer {token}\r\nx-git-manager-client: cli");
        write!(stream, "{head}\r\nContent-Length: {}\r\n\r\n{body}", body.len()).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response.split_whitespace().nth(1).unwrap().parse::<u16>().unwrap()
    };
    assert_eq!(cli_call(port, token), 403);
    let both = configure(Switches { enabled: true, cli_enabled: true, port: 0 });
    assert_eq!(both.port, port, "the same port keeps running");
    assert_eq!(cli_call(port, token), 200);

    configure(Switches { enabled: false, cli_enabled: true, port: 0 });
    assert_eq!(post(port, Some(token), &rpc("tools/list", json!({}))).0, 403);

    let stopped = configure(Switches::default());
    assert!(!stopped.running);
    let file: Value = serde_json::from_str(&std::fs::read_to_string(&server_file).unwrap()).unwrap();
    assert_eq!(file["token"], token);
    assert!(file.get("port").is_none(), "{file}");
    assert!(TcpStream::connect(("127.0.0.1", port)).is_err());

    let again = configure(Switches { enabled: true, cli_enabled: false, port: 0 });
    assert_eq!(again.token.as_deref(), Some(token));
    let renewed = gm_bridge::control::regenerate_token().unwrap();
    let new_token = renewed.token.unwrap();
    assert_ne!(new_token, token);
    let file: Value = serde_json::from_str(&std::fs::read_to_string(&server_file).unwrap()).unwrap();
    assert_eq!(file["token"], new_token.as_str());
    assert_eq!(file["port"], again.port);
    assert_eq!(post(again.port, Some(token), &rpc("tools/list", json!({}))).0, 401);

    let low = configure(Switches { enabled: true, cli_enabled: false, port: 80 });
    assert!(!low.running);
    assert_eq!(low.error.as_deref(), Some("Choose a port from 1024 to 65535"));
    configure(Switches::default());
}
