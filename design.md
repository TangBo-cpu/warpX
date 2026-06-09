# WrapX UI Design

状态：DRAFT  
日期：2026-06-08  
参考图：[`参考ui.png`](./参考ui.png)；用户补充参考：terminal 顶部 cartoon status widget 与右侧 session 小部件一致；Windows 顶部标签/标题栏参考 Windows Terminal / WezTerm 的 tab bar。

## 0. 文档原则

`design.md` 是 WrapX UI 设计的唯一入口。

以后 UI 布局、视觉方向、Session Card 展示字段、状态提示交互、浅色/深色模式、Windows 顶部标签/标题栏自定义和参考 UI 取舍，都优先更新本文档。`PRODUCT.md`、`IMPLEMENTATION_CHECKLIST.md`、`README.md` 等文档可以引用本文档，但不再重复维护 UI 草图或视觉布局细节。

本文只描述 UI 方向和交互展示规则，不替代产品范围、工程实现清单、测试计划或发布计划。

## 1. 设计目标

WrapX 的主界面应像一个 **CLI agent flight deck**：左侧是用户真正工作的终端空间，右侧是 session 状态总览。

界面重点不是做通用终端，而是让用户在多个 PowerShell / CLI agent session 之间快速判断：

- 当前打开的是哪个 session。
- 哪些 session 正在运行。
- 哪些 session idle / exited / error。
- 哪个 session 需要被点开处理。
- 当前 active session 的 agent 正在做什么，以及是否需要用户介入。

视觉气质应接近参考图：紧凑、克制、有一点 cartoon / toy-like 的状态小部件，而不是普通表格化管理后台。

## 2. 参考图取舍

参考图只提供视觉方向，不逐像素复刻。

要保留：

- 左侧 terminal 是最大工作区。
- 右侧 session cards 是状态导航区。
- 小型 cartoon-style status widget 的圆角、轻阴影、温暖边框、状态图标和短消息气质。
- terminal 顶部状态条与右侧 session widget 使用近似的视觉语言。

不要保留：

- macOS 左上角 red / yellow / green traffic-light dots。它们是参考图所在窗口的系统 chrome，不是 WrapX 产品 UI。
- 参考图右下角 Toolkit / action grid。
- Create PR / Commit & Push 等 GitHub action buttons。
- 为了装饰而牺牲 terminal 可读空间的大型工具栏。

WrapX 是 Windows app。默认不模拟 macOS 窗口控制。真实 minimize / maximize / close 交给 Windows / Tauri window frame，除非以后明确实现 Windows-first custom chrome。

## 3. 总体布局

标准桌面窗口采用左右双栏布局：

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Windows top tab/title bar                                             │
├───────────────────────────────────────────────┬──────────────────────┤
│ Main Terminal Area                             │ Sessions Sidebar      │
│                                               │                      │
│ - ActiveSessionStatusWidget                    │ - Sessions / Activity │
│ - 大面积真实 terminal 输出区                   │ - session cards       │
│                                               │ - 新建 session 入口   │
└───────────────────────────────────────────────┴──────────────────────┘
```

建议比例：

| 区域 | 占比 | 说明 |
|---|---:|---|
| 左侧主终端 | 约 70% | 主要工作区，保持最大可读空间 |
| 右侧 Sessions 栏 | 约 30% | 状态导航区，建议 320-380px，当前 360px 合理 |

在常规桌面窗口下，不要默认折叠成上下布局。只有窄屏时才改为上下排列。

> 旧版 `PRODUCT.md` 中曾出现“左侧 Sessions + 右侧 Active Terminal”的 ASCII 草图。当前 canonical 方向以本文档为准：**左侧主终端 + 右侧 Sessions Sidebar**。

## 4. 左侧：主终端区域

左侧区域承载当前 active session 的真实 xterm.js 终端。

结构建议：

```text
┌──────────────────────────────────────────────┐
│ ActiveSessionStatusWidget                    │  cartoon capsule/card
├──────────────────────────────────────────────┤
│                                              │
│ Real terminal output                         │  xterm.js
│                                              │
└──────────────────────────────────────────────┘
```

主终端区域内部不再承担 Windows 窗口标签栏职责。窗口最顶部的 tab/title bar 独立定义在“Windows 顶部标签/标题栏自定义”。

### 4.1 ActiveSessionStatusWidget / Cartoon Agent Status Bar

terminal 输出区正上方必须有一条 compact cartoon-style status bar。它是 active session 的状态小部件，视觉上应与右侧 Session Card 内的小部件几乎一致。

建议命名：`ActiveSessionStatusWidget`，也可以在视觉文案中称为 **Agent Status Bar** 或 **Companion Status Bar**。

位置：

- 位于 Windows 顶部标签/标题栏下方的主内容区内，紧贴 xterm.js 输出区上方。
- 不进入 terminal buffer，不影响终端原始输出。
- 建议高度 32-40px，最多两行；不能变成大型 toolbar。

内容：

- agent icon / avatar / glyph：`PowerShell` / `Claude Code` / `Codex` / `Unknown`。
- active session name。
- project / cwd shorthand。
- branch。
- human-readable status label。
- one-line status reason / short message。
- last activity age。
- 可选安全 metadata menu，例如 clear reason / mark unknown / clear override。

视觉语言：

- 圆角 capsule/card。
- 温暖边框或细彩边。
- 轻微阴影和内高光。
- 小型 cartoon / pixel / sticker-like 状态图标可以加入，但不能幼稚化或干扰阅读。
- `approval-needed` / `waiting-input` 可使用更明显的轮廓、微光或顶部彩条。
- `shell` / `exited` / `unknown` 降低饱和度。

示意：

```text
┌────────────────────────────────────────────────────────────┐
│ [🤖] draftframe  main  Claude Code · Needs approval         │
│      Review the command in the terminal              12s   │
└────────────────────────────────────────────────────────────┘
```

这条 status widget 可以跟随主题和密度设置，但它不是用户截图中最顶部的 Windows tab/title bar。顶部栏详见“Windows 顶部标签/标题栏自定义”。

### 4.3 终端主体

终端主体是最大区域：

- 显示当前 active session 的真实 PowerShell / CLI agent 输出。
- session 切换时只切换显示，不混合输出。
- inactive session 的输出仍写入对应 session runtime，但不显示在当前主终端。
- terminal 默认保持高对比和可读性。即使 app chrome 是 light mode，terminal 本身也可以默认保持 dark theme。

## 5. 右侧：Sessions Sidebar

右侧是 WrapX 区别于普通终端的核心区域。

结构建议：

```text
┌──────────────────────────┐
│ Sessions  Activity    +  │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Session Card         │ │
│ │ StatusWidget         │ │
│ │ metadata/actions     │ │
│ └──────────────────────┘ │
│                          │
│ more session cards...    │
└──────────────────────────┘
```

### 5.1 顶部 tabs

右侧顶部保留两个语义入口：

- `Sessions`：当前默认视图，显示 session cards。
- `Activity`：后续可用于显示活动流、状态变化或历史事件。

当前阶段可以只实现 `Sessions`，`Activity` 作为视觉占位。

### 5.2 新建入口

右上角保留 `+` 作为新建 session 入口。

建议行为：

- 空状态时可以直接展示新建表单。
- 空状态文案保持精致：一句主行动文案 + 一个 primary New Session 按钮 + 小字解释真实 `pwsh.exe`。
- 有 session 后默认隐藏表单，只保留 `+`。
- 点击 `+` 后展开新建表单。

这样右栏在日常使用时更接近参考 UI：主要展示 session cards，而不是长期占用空间显示表单。

### 5.3 Session Card

每张卡片代表一个 PowerShell session。

Session Card 使用与 `ActiveSessionStatusWidget` 同源的 `SessionStatusWidget`。卡片只是包裹身份、metadata 和少量管理操作；状态展示本身不能另起一套视觉语言。

卡片展示层级：

| 层级 | 内容 | 视觉权重 |
|---|---|---|
| Primary | session name + human-readable status | 最高 |
| Secondary | agent kind + branch / cwd shorthand | 中等 |
| Tertiary | status reason / last activity age | 低，但 `approval-needed` / `waiting-input` 可提升 |
| Management | override / close / clear reason | 默认收起到 menu 或 hover/focus 状态 |

可显示字段：

- session name。
- cwd / project label。
- git branch。
- agent kind：`none` / `claude-code` / `codex` / `unknown`。
- status：`shell` / `running` / `waiting-input` / `approval-needed` / `error` / `exited` / `unknown`。
- last output preview，可配置是否持久化。
- status reason。
- last activity time。
- override badge，如果用户手动修正 agent 类型。

active card 使用更明显的背景和边框，让用户知道当前主终端对应哪个 session。

`Agent override` 是管理控件，不应常驻抢视觉；默认放入 compact menu / expanded detail，只有 hover、focus 或展开状态才显示完整控件。

示意：

```text
┌──────────────────────┐
│ 🤖 draftframe   main │
│ Needs approval   12s │
│ Review command       │
└──────────────────────┘
┌──────────────────────┐
│ ◇ Codex        main  │
│ Working          3s  │
│ Running tests...     │
└──────────────────────┘
┌──────────────────────┐
│ > PowerShell         │
│ Shell                │
│ PS>                  │
└──────────────────────┘
```

## 6. StatusWidget 复用规则

terminal 顶部状态条和右侧 Session Card 必须来自同一套 status widget 规则。

建议组件概念：

```text
StatusWidget
├─ variant="terminal"  // terminal 上方横向状态条
├─ variant="card"      // sidebar card 内部小部件
└─ variant="badge"     // 未来小型 header/badge 场景
```

统一输入数据：

- `session.name`
- `session.cwd`
- `session.gitBranch`
- `session.agentKind`
- `session.agentKindOverride`
- `session.status`
- `session.statusReason`
- `session.statusReasonAt`
- `session.lastActivityAt`

统一规则：

- 颜色来自相同 status token map。
- 状态文案来自相同 enum-to-label/message map。
- icon / avatar / glyph 使用相同 agent token。
- terminal variant 可以更宽、更横向、更详细。
- card variant 更紧凑，可以堆叠两到三行。
- 不允许 terminal pill 和 session status badge 各写一套漂移的颜色和文案。

## 7. 状态展示和安全交互

状态展示只用于提醒和导航，不自动替用户操作终端。

### 7.1 状态来源

当前状态由 Rust backend 的 bounded rolling buffer 和窄匹配 status detector 产生，通过 `session-status` 事件更新前端展示。

常见状态：

| 状态 | UI label | UI short message |
|---|---|---|
| `shell` | Shell | Ready for commands |
| `running` | Working | Output received recently |
| `waiting-input` | Waiting for you | Continue in the terminal |
| `approval-needed` | Needs approval | Review the command in the terminal |
| `error` | Error | Check the terminal output |
| `exited` | Exited | Session has stopped |
| `unknown` | Unknown | Not enough signal yet |

工程枚举保留，但 UI 默认展示人类可读 label/message。右侧 cards 和 terminal 顶部 status widget 必须共用同一套映射。

### 7.2 视觉优先级

状态视觉优先级：

```text
approval-needed / waiting-input
  > active session
  > running
  > error
  > shell
  > unknown
  > exited
```

说明：

- `approval-needed` / `waiting-input` 表示用户可能需要介入，视觉上应更醒目。
- `error` 要明确，但不能比 approval 抢占全部注意力。
- `shell` 是普通状态，低饱和即可。
- `unknown` 表示保守判断，不要用危险色。
- `exited` 使用降低对比的静态样式。

### 7.3 点击行为

- 点击 `approval-needed` / `waiting-input` card 只聚焦对应终端。
- 点击 terminal 顶部 `ActiveSessionStatusWidget` 默认只选中 / 聚焦当前 session。
- 不自动发送 approval 文本。
- 不自动发送按键。
- `approval-needed` / `waiting-input` 是 UI 状态提示，不是自动执行动作。

### 7.4 Safe status action

安全状态动作只改 UI metadata，不发送终端输入：

- mark as unknown。
- clear status reason。
- clear agent override。

manual override 只改 UI metadata，不发送终端输入；清除 override 后恢复 auto detection。

所有状态控件在 light / dark mode 下都必须有可见 focus state。

## 8. Theme System：Light / Dark Mode

WrapX 必须支持浅色和深色模式。Light / Dark 是一级 UI 要求，不是后续皮肤。

### 8.1 主题原则

- 两个主题共享同一信息层级、组件结构和状态语义。
- 不做简单颜色反转。
- 状态颜色定义 light/dark token 对。
- terminal theme 也要 theme-aware，但 app chrome 进入 light mode 时，terminal 可以默认保持 dark 以保证可读性。
- 如果未来提供 light terminal，应作为 terminal theme 选项，不强制跟随 app chrome。

### 8.2 Dark mode 方向

Dark mode 保留深色 terminal cockpit 氛围：

- deep charcoal / warm black 背景。
- 温暖 amber / brown 边框。
- green / blue / purple agent accent。
- 状态 widget 可以更发光，但要克制。

### 8.3 Light mode 方向

Light mode 不要变成普通白底表单：

- app background 使用 warm paper / ivory / soft gray。
- sidebar cards 使用 white / cream surfaces。
- terminal 可以保持 dark terminal surface。
- 状态 widget 使用浅色填充 + 高对比文字 + 柔和边框。
- 保留参考图的 cartoon/toy-like 状态小部件气质。

### 8.4 Semantic tokens

实现时先定义 semantic tokens，不在组件里散落硬编码颜色。

建议 token 分类：

```css
/* surfaces */
--surface-app
--surface-frame
--surface-terminal
--surface-sidebar
--surface-card
--surface-card-active
--surface-elevated

/* text */
--text-primary
--text-secondary
--text-muted
--text-inverse

/* borders */
--border-subtle
--border-strong
--border-active

/* accents */
--accent-warm
--accent-warm-strong
--accent-cool
--accent-success
--accent-warning
--accent-danger
--accent-neutral

/* status */
--status-shell-fg
--status-shell-bg
--status-shell-border
--status-running-fg
--status-running-bg
--status-running-border
--status-waiting-fg
--status-waiting-bg
--status-waiting-border
--status-approval-fg
--status-approval-bg
--status-approval-border
--status-error-fg
--status-error-bg
--status-error-border
--status-exited-fg
--status-exited-bg
--status-exited-border
--status-unknown-fg
--status-unknown-bg
--status-unknown-border

/* geometry */
--radius-window
--radius-card
--radius-pill
--space-1
--space-2
--space-3
--shadow-frame
--shadow-card
```

建议主题入口：

```text
data-theme="dark" | "light"
```

系统主题跟随可以后加；显式 app 设置优先。

## 9. Windows 顶部标签/标题栏自定义

用户所说的“状态栏”指窗口最顶部这一块，类似 Windows Terminal / WezTerm 的 tab/title bar：包含 tab 图标、tab 标题、关闭按钮、新建 tab 按钮、下拉入口，以及右侧可能存在的窗口拖拽区域。

这不是 terminal 内部 status line，也不是 `ActiveSessionStatusWidget`。设计和实现时必须把三者分开：

| 区域 | 位置 | 职责 |
|---|---|---|
| Windows top tab/title bar | 整个窗口最顶部 | tab、标题、图标、新建、关闭、下拉、窗口拖拽 |
| ActiveSessionStatusWidget | terminal 输出区上方 | 当前 active session 的 agent 状态和短消息 |
| Sessions Sidebar card | 右侧栏 | 多 session 状态导航 |

### 9.1 默认布局

顶部栏参考用户截图中的 Windows Terminal / WezTerm 结构：

```text
┌──────────────────────────────────────────────────────────────────┐
│ [icon] [agent glyph] Optimize UI design        ×   +   ˅          │
└──────────────────────────────────────────────────────────────────┘
```

默认元素：

- active tab 背景。
- tab icon：shell / agent / workspace icon。
- 可选 agent glyph：Claude Code / Codex / PowerShell。
- tab title：session name 或当前工作标题。
- close tab/session button。
- new session button `+`。
- dropdown / command menu button。
- 可拖拽空白区域。

### 9.2 可美化项

顶部标签/标题栏应支持美化自定义，而不是固定系统默认样式。

允许用户配置：

- tab/title bar 是否使用 custom chrome。
- bar height：compact / comfortable。
- active tab shape：rounded / squared / underline。
- active tab background 和 inactive tab background 使用 theme tokens。
- 是否显示 app icon。
- 是否显示 agent glyph。
- tab title 来源：session name / cwd basename / project / custom title。
- tab title 最大长度和截断方式。
- close button 是否常显：always / hover。
- new session button 是否显示。
- dropdown button 是否显示。
- 顶部栏背景是否透明、磨砂或纯色（以平台可实现为准）。
- light / dark mode 下的 tab、边框、hover、active token。

### 9.3 Windows-first 约束

- 不显示 macOS red / yellow / green traffic-light dots。
- 不把 macOS 标题栏当成产品 UI 复刻。
- 如果使用 Tauri custom titlebar，必须保留 Windows 用户预期：可拖拽区域、窗口最大化/最小化/关闭行为、系统菜单或等价入口。
- 顶部栏美化不能影响 terminal 的键盘焦点。
- 关闭 tab/session 必须遵守已有 active sessions 关闭确认规则。
- `+` 只新建 session，不触发 agent 自动行为。
- dropdown 只放安全命令：新建 session、主题、密度、设置、关于等；不放自动 approval。

### 9.4 与 ActiveSessionStatusWidget 的关系

顶部标签/标题栏负责窗口级和 tab 级导航；`ActiveSessionStatusWidget` 负责 active session 的 agent 状态。

两者可以共享 icon / agent glyph / theme tokens，但不要合并成一个区域：

- 顶部栏：像 Windows Terminal / WezTerm tab bar，强调窗口导航和 session 标题。
- ActiveSessionStatusWidget：像参考图 cartoon status card，强调 agent 当前状态、短消息和是否需要用户介入。

如果顶部 tab 上显示状态，只能是很轻的点状/短 badge，例如 `Needs approval` 的小色点；完整 reason 和 action hint 留给 `ActiveSessionStatusWidget` 和右侧 Session Card。

## 10. 视觉密度和层级

参考图是紧凑但可读，不是堆满字段。

规则：

- 主终端永远是视觉主角。
- 新增 cartoon status bar 不能抢走 terminal 输出空间。
- Sidebar card 默认显示最少必要字段，额外字段进入 tooltip、展开态或 menu。
- 需要处理的 session 比普通 shell 更醒目。
- active session 比非 active session 更清楚。
- `Agent override`、close、clear reason 等管理控件默认弱化或收起。
- 外层 window padding 可以有 polished mockup 感，但 Windows utility app 模式应允许更紧凑密度。

建议密度：

| 模式 | 用途 | 特征 |
|---|---|---|
| Comfortable | 默认视觉展示 | 12-18px 外边距，较圆角，轻阴影 |
| Compact | Windows utility / 小屏 | 8-12px 外边距，较小圆角，降低 glow |

## 11. 组件模型建议

设计上建议按以下组件拆分，便于后续实现复用：

```text
AppShell
└─ WorkspaceFrame
   ├─ TerminalPane
   │  ├─ TerminalHeader
   │  ├─ ActiveSessionStatusWidget
   │  ├─ TerminalToolbar / safe utility actions
   │  └─ TerminalHostStack
   └─ SessionsSidebar
      ├─ SidebarHeader
      ├─ NewSessionPanel
      └─ SessionList
         └─ SessionCard
            ├─ SessionIdentity
            ├─ SessionStatusWidget
            ├─ AgentOverrideControl
            └─ SessionCloseAction
```

其中 `ActiveSessionStatusWidget` 和 `SessionStatusWidget` 应共享 token、status label map 和 agent glyph 规则。

## 12. 明确不做的区域

参考图右下角有 Toolkit / action buttons 区域，但当前 WrapX 不需要复刻。

当前不做：

- Toolkit 面板。
- Create PR / Commit & Push 等快捷动作。
- 底部工具按钮组。
- 与 GitHub / release / build 相关的 action grid。
- macOS traffic-light dots。
- 复杂插件式 status bar。
- 自动 approval 或自动发送终端输入。

右侧栏当前只服务于 session 管理和状态总览。

## 13. 当前布局结论

当前目标布局是：

```text
左侧：一个大的 active terminal。
窗口最顶部：Windows Terminal / WezTerm 风格 top tab/title bar，可美化自定义。
左侧 terminal 上方：cartoon-style ActiveSessionStatusWidget。
右侧：Sessions sidebar + session cards + 新建入口。
主题：必须支持 light / dark mode，共用 token 和状态语义。
不做：macOS traffic lights、右下 Toolkit 工具区、自动 approval。
```

这套布局先支撑多 session 切换和状态观察，再把 Claude Code / Codex 检测结果和 status detector 结果填入共享的 status widgets。

## 14. App-wide Background & Appearance System

状态：MVP 定稿，后续扩展以本文 TODO 为准。

这次外观创新允许放松前文对当前 UI 视觉约束的限制，但仍保留以下产品底线：

- 主终端可读性优先。
- Windows-first，不复刻 macOS traffic lights。
- 顶部菜单负责打开外观设置入口。
- 背景、渐变、遮罩、透明 surface 和状态卡片应形成一个统一视觉空间。
- 自定义 CSS 暂不作为 MVP 入口，避免破坏窗口交互和 terminal 可读性。

### 14.1 产品目标

该功能不是简单“换皮肤”，而是一个 **全应用背景环境系统**：

```text
底层：全局背景色 / 渐变
中层：用户背景图片，支持独立不透明度
上层：全局 overlay / vignette / acrylic blur
表层：titlebar、terminal pane、sidebar、cards 共用 surface tokens
保护：terminal 可读性由 preset token 保证，不暴露 terminal opacity
```

目标是解决窗口顶部、terminal、右侧 sidebar、session cards 和背景之间割裂的问题，让 WrapX 看起来像一个统一的 glass / acrylic workspace。

### 14.2 折中 MVP 交互

采用 Windows Terminal 设置页的 row-card 思路，但不在第一版引入完整 profile 设置页。

入口：

```text
顶部菜单 / dropdown
├─ New Session
├─ Appearance...
├─ Settings
└─ About
```

点击 `Appearance...` 后打开一个右侧抽屉或 modal panel。面板采用 Windows Terminal 风格的设置行：标题、说明、控件、单项重置入口。

建议布局：

```text
Appearance

Preview
┌────────────────────────────────────┐
│ titlebar / terminal / sidebar demo │
└────────────────────────────────────┘

配色方案
[ Ivory Glass        v ]     ↶
应用整体背景、surface 和状态卡片色彩。

背景图像
背景图像路径
[ Choose Image... ] [ Clear ]          ↶
选择整个 WrapX 共享的背景图片。

背景图像拉伸模式
[ 均匀填充 v ]                         ↶
控制图片如何填满窗口。

背景图像对齐
[ 居中 v ]                             ↶
控制图片与窗口边界的对齐方式。

背景图像不透明度
0% ─────────●──── 100%                 ↶
控制图片露出程度。

透明度
视觉强度
Subtle ───────●──── Strong             ↶
控制玻璃感、遮罩、模糊和 surface 融合程度。

启用亚克力材料
[ 开 ]                                  ↶
使用半透明 / 模糊材质。

[ Reset Appearance ]
```

MVP 设置项：

| 分组 | 设置项 | MVP 行为 |
|---|---|---|
| 配色方案 | 4 个 preset | `Ivory Glass`、`Midnight Glass`、`Acrylic Terminal`、`Terminal Focus` |
| 背景图像 | 文件选择 | 支持本地 `.png` / `.jpg` / `.jpeg` / `.webp`；选择后复制到 app data |
| 背景图像 | Clear | 只清除背景图片，不改变 preset |
| 背景图像 | 拉伸模式 | `cover` / `contain` / `stretch` / `tile` |
| 背景图像 | 对齐方式 | `center`、四边、四角 |
| 背景图像 | 图片不透明度 | `0 - 1`，控制背景图片层，不控制 terminal |
| 透明度 | 视觉强度 | `0 - 1`，映射 overlay、blur、surface 透明感和边框高光 |
| 透明度 | 启用亚克力材料 | 控制 blur / backdrop-filter 类效果 |
| 恢复 | Reset Appearance | 恢复默认 preset 和默认数值，保证用户可回到可读状态 |

### 14.3 MVP 配置模型

MVP 只保存用户真实选择，不保存展开后的全部 CSS token。preset 和 intensity 负责推导 token。

```ts
type AppearancePreset =
  | "ivory-glass"
  | "midnight-glass"
  | "acrylic-terminal"
  | "terminal-focus";

type BackgroundImageFit =
  | "cover"
  | "contain"
  | "stretch"
  | "tile";

type BackgroundImageAlignment =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type AppearanceSettings = {
  preset: AppearancePreset;
  intensity: number; // 0 - 1
  backgroundImagePath?: string;
  backgroundImageFit: BackgroundImageFit;
  backgroundImageAlignment: BackgroundImageAlignment;
  backgroundImageOpacity: number; // 0 - 1
  acrylicEnabled: boolean;
};
```

默认值建议：

```ts
{
  preset: "ivory-glass",
  intensity: 0.45,
  backgroundImageFit: "cover",
  backgroundImageAlignment: "center",
  backgroundImageOpacity: 0.35,
  acrylicEnabled: true
}
```

### 14.4 Preset 语义

| Preset | 用途 | 视觉方向 |
|---|---|---|
| `Ivory Glass` | 默认浅色创新方向 | 暖色渐变、ivory overlay、半透明 sidebar/card、深色 terminal surface |
| `Midnight Glass` | 夜间工作舱 | 深蓝黑 / 紫黑渐变、暗色 glass surface、terminal 接近纯黑 |
| `Acrylic Terminal` | 最强调背景图片 | 用户图片更明显、blur 更强、sidebar/card 更玻璃化 |
| `Terminal Focus` | 长时间工作 | 图片弱化、overlay 更强、terminal 可读性最稳 |

Preset 切换规则：

- 切换 preset 时保留当前背景图片和背景图片不透明度。
- `Clear Image` 只清除图片，不改变 preset。
- `Reset Appearance` 恢复默认 preset、默认 opacity、默认 fit/alignment，并清除或恢复默认图片。
- terminal opacity 不作为用户设置暴露；terminal surface 由 preset token 保证可读性。

### 14.5 背景图片实现原则

背景图片应是独立层，而不是直接混进不可控的 `background` shorthand，这样才能稳定控制图片不透明度。

建议层级：

```css
.app-shell {
  position: relative;
  background:
    var(--appearance-vignette),
    var(--appearance-gradient),
    var(--appearance-base-color);
}

.app-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--appearance-image);
  background-size: var(--appearance-image-size);
  background-position: var(--appearance-image-position);
  background-repeat: var(--appearance-image-repeat);
  opacity: var(--appearance-image-opacity);
  pointer-events: none;
}

.app-shell > * {
  position: relative;
  z-index: 1;
}
```

图片文件处理：

- 用户选择本地图片后复制到 app data，例如 `%APPDATA%/WrapX/backgrounds/`。
- 配置保存 app-managed path，不长期引用微信、下载目录或临时目录。
- 图片丢失时回退到当前 preset 的渐变背景。
- 背景图片失败不能阻止应用启动。

### 14.6 Surface token 原则

组件不应直接硬编码背景色，而应消费统一 token：

```css
:root {
  --appearance-base-color: #f7efe1;
  --appearance-image: none;
  --appearance-image-opacity: 0.35;
  --appearance-gradient: linear-gradient(135deg, rgba(255, 233, 196, 0.42), rgba(155, 190, 255, 0.28));
  --appearance-vignette: radial-gradient(circle at center, transparent 45%, rgba(68, 46, 24, 0.18) 100%);
  --appearance-blur: 16px;

  --surface-titlebar: rgba(255, 250, 241, 0.62);
  --surface-main: rgba(255, 248, 235, 0.58);
  --surface-sidebar: rgba(255, 245, 226, 0.64);
  --surface-card: rgba(255, 251, 244, 0.76);
  --surface-card-active: rgba(255, 239, 205, 0.84);
  --surface-terminal: rgba(2, 6, 12, 0.88);
}
```

应用规则：

- titlebar / terminal header / sidebar / cards 使用 surface token。
- 大区域可以使用 acrylic blur；session card 默认优先使用半透明 surface 和 shadow，避免每个小卡片都强 blur。
- terminal surface 保持深色和高对比，背景图片只能作为弱氛围透出。
- 用户调节的是背景图片不透明度，不是 terminal 透明度。

### 14.7 MVP 验证清单

实现完成前至少验证：

- 顶部菜单可以打开 / 关闭 Appearance 面板。
- 4 个 preset 可切换，并明显改变整体氛围。
- 选择背景图片后立即生效。
- 重启应用后背景图片和设置仍生效。
- `Clear Image` 只清除图片，不重置 preset。
- fit / alignment / image opacity 生效。
- image opacity `0` 时图片完全隐藏但渐变还在。
- image opacity `1` 时图片完整参与背景但内容仍可读。
- intensity slider 对 glass / overlay / surface 融合有明显影响。
- acrylic toggle 关闭后 blur 类效果消失，布局不变。
- Reset Appearance 能恢复默认可读状态。
- 图片路径失效时应用不崩溃，并回退到 preset 渐变。

### 14.8 后续 TODO：完整 Appearance / Terminal 设置

折中 MVP 后，完整设置可以逐步吸收 Windows Terminal 的更多能力，但必须分组推进，避免一次性塞满。

TODO：Appearance 完整化

- [ ] 单项 reset 按钮覆盖所有 Appearance row。
- [ ] Appearance preview 做真实 titlebar / terminal / sidebar / session card 缩略预览。
- [ ] 支持导入 / 导出 appearance preset JSON。
- [ ] 支持用户自定义 gradient stops。
- [ ] 支持用户自定义 surface opacity token。
- [ ] 支持用户自定义 accent color 和 status color token。
- [ ] 支持 light / dark / system 基础模式与 appearance preset 的关系定义。
- [ ] 支持安全模式启动时跳过自定义外观。

TODO：Terminal 文本设置

- [ ] 配色方案 / terminal color scheme 选择。
- [ ] 字体 family。
- [ ] 是否显示所有字体。
- [ ] 字号。
- [ ] 行高。
- [ ] 单元格宽度。
- [ ] 字重。
- [ ] 可变字体轴。
- [ ] 字体功能。

TODO：Cursor 设置

- [ ] 光标形状。
- [ ] 光标高度。
- [ ] 光标颜色。
- [ ] 光标 blink 行为。

TODO：高级自定义

- [ ] CSS variable override 文件。
- [ ] 高级 custom CSS 文件，默认关闭并标记实验性。
- [ ] custom CSS 一键禁用。
- [ ] custom CSS 出错 / 不可读时 fail closed 到默认外观。
- [ ] 主题包目录和本地主题管理。

TODO：非 MVP 明确暂缓

- [ ] 动态壁纸。
- [ ] 在线主题市场。
- [ ] 云同步背景图。
- [ ] 多窗口不同背景。
- [ ] 真系统级透明窗口。