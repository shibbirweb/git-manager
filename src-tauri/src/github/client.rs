//! The GitHub REST calls Git Manager makes, and how their errors read. The host is a
//! parameter (api.github.com, or https://HOST/api/v3 for GitHub Enterprise later).

use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::http::{HttpRequest, HttpResponse, HttpTransport, Method};
use crate::error::{AppError, AppResult};

const API_VERSION: &str = "2022-11-28";

/// The signed-in user, as GET /user returns it.
#[derive(Debug, Clone, Deserialize)]
pub struct ApiUser {
    pub login: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiOwner {
    login: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiParent {
    full_name: String,
    owner: ApiOwner,
    name: String,
    #[serde(default)]
    default_branch: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiRepository {
    full_name: String,
    html_url: String,
    #[serde(default)]
    clone_url: Option<String>,
    #[serde(default)]
    default_branch: Option<String>,
    #[serde(default)]
    fork: bool,
    #[serde(default)]
    parent: Option<ApiParent>,
}

/// What POST /user/repos creates.
#[derive(Debug, Clone)]
pub struct NewRepository<'a> {
    pub name: &'a str,
    pub description: &'a str,
    pub private: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreatedRepository {
    pub full_name: String,
    pub html_url: String,
    pub clone_url: String,
}

/// A repository and, for a fork, the repository it was forked from.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInfo {
    pub full_name: String,
    pub html_url: String,
    pub default_branch: Option<String>,
    pub fork: bool,
    pub parent: Option<ParentInfo>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ParentInfo {
    pub full_name: String,
    pub owner: String,
    pub repo: String,
    pub default_branch: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SyncKind {
    FastForward,
    Merge,
    UpToDate,
    /// The branches diverged with conflicts: GitHub cannot sync, a pull request can.
    Conflict,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyncForkOutcome {
    pub kind: SyncKind,
    pub message: String,
    /// The upstream branch merged in, e.g. "octo:main".
    pub base_branch: Option<String>,
}

pub struct NewGist<'a> {
    pub file_name: &'a str,
    pub description: &'a str,
    pub public: bool,
    pub content: &'a str,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreatedGist {
    pub id: String,
    pub html_url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiGist {
    id: String,
    html_url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiMergeUpstream {
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    merge_type: Option<String>,
    #[serde(default)]
    base_branch: Option<String>,
}

/// An authenticated client for one host. Not `Debug` or `Clone`: it holds the token.
pub struct GitHubClient<'a> {
    transport: &'a dyn HttpTransport,
    api_base: String,
    token: String,
    user_agent: String,
}

impl<'a> GitHubClient<'a> {
    pub fn new(transport: &'a dyn HttpTransport, api_base: &str, token: String) -> GitHubClient<'a> {
        GitHubClient {
            transport,
            api_base: api_base.trim_end_matches('/').to_string(),
            token,
            user_agent: user_agent(),
        }
    }

    fn send(&self, method: Method, path: &str, body: Option<Value>) -> AppResult<HttpResponse> {
        let mut headers = vec![
            ("Accept".to_string(), "application/vnd.github+json".to_string()),
            ("X-GitHub-Api-Version".to_string(), API_VERSION.to_string()),
            ("User-Agent".to_string(), self.user_agent.clone()),
            ("Authorization".to_string(), format!("Bearer {}", self.token)),
        ];
        if body.is_some() {
            headers.push(("Content-Type".to_string(), "application/json".to_string()));
        }
        let request = HttpRequest {
            method,
            url: format!("{}{}", self.api_base, path),
            headers,
            body: body.map(|value| value.to_string()),
        };
        self.transport
            .send(&request)
            .map_err(|err| AppError::invalid(format!("Could not reach GitHub: {err}")))
    }

    /// Sends and parses a 2xx response; anything else becomes a readable error.
    fn call<T: for<'de> Deserialize<'de>>(&self, method: Method, path: &str, body: Option<Value>) -> AppResult<(T, HttpResponse)> {
        let response = self.send(method, path, body)?;
        if !(200..300).contains(&response.status) {
            return Err(api_error(&response, unix_now()));
        }
        let parsed = parse(&response)?;
        Ok((parsed, response))
    }

    /// GET /user, with the classic token scopes GitHub reports (None for fine-grained tokens).
    pub fn current_user(&self) -> AppResult<(ApiUser, Option<Vec<String>>)> {
        let (user, response) = self.call::<ApiUser>(Method::Get, "/user", None)?;
        let scopes = response.header("x-oauth-scopes").map(|header| {
            header
                .split(',')
                .map(str::trim)
                .filter(|scope| !scope.is_empty())
                .map(str::to_string)
                .collect()
        });
        Ok((user, scopes))
    }

    pub fn create_repository(&self, repository: &NewRepository) -> AppResult<CreatedRepository> {
        let body = json!({
            "name": repository.name,
            "description": repository.description,
            "private": repository.private,
            "auto_init": false,
        });
        let (created, _) = self.call::<ApiRepository>(Method::Post, "/user/repos", Some(body))?;
        let clone_url = created
            .clone_url
            .clone()
            .unwrap_or_else(|| format!("{}.git", created.html_url));
        Ok(CreatedRepository {
            full_name: created.full_name,
            html_url: created.html_url,
            clone_url,
        })
    }

    pub fn repository(&self, owner: &str, repo: &str) -> AppResult<RepositoryInfo> {
        let path = format!("/repos/{}/{}", encode_segment(owner), encode_segment(repo));
        let (found, _) = self.call::<ApiRepository>(Method::Get, &path, None)?;
        Ok(RepositoryInfo {
            full_name: found.full_name,
            html_url: found.html_url,
            default_branch: found.default_branch,
            fork: found.fork,
            parent: found.parent.map(|parent| ParentInfo {
                full_name: parent.full_name,
                owner: parent.owner.login,
                repo: parent.name,
                default_branch: parent.default_branch,
            }),
        })
    }

    /// POST /repos/{owner}/{repo}/merge-upstream: GitHub's Sync Fork button.
    pub fn merge_upstream(&self, owner: &str, repo: &str, branch_name: &str) -> AppResult<SyncForkOutcome> {
        let path = format!("/repos/{}/{}/merge-upstream", encode_segment(owner), encode_segment(repo));
        let response = self.send(Method::Post, &path, Some(json!({ "branch": branch_name })))?;
        if response.status == 409 {
            return Ok(SyncForkOutcome {
                kind: SyncKind::Conflict,
                message: github_message(&response.body)
                    .unwrap_or_else(|| "The branch has conflicts with the upstream repository.".to_string()),
                base_branch: None,
            });
        }
        if !(200..300).contains(&response.status) {
            return Err(api_error(&response, unix_now()));
        }
        let merged: ApiMergeUpstream = parse(&response)?;
        let kind = match merged.merge_type.as_deref() {
            Some("fast-forward") => SyncKind::FastForward,
            Some("merge") => SyncKind::Merge,
            _ => SyncKind::UpToDate,
        };
        let message = merged.message.unwrap_or_else(|| match kind {
            SyncKind::UpToDate => "This branch is not behind the upstream repository.".to_string(),
            _ => "Synced with the upstream repository.".to_string(),
        });
        Ok(SyncForkOutcome {
            kind,
            message,
            base_branch: merged.base_branch,
        })
    }

    pub fn create_gist(&self, gist: &NewGist) -> AppResult<CreatedGist> {
        let mut files = serde_json::Map::new();
        files.insert(gist.file_name.to_string(), json!({ "content": gist.content }));
        let body = json!({
            "description": gist.description,
            "public": gist.public,
            "files": files,
        });
        let (created, _) = self.call::<ApiGist>(Method::Post, "/gists", Some(body))?;
        Ok(CreatedGist {
            id: created.id,
            html_url: created.html_url,
        })
    }
}

pub fn user_agent() -> String {
    format!("GitManager/{}", env!("CARGO_PKG_VERSION"))
}

fn parse<T: for<'de> Deserialize<'de>>(response: &HttpResponse) -> AppResult<T> {
    serde_json::from_str(&response.body)
        .map_err(|err| AppError::invalid(format!("GitHub sent an unexpected answer: {err}")))
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

/// Percent-encodes one path segment (owner and repository names are plain, but never trust them).
fn encode_segment(segment: &str) -> String {
    let mut encoded = String::with_capacity(segment.len());
    for byte in segment.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

/// GitHub's `message`, with the `errors` details a 422 adds.
fn github_message(body: &str) -> Option<String> {
    let value: Value = serde_json::from_str(body).ok()?;
    let message = value.get("message").and_then(Value::as_str).unwrap_or_default().trim().to_string();
    let details: Vec<String> = value
        .get("errors")
        .and_then(Value::as_array)
        .map(|errors| {
            errors
                .iter()
                .filter_map(|error| {
                    error
                        .get("message")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .or_else(|| error.as_str().map(str::to_string))
                        .or_else(|| {
                            let field = error.get("field").and_then(Value::as_str)?;
                            let code = error.get("code").and_then(Value::as_str).unwrap_or("invalid");
                            Some(format!("{field} is {code}"))
                        })
                })
                .collect()
        })
        .unwrap_or_default();
    let text = match (message.is_empty(), details.is_empty()) {
        (true, true) => return None,
        (false, true) => message,
        (true, false) => details.join("; "),
        (false, false) => format!("{}: {}", message.trim_end_matches('.'), details.join("; ")),
    };
    Some(text)
}

fn wait_text(seconds: u64) -> String {
    if seconds < 90 {
        "in a minute".to_string()
    } else {
        format!("in {} minutes", seconds.div_ceil(60))
    }
}

/// A non-2xx answer as a message that says what to do.
pub fn api_error(response: &HttpResponse, now: u64) -> AppError {
    let message = github_message(&response.body);
    let detail = message.clone().unwrap_or_else(|| format!("HTTP {}", response.status));
    let remaining = response.header("x-ratelimit-remaining").map(str::trim);
    let rate_limited = response.status == 429
        || (response.status == 403
            && (remaining == Some("0")
                || response.header("retry-after").is_some()
                || detail.to_ascii_lowercase().contains("rate limit")));
    if rate_limited {
        let wait = response
            .header("retry-after")
            .and_then(|value| value.trim().parse::<u64>().ok())
            .or_else(|| {
                response
                    .header("x-ratelimit-reset")
                    .and_then(|value| value.trim().parse::<u64>().ok())
                    .map(|reset| reset.saturating_sub(now))
            });
        let when = wait.map(wait_text).unwrap_or_else(|| "later".to_string());
        return AppError::invalid(format!("GitHub's rate limit is reached. Try again {when}."));
    }
    let text = match response.status {
        401 => "GitHub rejected the token: it may be expired or revoked. Sign in again in Settings > GitHub.".to_string(),
        403 => format!("GitHub refused the request ({detail}). The token may lack the repo or gist scope."),
        // GitHub answers 404 for private repositories the token cannot see.
        404 => "Not found on GitHub. Check the token can access this repository.".to_string(),
        422 => format!("GitHub could not do it: {detail}"),
        status if status >= 500 => format!("GitHub is having trouble (HTTP {status}). Try again later."),
        status => format!("GitHub error (HTTP {status}): {detail}"),
    };
    AppError::invalid(text)
}
