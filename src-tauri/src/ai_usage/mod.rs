//! The status bar's AI usage, like Orca: how much of each agent's rate limits is used. Claude Code's comes from
//! Anthropic's usage endpoint, asked with Claude Code's own sign-in (read from the Keychain each time, never stored
//! or sent anywhere else); Codex's from the rate limits it writes into its session files. Nothing else is read.

mod claude;
mod codex;
mod time;

use std::path::PathBuf;

use serde::Serialize;

use crate::github::http::HttpTransport;

/// One rate-limit window: the 5-hour session or the week.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    /// 0 to 100.
    pub used_percent: f64,
    pub window_minutes: u32,
    /// When the window resets, in ms since the epoch.
    pub resets_at: Option<i64>,
}

/// A weekly limit of one model only, such as Claude Code's Fable weekly limit.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelWindow {
    /// The model's name as the provider gives it, such as "Fable".
    pub model: String,
    pub window: UsageWindow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UsageStatus {
    Ok,
    /// The agent's sign-in is missing or expired.
    SignedOut,
    /// Signed in, but no numbers yet (Codex records them after a turn).
    NoData,
    Error,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUsage {
    /// "claude" or "codex", the agent ids of the AI panel.
    pub provider: &'static str,
    pub status: UsageStatus,
    pub session: Option<UsageWindow>,
    pub weekly: Option<UsageWindow>,
    /// Weekly limits of single models (Claude Code's Fable weekly); empty when there are none.
    pub model_weekly: Vec<ModelWindow>,
    /// The plan, such as "max" or "pro", when the agent says.
    pub plan: Option<String>,
    /// Why there are no numbers, for the tooltip.
    pub message: Option<String>,
}

impl ProviderUsage {
    fn without_numbers(provider: &'static str, status: UsageStatus, message: impl Into<String>) -> ProviderUsage {
        ProviderUsage {
            provider,
            status,
            session: None,
            weekly: None,
            model_weekly: Vec::new(),
            plan: None,
            message: Some(message.into()),
        }
    }
}

/// Where the agents keep their files: the login shell's home (what the agents themselves see), else the app's.
fn agent_home() -> Option<PathBuf> {
    crate::run_process::login_var("HOME").map(PathBuf::from).or_else(|| crate::config::home_dir().ok())
}

/// The usage of every agent that has been set up on this computer (its folder exists), Claude Code first.
/// `fresh` (the user pressed Refresh) also asks the Keychain again after a refusal. `hidden` providers are skipped
/// entirely: no Keychain, no network, no files.
pub fn read_all(transport: &dyn HttpTransport, fresh: bool, hidden: &[String]) -> Vec<ProviderUsage> {
    if fresh {
        claude::allow_keychain_again();
    }
    let Some(home) = agent_home() else {
        return Vec::new();
    };
    let mut usages = Vec::new();
    let claude_dir = crate::run_process::login_var("CLAUDE_CONFIG_DIR").map(PathBuf::from).unwrap_or_else(|| home.join(".claude"));
    if wanted("claude", hidden) && claude_dir.is_dir() {
        let user = crate::run_process::login_var("USER").or_else(|| std::env::var("USER").ok());
        usages.push(claude::usage(transport, &claude_dir, user.as_deref(), time::now_ms()));
    }
    let codex_dir = crate::run_process::login_var("CODEX_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".codex"));
    if wanted("codex", hidden) && codex_dir.is_dir() {
        usages.push(codex::usage(&codex_dir, time::now_ms()));
    }
    usages
}

fn wanted(provider: &str, hidden: &[String]) -> bool {
    !hidden.iter().any(|name| name == provider)
}

/// The window lengths agents use: anything up to a day is the session window, longer is the week.
fn is_session_window(window_minutes: u32) -> bool {
    window_minutes <= 24 * 60
}

fn clamp_percent(value: f64) -> f64 {
    value.clamp(0.0, 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_hidden_provider_is_not_wanted() {
        let hidden = vec!["codex".to_string()];
        assert!(wanted("claude", &hidden));
        assert!(!wanted("codex", &hidden));
        assert!(wanted("codex", &[]));
    }
}
