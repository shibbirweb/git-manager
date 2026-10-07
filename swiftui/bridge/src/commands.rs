//! The commands the SwiftUI app can call, named and shaped like the Tauri ones
//! (src-tauri/src/commands), so `src/lib/api.ts` stays the reference for both apps.

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::git::repo as git_repo;
use crate::git::status::{self, RepoStatus};

pub fn dispatch(command: &str, args: Value) -> AppResult<Value> {
    match command {
        "get_status" => to_json(get_status(parse(command, args)?)?),
        _ => Err(AppError::invalid(format!("Unknown command: {command}"))),
    }
}

fn parse<T: DeserializeOwned>(command: &str, args: Value) -> AppResult<T> {
    serde_json::from_value(args).map_err(|err| AppError::invalid(format!("{command}: {err}")))
}

fn to_json<T: Serialize>(value: T) -> AppResult<Value> {
    serde_json::to_value(value).map_err(|err| AppError::invalid(err.to_string()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetStatusArgs {
    repo_path: String,
    known_hash: Option<String>,
}

/// Same as the Tauri command in src-tauri/src/commands/status.rs.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusSnapshot {
    hash: String,
    status: Option<RepoStatus>,
}

fn get_status(args: GetStatusArgs) -> AppResult<StatusSnapshot> {
    let status = status::read(&git_repo::open(&args.repo_path)?)?;
    let hash = status::hash(&status);
    if args.known_hash.as_deref() == Some(hash.as_str()) {
        return Ok(StatusSnapshot { hash, status: None });
    }
    Ok(StatusSnapshot { hash, status: Some(status) })
}
