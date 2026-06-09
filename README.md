# WrapX

WrapX 是一个 Windows-first 的多 PowerShell / 多 CLI Agent GUI 控制台。

它的目标不是替代 Windows Terminal，而是让开发者在一个 GUI 里管理多个真实 `pwsh.exe` 会话，并通过侧边栏看清 Claude Code / Codex 等 CLI coding agent 当前在做什么。

```text
WrapX = embedded PowerShell + multi-session sidebar + conservative agent status
```

当前状态：pre-alpha；M0/M1/M2/M3-A/M4 已实现并通过验证，M5 Windows alpha installer lane 已配置。

已完成：

- Tauri + React + xterm.js 桌面窗口。
- Rust PTY backend 嵌入真实 `pwsh.exe`。
- 多 session start / write / resize / close。
- M0 H1-H8 自动 smoke 测试通过。
- M1 终端日常可用性补强：Ctrl+L、Copy/Paste 按钮、Ctrl+Shift+C、Ctrl+Shift+V、关闭确认、`pwsh.exe`/cwd 启动诊断。
- M2 多 session sidebar：独立 PTY、独立 xterm.js instance、session card 切换、`pty-exit` / `pty-closed` lifecycle、app close active sessions confirm/cleanup。
- M3-A agent kind detection：基于 `pwsh.exe` process tree 检测 Claude Code / Codex，Session Card 显示 agent badge，并支持 manual override。
- M4 basic status detection：Rust backend 维护每 session bounded rolling buffer，保守识别 `shell` / `running` / `waiting-input` / `approval-needed` / `error` / `unknown`，并通过 `session-status` 事件更新 Session Card。

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

当前实现：

```text
Desktop: Tauri 2
Backend: Rust
Frontend: React
Terminal renderer: xterm.js
PTY backend: portable-pty / Windows ConPTY
Shell: pwsh.exe
Storage: local JSON（计划中，M2 尚未持久化 session metadata）
Platform: Windows first
```

M0 已选择 `portable-pty`，并将单 PTY spike 迁移为当前 `pty_manager.rs` / `commands.rs` 后端结构。

## M0 PTY Spike 结果

WrapX 的地基不是 sidebar，而是能不能稳定嵌入真实 PowerShell。

M0 目标：

```text
证明 Tauri + Rust + xterm.js 可以稳定托管一个真实 pwsh.exe。
```

M0 hard blockers：

- [x] starts `pwsh.exe` in selected cwd
- [x] bidirectional IO works without blocking Tauri IPC
- [x] resize works while output is streaming
- [x] Ctrl+C interrupts a long-running command
- [x] multiline paste works
- [x] Unicode / Chinese input works
- [x] inactive session output can buffer
- [x] process kill cleans up child processes

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
| [`design.md`](./design.md) | UI 设计唯一入口：布局、视觉方向、Session Card 和状态提示交互 |

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

## Windows alpha 安装（M5）

M5 的发布目标是 GitHub pre-release 中的 Windows NSIS 安装器。版本标签（例如 `v0.5.0-alpha.0`）会触发 Windows CI 构建，并在 release assets 中提供安装器和 `SHA256SUMS.txt`；手动 workflow dispatch 只用于 dry-run artifact 验证，不创建 GitHub Release。

### 前置要求

- Windows 10/11。
- `pwsh.exe` 必须在 PATH 中；WrapX 默认启动真实 PowerShell 会话。
- Microsoft Edge WebView2 Runtime：Tauri Windows 应用依赖 WebView2。M5 不单独固化 WebView2 bootstrap 策略；如果安装器、系统或 WrapX 启动时提示缺少 WebView2，请按提示安装 Microsoft Evergreen WebView2 Runtime 后再启动 WrapX。
- Claude Code CLI / Codex CLI 是可选项；M5 只验证 install + launch + 一个最小 `pwsh.exe` session，不要求它们已安装。

### 校验下载文件（可选但建议）

在安装前，可以用 release assets 里的 `SHA256SUMS.txt` 校验安装器：

```powershell
Get-FileHash -Algorithm SHA256 .\WrapX_*.exe
Get-Content .\SHA256SUMS.txt
```

确认 `Get-FileHash` 输出的 SHA256 与 `SHA256SUMS.txt` 中同名安装器的 hash 一致。

### 安装和 smoke test

1. 从 GitHub pre-release 下载 Windows 安装器和 `SHA256SUMS.txt`。
2. 可选：按上面的步骤校验 SHA256。
3. 运行安装器。
4. 因为 M5 不包含 code signing，Windows 可能显示未知发布者或 SmartScreen 警告；只有在你信任该 GitHub release 来源时才继续安装。
5. 启动 WrapX，确认主窗口标题为 `WrapX`。
6. 创建一个 New Session。
7. 确认终端里出现真实 `pwsh.exe` 提示符。

M5 不证明 portable zip、MSI、code signing、automatic updater、跨平台构建，也不要求在干净机器上完整验证 Claude Code / Codex agent-status demo。

## 本机开发启动

前端和 Tauri 开发：

```powershell
npm install
npm run tauri:dev
```

`npm run tauri:dev` 会通过 `scripts/tauri-env.cmd` 自动把 `%USERPROFILE%\.cargo\bin` 加入本次进程 PATH，并尝试加载 Visual Studio 2022 的 `vcvars64.bat`，不需要每次手动配置 Cargo/MSVC 环境。

常用校验：

```powershell
npm run build
```

本机 Windows 打包校验（需要 Tauri/MSVC prerequisites）：

```powershell
npm run tauri:build
```

Rust/Tauri 校验：

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --test pty_smoke -- --nocapture
```

如果 `npm run tauri:dev` 仍提示找不到 `cargo.exe`，先确认 Rust 已安装在默认位置：`%USERPROFILE%\.cargo\bin\cargo.exe`。如果提示找不到 MSVC linker，确认已安装 Visual Studio 2022 Build Tools，并包含 C++ build tools。

本机已知问题：`tauri info` 可能无法通过 `vswhere` 检测到 MSVC，但 `scripts/tauri-env.cmd` 会直接尝试加载常见 Visual Studio 2022 安装路径下的 `vcvars64.bat`。

## 当前下一步

M0/M1/M2/M3-A/M4 当前已完成到可运行 pre-alpha：

```text
M0: PTY backend selection and single-terminal spike — PASS
M1: embedded pwsh.exe terminal — implemented
M2: multi-session sidebar — implemented and runtime-verified
M3-A: Claude Code / Codex process detection — implemented and unit-tested
M4: basic status detection — implemented and unit-tested
```

下一步进入：

```text
M5: Windows alpha release
```

M3-A 已验证的关键行为：

- backend 每 1.5 秒轮询 live session 的 `pwsh.exe` process tree。
- Session Card 显示 `PowerShell` / `Claude Code` / `Codex` / `Unknown agent` badge。
- direct child `claude.exe` / `codex.exe` 可自动识别。
- npm wrapper / `node.exe` 只有结合明确 command line 证据才自动分类。
- `node.exe` command line 不清楚时显示 `unknown`，不会误报。
- conflicting Claude/Codex evidence 显示 `unknown`。
- manual override 可手动设置 agent kind，override badge 可见，切回 Auto 后恢复自动检测。

## License

TBD.
