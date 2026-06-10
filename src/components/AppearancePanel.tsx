import { useRef, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import type {
  AppearanceSettings,
  AppearancePreset,
  BackgroundImageAlignment,
  BackgroundImageFit,
} from "../appearance";
import {
  APPEARANCE_PRESET_OPTIONS,
  BACKGROUND_IMAGE_ALIGNMENT_OPTIONS,
  BACKGROUND_IMAGE_FIT_OPTIONS,
  DEFAULT_APPEARANCE_SETTINGS,
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
            <div className="appearance-preview-terminal" />
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
