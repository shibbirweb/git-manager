use git2::Repository;
use serde::Serialize;

use super::repo::short_id;
use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    pub index: usize,
    pub message: String,
    pub short_id: String,
}

pub fn list(repo: &mut Repository) -> AppResult<Vec<StashEntry>> {
    let mut entries = Vec::new();
    repo.stash_foreach(|index, message, oid| {
        entries.push(StashEntry {
            index,
            message: message.to_string(),
            short_id: short_id(*oid),
        });
        true
    })?;
    Ok(entries)
}
