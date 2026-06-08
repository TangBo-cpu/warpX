# WrapX 实现内容清单

状态：APPROVED  
日期：2026-06-07  
用途：后续写代码时的工程执行参考
当前实现状态：M0/M1/M2/M3-A/M4 已实现到 pre-alpha；M4 已完成 bounded rolling buffer、保守 status detector、`session-status` 事件和 Session Card 状态展示；下一阶段是 M5。

## 0. 总体开发顺序

```text
M0: PTY backend selection and single-terminal spike
  ↓
M1: embedded pwsh.exe terminal
  ↓
M2: multi-session sidebar
  ↓
M3: Claude Code / Codex process detection
  ↓
M4: basic status detection
  ↓
M5: Windows alpha release
```

硬规则：**M0 不通过，不进入 M1/M2。**

## 1. M0：PTY backend 选择和单终端 spike

目标：证明 Windows 上的 PTY 后端能稳定托管一个真实 `pwsh.exe`。

### 1.1 要做

- [x] 调研 Windows + Tauri + Rust 可用 PTY 方案。
- [x] 选择候选 PTY backend：`portable-pty`。
- [x] 创建最小 Tauri + React + xterm.js 原型。
- [x] Rust 启动一个 `pwsh.exe`。
- [x] 前端 xterm.js 显示真实 PowerShell。
- [x] 前端输入能写入 PTY。
- [x] PTY 输出能实时显示到 xterm.js。

### 1.2 硬性验收

全部必须通过：

- [x] starts `pwsh.exe` in selected cwd
- [x] bidirectional IO works without blocking Tauri IPC
- [x] resize works while output is streaming
- [x] Ctrl+C interrupts a long-running command
- [x] multiline paste works
- [x] Unicode / Chinese input works
- [x] inactive session output can buffer
- [x] process kill cleans up child processes

### 1.3 可接受 alpha 问题

可以暂时接受，但必须记录：

- [ ] profile loading 有轻微慢启动
- [ ] ANSI 颜色有小问题但不影响使用
- [ ] ConPTY line ending 有小瑕疵但可规避
- [ ] huge output 时轻微卡顿但可节流

### 1.4 不通过时的动作

如果任何硬性验收失败：

```text
停止 M1/M2。
先修 PTY backend 或换方案。
不要继续搭多 session 或状态识别。
```

## 2. M1：内嵌 `pwsh.exe` 终端

目标：把单个内嵌 PowerShell 做到日常可用。

### 2.1 要做

- [x] Tauri app 能启动。
- [x] React 主界面能显示 xterm.js。
- [x] Rust 后端能启动 `pwsh.exe`。
- [x] 支持 cwd。
- [x] 支持输入输出。
- [x] 支持 resize。
- [x] 支持 Ctrl+C。
- [x] 支持 Ctrl+L。
- [x] 支持复制粘贴。
- [x] 支持 multiline paste。
- [x] 支持中文/Unicode 输入。
- [x] 支持 ANSI 输出。
- [x] 关闭 session 能终止 shell/process tree。

### 2.2 验收命令/操作

- [ ] `Get-Location`
- [ ] `dir`
- [ ] 长命令 + Ctrl+C
- [ ] multiline paste
- [ ] resize during output
- [ ] 输入中文字符
- [ ] `claude --version`，如果已安装
- [ ] `codex --version`，如果已安装

### 2.3 M1 退出门槛

```text
内嵌终端必须能作为基本 PowerShell 使用。
如果用户感觉它不像正常终端，不能进入 M2。
```

## 3. M2：多 session 管理和侧边栏

目标：管理多个独立 PowerShell session。

### 3.1 要做

- [x] New Session form（当前是 toolbar form，不是 modal dialog）。
- [x] 用户填写 session name。
- [x] 用户填写 cwd。
- [x] 左侧 session list/sidebar。
- [x] 单主终端区域。
- [x] 点击 session card 切换 active terminal。
- [x] 每个 session 有独立 PTY。
- [x] 每个 session 有独立 xterm.js instance。
- [x] inactive session 继续接收输出到对应 xterm.js instance。
- [x] active session 切换时不串输出。
- [x] close session 只关闭对应 session。
- [x] app close 时提示终止 active sessions。

### 3.2 xterm.js 生命周期

- [x] create session → create PTY
- [x] create xterm.js instance
- [x] active terminal attach 到 DOM
- [x] inactive terminal 保持实例但隐藏显示
- [x] activation 时 fit/resize
- [x] layout resize 时 active terminal 立即 resize
- [ ] inactive terminal 记录 pending cols/rows，激活时应用
- [x] close session 时 dispose xterm.js、移除 runtime、kill PTY

### 3.3 存储

v1 使用本地 JSON。当前 M2 slice 尚未实现持久化，仍属于后续工作。

- [ ] root 有 `schemaVersion`。
- [ ] atomic write：写 temp、flush、rename。
- [ ] 保留 `.bak`。
- [ ] JSON 损坏时保留 `.corrupt`，加载默认值。
- [ ] session IDs 跨重启稳定。
- [ ] live processes 不恢复。
- [ ] 重启后 session 是 inactive metadata/template，不显示成 live。

## 4. M3：Claude Code / Codex 检测

目标：识别当前 PowerShell session 是否正在运行 Claude Code 或 Codex。

### 4.1 要做

- [x] 每 1-2 秒 poll process tree。
- [x] 识别 `pwsh.exe` direct child。
- [x] 识别 Claude Code。
- [x] 识别 Codex。
- [x] 处理 npm wrapper / `node.exe` 模糊场景。
- [x] 没有 agent 时显示 `shell`。
- [x] agent 退出后恢复 `shell`。
- [x] 同一 session 先 Claude 后 Codex 时跟随当前活跃进程。
- [x] ambiguous 时显示 `unknown`。
- [x] 支持 agent kind manual override。
- [x] override badge 可见。
- [x] override 可清除回 auto-detect。

### 4.2 检测优先级

```text
1. direct descendants of session pwsh.exe
2. foreground child/process group，如果 PTY/process API 支持
3. command line evidence
4. output signature as weak evidence only
5. conflicting Claude/Codex evidence → unknown
6. helper children do not replace parent agent kind
```

### 4.3 `node.exe` 规则

- [x] `node.exe` 不能单独作为 positive match。
- [x] 必须结合 command line。
- [x] 如果 command line 不清楚，显示 `unknown`。
- [x] output signature 只能放到 `statusReason`，不能硬分类。

## 5. M4：基础状态识别

目标：侧边栏显示保守且可解释的状态。

### 5.1 状态

- [x] `shell`
- [x] `running`
- [x] `waiting-input`
- [x] `approval-needed`
- [x] `error`
- [x] `exited`
- [x] `unknown`

### 5.2 规则

- [x] 默认窄匹配。
- [x] 不用泛词硬匹配：`error`、`failed`、`continue`、`approve`、`y/n`。
- [x] weak match → `unknown` 或 bounded reason。
- [x] prompt pattern → `waiting-input`。
- [x] approval pattern → `approval-needed`。
- [x] idle without prompt → `unknown`。
- [x] conflicting signals → `unknown`。
- [x] status changes store `statusReason`。
- [x] status changes store `statusReasonAt`。
- [x] stale reason 显示年龄。

### 5.3 rolling buffer

- [x] 每 session 维护 bounded normalized text buffer。
- [x] 默认 8 KB 或 200 行。
- [x] 支持跨 PTY chunk 匹配。
- [x] statusReason 是 bounded short reason。
- [x] terminal rendering 仍接收 raw PTY data。
- [x] status normalization 不污染终端输出。

### 5.4 安全交互

- [x] approval-needed card 只聚焦终端。
- [x] 不发送 approval 文本。
- [x] 不发送按键。
- [ ] safe status action 只改 UI metadata：
  - [ ] mark as unknown
  - [ ] clear status reason
  - [x] clear agent override

## 6. M5：Windows alpha release

目标：可安装、可验证、可分发。

### 6.1 要做

- [x] app identity 升级到 `0.5.0-alpha.0`，窗口标题改为 `WrapX`。
- [x] Tauri bundle 启用，并收窄为 NSIS installer target。
- [x] GitHub Actions Windows build workflow。
- [x] workflow_dispatch dry-run artifact 上传。
- [x] version tag 触发 GitHub pre-release 发布。
- [x] checksums 由 CI 生成 `SHA256SUMS.txt`。
- [x] release notes 链接 commit SHA。
- [x] README 写安装步骤。
- [x] README 写 prerequisites。
- [x] README 写 unsigned warning。
- [x] README 写可选 SHA256 校验。
- [x] README 写 install + launch + one `pwsh.exe` session smoke test。
- [x] portable zip / MSI / code signing / updater / cross-platform build 明确 deferred。

### 6.2 release 验收

- [ ] GitHub Actions Windows run 可构建 exactly one NSIS installer。
- [ ] GitHub pre-release 包含 installer 和 `SHA256SUMS.txt`。
- [ ] clean Windows machine / VM 可安装。
- [ ] app 不依赖开发环境启动。
- [ ] 能启动一个真实 `pwsh.exe` session。
- [ ] unsigned Windows warning 已在 README 说明。

## 7. 需要实现的模块

### 7.1 前端

```text
src/
  App.tsx
  components/
    Sidebar.tsx
    SessionCard.tsx
    TerminalView.tsx
    NewSessionDialog.tsx
    StatusBadge.tsx
  state/
    sessionsStore.ts
    terminalStore.ts
  types/
    session.ts
```

### 7.2 Rust 后端

```text
src-tauri/src/
  main.rs
  commands.rs
  session_manager.rs
  pty_manager.rs
  process_inspector.rs
  status_detector.rs
  event_bus.rs
  storage.rs
  config.rs
```

## 8. 数据模型

```ts
type AgentKind =
  | "none"
  | "claude-code"
  | "codex"
  | "unknown";

type SessionStatus =
  | "shell"
  | "running"
  | "waiting-input"
  | "approval-needed"
  | "error"
  | "exited"
  | "unknown";

type Session = {
  id: string;
  name: string;
  cwd: string;
  shellPath: "pwsh.exe";
  shellPid?: number;
  activeAgentPid?: number;
  agentKind: AgentKind;
  agentKindOverride?: AgentKind;
  status: SessionStatus;
  statusReason?: string;
  statusReasonAt?: string;
  gitBranch?: string;
  lastOutputLine?: string;
  lastActivityAt?: string;
  createdAt: string;
  exitedAt?: string;
};
```

## 9. 测试清单

### 9.1 Rust 单元测试

- [x] `status_detector.rs`
  - [x] approval pattern
  - [x] input pattern
  - [x] error pattern
  - [x] idle → unknown
  - [x] conflicting signals → unknown
  - [x] generic words 不 hard-trigger
  - [x] rolling buffer 跨 chunk
  - [x] bounded statusReason

- [x] `process_inspector.rs`
  - [x] direct child claude
  - [x] direct child codex
  - [x] ambiguous node.exe
  - [x] helper child keeps parent agent
  - [x] conflicting evidence → unknown

- [ ] `storage.rs`
  - [ ] schema version
  - [ ] atomic write
  - [ ] backup retained
  - [ ] corrupt file recovery
  - [ ] clear metadata

### 9.2 前端测试

- [ ] `SessionCard.test.tsx`
  - [ ] status badge
  - [ ] agent kind
  - [ ] reason age
  - [ ] override badge
  - [ ] unknown state

- [ ] `TerminalView.test.tsx`
  - [ ] mount
  - [ ] detach
  - [ ] reattach
  - [ ] resize-on-activation
  - [ ] dispose listeners

- [ ] `sessionsStore.test.ts`
  - [ ] create session
  - [ ] select session
  - [ ] close session
  - [ ] update agent kind
  - [ ] update status

### 9.3 集成/E2E

- [ ] spawn `pwsh.exe`
- [ ] run `dir`
- [ ] run `Get-Location`
- [ ] resize during output
- [ ] Ctrl+C long command
- [ ] multiline paste
- [ ] 3 sessions switching
- [ ] close one session, others survive
- [x] approval-needed card focuses terminal only
- [ ] app close confirmation

### 9.4 手动 QA

- [ ] Chinese/Unicode input
- [ ] ANSI rendering
- [ ] actual `claude --version`
- [ ] actual `codex --version`
- [ ] user profile startup
- [ ] `-NoProfile` fallback
- [ ] missing command diagnostics
- [ ] clean Windows install

## 10. 性能边界

默认：

- [ ] max live sessions: 8
- [ ] xterm scrollback: 10,000 lines/session
- [x] status rolling buffer: 8 KB or 200 lines/session
- [ ] sidebar update max: 4/sec/session
- [ ] process tree poll: 1-2 sec
- [ ] git branch refresh: create + low-frequency/manual

验收：

- [ ] 8 sessions open without visible UI lag
- [ ] 3 sessions streaming output without sidebar jank
- [ ] hidden session output does not grow memory without bound
- [ ] huge output keeps terminal usable
- [ ] close session disposes xterm.js and listeners

## 11. 当前最高优先级任务

M0/M1/M2/M3-A/M4 当前已完成到 pre-alpha slice。

已完成：

- M0 PTY backend spike：PASS，选定 `portable-pty`。
- M1 embedded `pwsh.exe` terminal。
- M1 终端日常可用性补强：Ctrl+L、Copy/Paste 按钮、Ctrl+Shift+C、Ctrl+Shift+V、关闭确认、`pwsh.exe`/cwd 启动诊断。
- M2 多 session sidebar：独立 PTY、独立 xterm.js instance、session card 切换、`pty-output` / `pty-exit` / `pty-closed` lifecycle。
- app close 时 active sessions 统一确认/清理。
- M3-A Claude Code / Codex process detection：backend 轮询 process tree，Session Card 显示 agent badge，支持 manual override / clear override。
- M4 basic status detection：backend bounded rolling buffer、窄匹配 status detector、`session-status` event、Session Card status reason / age。

已验证的 M3-A/M4 行为：

- backend 每 1.5 秒检查 live session 的 `pwsh.exe` process tree。
- direct child `claude.exe` / `codex.exe` 可分类为 Claude Code / Codex。
- npm wrapper / `node.exe` 只有结合明确 command line 证据才分类，否则显示 `unknown`。
- conflicting Claude/Codex evidence 显示 `unknown`。
- 没有 agent child process 时显示 `shell` / `PowerShell`。
- Session Card 显示 agent badge、检测 reason 和 override badge。
- manual override 只改 UI metadata，不发送终端输入；清除 override 后恢复 auto detection。
- `status_detector.rs` 已覆盖 approval/input/error/shell/running/unknown、跨 chunk、ANSI、bounded buffer、generic word negative tests。
- `approval-needed` / `waiting-input` 是 UI 状态提示，不会自动发送 approval 文本或按键。

下一步：

```text
T5: Windows alpha release validation
```

M5 当前本地实现聚焦 installer lane：app identity、NSIS bundle config、Windows workflow、checksum、tag pre-release、README install/smoke test。M5 release 不能只靠本地验证宣布完成；必须再跑一次 GitHub Actions Windows build，并确认 release assets 中 exactly one NSIS installer 和 `SHA256SUMS.txt` 都存在。
