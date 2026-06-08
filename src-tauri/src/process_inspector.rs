use crate::pty_manager::{PtyState, SessionRoot};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::thread;
use std::time::Duration;
use sysinfo::System;
use tauri::{AppHandle, Emitter, Manager};

const POLL_INTERVAL: Duration = Duration::from_millis(1500);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentKind {
    None,
    ClaudeCode,
    Codex,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDetection {
    pub session_id: String,
    pub auto_agent_kind: AgentKind,
    pub active_agent_pid: Option<u32>,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DetectionSignature {
    auto_agent_kind: AgentKind,
    active_agent_pid: Option<u32>,
    reason: String,
}

impl From<&AgentDetection> for DetectionSignature {
    fn from(value: &AgentDetection) -> Self {
        Self {
            auto_agent_kind: value.auto_agent_kind,
            active_agent_pid: value.active_agent_pid,
            reason: value.reason.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pid: u32,
    parent_pid: Option<u32>,
    name: String,
    command_line: String,
}

#[derive(Debug, Clone, Default)]
pub struct ProcessSnapshot {
    processes: HashMap<u32, ProcessInfo>,
    children_by_parent: HashMap<u32, Vec<u32>>,
}

impl ProcessSnapshot {
    pub fn from_system() -> Self {
        let mut system = System::new();
        system.refresh_processes();

        let processes = system
            .processes()
            .iter()
            .filter_map(|(pid, process)| {
                let pid = pid.to_string().parse::<u32>().ok()?;
                let parent_pid = process
                    .parent()
                    .and_then(|parent| parent.to_string().parse::<u32>().ok());
                Some(ProcessInfo {
                    pid,
                    parent_pid,
                    name: process.name().to_string(),
                    command_line: process.cmd().join(" "),
                })
            })
            .collect::<Vec<_>>();

        Self::from_processes(processes)
    }

    fn from_processes(processes: Vec<ProcessInfo>) -> Self {
        let mut by_pid = HashMap::new();
        let mut children_by_parent: HashMap<u32, Vec<u32>> = HashMap::new();

        for process in processes {
            if let Some(parent_pid) = process.parent_pid {
                children_by_parent
                    .entry(parent_pid)
                    .or_default()
                    .push(process.pid);
            }
            by_pid.insert(process.pid, process);
        }

        Self {
            processes: by_pid,
            children_by_parent,
        }
    }

    fn descendants(&self, root_pid: u32) -> Vec<ProcessCandidate<'_>> {
        let mut candidates = Vec::new();
        let mut seen = HashSet::new();
        let mut stack = self
            .children_by_parent
            .get(&root_pid)
            .into_iter()
            .flatten()
            .copied()
            .map(|pid| (pid, 1))
            .collect::<Vec<_>>();

        while let Some((pid, depth)) = stack.pop() {
            if !seen.insert(pid) {
                continue;
            }

            if let Some(process) = self.processes.get(&pid) {
                candidates.push(ProcessCandidate { process, depth });
                if let Some(children) = self.children_by_parent.get(&pid) {
                    stack.extend(
                        children
                            .iter()
                            .copied()
                            .map(|child_pid| (child_pid, depth + 1)),
                    );
                }
            }
        }

        candidates.sort_by_key(|candidate| (candidate.depth, candidate.process.pid));
        candidates
    }
}

#[derive(Debug, Clone, Copy)]
struct ProcessCandidate<'a> {
    process: &'a ProcessInfo,
    depth: usize,
}

#[derive(Debug, Clone)]
struct AgentEvidence {
    kind: AgentKind,
    pid: u32,
    depth: usize,
    reason: String,
}

pub fn spawn_agent_detector(app: AppHandle) {
    thread::spawn(move || {
        let mut previous = HashMap::<String, DetectionSignature>::new();

        loop {
            thread::sleep(POLL_INTERVAL);

            let roots = match app.state::<PtyState>().session_roots() {
                Ok(roots) => roots,
                Err(_) => continue,
            };

            if roots.is_empty() {
                previous.clear();
                continue;
            }

            let root_ids = roots
                .iter()
                .map(|root| root.session_id.clone())
                .collect::<HashSet<_>>();
            previous.retain(|session_id, _| root_ids.contains(session_id));

            let snapshot = ProcessSnapshot::from_system();
            for detection in detect_agents(&roots, &snapshot) {
                let signature = DetectionSignature::from(&detection);
                if previous.get(&detection.session_id) == Some(&signature) {
                    continue;
                }

                previous.insert(detection.session_id.clone(), signature);
                let _ = app.emit("agent-detected", detection);
            }
        }
    });
}

pub fn detect_agents(roots: &[SessionRoot], snapshot: &ProcessSnapshot) -> Vec<AgentDetection> {
    roots
        .iter()
        .map(|root| detect_agent(root, snapshot))
        .collect()
}

pub fn detect_agent(root: &SessionRoot, snapshot: &ProcessSnapshot) -> AgentDetection {
    let mut known = Vec::new();
    let mut ambiguous = Vec::new();

    for candidate in snapshot.descendants(root.shell_pid) {
        match classify_process(candidate) {
            Some(evidence) if evidence.kind == AgentKind::Unknown => ambiguous.push(evidence),
            Some(evidence) => known.push(evidence),
            None => {}
        }
    }

    let known_kinds = known
        .iter()
        .map(|evidence| evidence.kind)
        .collect::<HashSet<_>>();

    if known_kinds.len() > 1 {
        return AgentDetection {
            session_id: root.session_id.clone(),
            auto_agent_kind: AgentKind::Unknown,
            active_agent_pid: None,
            reason: "conflicting Claude Code and Codex process evidence".to_string(),
        };
    }

    if let Some(evidence) = known
        .into_iter()
        .min_by_key(|evidence| (evidence.depth, evidence.pid))
    {
        return AgentDetection {
            session_id: root.session_id.clone(),
            auto_agent_kind: evidence.kind,
            active_agent_pid: Some(evidence.pid),
            reason: evidence.reason,
        };
    }

    if let Some(evidence) = ambiguous
        .into_iter()
        .min_by_key(|evidence| (evidence.depth, evidence.pid))
    {
        return AgentDetection {
            session_id: root.session_id.clone(),
            auto_agent_kind: AgentKind::Unknown,
            active_agent_pid: Some(evidence.pid),
            reason: evidence.reason,
        };
    }

    AgentDetection {
        session_id: root.session_id.clone(),
        auto_agent_kind: AgentKind::None,
        active_agent_pid: None,
        reason: "no agent child process detected".to_string(),
    }
}

fn classify_process(candidate: ProcessCandidate<'_>) -> Option<AgentEvidence> {
    let process = candidate.process;
    let name = normalize_process_name(&process.name);
    let command_line = process.command_line.to_ascii_lowercase();
    let relation = if candidate.depth == 1 {
        "direct child"
    } else {
        "descendant"
    };

    if name == "claude" || name == "claude.exe" {
        return Some(AgentEvidence {
            kind: AgentKind::ClaudeCode,
            pid: process.pid,
            depth: candidate.depth,
            reason: format!("{relation} process name matched claude"),
        });
    }

    if name == "codex" || name == "codex.exe" {
        return Some(AgentEvidence {
            kind: AgentKind::Codex,
            pid: process.pid,
            depth: candidate.depth,
            reason: format!("{relation} process name matched codex"),
        });
    }

    if command_line_matches_claude(&command_line) {
        return Some(AgentEvidence {
            kind: AgentKind::ClaudeCode,
            pid: process.pid,
            depth: candidate.depth,
            reason: format!("{relation} command line matched Claude Code"),
        });
    }

    if command_line_matches_codex(&command_line) {
        return Some(AgentEvidence {
            kind: AgentKind::Codex,
            pid: process.pid,
            depth: candidate.depth,
            reason: format!("{relation} command line matched Codex"),
        });
    }

    if is_ambiguous_wrapper(&name) {
        return Some(AgentEvidence {
            kind: AgentKind::Unknown,
            pid: process.pid,
            depth: candidate.depth,
            reason: format!("{relation} {name} without clear Claude/Codex command line"),
        });
    }

    None
}

fn normalize_process_name(name: &str) -> String {
    name.trim_matches('"').to_ascii_lowercase()
}

fn command_line_matches_claude(command_line: &str) -> bool {
    command_line.contains("@anthropic-ai/claude-code")
        || command_line.contains("@anthropic-ai\\claude-code")
        || command_line.contains("claude-code")
        || command_line.contains("claude.cmd")
}

fn command_line_matches_codex(command_line: &str) -> bool {
    command_line.contains("@openai/codex")
        || command_line.contains("@openai\\codex")
        || command_line.contains("codex-cli")
        || command_line.contains("codex.cmd")
}

fn is_ambiguous_wrapper(name: &str) -> bool {
    matches!(
        name,
        "node"
            | "node.exe"
            | "cmd"
            | "cmd.exe"
            | "powershell"
            | "powershell.exe"
            | "pwsh"
            | "pwsh.exe"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> SessionRoot {
        SessionRoot {
            session_id: "session-1".to_string(),
            shell_pid: 100,
        }
    }

    fn process(pid: u32, parent_pid: Option<u32>, name: &str, command_line: &str) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid,
            name: name.to_string(),
            command_line: command_line.to_string(),
        }
    }

    fn detect(processes: Vec<ProcessInfo>) -> AgentDetection {
        detect_agent(&root(), &ProcessSnapshot::from_processes(processes))
    }

    #[test]
    fn direct_child_claude_is_claude_code() {
        let detection = detect(vec![process(200, Some(100), "claude.exe", "claude")]);

        assert_eq!(detection.auto_agent_kind, AgentKind::ClaudeCode);
        assert_eq!(detection.active_agent_pid, Some(200));
    }

    #[test]
    fn direct_child_codex_is_codex() {
        let detection = detect(vec![process(200, Some(100), "codex.exe", "codex")]);

        assert_eq!(detection.auto_agent_kind, AgentKind::Codex);
        assert_eq!(detection.active_agent_pid, Some(200));
    }

    #[test]
    fn node_with_claude_package_marker_is_claude_code() {
        let detection = detect(vec![process(
            200,
            Some(100),
            "node.exe",
            "node C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js",
        )]);

        assert_eq!(detection.auto_agent_kind, AgentKind::ClaudeCode);
        assert_eq!(detection.active_agent_pid, Some(200));
    }

    #[test]
    fn node_with_codex_package_marker_is_codex() {
        let detection = detect(vec![process(
            200,
            Some(100),
            "node.exe",
            "node C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin.js",
        )]);

        assert_eq!(detection.auto_agent_kind, AgentKind::Codex);
        assert_eq!(detection.active_agent_pid, Some(200));
    }

    #[test]
    fn unclear_node_child_is_unknown() {
        let detection = detect(vec![process(200, Some(100), "node.exe", "node server.js")]);

        assert_eq!(detection.auto_agent_kind, AgentKind::Unknown);
        assert_eq!(detection.active_agent_pid, Some(200));
    }

    #[test]
    fn non_agent_child_is_none() {
        let detection = detect(vec![process(200, Some(100), "git.exe", "git status")]);

        assert_eq!(detection.auto_agent_kind, AgentKind::None);
        assert_eq!(detection.active_agent_pid, None);
    }

    #[test]
    fn claude_and_codex_conflict_is_unknown() {
        let detection = detect(vec![
            process(200, Some(100), "claude.exe", "claude"),
            process(201, Some(100), "codex.exe", "codex"),
        ]);

        assert_eq!(detection.auto_agent_kind, AgentKind::Unknown);
        assert_eq!(detection.active_agent_pid, None);
    }

    #[test]
    fn helper_child_does_not_replace_parent_agent() {
        let detection = detect(vec![
            process(200, Some(100), "claude.exe", "claude"),
            process(201, Some(200), "node.exe", "node helper.js"),
        ]);

        assert_eq!(detection.auto_agent_kind, AgentKind::ClaudeCode);
        assert_eq!(detection.active_agent_pid, Some(200));
    }
}
