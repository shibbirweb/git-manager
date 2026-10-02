//! The HTTP side of the MCP Streamable HTTP transport (JSON responses only), on 127.0.0.1.
//! httparse reads the request head; the loop around it is ours so the server can cap
//! connections, close idle ones and leave no thread behind when it stops.

use std::io::{ErrorKind, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use super::dto::McpClient;
use super::protocol;
use super::token::tokens_match;
use super::Shared;

pub const MAX_BODY_BYTES: usize = 1024 * 1024;
pub const MAX_CONNECTIONS: usize = 8;
const MAX_HEAD_BYTES: usize = 16 * 1024;
const MAX_HEADERS: usize = 48;
/// How often a waiting connection checks whether the server is stopping.
const POLL: Duration = Duration::from_millis(200);
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);
const BODY_TIMEOUT: Duration = Duration::from_secs(30);
/// Requests from `git-manager cli` carry this header with the value "cli".
pub const CLIENT_HEADER: &str = "x-git-manager-client";
pub const CLI_OFF: &str = "The command line tool is turned off in Git Manager settings";
pub const MCP_OFF: &str = "The MCP server is turned off in Git Manager settings";

pub struct Running {
    pub port: u16,
    pub requested_port: u16,
    stop: Arc<AtomicBool>,
    live: Arc<AtomicUsize>,
    accept: Option<JoinHandle<()>>,
}

/// Binds 127.0.0.1:`port` (0 picks a free port) and starts accepting.
pub fn start(shared: Arc<Shared>, port: u16) -> Result<Running, String> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, port)).map_err(|err| match err.kind() {
        ErrorKind::AddrInUse => format!("Port {port} is already in use. Choose another port in Settings."),
        _ => format!("Could not listen on port {port}: {err}"),
    })?;
    let bound = listener.local_addr().map_err(|err| err.to_string())?.port();
    let stop = Arc::new(AtomicBool::new(false));
    let live = Arc::new(AtomicUsize::new(0));
    let accept = {
        let (stop, live) = (stop.clone(), live.clone());
        std::thread::Builder::new()
            .name("mcp-accept".into())
            .spawn(move || accept_loop(listener, shared, stop, live))
            .map_err(|err| format!("Could not start the MCP server: {err}"))?
    };
    Ok(Running {
        port: bound,
        requested_port: port,
        stop,
        live,
        accept: Some(accept),
    })
}

impl Running {
    /// Stops accepting, wakes the accept thread and gives open connections a moment to close.
    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        // A connection to ourselves unblocks accept().
        let _ = TcpStream::connect_timeout(&SocketAddr::from((Ipv4Addr::LOCALHOST, self.port)), Duration::from_secs(1));
        if let Some(accept) = self.accept.take() {
            let _ = accept.join();
        }
        let deadline = Instant::now() + POLL * 5;
        while self.live.load(Ordering::SeqCst) > 0 && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    #[cfg(test)]
    pub fn open_connections(&self) -> usize {
        self.live.load(Ordering::SeqCst)
    }
}

/// Decrements the connection count however the thread ends.
struct LiveGuard(Arc<AtomicUsize>);

impl Drop for LiveGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

fn accept_loop(listener: TcpListener, shared: Arc<Shared>, stop: Arc<AtomicBool>, live: Arc<AtomicUsize>) {
    for stream in listener.incoming() {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let Ok(mut stream) = stream else {
            continue;
        };
        if live.load(Ordering::SeqCst) >= MAX_CONNECTIONS {
            let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
            let _ = write_response(&mut stream, 503, &json!({ "error": "Too many connections" }), true, &[]);
            continue;
        }
        live.fetch_add(1, Ordering::SeqCst);
        let guard = LiveGuard(live.clone());
        let (shared, stop) = (shared.clone(), stop.clone());
        let spawned = std::thread::Builder::new().name("mcp-connection".into()).spawn(move || {
            let _guard = guard;
            serve_connection(stream, &shared, &stop);
        });
        // A failed spawn dropped the closure, and with it the guard and the stream.
        let _ = spawned;
    }
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        202 => "Accepted",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        411 => "Length Required",
        413 => "Payload Too Large",
        431 => "Request Header Fields Too Large",
        503 => "Service Unavailable",
        _ => "Error",
    }
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    body: &Value,
    close: bool,
    extra_headers: &[(&str, &str)],
) -> std::io::Result<()> {
    let body = if status == 202 { String::new() } else { body.to_string() };
    let mut head = format!(
        "HTTP/1.1 {status} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: {}\r\n",
        reason(status),
        body.len(),
        if close { "close" } else { "keep-alive" },
    );
    for (name, value) in extra_headers {
        head.push_str(&format!("{name}: {value}\r\n"));
    }
    head.push_str("\r\n");
    stream.write_all(head.as_bytes())?;
    stream.write_all(body.as_bytes())?;
    stream.flush()
}

/// What the server needs from a request head.
#[derive(Debug, Default)]
pub struct Head {
    pub method: String,
    pub path: String,
    pub content_length: Option<usize>,
    pub chunked: bool,
    pub origin: bool,
    pub authorization: Option<String>,
    pub client: Option<String>,
    pub expect_continue: bool,
    pub close: bool,
    pub length: usize,
}

/// Ok(None) while the head is incomplete.
pub fn parse_head(buffer: &[u8]) -> Result<Option<Head>, ()> {
    let mut headers = [httparse::EMPTY_HEADER; MAX_HEADERS];
    let mut request = httparse::Request::new(&mut headers);
    let length = match request.parse(buffer) {
        Ok(httparse::Status::Complete(length)) => length,
        Ok(httparse::Status::Partial) => return Ok(None),
        Err(_) => return Err(()),
    };
    let mut head = Head {
        method: request.method.unwrap_or_default().to_string(),
        path: request.path.unwrap_or_default().to_string(),
        close: request.version == Some(0),
        length,
        ..Head::default()
    };
    for header in request.headers.iter() {
        let value = String::from_utf8_lossy(header.value).trim().to_string();
        match header.name.to_ascii_lowercase().as_str() {
            "content-length" => head.content_length = Some(value.parse().map_err(|_| ())?),
            "transfer-encoding" => head.chunked = true,
            "origin" => head.origin = true,
            "authorization" => head.authorization = Some(value),
            CLIENT_HEADER => head.client = Some(value.to_ascii_lowercase()),
            "expect" => head.expect_continue = value.eq_ignore_ascii_case("100-continue"),
            "connection" => {
                let lower = value.to_ascii_lowercase();
                if lower.contains("close") {
                    head.close = true;
                } else if lower.contains("keep-alive") {
                    head.close = false;
                }
            }
            _ => {}
        }
    }
    Ok(Some(head))
}

/// Why a request is refused before its body is read: status and message.
pub fn refusal(shared: &Shared, head: &Head) -> Option<(u16, &'static str, McpClient)> {
    let client = if head.client.as_deref() == Some("cli") { McpClient::Cli } else { McpClient::Mcp };
    // Browsers send Origin and harnesses do not: this blocks web pages and DNS rebinding.
    if head.origin {
        return Some((403, "Requests from web pages are not accepted", client));
    }
    let token = shared.token();
    let bearer = head.authorization.as_deref().and_then(|value| value.strip_prefix("Bearer "));
    let authorized = matches!((token.as_deref(), bearer), (Some(expected), Some(given)) if tokens_match(expected, given.trim()));
    if !authorized {
        return Some((401, "Missing or wrong bearer token", client));
    }
    let switches = shared.switches();
    match client {
        McpClient::Cli if !switches.cli => return Some((403, CLI_OFF, client)),
        McpClient::Mcp if !switches.mcp => return Some((403, MCP_OFF, client)),
        _ => {}
    }
    let path = head.path.split('?').next().unwrap_or_default();
    if path != "/mcp" {
        return Some((404, "Not found: the MCP endpoint is /mcp", client));
    }
    if head.method != "POST" {
        return Some((405, "Use POST", client));
    }
    if head.chunked || head.content_length.is_none() {
        return Some((411, "Send the body with a Content-Length", client));
    }
    if head.content_length.unwrap_or(0) > MAX_BODY_BYTES {
        return Some((413, "The request body is over 1 MB", client));
    }
    None
}

enum ReadOutcome {
    Data,
    Closed,
    Idle,
}

fn read_more(stream: &mut TcpStream, buffer: &mut Vec<u8>, chunk: &mut [u8]) -> ReadOutcome {
    match stream.read(chunk) {
        Ok(0) => ReadOutcome::Closed,
        Ok(count) => {
            buffer.extend_from_slice(&chunk[..count]);
            ReadOutcome::Data
        }
        Err(err) if matches!(err.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut | ErrorKind::Interrupted) => ReadOutcome::Idle,
        Err(_) => ReadOutcome::Closed,
    }
}

/// One keep-alive connection, one request at a time.
fn serve_connection(mut stream: TcpStream, shared: &Shared, stop: &AtomicBool) {
    let _ = stream.set_read_timeout(Some(POLL));
    let _ = stream.set_nodelay(true);
    let mut buffer: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 8192];
    let mut last_activity = Instant::now();
    loop {
        if stop.load(Ordering::SeqCst) {
            return;
        }
        let head = match parse_head(&buffer) {
            Ok(Some(head)) => head,
            Ok(None) => {
                if buffer.len() > MAX_HEAD_BYTES {
                    let _ = write_response(&mut stream, 431, &json!({ "error": "Request head too large" }), true, &[]);
                    return;
                }
                match read_more(&mut stream, &mut buffer, &mut chunk) {
                    ReadOutcome::Data => last_activity = Instant::now(),
                    ReadOutcome::Closed => return,
                    ReadOutcome::Idle if last_activity.elapsed() > IDLE_TIMEOUT => return,
                    ReadOutcome::Idle => {}
                }
                continue;
            }
            Err(()) => {
                let _ = write_response(&mut stream, 400, &json!({ "error": "Bad request" }), true, &[]);
                return;
            }
        };
        if let Some((status, message, _client)) = refusal(shared, &head) {
            let allow: &[(&str, &str)] = if status == 405 { &[("Allow", "POST")] } else { &[] };
            let _ = write_response(&mut stream, status, &json!({ "error": message }), true, allow);
            return;
        }
        let client = if head.client.as_deref() == Some("cli") { McpClient::Cli } else { McpClient::Mcp };
        let body_length = head.content_length.unwrap_or(0);
        let waiting = head.expect_continue && buffer.len() < head.length + body_length;
        if waiting && stream.write_all(b"HTTP/1.1 100 Continue\r\n\r\n").is_err() {
            return;
        }
        let body_started = Instant::now();
        while buffer.len() < head.length + body_length {
            match read_more(&mut stream, &mut buffer, &mut chunk) {
                ReadOutcome::Data => {}
                ReadOutcome::Closed => return,
                ReadOutcome::Idle if stop.load(Ordering::SeqCst) || body_started.elapsed() > BODY_TIMEOUT => return,
                ReadOutcome::Idle => {}
            }
        }
        let body: Vec<u8> = buffer[head.length..head.length + body_length].to_vec();
        buffer.drain(..head.length + body_length);
        let (status, reply) = protocol::handle_body(shared, client, &body);
        let reply = reply.unwrap_or(Value::Null);
        if write_response(&mut stream, status, &reply, head.close, &[]).is_err() || head.close {
            return;
        }
        last_activity = Instant::now();
    }
}
