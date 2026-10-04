//! Integrated terminal: finds the installed shells and runs them in pseudo terminals.
//!
//! Every terminal has four parked threads: a writer (keystrokes stay in order and a
//! full PTY never blocks the caller), a reader (pauses while the view is behind), a
//! sender (merges output into few messages, see terminal_flow.rs) and a waiter (exit).

use std::collections::{HashMap, HashSet};
use std::io::{ErrorKind, Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::terminal_flow::OutputPump;

const READ_CHUNK_BYTES: usize = 16 * 1024;
/// How long the exit report waits for the last output once the shell has exited.
const OUTPUT_GRACE: Duration = Duration::from_millis(500);
/// Time a closed shell gets to handle SIGHUP before it is killed.
const KILL_GRACE: Duration = Duration::from_secs(2);
/// The same at app exit, kept short so quitting stays fast.
const SHUTDOWN_GRACE: Duration = Duration::from_millis(300);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShellProfile {
    /// The shell's absolute path.
    pub id: String,
    pub name: String,
    pub path: String,
    pub args: Vec<String>,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalInfo {
    pub terminal_id: u32,
    pub pid: Option<u32>,
    pub shell: ShellProfile,
    pub cwd: String,
}

// Shell detection

/// The shells this machine offers, the default one first. Never empty.
#[cfg(unix)]
pub fn shell_profiles() -> Vec<ShellProfile> {
    let listed = parse_etc_shells(&std::fs::read_to_string("/etc/shells").unwrap_or_default());
    // $SHELL, else the passwd entry: apps started from Finder may have no $SHELL.
    let login_shell = CommandBuilder::new_default_prog().get_shell();
    build_profiles(&listed, Some(login_shell.as_str()), executable_real_path)
}

/// The shells this machine offers, the default one first. Never empty.
#[cfg(windows)]
pub fn shell_profiles() -> Vec<ShellProfile> {
    let system_root = env_folder("SystemRoot").unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
    let program_folders: Vec<PathBuf> = ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"]
        .iter()
        .filter_map(|name| env_folder(name))
        .collect();
    let mut found: Vec<(&str, PathBuf, Vec<String>)> = Vec::new();

    let pwsh = find_in_path("pwsh.exe")
        .or_else(|| first_file(program_folders.iter().map(|folder| folder.join(r"PowerShell\7\pwsh.exe"))));
    if let Some(pwsh_path) = pwsh {
        found.push(("PowerShell", pwsh_path, vec!["-NoLogo".to_string()]));
    }
    let windows_powershell = system_root.join(r"System32\WindowsPowerShell\v1.0\powershell.exe");
    if windows_powershell.is_file() {
        found.push(("Windows PowerShell", windows_powershell, vec!["-NoLogo".to_string()]));
    }
    let cmd = env_folder("ComSpec")
        .filter(|cmd_path| cmd_path.is_file())
        .or_else(|| Some(system_root.join(r"System32\cmd.exe")).filter(|cmd_path| cmd_path.is_file()))
        .unwrap_or_else(|| PathBuf::from("cmd.exe"));
    found.push(("Command Prompt", cmd, Vec::new()));

    // Not looked up in PATH: System32\bash.exe there is WSL, not Git Bash.
    let mut git_folders = program_folders.clone();
    if let Some(local_programs) = env_folder("LOCALAPPDATA") {
        git_folders.push(local_programs.join("Programs"));
    }
    if let Some(git_bash) = first_file(git_folders.iter().map(|folder| folder.join(r"Git\bin\bash.exe"))) {
        found.push(("Git Bash", git_bash, vec!["--login".to_string(), "-i".to_string()]));
    }

    found
        .into_iter()
        .enumerate()
        .map(|(index, (name, shell_path, args))| {
            let path = shell_path.to_string_lossy().into_owned();
            ShellProfile {
                id: path.clone(),
                name: name.to_string(),
                path,
                args,
                is_default: index == 0,
            }
        })
        .collect()
}

#[cfg(windows)]
fn env_folder(name: &str) -> Option<PathBuf> {
    std::env::var_os(name).filter(|value| !value.is_empty()).map(PathBuf::from)
}

#[cfg(windows)]
fn find_in_path(file_name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    std::env::split_paths(&path_var)
        .map(|folder| folder.join(file_name))
        .find(|candidate| candidate.is_file())
}

#[cfg(windows)]
fn first_file(mut candidates: impl Iterator<Item = PathBuf>) -> Option<PathBuf> {
    candidates.find(|candidate| candidate.is_file())
}

/// Used when detection found nothing or the chosen shell is gone.
fn fallback_shell() -> ShellProfile {
    let (name, path) = if cfg!(windows) {
        ("Command Prompt", "cmd.exe")
    } else {
        ("sh", "/bin/sh")
    };
    ShellProfile {
        id: path.to_string(),
        name: name.to_string(),
        path: path.to_string(),
        args: Vec::new(),
        is_default: true,
    }
}

/// Absolute shell paths from /etc/shells; `#` starts a comment.
#[cfg(unix)]
fn parse_etc_shells(text: &str) -> Vec<String> {
    let mut shells: Vec<String> = Vec::new();
    for line in text.lines() {
        let shell_path = line.split('#').next().unwrap_or_default().trim();
        if shell_path.starts_with('/') && !shells.iter().any(|known| known == shell_path) {
            shells.push(shell_path.to_string());
        }
    }
    shells
}

/// Login shells read the user's profile so PATH matches Terminal.app on macOS.
#[cfg(unix)]
fn login_args(shell_name: &str) -> Vec<String> {
    match shell_name {
        "zsh" | "bash" | "fish" => vec!["-l".to_string()],
        _ => Vec::new(),
    }
}

/// The real file of an executable shell, None when it is missing or not executable.
#[cfg(unix)]
fn executable_real_path(shell_path: &str) -> Option<PathBuf> {
    use std::os::unix::fs::PermissionsExt;

    let metadata = std::fs::metadata(shell_path).ok()?;
    if !metadata.is_file() || metadata.permissions().mode() & 0o111 == 0 {
        return None;
    }
    std::fs::canonicalize(shell_path).ok()
}

/// One profile per real file, in /etc/shells order with the login shell first.
#[cfg(unix)]
fn build_profiles(
    listed: &[String],
    login_shell: Option<&str>,
    real_path: impl Fn(&str) -> Option<PathBuf>,
) -> Vec<ShellProfile> {
    let login_real = login_shell.and_then(&real_path);
    let mut seen: Vec<PathBuf> = Vec::new();
    let mut profiles: Vec<ShellProfile> = Vec::new();
    for shell_path in listed.iter().map(String::as_str).chain(login_shell) {
        let Some(real) = real_path(shell_path) else {
            continue;
        };
        if seen.contains(&real) {
            continue;
        }
        let is_default = login_real.as_ref() == Some(&real);
        seen.push(real);
        let name = std::path::Path::new(shell_path)
            .file_name()
            .map(|file_name| file_name.to_string_lossy().into_owned())
            .unwrap_or_else(|| shell_path.to_string());
        profiles.push(ShellProfile {
            id: shell_path.to_string(),
            args: login_args(&name),
            name,
            path: shell_path.to_string(),
            is_default,
        });
    }
    if profiles.is_empty() {
        return vec![fallback_shell()];
    }
    if !profiles.iter().any(|profile| profile.is_default) {
        profiles[0].is_default = true;
    }
    profiles.sort_by_key(|profile| !profile.is_default);
    profiles
}

/// The requested shell, else the default one.
fn pick_shell(profiles: Vec<ShellProfile>, shell_id: Option<&str>) -> ShellProfile {
    let requested = shell_id.and_then(|shell_id| profiles.iter().position(|profile| profile.id == shell_id));
    let index = requested
        .or_else(|| profiles.iter().position(|profile| profile.is_default))
        .unwrap_or(0);
    profiles.into_iter().nth(index).unwrap_or_else(fallback_shell)
}

fn home_folder() -> Option<PathBuf> {
    ["HOME", "USERPROFILE"]
        .iter()
        .filter_map(std::env::var_os)
        .find(|home| !home.is_empty())
        .map(PathBuf::from)
}

/// The requested folder when it exists, else the home folder.
fn resolve_cwd(cwd: Option<&str>, home: Option<PathBuf>) -> PathBuf {
    cwd.filter(|folder| !folder.is_empty())
        .map(PathBuf::from)
        .filter(|folder| folder.is_dir())
        .or_else(|| home.filter(|folder| folder.is_dir()))
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("/"))
}

/// Added to the app's own environment.
fn terminal_env(lang_is_set: bool) -> Vec<(&'static str, &'static str)> {
    let mut env = vec![
        ("TERM", "xterm-256color"),
        ("COLORTERM", "truecolor"),
        ("TERM_PROGRAM", "GitManager"),
        ("TERM_PROGRAM_VERSION", env!("CARGO_PKG_VERSION")),
    ];
    // Apps started from Finder get no LANG, and shells then mangle non-ASCII text.
    if !lang_is_set {
        env.push(("LANG", "en_US.UTF-8"));
    }
    env
}

// Processes

pub struct SpawnOptions {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub cols: u16,
    pub rows: u16,
    /// Set on top of the app's environment (a run's login-shell PATH); empty for shells.
    pub env: Vec<(String, String)>,
}

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows: rows.max(1),
        cols: cols.max(1),
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn exit_code(status: &portable_pty::ExitStatus) -> Option<i32> {
    if status.signal().is_some() {
        return None;
    }
    // Windows codes are u32; NTSTATUS values read as negative, like $LASTEXITCODE.
    Some(status.exit_code() as i32)
}

fn spawn_thread(thread_name: &str, work: impl FnOnce() + Send + 'static) -> AppResult<()> {
    std::thread::Builder::new()
        .name(thread_name.to_string())
        .spawn(work)
        .map(|_| ())
        .map_err(AppError::from)
}

/// A shell running in a PTY. Dropping it kills the shell.
pub struct PtyProcess {
    pid: Option<u32>,
    input: mpsc::Sender<Vec<u8>>,
    master: Box<dyn MasterPty + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    exited: Arc<AtomicBool>,
    killed: Arc<AtomicBool>,
    pump: Arc<OutputPump>,
}

/// Starts `options.program` in a new PTY. `on_output` gets the output in merged messages
/// on a sender thread; `on_exit` runs once on that thread after the output ended, with None
/// when the shell was killed or its code is unknown. Reading pauses while more than about
/// 2 MB were not acknowledged with `ack`.
pub fn spawn_pty(
    options: &SpawnOptions,
    on_output: impl FnMut(Vec<u8>) + Send + 'static,
    on_exit: impl FnOnce(Option<i32>) + Send + 'static,
) -> AppResult<PtyProcess> {
    let start_error = |reason: String| AppError::invalid(format!("Could not start {}: {reason}", options.program));
    let pair = native_pty_system()
        .openpty(pty_size(options.cols, options.rows))
        .map_err(|err| start_error(err.to_string()))?;

    let mut command = CommandBuilder::new(&options.program);
    command.args(&options.args);
    command.cwd(&options.cwd);
    for (key, value) in &options.env {
        command.env(key, value);
    }
    let lang_is_set = std::env::var_os("LANG").is_some_and(|lang| !lang.is_empty())
        || options.env.iter().any(|(key, value)| key == "LANG" && !value.is_empty());
    for (key, value) in terminal_env(lang_is_set) {
        command.env(key, value);
    }
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| start_error(err.to_string()))?;
    // Output only ends once every slave handle is closed, ours included.
    drop(pair.slave);

    let pid = child.process_id();
    let mut killer = child.clone_killer();
    let master = pair.master;
    let exited = Arc::new(AtomicBool::new(false));
    let killed = Arc::new(AtomicBool::new(false));
    let pump = Arc::new(OutputPump::new());
    let (input, input_queue) = mpsc::channel::<Vec<u8>>();

    let started = (|| -> AppResult<()> {
        let mut reader = master.try_clone_reader().map_err(|err| start_error(err.to_string()))?;
        let mut writer = master.take_writer().map_err(|err| start_error(err.to_string()))?;

        spawn_thread("terminal-writer", move || {
            for bytes in input_queue {
                if writer.write_all(&bytes).and_then(|()| writer.flush()).is_err() {
                    break;
                }
            }
        })?;

        let (output_done, output_ended) = mpsc::channel::<()>();
        let reader_pump = Arc::clone(&pump);
        spawn_thread("terminal-reader", move || {
            let mut buffer = vec![0u8; READ_CHUNK_BYTES];
            loop {
                reader_pump.wait_until_readable();
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(count) => reader_pump.push(&buffer[..count]),
                    Err(err) if err.kind() == ErrorKind::Interrupted => {}
                    // Linux reports EIO once the shell side is closed.
                    Err(_) => break,
                }
            }
            reader_pump.reader_finished();
            let _ = output_done.send(());
        })?;

        let exited = Arc::clone(&exited);
        let killed = Arc::clone(&killed);
        let waiter_pump = Arc::clone(&pump);
        spawn_thread("terminal-waiter", move || {
            let status = child.wait();
            exited.store(true, Ordering::SeqCst);
            // Only the PTY buffer is left: read it without waiting for acks.
            waiter_pump.release();
            // A background job can keep the PTY open after the shell exits; it must not hold back the exit.
            let _ = output_ended.recv_timeout(OUTPUT_GRACE);
            let code = status
                .ok()
                .filter(|_| !killed.load(Ordering::SeqCst))
                .and_then(|status| exit_code(&status));
            waiter_pump.finish(code);
        })?;

        // Started last, so it never waits for a reader or waiter that failed to start.
        let sender_pump = Arc::clone(&pump);
        spawn_thread("terminal-output", move || sender_pump.run_sender(on_output, on_exit))
    })();
    if let Err(err) = started {
        let _ = killer.kill();
        pump.release();
        return Err(err);
    }

    Ok(PtyProcess {
        pid,
        input,
        master,
        killer,
        exited,
        killed,
        pump,
    })
}

impl PtyProcess {
    pub fn pid(&self) -> Option<u32> {
        self.pid
    }

    pub fn has_exited(&self) -> bool {
        self.exited.load(Ordering::SeqCst)
    }

    /// Queues input for the writer thread; never blocks. Input after exit is dropped.
    pub fn write(&self, bytes: Vec<u8>) {
        let _ = self.input.send(bytes);
    }

    /// The view wrote `byte_count` more bytes of output; a paused reader may resume.
    pub fn ack(&self, byte_count: usize) {
        self.pump.ack(byte_count);
    }

    pub fn resize(&self, cols: u16, rows: u16) -> AppResult<()> {
        self.master
            .resize(pty_size(cols, rows))
            .map_err(|err| AppError::invalid(format!("Could not resize the terminal: {err}")))
    }

    /// Hangs up the shell and its jobs, and kills them if they are still running after a grace period.
    /// The exit callback still runs, without an exit code.
    pub fn kill(&mut self) {
        if self.has_exited() {
            return;
        }
        // A paused reader must read on to the end of output.
        self.pump.release();
        self.killed.store(true, Ordering::SeqCst);
        #[cfg(unix)]
        {
            let groups = self.process_groups();
            signal_groups(&groups, libc::SIGHUP);
            let exited = Arc::clone(&self.exited);
            let _ = spawn_thread("terminal-killer", move || {
                std::thread::sleep(KILL_GRACE);
                if !exited.load(Ordering::SeqCst) {
                    signal_groups(&groups, libc::SIGKILL);
                }
            });
        }
        let _ = self.killer.kill();
    }

    /// Kills right away; for app exit, where a grace thread would not outlive the app.
    fn force_kill(&mut self) {
        if self.has_exited() {
            return;
        }
        #[cfg(unix)]
        signal_groups(&self.process_groups(), libc::SIGKILL);
        let _ = self.killer.kill();
    }

    /// The shell's own group (its jobs without job control) and the foreground job's group.
    #[cfg(unix)]
    fn process_groups(&self) -> Vec<i32> {
        let mut groups: Vec<i32> = Vec::new();
        let shell_group = self.pid.and_then(|pid| i32::try_from(pid).ok());
        for group in [shell_group, self.master.process_group_leader()].into_iter().flatten() {
            if !groups.contains(&group) {
                groups.push(group);
            }
        }
        groups
    }
}

#[cfg(unix)]
fn signal_groups(groups: &[i32], signal: libc::c_int) {
    for &group in groups {
        // Never 0 or 1: kill(0) and kill(-1) would hit this app or every process of the user.
        if group > 1 {
            unsafe {
                libc::kill(-group, signal);
            }
        }
    }
}

impl Drop for PtyProcess {
    fn drop(&mut self) {
        self.kill();
    }
}

// Registry

/// The running terminals by id. Clones share the same terminals; the shells are
/// killed when the last clone is dropped.
#[derive(Clone, Default)]
pub struct TerminalRegistry {
    inner: Arc<RegistryInner>,
}

#[derive(Default)]
struct RegistryInner {
    last_terminal_id: AtomicU32,
    terminals: Mutex<HashMap<u32, PtyProcess>>,
    /// Shells that exited before `spawn` added them; only touched with `terminals` locked.
    exited_early: Mutex<HashSet<u32>>,
    /// The window each terminal belongs to: closing a window kills its shells, and a
    /// reloaded window only clears its own.
    owners: Mutex<HashMap<u32, String>>,
}

impl RegistryInner {
    fn terminals(&self) -> MutexGuard<'_, HashMap<u32, PtyProcess>> {
        self.terminals.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn exited_early(&self) -> MutexGuard<'_, HashSet<u32>> {
        self.exited_early.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn owners(&self) -> MutexGuard<'_, HashMap<u32, String>> {
        self.owners.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

impl TerminalRegistry {
    /// Starts a terminal; it leaves the registry by itself when its shell exits, before
    /// `on_exit(terminal_id, exit_code)` runs. Returns the terminal id and the shell's pid.
    pub fn spawn(
        &self,
        options: &SpawnOptions,
        on_output: impl FnMut(Vec<u8>) + Send + 'static,
        on_exit: impl FnOnce(u32, Option<i32>) + Send + 'static,
    ) -> AppResult<(u32, Option<u32>)> {
        let terminal_id = self.inner.last_terminal_id.fetch_add(1, Ordering::SeqCst) + 1;
        let registry = Arc::downgrade(&self.inner);
        // The lock is not held while the shell starts: writes and resizes of other
        // terminals run on the main thread and must never wait for a spawn. A shell
        // that exits before it is added is remembered and removed right after.
        let process = spawn_pty(options, on_output, move |exit_code| {
            if let Some(registry) = registry.upgrade() {
                let finished = {
                    let mut terminals = registry.terminals();
                    let finished = terminals.remove(&terminal_id);
                    if finished.is_none() {
                        registry.exited_early().insert(terminal_id);
                    }
                    finished
                };
                drop(finished);
                registry.owners().remove(&terminal_id);
            }
            on_exit(terminal_id, exit_code);
        })?;
        let pid = process.pid();
        let already_exited = {
            let mut terminals = self.inner.terminals();
            if self.inner.exited_early().remove(&terminal_id) {
                Some(process)
            } else {
                terminals.insert(terminal_id, process);
                None
            }
        };
        drop(already_exited);
        Ok((terminal_id, pid))
    }

    /// Unknown or exited terminals ignore input.
    pub fn write(&self, terminal_id: u32, bytes: Vec<u8>) {
        if let Some(process) = self.inner.terminals().get(&terminal_id) {
            process.write(bytes);
        }
    }

    /// Unknown or exited terminals ignore acks: their output is no longer held back.
    pub fn ack(&self, terminal_id: u32, byte_count: usize) {
        if let Some(process) = self.inner.terminals().get(&terminal_id) {
            process.ack(byte_count);
        }
    }

    pub fn resize(&self, terminal_id: u32, cols: u16, rows: u16) -> AppResult<()> {
        match self.inner.terminals().get(&terminal_id) {
            Some(process) => process.resize(cols, rows),
            None => Ok(()),
        }
    }

    /// Kills the shell; closing an unknown terminal is not an error.
    pub fn close(&self, terminal_id: u32) {
        let process = self.inner.terminals().remove(&terminal_id);
        drop(process);
    }

    #[cfg(test)]
    pub fn close_all(&self) {
        let processes: Vec<PtyProcess> = self.inner.terminals().drain().map(|(_, process)| process).collect();
        self.inner.owners().clear();
        drop(processes);
    }

    /// Records the window a terminal (or a script run) belongs to. A shell that already
    /// exited is not recorded.
    pub fn adopt(&self, terminal_id: u32, window_label: &str) {
        let terminals = self.inner.terminals();
        if terminals.contains_key(&terminal_id) {
            self.inner.owners().insert(terminal_id, window_label.to_string());
        }
    }

    /// Kills every shell of one window (it closed or reloaded); the other windows keep theirs.
    pub fn close_window(&self, window_label: &str) {
        let owned: Vec<u32> = self
            .inner
            .owners()
            .iter()
            .filter(|(_, owner)| owner.as_str() == window_label)
            .map(|(terminal_id, _)| *terminal_id)
            .collect();
        let processes: Vec<PtyProcess> = {
            let mut terminals = self.inner.terminals();
            owned.iter().filter_map(|terminal_id| terminals.remove(terminal_id)).collect()
        };
        {
            let mut owners = self.inner.owners();
            for terminal_id in &owned {
                owners.remove(terminal_id);
            }
        }
        drop(processes);
    }

    /// A starting page closes the shells its window left behind, except `keep`: the terminals
    /// that wait for it after Clear Cache.
    pub fn close_window_except(&self, window_label: &str, keep: &[u32]) {
        let owned: Vec<u32> = self
            .inner
            .owners()
            .iter()
            .filter(|(terminal_id, owner)| owner.as_str() == window_label && !keep.contains(terminal_id))
            .map(|(terminal_id, _)| *terminal_id)
            .collect();
        let processes: Vec<PtyProcess> = {
            let mut terminals = self.inner.terminals();
            owned.iter().filter_map(|terminal_id| terminals.remove(terminal_id)).collect()
        };
        {
            let mut owners = self.inner.owners();
            for terminal_id in &owned {
                owners.remove(terminal_id);
            }
        }
        drop(processes);
    }

    /// For app exit: hangs up every shell, waits briefly, then kills what is left.
    pub fn shutdown(&self) {
        let mut processes: Vec<PtyProcess> = self.inner.terminals().drain().map(|(_, process)| process).collect();
        self.inner.owners().clear();
        for process in &mut processes {
            process.kill();
        }
        let deadline = Instant::now() + SHUTDOWN_GRACE;
        while processes.iter().any(|process| !process.has_exited()) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        for process in &mut processes {
            process.force_kill();
        }
    }

    #[cfg(test)]
    pub fn is_running(&self, terminal_id: u32) -> bool {
        self.inner.terminals().contains_key(&terminal_id)
    }

    #[cfg(test)]
    pub fn owner_count(&self) -> usize {
        self.inner.owners().len()
    }
}

/// Starts the requested shell (else the default) in `cwd` (else the home folder).
pub fn start_terminal(
    registry: &TerminalRegistry,
    shell_id: Option<&str>,
    cwd: Option<&str>,
    cols: u16,
    rows: u16,
    on_output: impl FnMut(Vec<u8>) + Send + 'static,
    on_exit: impl FnOnce(u32, Option<i32>) + Send + 'static,
) -> AppResult<TerminalInfo> {
    let shell = pick_shell(shell_profiles(), shell_id);
    let cwd = resolve_cwd(cwd, home_folder());
    let options = SpawnOptions {
        program: shell.path.clone(),
        args: shell.args.clone(),
        cwd: cwd.clone(),
        cols,
        rows,
        env: Vec::new(),
    };
    let (terminal_id, pid) = registry.spawn(&options, on_output, on_exit)?;
    Ok(TerminalInfo {
        terminal_id,
        pid,
        shell,
        cwd: cwd.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_cwd_falls_back_to_home() {
        let home = tempfile::TempDir::new().unwrap();
        let project = tempfile::TempDir::new().unwrap();
        let home_path = home.path().to_path_buf();
        let project_path = project.path().to_string_lossy().into_owned();

        assert_eq!(resolve_cwd(Some(&project_path), Some(home_path.clone())), project.path());
        assert_eq!(resolve_cwd(Some("/definitely/not/a/folder"), Some(home_path.clone())), home_path);
        assert_eq!(resolve_cwd(Some(""), Some(home_path.clone())), home_path);
        assert_eq!(resolve_cwd(None, Some(home_path.clone())), home_path);
        let missing_home = resolve_cwd(None, Some(PathBuf::from("/definitely/not/home")));
        assert!(missing_home.is_dir());
    }

    #[test]
    fn lang_is_added_only_when_missing() {
        let has_lang = |env: &[(&str, &str)]| env.iter().any(|(key, _)| *key == "LANG");
        assert!(has_lang(&terminal_env(false)));
        assert!(!has_lang(&terminal_env(true)));
        assert!(terminal_env(true).contains(&("TERM", "xterm-256color")));
        assert!(terminal_env(true).contains(&("TERM_PROGRAM", "GitManager")));
    }

    #[test]
    fn unknown_shell_id_picks_the_default() {
        let profile = |shell_path: &str, is_default: bool| ShellProfile {
            id: shell_path.to_string(),
            name: shell_path.rsplit('/').next().unwrap_or_default().to_string(),
            path: shell_path.to_string(),
            args: Vec::new(),
            is_default,
        };
        let profiles = vec![profile("/bin/zsh", true), profile("/bin/bash", false)];
        assert_eq!(pick_shell(profiles.clone(), Some("/bin/bash")).id, "/bin/bash");
        assert_eq!(pick_shell(profiles.clone(), Some("/bin/nope")).id, "/bin/zsh");
        assert_eq!(pick_shell(profiles, None).id, "/bin/zsh");
        assert_eq!(pick_shell(Vec::new(), None), fallback_shell());
    }

    #[cfg(unix)]
    mod unix {
        use std::collections::HashMap;
        use std::path::PathBuf;
        use std::sync::{mpsc, Arc, Mutex};
        use std::time::{Duration, Instant};

        use super::super::*;

        const WAIT: Duration = Duration::from_secs(10);

        type Collected = Arc<Mutex<Vec<u8>>>;

        fn strings(values: &[&str]) -> Vec<String> {
            values.iter().map(|value| value.to_string()).collect()
        }

        fn sh(script: &str, cwd: PathBuf) -> SpawnOptions {
            SpawnOptions {
                program: "/bin/sh".to_string(),
                args: strings(&["-c", script]),
                cwd,
                cols: 80,
                rows: 24,
                env: Vec::new(),
            }
        }

        fn interactive_sh() -> SpawnOptions {
            SpawnOptions {
                program: "/bin/sh".to_string(),
                args: Vec::new(),
                cwd: std::env::temp_dir(),
                cols: 80,
                rows: 24,
                env: Vec::new(),
            }
        }

        /// An output callback and the text it collected so far.
        fn collector() -> (impl FnMut(Vec<u8>) + Send + 'static, Collected) {
            let collected = Arc::new(Mutex::new(Vec::new()));
            let sink = Arc::clone(&collected);
            (move |bytes: Vec<u8>| sink.lock().unwrap().extend_from_slice(&bytes), collected)
        }

        fn text(collected: &Collected) -> String {
            String::from_utf8_lossy(&collected.lock().unwrap()).into_owned()
        }

        fn wait_for_text(collected: &Collected, needle: &str) -> bool {
            let deadline = Instant::now() + WAIT;
            while Instant::now() < deadline {
                if text(collected).contains(needle) {
                    return true;
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            false
        }

        #[test]
        fn etc_shells_skips_comments_blanks_and_duplicates() {
            let text = "# List of acceptable shells\n\n/bin/bash\n  /bin/zsh  \n/bin/bash\n/bin/sh # posix\nnot/absolute\n#/bin/csh\n";
            assert_eq!(parse_etc_shells(text), strings(&["/bin/bash", "/bin/zsh", "/bin/sh"]));
            assert!(parse_etc_shells("").is_empty());
        }

        #[test]
        fn login_flag_only_for_login_capable_shells() {
            assert_eq!(login_args("zsh"), strings(&["-l"]));
            assert_eq!(login_args("bash"), strings(&["-l"]));
            assert_eq!(login_args("fish"), strings(&["-l"]));
            assert!(login_args("sh").is_empty());
            assert!(login_args("dash").is_empty());
        }

        #[test]
        fn profiles_dedupe_by_real_file_and_put_the_login_shell_first() {
            let real: HashMap<&str, &str> = HashMap::from([
                ("/bin/sh", "/bin/sh"),
                ("/bin/bash", "/usr/bin/bash"),
                ("/usr/bin/bash", "/usr/bin/bash"),
                ("/bin/zsh", "/bin/zsh"),
                ("/opt/homebrew/bin/fish", "/opt/homebrew/bin/fish"),
            ]);
            let real_path = |shell_path: &str| real.get(shell_path).map(PathBuf::from);
            let listed = strings(&["/bin/sh", "/bin/bash", "/usr/bin/bash", "/bin/missing", "/bin/zsh"]);

            let profiles = build_profiles(&listed, Some("/bin/zsh"), real_path);
            let ids: Vec<&str> = profiles.iter().map(|profile| profile.id.as_str()).collect();
            assert_eq!(ids, ["/bin/zsh", "/bin/sh", "/bin/bash"]);
            assert!(profiles[0].is_default);
            assert_eq!(profiles.iter().filter(|profile| profile.is_default).count(), 1);
            assert_eq!(profiles[0].name, "zsh");
            assert_eq!(profiles[0].args, strings(&["-l"]));
            assert!(profiles[1].args.is_empty());

            // A login shell missing from /etc/shells is still offered, as the default.
            let profiles = build_profiles(&listed, Some("/opt/homebrew/bin/fish"), real_path);
            assert_eq!(profiles[0].id, "/opt/homebrew/bin/fish");
            assert!(profiles[0].is_default);
            assert_eq!(profiles.len(), 4);

            // No usable login shell: the first listed one becomes the default.
            let profiles = build_profiles(&listed, Some("/bin/missing"), real_path);
            assert_eq!(profiles[0].id, "/bin/sh");
            assert!(profiles[0].is_default);

            assert_eq!(build_profiles(&[], None, real_path), vec![fallback_shell()]);
        }

        #[test]
        fn detected_shells_exist_and_have_one_default() {
            let profiles = shell_profiles();
            assert!(!profiles.is_empty());
            assert!(profiles[0].is_default);
            assert_eq!(profiles.iter().filter(|profile| profile.is_default).count(), 1);
        }

        #[test]
        fn command_output_and_exit_code_reach_the_callbacks() {
            let (on_output, collected) = collector();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let process = spawn_pty(
                &sh("printf 'hello from %s' terminal; exit 7", std::env::temp_dir()),
                on_output,
                move |exit_code| {
                    let _ = exit_sender.send(exit_code);
                },
            )
            .unwrap();
            assert!(process.pid().is_some());
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap(), Some(7));
            // All output is delivered before the exit is reported.
            assert!(text(&collected).contains("hello from terminal"));
        }

        #[test]
        fn terminal_environment_is_set() {
            let (on_output, collected) = collector();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let _process = spawn_pty(
                &sh("printf '[%s|%s|%s]' \"$TERM\" \"$COLORTERM\" \"$TERM_PROGRAM\"", std::env::temp_dir()),
                on_output,
                move |exit_code| {
                    let _ = exit_sender.send(exit_code);
                },
            )
            .unwrap();
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap(), Some(0));
            assert!(text(&collected).contains("[xterm-256color|truecolor|GitManager]"));
        }

        #[test]
        fn shell_starts_in_the_given_folder() {
            let folder = tempfile::TempDir::new().unwrap();
            let real_folder = folder.path().canonicalize().unwrap();
            let (on_output, collected) = collector();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let _process = spawn_pty(&sh("pwd -P", folder.path().to_path_buf()), on_output, move |exit_code| {
                let _ = exit_sender.send(exit_code);
            })
            .unwrap();
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap(), Some(0));
            assert!(text(&collected).contains(&*real_folder.to_string_lossy()));
        }

        #[test]
        fn input_reaches_an_interactive_shell() {
            let (on_output, collected) = collector();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let process = spawn_pty(&interactive_sh(), on_output, move |exit_code| {
                let _ = exit_sender.send(exit_code);
            })
            .unwrap();
            // The tty echoes the typed line, so look for what only the shell can print.
            process.write(b"echo hi; echo \"$((6*7))-ok\"\n".to_vec());
            assert!(wait_for_text(&collected, "42-ok"));
            assert!(text(&collected).contains("hi"));
            process.write(b"exit 3\n".to_vec());
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap(), Some(3));
        }

        #[test]
        fn resize_changes_the_terminal_size() {
            let (on_output, collected) = collector();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let process = spawn_pty(&interactive_sh(), on_output, move |exit_code| {
                let _ = exit_sender.send(exit_code);
            })
            .unwrap();
            process.resize(100, 30).unwrap();
            process.resize(0, 0).unwrap();
            process.resize(101, 31).unwrap();
            process.write(b"stty size\nexit\n".to_vec());
            assert!(exit_receiver.recv_timeout(WAIT).is_ok());
            assert!(text(&collected).contains("31 101"));
        }

        #[test]
        fn registry_close_kills_a_running_command() {
            let registry = TerminalRegistry::default();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let (terminal_id, _pid) = registry
                .spawn(&sh("sleep 30", std::env::temp_dir()), |_bytes: Vec<u8>| {}, move |terminal_id, exit_code| {
                    let _ = exit_sender.send((terminal_id, exit_code));
                })
                .unwrap();
            assert!(registry.is_running(terminal_id));
            registry.resize(terminal_id, 120, 40).unwrap();

            let started = Instant::now();
            registry.close(terminal_id);
            assert!(!registry.is_running(terminal_id));
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap(), (terminal_id, None));
            assert!(started.elapsed() < Duration::from_secs(2));
        }

        #[test]
        fn a_restarted_page_keeps_the_shells_waiting_for_it() {
            let registry = TerminalRegistry::default();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let spawn = || {
                let exit_sender = exit_sender.clone();
                let (terminal_id, _pid) = registry
                    .spawn(&sh("sleep 30", std::env::temp_dir()), |_bytes: Vec<u8>| {}, move |terminal_id, exit_code| {
                        let _ = exit_sender.send((terminal_id, exit_code));
                    })
                    .unwrap();
                registry.adopt(terminal_id, "main");
                terminal_id
            };
            let kept = spawn();
            let stale = spawn();
            registry.close_window_except("main", &[kept]);
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap().0, stale);
            assert!(registry.is_running(kept));
            registry.close(kept);
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap().0, kept);
        }

        #[test]
        fn closing_a_window_kills_only_its_own_shells() {
            let registry = TerminalRegistry::default();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let spawn = |window_label: &str| {
                let exit_sender = exit_sender.clone();
                let (terminal_id, _pid) = registry
                    .spawn(&sh("sleep 30", std::env::temp_dir()), |_bytes: Vec<u8>| {}, move |terminal_id, exit_code| {
                        let _ = exit_sender.send((terminal_id, exit_code));
                    })
                    .unwrap();
                registry.adopt(terminal_id, window_label);
                terminal_id
            };
            let first = spawn("main");
            let second = spawn("window-2");
            let third = spawn("window-2");
            assert_eq!(registry.owner_count(), 3);

            registry.close_window("window-2");
            let mut exited = vec![exit_receiver.recv_timeout(WAIT).unwrap().0, exit_receiver.recv_timeout(WAIT).unwrap().0];
            exited.sort();
            assert_eq!(exited, vec![second, third]);
            assert!(registry.is_running(first), "the other window keeps its shell");
            assert!(!registry.is_running(second) && !registry.is_running(third));
            registry.close_window("window-9");
            assert!(registry.is_running(first));

            registry.close(first);
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap().0, first);
            // The exit forgets the owner too; adopting a finished terminal records nothing.
            assert_eq!(registry.owner_count(), 0);
            registry.adopt(first, "main");
            assert_eq!(registry.owner_count(), 0);
        }

        #[test]
        fn a_shell_ignoring_hangup_is_killed_after_the_grace_period() {
            let registry = TerminalRegistry::default();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let (on_output, collected) = collector();
            let (terminal_id, _pid) = registry
                .spawn(
                    &sh("trap '' HUP; echo ready; while true; do sleep 1; done", std::env::temp_dir()),
                    on_output,
                    move |terminal_id, exit_code| {
                        let _ = exit_sender.send((terminal_id, exit_code));
                    },
                )
                .unwrap();
            assert!(wait_for_text(&collected, "ready"));
            registry.close(terminal_id);
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap(), (terminal_id, None));
        }

        #[test]
        fn exited_terminals_leave_the_registry() {
            let registry = TerminalRegistry::default();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let (terminal_id, _pid) = registry
                .spawn(&sh("exit 0", std::env::temp_dir()), |_bytes: Vec<u8>| {}, move |terminal_id, exit_code| {
                    let _ = exit_sender.send((terminal_id, exit_code));
                })
                .unwrap();
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap(), (terminal_id, Some(0)));
            assert!(!registry.is_running(terminal_id));

            // Unknown terminals are ignored, not errors.
            registry.write(terminal_id, b"echo late\n".to_vec());
            registry.resize(terminal_id, 80, 24).unwrap();
            registry.close(terminal_id);
            registry.close(999);
        }

        #[test]
        fn shells_that_exit_at_once_never_stay_in_the_registry() {
            // The registry is not locked while a shell starts, so a shell can exit before it is added.
            let registry = TerminalRegistry::default();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let mut terminal_ids = Vec::new();
            for _ in 0..12 {
                let exit_sender = exit_sender.clone();
                let (terminal_id, _pid) = registry
                    .spawn(&sh("exit 0", std::env::temp_dir()), |_bytes: Vec<u8>| {}, move |terminal_id, exit_code| {
                        let _ = exit_sender.send((terminal_id, exit_code));
                    })
                    .unwrap();
                terminal_ids.push(terminal_id);
            }
            for _ in &terminal_ids {
                exit_receiver.recv_timeout(WAIT).unwrap();
            }
            for terminal_id in terminal_ids {
                assert!(!registry.is_running(terminal_id));
            }
            assert!(registry.inner.exited_early().is_empty());
        }

        #[test]
        fn close_all_and_shutdown_stop_every_terminal() {
            let registry = TerminalRegistry::default();
            let (exit_sender, exit_receiver) = mpsc::channel();
            let mut terminal_ids = Vec::new();
            for _ in 0..4 {
                let exit_sender = exit_sender.clone();
                let (terminal_id, _pid) = registry
                    .spawn(&sh("sleep 30", std::env::temp_dir()), |_bytes: Vec<u8>| {}, move |terminal_id, exit_code| {
                        let _ = exit_sender.send((terminal_id, exit_code));
                    })
                    .unwrap();
                terminal_ids.push(terminal_id);
            }
            assert!(terminal_ids.windows(2).all(|pair| pair[1] == pair[0] + 1));
            assert!(terminal_ids.iter().all(|terminal_id| registry.is_running(*terminal_id)));

            registry.close_all();
            for _ in 0..4 {
                assert!(exit_receiver.recv_timeout(WAIT).unwrap().1.is_none());
            }
            for _ in 0..2 {
                let exit_sender = exit_sender.clone();
                registry
                    .spawn(&sh("sleep 30", std::env::temp_dir()), |_bytes: Vec<u8>| {}, move |terminal_id, exit_code| {
                        let _ = exit_sender.send((terminal_id, exit_code));
                    })
                    .unwrap();
            }
            registry.shutdown();
            for _ in 0..2 {
                assert!(exit_receiver.recv_timeout(WAIT).unwrap().1.is_none());
            }
        }

        #[test]
        fn output_pauses_without_acks_and_every_byte_arrives_before_the_exit() {
            use crate::terminal_flow::HIGH_WATERMARK;

            const TOTAL_BYTES: usize = 8_000_000;
            let (message_sender, messages) = mpsc::channel::<Result<Vec<u8>, Option<i32>>>();
            let exit_sender = message_sender.clone();
            let process = spawn_pty(
                &sh(&format!("head -c {TOTAL_BYTES} /dev/zero | tr '\\0' x"), std::env::temp_dir()),
                move |bytes: Vec<u8>| {
                    let _ = message_sender.send(Ok(bytes));
                },
                move |exit_code| {
                    let _ = exit_sender.send(Err(exit_code));
                },
            )
            .unwrap();
            let mut received = Received::default();

            // Without acks the reader stops just above the high watermark.
            let deadline = Instant::now() + WAIT;
            while received.bytes <= HIGH_WATERMARK && Instant::now() < deadline {
                assert_eq!(received.take(&messages, Duration::from_millis(20)), None);
            }
            let paused_at = received.bytes;
            assert!(paused_at > HIGH_WATERMARK, "{paused_at} bytes");
            let quiet_until = Instant::now() + Duration::from_millis(300);
            while Instant::now() < quiet_until {
                assert_eq!(received.take(&messages, Duration::from_millis(20)), None);
            }
            assert!(received.bytes <= HIGH_WATERMARK + READ_CHUNK_BYTES, "{} bytes", received.bytes);
            // A lost ack never stalls it: reading resumes after a second.
            let deadline = Instant::now() + WAIT;
            while received.bytes == paused_at && Instant::now() < deadline {
                assert_eq!(received.take(&messages, Duration::from_millis(20)), None);
            }
            assert!(received.bytes > paused_at);

            // Acked as it is written, the rest flows to the end, then the exit.
            let mut acked = 0;
            let deadline = Instant::now() + WAIT;
            let exit_code = loop {
                process.ack(received.bytes - acked);
                acked = received.bytes;
                if let Some(exit_code) = received.take(&messages, Duration::from_millis(20)) {
                    break exit_code;
                }
                assert!(Instant::now() < deadline, "the output did not end");
            };
            assert_eq!(exit_code, Some(0));
            assert_eq!(received.bytes, TOTAL_BYTES);
            // Merged: far fewer messages than the PTY reads of about 1 KB.
            assert!(received.messages < TOTAL_BYTES / 16_384, "{} messages", received.messages);
        }

        type Messages = mpsc::Receiver<Result<Vec<u8>, Option<i32>>>;

        /// What arrived on the output messages so far.
        #[derive(Default)]
        struct Received {
            bytes: usize,
            messages: usize,
        }

        impl Received {
            /// Takes one message; Some with the exit code once the exit arrived.
            fn take(&mut self, messages: &Messages, wait: Duration) -> Option<Option<i32>> {
                match messages.recv_timeout(wait) {
                    Ok(Ok(bytes)) => {
                        assert!(bytes.len() <= crate::terminal_flow::MAX_MESSAGE_BYTES);
                        assert!(bytes.iter().all(|byte| *byte == b'x'));
                        self.bytes += bytes.len();
                        self.messages += 1;
                        None
                    }
                    Ok(Err(exit_code)) => Some(exit_code),
                    Err(_) => None,
                }
            }
        }

        #[test]
        fn dropping_the_registry_kills_its_shells() {
            let registry = TerminalRegistry::default();
            let (exit_sender, exit_receiver) = mpsc::channel();
            registry
                .spawn(&sh("sleep 30", std::env::temp_dir()), |_bytes: Vec<u8>| {}, move |_terminal_id, exit_code| {
                    let _ = exit_sender.send(exit_code);
                })
                .unwrap();
            drop(registry);
            assert_eq!(exit_receiver.recv_timeout(WAIT).unwrap(), None);
        }
    }
}
