//! How terminal output reaches the webview. PTY reads are small (about 1 KB, a few bytes for
//! `yes`) and every Channel message costs the webview an eval, so reads are merged: output
//! after a quiet moment goes out at once (typing echo stays instant), a burst goes out at
//! most once per merge window. Flow control: the view acknowledges what
//! xterm has written, and reading pauses while too much is unacknowledged, so the backlog
//! stays small and Ctrl+C shows at once.

use std::sync::{Condvar, Mutex, MutexGuard};
use std::time::{Duration, Instant};

/// A burst goes out at most once per window.
pub const MERGE_WINDOW: Duration = Duration::from_millis(5);
/// The largest message; more waiting output is sent right away in pieces of this size.
pub const MAX_MESSAGE_BYTES: usize = 256 * 1024;
/// Reading pauses above this many unacknowledged bytes...
pub const HIGH_WATERMARK: usize = 2 * 1024 * 1024;
/// ...and resumes once the view has caught up below this.
pub const LOW_WATERMARK: usize = 256 * 1024;
/// A paused reader resumes anyway after this long without an ack, so a lost ack never stalls a terminal.
pub const ACK_TIMEOUT: Duration = Duration::from_secs(1);

/// What to do with the output waiting to be sent.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flush {
    Now,
    /// Wait this long for more output to merge, then send.
    After(Duration),
}

/// Decides when merged output goes out. Pure: the caller passes the time.
#[derive(Debug, Clone)]
pub struct Coalescer {
    window: Duration,
    max_message_bytes: usize,
    last_sent: Option<Instant>,
}

impl Coalescer {
    pub fn new(window: Duration, max_message_bytes: usize) -> Self {
        Self {
            window,
            max_message_bytes: max_message_bytes.max(1),
            last_sent: None,
        }
    }

    /// Output after a quiet window goes now; inside a burst it waits for the window to end,
    /// unless a full message is already waiting.
    pub fn flush(&self, pending_bytes: usize, now: Instant) -> Flush {
        if pending_bytes >= self.max_message_bytes {
            return Flush::Now;
        }
        match self.last_sent {
            Some(last_sent) => {
                let due = last_sent + self.window;
                if now >= due {
                    Flush::Now
                } else {
                    Flush::After(due - now)
                }
            }
            None => Flush::Now,
        }
    }

    /// How many of the waiting bytes the next message takes.
    pub fn message_bytes(&self, pending_bytes: usize) -> usize {
        pending_bytes.min(self.max_message_bytes)
    }

    pub fn sent(&mut self, now: Instant) {
        self.last_sent = Some(now);
    }
}

/// Counts bytes read but not yet acknowledged by the view, and says when reading must pause.
/// Pure: the caller passes the time.
#[derive(Debug, Clone)]
pub struct FlowControl {
    high_watermark: usize,
    low_watermark: usize,
    ack_timeout: Duration,
    unacked: usize,
    paused: bool,
    /// The last ack, or the moment reading paused if that came later.
    last_progress: Instant,
    /// The shell exited or the terminal closed: read freely to the end.
    released: bool,
}

impl FlowControl {
    pub fn new(high_watermark: usize, low_watermark: usize, ack_timeout: Duration, now: Instant) -> Self {
        Self {
            high_watermark,
            low_watermark: low_watermark.min(high_watermark),
            ack_timeout,
            unacked: 0,
            paused: false,
            last_progress: now,
            released: false,
        }
    }

    #[cfg(test)]
    pub fn unacked(&self) -> usize {
        self.unacked
    }

    #[cfg(test)]
    pub fn is_paused(&self) -> bool {
        self.paused
    }

    pub fn read(&mut self, byte_count: usize, now: Instant) {
        self.unacked = self.unacked.saturating_add(byte_count);
        if !self.paused && !self.released && self.unacked > self.high_watermark {
            self.paused = true;
            self.last_progress = now;
        }
    }

    /// The view wrote `byte_count` more bytes. Extra acks (after a flush on hide) only lower the count to 0.
    pub fn ack(&mut self, byte_count: usize, now: Instant) {
        self.unacked = self.unacked.saturating_sub(byte_count);
        self.last_progress = now;
        if self.paused && self.unacked <= self.low_watermark {
            self.paused = false;
        }
    }

    /// None when the reader may read; otherwise how long to wait before asking again.
    /// A pause without an ack for `ack_timeout` ends and forgives the count.
    pub fn wait_time(&mut self, now: Instant) -> Option<Duration> {
        if !self.paused || self.released {
            return None;
        }
        let deadline = self.last_progress + self.ack_timeout;
        if now >= deadline {
            self.paused = false;
            self.unacked = 0;
            return None;
        }
        Some(deadline - now)
    }

    /// No more pausing: the shell exited (only the PTY buffer is left) or the terminal closed.
    pub fn release(&mut self) {
        self.released = true;
        self.paused = false;
    }
}

struct PumpState {
    pending: Vec<u8>,
    flow: FlowControl,
    /// The sender waits for output with nothing pending, so a read must wake it.
    sender_idle: bool,
    reader_done: bool,
    /// Set by the waiter once the shell exited and its output ended (or the grace ran out).
    exit: Option<Option<i32>>,
}

/// Links a terminal's reader, sender and waiter threads: the reader pushes what it reads,
/// the sender merges it into messages and sends the exit last, acks from the view resume a paused reader.
pub struct OutputPump {
    state: Mutex<PumpState>,
    /// The sender waits on this for output, the end of output, or the exit.
    output_ready: Condvar,
    /// A paused reader waits on this for acks.
    readable: Condvar,
}

impl Default for OutputPump {
    fn default() -> Self {
        Self::new()
    }
}

impl OutputPump {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(PumpState {
                pending: Vec::new(),
                flow: FlowControl::new(HIGH_WATERMARK, LOW_WATERMARK, ACK_TIMEOUT, Instant::now()),
                sender_idle: false,
                reader_done: false,
                exit: None,
            }),
            output_ready: Condvar::new(),
            readable: Condvar::new(),
        }
    }

    fn lock(&self) -> MutexGuard<'_, PumpState> {
        self.state.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Reader thread: returns once reading may go on, after a pause if the view is behind.
    pub fn wait_until_readable(&self) {
        let mut state = self.lock();
        while let Some(wait) = state.flow.wait_time(Instant::now()) {
            state = self
                .readable
                .wait_timeout(state, wait)
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .0;
        }
    }

    /// Reader thread: output read from the PTY.
    pub fn push(&self, bytes: &[u8]) {
        let mut state = self.lock();
        state.pending.extend_from_slice(bytes);
        state.flow.read(bytes.len(), Instant::now());
        // Inside a merge window the sender wakes by itself, unless a full message is waiting.
        if state.sender_idle || state.pending.len() >= MAX_MESSAGE_BYTES {
            self.output_ready.notify_one();
        }
    }

    /// Reader thread: the PTY output ended.
    pub fn reader_finished(&self) {
        self.lock().reader_done = true;
        self.output_ready.notify_one();
    }

    /// Waiter thread: the exit code to send once the output waiting now is out.
    pub fn finish(&self, exit_code: Option<i32>) {
        self.lock().exit = Some(exit_code);
        self.output_ready.notify_one();
    }

    /// The view wrote `byte_count` bytes.
    pub fn ack(&self, byte_count: usize) {
        self.lock().flow.ack(byte_count, Instant::now());
        self.readable.notify_one();
    }

    /// Stops flow control for good: the shell exited or the terminal is closing.
    pub fn release(&self) {
        self.lock().flow.release();
        self.readable.notify_one();
    }

    /// Sender thread: sends merged output until the output ended and the exit was sent.
    /// The exit always follows every byte that was read before it.
    pub fn run_sender(&self, mut on_output: impl FnMut(Vec<u8>), on_exit: impl FnOnce(Option<i32>)) {
        let mut coalescer = Coalescer::new(MERGE_WINDOW, MAX_MESSAGE_BYTES);
        let mut on_exit = Some(on_exit);
        let mut state = self.lock();
        loop {
            if !state.pending.is_empty() {
                // At the end there is nothing more to merge, and the exit waits for this output.
                let ending = state.reader_done || (state.exit.is_some() && on_exit.is_some());
                let flush = if ending {
                    Flush::Now
                } else {
                    coalescer.flush(state.pending.len(), Instant::now())
                };
                if let Flush::After(wait) = flush {
                    state.sender_idle = false;
                    state = self
                        .output_ready
                        .wait_timeout(state, wait)
                        .unwrap_or_else(|poisoned| poisoned.into_inner())
                        .0;
                    continue;
                }
                let take = coalescer.message_bytes(state.pending.len());
                let message = if take == state.pending.len() {
                    std::mem::take(&mut state.pending)
                } else {
                    let rest = state.pending.split_off(take);
                    std::mem::replace(&mut state.pending, rest)
                };
                drop(state);
                on_output(message);
                coalescer.sent(Instant::now());
                state = self.lock();
                continue;
            }
            if let Some(exit_code) = state.exit {
                if let Some(on_exit) = on_exit.take() {
                    drop(state);
                    on_exit(exit_code);
                    state = self.lock();
                    continue;
                }
            }
            if state.reader_done && on_exit.is_none() {
                return;
            }
            state.sender_idle = true;
            state = self
                .output_ready
                .wait(state)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            state.sender_idle = false;
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{mpsc, Arc};

    use super::*;

    const MS: Duration = Duration::from_millis(1);

    #[test]
    fn output_after_a_quiet_moment_goes_at_once() {
        let start = Instant::now();
        let mut coalescer = Coalescer::new(5 * MS, 1000);
        assert_eq!(coalescer.flush(1, start), Flush::Now);
        coalescer.sent(start);
        // Typing echo 20 ms later is not held back.
        assert_eq!(coalescer.flush(1, start + 20 * MS), Flush::Now);
        assert_eq!(coalescer.flush(3, start + 5 * MS), Flush::Now);
    }

    #[test]
    fn a_burst_waits_for_the_window_to_end() {
        let start = Instant::now();
        let mut coalescer = Coalescer::new(5 * MS, 1000);
        coalescer.sent(start);
        assert_eq!(coalescer.flush(10, start + MS), Flush::After(4 * MS));
        assert_eq!(coalescer.flush(999, start + 4 * MS), Flush::After(MS));
        // A full message does not wait.
        assert_eq!(coalescer.flush(1000, start + MS), Flush::Now);
        assert_eq!(coalescer.flush(5000, start), Flush::Now);
    }

    #[test]
    fn messages_never_exceed_the_limit() {
        let coalescer = Coalescer::new(5 * MS, 1000);
        assert_eq!(coalescer.message_bytes(10), 10);
        assert_eq!(coalescer.message_bytes(1000), 1000);
        assert_eq!(coalescer.message_bytes(2500), 1000);
        assert_eq!(Coalescer::new(5 * MS, 0).message_bytes(7), 1);
    }

    #[test]
    fn a_steady_stream_is_merged_into_one_message_per_window() {
        // 1 KB reads every 50 us for 100 ms, like `cat` of a big file.
        let start = Instant::now();
        let mut coalescer = Coalescer::new(5 * MS, 256 * 1024);
        let mut pending = 0;
        let mut messages = 0;
        for step in 0..2000u32 {
            let now = start + Duration::from_micros(u64::from(step) * 50);
            pending += 1024;
            if coalescer.flush(pending, now) == Flush::Now {
                pending -= coalescer.message_bytes(pending);
                coalescer.sent(now);
                messages += 1;
            }
        }
        assert!((20..=22).contains(&messages), "{messages} messages");
    }

    #[test]
    fn reading_pauses_above_the_high_watermark_and_resumes_below_the_low() {
        let start = Instant::now();
        let mut flow = FlowControl::new(100, 20, 1000 * MS, start);
        flow.read(100, start);
        assert!(!flow.is_paused());
        assert_eq!(flow.wait_time(start), None);
        flow.read(1, start);
        assert!(flow.is_paused());
        assert_eq!(flow.wait_time(start + 10 * MS), Some(990 * MS));

        // Not enough yet.
        flow.ack(50, start + 100 * MS);
        assert!(flow.is_paused());
        assert_eq!(flow.unacked(), 51);
        // An ack restarts the timeout.
        assert_eq!(flow.wait_time(start + 200 * MS), Some(900 * MS));

        flow.ack(31, start + 300 * MS);
        assert!(!flow.is_paused());
        assert_eq!(flow.unacked(), 20);
        assert_eq!(flow.wait_time(start + 300 * MS), None);
    }

    #[test]
    fn a_pause_without_acks_ends_after_the_timeout() {
        let start = Instant::now();
        let mut flow = FlowControl::new(100, 20, 1000 * MS, start);
        flow.read(500, start + 50 * MS);
        assert_eq!(flow.wait_time(start + 1049 * MS), Some(MS));
        assert_eq!(flow.wait_time(start + 1050 * MS), None);
        assert!(!flow.is_paused());
        // The count is forgiven, so the reader does not pause again at once.
        assert_eq!(flow.unacked(), 0);
        flow.read(100, start + 1060 * MS);
        assert!(!flow.is_paused());
    }

    #[test]
    fn extra_acks_never_go_below_zero() {
        let start = Instant::now();
        let mut flow = FlowControl::new(100, 20, 1000 * MS, start);
        flow.read(10, start);
        flow.ack(500, start);
        assert_eq!(flow.unacked(), 0);
        flow.read(101, start);
        assert!(flow.is_paused());
    }

    #[test]
    fn a_released_flow_never_pauses() {
        let start = Instant::now();
        let mut flow = FlowControl::new(100, 20, 1000 * MS, start);
        flow.read(500, start);
        assert!(flow.is_paused());
        flow.release();
        assert_eq!(flow.wait_time(start), None);
        flow.read(10_000, start);
        assert_eq!(flow.wait_time(start), None);
        assert!(!flow.is_paused());
    }

    #[test]
    fn low_watermark_is_never_above_the_high_one() {
        let start = Instant::now();
        let mut flow = FlowControl::new(100, 500, 1000 * MS, start);
        flow.read(150, start);
        assert!(flow.is_paused());
        flow.ack(49, start);
        assert!(flow.is_paused());
        flow.ack(1, start);
        assert!(!flow.is_paused());
    }

    /// Runs a sender on its own thread; its messages and the exit arrive on the receiver.
    fn sender(pump: &Arc<OutputPump>) -> mpsc::Receiver<Result<Vec<u8>, Option<i32>>> {
        let (sent, received) = mpsc::channel();
        let exit_sent = sent.clone();
        let pump = Arc::clone(pump);
        std::thread::spawn(move || {
            pump.run_sender(
                move |message| {
                    let _ = sent.send(Ok(message));
                },
                move |exit_code| {
                    let _ = exit_sent.send(Err(exit_code));
                },
            );
        });
        received
    }

    #[test]
    fn the_pump_sends_everything_in_order_and_the_exit_last() {
        let pump = Arc::new(OutputPump::new());
        let received = sender(&pump);
        let mut expected = Vec::new();
        for index in 0..2000u32 {
            let bytes = index.to_le_bytes();
            expected.extend_from_slice(&bytes);
            pump.push(&bytes);
        }
        pump.reader_finished();
        pump.finish(Some(3));

        let mut output = Vec::new();
        let mut messages = 0;
        loop {
            match received.recv_timeout(Duration::from_secs(5)).unwrap() {
                Ok(message) => {
                    assert!(!message.is_empty() && message.len() <= MAX_MESSAGE_BYTES);
                    output.extend_from_slice(&message);
                    messages += 1;
                }
                Err(exit_code) => {
                    assert_eq!(exit_code, Some(3));
                    break;
                }
            }
        }
        assert_eq!(output, expected);
        // 2000 pushes in a few milliseconds merge into a handful of messages.
        assert!(messages < 50, "{messages} messages");
        // The sender thread ends once the exit is out.
        assert!(received.recv_timeout(Duration::from_secs(5)).is_err());
    }

    #[test]
    fn the_pump_splits_big_output_into_full_messages() {
        let pump = Arc::new(OutputPump::new());
        let received = sender(&pump);
        let big = vec![7u8; MAX_MESSAGE_BYTES * 2 + 10];
        pump.push(&big);
        pump.reader_finished();
        pump.finish(None);
        let mut sizes = Vec::new();
        while let Ok(message) = received.recv_timeout(Duration::from_secs(5)).unwrap() {
            sizes.push(message.len());
        }
        assert_eq!(sizes, [MAX_MESSAGE_BYTES, MAX_MESSAGE_BYTES, 10]);
    }

    #[test]
    fn output_after_the_exit_still_arrives() {
        // A background job can keep writing after the shell exited.
        let pump = Arc::new(OutputPump::new());
        let received = sender(&pump);
        pump.push(b"before");
        pump.finish(Some(0));
        assert_eq!(received.recv_timeout(Duration::from_secs(5)).unwrap(), Ok(b"before".to_vec()));
        assert_eq!(received.recv_timeout(Duration::from_secs(5)).unwrap(), Err(Some(0)));
        pump.push(b"late");
        assert_eq!(received.recv_timeout(Duration::from_secs(5)).unwrap(), Ok(b"late".to_vec()));
        pump.reader_finished();
        assert!(received.recv_timeout(Duration::from_secs(5)).is_err());
    }

    #[test]
    fn a_paused_reader_waits_for_an_ack() {
        let pump = Arc::new(OutputPump::new());
        pump.push(&vec![0u8; HIGH_WATERMARK + 1]);
        let (resumed, resumed_at) = mpsc::channel();
        let reader = Arc::clone(&pump);
        std::thread::spawn(move || {
            reader.wait_until_readable();
            let _ = resumed.send(());
        });
        assert!(resumed_at.recv_timeout(Duration::from_millis(100)).is_err());
        pump.ack(HIGH_WATERMARK + 1 - LOW_WATERMARK);
        resumed_at.recv_timeout(Duration::from_secs(5)).unwrap();
    }

    #[test]
    fn release_wakes_a_paused_reader() {
        let pump = Arc::new(OutputPump::new());
        pump.push(&vec![0u8; HIGH_WATERMARK + 1]);
        let (resumed, resumed_at) = mpsc::channel();
        let reader = Arc::clone(&pump);
        std::thread::spawn(move || {
            reader.wait_until_readable();
            let _ = resumed.send(());
        });
        assert!(resumed_at.recv_timeout(Duration::from_millis(100)).is_err());
        pump.release();
        resumed_at.recv_timeout(Duration::from_secs(5)).unwrap();
    }
}
