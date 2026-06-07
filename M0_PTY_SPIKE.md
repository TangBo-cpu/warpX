# M0 PTY Spike

状态：PASS
日期：2026-06-07
目标：验证 WrapX 的 Windows PTY 技术地基

## 1. 为什么 M0 必须先做

WrapX 的核心不是 sidebar，也不是状态卡片。核心地基是：

```text
Tauri + Rust + xterm.js 能否稳定嵌入一个真实 pwsh.exe。
```

如果这个不稳定，后面的多 session、Claude Code / Codex 检测、状态卡片都没有意义。

M0 是硬门槛：

```text
M0 不通过，不进入 M1/M2。
```

## 2. M0 的唯一目标

做一个最小原型：

```text
Tauri window
  ↓
React view
  ↓
xterm.js terminal
  ↓
Rust PTY backend
  ↓
pwsh.exe
```

用户能在 GUI 里像普通终端一样使用一个真实 PowerShell。

## 3. M0 不做什么

M0 不做：

- 多 session。
- sidebar。
- Session Card。
- Claude Code / Codex 检测。
- 状态识别。
- JSON 存储。
- Git branch。
- Windows installer。
- UI 美化。

M0 只回答一个问题：

```text
这个 PTY 技术路线能不能托住 WrapX？
```

## 4. 候选 PTY backend 调研要求

正式写 M0 代码前，需要比较候选方案。

每个候选方案都要回答：

| 问题 | 说明 |
|---|---|
| 是否支持 Windows ConPTY | 必须支持 Windows |
| 是否支持 Rust/Tauri | 不能只适合 Node/Electron |
| 是否支持 nonblocking IO | 不能阻塞 Tauri IPC |
| 是否支持 resize | 终端窗口必须可 resize |
| 是否支持 Ctrl+C | 必须能中断长命令 |
| 是否支持 Unicode/中文输入 | Windows 中文输入是硬需求 |
| 是否支持 process cleanup | close session 要清理子进程 |
| 是否有维护状态 | 不想选无人维护的 crate |
| 是否有真实示例 | 最好有 Tauri/xterm.js 或 ConPTY 示例 |

候选记录模板：

```text
## Candidate: <name>

Repository / docs:
- <url>

Pros:
- ...

Cons:
- ...

Unknowns:
- ...

Spike result:
- pass / fail / partial

Decision:
- accept / reject / retry later
```

## 5. 最小原型结构

建议 M0 最小结构：

```text
wrapx/
  package.json
  src/
    App.tsx
    main.tsx
    components/
      TerminalSpike.tsx
  src-tauri/
    Cargo.toml
    tauri.conf.json
    src/
      main.rs
      pty_spike.rs
```

M0 不需要完整最终模块拆分。可以先用 `pty_spike.rs`，通过后再重构为 `pty_manager.rs`。

## 6. 前端 M0 要求

`TerminalSpike.tsx` 最少实现：

- [ ] 创建 xterm.js instance。
- [ ] 挂载到 DOM。
- [ ] 接收后端 PTY 输出。
- [ ] 将用户输入发送给后端。
- [ ] resize 时通知后端。
- [ ] 组件 unmount 时清理 listeners。

不需要 sidebar。

不需要复杂样式。

## 7. Rust M0 要求

Rust 后端最少实现：

- [ ] 启动 `pwsh.exe`。
- [ ] 指定 cwd。
- [ ] 连接 PTY read/write。
- [ ] 输出通过 Tauri event 发给前端。
- [ ] 前端输入通过 Tauri command 写入 PTY。
- [ ] 支持 resize。
- [ ] 支持 Ctrl+C。
- [ ] 支持 close/kill。
- [ ] read loop 不能持有 write lock。
- [ ] long-running read 不能阻塞 Tauri IPC。

## 8. Hard blockers

以下任何一项失败，都不能进入 M1：

| 编号 | 验收项 | 结果 | 备注 |
|---|---|---|---|
| H1 | starts `pwsh.exe` in selected cwd | ⬜ | |
| H2 | bidirectional IO works without blocking Tauri IPC | ⬜ | |
| H3 | resize works while output is streaming | ⬜ | |
| H4 | Ctrl+C interrupts a long-running command | ⬜ | |
| H5 | multiline paste works | ⬜ | |
| H6 | Unicode / Chinese input works | ⬜ | |
| H7 | inactive session output can buffer | ⬜ | M0 可用隐藏/暂停模拟 |
| H8 | process kill cleans up child processes | ⬜ | |

## 9. Tolerable alpha issues

这些可以暂时接受，但必须记录：

| 编号 | 项 | 结果 | 备注 |
|---|---|---|---|
| T1 | profile loading slow but usable | ⬜ | |
| T2 | `-NoProfile` fallback works | ⬜ | |
| T3 | ANSI color mostly correct | ⬜ | |
| T4 | huge output usable with throttling | ⬜ | |
| T5 | minor ConPTY line-ending quirks documented | ⬜ | |

## 10. 手动测试脚本

### 10.1 基础命令

在内嵌终端执行：

```powershell
Get-Location
dir
$PSVersionTable.PSVersion
```

期望：

- cwd 正确。
- 输出正常。
- prompt 正常返回。

### 10.2 长命令 + Ctrl+C

执行：

```powershell
while ($true) { Get-Date; Start-Sleep -Seconds 1 }
```

然后按 Ctrl+C。

期望：

- 命令中断。
- prompt 返回。
- 终端仍可继续输入。

### 10.3 multiline paste

粘贴：

```powershell
$a = 1
$b = 2
$a + $b
```

期望：

- 多行输入按预期执行。
- 输出 `3`。
- prompt 正常。

### 10.4 resize during output

执行：

```powershell
1..1000 | ForEach-Object { "Line $_" }
```

输出时调整窗口大小。

期望：

- 不冻结。
- 不丢输入。
- resize 后终端尺寸正常。

### 10.5 Unicode / 中文输入

输入：

```powershell
"你好 WrapX"
```

期望：

- 中文不乱码。
- 光标和宽度基本正常。

### 10.6 ANSI 输出

执行：

```powershell
Write-Host "Red Text" -ForegroundColor Red
Write-Host "Green Text" -ForegroundColor Green
```

期望：

- 颜色基本正常。

### 10.7 child process cleanup

执行一个长时间子进程，例如：

```powershell
Start-Process pwsh -ArgumentList '-NoExit', '-Command', 'while ($true) { Start-Sleep 1 }'
```

然后关闭 session。

期望：

- 按 v1 close policy 清理对应 process tree。
- 不留下孤儿进程。

注意：如果实际 close policy 决定只杀当前 `pwsh.exe`，必须在这里记录，并回到产品文档修正。

## 11. 自动/集成测试建议

M0 通过后，应该把以下内容变成自动测试：

- [ ] spawn `pwsh.exe` in cwd
- [ ] send input and receive output
- [ ] resize PTY
- [ ] Ctrl+C long-running command
- [ ] multiline paste
- [ ] kill process tree

如果某些 PTY 行为无法稳定自动化，保留为 manual QA，但要写清原因。

## 12. M0 通过标准

M0 通过必须满足：

```text
所有 hard blockers 通过。
所有 tolerable issues 有记录。
选定 PTY backend。
明确进入 M1 的技术路径。
```

通过后在本文件填写：

```text
M0 Result: PASS
Chosen backend: <name>
Known issues:
- ...
Decision date: <date>
```

## 13. M0 失败标准

任一 hard blocker 失败即视为 M0 未通过。

失败后填写：

```text
M0 Result: FAIL
Failed blockers:
- Hx: ...
Attempted backend:
- ...
Next action:
- switch backend / patch backend / investigate Windows API directly
```

## 14. 目前未决问题

M0 开始前仍需决定/确认：

- [ ] 使用哪个 PTY crate 作为第一个候选。
- [ ] Tauri scaffold 使用 npm 还是 pnpm。
- [ ] M0 是否先只支持当前机器，还是一开始就考虑 clean Windows。
- [ ] `pwsh.exe` profile 默认是否加载，产品决策是默认加载，但 spike 要验证。
- [ ] process tree cleanup 如何实现，尤其是 grandchildren。

## 15. 推荐执行顺序

```text
1. 初始化 Git 仓库。
2. scaffold Tauri + React。
3. 安装 xterm.js。
4. 选择第一个 PTY backend。
5. 写最小 pty_spike.rs。
6. 跑 H1-H8。
7. 记录结果。
8. PASS 后重构为 M1 结构。
```

## 16. 记录区

### Candidate 1

```text
Name: portable-pty
URL: https://crates.io/crates/portable-pty
Why chosen: Rust crate with Windows ConPTY support, reader/writer split, resize API, and existing terminal-emulator usage.
Result: partial - selected and wired into the M0 scaffold; Rust/Tauri compile is blocked until Rust, Cargo, and MSVC Build Tools are installed.
Notes: First implementation used src-tauri/src/pty_spike.rs. After M0 PASS, it was migrated into M1-style src-tauri/src/pty_manager.rs and src-tauri/src/commands.rs while preserving start/write/resize/close commands plus pty-output events.
```

### Candidate 2

```text
Name:
URL:
Why chosen:
Result:
Notes:
```

### Final M0 Result

```text
M0 Result: PASS
Chosen backend: portable-pty
Hard blockers passed: H1-H8 covered by automated smoke tests in src-tauri/tests/pty_smoke.rs.
Tolerable issues: Tauri CLI `info` does not detect MSVC via vswhere on this machine, but cargo check/test pass when launched through vcvars64.bat. A minimal placeholder icon is used for M0 only.
Decision date: 2026-06-07
```
