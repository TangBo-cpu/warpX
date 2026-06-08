use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_BUFFER_BYTES: usize = 8 * 1024;
const MAX_BUFFER_LINES: usize = 200;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DetectedSessionStatus {
    Shell,
    Running,
    WaitingInput,
    ApprovalNeeded,
    Unknown,
    Error,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusEvent {
    pub session_id: String,
    pub status: DetectedSessionStatus,
    pub reason: String,
    pub detected_at_ms: u64,
}

#[derive(Default)]
pub struct StatusDetectorState {
    trackers: Mutex<HashMap<String, SessionStatusTracker>>,
}

impl StatusDetectorState {
    pub fn observe_output(&self, session_id: &str, data: &[u8]) -> Option<SessionStatusEvent> {
        let normalized = normalize_output(data);
        if !has_visible_activity(&normalized) {
            return None;
        }

        let mut trackers = self.trackers.lock().ok()?;
        let tracker = trackers.entry(session_id.to_string()).or_default();
        tracker.observe_output(session_id, &normalized)
    }

    pub fn forget(&self, session_id: &str) {
        if let Ok(mut trackers) = self.trackers.lock() {
            trackers.remove(session_id);
        }
    }
}

#[derive(Default)]
struct SessionStatusTracker {
    buffer: RollingStatusBuffer,
    last_status: Option<DetectedSessionStatus>,
    last_reason: Option<String>,
}

impl SessionStatusTracker {
    fn observe_output(&mut self, session_id: &str, normalized: &str) -> Option<SessionStatusEvent> {
        self.buffer.push(normalized);
        let detection = detect_status(self.buffer.as_str());

        if self.last_status == Some(detection.status)
            && self.last_reason.as_deref() == Some(detection.reason.as_str())
        {
            return None;
        }

        self.last_status = Some(detection.status);
        self.last_reason = Some(detection.reason.clone());

        Some(SessionStatusEvent {
            session_id: session_id.to_string(),
            status: detection.status,
            reason: detection.reason,
            detected_at_ms: now_ms(),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct StatusDetection {
    status: DetectedSessionStatus,
    reason: String,
}

#[derive(Default)]
struct RollingStatusBuffer {
    text: String,
}

impl RollingStatusBuffer {
    fn push(&mut self, text: &str) {
        self.text.push_str(text);
        self.trim();
    }

    fn as_str(&self) -> &str {
        &self.text
    }

    fn trim(&mut self) {
        if self.text.len() > MAX_BUFFER_BYTES {
            let mut start = self.text.len() - MAX_BUFFER_BYTES;
            while !self.text.is_char_boundary(start) {
                start += 1;
            }
            self.text.drain(..start);
        }

        let line_count = self.text.lines().count();
        if line_count <= MAX_BUFFER_LINES {
            return;
        }

        let drop_lines = line_count - MAX_BUFFER_LINES;
        let mut seen_lines = 0;
        let mut cut_at = 0;
        for (index, ch) in self.text.char_indices() {
            if ch == '\n' {
                seen_lines += 1;
                if seen_lines == drop_lines {
                    cut_at = index + 1;
                    break;
                }
            }
        }

        if cut_at > 0 {
            self.text.drain(..cut_at);
        }
    }
}

fn detect_status(buffer: &str) -> StatusDetection {
    let lower = buffer.to_lowercase();
    let approval_needed = matches_approval_needed(&lower);
    let waiting_input = matches_waiting_input(&lower);
    let terminal_error = matches_terminal_error(&lower);

    if terminal_error && (approval_needed || waiting_input) {
        return StatusDetection {
            status: DetectedSessionStatus::Unknown,
            reason: "conflicting status signals detected".to_string(),
        };
    }

    if approval_needed {
        return StatusDetection {
            status: DetectedSessionStatus::ApprovalNeeded,
            reason: "permission prompt detected".to_string(),
        };
    }

    if waiting_input {
        return StatusDetection {
            status: DetectedSessionStatus::WaitingInput,
            reason: "agent input prompt detected".to_string(),
        };
    }

    if terminal_error {
        return StatusDetection {
            status: DetectedSessionStatus::Error,
            reason: "terminal error detected".to_string(),
        };
    }

    if matches_shell_prompt(buffer) {
        return StatusDetection {
            status: DetectedSessionStatus::Shell,
            reason: "shell prompt detected".to_string(),
        };
    }

    if has_visible_activity(buffer) {
        return StatusDetection {
            status: DetectedSessionStatus::Running,
            reason: "terminal activity detected".to_string(),
        };
    }

    StatusDetection {
        status: DetectedSessionStatus::Unknown,
        reason: "no stable status pattern detected".to_string(),
    }
}

fn matches_approval_needed(lower: &str) -> bool {
    if lower.contains("do you want to allow")
        || lower.contains("allow this command")
        || lower.contains("allow command?")
        || lower.contains("allow tool use?")
        || lower.contains("claude needs your permission")
        || lower.contains("codex needs approval")
    {
        return true;
    }

    let has_permission_context = lower.contains("permission")
        || lower.contains("tool use")
        || lower.contains("command approval")
        || lower.contains("tool approval")
        || lower.contains("approval required");
    let has_choice_context = lower.contains("yes, allow")
        || lower.contains("allow once")
        || lower.contains("allow for this session")
        || lower.contains("no, deny")
        || lower.contains("deny");

    has_permission_context && has_choice_context
}

fn matches_waiting_input(lower: &str) -> bool {
    lower.contains("enter your message")
        || lower.contains("type your message")
        || lower.contains("what would you like to do")
        || lower.contains("how can i help")
        || lower.lines().any(|line| {
            let line = line.trim();
            line == "human:" || line == "user:"
        })
}

fn matches_terminal_error(lower: &str) -> bool {
    lower.contains(" is not recognized as a name of a cmdlet")
        || lower.contains("command not found")
        || lower.contains("[wrapx] pty read failed")
}

fn matches_shell_prompt(buffer: &str) -> bool {
    let Some(line) = buffer.lines().rev().find(|line| !line.trim().is_empty()) else {
        return false;
    };

    let line = line.trim();
    line == "PS>" || (line.starts_with("PS ") && line.ends_with('>'))
}

fn has_visible_activity(text: &str) -> bool {
    text.chars()
        .any(|ch| !ch.is_control() && !ch.is_whitespace())
}

fn normalize_output(data: &[u8]) -> String {
    let text = String::from_utf8_lossy(data);
    strip_ansi(&text).replace("\r\n", "\n").replace('\r', "\n")
}

fn strip_ansi(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' {
            if matches!(chars.peek(), Some('[')) {
                chars.next();
                for next in chars.by_ref() {
                    if ('@'..='~').contains(&next) {
                        break;
                    }
                }
            }
            continue;
        }

        output.push(ch);
    }

    output
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_approval_prompt() {
        let state = StatusDetectorState::default();
        let event = state
            .observe_output(
                "session-1",
                b"Claude needs your permission\nAllow this command? Yes, allow / No, deny",
            )
            .expect("approval status should emit");

        assert_eq!(event.status, DetectedSessionStatus::ApprovalNeeded);
        assert_eq!(event.reason, "permission prompt detected");
    }

    #[test]
    fn approve_word_alone_does_not_trigger_approval() {
        let state = StatusDetectorState::default();
        let event = state
            .observe_output(
                "session-1",
                b"We should approve this design after review and then continue.",
            )
            .expect("visible output should emit running");

        assert_eq!(event.status, DetectedSessionStatus::Running);
    }

    #[test]
    fn detects_approval_across_chunks() {
        let state = StatusDetectorState::default();
        let first = state
            .observe_output("session-1", b"Permission required for tool use\n")
            .expect("first visible output should emit");
        assert_eq!(first.status, DetectedSessionStatus::Running);

        let second = state
            .observe_output("session-1", b"Allow once or No, deny?")
            .expect("second chunk should refine status");
        assert_eq!(second.status, DetectedSessionStatus::ApprovalNeeded);
    }

    #[test]
    fn detects_waiting_input_prompt() {
        let state = StatusDetectorState::default();
        let event = state
            .observe_output("session-1", b"What would you like to do next?")
            .expect("input prompt should emit");

        assert_eq!(event.status, DetectedSessionStatus::WaitingInput);
    }

    #[test]
    fn generic_continue_and_yn_do_not_trigger_waiting_input() {
        let state = StatusDetectorState::default();
        let event = state
            .observe_output(
                "session-1",
                b"The docs mention continue and y/n examples, but this is ordinary prose.",
            )
            .expect("visible output should emit running");

        assert_eq!(event.status, DetectedSessionStatus::Running);
    }

    #[test]
    fn idle_without_prompt_is_unknown() {
        let detection = detect_status("");

        assert_eq!(detection.status, DetectedSessionStatus::Unknown);
        assert_eq!(detection.reason, "no stable status pattern detected");
    }

    #[test]
    fn conflicting_error_and_prompt_signals_are_unknown() {
        let detection = detect_status(
            "What would you like to do next?\nThe term 'claudee' is not recognized as a name of a cmdlet",
        );

        assert_eq!(detection.status, DetectedSessionStatus::Unknown);
        assert_eq!(detection.reason, "conflicting status signals detected");
    }

    #[test]
    fn status_reason_is_bounded_static_text() {
        let state = StatusDetectorState::default();
        let event = state
            .observe_output("session-1", b"Enter your message")
            .expect("input prompt should emit");

        assert!(event.reason.len() < 80);
        assert!(!event.reason.contains("Enter your message"));
    }

    #[test]
    fn detects_powershell_prompt_as_shell() {
        let state = StatusDetectorState::default();
        let event = state
            .observe_output("session-1", br"PS E:\Code-All\wrapx>")
            .expect("shell prompt should emit");

        assert_eq!(event.status, DetectedSessionStatus::Shell);
        assert_eq!(event.reason, "shell prompt detected");
    }

    #[test]
    fn detects_command_not_found_as_error() {
        let state = StatusDetectorState::default();
        let event = state
            .observe_output(
                "session-1",
                b"The term 'claudee' is not recognized as a name of a cmdlet",
            )
            .expect("narrow terminal error should emit");

        assert_eq!(event.status, DetectedSessionStatus::Error);
    }

    #[test]
    fn ansi_sequences_do_not_block_prompt_detection() {
        let state = StatusDetectorState::default();
        let event = state
            .observe_output("session-1", b"\x1b[32mPS E:\\Code-All\\wrapx>\x1b[0m")
            .expect("ansi wrapped prompt should emit");

        assert_eq!(event.status, DetectedSessionStatus::Shell);
    }

    #[test]
    fn repeated_same_status_is_deduped() {
        let state = StatusDetectorState::default();
        assert!(state
            .observe_output("session-1", b"Running tests")
            .is_some());
        assert!(state
            .observe_output("session-1", b"\nmore output")
            .is_none());
    }

    #[test]
    fn rolling_buffer_trims_old_lines() {
        let mut buffer = RollingStatusBuffer::default();
        for index in 0..250 {
            buffer.push(&format!("line-{index}\n"));
        }

        assert!(buffer.as_str().lines().count() <= MAX_BUFFER_LINES);
        assert!(!buffer.as_str().contains("line-0"));
        assert!(buffer.as_str().contains("line-249"));
    }

    #[test]
    fn rolling_buffer_trims_old_bytes() {
        let mut buffer = RollingStatusBuffer::default();
        buffer.push(&"a".repeat(MAX_BUFFER_BYTES + 512));

        assert!(buffer.as_str().len() <= MAX_BUFFER_BYTES);
    }
}
