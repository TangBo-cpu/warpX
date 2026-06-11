# WrapX

WrapX 是一个 Windows-first 的多 PowerShell / 多 CLI coding agent GUI 控制台。

它不是 Windows Terminal 的替代品，而是一个 **agent flight deck**：在一个桌面窗口里管理多个真实 `pwsh.exe` 会话，并用右侧 Session Cards 帮你快速判断 Claude Code、Codex 或普通 shell 当前处于什么状态。

```text
WrapX = embedded PowerShell + multi-session sidebar + conservative agent status
```

当前状态：**pre-alpha**。M0/M1/M2/M3-A/M4 已完成并通过验证，Windows alpha 安装器发布链路已配置。当前版本见 `package.json` / `src-tauri/tauri.conf.json`。

## 为什么做

同时运行多个 CLI coding agent 时，普通终端窗口很快会变乱：

```text
Terminal 1: Claude Code 可能正在等 approval
Terminal 2: Codex 可能正在跑测试
Terminal 3: 普通 PowerShell
Terminal 4: agent 可能已经报错
```

WrapX 的目标是让你一眼看到：

- 哪个 session 正在运行 agent。
- 哪个 agent 在等输入。
- 哪个 agent 需要审批。
- 哪个 agent 出错或已退出。
- 哪个只是普通 PowerShell。
- 现在应该点开哪个 session 处理。

## 核心能力

- **真实 PowerShell session**：每个 session 背后都是真实 `pwsh.exe`，保留 CLI 原生工作方式。
- **多 session 管理**：在一个窗口中创建、切换、调整大小和关闭多个 PTY session。
- **单主终端 + 右侧状态栏**：左侧保留最大终端工作区，右侧用 Session Cards 展示状态。
- **Claude Code / Codex 检测**：基于 `pwsh.exe` process tree 保守识别当前 session 中的 CLI agent。
- **状态识别**：通过 bounded rolling buffer 和窄匹配规则识别 `shell`、`running`、`waiting-input`、`approval-needed`、`error`、`exited`、`unknown`。
- **手动 agent override**：当自动识别不确定时，可以手动修正 Session Card 的 agent 类型。
- **Windows alpha 打包**：Tauri NSIS installer 构建链路已配置，用于 GitHub Releases alpha 分发。

## 产品边界

WrapX v1 聚焦 **Session Card**，不是完整的 agent task 系统。

包含：

- Windows first。
- 默认 shell：`pwsh.exe`。
- GUI 内嵌真实 PowerShell。
- 多 session sidebar。
- Claude Code / Codex 基础识别。
- 保守的 agent 状态提示。

暂不包含：

- 跨平台发行。
- 多分屏终端。
- 完整 IDE 功能。
- 后台 daemon。
- GUI 关闭后恢复活进程。
- 读取 Claude Code / Codex 原生会话数据库。
- LLM 摘要或自动审批。
- MCP agent 通信或插件系统。

## 技术栈

```text
Desktop: Tauri 2
Backend: Rust
Frontend: React + TypeScript
Terminal renderer: xterm.js
PTY backend: portable-pty / Windows ConPTY
Shell: pwsh.exe
Platform: Windows first
```

## 状态识别原则

WrapX 会观察终端输出，因此状态识别必须保守：

- 只匹配观察到的具体 Claude Code / Codex 提示片段。
- 不用 `error`、`failed`、`continue`、`approve`、`y/n` 这类宽泛词作为硬匹配。
- 不确定时显示 `unknown`，不假装知道。
- 只提醒，不自动发送 approval 文本。

## 隐私原则

终端输出可能包含 token、路径、客户名、prompt 或命令结果。WrapX 当前原则：

- 不读取 Claude Code / Codex 原生会话数据库。
- 不自动审批、不代替用户输入确认。
- 不把 full terminal transcript 当作产品能力保存。
- 对 raw terminal output 默认按敏感数据处理。

## Windows alpha 安装

Windows alpha 的目标分发渠道是 GitHub Releases 中的 pre-release 安装器。

> 当前仍是 pre-alpha。安装包可能未签名，Windows 可能显示未知发布者或 SmartScreen 警告。只有在你信任该 GitHub release 来源时才继续安装。

基本要求：

- Windows 10/11。
- `pwsh.exe` 必须在 PATH 中。
- Microsoft Edge WebView2 Runtime。
- Claude Code CLI / Codex CLI 可选；没有安装时 WrapX 仍可作为多 PowerShell 控制台使用。

校验下载文件（可选但建议）：

```powershell
Get-FileHash -Algorithm SHA256 .\WrapX_*.exe
Get-Content .\SHA256SUMS.txt
```

## 本机开发

前置要求：

- Node.js LTS
- Rust stable
- Tauri prerequisites
- Git
- `pwsh.exe`

安装依赖并启动开发窗口：

```powershell
npm install
npm run tauri:dev
```

前端构建校验：

```powershell
npm run build
```

Rust/Tauri 校验：

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Windows 打包校验：

```powershell
npm run tauri:build
```

`npm run tauri:dev` / `npm run tauri:build` 会通过 `scripts/tauri-env.cmd` 为当前进程补充常见 Cargo/MSVC 环境路径。

## 项目文档

| 文档 | 用途 |
|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | 产品定位、范围、状态模型、隐私和分发目标 |
| [`IMPLEMENTATION_CHECKLIST.md`](./IMPLEMENTATION_CHECKLIST.md) | M0-M5 实现清单、模块、测试和验收标准 |
| [`PROJECT_READINESS.md`](./PROJECT_READINESS.md) | 工程准备、风险、缺口和下一步建议 |
| [`M0_PTY_SPIKE.md`](./M0_PTY_SPIKE.md) | PTY 技术地基验证计划和结果 |
| [`design.md`](./design.md) | UI 设计唯一入口：布局、视觉方向、Session Card 和状态提示交互 |

## 路线图

```text
M0: PTY backend selection and single-terminal spike — PASS
M1: embedded pwsh.exe terminal — implemented
M2: multi-session sidebar — implemented and runtime-verified
M3-A: Claude Code / Codex process detection — implemented and unit-tested
M4: basic status detection — implemented and unit-tested
M5: Windows alpha release lane — configured
```

后续重点：

- Windows alpha 发布验证。
- 更完整的安装 / smoke test 文档。
- 独立 `ARCHITECTURE.md`、`TEST_PLAN.md`、`SECURITY_AND_PRIVACY.md`、`RELEASE.md`。

## License

TBD.
