# WrapX 项目准备审视

日期：2026-06-07  
视角：项目开发工程师  
目的：在正式写代码前，确认除了产品文档和实现清单，还需要准备什么。

## 1. 结论

项目文档不能缺少。尤其 WrapX 这种涉及：

- 桌面端 GUI
- Windows PTY / ConPTY
- PowerShell 环境
- CLI agent 状态识别
- 本地隐私和进程管理
- Windows 分发

如果没有文档，后面会不断在这些问题上反复：

```text
到底做终端还是做 agent 看板？
卡片到底代表 session 还是 task？
状态识别错了怎么办？
GUI 关闭要不要保留进程？
为什么不能自动 approval？
M0 不过能不能继续做 sidebar？
```

现在已经有两份核心文档：

- `PRODUCT.md`：产品定义和边界。
- `IMPLEMENTATION_CHECKLIST.md`：实现任务和验收清单。

这两份是后续写代码的核心参考。

但从一个项目开发工程师视角看，还需要补几类准备。

## 2. 当前已有文档

| 文档 | 状态 | 用途 |
|---|---|---|
| `PRODUCT.md` | 已有 | 产品定位、范围、用户价值、状态模型、隐私、分发 |
| `IMPLEMENTATION_CHECKLIST.md` | 已有 | M0-M5 实现任务、测试矩阵、验收标准 |
| `PROJECT_READINESS.md` | 当前文档 | 工程准备、缺口、下一步建议 |

## 3. 建议补充的项目文档

### 3.1 `README.md`

优先级：高。

README 是项目入口。即使代码还没写，也应该有一个简版。

建议内容：

```text
- WrapX 是什么
- 当前状态：pre-alpha；M0/M1/M2 已完成，M3 是下一阶段
- v1 目标
- 非目标
- 技术栈
- 开发环境要求
- 如何运行，等项目生成后补命令
- 路线图
- 风险说明：Windows-only, unsigned alpha, PTY spike pending
```

为什么需要：

- 以后你自己回来看不会忘方向。
- Claude Code / Codex 写代码时会读 README。
- 开源项目没有 README 基本不可用。

### 3.2 `ARCHITECTURE.md`

优先级：高。

`PRODUCT.md` 是产品文档，`IMPLEMENTATION_CHECKLIST.md` 是任务文档。还需要一个纯工程架构文档。

建议内容：

```text
- Tauri 架构
- Rust backend 模块职责
- React frontend 模块职责
- IPC event flow
- PTY data flow
- process inspection flow
- status detection flow
- storage contract
- close/cleanup policy
```

为什么需要：

- 实现时避免模块边界漂移。
- 后面加 M2/M3/M4 时知道该放哪里。
- 方便代码注释和测试映射。

### 3.3 `M0_PTY_SPIKE.md`

优先级：最高。

这是马上要做的第一件事。

建议内容：

```text
- 候选 PTY backend
- 选择理由
- spike 最小代码目标
- hard blockers
- tolerable issues
- 测试记录表
- 最终结论：pass / fail / switch backend
```

为什么需要：

- M0 是整个项目的技术生死门。
- 如果 PTY backend 不稳定，项目不能进入 M1/M2。
- 这个文档能防止“感觉差不多能跑”这种危险判断。

### 3.4 `TEST_PLAN.md`

优先级：高。

当前测试计划已经在 `IMPLEMENTATION_CHECKLIST.md` 里，但建议独立成文档。

建议内容：

```text
- M0-M5 测试策略
- Rust unit tests
- frontend tests
- integration tests
- E2E tests
- manual QA
- Windows clean install test
- 性能测试
- 隐私/存储测试
```

为什么需要：

- 终端类项目靠手测很容易漏。
- Ctrl+C、中文输入、resize、隐藏 terminal buffering 都是典型坑。
- 后续每个 milestone 都要有 pass/fail 证据。

### 3.5 `SECURITY_AND_PRIVACY.md`

优先级：中高。

WrapX 不是安全产品，但它看得到用户终端输出。

建议内容：

```text
- 默认不保存 full transcript
- 默认不持久化 raw last output
- 本地 JSON 保存哪些字段
- clear metadata 删除哪些内容
- 不读取 Claude/Codex 原生日志
- 不自动 approval
- close session 的 process tree 终止语义
- clipboard / paste 风险
```

为什么需要：

- 终端输出可能包含 token、路径、客户名、prompt、命令结果。
- 开源用户会关心数据是否上传。
- 这能约束后续不要随手加 telemetry 或日志保存。

### 3.6 `RELEASE.md`

优先级：中。

可以等 M5 前写，但现在先建骨架也可以。

建议内容：

```text
- alpha release 流程
- GitHub Actions build
- checksums
- unsigned installer warning
- portable zip
- future code signing
- changelog 格式
```

为什么需要：

- 桌面 app 不是能运行就算完成。
- 用户需要拿到可安装 artifact。
- Windows unsigned app 会触发信任问题，必须提前说明。

## 4. 建议补充的非文档准备

### 4.1 初始化 Git 仓库

当前目录不是 Git 仓库。

建议尽快：

```powershell
git init
```

为什么：

- 后续所有代码改动需要版本记录。
- Claude Code 的很多 review/ship workflow 依赖 Git。
- 设计文档、M0 spike、代码原型都需要可回滚。

### 4.2 选择项目包管理器

推荐：Node 前端用 `pnpm` 或 `npm`，Rust 用 Cargo。

需要决定：

```text
- npm / pnpm / bun？
- package manager 是否写入 README？
- lockfile 是否提交？
```

我的建议：

```text
pnpm 或 npm 都行。
如果不想增加工具要求，先用 npm。
```

### 4.3 安装/确认基础工具

需要准备：

- Rust stable
- Node.js LTS
- Tauri prerequisites
- WebView2 runtime，Windows 通常已有
- `pwsh.exe`
- Claude Code CLI，可选但建议装
- Codex CLI，可选但建议装
- Git
- jq，建议装，因为 gstack JSONL task artifact 需要它

### 4.4 确认 `pwsh.exe` 路径和 profile 行为

M0 前可以先人工确认：

```powershell
Get-Command pwsh
$PSVersionTable.PSVersion
Get-Command claude -ErrorAction SilentlyContinue
Get-Command codex -ErrorAction SilentlyContinue
```

还要注意：

- profile 是否很慢。
- profile 是否输出 banner，可能污染状态检测。
- Claude/Codex 是否通过 npm shim 启动。
- 如果通过 `node.exe`，process detection 会更难。

### 4.5 选择 PTY backend 候选

这是最大技术风险。

需要调研：

- Rust + Windows ConPTY crate。
- 是否支持 resize。
- 是否支持 Ctrl+C。
- 是否支持 nonblocking read/write。
- 是否支持 process cleanup。
- 是否有 Tauri 示例。

先不要搭完整架构。先做 M0 spike。

## 5. 开发工程师视角的风险清单

| 风险 | 严重性 | 说明 | 处理 |
|---|---:|---|---|
| PTY backend 不稳定 | 高 | 输入/输出/resize/Ctrl+C 任一不稳，项目地基不稳 | M0 hard gate |
| xterm.js hidden instance 内存增长 | 高 | 多 session 长输出可能拖垮 UI | 8 session + scrollback limit + dispose 测试 |
| `node.exe` 包装导致 agent 识别困难 | 高 | npm 安装的 CLI 可能都显示 node.exe | command line + output weak evidence + unknown |
| 状态规则误报 | 高 | broad matching 会让用户不信任 | narrow rules + unknown default |
| GUI 启动环境和终端环境不同 | 中高 | PATH/profile 可能不同，claude/codex 找不到 | startup diagnostics |
| 关闭 app 杀错进程 | 中高 | process tree cleanup 语义必须明确 | close confirmation 文案和测试 |
| 隐私泄露 | 中高 | terminal output 可能有 token | 默认不保存 raw output |
| unsigned Windows artifact 信任问题 | 中 | 用户可能不敢安装 | README + checksums + portable zip |
| 文档和代码漂移 | 中 | 后续实现改了但文档没改 | 每个 milestone 更新文档 |

## 6. 推荐的项目根目录结构

等开始实现后，建议结构：

```text
wrapx/
  README.md
  PRODUCT.md
  IMPLEMENTATION_CHECKLIST.md
  PROJECT_READINESS.md
  ARCHITECTURE.md
  M0_PTY_SPIKE.md
  TEST_PLAN.md
  SECURITY_AND_PRIVACY.md
  RELEASE.md

  package.json
  package-lock.json / pnpm-lock.yaml
  src/
    App.tsx
    components/
    state/
    types/

  src-tauri/
    Cargo.toml
    tauri.conf.json
    src/
      main.rs
      commands.rs
      pty_manager.rs
      session_manager.rs
      process_inspector.rs
      status_detector.rs
      storage.rs
      config.rs

  e2e/
  .github/
    workflows/
      build-windows.yml
```

## 7. 当前建议的下一步

当前项目已经完成 M0/M1/M2 pre-alpha slice：

```text
1. README.md 和 M0_PTY_SPIKE.md 已建立。
2. Git 仓库已初始化，并在 M2 worktree 中开发。
3. Tauri + React 项目已 scaffold。
4. M0 single-terminal spike 已 PASS。
5. M1 embedded pwsh.exe terminal 已实现。
6. M2 multi-session sidebar 已实现并做过运行时验证。
```

正确下一步：

```text
1. 清理 M2 worktree 的最终 git 状态。
2. 补齐 app close 时 active sessions 统一确认/清理。
3. 提交 M2 slice。
4. 进入 M3 Claude Code / Codex process detection。
```

## 8. 最小下一批文档建议

如果你想现在继续补文档，我建议按这个顺序：

1. `README.md`
2. `M0_PTY_SPIKE.md`
3. `ARCHITECTURE.md`
4. `TEST_PLAN.md`
5. `SECURITY_AND_PRIVACY.md`
6. `RELEASE.md`

先不需要写太长。每份文档要能回答一个问题：

| 文档 | 回答的问题 |
|---|---|
| README.md | 这个项目是什么，怎么开始？ |
| M0_PTY_SPIKE.md | PTY 技术地基能不能成立？ |
| ARCHITECTURE.md | 代码怎么拆？数据怎么流？ |
| TEST_PLAN.md | 怎么证明它真的能用？ |
| SECURITY_AND_PRIVACY.md | 用户数据和危险操作怎么处理？ |
| RELEASE.md | 用户怎么安装？ |

## 9. 最后判断

你现在不是“文档太多”。

这个项目的难点不是写一个漂亮 GUI，而是：

```text
Windows PTY + PowerShell + 多 session + agent 状态 + 本地隐私 + 可安装分发
```

这些如果没有文档，后面会变成反复争论和返工。

现在已有的 `PRODUCT.md` 和 `IMPLEMENTATION_CHECKLIST.md` 是必要的。下一步最该补的是 `M0_PTY_SPIKE.md`，因为它直接决定项目能不能继续。
