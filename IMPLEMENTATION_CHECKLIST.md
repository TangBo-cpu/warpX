# WrapX 实现内容清单

状态：APPROVED  
日期：2026-06-07  
用途：后续写代码时的工程执行参考
当前实现状态：M0/M1/M2 已实现到 pre-alpha；M2 已完成运行时验证；下一阶段是 M3。

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

- [ ] 每 1-2 秒 poll process tree。
- [ ] 识别 `pwsh.exe` direct child。
- [ ] 识别 Claude Code。
- [ ] 识别 Codex。
- [ ] 处理 npm wrapper / `node.exe` 模糊场景。
- [ ] 没有 agent 时显示 `shell`。
- [ ] agent 退出后恢复 `shell`。
- [ ] 同一 session 先 Claude 后 Codex 时跟随当前活跃进程。
- [ ] ambiguous 时显示 `unknown`。
- [ ] 支持 agent kind manual override。
- [ ] override badge 可见。
- [ ] override 可清除回 auto-detect。

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

- [ ] `node.exe` 不能单独作为 positive match。
- [ ] 必须结合 command line。
- [ ] 如果 command line 不清楚，显示 `unknown`。
- [ ] output signature 只能放到 `statusReason`，不能硬分类。

## 5. M4：基础状态识别

目标：侧边栏显示保守且可解释的状态。

### 5.1 状态

- [ ] `shell`
- [ ] `running`
- [ ] `waiting-input`
- [ ] `approval-needed`
- [ ] `error`
- [ ] `exited`
- [ ] `unknown`

### 5.2 规则

- [ ] 默认窄匹配。
- [ ] 不用泛词硬匹配：`error`、`failed`、`continue`、`approve`、`y/n`。
- [ ] weak match → `unknown` 或 `possible-*` reason。
- [ ] prompt pattern → `waiting-input`。
- [ ] approval pattern → `approval-needed`。
- [ ] idle without prompt → `unknown`。
- [ ] conflicting signals → `unknown`。
- [ ] status changes store `statusReason`。
- [ ] status changes store `statusReasonAt`。
- [ ] stale reason 显示年龄。

### 5.3 rolling buffer

- [ ] 每 session 维护 bounded normalized text buffer。
- [ ] 默认 8 KB 或 200 行。
- [ ] 支持跨 PTY chunk 匹配。
- [ ] statusReason 是 bounded excerpt。
- [ ] terminal rendering 仍接收 raw PTY data。
- [ ] status normalization 不污染终端输出。

### 5.4 安全交互

- [ ] approval-needed card 只聚焦终端。
- [ ] 不发送 approval 文本。
- [ ] 不发送按键。
- [ ] safe status action 只改 UI metadata：
  - [ ] mark as unknown
  - [ ] clear status reason
  - [ ] clear agent override

## 6. M5：Windows alpha release

目标：可安装、可验证、可分发。

### 6.1 要做

- [ ] GitHub Actions Windows build。
- [ ] Tauri Windows artifact。
- [ ] GitHub Releases 发布。
- [ ] checksums 由 CI 生成。
- [ ] release notes 链接 commit SHA。
- [ ] README 写安装步骤。
- [ ] README 写 prerequisites。
- [ ] README 写 unsigned warning。
- [ ] 考虑 portable zip。

### 6.2 release 验收

- [ ] clean Windows machine / VM 可安装。
- [ ] app 不依赖开发环境启动。
- [ ] 能检测 `pwsh.exe`。
- [ ] missing `claude` 有明确提示。
- [ ] missing `codex` 有明确提示。
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

- [ ] `status_detector.rs`
  - [ ] approval pattern
  - [ ] input pattern
  - [ ] error pattern
  - [ ] idle → unknown
  - [ ] conflicting signals → unknown
  - [ ] generic words 不 hard-trigger
  - [ ] rolling buffer 跨 chunk
  - [ ] bounded statusReason

- [ ] `process_inspector.rs`
  - [ ] direct child claude
  - [ ] direct child codex
  - [ ] ambiguous node.exe
  - [ ] helper child keeps parent agent
  - [ ] conflicting evidence → unknown

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
- [ ] approval-needed card focuses terminal only
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
- [ ] status rolling buffer: 8 KB or 200 lines/session
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

M0/M1/M2 当前已完成到 pre-alpha slice。

已验证的 M2 runtime 行为：

- `New Session` 按钮布局可见，能创建真实 `pwsh.exe` session。
- 多 session 由 backend `HashMap<session_id, PtySession>` 管理。
- `pty-output` / `pty-exit` / `pty-closed` 事件都携带 `sessionId`，前端按 session 写入对应 xterm.js instance。
- 点击 session card 可切换 active terminal。
- close session 只关闭对应 PTY/session runtime。
- 自然输入 `exit` 后 UI 更新为 `exited / shell exited`。
- exited session 再输入时，前端只显示一次友好提示，不再重复向 backend 写入并产生 `write failed`。

下一步：

```text
T3: M3 Claude Code / Codex process detection
```

M3 前建议先补：

- app close 时 active sessions 统一确认/清理。
- M2 最终 git 状态清理和提交。
- 明确 process detection 与 session card 状态字段的最小数据模型。
