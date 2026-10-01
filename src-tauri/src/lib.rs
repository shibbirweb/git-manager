mod commands;
mod config;
mod error;
mod git;
mod memory;
mod merge;
mod state;
#[cfg(test)]
mod test_support;
mod watcher;
mod workspace_file;

use std::sync::atomic::Ordering;

use tauri::{Manager, RunEvent};

use state::{AppState, LaunchMode};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let launch = LaunchMode::from_args(&args);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new(launch))
        .invoke_handler(tauri::generate_handler![
            commands::repo::get_launch_mode,
            commands::repo::open_repo,
            commands::workspace::open_workspace,
            commands::workspace::discover_repositories,
            commands::workspace::init_repository,
            commands::workspace::watch_workspace,
            commands::workspace::unwatch_workspace,
            commands::status::get_status,
            commands::status::get_file_diff,
            commands::status::stage_files,
            commands::status::unstage_files,
            commands::status::discard_files,
            commands::status::stage_content,
            commands::status::write_worktree_file,
            commands::status::commit,
            commands::status::get_head_message,
            commands::merge::list_conflicts,
            commands::merge::load_conflict,
            commands::merge::save_resolution,
            commands::merge::accept_side,
            commands::merge::continue_operation,
            commands::merge::abort_operation,
            commands::merge::skip_rebase_commit,
            commands::merge::load_mergetool,
            commands::merge::save_mergetool,
            commands::merge::cancel_mergetool,
            commands::branch::get_refs,
            commands::branch::checkout_branch,
            commands::branch::checkout_remote_branch,
            commands::branch::create_branch,
            commands::branch::rename_branch,
            commands::branch::delete_branch,
            commands::branch::merge_branch,
            commands::branch::rebase_onto,
            commands::remote::fetch_all,
            commands::remote::pull,
            commands::remote::push,
            commands::history::get_log,
            commands::history::get_commit_details,
            commands::history::get_commit_file_diff,
            commands::history::blame_file,
            commands::history::cherry_pick,
            commands::history::revert_commit,
            commands::history::reset_to,
            commands::history::checkout_commit,
            commands::stash::get_stashes,
            commands::stash::stash_push,
            commands::stash::stash_apply,
            commands::stash::stash_drop,
            commands::config::memory_usage,
            commands::config::load_config,
            commands::config::save_config,
            commands::config::config_dir,
            commands::config::os_info,
            commands::workspace::read_workspace_file,
            commands::workspace::write_workspace_file,
            commands::files::list_directory,
            commands::files::read_worktree_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            let state = app_handle.state::<AppState>();
            if state.launch.is_mergetool() {
                // git mergetool trusts the exit code: 0 only after an explicit save.
                std::process::exit(state.mergetool_exit_code.load(Ordering::SeqCst));
            }
        }
    });
}
