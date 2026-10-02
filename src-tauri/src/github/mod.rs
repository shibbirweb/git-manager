//! GitHub account features of the Git > GitHub submenu: Share Project on GitHub, Sync Fork
//! and Create Gist. A personal access token (kept only in the keychain) or the GitHub CLI
//! signs the REST calls; git writes still go through the git CLI.

pub mod account;
pub mod client;
pub mod commands;
pub mod gh;
pub mod http;
pub mod secrets;
pub mod service;

#[cfg(test)]
mod tests;
