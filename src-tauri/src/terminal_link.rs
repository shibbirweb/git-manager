//! Where a terminal's output goes. Normally to its page's channel; while Clear Cache restarts
//! the page, the output and the exit are held here instead, so the shell keeps running, and the
//! new page connects again (`reattach`) and gets what it missed. The page also leaves its
//! layout and each terminal's screen here (`stash`), since everything in the page goes away.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

/// What a link hands to its page.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Delivery {
    Output(Vec<u8>),
    Exit(Option<i32>),
}

/// Sends one delivery to a page (its channel, or a test's list).
pub type Sink = Box<dyn FnMut(Delivery) + Send>;
/// A shell's output callback, as the terminal and run starters take it.
pub type OutputFn = Box<dyn FnMut(Vec<u8>) + Send>;
/// A shell's exit callback, with its terminal id.
pub type ExitFn = Box<dyn FnOnce(u32, Option<i32>) + Send>;

/// Output held while no page is connected; older output goes first. The page replays its own
/// screen, so this only has to cover the few seconds of a restart.
pub const HELD_LIMIT: usize = 4 * 1024 * 1024;
/// A terminal no page reconnected to within this long is closed, so no shell runs unseen.
pub const DETACHED_TIMEOUT: Duration = Duration::from_secs(120);

enum LinkState {
    Attached(Sink),
    Detached {
        held: Vec<u8>,
        exit: Option<Option<i32>>,
        since: Instant,
    },
    /// The exit reached a page; nothing more comes.
    Ended,
}

pub struct Link {
    state: Mutex<LinkState>,
}

impl Link {
    fn new(sink: Sink) -> Link {
        Link {
            state: Mutex::new(LinkState::Attached(sink)),
        }
    }

    fn lock(&self) -> MutexGuard<'_, LinkState> {
        self.state.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn output(&self, bytes: Vec<u8>) {
        match &mut *self.lock() {
            LinkState::Attached(sink) => sink(Delivery::Output(bytes)),
            LinkState::Detached { held, .. } => {
                held.extend_from_slice(&bytes);
                if held.len() > HELD_LIMIT {
                    let excess = held.len() - HELD_LIMIT;
                    held.drain(..excess);
                }
            }
            LinkState::Ended => {}
        }
    }

    /// True once the exit reached a page, so the link can go.
    fn exit(&self, exit_code: Option<i32>) -> bool {
        let mut state = self.lock();
        match &mut *state {
            LinkState::Attached(sink) => {
                sink(Delivery::Exit(exit_code));
                *state = LinkState::Ended;
                true
            }
            LinkState::Detached { exit, .. } => {
                *exit = Some(exit_code);
                false
            }
            LinkState::Ended => true,
        }
    }

    fn detach(&self, now: Instant) {
        let mut state = self.lock();
        if matches!(*state, LinkState::Attached(_)) {
            *state = LinkState::Detached {
                held: Vec::new(),
                exit: None,
                since: now,
            };
        }
    }

    /// Connects a page again: first what was held, then the exit if the shell ended meanwhile.
    /// None when the link was not waiting for a page, else whether it ended.
    fn attach(&self, mut sink: Sink) -> Option<bool> {
        let mut state = self.lock();
        let LinkState::Detached { held, exit, .. } = &mut *state else {
            return None;
        };
        if !held.is_empty() {
            sink(Delivery::Output(std::mem::take(held)));
        }
        if let Some(exit_code) = *exit {
            sink(Delivery::Exit(exit_code));
            *state = LinkState::Ended;
            return Some(true);
        }
        *state = LinkState::Attached(sink);
        Some(false)
    }

    fn detached_since(&self) -> Option<Instant> {
        match &*self.lock() {
            LinkState::Detached { since, .. } => Some(*since),
            _ => None,
        }
    }

    fn ended(&self) -> bool {
        matches!(*self.lock(), LinkState::Ended)
    }
}

/// One terminal as its page left it before restarting: `terminalId` is None for a terminal
/// whose shell had already ended. The descriptor and the screen are the page's own text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashedTerminal {
    pub terminal_id: Option<u32>,
    pub descriptor: String,
    pub snapshot: String,
}

/// A window's terminals while its page restarts: the panel layout and each terminal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStash {
    pub layout: String,
    pub terminals: Vec<StashedTerminal>,
}

#[derive(Default)]
struct LinksInner {
    links: Mutex<HashMap<u32, Arc<Link>>>,
    stashes: Mutex<HashMap<String, TerminalStash>>,
}

/// Every terminal's link, by terminal id, and each restarting window's stash.
#[derive(Clone, Default)]
pub struct TerminalLinks {
    inner: Arc<LinksInner>,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl TerminalLinks {
    /// A new terminal's link to `sink`, with the output and exit callbacks for its shell.
    /// `register` adds it under the terminal's id once the shell started.
    pub fn link(&self, sink: Sink) -> (Arc<Link>, OutputFn, ExitFn) {
        let link = Arc::new(Link::new(sink));
        let output_link = Arc::clone(&link);
        let exit_link = Arc::clone(&link);
        let links = Arc::downgrade(&self.inner);
        let on_output: OutputFn = Box::new(move |bytes: Vec<u8>| output_link.output(bytes));
        let on_exit: ExitFn = Box::new(move |terminal_id: u32, exit_code: Option<i32>| {
            if exit_link.exit(exit_code) {
                if let Some(links) = links.upgrade() {
                    lock(&links.links).remove(&terminal_id);
                }
            }
        });
        (link, on_output, on_exit)
    }

    /// A shell that already ended and told its page is not kept.
    pub fn register(&self, terminal_id: u32, link: Arc<Link>) {
        if !link.ended() {
            lock(&self.inner.links).insert(terminal_id, link);
        }
    }

    /// Clear Cache: the window's page goes away. Its live terminals hold their output from now
    /// on, and the stash waits for the new page. Returns the ids now waiting.
    pub fn stash(&self, window_label: &str, stash: TerminalStash, now: Instant) -> Vec<u32> {
        let mut waiting = Vec::new();
        {
            let links = lock(&self.inner.links);
            for terminal_id in stash.terminals.iter().filter_map(|terminal| terminal.terminal_id) {
                if let Some(link) = links.get(&terminal_id) {
                    link.detach(now);
                    waiting.push(terminal_id);
                }
            }
        }
        lock(&self.inner.stashes).insert(window_label.to_string(), stash);
        waiting
    }

    /// The new page takes what the old one left, once.
    pub fn unstash(&self, window_label: &str) -> Option<TerminalStash> {
        lock(&self.inner.stashes).remove(window_label)
    }

    /// The new page connects a terminal again. False when it was not waiting.
    pub fn reattach(&self, terminal_id: u32, sink: Sink) -> bool {
        let link = lock(&self.inner.links).get(&terminal_id).cloned();
        let Some(link) = link else {
            return false;
        };
        match link.attach(sink) {
            Some(ended) => {
                if ended {
                    lock(&self.inner.links).remove(&terminal_id);
                }
                true
            }
            None => false,
        }
    }

    /// Terminals waiting for a page; a starting page must not close them.
    pub fn detached_ids(&self) -> Vec<u32> {
        lock(&self.inner.links)
            .iter()
            .filter(|(_, link)| link.detached_since().is_some())
            .map(|(terminal_id, _)| *terminal_id)
            .collect()
    }

    /// Takes out the terminals that waited longer than `timeout`; the caller closes their shells.
    pub fn take_expired(&self, now: Instant, timeout: Duration) -> Vec<u32> {
        let mut links = lock(&self.inner.links);
        let expired: Vec<u32> = links
            .iter()
            .filter(|(_, link)| link.detached_since().is_some_and(|since| now.duration_since(since) >= timeout))
            .map(|(terminal_id, _)| *terminal_id)
            .collect();
        for terminal_id in &expired {
            links.remove(terminal_id);
        }
        expired
    }

    /// A window closed: what it left for a restart goes too.
    pub fn forget_window(&self, window_label: &str) {
        lock(&self.inner.stashes).remove(window_label);
    }

    #[cfg(test)]
    pub fn link_count(&self) -> usize {
        lock(&self.inner.links).len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    type Received = Arc<Mutex<Vec<Delivery>>>;

    fn recorder() -> (Received, Sink) {
        let received: Received = Arc::default();
        let into = Arc::clone(&received);
        (received, Box::new(move |delivery| lock(&into).push(delivery)))
    }

    fn stash_of(terminal_ids: &[Option<u32>]) -> TerminalStash {
        TerminalStash {
            layout: "{}".to_string(),
            terminals: terminal_ids
                .iter()
                .map(|terminal_id| StashedTerminal {
                    terminal_id: *terminal_id,
                    descriptor: "{}".to_string(),
                    snapshot: "screen".to_string(),
                })
                .collect(),
        }
    }

    #[test]
    fn output_goes_to_the_page_until_it_detaches_then_is_replayed_in_order() {
        let links = TerminalLinks::default();
        let (first_page, sink) = recorder();
        let (link, mut on_output, _on_exit) = links.link(sink);
        links.register(7, link);
        on_output(b"before".to_vec());
        let now = Instant::now();
        assert_eq!(links.stash("main", stash_of(&[Some(7)]), now), vec![7]);
        on_output(b"during ".to_vec());
        on_output(b"restart".to_vec());
        assert_eq!(*lock(&first_page), vec![Delivery::Output(b"before".to_vec())]);
        assert_eq!(links.detached_ids(), vec![7]);
        assert_eq!(links.unstash("main"), Some(stash_of(&[Some(7)])));
        assert_eq!(links.unstash("main"), None);
        let (second_page, sink) = recorder();
        assert!(links.reattach(7, sink));
        on_output(b"after".to_vec());
        assert_eq!(
            *lock(&second_page),
            vec![Delivery::Output(b"during restart".to_vec()), Delivery::Output(b"after".to_vec())]
        );
        assert!(links.detached_ids().is_empty());
        // Already connected: a second reattach is refused.
        let (_, sink) = recorder();
        assert!(!links.reattach(7, sink));
    }

    #[test]
    fn an_exit_while_detached_reaches_the_new_page_after_the_output() {
        let links = TerminalLinks::default();
        let (_, sink) = recorder();
        let (link, mut on_output, on_exit) = links.link(sink);
        links.register(3, link);
        links.stash("main", stash_of(&[Some(3)]), Instant::now());
        on_output(b"bye".to_vec());
        on_exit(3, Some(0));
        let (page, sink) = recorder();
        assert!(links.reattach(3, sink));
        assert_eq!(*lock(&page), vec![Delivery::Output(b"bye".to_vec()), Delivery::Exit(Some(0))]);
        assert_eq!(links.link_count(), 0);
    }

    #[test]
    fn an_exit_while_attached_ends_the_link() {
        let links = TerminalLinks::default();
        let (page, sink) = recorder();
        let (link, _on_output, on_exit) = links.link(sink);
        links.register(1, link);
        on_exit(1, None);
        assert_eq!(*lock(&page), vec![Delivery::Exit(None)]);
        assert_eq!(links.link_count(), 0);
        // A shell that ended before it was registered is not kept either.
        let (_, sink) = recorder();
        let (link, _on_output, on_exit) = links.link(sink);
        on_exit(2, Some(1));
        links.register(2, link);
        assert_eq!(links.link_count(), 0);
    }

    #[test]
    fn held_output_keeps_only_the_newest_bytes() {
        let links = TerminalLinks::default();
        let (_, sink) = recorder();
        let (link, mut on_output, _on_exit) = links.link(sink);
        links.register(5, link);
        links.stash("main", stash_of(&[Some(5)]), Instant::now());
        on_output(vec![b'a'; HELD_LIMIT]);
        on_output(b"tail".to_vec());
        let (page, sink) = recorder();
        assert!(links.reattach(5, sink));
        let Delivery::Output(held) = &lock(&page)[0] else {
            panic!("expected output");
        };
        assert_eq!(held.len(), HELD_LIMIT);
        assert!(held.ends_with(b"tail"));
    }

    #[test]
    fn terminals_nobody_reconnects_expire() {
        let links = TerminalLinks::default();
        let (_, sink) = recorder();
        let (link, _on_output, _on_exit) = links.link(sink);
        links.register(9, link);
        let start = Instant::now();
        links.stash("main", stash_of(&[Some(9), None]), start);
        assert!(links.take_expired(start + Duration::from_secs(10), DETACHED_TIMEOUT).is_empty());
        assert_eq!(links.take_expired(start + DETACHED_TIMEOUT, DETACHED_TIMEOUT), vec![9]);
        assert_eq!(links.link_count(), 0);
        links.forget_window("main");
        assert_eq!(links.unstash("main"), None);
    }

    #[test]
    fn unknown_terminals_are_neither_detached_nor_reattached() {
        let links = TerminalLinks::default();
        assert!(links.stash("main", stash_of(&[Some(42)]), Instant::now()).is_empty());
        let (_, sink) = recorder();
        assert!(!links.reattach(42, sink));
    }
}
