//! The HTTP layer of the GitHub client, behind a trait so the tests can answer requests
//! without a network. The real transport is a blocking ureq agent on the system TLS stack.

use std::time::Duration;

use ureq::config::RedirectAuthHeaders;
use ureq::tls::{RootCerts, TlsConfig, TlsProvider};

/// Responses larger than this are refused (a gist or a repository listing is far smaller).
const MAX_BODY_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Method {
    Get,
    Post,
}

impl Method {
    pub fn as_str(self) -> &'static str {
        match self {
            Method::Get => "GET",
            Method::Post => "POST",
        }
    }
}

/// One API call. Not `Debug`: the headers carry the token.
pub struct HttpRequest {
    pub method: Method,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
}

#[cfg(test)]
impl HttpRequest {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

#[derive(Debug, Clone, Default)]
pub struct HttpResponse {
    pub status: u16,
    /// Header names in lower case.
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl HttpResponse {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

/// Sends a request and returns the response whatever its status; Err only when no
/// response arrived (offline, DNS, TLS, timeout).
pub trait HttpTransport: Send + Sync {
    fn send(&self, request: &HttpRequest) -> Result<HttpResponse, String>;
}

pub struct UreqTransport {
    agent: ureq::Agent,
}

impl UreqTransport {
    pub fn new(user_agent: &str) -> UreqTransport {
        let tls = TlsConfig::builder()
            .provider(TlsProvider::NativeTls)
            .root_certs(RootCerts::PlatformVerifier)
            .build();
        let config = ureq::Agent::config_builder()
            .tls_config(tls)
            .user_agent(user_agent)
            // 4xx and 5xx carry GitHub's message: read them instead of failing.
            .http_status_as_error(false)
            .timeout_connect(Some(Duration::from_secs(10)))
            .timeout_global(Some(Duration::from_secs(60)))
            // The API redirects renamed repositories on the same host; keep the token there only.
            .redirect_auth_headers(RedirectAuthHeaders::SameHost)
            .max_redirects(5)
            .build();
        UreqTransport {
            agent: ureq::Agent::new_with_config(config),
        }
    }
}

impl HttpTransport for UreqTransport {
    fn send(&self, request: &HttpRequest) -> Result<HttpResponse, String> {
        let mut builder = ureq::http::Request::builder()
            .method(request.method.as_str())
            .uri(request.url.as_str());
        for (name, value) in &request.headers {
            builder = builder.header(name.as_str(), value.as_str());
        }
        // GET carries no body at all, not an empty one.
        let sent = match &request.body {
            Some(body) => builder
                .body(body.clone())
                .map_err(|err| err.to_string())
                .map(|http_request| self.agent.run(http_request)),
            None => builder
                .body(())
                .map_err(|err| err.to_string())
                .map(|http_request| self.agent.run(http_request)),
        };
        let mut response = sent?.map_err(describe_error)?;
        let status = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .map(|(name, value)| (name.as_str().to_ascii_lowercase(), value.to_str().unwrap_or_default().to_string()))
            .collect();
        let body = response
            .body_mut()
            .with_config()
            .limit(MAX_BODY_BYTES)
            .read_to_string()
            .map_err(describe_error)?;
        Ok(HttpResponse { status, headers, body })
    }
}

fn describe_error(err: ureq::Error) -> String {
    match err {
        ureq::Error::Timeout(_) => "the request timed out".to_string(),
        ureq::Error::HostNotFound => "the host was not found (are you offline?)".to_string(),
        ureq::Error::ConnectionFailed => "the connection failed (are you offline?)".to_string(),
        other => other.to_string(),
    }
}
