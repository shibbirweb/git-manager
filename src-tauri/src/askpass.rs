//! Answers the credential prompts of git and ssh with a dialog in the app, instead of failing
//! (the GUI has no terminal, so `GIT_TERMINAL_PROMPT=0` makes git give up at once).
//!
//! Git and ssh run an askpass program with the prompt ("Username for 'https://github.com': ",
//! "Enter passphrase for key ...") as its only argument and read the answer from its stdout. Our
//! own executable is that program: started with `GM_ASKPASS_PORT` and `GM_ASKPASS_TOKEN` in its
//! environment, [`client_main`] sends the prompt to the running app over a loopback connection
//! and prints what the dialog returns. The token keeps other local programs from asking or
//! answering. Only commands the user starts get these variables (see [`apply`]), so a background
//! fetch never opens a dialog.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};

const PORT_VAR: &str = "GM_ASKPASS_PORT";
const TOKEN_VAR: &str = "GM_ASKPASS_TOKEN";
const REPO_VAR: &str = "GM_ASKPASS_REPO";
/// A dialog nobody answers gives up, so git does not wait forever.
const ANSWER_TIMEOUT: Duration = Duration::from_secs(300);
/// No prompt or answer is anywhere near this; it bounds what one connection may send.
const MAX_MESSAGE: u64 = 64 * 1024;

#[derive(Serialize, Deserialize)]
struct Request {
    token: String,
    prompt: String,
    repo_path: String,
}

#[derive(Serialize, Deserialize)]
struct Reply {
    answer: Option<String>,
}

/// One prompt for the page to show; answered with [`respond`].
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AskpassQuestion {
    pub id: u64,
    pub prompt: String,
    /// The repository (or, for a clone, the folder) of the git command that asks.
    pub repo_path: String,
}

/// How questions reach the user: `ask` shows one, `done` takes it away again (answered here or
/// in another window, or timed out).
pub trait AskpassHooks: Send + Sync {
    fn ask(&self, question: AskpassQuestion);
    fn done(&self, id: u64);
}

struct Server {
    port: u16,
    token: String,
}

static HOOKS: OnceLock<Box<dyn AskpassHooks>> = OnceLock::new();
static SERVER: OnceLock<Option<Server>> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

fn pending() -> &'static Mutex<HashMap<u64, mpsc::Sender<Option<String>>>> {
    static PENDING: OnceLock<Mutex<HashMap<u64, mpsc::Sender<Option<String>>>>> = OnceLock::new();
    PENDING.get_or_init(Default::default)
}

/// Called once at start: from now on prompts go to `hooks`. Without it (tests, the CLI) git
/// keeps failing on a prompt as before.
pub fn install(hooks: Box<dyn AskpassHooks>) {
    let _ = HOOKS.set(hooks);
}

fn new_token() -> Option<String> {
    let mut bytes = [0u8; 24];
    getrandom::fill(&mut bytes).ok()?;
    Some(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// The loopback listener, started the first time a command may need it.
fn server() -> Option<&'static Server> {
    SERVER
        .get_or_init(|| {
            HOOKS.get()?;
            let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).ok()?;
            let port = listener.local_addr().ok()?.port();
            let token = new_token()?;
            let expected = token.clone();
            std::thread::spawn(move || {
                for stream in listener.incoming().flatten() {
                    let expected = expected.clone();
                    std::thread::spawn(move || {
                        let _ = serve(stream, &expected);
                    });
                }
            });
            Some(Server { port, token })
        })
        .as_ref()
}

fn serve(stream: TcpStream, token: &str) -> std::io::Result<()> {
    let mut line = String::new();
    BufReader::new(stream.try_clone()?.take(MAX_MESSAGE)).read_line(&mut line)?;
    let answer = match serde_json::from_str::<Request>(&line) {
        Ok(request) if request.token == token => ask_user(request.prompt, request.repo_path),
        _ => None,
    };
    let mut reply = serde_json::to_string(&Reply { answer }).unwrap_or_else(|_| "{\"answer\":null}".to_string());
    reply.push('\n');
    let mut stream = stream;
    stream.write_all(reply.as_bytes())
}

/// Shows the prompt and waits for the answer; None when cancelled or timed out.
fn ask_user(prompt: String, repo_path: String) -> Option<String> {
    let hooks = HOOKS.get()?;
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    let (sender, receiver) = mpsc::channel();
    pending().lock().ok()?.insert(id, sender);
    hooks.ask(AskpassQuestion { id, prompt, repo_path });
    let answer = receiver.recv_timeout(ANSWER_TIMEOUT).ok().flatten();
    // Answered elsewhere or timed out: every window drops the question.
    if let Ok(mut map) = pending().lock() {
        map.remove(&id);
    }
    hooks.done(id);
    answer
}

/// The page answered question `id` (None: Cancel).
pub fn respond(id: u64, answer: Option<String>) {
    let sender = pending().lock().ok().and_then(|mut map| map.remove(&id));
    if let Some(sender) = sender {
        let _ = sender.send(answer);
    }
}

/// Lets a command the user started ask for credentials: git and ssh run this executable as
/// their askpass program. Does nothing when prompts cannot be shown.
pub fn apply(command: &mut Command, repo_path: &Path) {
    let Some(server) = server() else {
        return;
    };
    let Ok(program) = std::env::current_exe() else {
        return;
    };
    command
        .env("GIT_ASKPASS", &program)
        .env("SSH_ASKPASS", &program)
        // OpenSSH uses SSH_ASKPASS without a terminal only when told to (8.4 and later).
        .env("SSH_ASKPASS_REQUIRE", "force")
        .env(PORT_VAR, server.port.to_string())
        .env(TOKEN_VAR, &server.token)
        .env(REPO_VAR, repo_path);
}

/// Sends `prompt` to the app listening on `port` and returns its answer.
fn request_answer(port: u16, token: &str, prompt: &str, repo_path: &str) -> std::io::Result<Option<String>> {
    let mut stream = TcpStream::connect((Ipv4Addr::LOCALHOST, port))?;
    let mut request = serde_json::to_string(&Request {
        token: token.to_string(),
        prompt: prompt.to_string(),
        repo_path: repo_path.to_string(),
    })?;
    request.push('\n');
    stream.write_all(request.as_bytes())?;
    let mut line = String::new();
    BufReader::new(stream.take(MAX_MESSAGE)).read_line(&mut line)?;
    Ok(serde_json::from_str::<Reply>(&line)?.answer)
}

/// When this executable was started as git's or ssh's askpass program: asks the app and returns
/// the exit code (0 with the answer on stdout, 1 when cancelled). None for a normal start.
pub fn client_main() -> Option<i32> {
    let token = std::env::var(TOKEN_VAR).ok()?;
    let port = std::env::var(PORT_VAR).ok()?.parse::<u16>().ok()?;
    let prompt = std::env::args().nth(1).unwrap_or_default();
    let repo_path = std::env::var(REPO_VAR).unwrap_or_default();
    Some(match request_answer(port, &token, &prompt, &repo_path) {
        Ok(Some(answer)) => {
            let mut stdout = std::io::stdout();
            // Git and ssh read up to the first line break.
            let written = writeln!(stdout, "{answer}").and_then(|()| stdout.flush());
            i32::from(written.is_err())
        }
        _ => 1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    /// Answers every question at once from a table, like a user typing.
    struct AutoAnswer {
        asked: Arc<Mutex<Vec<String>>>,
    }

    impl AskpassHooks for AutoAnswer {
        fn ask(&self, question: AskpassQuestion) {
            self.asked.lock().unwrap().push(question.prompt.clone());
            let answer = if question.prompt.starts_with("Username") {
                Some("octocat".to_string())
            } else if question.prompt.starts_with("Password") {
                Some("s3cret token".to_string())
            } else {
                None
            };
            std::thread::spawn(move || respond(question.id, answer));
        }

        fn done(&self, _id: u64) {}
    }

    fn installed() -> (&'static Server, Arc<Mutex<Vec<String>>>) {
        static ASKED: OnceLock<Arc<Mutex<Vec<String>>>> = OnceLock::new();
        let asked = ASKED.get_or_init(Default::default).clone();
        install(Box::new(AutoAnswer { asked: asked.clone() }));
        (server().expect("the askpass server starts"), asked)
    }

    #[test]
    fn answers_a_prompt_and_refuses_a_wrong_token() {
        let (server, asked) = installed();
        let answer = request_answer(server.port, &server.token, "Username for 'https://example.com': ", "/repo").unwrap();
        assert_eq!(answer.as_deref(), Some("octocat"));
        assert!(asked.lock().unwrap().iter().any(|prompt| prompt.starts_with("Username")));
        assert_eq!(request_answer(server.port, "wrong", "Password for 'https://example.com': ", "/repo").unwrap(), None);
        // A prompt the user cancels.
        assert_eq!(request_answer(server.port, &server.token, "Something else?", "/repo").unwrap(), None);
    }

    #[cfg(unix)]
    #[test]
    fn git_asks_through_the_app() {
        let (_server, _asked) = installed();
        let repo = crate::test_support::TestRepo::new();
        // This test binary cannot act as the askpass program, so a tiny script stands in for
        // `client_main`: it forwards the prompt with the same environment over the same protocol.
        let script = repo.path.join("askpass.sh");
        std::fs::write(
            &script,
            "#!/bin/sh\nprintf '{\"token\":\"%s\",\"prompt\":\"%s\",\"repo_path\":\"\"}\\n' \"$GM_ASKPASS_TOKEN\" \"$1\" \
             | nc -w 5 127.0.0.1 \"$GM_ASKPASS_PORT\" | sed -n 's/.*\"answer\":\"\\([^\"]*\\)\".*/\\1/p'\n",
        )
        .unwrap();
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let mut command = crate::git::cli::command(&repo.path);
        apply(&mut command, &repo.path);
        let output = command
            .env("GIT_ASKPASS", &script)
            .args(["-c", "credential.helper=", "credential", "fill"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                child.stdin.take().unwrap().write_all(b"protocol=https\nhost=example.com\n\n")?;
                child.wait_with_output()
            })
            .unwrap();
        let text = String::from_utf8_lossy(&output.stdout);
        assert!(text.contains("username=octocat"), "{text}");
        assert!(text.contains("password=s3cret token"), "{text}");
    }
}
