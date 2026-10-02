//! GitHub features against a fake HTTP layer, an in-memory keychain and a fake gh. No test
//! talks to GitHub; the one real-transport test uses a local listener.

use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::sync::Mutex;

use serde_json::{json, Value};
use tempfile::TempDir;

use super::account::{self, AccountSource, GitHubAccount};
use super::client::{api_error, GitHubClient, SyncKind};
use super::gh::GhCli;
use super::http::{HttpRequest, HttpResponse, HttpTransport, Method, UreqTransport};
use super::secrets::memory::MemoryStore;
use super::secrets::SecretStore;
use super::service::{validate_repository_name, GistRequest, GitHub, ShareRequest};
use crate::error::AppResult;
use crate::test_support::TestRepo;

const TOKEN: &str = "ghp_testtoken123";

struct Recorded {
    method: Method,
    url: String,
    authorization: Option<String>,
    user_agent: Option<String>,
    body: Option<Value>,
}

#[derive(Default)]
struct FakeTransport {
    responses: Mutex<VecDeque<Result<HttpResponse, String>>>,
    requests: Mutex<Vec<Recorded>>,
}

impl FakeTransport {
    fn answering(responses: Vec<HttpResponse>) -> FakeTransport {
        FakeTransport {
            responses: Mutex::new(responses.into_iter().map(Ok).collect()),
            requests: Mutex::new(Vec::new()),
        }
    }

    fn offline() -> FakeTransport {
        FakeTransport {
            responses: Mutex::new(VecDeque::from([Err("the host was not found (are you offline?)".to_string())])),
            requests: Mutex::new(Vec::new()),
        }
    }

    fn requests(&self) -> std::sync::MutexGuard<'_, Vec<Recorded>> {
        self.requests.lock().unwrap()
    }
}

impl HttpTransport for FakeTransport {
    fn send(&self, request: &HttpRequest) -> Result<HttpResponse, String> {
        self.requests.lock().unwrap().push(Recorded {
            method: request.method,
            url: request.url.clone(),
            authorization: request.header("authorization").map(str::to_string),
            user_agent: request.header("user-agent").map(str::to_string),
            body: request.body.as_deref().map(|body| serde_json::from_str(body).expect("JSON body")),
        });
        self.responses
            .lock()
            .unwrap()
            .pop_front()
            .unwrap_or_else(|| Err("no more fake responses".to_string()))
    }
}

struct FakeGh {
    token: Option<&'static str>,
}

impl GhCli for FakeGh {
    fn installed(&self) -> bool {
        true
    }

    fn token(&self, _host: &str) -> AppResult<Option<String>> {
        Ok(self.token.map(str::to_string))
    }
}

fn response(status: u16, body: Value) -> HttpResponse {
    HttpResponse {
        status,
        headers: Vec::new(),
        body: body.to_string(),
    }
}

fn with_header(mut response: HttpResponse, name: &str, value: &str) -> HttpResponse {
    response.headers.push((name.to_string(), value.to_string()));
    response
}

fn user_response() -> HttpResponse {
    with_header(
        response(200, json!({ "login": "octocat", "name": "The Octocat" })),
        "x-oauth-scopes",
        "repo, workflow",
    )
}

struct Fixture {
    transport: FakeTransport,
    secrets: MemoryStore,
    gh: FakeGh,
    config: TempDir,
}

impl Fixture {
    fn new(responses: Vec<HttpResponse>) -> Fixture {
        Fixture {
            transport: FakeTransport::answering(responses),
            secrets: MemoryStore::default(),
            gh: FakeGh { token: None },
            config: TempDir::new().expect("config dir"),
        }
    }

    /// Already signed in with a keychain token.
    fn signed_in(responses: Vec<HttpResponse>) -> Fixture {
        let fixture = Fixture::new(responses);
        fixture.secrets.write("github.com", TOKEN).unwrap();
        account::save(
            fixture.config.path(),
            &GitHubAccount {
                host: "github.com".to_string(),
                login: "octocat".to_string(),
                name: None,
                source: AccountSource::Token,
                missing_scopes: Vec::new(),
            },
        )
        .unwrap();
        fixture
    }

    fn github(&self) -> GitHub<'_> {
        GitHub {
            transport: &self.transport,
            secrets: &self.secrets,
            gh: &self.gh,
            config_dir: self.config.path().to_path_buf(),
            host: "github.com".to_string(),
        }
    }

    fn account_file(&self) -> String {
        std::fs::read_to_string(self.config.path().join("github.json")).unwrap_or_default()
    }
}

fn message(result: AppResult<impl std::fmt::Debug>) -> String {
    result.expect_err("expected an error").to_string()
}

// Sign-in

#[test]
fn token_sign_in_verifies_then_keeps_the_token_only_in_the_keychain() {
    let fixture = Fixture::new(vec![user_response()]);
    let signed_in = fixture.github().sign_in_with_token(&format!("  {TOKEN}\n")).unwrap();

    assert_eq!(signed_in.login, "octocat");
    assert_eq!(signed_in.name.as_deref(), Some("The Octocat"));
    assert_eq!(signed_in.source, AccountSource::Token);
    assert_eq!(signed_in.missing_scopes, vec!["gist".to_string()]);
    let requests = fixture.transport.requests();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].method, Method::Get);
    assert_eq!(requests[0].url, "https://api.github.com/user");
    assert_eq!(requests[0].authorization.as_deref(), Some(format!("Bearer {TOKEN}").as_str()));
    assert!(requests[0].user_agent.as_deref().unwrap_or_default().starts_with("GitManager/"));
    assert_eq!(fixture.secrets.get("github.com").as_deref(), Some(TOKEN));
    let file = fixture.account_file();
    assert!(file.contains("octocat"));
    assert!(!file.contains(TOKEN), "the token must never reach github.json");
    assert_eq!(fixture.github().account(), Some(signed_in));
}

#[test]
fn a_rejected_token_is_not_stored() {
    let fixture = Fixture::new(vec![response(401, json!({ "message": "Bad credentials" }))]);
    let error = message(fixture.github().sign_in_with_token(TOKEN));
    assert!(error.contains("rejected the token"), "{error}");
    assert_eq!(fixture.secrets.get("github.com"), None);
    assert_eq!(fixture.github().account(), None);
}

#[test]
fn token_sign_in_refuses_empty_or_spaced_tokens_without_a_request() {
    let fixture = Fixture::new(Vec::new());
    assert!(message(fixture.github().sign_in_with_token("   ")).contains("Paste"));
    assert!(message(fixture.github().sign_in_with_token("ghp_a b")).contains("spaces"));
    assert!(fixture.transport.requests().is_empty());
}

#[test]
fn offline_sign_in_says_github_cannot_be_reached() {
    let fixture = Fixture {
        transport: FakeTransport::offline(),
        ..Fixture::new(Vec::new())
    };
    let error = message(fixture.github().sign_in_with_token(TOKEN));
    assert!(error.starts_with("Could not reach GitHub"), "{error}");
}

#[test]
fn cli_sign_in_stores_no_token_and_asks_gh_each_time() {
    let mut fixture = Fixture::new(vec![
        with_header(response(200, json!({ "login": "octocat" })), "x-oauth-scopes", "gist, read:org, repo"),
        response(200, json!({ "id": "abc", "html_url": "https://gist.github.com/octocat/abc" })),
    ]);
    fixture.secrets.write("github.com", "ghp_stale").unwrap();
    fixture.gh = FakeGh { token: Some("gho_cli") };

    let signed_in = fixture.github().sign_in_with_cli().unwrap();
    assert_eq!(signed_in.source, AccountSource::GhCli);
    assert!(signed_in.missing_scopes.is_empty());
    assert_eq!(fixture.secrets.get("github.com"), None, "an older keychain token is removed");

    fixture
        .github()
        .create_gist(&GistRequest {
            file_name: "a.txt".to_string(),
            description: String::new(),
            public: false,
            content: "hello".to_string(),
        })
        .unwrap();
    let requests = fixture.transport.requests();
    assert_eq!(requests[1].authorization.as_deref(), Some("Bearer gho_cli"));
}

#[test]
fn cli_sign_in_without_gh_login_explains_how() {
    let fixture = Fixture::new(Vec::new());
    assert!(message(fixture.github().sign_in_with_cli()).contains("gh auth login"));
}

#[test]
fn sign_out_removes_the_token_and_the_account() {
    let fixture = Fixture::signed_in(Vec::new());
    fixture.github().sign_out().unwrap();
    assert_eq!(fixture.secrets.get("github.com"), None);
    assert_eq!(fixture.github().account(), None);
    // Twice is fine.
    fixture.github().sign_out().unwrap();
}

#[test]
fn an_unreadable_account_file_means_signed_out() {
    let fixture = Fixture::new(Vec::new());
    std::fs::write(fixture.config.path().join("github.json"), "{ not json").unwrap();
    assert_eq!(fixture.github().account(), None);
}

#[test]
fn signed_out_calls_ask_to_sign_in_without_a_request() {
    let fixture = Fixture::new(Vec::new());
    let error = message(fixture.github().repository("octo", "hello"));
    assert!(error.contains("Sign in to GitHub"), "{error}");
    assert!(fixture.transport.requests().is_empty());
}

#[test]
fn enterprise_hosts_use_the_v3_api_root() {
    assert_eq!(account::api_base_for("github.com"), "https://api.github.com");
    assert_eq!(account::api_base_for("git.example.com"), "https://git.example.com/api/v3");
}

// Share Project on GitHub

fn share_request(remote_name: &str) -> ShareRequest {
    ShareRequest {
        repository_name: "hello-world".to_string(),
        private: true,
        description: "  A test  ".to_string(),
        remote_name: remote_name.to_string(),
        initial_commit_message: None,
    }
}

fn created_repository() -> HttpResponse {
    response(
        201,
        json!({
            "full_name": "octocat/hello-world",
            "html_url": "https://github.com/octocat/hello-world",
            "clone_url": "https://github.com/octocat/hello-world.git",
            "default_branch": "main",
        }),
    )
}

#[test]
fn share_creates_the_repository_and_adds_the_remote() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.commit_all("first");
    let fixture = Fixture::signed_in(vec![created_repository()]);

    let shared = fixture.github().share_project(&repo.path_string(), &share_request("origin")).unwrap();

    assert_eq!(shared.full_name, "octocat/hello-world");
    assert_eq!(shared.remote_name, "origin");
    assert_eq!(shared.branch_name, "main");
    let requests = fixture.transport.requests();
    assert_eq!(requests[0].method, Method::Post);
    assert_eq!(requests[0].url, "https://api.github.com/user/repos");
    assert_eq!(
        requests[0].body,
        Some(json!({ "name": "hello-world", "description": "A test", "private": true, "auto_init": false }))
    );
    assert_eq!(repo.git(&["remote", "get-url", "origin"]).trim(), "https://github.com/octocat/hello-world.git");
}

#[test]
fn share_refuses_an_existing_remote_before_creating_anything() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.commit_all("first");
    repo.git(&["remote", "add", "origin", "https://example.com/other.git"]);
    let fixture = Fixture::signed_in(vec![created_repository()]);

    let error = message(fixture.github().share_project(&repo.path_string(), &share_request("origin")));
    assert!(error.contains("already exists"), "{error}");
    assert!(fixture.transport.requests().is_empty());
}

#[test]
fn share_without_commits_needs_a_commit_message_then_commits_everything() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.write("dir/b.txt", "b\n");
    let fixture = Fixture::signed_in(vec![created_repository()]);

    let error = message(fixture.github().share_project(&repo.path_string(), &share_request("origin")));
    assert!(error.contains("no commits yet"), "{error}");
    assert!(fixture.transport.requests().is_empty());

    let request = ShareRequest {
        initial_commit_message: Some("Initial commit".to_string()),
        ..share_request("origin")
    };
    fixture.github().share_project(&repo.path_string(), &request).unwrap();
    assert_eq!(repo.head_message().trim(), "Initial commit");
    assert_eq!(repo.git(&["ls-files"]).trim(), "a.txt\ndir/b.txt");
}

#[test]
fn share_reports_a_taken_name_from_github() {
    let repo = TestRepo::new();
    repo.write("a.txt", "a\n");
    repo.commit_all("first");
    let fixture = Fixture::signed_in(vec![response(
        422,
        json!({
            "message": "Repository creation failed.",
            "errors": [{ "resource": "Repository", "code": "custom", "field": "name", "message": "name already exists on this account" }],
        }),
    )]);

    let error = message(fixture.github().share_project(&repo.path_string(), &share_request("github")));
    assert_eq!(error, "GitHub could not do it: Repository creation failed: name already exists on this account");
    assert!(repo.git(&["remote"]).trim().is_empty(), "no remote is added after a failure");
}

#[test]
fn repository_name_rules() {
    assert_eq!(validate_repository_name(" hello.world_2-x ").unwrap(), "hello.world_2-x");
    for bad in ["", "  ", ".", "..", "has space", "slash/name", "name.git", "ünïcode", &"a".repeat(101)] {
        assert!(validate_repository_name(bad).is_err(), "{bad:?} should be refused");
    }
}

// Sync Fork

#[test]
fn repository_reports_the_fork_parent() {
    let fixture = Fixture::signed_in(vec![response(
        200,
        json!({
            "full_name": "me/fork",
            "html_url": "https://github.com/me/fork",
            "default_branch": "main",
            "fork": true,
            "parent": { "full_name": "octo/original", "name": "original", "owner": { "login": "octo" }, "default_branch": "trunk" },
        }),
    )]);
    let info = fixture.github().repository("me", "fork").unwrap();
    assert!(info.fork);
    let parent = info.parent.unwrap();
    assert_eq!((parent.owner.as_str(), parent.repo.as_str()), ("octo", "original"));
    assert_eq!(parent.default_branch.as_deref(), Some("trunk"));
    assert_eq!(fixture.transport.requests()[0].url, "https://api.github.com/repos/me/fork");
}

#[test]
fn sync_fork_maps_each_merge_type() {
    let cases = [
        ("fast-forward", SyncKind::FastForward),
        ("merge", SyncKind::Merge),
        ("none", SyncKind::UpToDate),
    ];
    for (merge_type, kind) in cases {
        let fixture = Fixture::signed_in(vec![response(
            200,
            json!({ "message": "Successfully fetched and fast-forwarded from upstream octo:main.", "merge_type": merge_type, "base_branch": "octo:main" }),
        )]);
        let outcome = fixture.github().sync_fork("me", "fork", "main").unwrap();
        assert_eq!(outcome.kind, kind, "{merge_type}");
        assert_eq!(outcome.base_branch.as_deref(), Some("octo:main"));
        let requests = fixture.transport.requests();
        assert_eq!(requests[0].url, "https://api.github.com/repos/me/fork/merge-upstream");
        assert_eq!(requests[0].body, Some(json!({ "branch": "main" })));
    }
}

#[test]
fn sync_fork_conflict_is_an_outcome_and_other_failures_are_errors() {
    let fixture = Fixture::signed_in(vec![
        response(409, json!({ "message": "There are merge conflicts" })),
        response(422, json!({ "message": "This branch could not be synced." })),
    ]);
    let conflict = fixture.github().sync_fork("me", "fork", "main").unwrap();
    assert_eq!(conflict.kind, SyncKind::Conflict);
    assert_eq!(conflict.message, "There are merge conflicts");
    let error = message(fixture.github().sync_fork("me", "fork", "gone"));
    assert!(error.contains("could not be synced"), "{error}");
}

// Create Gist

#[test]
fn gist_creation_sends_one_secret_file() {
    let fixture = Fixture::signed_in(vec![response(
        201,
        json!({ "id": "aa5a315d61ae9438b18d", "html_url": "https://gist.github.com/octocat/aa5a315d61ae9438b18d" }),
    )]);
    let gist = fixture
        .github()
        .create_gist(&GistRequest {
            file_name: " notes.md ".to_string(),
            description: "Some notes".to_string(),
            public: false,
            content: "# Hello\n".to_string(),
        })
        .unwrap();
    assert_eq!(gist.html_url, "https://gist.github.com/octocat/aa5a315d61ae9438b18d");
    let requests = fixture.transport.requests();
    assert_eq!(requests[0].url, "https://api.github.com/gists");
    assert_eq!(
        requests[0].body,
        Some(json!({ "description": "Some notes", "public": false, "files": { "notes.md": { "content": "# Hello\n" } } }))
    );
}

#[test]
fn gist_refuses_empty_content_and_bad_names_without_a_request() {
    let fixture = Fixture::signed_in(Vec::new());
    let request = |file_name: &str, content: &str| GistRequest {
        file_name: file_name.to_string(),
        description: String::new(),
        public: true,
        content: content.to_string(),
    };
    assert!(message(fixture.github().create_gist(&request("a.txt", "  \n"))).contains("empty"));
    assert!(message(fixture.github().create_gist(&request("", "x"))).contains("file name"));
    assert!(message(fixture.github().create_gist(&request("a/b.txt", "x"))).contains("slashes"));
    assert!(fixture.transport.requests().is_empty());
}

// Error mapping

#[test]
fn api_errors_read_clearly() {
    let now = 1_000_000;
    let text = |response: HttpResponse| api_error(&response, now).to_string();

    assert!(text(response(401, json!({ "message": "Bad credentials" }))).contains("Sign in again"));
    let rate = with_header(
        with_header(response(403, json!({ "message": "API rate limit exceeded" })), "x-ratelimit-remaining", "0"),
        "x-ratelimit-reset",
        &(now + 600).to_string(),
    );
    assert_eq!(text(rate), "GitHub's rate limit is reached. Try again in 10 minutes.");
    let secondary = with_header(response(429, json!({})), "retry-after", "30");
    assert_eq!(text(secondary), "GitHub's rate limit is reached. Try again in a minute.");
    let scope = text(response(403, json!({ "message": "Resource not accessible by personal access token" })));
    assert!(scope.contains("lack the repo or gist scope"), "{scope}");
    assert!(text(response(404, json!({ "message": "Not Found" }))).starts_with("Not found on GitHub"));
    assert_eq!(
        text(response(422, json!({ "message": "Validation Failed", "errors": [{ "field": "name", "code": "missing" }] }))),
        "GitHub could not do it: Validation Failed: name is missing"
    );
    assert!(text(response(502, json!({}))).contains("having trouble"));
    let not_json = HttpResponse {
        status: 418,
        headers: Vec::new(),
        body: "teapot".to_string(),
    };
    assert_eq!(text(not_json), "GitHub error (HTTP 418): HTTP 418");
}

#[test]
fn malformed_success_bodies_are_errors_not_panics() {
    let transport = FakeTransport::answering(vec![response(200, json!({ "unexpected": true }))]);
    let client = GitHubClient::new(&transport, "https://api.github.com", TOKEN.to_string());
    let error = message(client.current_user());
    assert!(error.contains("unexpected answer"), "{error}");
}

// The real transport, against a local listener

#[test]
fn ureq_transport_sends_headers_and_body_and_returns_error_statuses() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();
    let server = std::thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        let mut reader = BufReader::new(stream.try_clone().expect("clone stream"));
        let mut head = Vec::new();
        let mut content_length = 0usize;
        loop {
            let mut line = String::new();
            reader.read_line(&mut line).expect("read line");
            if line == "\r\n" || line.is_empty() {
                break;
            }
            if let Some(value) = line.to_ascii_lowercase().strip_prefix("content-length:") {
                content_length = value.trim().parse().unwrap_or_default();
            }
            head.push(line);
        }
        let mut body = vec![0u8; content_length];
        reader.read_exact(&mut body).expect("read body");
        let reply = r#"{"message":"Validation Failed"}"#;
        let mut stream = stream;
        write!(
            stream,
            "HTTP/1.1 422 Unprocessable Entity\r\nContent-Type: application/json\r\nX-RateLimit-Remaining: 59\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{reply}",
            reply.len()
        )
        .expect("write reply");
        (head, String::from_utf8(body).unwrap())
    });

    let transport = UreqTransport::new("GitManager/test");
    let client_request = HttpRequest {
        method: Method::Post,
        url: format!("http://127.0.0.1:{port}/user/repos"),
        headers: vec![
            ("Authorization".to_string(), "Bearer local".to_string()),
            ("Content-Type".to_string(), "application/json".to_string()),
        ],
        body: Some(r#"{"name":"x"}"#.to_string()),
    };
    let reply = transport.send(&client_request).expect("a response");
    let (head, body) = server.join().unwrap();

    assert_eq!(reply.status, 422);
    assert_eq!(reply.header("X-RateLimit-Remaining"), Some("59"));
    assert!(reply.body.contains("Validation Failed"));
    assert!(head[0].starts_with("POST /user/repos HTTP/1.1"));
    let has = |wanted: &str| head.iter().any(|line| line.to_ascii_lowercase().starts_with(wanted));
    assert!(has("authorization: bearer local"));
    assert!(has("user-agent: gitmanager/test"));
    assert_eq!(body, r#"{"name":"x"}"#);
}

#[test]
fn ureq_transport_reports_a_refused_connection() {
    let port = {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.local_addr().unwrap().port()
    };
    let transport = UreqTransport::new("GitManager/test");
    let request = HttpRequest {
        method: Method::Get,
        url: format!("http://127.0.0.1:{port}/user"),
        headers: Vec::new(),
        body: None,
    };
    assert!(transport.send(&request).is_err());
}
