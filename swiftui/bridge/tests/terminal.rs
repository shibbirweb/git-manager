//! The integrated terminal through the C entry points: a real shell in a pseudo terminal, its output through the
//! callback, input, resize, acks, exit codes and Kill.

use std::ffi::{c_void, CStr, CString};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

use gm_bridge::{gm_call, gm_free_string, terminal_ffi::gm_terminal_spawn};
use serde_json::{json, Value};

#[derive(Default)]
struct Received {
    output: Vec<u8>,
    exit: Option<i32>,
    exited: bool,
}

type Shared = (Mutex<Received>, Condvar);

extern "C" fn collect(context: *mut c_void, _: u32, bytes: *const u8, length: usize, exit_code: i32, exited: bool) {
    // SAFETY: the context is the Arc the test leaked for this terminal; it outlives the terminal.
    let shared = unsafe { &*(context as *const Shared) };
    let mut received = shared.0.lock().unwrap();
    if exited {
        received.exited = true;
        received.exit = (exit_code != i32::MIN).then_some(exit_code);
    } else {
        // SAFETY: the bridge passes `length` readable bytes.
        received.output.extend_from_slice(unsafe { std::slice::from_raw_parts(bytes, length) });
    }
    shared.1.notify_all();
}

fn call(command: &str, args: Value) -> Value {
    let command = CString::new(command).unwrap();
    let args = CString::new(args.to_string()).unwrap();
    // SAFETY: both are NUL-terminated; the answer is freed below.
    unsafe {
        let raw = gm_call(command.as_ptr(), args.as_ptr());
        let reply: Value = serde_json::from_str(CStr::from_ptr(raw).to_str().unwrap()).unwrap();
        gm_free_string(raw);
        reply
    }
}

fn spawn(shared: &Arc<Shared>) -> u32 {
    let folder = std::env::temp_dir();
    let args = json!({ "shellId": "/bin/sh", "cwd": folder.to_string_lossy(), "cols": 80, "rows": 24 });
    let args = CString::new(args.to_string()).unwrap();
    let context = Arc::into_raw(Arc::clone(shared)) as *mut c_void;
    // SAFETY: valid string, a callback safe on any thread, and a context that is never freed.
    let reply: Value = unsafe {
        let raw = gm_terminal_spawn(args.as_ptr(), collect, context);
        let reply = serde_json::from_str(CStr::from_ptr(raw).to_str().unwrap()).unwrap();
        gm_free_string(raw);
        reply
    };
    assert_eq!(reply["ok"], true, "{reply}");
    assert_eq!(reply["value"]["shell"]["path"], "/bin/sh");
    reply["value"]["terminalId"].as_u64().unwrap() as u32
}

fn wait_for(shared: &Shared, what: &str, done: impl Fn(&Received) -> bool) {
    let deadline = Instant::now() + Duration::from_secs(10);
    let mut received = shared.0.lock().unwrap();
    while !done(&received) {
        let left = deadline.saturating_duration_since(Instant::now());
        assert!(!left.is_zero(), "no {what}; output so far: {}", String::from_utf8_lossy(&received.output));
        received = shared.1.wait_timeout(received, left).unwrap().0;
    }
}

fn write(terminal_id: u32, data: &str) {
    let reply = call("terminal_write", json!({ "terminalId": terminal_id, "data": data }));
    assert_eq!(reply["ok"], true, "{reply}");
}

#[test]
fn a_shell_runs_input_and_reports_its_exit_code() {
    let shared: Arc<Shared> = Arc::default();
    let terminal_id = spawn(&shared);
    write(terminal_id, "printf 'size %s\\n' \"$(stty size)\"\n");
    wait_for(&shared, "size line", |received| String::from_utf8_lossy(&received.output).contains("size 24 80"));
    let resized = call("terminal_resize", json!({ "terminalId": terminal_id, "cols": 100, "rows": 30 }));
    assert_eq!(resized["ok"], true, "{resized}");
    write(terminal_id, "printf 'now %s\\n' \"$(stty size)\"\n");
    wait_for(&shared, "resized line", |received| String::from_utf8_lossy(&received.output).contains("now 30 100"));
    let acked = call("terminal_ack", json!({ "terminalId": terminal_id, "byteCount": 64 }));
    assert_eq!(acked["ok"], true, "{acked}");
    write(terminal_id, "exit 3\n");
    wait_for(&shared, "exit", |received| received.exited);
    assert_eq!(shared.0.lock().unwrap().exit, Some(3));
}

#[test]
fn kill_ends_the_shell_without_an_exit_code() {
    let shared: Arc<Shared> = Arc::default();
    let terminal_id = spawn(&shared);
    write(terminal_id, "echo ready\n");
    wait_for(&shared, "ready", |received| String::from_utf8_lossy(&received.output).contains("ready"));
    let closed = call("terminal_close", json!({ "terminalId": terminal_id }));
    assert_eq!(closed["ok"], true, "{closed}");
    wait_for(&shared, "exit", |received| received.exited);
    assert_eq!(shared.0.lock().unwrap().exit, None);
    // Input to a closed terminal is ignored, not an error.
    write(terminal_id, "echo late\n");
}

#[test]
fn the_shell_list_names_sh_and_unknown_commands_fail() {
    let shells = call("terminal_shells", json!({}));
    assert_eq!(shells["ok"], true, "{shells}");
    let listed = shells["value"].as_array().unwrap();
    assert!(listed.iter().any(|shell| shell["path"] == "/bin/sh"), "{shells}");
    assert_eq!(listed.iter().filter(|shell| shell["isDefault"] == true).count(), 1);
    let unknown = call("terminal_nope", json!({}));
    assert_eq!(unknown["ok"], false);
}
