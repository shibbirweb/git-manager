//! Settings every helper process the app starts in the background gets.

use std::process::Command;

/// Windows gives a console program started by a GUI app a console window of its own, so every
/// git call would flash one on screen. CREATE_NO_WINDOW starts it without one.
pub fn hide_console(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}
