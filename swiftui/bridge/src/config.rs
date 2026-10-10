//! The one piece of src-tauri's config.rs that terminal.rs needs. The real file also reads settings through the
//! command line tool's crate, which the bridge does not build, so the home folder comes from the same shared
//! code (cli/src/home.rs) here.

use std::path::PathBuf;

use crate::error::{AppError, AppResult};

pub fn home_dir() -> AppResult<PathBuf> {
    crate::home::home_dir().map_err(AppError::invalid)
}
