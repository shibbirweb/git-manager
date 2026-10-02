//! Puts the command line tool on the PATH: a `git-manager` link in `~/.local/bin` to the
//! running binary. Never sudo, never /usr/local.

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

pub const LINK_NAME: &str = "git-manager";

pub fn bin_dir_in(home: &Path) -> PathBuf {
    home.join(".local").join("bin")
}

pub fn link_in(home: &Path) -> PathBuf {
    bin_dir_in(home).join(LINK_NAME)
}

/// A link we made: it points at this binary, or at a binary of the same name (an older copy of the app).
fn is_ours(link: &Path, exe: &Path) -> bool {
    let Ok(target) = std::fs::read_link(link) else {
        return false;
    };
    target == exe || (target.file_name().is_some() && target.file_name() == exe.file_name())
}

pub fn installed_link(home: &Path, exe: &Path) -> Option<PathBuf> {
    let link = link_in(home);
    is_ours(&link, exe).then_some(link)
}

/// `~/.local/bin` is one of the folders in `path_var`.
pub fn on_path(home: &Path, path_var: &str) -> bool {
    let bin_dir = bin_dir_in(home);
    let canonical = bin_dir.canonicalize().ok();
    std::env::split_paths(path_var).any(|entry| entry == bin_dir || (canonical.is_some() && entry.canonicalize().ok() == canonical))
}

#[cfg(unix)]
pub fn install_in(home: &Path, exe: &Path) -> AppResult<PathBuf> {
    let link = link_in(home);
    if link.symlink_metadata().is_ok() {
        if !is_ours(&link, exe) {
            return Err(AppError::invalid(format!(
                "{} already exists and is not Git Manager's link. Remove it first.",
                link.display()
            )));
        }
        std::fs::remove_file(&link)?;
    }
    std::fs::create_dir_all(bin_dir_in(home))?;
    std::os::unix::fs::symlink(exe, &link)?;
    Ok(link)
}

#[cfg(unix)]
pub fn uninstall_in(home: &Path, exe: &Path) -> AppResult<()> {
    let link = link_in(home);
    if link.symlink_metadata().is_err() {
        return Ok(());
    }
    if !is_ours(&link, exe) {
        return Err(AppError::invalid(format!("{} is not Git Manager's link, so it was left alone.", link.display())));
    }
    std::fs::remove_file(&link)?;
    Ok(())
}

#[cfg(not(unix))]
pub fn install_in(_home: &Path, _exe: &Path) -> AppResult<PathBuf> {
    Err(AppError::invalid("Installing the command line tool is not supported on this platform yet"))
}

#[cfg(not(unix))]
pub fn uninstall_in(_home: &Path, _exe: &Path) -> AppResult<()> {
    Err(AppError::invalid("Installing the command line tool is not supported on this platform yet"))
}

pub fn current_exe() -> PathBuf {
    std::env::current_exe()
        .and_then(|exe| exe.canonicalize())
        .unwrap_or_else(|_| PathBuf::from(LINK_NAME))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn installs_and_removes_only_our_link() {
        let home = tempfile::TempDir::new().unwrap();
        let home = home.path();
        let exe = home.join("app/git-manager");
        std::fs::create_dir_all(exe.parent().unwrap()).unwrap();
        std::fs::write(&exe, "binary").unwrap();

        assert_eq!(installed_link(home, &exe), None);
        let link = install_in(home, &exe).unwrap();
        assert_eq!(std::fs::read_link(&link).unwrap(), exe);
        assert_eq!(installed_link(home, &exe), Some(link.clone()));
        install_in(home, &exe).unwrap();

        uninstall_in(home, &exe).unwrap();
        assert!(link.symlink_metadata().is_err());
        uninstall_in(home, &exe).unwrap();

        std::fs::write(&link, "someone else's script").unwrap();
        assert!(install_in(home, &exe).is_err());
        assert!(uninstall_in(home, &exe).is_err());
        assert!(link.is_file(), "a file that is not our link is never removed");
    }

    #[test]
    fn finds_the_folder_on_the_path() {
        let home = Path::new("/Users/someone");
        assert!(on_path(home, "/usr/bin:/Users/someone/.local/bin:/bin"));
        assert!(!on_path(home, "/usr/bin:/bin"));
        assert!(!on_path(home, ""));
    }
}
