import { useRef, type CSSProperties, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import type {
  AppearanceSettings,
  AppearancePreset,
  BackgroundImageAlignment,
  BackgroundImageFit,
  FontOption,
  TerminalColorKey,
  TerminalThemeId,
} from "../appearance";
import {
  APPEARANCE_PRESET_OPTIONS,
  BACKGROUND_IMAGE_ALIGNMENT_OPTIONS,
  APP_FONT_OPTIONS,
  APP_FONT_WEIGHT_OPTIONS,
  BACKGROUND_IMAGE_FIT_OPTIONS,
  DEFAULT_APPEARANCE_SETTINGS,
  TERMINAL_COLOR_FIELDS,
  TERMINAL_FONT_OPTIONS,
  TERMINAL_FONT_WEIGHT_OPTIONS,
  TERMINAL_THEME_OPTIONS,
  resolveTerminalThemeColors,
} from "../appearance";

type AppearancePanelProps = {
  settings: AppearanceSettings;
  statusMessage?: string;
  onChange: (patch: Partial<AppearanceSettings>) => void;
  onImportImage: (file: File) => void | Promise<void>;
  onClearImage: () => void;
  onClose: () => void;
  onReset: () => void;
};

type SettingRowProps = {
  title: string;
  description: string;
  children: ReactNode;
  onReset?: () => void;
};

export function AppearancePanel({
  settings,
  statusMessage,
  onChange,
  onImportImage,
  onClearImage,
  onClose,
  onReset,
}: AppearancePanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const terminalPreviewTheme = resolveTerminalThemeColors(settings);

  return (
    <div className="appearance-panel-backdrop" role="presentation" onMouseDown={closeOnBackdrop}>
      <section
        aria-label="Appearance settings"
        className="appearance-panel"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="appearance-panel-header">
          <span>
            <strong>Appearance</strong>
            <span>Windows Terminal-inspired background controls for the whole app.</span>
          </span>
          <button aria-label="Close Appearance" className="appearance-close" type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="appearance-preview" aria-hidden="true">
          <div className="appearance-preview-titlebar" />
          <div className="appearance-preview-body">
            <div
              className="appearance-preview-terminal"
              style={
                {
                  "--preview-terminal-bg": terminalPreviewTheme.background,
                  "--preview-terminal-fg": terminalPreviewTheme.foreground,
                  "--preview-terminal-accent": terminalPreviewTheme.blue,
                } as CSSProperties
              }
            />
            <div className="appearance-preview-sidebar">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="appearance-section">
          <h2>配色方案</h2>
          <SettingRow
            title="配色方案"
            description="覆盖应用整体背景、surface 和状态卡片色彩。"
            onReset={() => onChange({ preset: DEFAULT_APPEARANCE_SETTINGS.preset })}
          >
            <select
              className="appearance-control"
              value={settings.preset}
              onChange={(event) => onChange({ preset: event.target.value as AppearancePreset })}
            >
              {APPEARANCE_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingRow>
        </div>

        <div className="appearance-section">
          <h2>字体</h2>
          <SettingRow
            title="应用字体"
            description="控制标题栏、侧边栏和设置面板等 WrapX UI 字体。"
            onReset={() => onChange({ appFontFamily: DEFAULT_APPEARANCE_SETTINGS.appFontFamily })}
          >
            <FontFamilyControl
              listId="app-font-options"
              options={APP_FONT_OPTIONS}
              value={settings.appFontFamily}
              onChange={(appFontFamily) => onChange({ appFontFamily })}
            />
          </SettingRow>

          <SettingRow
            title="应用字体粗细"
            description="控制 WrapX UI 默认文本粗细。"
            onReset={() => onChange({ appFontWeight: DEFAULT_APPEARANCE_SETTINGS.appFontWeight })}
          >
            <FontWeightControl
              options={APP_FONT_WEIGHT_OPTIONS}
              value={settings.appFontWeight}
              onChange={(appFontWeight) => onChange({ appFontWeight })}
            />
          </SettingRow>

          <SettingRow
            title="终端字体"
            description="控制 xterm 等宽字体；留空时跟随当前 Windows Terminal profile。"
            onReset={() => onChange({ terminalFontFamily: DEFAULT_APPEARANCE_SETTINGS.terminalFontFamily })}
          >
            <FontFamilyControl
              allowEmpty
              listId="terminal-font-options"
              options={TERMINAL_FONT_OPTIONS}
              placeholder="Windows Terminal profile"
              value={settings.terminalFontFamily}
              onChange={(terminalFontFamily) => onChange({ terminalFontFamily })}
            />
          </SettingRow>

          <SettingRow
            title="终端字体粗细"
            description="控制 xterm 字体粗细；默认跟随当前 Windows Terminal profile。"
            onReset={() => onChange({ terminalFontWeight: DEFAULT_APPEARANCE_SETTINGS.terminalFontWeight })}
          >
            <FontWeightControl
              options={TERMINAL_FONT_WEIGHT_OPTIONS}
              value={settings.terminalFontWeight}
              onChange={(terminalFontWeight) => onChange({ terminalFontWeight })}
            />
          </SettingRow>
        </div>

        <div className="appearance-section">
          <h2>终端主题</h2>
          <SettingRow
            title="终端配色方案"
            description="只控制 xterm 的前景、背景、光标、选区和 ANSI 颜色，不再跟随 WrapX 外壳主题切换。"
            onReset={() => onChange({ terminalThemeId: DEFAULT_APPEARANCE_SETTINGS.terminalThemeId })}
          >
            <select
              className="appearance-control"
              value={settings.terminalThemeId}
              onChange={(event) => onChange({ terminalThemeId: event.target.value as TerminalThemeId })}
            >
              {TERMINAL_THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingRow>

          <div className="terminal-palette-preview" aria-label="Terminal palette preview">
            {TERMINAL_COLOR_FIELDS.map(({ key, label }) => (
              <span key={key} title={`${label}: ${terminalPreviewTheme[key]}`}>
                <span style={{ backgroundColor: terminalPreviewTheme[key] }} />
                {label}
              </span>
            ))}
          </div>

          {settings.terminalThemeId === "custom" ? (
            <div className="terminal-color-grid">
              {TERMINAL_COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="terminal-color-field">
                  <span>{label}</span>
                  <input
                    aria-label={`Terminal ${label}`}
                    type="color"
                    value={settings.terminalCustomTheme[key] ?? DEFAULT_APPEARANCE_SETTINGS.terminalCustomTheme[key]}
                    onChange={(event) => updateTerminalCustomColor(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="appearance-section">
          <h2>背景图像</h2>
          <SettingRow title="背景图像路径" description="选择整个 WrapX 共享的背景图片。" onReset={onClearImage}>
            <div className="appearance-image-actions">
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                Choose Image...
              </button>
              <button className="appearance-secondary-button" type="button" onClick={onClearImage}>
                Clear
              </button>
              <input
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/*"
                className="appearance-file-input"
                type="file"
                onChange={handleFileChange}
              />
            </div>
            <span className="appearance-path" title={settings.backgroundImagePath ?? "No image selected"}>
              {settings.backgroundImagePath ?? "No image selected"}
            </span>
          </SettingRow>

          <SettingRow
            title="背景图像拉伸模式"
            description="设置如何调整背景图像的大小以填充窗口。"
            onReset={() => onChange({ backgroundImageFit: DEFAULT_APPEARANCE_SETTINGS.backgroundImageFit })}
          >
            <select
              className="appearance-control"
              value={settings.backgroundImageFit}
              onChange={(event) => onChange({ backgroundImageFit: event.target.value as BackgroundImageFit })}
            >
              {BACKGROUND_IMAGE_FIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            title="背景图像对齐"
            description="设置背景图像与窗口边界的对齐方式。"
            onReset={() =>
              onChange({ backgroundImageAlignment: DEFAULT_APPEARANCE_SETTINGS.backgroundImageAlignment })
            }
          >
            <select
              className="appearance-control"
              value={settings.backgroundImageAlignment}
              onChange={(event) =>
                onChange({ backgroundImageAlignment: event.target.value as BackgroundImageAlignment })
              }
            >
              {BACKGROUND_IMAGE_ALIGNMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            title="背景图像不透明度"
            description="控制图片露出程度，不改变 terminal 本身透明度。"
            onReset={() => onChange({ backgroundImageOpacity: DEFAULT_APPEARANCE_SETTINGS.backgroundImageOpacity })}
          >
            <SliderControl
              value={settings.backgroundImageOpacity}
              onChange={(backgroundImageOpacity) => onChange({ backgroundImageOpacity })}
            />
          </SettingRow>

          <SettingRow
            title="终端可读性遮罩"
            description="只控制背景图模式下 terminal 区域的单层 scrim，不改变终端配色方案。"
            onReset={() =>
              onChange({ terminalBackgroundScrimOpacity: DEFAULT_APPEARANCE_SETTINGS.terminalBackgroundScrimOpacity })
            }
          >
            <SliderControl
              value={settings.terminalBackgroundScrimOpacity}
              onChange={(terminalBackgroundScrimOpacity) => onChange({ terminalBackgroundScrimOpacity })}
            />
          </SettingRow>
        </div>

        <div className="appearance-section">
          <h2>透明度</h2>
          <SettingRow
            title="视觉强度"
            description="控制玻璃感、遮罩、模糊和 surface 融合程度。"
            onReset={() => onChange({ intensity: DEFAULT_APPEARANCE_SETTINGS.intensity })}
          >
            <SliderControl value={settings.intensity} onChange={(intensity) => onChange({ intensity })} />
          </SettingRow>

          <SettingRow
            title="启用亚克力材料"
            description="使用半透明 / 模糊材质；关闭后保留布局但移除 blur。"
            onReset={() => onChange({ acrylicEnabled: DEFAULT_APPEARANCE_SETTINGS.acrylicEnabled })}
          >
            <button
              aria-pressed={settings.acrylicEnabled}
              className={`appearance-switch${settings.acrylicEnabled ? " is-on" : ""}`}
              type="button"
              onClick={() => onChange({ acrylicEnabled: !settings.acrylicEnabled })}
            >
              <span>{settings.acrylicEnabled ? "开" : "关"}</span>
            </button>
          </SettingRow>
        </div>

        {statusMessage ? <p className="appearance-status">{statusMessage}</p> : null}

        <footer className="appearance-footer">
          <button className="appearance-secondary-button" type="button" onClick={onReset}>
            Reset Appearance
          </button>
        </footer>
      </section>
    </div>
  );

  function updateTerminalCustomColor(key: TerminalColorKey, value: string) {
    onChange({
      terminalCustomTheme: {
        ...settings.terminalCustomTheme,
        [key]: value,
      },
    });
  }

  function closeOnBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    await onImportImage(file);
  }
}

function FontFamilyControl({
  allowEmpty = false,
  listId,
  options,
  placeholder,
  value,
  onChange,
}: {
  allowEmpty?: boolean;
  listId: string;
  options: FontOption[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="font-family-control">
      <select
        className="appearance-control"
        value={options.some((option) => option.value === value) ? value : "custom"}
        onChange={(event) => {
          if (event.target.value !== "custom") {
            onChange(event.target.value);
          }
        }}
      >
        {options.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>
      <input
        className="appearance-control"
        list={listId}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(allowEmpty ? event.target.value : event.target.value.trimStart())}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.label} value={option.value} label={option.description} />
        ))}
      </datalist>
    </label>
  );
}

function FontWeightControl({
  options,
  value,
  onChange,
}: {
  options: FontOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="appearance-control"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.label} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SettingRow({ title, description, children, onReset }: SettingRowProps) {
  return (
    <div className="appearance-row">
      <span className="appearance-row-copy">
        <span className="appearance-row-title">
          {title}
          {onReset ? (
            <button aria-label={`Reset ${title}`} className="appearance-reset" type="button" onClick={onReset}>
              ↶
            </button>
          ) : null}
        </span>
        <span>{description}</span>
      </span>
      <span className="appearance-row-control">{children}</span>
    </div>
  );
}

function SliderControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const displayValue = Math.round(value * 100);

  return (
    <label className="appearance-slider">
      <input
        max="1"
        min="0"
        step="0.01"
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>{displayValue}%</span>
    </label>
  );
}
