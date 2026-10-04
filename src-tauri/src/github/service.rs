//! What the GitHub commands do, with the network, the keychain, gh and the config folder
//! passed in, so the tests run every path against fakes.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::account::{self, AccountSource, GitHubAccount, GITHUB_HOST};
use super::client::{CreatedGist, GitHubClient, NewGist, NewRepository, RepositoryInfo, SyncForkOutcome};
use super::gh::GhCli;
use super::http::HttpTransport;
use super::secrets::SecretStore;
use crate::commands::reject_option;
use crate::error::{AppError, AppResult};
use crate::git::cli;
use crate::git::repo as git_repo;
use crate::git::status::head_info;

/// Gists above this are refused before upload (GitHub truncates large files in its API anyway).
const MAX_GIST_BYTES: usize = 5 * 1024 * 1024;

pub struct GitHub<'a> {
    pub transport: &'a dyn HttpTransport,
    pub secrets: &'a dyn SecretStore,
    pub gh: &'a dyn GhCli,
    pub config_dir: PathBuf,
    pub host: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GhCliStatus {
    pub installed: bool,
    pub signed_in: bool,
}

/// The Share Project on GitHub dialog.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareRequest {
    pub repository_name: String,
    pub private: bool,
    #[serde(default)]
    pub description: String,
    pub remote_name: String,
    /// For a repository without commits: commit every file with this message first.
    #[serde(default)]
    pub initial_commit_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SharedRepository {
    pub full_name: String,
    pub html_url: String,
    pub clone_url: String,
    pub remote_name: String,
    /// The branch to push with upstream.
    pub branch_name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GistRequest {
    pub file_name: String,
    #[serde(default)]
    pub description: String,
    pub public: bool,
    pub content: String,
}

/// GitHub's repository name rules: letters, digits, '.', '-' and '_', at most 100.
pub fn validate_repository_name(repository_name: &str) -> AppResult<&str> {
    let name = repository_name.trim();
    if name.is_empty() {
        return Err(AppError::invalid("Enter a repository name"));
    }
    if name.len() > 100 {
        return Err(AppError::invalid("A repository name has at most 100 characters"));
    }
    if name == "." || name == ".." {
        return Err(AppError::invalid("This repository name is reserved"));
    }
    if name.to_ascii_lowercase().ends_with(".git") {
        return Err(AppError::invalid("Leave out the .git ending"));
    }
    let allowed = name
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'));
    if !allowed {
        return Err(AppError::invalid("Use only letters, digits, '.', '-' and '_'"));
    }
    Ok(name)
}

fn validate_token(token: &str) -> AppResult<&str> {
    let token = token.trim();
    if token.is_empty() {
        return Err(AppError::invalid("Paste a personal access token"));
    }
    if token.len() > 512 || !token.chars().all(|character| character.is_ascii_graphic()) {
        return Err(AppError::invalid("That does not look like a token: it has spaces or unusual characters"));
    }
    Ok(token)
}

impl GitHub<'_> {
    fn api_base(&self) -> String {
        account::api_base_for(&self.host)
    }

    pub fn account(&self) -> Option<GitHubAccount> {
        account::load(&self.config_dir).filter(|saved| saved.host.eq_ignore_ascii_case(&self.host))
    }

    pub fn cli_status(&self) -> GhCliStatus {
        let installed = self.gh.installed();
        let signed_in = installed && matches!(self.gh.token(&self.host), Ok(Some(_)));
        GhCliStatus { installed, signed_in }
    }

    /// Verifies the token with GET /user, then keeps it in the keychain.
    pub fn sign_in_with_token(&self, token: &str) -> AppResult<GitHubAccount> {
        let token = validate_token(token)?;
        let account = self.verify(token.to_string(), AccountSource::Token)?;
        self.secrets.write(&self.host, token)?;
        if let Err(err) = account::save(&self.config_dir, &account) {
            let _ = self.secrets.remove(&self.host);
            return Err(err);
        }
        Ok(account)
    }

    /// Uses gh's token for this host; nothing is stored but the login.
    pub fn sign_in_with_cli(&self) -> AppResult<GitHubAccount> {
        let token = self.gh.token(&self.host)?.ok_or_else(|| {
            AppError::invalid(format!("The GitHub CLI is not signed in to {}. Run: gh auth login", self.host))
        })?;
        let account = self.verify(token, AccountSource::GhCli)?;
        // A token saved earlier would be stale now.
        self.secrets.remove(&self.host)?;
        account::save(&self.config_dir, &account)?;
        Ok(account)
    }

    pub fn sign_out(&self) -> AppResult<()> {
        self.secrets.remove(&self.host)?;
        account::remove(&self.config_dir)
    }

    fn verify(&self, token: String, source: AccountSource) -> AppResult<GitHubAccount> {
        let client = GitHubClient::new(self.transport, &self.api_base(), token);
        let (user, scopes) = client.current_user()?;
        Ok(GitHubAccount {
            host: self.host.clone(),
            login: user.login,
            name: user.name.filter(|name| !name.trim().is_empty()),
            source,
            missing_scopes: account::missing_scopes(scopes.as_deref()),
        })
    }

    fn token(&self) -> AppResult<String> {
        let signed_out = || AppError::invalid("Sign in to GitHub first (Settings > GitHub).");
        let saved = self.account().ok_or_else(signed_out)?;
        let token = match saved.source {
            AccountSource::Token => self.secrets.read(&self.host)?,
            AccountSource::GhCli => self.gh.token(&self.host)?,
        };
        token.filter(|value| !value.trim().is_empty()).ok_or_else(signed_out)
    }

    fn client(&self) -> AppResult<GitHubClient<'_>> {
        Ok(GitHubClient::new(self.transport, &self.api_base(), self.token()?))
    }

    /// Creates the GitHub repository and adds it as a remote; the caller pushes next.
    pub fn share_project(&self, repo_path: &str, request: &ShareRequest) -> AppResult<SharedRepository> {
        let repository_name = validate_repository_name(&request.repository_name)?;
        let remote_name = request.remote_name.trim();
        if remote_name.is_empty() {
            return Err(AppError::invalid("Enter a remote name"));
        }
        reject_option(remote_name, "A remote name")?;
        let repo = git_repo::open(repo_path)?;
        if repo.find_remote(remote_name).is_ok() {
            return Err(AppError::invalid(format!("A remote named {remote_name} already exists")));
        }
        let head = head_info(&repo);
        let branch_name = head
            .branch
            .clone()
            .ok_or_else(|| AppError::invalid("Check out a branch first: HEAD is detached"))?;
        // Ask for the token before committing, so a signed-out user changes nothing.
        let client = self.client()?;
        if head.unborn {
            let message = request
                .initial_commit_message
                .as_deref()
                .map(str::trim)
                .filter(|message| !message.is_empty())
                .ok_or_else(|| AppError::invalid("This repository has no commits yet: commit the files first"))?;
            commit_everything(Path::new(repo_path), message)?;
        }
        let created = client.create_repository(&NewRepository {
            name: repository_name,
            description: request.description.trim(),
            private: request.private,
        })?;
        cli::run(Path::new(repo_path), &["remote", "add", remote_name, &created.clone_url]).map_err(|err| {
            AppError::invalid(format!("Created {} on GitHub, but adding the remote failed: {err}", created.full_name))
        })?;
        Ok(SharedRepository {
            full_name: created.full_name,
            html_url: created.html_url,
            clone_url: created.clone_url,
            remote_name: remote_name.to_string(),
            branch_name,
        })
    }

    pub fn repository(&self, owner: &str, repo: &str) -> AppResult<RepositoryInfo> {
        self.client()?.repository(owner, repo)
    }

    pub fn sync_fork(&self, owner: &str, repo: &str, branch_name: &str) -> AppResult<SyncForkOutcome> {
        let branch_name = branch_name.trim();
        if branch_name.is_empty() {
            return Err(AppError::invalid("Choose the branch to sync"));
        }
        self.client()?.merge_upstream(owner, repo, branch_name)
    }

    pub fn create_gist(&self, request: &GistRequest) -> AppResult<CreatedGist> {
        let file_name = request.file_name.trim();
        if file_name.is_empty() {
            return Err(AppError::invalid("Enter a file name"));
        }
        if file_name.contains('/') || file_name.contains('\\') {
            return Err(AppError::invalid("A gist file name cannot contain slashes"));
        }
        if request.content.trim().is_empty() {
            return Err(AppError::invalid("A gist cannot be empty"));
        }
        if request.content.len() > MAX_GIST_BYTES {
            return Err(AppError::invalid("The content is too large for a gist (over 5 MB)"));
        }
        self.client()?.create_gist(&NewGist {
            file_name,
            description: request.description.trim(),
            public: request.public,
            content: &request.content,
        })
    }
}

/// "Add files for the initial commit": stage everything git does not ignore, then commit.
fn commit_everything(root: &Path, message: &str) -> AppResult<()> {
    cli::run(root, &["add", "--all"])?;
    cli::run_with_stdin(root, &["commit", "-F", "-"], message.as_bytes())?;
    Ok(())
}

pub fn default_host() -> String {
    GITHUB_HOST.to_string()
}
