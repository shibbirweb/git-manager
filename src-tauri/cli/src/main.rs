//! `git-manager-cli.exe`, the console program the Windows installer puts next to the app.
//! `git-manager-cli cli <command>` runs the command line tool; anything else (a folder, nothing)
//! starts the app with the same arguments, like `git-manager` does on macOS and Linux.

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    std::process::exit(git_manager_cli::console_main(&args));
}
