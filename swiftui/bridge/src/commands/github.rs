//! Git > GitHub and Settings > GitHub (src-tauri/src/github/commands.rs): the same calls on the shared service, with
//! the native app's own files and keychain item. The account file is ~/.gitmanager-native/github.json and the token
//! a keychain item of its own service, so signing in or out here never touches the current app's sign-in.

use serde::Deserialize;

use crate::error::{AppError, AppResult};
use crate::github::account::GitHubAccount;
use crate::github::client::{user_agent, CreatedGist, RepositoryInfo, SyncForkOutcome};
use crate::github::gh::SystemGh;
use crate::github::http::UreqTransport;
use crate::github::secrets::SecretStore;
use crate::github::service::{default_host, GhCliStatus, GistRequest, GitHub, ShareRequest, SharedRepository};

/// The native app's keychain service; the account is the GitHub host, as in the current app.
const NATIVE_SERVICE: &str = "shibbirweb.github.io.gitmanager.native.github";

struct NativeKeychain;

#[cfg(target_os = "macos")]
fn entry(host: &str) -> AppResult<keyring::Entry> {
    keyring::Entry::new(NATIVE_SERVICE, host).map_err(keychain_error)
}

#[cfg(target_os = "macos")]
fn keychain_error(err: keyring::Error) -> AppError {
    AppError::invalid(format!("Keychain: {err}"))
}

#[cfg(target_os = "macos")]
impl SecretStore for NativeKeychain {
    fn read(&self, host: &str) -> AppResult<Option<String>> {
        match entry(host)?.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(err) => Err(keychain_error(err)),
        }
    }

    fn write(&self, host: &str, token: &str) -> AppResult<()> {
        entry(host)?.set_password(token).map_err(keychain_error)
    }

    fn remove(&self, host: &str) -> AppResult<()> {
        match entry(host)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(keychain_error(err)),
        }
    }
}

// No keychain backend elsewhere yet: refuse rather than keep the token in a file, as the current app does.
#[cfg(not(target_os = "macos"))]
impl SecretStore for NativeKeychain {
    fn read(&self, _host: &str) -> AppResult<Option<String>> {
        Ok(None)
    }

    fn write(&self, _host: &str, _token: &str) -> AppResult<()> {
        Err(AppError::invalid("Saving a GitHub token is not supported on this system yet. Use the GitHub CLI instead."))
    }

    fn remove(&self, _host: &str) -> AppResult<()> {
        Ok(())
    }
}

/// Runs `work` with the real network, the native keychain item, gh and ~/.gitmanager-native.
fn with_github<T>(work: impl FnOnce(&GitHub) -> AppResult<T>) -> AppResult<T> {
    let transport = UreqTransport::new(&user_agent());
    let config_dir = crate::config::home_dir()?.join(".gitmanager-native");
    let github = GitHub {
        transport: &transport,
        secrets: &NativeKeychain,
        gh: &SystemGh,
        config_dir,
        host: default_host(),
    };
    work(&github)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenArgs {
    token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareArgs {
    repo_path: String,
    request: ShareRequest,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryArgs {
    owner: String,
    repo: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncForkArgs {
    owner: String,
    repo: String,
    branch_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GistArgs {
    request: GistRequest,
}

/// The signed-in account from github.json: no keychain read, no network.
pub fn github_account() -> AppResult<Option<GitHubAccount>> {
    with_github(|github| Ok(github.account()))
}

pub fn github_cli_status() -> AppResult<GhCliStatus> {
    with_github(|github| Ok(github.cli_status()))
}

/// Verifies the token with GitHub and saves it in the keychain. It is never sent back.
pub fn github_sign_in_with_token(args: TokenArgs) -> AppResult<GitHubAccount> {
    with_github(|github| github.sign_in_with_token(&args.token))
}

pub fn github_sign_in_with_cli() -> AppResult<GitHubAccount> {
    with_github(|github| github.sign_in_with_cli())
}

pub fn github_sign_out() -> AppResult<()> {
    with_github(|github| github.sign_out())
}

pub fn github_share_project(args: ShareArgs) -> AppResult<SharedRepository> {
    with_github(|github| github.share_project(&args.repo_path, &args.request))
}

pub fn github_repository(args: RepositoryArgs) -> AppResult<RepositoryInfo> {
    with_github(|github| github.repository(&args.owner, &args.repo))
}

pub fn github_sync_fork(args: SyncForkArgs) -> AppResult<SyncForkOutcome> {
    with_github(|github| github.sync_fork(&args.owner, &args.repo, &args.branch_name))
}

pub fn github_create_gist(args: GistArgs) -> AppResult<CreatedGist> {
    with_github(|github| github.create_gist(&args.request))
}
