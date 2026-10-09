//! Go to File and Find in Files through gm_call, over a real folder: the same file_search and text_search code as
//! the current app's popup.

use std::ffi::{c_char, CStr, CString};
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

fn folder() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("gm-bridge-search-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(dir.join("src")).unwrap();
    std::fs::create_dir_all(dir.join("docs")).unwrap();
    let cart = "export class Cart {\n  private lines = [];\n  count() {\n    return this.lines.length;\n  }\n}\n";
    std::fs::write(dir.join("src/cart.ts"), cart).unwrap();
    std::fs::write(dir.join("src/pricing.ts"), "export const price = 1;\n").unwrap();
    std::fs::write(dir.join("docs/cart-api.md"), "# Cart\n").unwrap();
    dir
}

fn call(command: &str, args: Value) -> Value {
    let command = CString::new(command).unwrap();
    let args = CString::new(args.to_string()).unwrap();
    // SAFETY: NUL-terminated strings in, and the reply is freed once.
    unsafe {
        let reply: *mut c_char = gm_bridge::gm_call(command.as_ptr(), args.as_ptr());
        assert!(!reply.is_null());
        let text = CStr::from_ptr(reply).to_string_lossy().into_owned();
        gm_bridge::gm_free_string(reply);
        let value: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(value["ok"], true, "{value}");
        value["value"].clone()
    }
}

#[test]
fn go_to_file_and_find_in_files() {
    let dir = folder();
    let roots = json!([dir.to_string_lossy()]);
    let opened = call("file_search_open", json!({ "workspaceRoots": roots }));
    assert!(opened["indexed"].is_number(), "{opened}");

    // The index builds in the background: query until it is done, as the popup retries.
    let started = Instant::now();
    let mut results = call("file_search_query", json!({ "workspaceRoots": roots, "query": "cart", "limit": 50 }));
    while results["done"] != true && started.elapsed() < Duration::from_secs(10) {
        std::thread::sleep(Duration::from_millis(50));
        results = call("file_search_query", json!({ "workspaceRoots": roots, "query": "cart", "limit": 50 }));
    }
    let items = results["items"].as_array().unwrap();
    let paths: Vec<&str> = items.iter().map(|item| item["relativePath"].as_str().unwrap()).collect();
    assert_eq!(paths, ["src/cart.ts", "docs/cart-api.md"], "{results}");
    assert_eq!(items[0]["indices"], json!([4, 5, 6, 7]));

    let batches = call(
        "text_search",
        json!({ "workspaceRoots": roots, "searchId": 1, "query": "lines", "options": { "matchCase": false } }),
    );
    let batches = batches.as_array().unwrap();
    let last = batches.last().unwrap();
    assert_eq!(last["done"], true);
    assert_eq!(last["matches"], 2);
    let files: Vec<&Value> = batches.iter().flat_map(|batch| batch["files"].as_array().unwrap()).collect();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0]["relativePath"], "src/cart.ts");
    assert_eq!(files[0]["lines"][0]["line"], 2);
    assert_eq!(files[0]["lines"][0]["ranges"], json!([[8, 13]]));

    // An older search id is refused once a newer one ran.
    let stale = call("text_search", json!({ "workspaceRoots": roots, "searchId": 0, "query": "lines" }));
    assert_eq!(stale[0]["done"], true);
    assert_eq!(stale[0]["matches"], 0);
    call("text_search_cancel", json!({ "searchId": 2 }));
    call("file_search_close", json!({}));
    let _ = std::fs::remove_dir_all(&dir);
}
