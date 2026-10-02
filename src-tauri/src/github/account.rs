//! Who is signed in: `~/.gitmanager/github.json` keeps the login and where the token
//! comes from (never the token itself), so the UI knows the account without a keychain
//! read or a network call.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::AppResult;

pub const GITHUB_HOST: &str = "github.com";
const FILE_NAME: &str = "github.json";

/// The REST API root for a host: api.github.com, or GitHub Enterprise's /api/v3.
pub fn api_base_for(host: &str) -> String {
    if host.eq_ignore_ascii_case(GITHUB_HOST) {
        "https://api.github.com".to_string()
    } else {
        format!("https://{host}/api/v3")
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AccountSource {
    /// A personal access token in the keychain.
    Token,
    /// `gh auth token`, asked on demand and never stored.
    GhCli,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAccount {
    pub host: String,
    pub login: String,
    #[serde(default)]
    pub name: Option<String>,
    pub source: AccountSource,
    /// Scopes Git Manager needs that a classic token lacks; empty when unknown (fine-grained tokens).
    #[serde(default)]
    pub missing_scopes: Vec<String>,
}

/// The saved account; a missing or unreadable file means signed out.
pub fn load(config_dir: &Path) -> Option<GitHubAccount> {
    let text = std::fs::read_to_string(config_dir.join(FILE_NAME)).ok()?;
    let account: GitHubAccount = serde_json::from_str(&text).ok()?;
    let valid = !account.login.trim().is_empty() && !account.host.trim().is_empty();
    valid.then_some(account)
}

/// Writes atomically (temp file and rename), creating the folder.
pub fn save(config_dir: &Path, account: &GitHubAccount) -> AppResult<()> {
    std::fs::create_dir_all(config_dir)?;
    let temp = config_dir.join(format!(".{FILE_NAME}.tmp"));
    let mut text = serde_json::to_string_pretty(account).unwrap_or_default();
    text.push('\n');
    std::fs::write(&temp, text)?;
    std::fs::rename(&temp, config_dir.join(FILE_NAME))?;
    Ok(())
}

pub fn remove(config_dir: &Path) -> AppResult<()> {
    match std::fs::remove_file(config_dir.join(FILE_NAME)) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.into()),
    }
}

/// Which of the scopes Share and Create Gist need a classic token lacks.
pub fn missing_scopes(scopes: Option<&[String]>) -> Vec<String> {
    let Some(scopes) = scopes else {
        return Vec::new();
    };
    let has = |scope: &str| scopes.iter().any(|granted| granted == scope);
    let mut missing = Vec::new();
    if !has("repo") {
        missing.push("repo".to_string());
    }
    if !has("gist") {
        missing.push("gist".to_string());
    }
    missing
}
