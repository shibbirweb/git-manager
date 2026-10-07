//! Runs one bridge command from the terminal, the way the SwiftUI app calls it:
//! cargo run --example call -- get_status '{"repoPath":"/path/to/repo"}'

use std::ffi::{CStr, CString};

fn main() {
    let mut args = std::env::args().skip(1);
    let command = args.next().unwrap_or_default();
    let args_json = args.next().unwrap_or_else(|| "{}".to_string());
    let command = CString::new(command).expect("command without NUL");
    let args_json = CString::new(args_json).expect("arguments without NUL");
    // SAFETY: both strings are NUL-terminated, and the reply is freed once below.
    unsafe {
        let reply = gm_bridge::gm_call(command.as_ptr(), args_json.as_ptr());
        if reply.is_null() {
            eprintln!("no reply");
            std::process::exit(1);
        }
        println!("{}", CStr::from_ptr(reply).to_string_lossy());
        gm_bridge::gm_free_string(reply);
    }
}
