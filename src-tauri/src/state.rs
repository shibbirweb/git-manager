use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicI32;
use std::sync::Mutex;

use notify_debouncer_full::{notify::RecommendedWatcher, Debouncer, NoCache};
use serde::Serialize;

use crate::file_search::FileSearch;
use crate::git_console::{self, GitConsole};
use crate::mcp::Mcp;
use crate::terminal::TerminalRegistry;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum LaunchMode {
    /// Normal GUI, optionally opening a repository passed on the command line.
    #[serde(rename_all = "camelCase")]
    App { repo_path: Option<String> },
    /// Launched by `git mergetool` with the four standard paths.
    #[serde(rename_all = "camelCase")]
    MergeTool {
        base: PathBuf,
        local: PathBuf,
        remote: PathBuf,
        merged: PathBuf,
    },
}

impl LaunchMode {
    /// `git-manager merge BASE LOCAL REMOTE MERGED` or `git-manager [repo-path]`.
    pub fn from_args(args: &[String]) -> LaunchMode {
        // Finder can append a legacy process serial number argument.
        let args: Vec<&String> = args.iter().filter(|arg| !arg.starts_with("-psn_")).collect();
        if args.first().map(|arg| arg.as_str()) == Some("merge") && args.len() >= 5 {
            return LaunchMode::MergeTool {
                base: PathBuf::from(args[1]),
                local: PathBuf::from(args[2]),
                remote: PathBuf::from(args[3]),
                merged: PathBuf::from(args[4]),
            };
        }
        let repo_path = args
            .first()
            .filter(|arg| !arg.starts_with('-'))
            .map(|arg| {
                std::fs::canonicalize(arg.as_str())
                    .map(|path| path.to_string_lossy().into_owned())
                    .unwrap_or_else(|_| arg.to_string())
            });
        LaunchMode::App { repo_path }
    }

    pub fn is_mergetool(&self) -> bool {
        matches!(self, LaunchMode::MergeTool { .. })
    }
}

/// Without a file id cache: on macOS and Windows the default cache walks every
/// file under the folder when watching starts (seconds on a big checkout) and
/// keeps all their paths in memory. It only matters for pairing renames, which
/// the watcher does not need: it only asks which repository changed.
pub type RepoWatcher = Debouncer<RecommendedWatcher, NoCache>;

pub struct AppState {
    pub launch: LaunchMode,
    /// Process exit code in mergetool mode: stays 1 (unresolved) until saved.
    pub mergetool_exit_code: AtomicI32,
    /// Keyed by workspace root; one watcher per workspace folder.
    pub watchers: Mutex<HashMap<String, RepoWatcher>>,
    /// Integrated terminal shells, killed at app exit.
    pub terminals: TerminalRegistry,
    /// The Search Everywhere indexes (files, then symbols on first use) and
    /// Find in Files, alive only while the popup is used.
    pub file_search: FileSearch,
    /// The Git Console's ring buffer of recent git commands (shared with git/cli.rs).
    pub git_console: &'static GitConsole,
    /// The MCP server; nothing runs until a switch turns it on.
    pub mcp: Mcp,
    /// The debug memory log (memory_log.rs), off unless the setting turns it on.
    pub memory_log: crate::memory_log::MemoryLog,
}

impl AppState {
    pub fn new(launch: LaunchMode) -> Self {
        AppState {
            launch,
            mergetool_exit_code: AtomicI32::new(1),
            watchers: Mutex::new(HashMap::new()),
            terminals: TerminalRegistry::default(),
            file_search: FileSearch::default(),
            git_console: git_console::global(),
            mcp: Mcp::default(),
            memory_log: crate::memory_log::MemoryLog::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::LaunchMode;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn repo_path(mode: LaunchMode) -> Option<String> {
        match mode {
            LaunchMode::App { repo_path } => repo_path,
            other => panic!("expected app mode, got {other:?}"),
        }
    }

    #[test]
    fn merge_arguments_select_mergetool_mode() {
        let mode = LaunchMode::from_args(&args(&["merge", "B", "L", "R", "M"]));
        assert!(mode.is_mergetool());
        let LaunchMode::MergeTool { base, local, remote, merged } = mode else {
            unreachable!();
        };
        assert_eq!(
            [base, local, remote, merged].map(|path| path.to_string_lossy().into_owned()),
            ["B", "L", "R", "M"].map(str::to_string)
        );

        let with_psn = LaunchMode::from_args(&args(&["-psn_0_12345", "merge", "B", "L", "R", "M"]));
        assert!(with_psn.is_mergetool());
    }

    #[test]
    fn incomplete_merge_arguments_are_not_mergetool_mode() {
        let mode = LaunchMode::from_args(&args(&["merge", "B", "L"]));
        assert!(!mode.is_mergetool());
    }

    #[test]
    fn repo_path_argument_is_canonicalized() {
        let dir = tempfile::TempDir::new().unwrap();
        let canonical = dir.path().canonicalize().unwrap().to_string_lossy().into_owned();
        let given = dir.path().to_string_lossy().into_owned();
        assert_eq!(repo_path(LaunchMode::from_args(&args(&[&given]))), Some(canonical));

        let missing = "/definitely/not/a/real/path";
        assert_eq!(repo_path(LaunchMode::from_args(&args(&[missing]))), Some(missing.to_string()));
    }

    #[test]
    fn no_args_flags_and_psn_open_nothing() {
        assert_eq!(repo_path(LaunchMode::from_args(&[])), None);
        assert_eq!(repo_path(LaunchMode::from_args(&args(&["-psn_0_12345"]))), None);
        assert_eq!(repo_path(LaunchMode::from_args(&args(&["--verbose"]))), None);
    }
}
