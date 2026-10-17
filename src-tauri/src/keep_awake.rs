//! Keep computer awake, like Orca: while any window asks (the mode is On, or an agent works in Agent mode), the
//! display and the system stay awake, so the screen neither turns off nor locks and long agent runs finish.
//! macOS: `/usr/bin/caffeinate -d -i -s -w <app pid>`, which also ends by itself if the app dies. Windows:
//! `SetThreadExecutionState` on a thread of its own. Linux: `systemd-inhibit` when it is there.

use std::collections::BTreeSet;
use std::sync::Mutex;

/// Which windows want the computer awake: the first one starts the guard, the last one to stop ends it.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Requests {
    windows: BTreeSet<String>,
}

/// What a change of requests means for the guard.
#[derive(Debug, PartialEq, Eq)]
pub enum Change {
    Start,
    Stop,
    Keep,
}

impl Requests {
    pub fn set(&mut self, window: &str, wanted: bool) -> Change {
        let before = !self.windows.is_empty();
        if wanted {
            self.windows.insert(window.to_string());
        } else {
            self.windows.remove(window);
        }
        match (before, !self.windows.is_empty()) {
            (false, true) => Change::Start,
            (true, false) => Change::Stop,
            _ => Change::Keep,
        }
    }
}

/// Holds the computer awake until dropped.
pub enum Guard {
    #[cfg(not(windows))]
    Process(std::process::Child),
    #[cfg(windows)]
    Thread(std::sync::mpsc::Sender<()>),
}

impl Guard {
    /// The guard still holds (a killed caffeinate does not).
    fn holds(&mut self) -> bool {
        match self {
            #[cfg(not(windows))]
            Guard::Process(child) => matches!(child.try_wait(), Ok(None)),
            #[cfg(windows)]
            Guard::Thread(_) => true,
        }
    }
}

impl Drop for Guard {
    fn drop(&mut self) {
        match self {
            #[cfg(not(windows))]
            Guard::Process(child) => {
                let _ = child.kill();
                let _ = child.wait();
            }
            #[cfg(windows)]
            Guard::Thread(stop) => {
                let _ = stop.send(());
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn start_guard() -> Result<Guard, String> {
    let pid = std::process::id().to_string();
    std::process::Command::new("/usr/bin/caffeinate")
        .args(["-d", "-i", "-s", "-w", &pid])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map(Guard::Process)
        .map_err(|err| format!("Could not start caffeinate: {err}"))
}

#[cfg(windows)]
fn start_guard() -> Result<Guard, String> {
    use windows_sys::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
    };
    let (stop, stopped) = std::sync::mpsc::channel::<()>();
    let (ready, started) = std::sync::mpsc::channel::<bool>();
    std::thread::Builder::new()
        .name("keep-awake".to_string())
        .spawn(move || {
            // The state belongs to this thread: it holds until the thread resets it or ends.
            let held = unsafe { SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED) } != 0;
            let _ = ready.send(held);
            let _ = stopped.recv();
            unsafe { SetThreadExecutionState(ES_CONTINUOUS) };
        })
        .map_err(|err| err.to_string())?;
    match started.recv() {
        Ok(true) => Ok(Guard::Thread(stop)),
        _ => Err("Windows did not keep the computer awake".to_string()),
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn start_guard() -> Result<Guard, String> {
    std::process::Command::new("systemd-inhibit")
        .args([
            "--what=idle:sleep",
            "--who=Nibtree",
            "--why=Keep computer awake",
            "--mode=block",
            "sleep",
            "infinity",
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map(Guard::Process)
        .map_err(|err| format!("Keeping the computer awake needs systemd-inhibit: {err}"))
}

#[derive(Default)]
pub struct KeepAwake {
    inner: Mutex<(Requests, Option<Guard>)>,
}

impl KeepAwake {
    /// `window` wants the computer awake or not; returns whether it is held awake now.
    pub fn set(&self, window: &str, wanted: bool) -> Result<bool, String> {
        let mut inner = self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let (requests, guard) = &mut *inner;
        let change = requests.set(window, wanted);
        let asked = !requests.windows.is_empty();
        match change {
            Change::Stop => *guard = None,
            // Started now, or restarted if something ended it (caffeinate killed from outside).
            Change::Start | Change::Keep if asked && !guard.as_mut().is_some_and(Guard::holds) => {
                *guard = Some(start_guard()?);
            }
            _ => {}
        }
        Ok(guard.is_some())
    }

    /// A closed window asks for nothing any more.
    pub fn release(&self, window: &str) {
        let _ = self.set(window, false);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_request_starts_and_the_last_stops() {
        let mut requests = Requests::default();
        assert_eq!(requests.set("main", true), Change::Start);
        assert_eq!(requests.set("main", true), Change::Keep);
        assert_eq!(requests.set("second", true), Change::Keep);
        assert_eq!(requests.set("main", false), Change::Keep);
        assert_eq!(requests.set("second", false), Change::Stop);
        assert_eq!(requests.set("second", false), Change::Keep);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn holds_caffeinate_while_asked_and_ends_it_after() {
        let awake = KeepAwake::default();
        assert!(awake.set("main", true).unwrap());
        let pid = {
            let inner = awake.inner.lock().unwrap();
            match inner.1.as_ref() {
                Some(Guard::Process(child)) => child.id(),
                None => panic!("no guard"),
            }
        };
        let running = || std::process::Command::new("kill").args(["-0", &pid.to_string()]).status().unwrap().success();
        assert!(running());
        assert!(!awake.set("main", false).unwrap());
        assert!(!running());
    }
}
