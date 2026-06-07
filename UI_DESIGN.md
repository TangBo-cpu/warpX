# WrapX UI Design

状态：DRAFT
日期：2026-06-07
参考图：`E:\Code-All\wrapx\参考ui.png`
用途：记录 WrapX 当前参考 UI 的整体布局方向。本文只描述大致布局，不定义完整视觉规范，也不包含实现细节。

## 1. 设计目标

WrapX 的主界面应像一个 **CLI agent flight deck**：左侧是用户真正工作的终端空间，右侧是 session 状态总览。

界面重点不是做通用终端，而是让用户在多个 PowerShell / CLI agent session 之间快速判断：

- 当前打开的是哪个 session。
- 哪些 session 正在运行。
- 哪些 session idle / exited / error。
- 哪个 session 需要被点开处理。

## 2. 总体布局

参考 UI 采用左右双栏布局：

```text
┌───────────────────────────────────────────────┬──────────────────────┐
│ Main Terminal Area                             │ Sessions Sidebar      │
│                                               │                      │
│ - 当前 active session 的真实终端               │ - Sessions / Activity │
│ - 终端顶部状态条                               │ - session cards       │
│ - 大面积命令输出区                             │ - 新建 session 入口   │
│ - 底部/局部状态信息                            │                      │
└───────────────────────────────────────────────┴──────────────────────┘
```

建议比例：

| 区域 | 占比 | 说明 |
|---|---:|---|
| 左侧主终端 | 约 70% | 主要工作区，保持最大可读空间 |
| 右侧 Sessions 栏 | 约 30% | 状态导航区，宽度固定或半固定 |

在常规桌面窗口下，不要默认折叠成上下布局。只有窄屏时才改为上下排列。

## 3. 左侧：主终端区域

左侧区域承载当前 active session 的真实 xterm.js 终端。

结构建议：

```text
┌──────────────────────────────────────┐
│ Window / Session top bar             │
├──────────────────────────────────────┤
│ Active session status strip          │
├──────────────────────────────────────┤
│                                      │
│ Real terminal output                 │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

### 3.1 顶部状态条

顶部状态条用于展示当前 active session 的轻量信息，例如：

- app / project name，例如 `WrapX`。
- 当前 project / branch，例如 `main`。
- 当前 session 状态，例如 `running`、`idle`、`exited`、`error`。
- 可选的 agent/model 信息，后续 M3/M4 再补。

这一区域不应占太多高度，避免压缩终端空间。

### 3.2 终端主体

终端主体是最大区域：

- 显示当前 active session 的真实 PowerShell / CLI agent 输出。
- session 切换时只切换显示，不混合输出。
- inactive session 的输出仍写入对应 session runtime，但不显示在当前主终端。

## 4. 右侧：Sessions Sidebar

右侧是 WrapX 区别于普通终端的核心区域。

结构建议：

```text
┌──────────────────────────┐
│ Sessions  Activity    +  │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Session Card         │ │
│ │ name / branch/status │ │
│ │ agent/model/last msg │ │
│ └──────────────────────┘ │
│                          │
│ more session cards...    │
└──────────────────────────┘
```

### 4.1 顶部 tabs

右侧顶部保留两个语义入口：

- `Sessions`：当前默认视图，显示 session cards。
- `Activity`：后续可用于显示活动流、状态变化或历史事件。

当前 M2 阶段可以只实现 `Sessions`，`Activity` 作为视觉占位。

### 4.2 新建入口

右上角保留 `+` 作为新建 session 入口。

建议行为：

- 空状态时可以直接展示新建表单。
- 有 session 后默认隐藏表单，只保留 `+`。
- 点击 `+` 后展开新建表单。

这样右栏在日常使用时更接近参考 UI：主要展示 session cards，而不是长期占用空间显示表单。

### 4.3 Session Card

每张卡片代表一个 PowerShell session。

卡片建议展示：

- session name。
- cwd / project label。
- status，例如 `running`、`idle`、`exited`、`error`。
- 后续 M3/M4 可加入 agent kind、branch、model、last activity。

active card 使用更明显的背景和边框，让用户知道当前主终端对应哪个 session。

## 5. 明确不做的区域

参考图右下角有 Toolkit / action buttons 区域，但当前 WrapX 不需要复刻。

当前不做：

- Toolkit 面板。
- Create PR / Commit & Push 等快捷动作。
- 底部工具按钮组。
- 与 GitHub / release / build 相关的 action grid。

右侧栏当前只服务于 session 管理和状态总览。

## 6. M2 当前布局结论

M2 阶段的目标布局是：

```text
左侧：一个大的 active terminal。
右侧：Sessions sidebar + session cards + 新建入口。
不做：右下 Toolkit 工具区。
```

这套布局能先支撑多 session 切换和状态观察，后续 M3/M4 再把 Claude Code / Codex 检测结果填入 session cards。
