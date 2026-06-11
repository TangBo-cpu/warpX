export type AppearancePreset =
  | "ivory-glass"
  | "midnight-glass"
  | "acrylic-terminal"
  | "terminal-focus";

export type BackgroundImageFit = "cover" | "contain" | "stretch" | "tile";

export type BackgroundImageAlignment =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type TerminalThemePresetId =
  | "tokyo-night"
  | "campbell"
  | "one-half-dark"
  | "solarized-light";

export type TerminalThemeId = "windows-terminal" | TerminalThemePresetId | "custom";

export type TerminalColorKey =
  | "background"
  | "foreground"
  | "cursor"
  | "selectionBackground"
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "brightBlack"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan"
  | "brightWhite";

export type TerminalColorTheme = Partial<Record<TerminalColorKey, string>>;

export type TerminalThemeSettings = {
  terminalThemeId: TerminalThemeId;
  terminalCustomTheme: TerminalColorTheme;
};

export type AppearanceSettings = TerminalThemeSettings & {
  preset: AppearancePreset;
  intensity: number;
  backgroundImagePath?: string;
  backgroundImageFit: BackgroundImageFit;
  backgroundImageAlignment: BackgroundImageAlignment;
  backgroundImageOpacity: number;
  terminalBackgroundScrimOpacity: number;
  acrylicEnabled: boolean;
};

type Rgb = [number, number, number];

type TerminalThemePreset = {
  label: string;
  description: string;
  colors: Required<TerminalColorTheme>;
};

type PresetRendering = {
  baseColor: string;
  gradient: string;
  vignette: string;
  blurMin: number;
  blurMax: number;
  frame: Rgb;
  terminalPane: Rgb;
  terminalHeader: Rgb;
  sidebar: Rgb;
  sidebarGlow: string;
  card: Rgb;
  cardActive: Rgb;
  elevated: Rgb;
  field: Rgb;
  terminalBufferBg: string;
  terminalBufferGrid: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  borderSubtle: string;
  borderStrong: string;
  borderFrame: string;
  borderPane: string;
  controlBorder: string;
  accentWarm: string;
  accentWarmStrong: string;
  accentCool: string;
  accentSuccess: string;
  accentWarning: string;
  accentDanger: string;
  accentNeutral: string;
  buttonBg: string;
  buttonHoverBg: string;
  buttonFg: string;
  ghostButtonBg: string;
  ghostButtonHoverBg: string;
  emptyText: string;
  shadowFrame: string;
  shadowCard: string;
  frameAlpha: [number, number];
  terminalPaneAlpha: [number, number];
  terminalHeaderAlpha: [number, number];
  sidebarAlpha: [number, number];
  cardAlpha: [number, number];
  cardActiveAlpha: [number, number];
  elevatedAlpha: [number, number];
};

export const APPEARANCE_STORAGE_KEY = "wrapx-appearance";

export const DEFAULT_TERMINAL_THEME_ID: TerminalThemeId = "windows-terminal";

export const TERMINAL_THEME_PRESETS: Record<TerminalThemePresetId, TerminalThemePreset> = {
  "tokyo-night": {
    label: "Tokyo Night",
    description: "Deep blue-purple terminal palette with bright readable accents.",
    colors: {
      background: "#1a1b26",
      foreground: "#c0caf5",
      cursor: "#c0caf5",
      selectionBackground: "#33467c",
      black: "#15161e",
      red: "#f7768e",
      green: "#9ece6a",
      yellow: "#e0af68",
      blue: "#7aa2f7",
      magenta: "#bb9af7",
      cyan: "#7dcfff",
      white: "#a9b1d6",
      brightBlack: "#414868",
      brightRed: "#f7768e",
      brightGreen: "#9ece6a",
      brightYellow: "#e0af68",
      brightBlue: "#7aa2f7",
      brightMagenta: "#bb9af7",
      brightCyan: "#7dcfff",
      brightWhite: "#c0caf5",
    },
  },
  campbell: {
    label: "Campbell",
    description: "Windows Terminal classic dark color scheme.",
    colors: {
      background: "#0c0c0c",
      foreground: "#cccccc",
      cursor: "#ffffff",
      selectionBackground: "#3a3d41",
      black: "#0c0c0c",
      red: "#c50f1f",
      green: "#13a10e",
      yellow: "#c19c00",
      blue: "#0037da",
      magenta: "#881798",
      cyan: "#3a96dd",
      white: "#cccccc",
      brightBlack: "#767676",
      brightRed: "#e74856",
      brightGreen: "#16c60c",
      brightYellow: "#f9f1a5",
      brightBlue: "#3b78ff",
      brightMagenta: "#b4009e",
      brightCyan: "#61d6d6",
      brightWhite: "#f2f2f2",
    },
  },
  "one-half-dark": {
    label: "One Half Dark",
    description: "Balanced dark palette inspired by One Half Dark.",
    colors: {
      background: "#282c34",
      foreground: "#dcdfe4",
      cursor: "#a3b3cc",
      selectionBackground: "#474e5d",
      black: "#282c34",
      red: "#e06c75",
      green: "#98c379",
      yellow: "#e5c07b",
      blue: "#61afef",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: "#dcdfe4",
      brightBlack: "#5a6374",
      brightRed: "#e06c75",
      brightGreen: "#98c379",
      brightYellow: "#e5c07b",
      brightBlue: "#61afef",
      brightMagenta: "#c678dd",
      brightCyan: "#56b6c2",
      brightWhite: "#ffffff",
    },
  },
  "solarized-light": {
    label: "Solarized Light",
    description: "Low-contrast light terminal palette.",
    colors: {
      background: "#fdf6e3",
      foreground: "#657b83",
      cursor: "#586e75",
      selectionBackground: "#eee8d5",
      black: "#073642",
      red: "#dc322f",
      green: "#859900",
      yellow: "#b58900",
      blue: "#268bd2",
      magenta: "#d33682",
      cyan: "#2aa198",
      white: "#eee8d5",
      brightBlack: "#002b36",
      brightRed: "#cb4b16",
      brightGreen: "#586e75",
      brightYellow: "#657b83",
      brightBlue: "#839496",
      brightMagenta: "#6c71c4",
      brightCyan: "#93a1a1",
      brightWhite: "#fdf6e3",
    },
  },
};

export const TERMINAL_THEME_OPTIONS: Array<{
  value: TerminalThemeId;
  label: string;
  description: string;
}> = [
  {
    value: "windows-terminal",
    label: "Windows Terminal",
    description: "Use your active Windows Terminal profile color scheme when available.",
  },
  ...Object.entries(TERMINAL_THEME_PRESETS).map(([value, preset]) => ({
    value: value as TerminalThemePresetId,
    label: preset.label,
    description: preset.description,
  })),
  {
    value: "custom",
    label: "Custom",
    description: "Use the custom terminal colors below.",
  },
];

export const TERMINAL_COLOR_FIELDS: Array<{
  key: TerminalColorKey;
  label: string;
}> = [
  { key: "background", label: "背景" },
  { key: "foreground", label: "前景" },
  { key: "cursor", label: "光标" },
  { key: "selectionBackground", label: "选区" },
  { key: "black", label: "黑" },
  { key: "red", label: "红" },
  { key: "green", label: "绿" },
  { key: "yellow", label: "黄" },
  { key: "blue", label: "蓝" },
  { key: "magenta", label: "紫" },
  { key: "cyan", label: "青" },
  { key: "white", label: "白" },
  { key: "brightBlack", label: "亮黑" },
  { key: "brightRed", label: "亮红" },
  { key: "brightGreen", label: "亮绿" },
  { key: "brightYellow", label: "亮黄" },
  { key: "brightBlue", label: "亮蓝" },
  { key: "brightMagenta", label: "亮紫" },
  { key: "brightCyan", label: "亮青" },
  { key: "brightWhite", label: "亮白" },
];

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  preset: "ivory-glass",
  intensity: 0.45,
  backgroundImageFit: "cover",
  backgroundImageAlignment: "center",
  backgroundImageOpacity: 0.6,
  terminalBackgroundScrimOpacity: 0.18,
  terminalThemeId: DEFAULT_TERMINAL_THEME_ID,
  terminalCustomTheme: TERMINAL_THEME_PRESETS["tokyo-night"].colors,
  acrylicEnabled: true,
};

export const APPEARANCE_PRESET_OPTIONS: Array<{
  value: AppearancePreset;
  label: string;
  description: string;
}> = [
  {
    value: "ivory-glass",
    label: "Ivory Glass",
    description: "Warm paper glass with a dark, readable terminal surface.",
  },
  {
    value: "midnight-glass",
    label: "Midnight Glass",
    description: "Dark cockpit surfaces with restrained blue-purple depth.",
  },
  {
    value: "acrylic-terminal",
    label: "Acrylic Terminal",
    description: "Image-forward Windows acrylic style with stronger blur.",
  },
  {
    value: "terminal-focus",
    label: "Terminal Focus",
    description: "Muted background treatment for long terminal sessions.",
  },
];

export const BACKGROUND_IMAGE_FIT_OPTIONS: Array<{
  value: BackgroundImageFit;
  label: string;
}> = [
  { value: "cover", label: "均匀填充" },
  { value: "contain", label: "均匀适应" },
  { value: "stretch", label: "拉伸填充" },
  { value: "tile", label: "平铺" },
];

export const BACKGROUND_IMAGE_ALIGNMENT_OPTIONS: Array<{
  value: BackgroundImageAlignment;
  label: string;
}> = [
  { value: "center", label: "居中" },
  { value: "top", label: "顶部" },
  { value: "bottom", label: "底部" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
  { value: "top-left", label: "左上" },
  { value: "top-right", label: "右上" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom-right", label: "右下" },
];

const PRESET_RENDERING: Record<AppearancePreset, PresetRendering> = {
  "ivory-glass": {
    baseColor: "#ffffff",
    gradient:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 248, 248, 0.98))",
    vignette: "radial-gradient(circle at center, transparent 60%, rgba(0, 0, 0, 0.03) 100%)",
    blurMin: 6,
    blurMax: 16,
    frame: [255, 255, 255],
    terminalPane: [255, 255, 255],
    terminalHeader: [255, 255, 255],
    sidebar: [250, 250, 250],
    sidebarGlow: "rgba(0, 0, 0, 0)",
    card: [255, 255, 255],
    cardActive: [245, 245, 245],
    elevated: [255, 255, 255],
    field: [255, 255, 255],
    terminalBufferBg: "#101318",
    terminalBufferGrid: "rgba(255, 255, 255, 0.026)",
    textPrimary: "#202124",
    textSecondary: "#5f6368",
    textMuted: "#8a8f98",
    textInverse: "#ffffff",
    borderSubtle: "rgba(17, 24, 39, 0.08)",
    borderStrong: "rgba(17, 24, 39, 0.16)",
    borderFrame: "rgba(17, 24, 39, 0.08)",
    borderPane: "rgba(17, 24, 39, 0.08)",
    controlBorder: "rgba(17, 24, 39, 0.14)",
    accentWarm: "#3b82f6",
    accentWarmStrong: "#1d4ed8",
    accentCool: "#2563eb",
    accentSuccess: "#217247",
    accentWarning: "#b45309",
    accentDanger: "#b91c1c",
    accentNeutral: "#6b7280",
    buttonBg: "rgba(55, 65, 81, 0.9)",
    buttonHoverBg: "rgba(31, 41, 55, 0.95)",
    buttonFg: "#ffffff",
    ghostButtonBg: "rgba(17, 24, 39, 0.04)",
    ghostButtonHoverBg: "rgba(17, 24, 39, 0.08)",
    emptyText: "#8a8f98",
    shadowFrame: "0 18px 48px rgba(0, 0, 0, 0.08)",
    shadowCard: "0 10px 26px rgba(0, 0, 0, 0.08)",
    frameAlpha: [0.98, 0.9],
    terminalPaneAlpha: [0.99, 0.94],
    terminalHeaderAlpha: [0.98, 0.9],
    sidebarAlpha: [0.98, 0.92],
    cardAlpha: [0.99, 0.94],
    cardActiveAlpha: [0.98, 0.96],
    elevatedAlpha: [0.98, 0.95],
  },
  "midnight-glass": {
    baseColor: "#080a12",
    gradient:
      "linear-gradient(135deg, rgba(16, 24, 46, 0.94), rgba(35, 23, 56, 0.78) 48%, rgba(5, 9, 18, 0.96))",
    vignette: "radial-gradient(circle at center, transparent 42%, rgba(0, 0, 0, 0.48) 100%)",
    blurMin: 10,
    blurMax: 24,
    frame: [10, 12, 18],
    terminalPane: [16, 18, 24],
    terminalHeader: [20, 22, 28],
    sidebar: [12, 14, 22],
    sidebarGlow: "rgba(90, 58, 150, 0.26)",
    card: [24, 26, 36],
    cardActive: [53, 42, 70],
    elevated: [24, 25, 34],
    field: [12, 13, 19],
    terminalBufferBg: "#070910",
    terminalBufferGrid: "rgba(255, 255, 255, 0.022)",
    textPrimary: "#f4efe6",
    textSecondary: "#cfc6b9",
    textMuted: "#9b8f82",
    textInverse: "#20150d",
    borderSubtle: "rgba(96, 88, 111, 0.64)",
    borderStrong: "rgba(181, 138, 255, 0.7)",
    borderFrame: "rgba(104, 98, 121, 0.48)",
    borderPane: "rgba(78, 72, 96, 0.7)",
    controlBorder: "rgba(135, 112, 174, 0.62)",
    accentWarm: "#ffbf6e",
    accentWarmStrong: "#ffcf8c",
    accentCool: "#82c7ff",
    accentSuccess: "#5ee39f",
    accentWarning: "#ffbf6e",
    accentDanger: "#ff9d93",
    accentNeutral: "#9f978d",
    buttonBg: "rgba(91, 72, 144, 0.86)",
    buttonHoverBg: "rgba(118, 92, 183, 0.94)",
    buttonFg: "#f4efe6",
    ghostButtonBg: "rgba(255, 255, 255, 0.06)",
    ghostButtonHoverBg: "rgba(255, 255, 255, 0.11)",
    emptyText: "#8f879d",
    shadowFrame: "0 34px 100px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    shadowCard: "0 10px 30px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.07)",
    frameAlpha: [0.96, 0.72],
    terminalPaneAlpha: [0.94, 0.84],
    terminalHeaderAlpha: [0.94, 0.7],
    sidebarAlpha: [0.94, 0.62],
    cardAlpha: [0.96, 0.74],
    cardActiveAlpha: [0.94, 0.82],
    elevatedAlpha: [0.94, 0.78],
  },
  "acrylic-terminal": {
    baseColor: "#eaf3ff",
    gradient:
      "linear-gradient(135deg, rgba(214, 233, 255, 0.82), rgba(255, 231, 203, 0.52) 45%, rgba(235, 247, 255, 0.92))",
    vignette: "radial-gradient(circle at center, transparent 46%, rgba(38, 66, 105, 0.2) 100%)",
    blurMin: 14,
    blurMax: 30,
    frame: [246, 250, 255],
    terminalPane: [244, 249, 255],
    terminalHeader: [247, 251, 255],
    sidebar: [242, 248, 255],
    sidebarGlow: "rgba(110, 178, 255, 0.3)",
    card: [252, 254, 255],
    cardActive: [226, 242, 255],
    elevated: [248, 252, 255],
    field: [255, 255, 255],
    terminalBufferBg: "#05070d",
    terminalBufferGrid: "rgba(255, 255, 255, 0.024)",
    textPrimary: "#17212d",
    textSecondary: "#485769",
    textMuted: "#738094",
    textInverse: "#f6f9ff",
    borderSubtle: "rgba(130, 159, 193, 0.62)",
    borderStrong: "rgba(63, 126, 185, 0.78)",
    borderFrame: "rgba(143, 173, 207, 0.68)",
    borderPane: "rgba(122, 152, 188, 0.74)",
    controlBorder: "rgba(102, 139, 181, 0.66)",
    accentWarm: "#a45e17",
    accentWarmStrong: "#85460d",
    accentCool: "#1d6fa9",
    accentSuccess: "#20734b",
    accentWarning: "#a45e17",
    accentDanger: "#a43f36",
    accentNeutral: "#657487",
    buttonBg: "rgba(44, 110, 171, 0.9)",
    buttonHoverBg: "rgba(23, 85, 145, 0.96)",
    buttonFg: "#f7fbff",
    ghostButtonBg: "rgba(52, 91, 132, 0.09)",
    ghostButtonHoverBg: "rgba(44, 110, 171, 0.15)",
    emptyText: "#738094",
    shadowFrame: "0 34px 90px rgba(49, 91, 135, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.78)",
    shadowCard: "0 10px 28px rgba(58, 105, 148, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.74)",
    frameAlpha: [0.92, 0.58],
    terminalPaneAlpha: [0.94, 0.78],
    terminalHeaderAlpha: [0.9, 0.52],
    sidebarAlpha: [0.88, 0.46],
    cardAlpha: [0.94, 0.62],
    cardActiveAlpha: [0.94, 0.72],
    elevatedAlpha: [0.92, 0.64],
  },
  "terminal-focus": {
    baseColor: "#16130f",
    gradient:
      "linear-gradient(135deg, rgba(44, 32, 23, 0.92), rgba(17, 24, 33, 0.82) 48%, rgba(12, 10, 8, 0.96))",
    vignette: "radial-gradient(circle at center, transparent 36%, rgba(0, 0, 0, 0.58) 100%)",
    blurMin: 4,
    blurMax: 14,
    frame: [18, 16, 13],
    terminalPane: [18, 18, 17],
    terminalHeader: [30, 26, 21],
    sidebar: [24, 21, 17],
    sidebarGlow: "rgba(168, 105, 41, 0.16)",
    card: [33, 29, 24],
    cardActive: [68, 42, 23],
    elevated: [35, 29, 23],
    field: [16, 14, 12],
    terminalBufferBg: "#050607",
    terminalBufferGrid: "rgba(255, 255, 255, 0.018)",
    textPrimary: "#f4efe6",
    textSecondary: "#c8bfb2",
    textMuted: "#94887a",
    textInverse: "#20150d",
    borderSubtle: "rgba(82, 68, 54, 0.72)",
    borderStrong: "rgba(177, 103, 38, 0.78)",
    borderFrame: "rgba(82, 68, 54, 0.58)",
    borderPane: "rgba(64, 54, 45, 0.78)",
    controlBorder: "rgba(120, 78, 42, 0.7)",
    accentWarm: "#ffbf6e",
    accentWarmStrong: "#ffcf8c",
    accentCool: "#82c7ff",
    accentSuccess: "#5ee39f",
    accentWarning: "#ffbf6e",
    accentDanger: "#ff9d93",
    accentNeutral: "#9f978d",
    buttonBg: "rgba(86, 47, 20, 0.82)",
    buttonHoverBg: "rgba(112, 62, 27, 0.92)",
    buttonFg: "#f4efe6",
    ghostButtonBg: "rgba(255, 255, 255, 0.05)",
    ghostButtonHoverBg: "rgba(255, 255, 255, 0.1)",
    emptyText: "#8a8074",
    shadowFrame: "0 34px 100px rgba(0, 0, 0, 0.64), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    shadowCard: "0 10px 30px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.07)",
    frameAlpha: [0.98, 0.84],
    terminalPaneAlpha: [0.98, 0.92],
    terminalHeaderAlpha: [0.96, 0.82],
    sidebarAlpha: [0.96, 0.76],
    cardAlpha: [0.98, 0.84],
    cardActiveAlpha: [0.96, 0.88],
    elevatedAlpha: [0.96, 0.84],
  },
};

export function getInitialAppearanceSettings(): AppearanceSettings {
  const storedAppearance = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (!storedAppearance) {
    return DEFAULT_APPEARANCE_SETTINGS;
  }

  try {
    return normalizeAppearanceSettings(JSON.parse(storedAppearance));
  } catch {
    return DEFAULT_APPEARANCE_SETTINGS;
  }
}

export function saveAppearanceSettings(settings: AppearanceSettings) {
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
}

export function normalizeAppearanceSettings(value: Partial<AppearanceSettings>): AppearanceSettings {
  return {
    preset: isAppearancePreset(value.preset) ? value.preset : DEFAULT_APPEARANCE_SETTINGS.preset,
    intensity: clamp01(value.intensity, DEFAULT_APPEARANCE_SETTINGS.intensity),
    backgroundImagePath: nonEmptyString(value.backgroundImagePath),
    backgroundImageFit: isBackgroundImageFit(value.backgroundImageFit)
      ? value.backgroundImageFit
      : DEFAULT_APPEARANCE_SETTINGS.backgroundImageFit,
    backgroundImageAlignment: isBackgroundImageAlignment(value.backgroundImageAlignment)
      ? value.backgroundImageAlignment
      : DEFAULT_APPEARANCE_SETTINGS.backgroundImageAlignment,
    backgroundImageOpacity: clamp01(
      value.backgroundImageOpacity,
      DEFAULT_APPEARANCE_SETTINGS.backgroundImageOpacity,
    ),
    terminalBackgroundScrimOpacity: clamp01(
      value.terminalBackgroundScrimOpacity,
      DEFAULT_APPEARANCE_SETTINGS.terminalBackgroundScrimOpacity,
    ),
    terminalThemeId: isTerminalThemeId(value.terminalThemeId)
      ? value.terminalThemeId
      : DEFAULT_APPEARANCE_SETTINGS.terminalThemeId,
    terminalCustomTheme: normalizeTerminalCustomTheme(value.terminalCustomTheme),
    acrylicEnabled:
      typeof value.acrylicEnabled === "boolean"
        ? value.acrylicEnabled
        : DEFAULT_APPEARANCE_SETTINGS.acrylicEnabled,
  };
}

export function resolveTerminalThemeColors(
  settings: TerminalThemeSettings,
  windowsTerminalTheme?: TerminalColorTheme | null,
): TerminalColorTheme {
  if (settings.terminalThemeId === "custom") {
    return settings.terminalCustomTheme;
  }

  if (settings.terminalThemeId === "windows-terminal") {
    return {
      ...TERMINAL_THEME_PRESETS["tokyo-night"].colors,
      ...(hasTerminalThemeColors(windowsTerminalTheme) ? windowsTerminalTheme : {}),
    };
  }

  return TERMINAL_THEME_PRESETS[settings.terminalThemeId].colors;
}

export function normalizeTerminalCustomTheme(value: unknown): TerminalColorTheme {
  const themeValue = isRecord(value) ? value : {};
  return Object.fromEntries(
    TERMINAL_COLOR_FIELDS.map(({ key }) => [
      key,
      normalizeHexColor(themeValue[key], TERMINAL_THEME_PRESETS["tokyo-night"].colors[key]),
    ]),
  ) as TerminalColorTheme;
}

export function resolveAppearanceCssVariables(
  settings: AppearanceSettings,
  backgroundImageUrl?: string,
): Record<string, string> {
  const preset = PRESET_RENDERING[settings.preset];
  const intensity = clamp01(settings.intensity);
  const backgroundImageOpacity = backgroundImageUrl ? clamp01(settings.backgroundImageOpacity) : 0;
  const terminalBackgroundScrimOpacity = clamp01(settings.terminalBackgroundScrimOpacity);
  const blurPx = settings.acrylicEnabled ? lerp(preset.blurMin, preset.blurMax, intensity) : 0;
  const imageBlurPx = 0;
  const crispLightImage = Boolean(backgroundImageUrl && settings.preset === "ivory-glass");
  const surfaceBlurPx = backgroundImageUrl ? (crispLightImage ? 0 : Math.min(3, blurPx * 0.18)) : blurPx;
  const imageLayout = backgroundImageLayout(settings.backgroundImageFit, settings.backgroundImageAlignment);
  const frameAlpha = softenSurfaceAlpha(
    lerpPair(preset.frameAlpha, intensity),
    backgroundImageOpacity,
    crispLightImage ? 1.65 : 1.35,
    crispLightImage ? 0.14 : 0.28,
  );
  const terminalPaneBaseAlpha = lerpPair(preset.terminalPaneAlpha, intensity);
  const terminalPaneAlpha = softenSurfaceAlpha(
    terminalPaneBaseAlpha,
    backgroundImageOpacity,
    crispLightImage ? 0.62 : 0.45,
    crispLightImage ? 0.44 : 0.52,
  );
  const terminalPaneEndAlpha = softenSurfaceAlpha(
    Math.max(0.78, terminalPaneBaseAlpha - 0.04),
    backgroundImageOpacity,
    crispLightImage ? 0.5 : 0.35,
    crispLightImage ? 0.4 : 0.48,
  );
  const terminalHeaderAlpha = softenSurfaceAlpha(
    lerpPair(preset.terminalHeaderAlpha, intensity),
    backgroundImageOpacity,
    crispLightImage ? 0.9 : 0.7,
    crispLightImage ? 0.22 : 0.34,
  );
  const sidebarAlpha = softenSurfaceAlpha(
    lerpPair(preset.sidebarAlpha, intensity),
    backgroundImageOpacity,
    crispLightImage ? 1.15 : 0.9,
    crispLightImage ? 0.22 : 0.3,
  );
  const cardAlpha = softenSurfaceAlpha(
    lerpPair(preset.cardAlpha, intensity),
    backgroundImageOpacity,
    crispLightImage ? 1.05 : 0.9,
    crispLightImage ? 0.26 : 0.3,
  );
  const cardActiveAlpha = softenSurfaceAlpha(
    lerpPair(preset.cardActiveAlpha, intensity),
    backgroundImageOpacity,
    crispLightImage ? 0.82 : 0.65,
    crispLightImage ? 0.34 : 0.4,
  );
  const elevatedAlpha = softenSurfaceAlpha(
    lerpPair(preset.elevatedAlpha, intensity),
    backgroundImageOpacity,
    crispLightImage ? 0.95 : 0.75,
    crispLightImage ? 0.26 : 0.32,
  );
  const terminalShellOverlayTopAlpha = softenSurfaceAlpha(
    Math.max(0.2, terminalPaneBaseAlpha - 0.34),
    backgroundImageOpacity,
    crispLightImage ? 0.9 : 0.75,
    crispLightImage ? 0.04 : 0.08,
  );
  const terminalShellOverlayBottomAlpha = softenSurfaceAlpha(
    Math.max(0.16, terminalPaneBaseAlpha - 0.46),
    backgroundImageOpacity,
    crispLightImage ? 0.78 : 0.65,
    crispLightImage ? 0.03 : 0.06,
  );
  const topbarAlpha = crispLightImage ? 0.62 : Math.min(0.98, frameAlpha + 0.04);
  const topbarSessionAlpha = crispLightImage ? 0.2 : 0.05;
  const topbarControlAlpha = crispLightImage ? 0.18 : 0.035;
  const topbarMenuAlpha = crispLightImage ? 0.9 : 0.98;
  const topbarBlurPx = crispLightImage ? 0 : 14;
  const topbarMenuBlurPx = crispLightImage ? 0 : 16;

  return {
    "--appearance-base-color": preset.baseColor,
    "--appearance-gradient": preset.gradient,
    "--appearance-vignette": preset.vignette,
    "--appearance-blur": `${blurPx.toFixed(1)}px`,
    "--appearance-surface-blur": `${surfaceBlurPx.toFixed(1)}px`,
    "--appearance-image-blur": `${imageBlurPx.toFixed(1)}px`,
    "--appearance-preview-blur": `${imageBlurPx.toFixed(1)}px`,
    "--appearance-image": backgroundImageUrl ? cssUrl(backgroundImageUrl) : "none",
    "--appearance-image-opacity": backgroundImageUrl ? String(backgroundImageOpacity) : "0",
    "--appearance-image-size": imageLayout.size,
    "--appearance-image-position": imageLayout.position,
    "--appearance-image-repeat": imageLayout.repeat,
    "--appearance-surface-reveal": String(backgroundImageOpacity),
    "--terminal-shell-overlay-top": rgba(preset.terminalPane, terminalShellOverlayTopAlpha),
    "--terminal-shell-overlay-bottom": rgba(preset.terminalPane, terminalShellOverlayBottomAlpha),
    "--terminal-background-scrim": rgba([0, 0, 0], terminalBackgroundScrimOpacity),
    "--app-background": "var(--appearance-vignette), var(--appearance-gradient), var(--appearance-base-color)",
    "--surface-app": preset.baseColor,
    "--surface-frame": rgba(preset.frame, frameAlpha),
    "--surface-terminal": preset.terminalBufferBg,
    "--surface-sidebar": rgba(preset.sidebar, sidebarAlpha),
    "--surface-card": rgba(preset.card, cardAlpha),
    "--surface-card-active": rgba(preset.cardActive, cardActiveAlpha),
    "--surface-elevated": rgba(preset.elevated, elevatedAlpha),
    "--text-primary": preset.textPrimary,
    "--text-secondary": preset.textSecondary,
    "--text-muted": preset.textMuted,
    "--text-inverse": preset.textInverse,
    "--border-subtle": preset.borderSubtle,
    "--border-strong": preset.borderStrong,
    "--border-frame": preset.borderFrame,
    "--border-pane": preset.borderPane,
    "--control-border": preset.controlBorder,
    "--accent-warm": preset.accentWarm,
    "--accent-warm-strong": preset.accentWarmStrong,
    "--accent-cool": preset.accentCool,
    "--accent-success": preset.accentSuccess,
    "--accent-warning": preset.accentWarning,
    "--accent-danger": preset.accentDanger,
    "--accent-neutral": preset.accentNeutral,
    "--frame-background": rgba(preset.frame, frameAlpha),
    "--terminal-pane-background": `linear-gradient(180deg, ${rgba(
      preset.terminalPane,
      terminalPaneAlpha,
    )}, ${rgba(preset.terminalPane, terminalPaneEndAlpha)})`,
    "--terminal-titlebar-bg": rgba(preset.terminalHeader, terminalHeaderAlpha),
    "--terminal-tab-bg": `linear-gradient(180deg, ${rgba(
      preset.terminalHeader,
      Math.min(0.98, terminalHeaderAlpha + 0.08),
    )}, ${rgba(preset.terminalHeader, terminalHeaderAlpha)})`,
    "--terminal-tab-border-bottom": rgba(preset.terminalHeader, terminalHeaderAlpha),
    "--terminal-buffer-bg": preset.terminalBufferBg,
    "--terminal-buffer-grid": preset.terminalBufferGrid,
    "--sidebar-background": `radial-gradient(circle at 50% 100%, ${preset.sidebarGlow}, transparent 34%), linear-gradient(180deg, ${rgba(
      preset.sidebar,
      Math.min(0.98, sidebarAlpha + 0.08),
    )}, ${rgba(preset.sidebar, sidebarAlpha)})`,
    "--field-bg": rgba(preset.field, settings.preset === "midnight-glass" || settings.preset === "terminal-focus" ? 0.78 : 0.88),
    "--field-border": preset.controlBorder,
    "--button-bg": preset.buttonBg,
    "--button-hover-bg": preset.buttonHoverBg,
    "--button-fg": preset.buttonFg,
    "--ghost-button-bg": preset.ghostButtonBg,
    "--ghost-button-hover-bg": preset.ghostButtonHoverBg,
    "--empty-text": preset.emptyText,
    "--shadow-frame": preset.shadowFrame,
    "--shadow-card": preset.shadowCard,
    "--topbar-background": rgba(preset.frame, topbarAlpha),
    "--topbar-session-bg": rgba(preset.frame, topbarSessionAlpha),
    "--topbar-control-bg": rgba(preset.frame, topbarControlAlpha),
    "--topbar-menu-bg": rgba(preset.frame, topbarMenuAlpha),
    "--topbar-blur": `${topbarBlurPx}px`,
    "--topbar-menu-blur": `${topbarMenuBlurPx}px`,
  };
}

function isAppearancePreset(value: unknown): value is AppearancePreset {
  return typeof value === "string" && APPEARANCE_PRESET_OPTIONS.some((option) => option.value === value);
}

function isBackgroundImageFit(value: unknown): value is BackgroundImageFit {
  return typeof value === "string" && BACKGROUND_IMAGE_FIT_OPTIONS.some((option) => option.value === value);
}

function isBackgroundImageAlignment(value: unknown): value is BackgroundImageAlignment {
  return (
    typeof value === "string" &&
    BACKGROUND_IMAGE_ALIGNMENT_OPTIONS.some((option) => option.value === value)
  );
}

function isTerminalThemeId(value: unknown): value is TerminalThemeId {
  return typeof value === "string" && TERMINAL_THEME_OPTIONS.some((option) => option.value === value);
}

function hasTerminalThemeColors(value: unknown): value is TerminalColorTheme {
  return isRecord(value) && TERMINAL_COLOR_FIELDS.some(({ key }) => typeof value[key] === "string");
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const color = value.trim();
  if (/^#[\da-f]{6}$/i.test(color)) {
    return color;
  }

  if (/^#[\da-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function clamp01(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function lerpPair([start, end]: [number, number], amount: number) {
  return lerp(start, end, amount);
}

function softenSurfaceAlpha(alpha: number, backgroundImageOpacity: number, amount: number, minimum: number) {
  return Math.max(minimum, alpha - backgroundImageOpacity * amount);
}

function rgba([red, green, blue]: Rgb, alpha: number) {
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
}

function backgroundImageLayout(fit: BackgroundImageFit, alignment: BackgroundImageAlignment) {
  const size = fit === "stretch" ? "100% 100%" : fit === "tile" ? "auto" : fit;
  const repeat = fit === "tile" ? "repeat" : "no-repeat";
  return {
    size,
    repeat,
    position: backgroundPosition(alignment),
  };
}

function backgroundPosition(alignment: BackgroundImageAlignment) {
  switch (alignment) {
    case "top":
      return "center top";
    case "bottom":
      return "center bottom";
    case "left":
      return "left center";
    case "right":
      return "right center";
    case "top-left":
      return "left top";
    case "top-right":
      return "right top";
    case "bottom-left":
      return "left bottom";
    case "bottom-right":
      return "right bottom";
    case "center":
    default:
      return "center center";
  }
}

function cssUrl(value: string) {
  return `url("${value.replace(/\\/g, "/").replace(/"/g, '\\"')}")`;
}
