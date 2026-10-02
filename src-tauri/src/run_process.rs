//! Runs a project script as its own process in a PTY, like JetBrains' Run window: no shell
//! is typed into, so it works the same with zsh, fish, PowerShell or cmd. The Node version
//! goes first on the process's PATH.
//!
//! Apps opened from Finder (or a Linux desktop launcher) get a bare PATH without Homebrew,
//! nvm, pnpm or Composer. Like JetBrains, the login shell's environment is read once and
//! used for runs; the Scripts panel's Refresh reads it again.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use crate::error::{AppError, AppResult};
use crate::terminal::{ShellProfile, SpawnOptions, TerminalInfo, TerminalRegistry};

/// A shell whose startup files wait for input or hang must not stall a run for long.
#[cfg(unix)]
const CAPTURE_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(unix)]
const ENV_MARKER: &str = "__GIT_MANAGER_ENV__";

/// Variables of the capturing shell itself, not of the user's setup.
const SKIPPED_VARIABLES: &[&str] = &["_", "PWD", "OLDPWD", "SHLVL", "PS1", "PS2", "TERM", "TERM_PROGRAM", "TERM_PROGRAM_VERSION"];

static LOGIN_ENV: Mutex<Option<Vec<(String, String)>>> = Mutex::new(None);

/// Reads the environment again in the background (the Scripts panel opened or refreshed),
/// so newly installed tools are found and the first run does not wait about a second for
/// the shell's startup files. A run that starts meanwhile waits for this read.
pub fn reload_login_env() {
    // All on the thread: the caller never waits for a read that is already going on.
    std::thread::spawn(|| {
        let mut cached = LOGIN_ENV.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        *cached = Some(capture_login_env().unwrap_or_else(fallback_env));
    });
}

/// The login shell's environment, read on first use; the app's own when it cannot be read.
/// The lock is held while reading, so two runs never read it twice.
fn login_env() -> Vec<(String, String)> {
    let mut cached = LOGIN_ENV.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(env) = cached.as_ref() {
        return env.clone();
    }
    let env = capture_login_env().unwrap_or_else(fallback_env);
    *cached = Some(env.clone());
    env
}

#[cfg(unix)]
fn capture_login_env() -> Option<Vec<(String, String)>> {
    use std::io::Read;
    use std::process::{Command, Stdio};

    let shell = portable_pty::CommandBuilder::new_default_prog().get_shell();
    // -i loads .zshrc / .bashrc, where nvm and most PATH changes live. Whatever the startup
    // files print comes before the marker and is skipped.
    let script = format!("printf '\\n%s\\n' {ENV_MARKER}; /usr/bin/env -0");
    let mut child = Command::new(&shell)
        .args(["-l", "-i", "-c", &script])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let mut stdout = child.stdout.take()?;
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = stdout.read_to_end(&mut bytes);
        let _ = sender.send(bytes);
    });
    let bytes = receiver.recv_timeout(CAPTURE_TIMEOUT).ok();
    let _ = child.kill();
    let _ = child.wait();
    let env = parse_env_output(&bytes?);
    env.iter().any(|(key, _)| key == "PATH").then_some(env)
}

#[cfg(windows)]
fn capture_login_env() -> Option<Vec<(String, String)>> {
    // Windows apps get the user's full environment from Explorer already.
    None
}

/// The app's own environment, with the usual tool folders added to a bare PATH.
fn fallback_env() -> Vec<(String, String)> {
    let mut env: Vec<(String, String)> = std::env::vars().filter(|(key, _)| !SKIPPED_VARIABLES.contains(&key.as_str())).collect();
    #[cfg(unix)]
    {
        let extra = ["/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin", "/home/linuxbrew/.linuxbrew/bin"];
        let path = env.iter().find(|(key, _)| key == "PATH").map(|(_, value)| value.clone()).unwrap_or_default();
        let mut folders: Vec<PathBuf> = std::env::split_paths(&path).collect();
        for folder in extra.iter().map(PathBuf::from).rev() {
            if folder.is_dir() && !folders.contains(&folder) {
                folders.insert(0, folder);
            }
        }
        let joined = std::env::join_paths(folders).map(|value| value.to_string_lossy().into_owned()).unwrap_or(path);
        set_var(&mut env, "PATH", joined);
    }
    env
}

/// `env -0` output after the marker: NUL-separated KEY=VALUE pairs.
#[cfg(unix)]
fn parse_env_output(bytes: &[u8]) -> Vec<(String, String)> {
    let text = String::from_utf8_lossy(bytes);
    let marker = format!("\n{ENV_MARKER}\n");
    let Some(start) = text.find(&marker) else {
        return Vec::new();
    };
    text[start + marker.len()..]
        .split('\0')
        .filter_map(|pair| pair.split_once('='))
        .filter(|(key, _)| !key.is_empty() && !key.contains('\n') && !SKIPPED_VARIABLES.contains(key))
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect()
}

fn set_var(env: &mut Vec<(String, String)>, key: &str, value: String) {
    // Windows names are case-insensitive (Path vs PATH).
    let same = |name: &str| if cfg!(windows) { name.eq_ignore_ascii_case(key) } else { name == key };
    env.retain(|(name, _)| !same(name));
    env.push((key.to_string(), value));
}

fn path_value(env: &[(String, String)]) -> String {
    env.iter()
        .find(|(key, _)| if cfg!(windows) { key.eq_ignore_ascii_case("PATH") } else { key == "PATH" })
        .map(|(_, value)| value.clone())
        .unwrap_or_default()
}

/// `bin_dir` first, then the rest of PATH without it.
pub fn path_with(bin_dir: &Path, path: &str) -> String {
    let mut folders = vec![bin_dir.to_path_buf()];
    folders.extend(std::env::split_paths(path).filter(|folder| !folder.as_os_str().is_empty() && folder != bin_dir));
    std::env::join_paths(folders)
        .map(|joined: OsString| joined.to_string_lossy().into_owned())
        .unwrap_or_else(|_| path.to_string())
}

/// The program's file in the PATH folders; on Windows also with PATHEXT's endings (npm.cmd).
pub fn resolve_program(name: &str, path: &str, extensions: &[String]) -> Option<PathBuf> {
    let candidate = Path::new(name);
    if candidate.is_absolute() {
        return candidate.is_file().then(|| candidate.to_path_buf());
    }
    for folder in std::env::split_paths(path) {
        if extensions.is_empty() {
            let file = folder.join(name);
            if is_executable(&file) {
                return Some(file);
            }
            continue;
        }
        for extension in extensions {
            let file = folder.join(format!("{name}{extension}"));
            if file.is_file() {
                return Some(file);
            }
        }
    }
    None
}

#[cfg(unix)]
fn is_executable(file: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    file.metadata().is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
}

#[cfg(windows)]
fn is_executable(file: &Path) -> bool {
    file.is_file()
}

fn program_extensions(env: &[(String, String)]) -> Vec<String> {
    if !cfg!(windows) {
        return Vec::new();
    }
    let pathext = env
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case("PATHEXT"))
        .map(|(_, value)| value.clone())
        .unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".to_string());
    pathext.split(';').filter(|extension| !extension.is_empty()).map(str::to_lowercase).collect()
}

/// npm, pnpm and yarn are .cmd files on Windows, which only cmd.exe can start.
fn launch_command(program: &Path, args: &[String]) -> (String, Vec<String>) {
    let is_batch = program
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("cmd") || extension.eq_ignore_ascii_case("bat"));
    let program_text = program.to_string_lossy().into_owned();
    if cfg!(windows) && is_batch {
        let mut cmd_args = vec!["/d".to_string(), "/c".to_string(), program_text];
        cmd_args.extend(args.iter().cloned());
        return ("cmd.exe".to_string(), cmd_args);
    }
    (program_text, args.to_vec())
}

pub struct RunRequest {
    /// The tool to start, looked up on PATH: "pnpm", "composer", "make"...
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    /// A Node version's bin folder to put first on PATH.
    pub node_bin_dir: Option<String>,
    pub cols: u16,
    pub rows: u16,
}

/// The environment and resolved program for a run, or why it cannot start.
pub fn prepare(request: &RunRequest, base_env: Vec<(String, String)>) -> AppResult<(SpawnOptions, ShellProfile)> {
    let mut env = base_env;
    if let Some(bin_dir) = request.node_bin_dir.as_deref().filter(|folder| !folder.is_empty()) {
        let joined = path_with(Path::new(bin_dir), &path_value(&env));
        set_var(&mut env, "PATH", joined);
    }
    let program = resolve_program(&request.program, &path_value(&env), &program_extensions(&env)).ok_or_else(|| {
        AppError::invalid(format!(
            "{} was not found. Install it, or add its folder to PATH in your shell's startup file.",
            request.program
        ))
    })?;
    let cwd = PathBuf::from(&request.cwd);
    if !cwd.is_dir() {
        return Err(AppError::invalid(format!("The folder {} does not exist.", request.cwd)));
    }
    let (launcher, args) = launch_command(&program, &request.args);
    let program_text = program.to_string_lossy().into_owned();
    let profile = ShellProfile {
        id: program_text.clone(),
        name: request.program.clone(),
        path: program_text,
        args: request.args.clone(),
        is_default: false,
    };
    let options = SpawnOptions {
        program: launcher,
        args,
        cwd,
        cols: request.cols,
        rows: request.rows,
        env,
    };
    Ok((options, profile))
}

/// Starts the run; output and exit arrive like a terminal's.
pub fn start_run(
    registry: &TerminalRegistry,
    request: &RunRequest,
    on_output: impl FnMut(&[u8]) + Send + 'static,
    on_exit: impl FnOnce(u32, Option<i32>) + Send + 'static,
) -> AppResult<TerminalInfo> {
    let (options, profile) = prepare(request, login_env())?;
    let cwd = options.cwd.to_string_lossy().into_owned();
    let (terminal_id, pid) = registry.spawn(&options, on_output, on_exit)?;
    Ok(TerminalInfo {
        terminal_id,
        pid,
        shell: profile,
        cwd,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn reads_the_environment_after_the_marker() {
        let output = format!("Welcome!\x1b]1337;junk\x07\n{ENV_MARKER}\nPATH=/a:/b\0HOME=/h\0_=/usr/bin/env\0MULTI=one\ntwo\0EMPTY=\0");
        let env = parse_env_output(output.as_bytes());
        assert_eq!(
            env,
            vec![
                ("PATH".to_string(), "/a:/b".to_string()),
                ("HOME".to_string(), "/h".to_string()),
                ("MULTI".to_string(), "one\ntwo".to_string()),
                ("EMPTY".to_string(), String::new()),
            ],
        );
        assert!(parse_env_output(b"no marker\0PATH=/x").is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn puts_the_node_folder_first_once() {
        assert_eq!(path_with(Path::new("/n/v20/bin"), "/usr/bin:/n/v20/bin:/bin"), "/n/v20/bin:/usr/bin:/bin");
        assert_eq!(path_with(Path::new("/n/v18/bin"), ""), "/n/v18/bin");
    }

    #[cfg(unix)]
    #[test]
    fn finds_programs_on_path_and_explains_a_missing_one() {
        use std::os::unix::fs::PermissionsExt;
        let temp = tempfile::tempdir().unwrap();
        let node_bin = temp.path().join("node20/bin");
        let tools = temp.path().join("tools");
        std::fs::create_dir_all(&node_bin).unwrap();
        std::fs::create_dir_all(&tools).unwrap();
        for (folder, name) in [(&node_bin, "npm"), (&tools, "npm"), (&tools, "pnpm")] {
            let file = folder.join(name);
            std::fs::write(&file, "#!/bin/sh\n").unwrap();
            std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        // Not executable: skipped.
        std::fs::write(tools.join("make"), "").unwrap();
        let path = tools.to_string_lossy().into_owned();
        let base = vec![("PATH".to_string(), path.clone()), ("HOME".to_string(), "/h".to_string())];

        let request = RunRequest {
            program: "npm".to_string(),
            args: vec!["run".to_string(), "dev".to_string()],
            cwd: temp.path().to_string_lossy().into_owned(),
            node_bin_dir: Some(node_bin.to_string_lossy().into_owned()),
            cols: 80,
            rows: 24,
        };
        let (options, profile) = prepare(&request, base.clone()).unwrap();
        assert_eq!(options.program, node_bin.join("npm").to_string_lossy());
        assert_eq!(options.args, vec!["run", "dev"]);
        assert_eq!(profile.name, "npm");
        let env_path = options.env.iter().find(|(key, _)| key == "PATH").unwrap().1.clone();
        assert_eq!(env_path, format!("{}:{path}", node_bin.to_string_lossy()));
        assert!(options.env.iter().any(|(key, value)| key == "HOME" && value == "/h"));

        let without_node = RunRequest { node_bin_dir: None, ..request };
        let (options, _) = prepare(&without_node, base.clone()).unwrap();
        assert_eq!(options.program, tools.join("npm").to_string_lossy());

        let missing = RunRequest { program: "make".to_string(), ..without_node };
        let error = prepare(&missing, base).err().unwrap();
        assert!(error.to_string().contains("make was not found"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn a_run_starts_the_program_without_a_shell_and_reports_its_exit_code() {
        use std::sync::mpsc;
        let temp = tempfile::tempdir().unwrap();
        let request = RunRequest {
            program: "sh".to_string(),
            args: vec!["-c".to_string(), "printf 'node is %s\\n' \"$(command -v node)\"; exit 3".to_string()],
            cwd: temp.path().to_string_lossy().into_owned(),
            node_bin_dir: Some("/opt/node-20/bin".to_string()),
            cols: 80,
            rows: 24,
        };
        let base = vec![("PATH".to_string(), "/usr/bin:/bin".to_string())];
        let (options, _) = prepare(&request, base).unwrap();
        let registry = TerminalRegistry::default();
        let (output_sender, output) = mpsc::channel::<Vec<u8>>();
        let (exit_sender, exit) = mpsc::channel::<Option<i32>>();
        registry
            .spawn(
                &options,
                move |bytes| {
                    let _ = output_sender.send(bytes.to_vec());
                },
                move |_, code| {
                    let _ = exit_sender.send(code);
                },
            )
            .unwrap();
        assert_eq!(exit.recv_timeout(Duration::from_secs(10)).unwrap(), Some(3));
        let text: String = output.try_iter().map(|bytes| String::from_utf8_lossy(&bytes).into_owned()).collect();
        // The process saw the Node folder first on its PATH, though no node lives there.
        assert!(text.contains("node is"), "{text}");
        let path = options.env.iter().find(|(key, _)| key == "PATH").unwrap().1.clone();
        assert_eq!(path, "/opt/node-20/bin:/usr/bin:/bin");
    }

    #[test]
    fn batch_files_start_through_cmd_on_windows_only() {
        let (program, args) = launch_command(Path::new("/tools/npm.cmd"), &["run".to_string(), "dev".to_string()]);
        if cfg!(windows) {
            assert_eq!(program, "cmd.exe");
            assert_eq!(args, vec!["/d", "/c", "/tools/npm.cmd", "run", "dev"]);
        } else {
            assert_eq!(program, "/tools/npm.cmd");
            assert_eq!(args, vec!["run", "dev"]);
        }
    }
}
