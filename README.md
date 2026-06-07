# WrapX

WrapX 是一个 Windows-first 的多 PowerShell / 多 CLI Agent GUI 控制台。

它的目标不是替代 Windows Terminal，而是让开发者在一个 GUI 里管理多个真实 `pwsh.exe` 会话，并通过侧边栏看清 Claude Code / Codex 等 CLI coding agent 当前在做什么。

```text
WrapX = embedded PowerShell + multi-session sidebar + conservative agent status
```

当前状态：M1 single-terminal pre-alpha。

已完成：

- Tauri + React + xterm.js 桌面窗口。
- Rust PTY backend 嵌入真实 `pwsh.exe`。
- 单终端 start / write / resize / close。
- M0 H1-H8 自动 smoke 测试通过。
- M1 终端日常可用性补强：Ctrl+L、Copy/Paste 按钮、Ctrl+Shift+C、Ctrl+Shift+V、关闭确认、`pwsh.exe`/cwd 启动诊断。

## 为什么做

同时运行多个 CLI agent 时，普通终端管理会变乱：

```text
Terminal 1: claude 可能正在等 approval
Terminal 2: codex 可能正在跑测试
Terminal 3: 普通 PowerShell
Terminal 4: agent 可能已经报错
```

用户真正需要知道的是：

- 哪个 session 正在运行 agent？
- 哪个 agent 在等输入？
- 哪个 agent 需要审批？
- 哪个 agent 出错？
- 哪个只是普通 shell？
- 现在应该点开哪个 session？

WrapX v1 解决这个问题。

## 产品定位

WrapX 是一个 **agent flight deck**。

v1 的卡片叫 **Session Card**：

- 一张卡片代表一个真实 PowerShell session。
- 卡片显示当前检测到的 agent 活动。
- 它不是 durable task，也不是完整 agent run 历史。
- v1.5 可以再加入真正的 agent timeline / task history。

## v1 范围

### 包含

- Windows first。
- 默认 shell：`pwsh.exe`。
- GUI 内嵌真实 PowerShell。
- 用户手动输入 `claude` / `codex`。
- 多 session 管理。
- 单主终端 + 侧边栏。
- Claude Code / Codex 检测。
- 保守状态识别：
  - `shell`
  - `running`
  - `waiting-input`
  - `approval-needed`
  - `error`
  - `exited`
  - `unknown`
- 本地 JSON 元数据存储。
- GitHub Releases alpha 分发。

### 不包含

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

## 技术栈

计划默认：

```text
Desktop: Tauri 2
Backend: Rust
Frontend: React
Terminal renderer: xterm.js
Shell: pwsh.exe
Storage: local JSON
Platform: Windows first
```

PTY backend 暂未最终确定。必须先完成 M0 spike。

## 最高优先级：M0 PTY Spike

WrapX 的地基不是 sidebar，而是能不能稳定嵌入真实 PowerShell。

M0 目标：

```text
证明 Tauri + Rust + xterm.js 可以稳定托管一个真实 pwsh.exe。
```

M0 hard blockers：

- [ ] starts `pwsh.exe` in selected cwd
- [ ] bidirectional IO works without blocking Tauri IPC
- [ ] resize works while output is streaming
- [ ] Ctrl+C interrupts a long-running command
- [ ] multiline paste works
- [ ] Unicode / Chinese input works
- [ ] inactive session output can buffer
- [ ] process kill cleans up child processes

如果任一 hard blocker 不通过，不进入 M1/M2。

详见：[`M0_PTY_SPIKE.md`](./M0_PTY_SPIKE.md)

## 计划里程碑

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

## 项目文档

| 文档 | 用途 |
|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | 产品定位、范围、状态模型、隐私、分发目标 |
| [`IMPLEMENTATION_CHECKLIST.md`](./IMPLEMENTATION_CHECKLIST.md) | M0-M5 实现清单、模块、测试、验收标准 |
| [`PROJECT_READINESS.md`](./PROJECT_READINESS.md) | 工程准备、风险、缺口、下一步建议 |
| [`M0_PTY_SPIKE.md`](./M0_PTY_SPIKE.md) | M0 PTY 技术地基验证计划 |

后续建议补充：

- `ARCHITECTURE.md`
- `TEST_PLAN.md`
- `SECURITY_AND_PRIVACY.md`
- `RELEASE.md`

## 状态识别原则

v1 状态识别必须保守。

规则：

- 使用窄匹配。
- 只匹配观察到的具体 Claude Code / Codex 提示片段。
- 不用 `error`、`failed`、`continue`、`approve`、`y/n` 这种宽泛词作为硬匹配。
- 不确定时显示 `unknown` 或 `possible-*`。
- 卡片只聚焦终端，不自动发送 approval 文本。

## 隐私原则

WrapX 会观察终端输出，所以默认按敏感数据处理。

v1 默认：

- 不保存 full terminal transcript。
- 不读取 Claude Code / Codex 原生会话数据库。
- 不自动 approval。
- raw last output 不默认持久化。
- metadata 本地保存。
- 提供 clear metadata。

## 性能边界

v1 默认限制：

| 项 | 默认值 |
|---|---:|
| live sessions | 8 |
| xterm scrollback | 10,000 lines/session |
| status rolling buffer | 8 KB or 200 lines/session |
| sidebar update rate | max 4/sec/session |
| process tree poll | 1-2 sec |

## 开发前置要求

正式开发前建议准备：

- Rust stable
- Node.js LTS
- Tauri prerequisites
- Git
- `pwsh.exe`，必须在 PATH 中
- Claude Code CLI，可选但建议
- Codex CLI，可选但建议
- `jq`，建议安装，gstack 任务聚合会用到

## 本机开发启动

前端和 Tauri 开发：

```powershell
npm install
npm run tauri:dev
```

常用校验：

```powershell
npm run build
```

Rust/Tauri 校验需要 MSVC 环境。如果普通终端里 `cargo check` 找不到 MSVC linker，先打开 **x64 Native Tools Command Prompt for VS 2022**，或通过 `vcvars64.bat` 启动后再运行：

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --test pty_smoke -- --nocapture
```

本机已知问题：`tauri info` 可能无法通过 `vswhere` 检测到 MSVC，但在 MSVC 环境初始化后 `cargo check` / `cargo test` 可以正常作为校验入口。

## 当前开发交接

当前功能 worktree：

```text
.claude/worktrees/feature-m1-terminal-usability
```

继续开发前先确认或合并这个 worktree 中的变更。后续每个新功能都应先创建独立 git worktree，再开始实现。

当前剩余验证：

- 手动打开 Tauri 窗口。
- 点击 `Start pwsh`。
- 验证 `Get-Location`、`dir`、中文输入、长命令 + Ctrl+C。
- 验证 Clear / Ctrl+L。
- 验证 Copy 按钮、Paste 按钮、Ctrl+Shift+C、Ctrl+Shift+V。
- 验证 Close 按钮会弹出确认，并清理对应 PowerShell 进程树。

推荐下一批功能：

1. **M1 手动 GUI QA**：确认当前单终端体验真实可用。
2. **M2 多 session sidebar**：创建/切换/关闭多个独立 PowerShell session。
3. **M2 session 生命周期事件**：补 `pty-exit` / `pty-closed`，避免 shell 自然退出后前端状态滞后。
4. **M3 Claude Code / Codex 进程检测**。
5. **M4 保守状态识别和 Session Card**。

详见 [`IMPLEMENTATION_CHECKLIST.md`](./IMPLEMENTATION_CHECKLIST.md)。

## License

TBD.
