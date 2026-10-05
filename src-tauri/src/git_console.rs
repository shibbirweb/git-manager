//! The Git Console: every git command run through
//! `git/cli.rs` is recorded with its arguments, duration, exit code and the start of its
//! output. Credentials are masked before anything is stored. Reads done through git2 are not
//! git commands and never appear here.

use std::cell::Cell;
use std::collections::VecDeque;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;

/// Entries kept; older ones are dropped first.
pub const MAX_ENTRIES: usize = 500;
/// Bytes of stdout and of stderr kept per command.
pub const MAX_OUTPUT_BYTES: usize = 16 * 1024;
/// Output kept for all entries together, so 500 large outputs never pile up.
pub const MAX_TOTAL_OUTPUT_BYTES: usize = 4 * 1024 * 1024;

const MASK: &str = "***";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommandEntry {
    pub id: u64,
    /// Milliseconds since the epoch.
    pub started_at: u64,
    pub repo_path: String,
    /// The arguments after `git`, credentials masked.
    pub args: Vec<String>,
    pub running: bool,
    pub duration_ms: Option<u64>,
    /// None while running, when git could not start or when a signal ended it.
    pub exit_code: Option<i32>,
    pub success: bool,
    /// Why git could not run at all.
    pub error: Option<String>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
}

impl GitCommandEntry {
    fn output_bytes(&self) -> usize {
        self.stdout.len() + self.stderr.len()
    }
}

/// How a recorded command ended.
pub enum Finish<'a> {
    Exited {
        exit_code: Option<i32>,
        stdout: &'a [u8],
        stderr: &'a [u8],
    },
    Failed(&'a str),
}

type Emitter = Box<dyn Fn(&GitCommandEntry) + Send + Sync>;

struct Buffer {
    entries: VecDeque<GitCommandEntry>,
    next_id: u64,
    output_bytes: usize,
}

pub struct GitConsole {
    capacity: usize,
    output_budget: usize,
    /// Off (the Git Console setting): nothing is recorded and the buffer holds no memory.
    enabled: AtomicBool,
    buffer: Mutex<Buffer>,
    emitter: OnceLock<Emitter>,
}

impl GitConsole {
    pub fn new(capacity: usize, output_budget: usize) -> GitConsole {
        GitConsole {
            capacity: capacity.max(1),
            output_budget,
            enabled: AtomicBool::new(true),
            buffer: Mutex::new(Buffer {
                entries: VecDeque::new(),
                next_id: 1,
                output_bytes: 0,
            }),
            emitter: OnceLock::new(),
        }
    }

    /// Called with every new and every finished entry (the "git-command" event). Set once.
    pub fn set_emitter(&self, emitter: impl Fn(&GitCommandEntry) + Send + Sync + 'static) {
        let _ = self.emitter.set(Box::new(emitter));
    }

    fn emit(&self, entry: &GitCommandEntry) {
        if let Some(emitter) = self.emitter.get() {
            emitter(entry);
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Buffer> {
        // A panic while holding the lock leaves plain data behind: keep using it.
        self.buffer.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn evict(&self, buffer: &mut Buffer) {
        while buffer.entries.len() > self.capacity
            || (buffer.output_bytes > self.output_budget && buffer.entries.len() > 1)
        {
            let Some(oldest) = buffer.entries.pop_front() else {
                break;
            };
            buffer.output_bytes -= oldest.output_bytes();
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }

    /// Turning it off drops every entry and the buffer's allocation.
    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::Relaxed);
        if !enabled {
            self.clear();
        }
    }

    /// Records a command that is starting and returns its id; None while the console is off.
    pub fn start(&self, repo_path: &Path, args: &[&str]) -> Option<u64> {
        let entry = {
            let mut buffer = self.lock();
            // Checked under the lock so a command starting while it is turned off never stays behind.
            if !self.is_enabled() {
                return None;
            }
            let id = buffer.next_id;
            buffer.next_id += 1;
            let entry = GitCommandEntry {
                id,
                started_at: now_ms(),
                repo_path: crate::paths::to_ui(repo_path),
                args: redact_args(args),
                running: true,
                duration_ms: None,
                exit_code: None,
                success: false,
                error: None,
                stdout: String::new(),
                stderr: String::new(),
                stdout_truncated: false,
                stderr_truncated: false,
            };
            buffer.entries.push_back(entry.clone());
            self.evict(&mut buffer);
            entry
        };
        self.emit(&entry);
        Some(entry.id)
    }

    /// Completes an entry; one already dropped from the buffer is only announced.
    pub fn finish(&self, id: u64, duration_ms: u64, finish: Finish<'_>) {
        let updated = {
            let mut buffer = self.lock();
            let Some(position) = buffer.entries.iter().rposition(|entry| entry.id == id) else {
                return;
            };
            let previous_bytes = buffer.entries[position].output_bytes();
            let entry = &mut buffer.entries[position];
            entry.running = false;
            entry.duration_ms = Some(duration_ms);
            match finish {
                Finish::Exited { exit_code, stdout, stderr } => {
                    entry.exit_code = exit_code;
                    entry.success = exit_code == Some(0);
                    (entry.stdout, entry.stdout_truncated) = capture(stdout);
                    (entry.stderr, entry.stderr_truncated) = capture(stderr);
                }
                Finish::Failed(message) => {
                    entry.success = false;
                    entry.error = Some(redact_text(message));
                }
            }
            let updated = entry.clone();
            buffer.output_bytes = buffer.output_bytes - previous_bytes + updated.output_bytes();
            self.evict(&mut buffer);
            updated
        };
        self.emit(&updated);
    }

    pub fn entries(&self) -> Vec<GitCommandEntry> {
        self.lock().entries.iter().cloned().collect()
    }

    pub fn clear(&self) {
        let mut buffer = self.lock();
        // A new deque, not clear(), so the memory of up to MAX_ENTRIES entries is given back.
        buffer.entries = VecDeque::new();
        buffer.output_bytes = 0;
    }
}

/// The console every git command of the app is recorded in. It starts off; the UI turns it on
/// from the Git Console setting once settings are loaded.
pub fn global() -> &'static GitConsole {
    static CONSOLE: OnceLock<GitConsole> = OnceLock::new();
    CONSOLE.get_or_init(|| {
        let console = GitConsole::new(MAX_ENTRIES, MAX_TOTAL_OUTPUT_BYTES);
        console.set_enabled(false);
        console
    })
}

/// One running command. Finish it with `finish` or `fail`; dropping it unfinished (an early
/// return) records it as failed, so no entry stays "running" forever.
pub struct CommandRecord {
    console: &'static GitConsole,
    /// None when the console was off: nothing to finish.
    id: Option<u64>,
    started: Instant,
    done: Cell<bool>,
}

impl CommandRecord {
    fn elapsed_ms(&self) -> u64 {
        u64::try_from(self.started.elapsed().as_millis()).unwrap_or(u64::MAX)
    }

    pub fn finish(&self, exit_code: Option<i32>, stdout: &[u8], stderr: &[u8]) {
        if self.done.replace(true) {
            return;
        }
        if let Some(id) = self.id {
            self.console.finish(id, self.elapsed_ms(), Finish::Exited { exit_code, stdout, stderr });
        }
    }

    /// Records why git could not run and hands the error back, for `map_err`.
    pub fn fail<E: std::fmt::Display>(&self, error: E) -> E {
        if !self.done.replace(true) {
            if let Some(id) = self.id {
                self.console.finish(id, self.elapsed_ms(), Finish::Failed(&error.to_string()));
            }
        }
        error
    }
}

impl Drop for CommandRecord {
    fn drop(&mut self) {
        if !self.done.get() {
            self.fail("git did not finish");
        }
    }
}

/// Starts recording a git command in the global console.
pub fn record(repo_path: &Path, args: &[&str]) -> CommandRecord {
    let console = global();
    CommandRecord {
        console,
        id: console.start(repo_path, args),
        started: Instant::now(),
        done: Cell::new(false),
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or_default()
}

/// The first `MAX_OUTPUT_BYTES` of an output as text, credentials masked, and whether it was cut.
fn capture(bytes: &[u8]) -> (String, bool) {
    let truncated = bytes.len() > MAX_OUTPUT_BYTES;
    let kept = &bytes[..bytes.len().min(MAX_OUTPUT_BYTES)];
    let mut text = String::from_utf8_lossy(kept).into_owned();
    if truncated {
        // The cut may split a character: drop the replacement it turned into.
        while text.ends_with('\u{FFFD}') {
            text.pop();
        }
    }
    (redact_text(&text), truncated)
}

// Redaction

/// Config keys and options whose value is a secret.
const SECRET_KEYS: [&str; 7] = ["extraheader", "password", "passwd", "token", "secret", "authorization", "cookie"];

/// Prefixes of access tokens (GitHub, GitLab) masked wherever they appear.
const TOKEN_PREFIXES: [&str; 7] = ["ghp_", "gho_", "ghu_", "ghs_", "ghr_", "github_pat_", "glpat-"];

pub fn redact_args(args: &[&str]) -> Vec<String> {
    args.iter().map(|arg| redact_arg(arg)).collect()
}

/// Masks the secret part of one argument: `key=value` with a secret key
/// (`http.extraheader=...`, `--password=...`), URL passwords and access tokens.
pub fn redact_arg(arg: &str) -> String {
    if let Some((key, _)) = arg.split_once('=') {
        let lower = key.to_ascii_lowercase();
        if SECRET_KEYS.iter().any(|secret| lower.contains(secret)) {
            return format!("{}={MASK}", redact_text(key));
        }
    }
    redact_text(arg)
}

/// Masks credentials in free text: `scheme://user:password@host`, `scheme://token@host`,
/// `Bearer <token>` / `Basic <token>` and known access token formats.
pub fn redact_text(text: &str) -> String {
    let text = redact_url_userinfo(text);
    let text = redact_auth_schemes(&text);
    redact_token_prefixes(&text)
}

fn ends_authority(character: char) -> bool {
    character == '/' || character == '?' || character == '#' || character.is_whitespace() || "'\"<>`".contains(character)
}

fn looks_like_token(value: &str) -> bool {
    TOKEN_PREFIXES.iter().any(|prefix| value.starts_with(prefix))
        || (value.len() >= 20 && value.chars().all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-'))
}

fn redact_url_userinfo(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(scheme_end) = rest.find("://") {
        let authority_start = scheme_end + 3;
        result.push_str(&rest[..authority_start]);
        let after = &rest[authority_start..];
        let authority_len = after.find(ends_authority).unwrap_or(after.len());
        let authority = &after[..authority_len];
        match authority.rfind('@') {
            Some(at) => {
                let userinfo = &authority[..at];
                match userinfo.split_once(':') {
                    Some((user, _)) => {
                        result.push_str(user);
                        result.push(':');
                        result.push_str(MASK);
                    }
                    None if looks_like_token(userinfo) => result.push_str(MASK),
                    None => result.push_str(userinfo),
                }
                result.push_str(&authority[at..]);
            }
            None => result.push_str(authority),
        }
        rest = &after[authority_len..];
    }
    result.push_str(rest);
    result
}

/// Masks the word after "Bearer " or "Basic " (any case), as in an Authorization header.
fn redact_auth_schemes(text: &str) -> String {
    let lower = text.to_ascii_lowercase();
    let mut result = String::with_capacity(text.len());
    let mut position = 0;
    while position < text.len() {
        let found = ["bearer ", "basic "]
            .iter()
            .filter_map(|scheme| lower[position..].find(scheme).map(|offset| (position + offset, scheme.len())))
            .min();
        let Some((start, scheme_len)) = found else {
            break;
        };
        let value_start = start + scheme_len;
        let value_len = text[value_start..]
            .find(|character: char| character.is_whitespace() || "'\"".contains(character))
            .unwrap_or(text.len() - value_start);
        result.push_str(&text[position..value_start]);
        if value_len > 0 {
            result.push_str(MASK);
        }
        position = value_start + value_len;
    }
    result.push_str(&text[position..]);
    result
}

fn redact_token_prefixes(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut position = 0;
    while position < text.len() {
        let found = TOKEN_PREFIXES
            .iter()
            .filter_map(|prefix| text[position..].find(prefix).map(|offset| position + offset))
            .filter(|start| {
                // Only at a word start, so "my_ghp_notes" stays as it is.
                text[..*start]
                    .chars()
                    .next_back()
                    .is_none_or(|before| !(before.is_ascii_alphanumeric() || before == '_'))
            })
            .min();
        let Some(start) = found else {
            break;
        };
        let token_len = text[start..]
            .find(|character: char| !(character.is_ascii_alphanumeric() || character == '_' || character == '-'))
            .unwrap_or(text.len() - start);
        result.push_str(&text[position..start]);
        result.push_str(MASK);
        position = start + token_len;
    }
    result.push_str(&text[position..]);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex as StdMutex};

    #[test]
    fn redacts_url_passwords_and_tokens() {
        assert_eq!(redact_arg("https://user:hunter2@github.com/o/r.git"), "https://user:***@github.com/o/r.git");
        assert_eq!(
            redact_arg("https://ghp_abcdefghijklmnopqrstuvwxyz0123456789@github.com/o/r"),
            "https://***@github.com/o/r"
        );
        // A plain user name stays: it is not a secret.
        assert_eq!(redact_arg("ssh://git@github.com/o/r.git"), "ssh://git@github.com/o/r.git");
        assert_eq!(redact_arg("https://github.com/o/r.git"), "https://github.com/o/r.git");
        assert_eq!(redact_arg("origin"), "origin");
        assert_eq!(
            redact_text("fatal: unable to access 'https://me:pa:ss@host/x/': 403"),
            "fatal: unable to access 'https://me:***@host/x/': 403"
        );
    }

    #[test]
    fn redacts_secret_config_values() {
        assert_eq!(
            redact_args(&["-c", "http.extraheader=AUTHORIZATION: basic dXNlcjpwYXNz", "fetch"]),
            vec!["-c", "http.extraheader=***", "fetch"]
        );
        assert_eq!(
            redact_arg("http.https://github.com/.extraHeader=Authorization: Bearer abc"),
            "http.https://github.com/.extraHeader=***"
        );
        assert_eq!(redact_arg("--password=secret"), "--password=***");
        assert_eq!(redact_arg("user.name=Jane Doe"), "user.name=Jane Doe");
        assert_eq!(redact_arg("--format=%H %s"), "--format=%H %s");
    }

    #[test]
    fn redacts_auth_headers_and_token_formats_in_text() {
        assert_eq!(redact_text("Authorization: Bearer abc.def ok"), "Authorization: Bearer *** ok");
        assert_eq!(redact_text("token ghp_123456 used"), "token *** used");
        assert_eq!(redact_text("glpat-AbC_12-x3"), "***");
        assert_eq!(redact_text("my_ghp_notes stays"), "my_ghp_notes stays");
        assert_eq!(redact_text("no secrets here"), "no secrets here");
        assert_eq!(redact_text(""), "");
    }

    #[test]
    fn keeps_at_most_capacity_entries_dropping_the_oldest() {
        let console = GitConsole::new(3, usize::MAX);
        let ids: Vec<u64> = (0..5).map(|index| console.start(Path::new("/r"), &["status", &index.to_string()]).unwrap()).collect();
        let kept = console.entries();
        assert_eq!(kept.len(), 3);
        assert_eq!(kept.iter().map(|entry| entry.id).collect::<Vec<_>>(), ids[2..].to_vec());
        // Finishing a dropped entry is harmless.
        console.finish(ids[0], 1, Finish::Exited { exit_code: Some(0), stdout: b"", stderr: b"" });
        assert_eq!(console.entries().len(), 3);
        console.clear();
        assert!(console.entries().is_empty());
        let next = console.start(Path::new("/r"), &["log"]).unwrap();
        assert!(next > ids[4], "ids keep increasing after a clear");
    }

    #[test]
    fn records_nothing_while_off_and_drops_what_it_had() {
        let console = GitConsole::new(10, usize::MAX);
        let seen: Arc<StdMutex<Vec<GitCommandEntry>>> = Arc::default();
        let sink = Arc::clone(&seen);
        console.set_emitter(move |entry| sink.lock().unwrap().push(entry.clone()));
        let running = console.start(Path::new("/r"), &["fetch"]).unwrap();

        console.set_enabled(false);
        assert!(!console.is_enabled());
        assert!(console.entries().is_empty());
        assert_eq!(console.lock().entries.capacity(), 0, "the buffer's memory is given back");
        assert_eq!(console.start(Path::new("/r"), &["push"]), None);
        // A command that was running when it was turned off finishes quietly.
        console.finish(running, 1, Finish::Exited { exit_code: Some(0), stdout: b"done", stderr: b"" });
        assert!(console.entries().is_empty());
        assert_eq!(seen.lock().unwrap().len(), 1, "only the start before turning it off was announced");

        console.set_enabled(true);
        assert!(console.start(Path::new("/r"), &["log"]).is_some());
        assert_eq!(console.entries().len(), 1);
    }

    #[test]
    fn caps_output_per_stream_and_in_total() {
        let console = GitConsole::new(10, 3 * MAX_OUTPUT_BYTES);
        let big = vec![b'x'; MAX_OUTPUT_BYTES + 100];
        let first = console.start(Path::new("/r"), &["log"]).unwrap();
        console.finish(first, 5, Finish::Exited { exit_code: Some(0), stdout: &big, stderr: b"warning\n" });
        let entry = console.entries().pop().unwrap();
        assert_eq!(entry.stdout.len(), MAX_OUTPUT_BYTES);
        assert!(entry.stdout_truncated);
        assert_eq!(entry.stderr, "warning\n");
        assert!(!entry.stderr_truncated);

        for _ in 0..3 {
            let id = console.start(Path::new("/r"), &["log"]).unwrap();
            console.finish(id, 5, Finish::Exited { exit_code: Some(0), stdout: &big, stderr: b"" });
        }
        let entries = console.entries();
        assert_eq!(entries.len(), 3, "the oldest output went over the total budget");
        assert!(entries.iter().all(|entry| entry.id != first));
    }

    #[test]
    fn a_cut_never_splits_a_character() {
        let mut bytes = vec![b'a'; MAX_OUTPUT_BYTES - 1];
        bytes.extend("é and more".as_bytes());
        let (text, truncated) = capture(&bytes);
        assert!(truncated);
        assert!(!text.contains('\u{FFFD}'));
        assert_eq!(text.len(), MAX_OUTPUT_BYTES - 1);
    }

    #[test]
    fn entries_go_from_running_to_finished_and_are_announced() {
        let console = GitConsole::new(10, usize::MAX);
        let seen: Arc<StdMutex<Vec<GitCommandEntry>>> = Arc::default();
        let sink = Arc::clone(&seen);
        console.set_emitter(move |entry| sink.lock().unwrap().push(entry.clone()));

        let id = console.start(Path::new("/repo"), &["push", "https://u:p@h/x"]).unwrap();
        let running = console.entries().pop().unwrap();
        assert!(running.running);
        assert_eq!(running.args, vec!["push", "https://u:***@h/x"]);
        assert_eq!(running.repo_path, "/repo");
        assert!(running.started_at > 0);

        console.finish(id, 42, Finish::Exited { exit_code: Some(1), stdout: b"", stderr: b"rejected\n" });
        let done = console.entries().pop().unwrap();
        assert!(!done.running);
        assert!(!done.success);
        assert_eq!(done.exit_code, Some(1));
        assert_eq!(done.duration_ms, Some(42));
        assert_eq!(done.stderr, "rejected\n");

        let failed = console.start(Path::new("/repo"), &["status"]).unwrap();
        console.finish(failed, 0, Finish::Failed("Could not start git: not found"));
        let failed = console.entries().pop().unwrap();
        assert_eq!(failed.error.as_deref(), Some("Could not start git: not found"));
        assert!(!failed.success);

        let events = seen.lock().unwrap();
        assert_eq!(events.len(), 4);
        assert!(events[0].running && !events[1].running);
    }

    #[test]
    fn real_git_commands_are_recorded_and_a_dropped_record_is_marked_failed() {
        global().set_enabled(true);
        let repo = crate::test_support::TestRepo::new();
        let marker = "--gm-console-marker";
        crate::git::cli::run(&repo.path, &["rev-parse", "--show-toplevel"]).unwrap();
        let _ = crate::git::cli::run(&repo.path, &["status", marker]);
        let entries: Vec<GitCommandEntry> =
            global().entries().into_iter().filter(|entry| entry.repo_path == repo.path_string()).collect();
        let ok = entries.iter().find(|entry| entry.args == ["rev-parse", "--show-toplevel"]).expect("recorded");
        assert!(ok.success && !ok.running);
        assert_eq!(ok.exit_code, Some(0));
        assert!(ok.stdout.trim_end().ends_with("repo"));
        let bad = entries.iter().find(|entry| entry.args.iter().any(|arg| arg == marker)).expect("recorded");
        assert!(!bad.success);
        assert_ne!(bad.exit_code, Some(0));
        assert!(!bad.stderr.is_empty());

        let dropped_id = {
            let record = record(&repo.path, &["gm-dropped-marker"]);
            record.id.expect("the console is on")
        };
        let dropped = global().entries().into_iter().find(|entry| entry.id == dropped_id).expect("recorded");
        assert!(!dropped.running);
        assert_eq!(dropped.error.as_deref(), Some("git did not finish"));
    }
}
