//! The current app's GitHub code (src-tauri/src/github) without its Tauri commands and tests: the bridge's commands
//! are commands/github.rs.

#[path = "../../../../src-tauri/src/github/account.rs"]
pub mod account;
#[path = "../../../../src-tauri/src/github/client.rs"]
pub mod client;
#[path = "../../../../src-tauri/src/github/gh.rs"]
pub mod gh;
#[path = "../../../../src-tauri/src/github/http.rs"]
pub mod http;
#[path = "../../../../src-tauri/src/github/secrets.rs"]
pub mod secrets;
#[path = "../../../../src-tauri/src/github/service.rs"]
pub mod service;
