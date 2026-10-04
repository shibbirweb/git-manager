//! The commit identity (user.name and user.email). Values are read with git2, written with
//! `git config`, and whether git would commit with a configured identity is asked from git
//! itself (`git var` with `user.useConfigOnly`), so includes, `includeIf` and the
//! environment count exactly as they do for `git commit`.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use git2::{Config, ConfigLevel};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::git::{cli, repo as git_repo};

pub const NAME_KEY: &str = "user.name";
pub const EMAIL_KEY: &str = "user.email";

const MAX_NAME_LENGTH: usize = 200;
const MAX_EMAIL_LENGTH: usize = 254;

/// Environment variables that give git an identity without any config.
const IDENTITY_ENV: [&str; 5] = [
    "GIT_AUTHOR_NAME",
    "GIT_AUTHOR_EMAIL",
    "GIT_COMMITTER_NAME",
    "GIT_COMMITTER_EMAIL",
    "EMAIL",
];

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityValues {
    pub name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    /// What `git config --global` holds.
    pub global: IdentityValues,
    /// The repository's own config; empty without a repository.
    pub local: IdentityValues,
    /// git would commit in the repository with a configured name and email (any level,
    /// includes or environment). Without a repository: the global name and email are set.
    pub complete: bool,
    /// The file `git config --global` writes, for showing in Settings.
    pub global_file: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IdentityScope {
    Global,
    Local,
}

/// Where the global config lives. The app uses the environment like git does; tests point
/// it at their own file so they never touch the user's or each other's global config.
#[derive(Debug, Clone, Default)]
pub struct GlobalConfig {
    file_override: Option<PathBuf>,
    /// Drop identity environment variables from `git var` (tests only need this).
    clear_identity_env: bool,
}

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var_os(key).filter(|value| !value.is_empty()).map(PathBuf::from)
}

impl GlobalConfig {
    pub fn from_env() -> GlobalConfig {
        GlobalConfig::default()
    }

    #[cfg(test)]
    pub fn at(file: &Path) -> GlobalConfig {
        GlobalConfig {
            file_override: Some(file.to_path_buf()),
            clear_identity_env: true,
        }
    }

    /// The global files, lowest priority first: GIT_CONFIG_GLOBAL alone when set, else the
    /// XDG file and ~/.gitconfig.
    fn files(&self) -> Vec<PathBuf> {
        if let Some(file) = self.file_override.clone().or_else(|| env_path("GIT_CONFIG_GLOBAL")) {
            return vec![file];
        }
        let home = env_path("HOME");
        let xdg = env_path("XDG_CONFIG_HOME").or_else(|| home.as_ref().map(|home| home.join(".config")));
        let mut files = Vec::new();
        if let Some(xdg) = xdg {
            files.push(xdg.join("git").join("config"));
        }
        if let Some(home) = home {
            files.push(home.join(".gitconfig"));
        }
        files
    }

    /// The file `git config --global` writes: ~/.gitconfig, unless only the XDG file exists.
    fn write_file(&self) -> Option<PathBuf> {
        let files = self.files();
        match files.as_slice() {
            [only] => Some(only.clone()),
            [xdg, home] if !home.exists() && xdg.exists() => Some(xdg.clone()),
            [.., home] => Some(home.clone()),
            [] => None,
        }
    }

    fn read(&self) -> AppResult<IdentityValues> {
        let mut config = Config::new()?;
        let levels = [ConfigLevel::XDG, ConfigLevel::Global];
        for (file, level) in self.files().iter().zip(levels) {
            if file.is_file() {
                config.add_file(file, level, false)?;
            }
        }
        Ok(values_of(config))
    }

    fn apply(&self, command: &mut std::process::Command) {
        if let Some(file) = &self.file_override {
            command.env("GIT_CONFIG_GLOBAL", file);
        }
        if self.clear_identity_env {
            for key in IDENTITY_ENV {
                command.env_remove(key);
            }
        }
    }

    fn envs(&self) -> Vec<(&'static str, String)> {
        self.file_override
            .iter()
            .map(|file| ("GIT_CONFIG_GLOBAL", file.to_string_lossy().into_owned()))
            .collect()
    }
}

fn config_string(config: &Config, key: &str) -> Option<String> {
    config.get_string(key).ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}

fn values_of(mut config: Config) -> IdentityValues {
    // A live config refuses get_string; a snapshot reads every level at once.
    let snapshot = config.snapshot().ok();
    let config = snapshot.as_ref().unwrap_or(&config);
    IdentityValues {
        name: config_string(config, NAME_KEY),
        email: config_string(config, EMAIL_KEY),
    }
}

fn local_values(repo_path: &str) -> AppResult<IdentityValues> {
    let repo = git_repo::open(repo_path)?;
    let config = repo.config()?;
    match config.open_level(ConfigLevel::Local) {
        Ok(local) => Ok(values_of(local)),
        Err(_) => Ok(IdentityValues::default()),
    }
}

/// `git var` fails when git has no configured name or email for that role.
fn ident_ready(repo_path: &Path, variable: &str, global: &GlobalConfig) -> bool {
    let mut command = cli::command(repo_path);
    command
        .args(["-c", "user.useConfigOnly=true", "var", variable])
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    global.apply(&mut command);
    command.status().map(|status| status.success()).unwrap_or(false)
}

/// git would commit in `repo_path` with a configured author and committer.
pub fn identity_ready(repo_path: &str, global: &GlobalConfig) -> bool {
    let root = Path::new(repo_path);
    ident_ready(root, "GIT_COMMITTER_IDENT", global) && ident_ready(root, "GIT_AUTHOR_IDENT", global)
}

pub fn read_identity(repo_path: Option<&str>, global: &GlobalConfig) -> AppResult<Identity> {
    let global_values = global.read()?;
    let (local, complete) = match repo_path {
        Some(repo_path) => (local_values(repo_path)?, identity_ready(repo_path, global)),
        None => (
            IdentityValues::default(),
            global_values.name.is_some() && global_values.email.is_some(),
        ),
    };
    Ok(Identity {
        global: global_values,
        local,
        complete,
        global_file: global.write_file().map(crate::paths::to_ui),
    })
}

/// Why `name` cannot be user.name, or None. Empty is fine: it unsets the value.
pub fn name_error(name: &str) -> Option<&'static str> {
    let name = name.trim();
    if name.chars().count() > MAX_NAME_LENGTH {
        return Some("The name is too long");
    }
    if name.contains(['<', '>', '\n', '\r', '\0']) {
        return Some("The name cannot contain < > or line breaks");
    }
    None
}

/// Why `email` cannot be user.email, or None. A light check: something@something.
pub fn email_error(email: &str) -> Option<&'static str> {
    let email = email.trim();
    if email.is_empty() {
        return None;
    }
    if email.chars().count() > MAX_EMAIL_LENGTH {
        return Some("The email is too long");
    }
    let Some((user, host)) = email.rsplit_once('@') else {
        return Some("Not a valid email address");
    };
    let bad_characters = email.contains(|c: char| c.is_whitespace() || matches!(c, '<' | '>' | '\0'));
    if user.is_empty() || host.is_empty() || bad_characters {
        return Some("Not a valid email address");
    }
    None
}

/// Folder to run `git config --global` in: any existing folder works.
fn global_run_dir(repo_path: Option<&str>) -> PathBuf {
    repo_path
        .map(PathBuf::from)
        .filter(|dir| dir.is_dir())
        .or_else(|| env_path("HOME").filter(|home| home.is_dir()))
        .unwrap_or_else(std::env::temp_dir)
}

fn write_key(dir: &Path, scope_flag: &str, key: &str, value: &str, present: bool, global: &GlobalConfig) -> AppResult<()> {
    let envs = global.envs();
    let envs: Vec<(&str, &str)> = envs.iter().map(|(name, value)| (*name, value.as_str())).collect();
    if value.is_empty() {
        // Never write an empty value: unset it instead (git exits 5 when it is not set).
        if present {
            cli::run_with_env(dir, &["config", scope_flag, "--unset-all", key], &envs)?;
        }
        return Ok(());
    }
    // `--` so a value starting with "-" is never read as an option.
    cli::run_with_env(dir, &["config", scope_flag, "--", key, value], &envs)?;
    Ok(())
}

/// Sets or (for empty values) unsets the name and email in the global or the repository's
/// config, then reads the identity again.
pub fn write_identity(
    repo_path: Option<&str>,
    scope: IdentityScope,
    name: &str,
    email: &str,
    global: &GlobalConfig,
) -> AppResult<Identity> {
    let name = name.trim();
    let email = email.trim();
    if let Some(message) = name_error(name).or_else(|| email_error(email)) {
        return Err(AppError::invalid(message));
    }
    let (dir, flag, current) = match scope {
        IdentityScope::Global => (global_run_dir(repo_path), "--global", global.read()?),
        IdentityScope::Local => {
            let repo_path = repo_path.ok_or_else(|| AppError::invalid("Open a repository first"))?;
            (PathBuf::from(repo_path), "--local", local_values(repo_path)?)
        }
    };
    write_key(&dir, flag, NAME_KEY, name, current.name.is_some(), global)?;
    write_key(&dir, flag, EMAIL_KEY, email, current.email.is_some(), global)?;
    read_identity(repo_path, global)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::TestDir;

    /// A repository with no identity at all and its own empty global config file.
    fn bare_identity() -> (TestDir, String, GlobalConfig, PathBuf) {
        let dir = TestDir::new();
        let repo_root = dir.init_repo("repo");
        let global_file = dir.file("global.gitconfig");
        std::fs::write(&global_file, "").expect("write global config");
        let global = GlobalConfig::at(&global_file);
        (dir, repo_root.to_string_lossy().into_owned(), global, global_file)
    }

    #[test]
    fn a_repository_without_identity_is_not_ready() {
        let (_dir, repo_root, global, _file) = bare_identity();
        let identity = read_identity(Some(&repo_root), &global).unwrap();
        assert_eq!(identity.global, IdentityValues::default());
        assert_eq!(identity.local, IdentityValues::default());
        assert!(!identity.complete);
    }

    #[test]
    fn writes_the_global_identity_into_its_own_file() {
        let (dir, repo_root, global, global_file) = bare_identity();
        let identity = write_identity(Some(&repo_root), IdentityScope::Global, " Ann Lee ", "ann@example.com", &global).unwrap();
        assert_eq!(identity.global.name.as_deref(), Some("Ann Lee"));
        assert_eq!(identity.global.email.as_deref(), Some("ann@example.com"));
        assert_eq!(identity.local, IdentityValues::default());
        assert!(identity.complete, "a global identity is enough to commit");
        assert_eq!(identity.global_file.as_deref(), Some(global_file.to_string_lossy().as_ref()));
        let text = std::fs::read_to_string(&global_file).unwrap();
        assert!(text.contains("name = Ann Lee") && text.contains("email = ann@example.com"), "{text}");
        let repo_config = std::fs::read_to_string(dir.file("repo/.git/config")).unwrap();
        assert!(!repo_config.contains("Ann"), "{repo_config}");

        // Without a repository: the global values decide.
        let alone = read_identity(None, &global).unwrap();
        assert!(alone.complete);
        assert_eq!(alone.local, IdentityValues::default());
    }

    #[test]
    fn local_values_override_and_use_global_removes_them() {
        let (_dir, repo_root, global, _file) = bare_identity();
        write_identity(None, IdentityScope::Global, "Ann Lee", "ann@example.com", &global).unwrap();
        let identity = write_identity(Some(&repo_root), IdentityScope::Local, "Ann at Work", "ann@work.example", &global).unwrap();
        assert_eq!(identity.local.name.as_deref(), Some("Ann at Work"));
        assert_eq!(identity.global.name.as_deref(), Some("Ann Lee"));
        let ident = crate::test_support::git_in(Path::new(&repo_root), &["var", "GIT_COMMITTER_IDENT"]);
        assert!(ident.starts_with("Ann at Work <ann@work.example>"), "{ident}");

        // Empty values unset (Use global), and unsetting a missing key is fine.
        let identity = write_identity(Some(&repo_root), IdentityScope::Local, "", "", &global).unwrap();
        assert_eq!(identity.local, IdentityValues::default());
        assert!(identity.complete);
        let again = write_identity(Some(&repo_root), IdentityScope::Local, "", "  ", &global).unwrap();
        assert_eq!(again.local, IdentityValues::default());
    }

    #[test]
    fn a_name_alone_is_not_enough() {
        let (_dir, repo_root, global, _file) = bare_identity();
        let identity = write_identity(Some(&repo_root), IdentityScope::Local, "Ann Lee", "", &global).unwrap();
        assert_eq!(identity.local.name.as_deref(), Some("Ann Lee"));
        assert!(!identity.complete);
    }

    #[test]
    fn values_starting_with_a_dash_are_written_as_values() {
        let (_dir, repo_root, global, _file) = bare_identity();
        let identity = write_identity(Some(&repo_root), IdentityScope::Local, "-n", "-x@example.com", &global).unwrap();
        assert_eq!(identity.local.name.as_deref(), Some("-n"));
        assert_eq!(identity.local.email.as_deref(), Some("-x@example.com"));
    }

    #[test]
    fn global_includes_are_followed() {
        let (dir, repo_root, global, global_file) = bare_identity();
        let included = dir.file("identity.gitconfig");
        std::fs::write(&included, "[user]\n\tname = Included Name\n\temail = inc@example.com\n").unwrap();
        std::fs::write(&global_file, format!("[include]\n\tpath = {}\n", included.display())).unwrap();
        let identity = read_identity(Some(&repo_root), &global).unwrap();
        assert_eq!(identity.global.name.as_deref(), Some("Included Name"));
        assert!(identity.complete);
    }

    #[test]
    fn refuses_bad_values_and_writes_nothing() {
        let (_dir, repo_root, global, global_file) = bare_identity();
        for (name, email) in [("Ann <x>", "a@b"), ("Ann", "no-at"), ("Ann", "a b@c"), ("Ann", "@host"), ("Line\nbreak", "a@b")] {
            let result = write_identity(Some(&repo_root), IdentityScope::Global, name, email, &global);
            assert!(matches!(result, Err(AppError::Invalid(_))), "{name} {email}");
        }
        assert_eq!(std::fs::read_to_string(&global_file).unwrap(), "");
        assert_eq!(email_error("ann@example.com"), None);
        assert_eq!(email_error(""), None);
        assert_eq!(name_error("Ann Lee"), None);
    }

    #[test]
    fn local_scope_needs_a_repository() {
        let (_dir, _repo_root, global, _file) = bare_identity();
        assert!(write_identity(None, IdentityScope::Local, "Ann", "a@b.c", &global).is_err());
    }
}
