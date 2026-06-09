# WrapX 产品文档

状态：APPROVED  
日期：2026-06-07  
产品方向：Windows-first 多 PowerShell / 多 CLI Agent GUI 控制台
当前实现进度：M0/M1/M2/M3-A/M4 pre-alpha 已完成；下一阶段是 M5 Windows alpha release。

## 1. 一句话定位

WrapX 是一个 **Agent flight deck**：在 GUI 中管理多个真实 `pwsh.exe` 会话，并通过侧边栏显示 Claude Code / Codex 等 CLI agent 的当前状态。

它不是普通终端替代品。它解决的问题是：当开发者同时运行多个 CLI coding agent 时，不知道哪个 agent 正在跑、哪个在等输入、哪个需要审批、哪个出错、哪个只是普通 shell。

## 2. 目标用户

第一批用户是重度使用 CLI coding agent 的开发者，尤其是：

- 同时使用 Claude Code 和 Codex 的开发者。
- 在 Windows 上用 PowerShell 工作的人。
- 经常开多个终端跑 agent、测试、脚本的人。
- 想保留 CLI 原生能力，但不想在一堆终端窗口里找状态的人。

## 3. 核心痛点

当前状态：

```text
Terminal 1: claude 正在等 approval
Terminal 2: codex 正在跑测试
Terminal 3: 普通 PowerShell
Terminal 4: claude 已经报错

用户需要逐个切窗口、看输出、猜谁需要自己。
```

WrapX 要变成：

```text
Sidebar:
[Claude Code] approval-needed — matched "Allow this command?" 12s ago
[Codex] running — output received 3s ago
[pwsh] shell — no agent child process detected
[Claude Code] error — authentication failed
```

用户一眼知道该点哪个 session。

## 4. 产品原则

### 4.1 真实 PowerShell 优先

WrapX 不重写 shell。每个 session 背后是真实 `pwsh.exe`：

- 用户可以手动输入 `claude` / `codex`。
- 用户可以运行任意 PowerShell 命令。
- 用户的 PATH、profile、alias、认证环境应尽量保留。

### 4.2 v1 是 Session Card，不是 Task Card

v1 卡片代表一个 PowerShell session，加上当前检测到的 agent 活动。

它不是稳定的 agent run/task 对象。原因：用户可以在同一个 PowerShell 里先运行 Claude Code，退出后再运行 Codex，也可以运行普通命令。

后续 v1.5 可以加入真正的 agent run / task timeline。

### 4.3 状态识别保守

状态检测可以不完整，但不能假装准确。

默认策略：

- 使用窄匹配规则。
- 只匹配具体 Claude Code / Codex 提示片段。
- 不用 `error`、`failed`、`continue`、`approve`、`y/n` 这种宽泛词作为硬匹配。
- 不确定时显示 `unknown` 或 `possible-*`。

信任比炫技重要。

### 4.4 不自动审批

v1 只提醒，不代点。

如果检测到 approval-needed：

- 侧边栏高亮。
- 用户点击卡片进入真实终端。
- 用户自己输入确认。

WrapX 不自动发送 approval 文本，不自动执行危险命令。

## 5. v1 范围

### 5.1 包含

- Windows first。
- 默认 shell：`pwsh.exe`。
- GUI 内嵌真实 PowerShell。
- Tauri + Rust + React + xterm.js。
- 多 session 管理。
- 侧边栏 Session Card。
- Claude Code / Codex 检测。
- 基础状态：
  - `shell`
  - `running`
  - `waiting-input`
  - `approval-needed`
  - `error`
  - `exited`
  - `unknown`
- 本地 JSON 元数据存储。
- GitHub Releases alpha 分发。

### 5.2 不包含

- 跨平台。
- Gemini / OpenCode / Aider 等更多 agent。
- 完整 IDE。
- 多分屏终端。
- 后台 daemon。
- GUI 关闭后恢复活进程。
- 读取 Claude Code / Codex 原生会话数据库。
- LLM 摘要。
- 自动 approval。
- MCP agent 通信。
- 插件系统。
- 企业策略控制。

## 6. 关键用户体验

### 6.1 新建 session

```text
用户点击 New Session
  ↓
输入 session 名称 + cwd
  ↓
WrapX 启动 pwsh.exe
  ↓
主区域显示 xterm.js 终端
  ↓
侧边栏显示 shell 状态
```

### 6.2 用户手动启动 agent

```text
用户在终端输入 claude 或 codex
  ↓
pwsh.exe 产生子进程
  ↓
Rust 侧进程树检测
  ↓
Session Card 显示 Claude Code / Codex
```

### 6.3 状态提醒

```text
PTY 输出进入 Rust 状态检测器
  ↓
rolling buffer 匹配窄规则
  ↓
状态变为 approval-needed / waiting-input / error / unknown
  ↓
侧边栏显示状态、原因、时间
  ↓
用户点击卡片回到终端处理
```

## 7. UI 设计入口

UI 布局、Session Card 展示字段、状态提示交互和参考 UI 方向统一维护在 [`design.md`](./design.md)。本文件不再重复 UI 草图或视觉布局细节。

## 8. 状态模型

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
```

当前 M3-A 已实现 agent kind 检测：backend 基于每个 live `pwsh.exe` 的 process tree 自动识别 `claude-code` / `codex` / `unknown` / `none`，Session Card 显示 agent badge，并支持 manual override。当前 M4 已实现 Rust backend bounded rolling buffer 和窄匹配 status detector，通过 `session-status` 事件更新 `waiting-input`、`approval-needed`、`error`、`shell`、`running`、`unknown` 等输出状态。

状态优先级：

```text
1. shell process exited                 → exited
2. session explicitly closed            → closed
3. output matches approval pattern      → approval-needed
4. output matches input prompt          → waiting-input
5. output matches narrow error pattern  → error
6. output matches shell prompt          → shell
7. recent terminal activity             → running
8. weak/conflicting signals             → unknown
9. detected active child agent          → agentKind = claude-code/codex
```

## 9. 隐私和存储原则

WrapX 会观察终端输出，所以默认按敏感数据处理。

v1 持久化：

| 数据 | 是否持久化 | 说明 |
|---|---:|---|
| session id/name/cwd/shell path | 是 | 恢复 session 列表 |
| last active session id | 是 | 恢复 UI 上下文 |
| rule config | 是 | 用户规则配置 |
| git branch cache | 可选 | 可能暴露项目名 |
| full terminal transcript | 否 | 不复制 Claude/Codex 日志 |
| raw last output line | 默认否 | 可能包含秘密 |
| redacted last-output preview | 可选 | 用户可开启 |
| mechanical event log | v1 内存 | v1 不持久化 |
| Claude/Codex native session files | 否 | 不耦合、不读取 |

## 10. 性能边界

默认限制：

| 项 | 默认值 | 原因 |
|---|---:|---|
| 活跃 live sessions | 8 | 避免隐藏 xterm 无限增长 |
| xterm scrollback | 10,000 行/session | 保持可用但限制内存 |
| status rolling buffer | 8 KB 或 200 行/session | 支持跨 chunk 匹配 |
| sidebar update rate | 每 session 最多 4 次/秒 | 避免 React render storm |
| process tree poll | 1-2 秒 | 状态够快，不浪费 CPU |
| git branch refresh | 创建时 + 低频/手动 | 避免后台 git 卡顿 |

## 11. 分发目标

v1 alpha 从 GitHub Releases 安装。

最低要求：

- GitHub Actions 构建 Windows artifact。
- Release notes 链接 commit SHA。
- CI 生成 checksums。
- README 说明 Windows unsigned warning。
- 提供 installer 或 portable zip。
- code signing 是 pre-beta 要求，不是 v1 alpha blocker。

## 12. 成功标准

MVP 成功的定义：

1. 用户能在 Windows 打开 WrapX。
2. 用户能创建多个 named `pwsh.exe` session。
3. 用户能手动运行 `claude` 和 `codex`。
4. 切换 session 不丢输出、不串输出。
5. 侧边栏能显示当前 agent 类型。
6. 状态显示保守且可解释，M4 通过内存 bounded rolling buffer 做窄匹配。
7. approval-needed 卡片只聚焦终端，不自动输入。
8. 关闭 app 时明确提示会终止 active sessions。
9. 用户能从 release artifact 安装，而不是只能源码运行。

## 13. 当前结论

WrapX v1 的产品目标已经锁定：

```text
先做一个可靠的 Windows PowerShell-based agent session control center。
不要做完整 IDE。
不要做通用终端替代品。
不要做自动化代理执行器。
先证明内嵌 pwsh.exe 稳定，再谈 agent 状态。
```
