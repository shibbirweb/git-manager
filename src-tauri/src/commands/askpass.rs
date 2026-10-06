//! The dialog side of askpass.rs: questions go to the windows showing the repository, answers
//! come back with `askpass_respond`.

use tauri::{AppHandle, Emitter};

use crate::askpass::{self, AskpassHooks, AskpassQuestion};

/// Sends each question to the windows showing its repository (every window when none does,
/// as for a clone), and tells all of them when it is settled.
pub struct WindowHooks {
    app: AppHandle,
}

impl WindowHooks {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl AskpassHooks for WindowHooks {
    fn ask(&self, question: AskpassQuestion) {
        let canonical = crate::windows::canonical(&question.repo_path);
        super::window::emit_for_path(&self.app, &canonical, "askpass-request", question);
    }

    fn done(&self, id: u64) {
        let _ = self.app.emit("askpass-done", id);
    }
}

/// The user answered (or cancelled, with None) a credential prompt.
#[tauri::command]
pub fn askpass_respond(id: u64, answer: Option<String>) {
    askpass::respond(id, answer);
}
