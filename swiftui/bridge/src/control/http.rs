//! HTTP for the control server: one POST /mcp per connection, a bearer token, size limits, then the
//! JSON-RPC message goes to `protocol`.

use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use serde_json::{json, Value};

use super::{protocol, SERVER};

const MAX_HEADER_BYTES: usize = 16 * 1024;
const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;

struct Request {
    method: String,
    path: String,
    headers: BTreeMap<String, String>,
    body: Vec<u8>,
}

pub(super) fn serve(stream: TcpStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut stream = stream;
    let request = match read_request(&mut reader) {
        Ok(request) => request,
        Err(status) => return respond(&mut stream, status, &json!({ "error": reason(status) })),
    };
    let Some(server) = SERVER.get() else {
        return respond(&mut stream, 503, &json!({ "error": "Not ready" }));
    };
    if request.path != "/mcp" {
        return respond(&mut stream, 404, &json!({ "error": "Not found" }));
    }
    if request.method != "POST" {
        return respond(&mut stream, 405, &json!({ "error": "Use POST" }));
    }
    let given = request
        .headers
        .get("authorization")
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    if !tokens_match(&server.token, given) {
        return respond(&mut stream, 401, &json!({ "error": "Missing or wrong token" }));
    }
    let message: Value = match serde_json::from_slice(&request.body) {
        Ok(message) => message,
        Err(_) => {
            let error = json!({ "code": -32700, "message": "Parse error" });
            return respond(&mut stream, 200, &json!({ "jsonrpc": "2.0", "id": null, "error": error }));
        }
    };
    match protocol::handle_message(server, &message) {
        Some(reply) => respond(&mut stream, 200, &reply),
        None => respond_empty(&mut stream, 202),
    }
}

fn read_request(reader: &mut BufReader<TcpStream>) -> Result<Request, u16> {
    let mut head = String::new();
    loop {
        let mut line = String::new();
        let read = reader.read_line(&mut line).map_err(|_| 400u16)?;
        if read == 0 {
            return Err(400);
        }
        head.push_str(&line);
        if head.len() > MAX_HEADER_BYTES {
            return Err(431);
        }
        if line == "\r\n" || line == "\n" {
            break;
        }
    }
    let mut lines = head.lines();
    let mut first = lines.next().unwrap_or_default().split_whitespace();
    let method = first.next().unwrap_or_default().to_string();
    let path = first.next().unwrap_or_default().to_string();
    let headers: BTreeMap<String, String> = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim().to_ascii_lowercase(), value.trim().to_string()))
        .collect();
    let length: usize = headers.get("content-length").and_then(|value| value.parse().ok()).unwrap_or(0);
    if length > MAX_BODY_BYTES {
        return Err(413);
    }
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body).map_err(|_| 400u16)?;
    Ok(Request { method, path, headers, body })
}

/// Same length and every byte equal, without stopping at the first difference.
fn tokens_match(expected: &str, given: &str) -> bool {
    let differences = expected.bytes().zip(given.bytes()).fold(0u8, |acc, (left, right)| acc | (left ^ right));
    expected.len() == given.len() && differences == 0
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        202 => "Accepted",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        413 => "Payload Too Large",
        431 => "Request Header Fields Too Large",
        _ => "Service Unavailable",
    }
}

fn respond(stream: &mut TcpStream, status: u16, body: &Value) -> std::io::Result<()> {
    let text = body.to_string();
    let head = format!(
        "HTTP/1.1 {status} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close",
        reason(status),
        text.len()
    );
    write!(stream, "{head}\r\n\r\n{text}")?;
    stream.flush()
}

fn respond_empty(stream: &mut TcpStream, status: u16) -> std::io::Result<()> {
    write!(stream, "HTTP/1.1 {status} {}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", reason(status))?;
    stream.flush()
}
