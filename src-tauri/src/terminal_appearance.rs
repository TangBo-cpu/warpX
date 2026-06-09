use serde::Serialize;
use serde_json::{Map, Value};
use std::env;
use std::fs;
use std::path::PathBuf;

const MIN_FONT_SIZE: f64 = 6.0;
const MAX_FONT_SIZE: f64 = 72.0;
const MIN_LINE_HEIGHT: f64 = 0.8;
const MAX_LINE_HEIGHT: f64 = 2.0;

const COLOR_MAPPINGS: &[(&str, &str)] = &[
    ("background", "background"),
    ("foreground", "foreground"),
    ("cursorColor", "cursor"),
    ("selectionBackground", "selectionBackground"),
    ("black", "black"),
    ("red", "red"),
    ("green", "green"),
    ("yellow", "yellow"),
    ("blue", "blue"),
    ("purple", "magenta"),
    ("cyan", "cyan"),
    ("white", "white"),
    ("brightBlack", "brightBlack"),
    ("brightRed", "brightRed"),
    ("brightGreen", "brightGreen"),
    ("brightYellow", "brightYellow"),
    ("brightBlue", "brightBlue"),
    ("brightPurple", "brightMagenta"),
    ("brightCyan", "brightCyan"),
    ("brightWhite", "brightWhite"),
];

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfileAppearance {
    #[serde(skip_serializing_if = "Option::is_none")]
    profile_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    color_scheme: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    font_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    font_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    font_weight: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    line_height: Option<f64>,
    theme: TerminalColorTheme,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalColorTheme {
    #[serde(skip_serializing_if = "Option::is_none")]
    background: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    foreground: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    selection_background: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    black: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    red: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    green: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    yellow: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    blue: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    magenta: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cyan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    white: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bright_black: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bright_red: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bright_green: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bright_yellow: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bright_blue: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bright_magenta: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bright_cyan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bright_white: Option<String>,
}

pub fn load_windows_terminal_appearance() -> Option<TerminalProfileAppearance> {
    for path in settings_paths() {
        let Ok(settings_json) = fs::read_to_string(path) else {
            continue;
        };
        let Some(settings) = parse_settings(&settings_json) else {
            continue;
        };
        if let Some(appearance) = appearance_from_settings(&settings) {
            return Some(appearance);
        }
    }

    None
}

fn settings_paths() -> Vec<PathBuf> {
    let Some(local_app_data) = env::var_os("LOCALAPPDATA") else {
        return Vec::new();
    };

    let local_app_data = PathBuf::from(local_app_data);
    vec![
        local_app_data
            .join("Microsoft")
            .join("Windows Terminal")
            .join("settings.json"),
        local_app_data
            .join("Packages")
            .join("Microsoft.WindowsTerminal_8wekyb3d8bbwe")
            .join("LocalState")
            .join("settings.json"),
        local_app_data
            .join("Packages")
            .join("Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe")
            .join("LocalState")
            .join("settings.json"),
    ]
}

fn parse_settings(contents: &str) -> Option<Value> {
    let contents = contents.trim_start_matches('\u{feff}');
    serde_json::from_str(contents)
        .or_else(|_| serde_json::from_str(&strip_jsonc(contents)))
        .ok()
}

fn appearance_from_settings(settings: &Value) -> Option<TerminalProfileAppearance> {
    let profiles = settings.get("profiles")?.as_object()?;
    let defaults = profiles.get("defaults").and_then(Value::as_object);
    let profile = selected_profile(settings, profiles)?;

    let color_scheme = merged_color_scheme(settings, profile, defaults);
    let mut theme = color_scheme
        .as_deref()
        .and_then(|scheme_name| color_scheme_theme(settings, scheme_name))
        .unwrap_or_default();
    apply_color_overrides(&mut theme, defaults);
    apply_color_overrides(&mut theme, Some(profile));

    Some(TerminalProfileAppearance {
        profile_name: string_field(profile, "name"),
        color_scheme,
        font_family: merged_font_string(profile, defaults, "face", "fontFace"),
        font_size: terminal_font_size(merged_font_number(profile, defaults, "size", "fontSize")),
        font_weight: merged_font_value(profile, defaults, "weight", "fontWeight"),
        line_height: terminal_line_height(merged_font_number(
            profile,
            defaults,
            "cellHeight",
            "fontCellHeight",
        )),
        theme,
    })
}

fn selected_profile<'a>(
    settings: &Value,
    profiles: &'a Map<String, Value>,
) -> Option<&'a Map<String, Value>> {
    let list = profiles.get("list")?.as_array()?;
    let default_profile_id = settings
        .get("defaultProfile")
        .and_then(Value::as_str)
        .map(|value| value.to_ascii_lowercase());

    let default_profile = default_profile_id
        .as_deref()
        .and_then(|default_profile_id| {
            list.iter().find_map(|profile| {
                let profile = profile.as_object()?;
                let guid = string_field(profile, "guid")?.to_ascii_lowercase();
                (guid == default_profile_id).then_some(profile)
            })
        });

    if let Some(profile) = default_profile.filter(|profile| is_powershell_profile(profile)) {
        return Some(profile);
    }

    list.iter()
        .filter_map(Value::as_object)
        .find(|profile| {
            let name = string_field(profile, "name")
                .unwrap_or_default()
                .to_ascii_lowercase();
            name == "powershell" || name == "windows powershell"
        })
        .or_else(|| {
            list.iter()
                .filter_map(Value::as_object)
                .find(|profile| is_powershell_profile(profile))
        })
        .or(default_profile)
        .or_else(|| list.iter().find_map(Value::as_object))
}

fn is_powershell_profile(profile: &Map<String, Value>) -> bool {
    ["name", "source", "commandline"].iter().any(|key| {
        string_field(profile, key)
            .map(|value| {
                let value = value.to_ascii_lowercase();
                value.contains("powershell") || value.contains("pwsh")
            })
            .unwrap_or(false)
    })
}

fn color_scheme_theme(settings: &Value, name: &str) -> Option<TerminalColorTheme> {
    settings
        .get("schemes")
        .and_then(Value::as_array)
        .and_then(|schemes| {
            schemes
                .iter()
                .filter_map(Value::as_object)
                .find(|scheme| {
                    string_field(scheme, "name")
                        .is_some_and(|scheme_name| scheme_name.eq_ignore_ascii_case(name))
                })
                .map(theme_from_scheme)
        })
        .or_else(|| built_in_color_scheme(name))
}

fn theme_from_scheme(scheme: &Map<String, Value>) -> TerminalColorTheme {
    let mut theme = TerminalColorTheme::default();
    apply_color_map(&mut theme, scheme, COLOR_MAPPINGS);
    theme
}

fn built_in_color_scheme(name: &str) -> Option<TerminalColorTheme> {
    let colors: &[(&str, &str)] = match name.trim().to_ascii_lowercase().as_str() {
        "campbell" => &[
            ("foreground", "#CCCCCC"),
            ("background", "#0C0C0C"),
            ("black", "#0C0C0C"),
            ("red", "#C50F1F"),
            ("green", "#13A10E"),
            ("yellow", "#C19C00"),
            ("blue", "#0037DA"),
            ("magenta", "#881798"),
            ("cyan", "#3A96DD"),
            ("white", "#CCCCCC"),
            ("brightBlack", "#767676"),
            ("brightRed", "#E74856"),
            ("brightGreen", "#16C60C"),
            ("brightYellow", "#F9F1A5"),
            ("brightBlue", "#3B78FF"),
            ("brightMagenta", "#B4009E"),
            ("brightCyan", "#61D6D6"),
            ("brightWhite", "#F2F2F2"),
        ],
        "campbell powershell" => &[
            ("foreground", "#CCCCCC"),
            ("background", "#012456"),
            ("black", "#0C0C0C"),
            ("red", "#C50F1F"),
            ("green", "#13A10E"),
            ("yellow", "#C19C00"),
            ("blue", "#0037DA"),
            ("magenta", "#881798"),
            ("cyan", "#3A96DD"),
            ("white", "#CCCCCC"),
            ("brightBlack", "#767676"),
            ("brightRed", "#E74856"),
            ("brightGreen", "#16C60C"),
            ("brightYellow", "#F9F1A5"),
            ("brightBlue", "#3B78FF"),
            ("brightMagenta", "#B4009E"),
            ("brightCyan", "#61D6D6"),
            ("brightWhite", "#F2F2F2"),
        ],
        "one half dark" => &[
            ("foreground", "#DCDFE4"),
            ("background", "#282C34"),
            ("black", "#282C34"),
            ("red", "#E06C75"),
            ("green", "#98C379"),
            ("yellow", "#E5C07B"),
            ("blue", "#61AFEF"),
            ("magenta", "#C678DD"),
            ("cyan", "#56B6C2"),
            ("white", "#DCDFE4"),
            ("brightBlack", "#5A6374"),
            ("brightRed", "#E06C75"),
            ("brightGreen", "#98C379"),
            ("brightYellow", "#E5C07B"),
            ("brightBlue", "#61AFEF"),
            ("brightMagenta", "#C678DD"),
            ("brightCyan", "#56B6C2"),
            ("brightWhite", "#DCDFE4"),
        ],
        "one half light" => &[
            ("foreground", "#383A42"),
            ("background", "#FAFAFA"),
            ("black", "#383A42"),
            ("red", "#E45649"),
            ("green", "#50A14F"),
            ("yellow", "#C18301"),
            ("blue", "#0184BC"),
            ("magenta", "#A626A4"),
            ("cyan", "#0997B3"),
            ("white", "#FAFAFA"),
            ("brightBlack", "#4F525D"),
            ("brightRed", "#DF6C75"),
            ("brightGreen", "#98C379"),
            ("brightYellow", "#E4C07A"),
            ("brightBlue", "#61AFEF"),
            ("brightMagenta", "#C577DD"),
            ("brightCyan", "#56B5C1"),
            ("brightWhite", "#FFFFFF"),
        ],
        "solarized dark" => &[
            ("foreground", "#839496"),
            ("background", "#002B36"),
            ("black", "#073642"),
            ("red", "#DC322F"),
            ("green", "#859900"),
            ("yellow", "#B58900"),
            ("blue", "#268BD2"),
            ("magenta", "#D33682"),
            ("cyan", "#2AA198"),
            ("white", "#EEE8D5"),
            ("brightBlack", "#002B36"),
            ("brightRed", "#CB4B16"),
            ("brightGreen", "#586E75"),
            ("brightYellow", "#657B83"),
            ("brightBlue", "#839496"),
            ("brightMagenta", "#6C71C4"),
            ("brightCyan", "#93A1A1"),
            ("brightWhite", "#FDF6E3"),
        ],
        "solarized light" => &[
            ("foreground", "#657B83"),
            ("background", "#FDF6E3"),
            ("black", "#073642"),
            ("red", "#DC322F"),
            ("green", "#859900"),
            ("yellow", "#B58900"),
            ("blue", "#268BD2"),
            ("magenta", "#D33682"),
            ("cyan", "#2AA198"),
            ("white", "#EEE8D5"),
            ("brightBlack", "#002B36"),
            ("brightRed", "#CB4B16"),
            ("brightGreen", "#586E75"),
            ("brightYellow", "#657B83"),
            ("brightBlue", "#839496"),
            ("brightMagenta", "#6C71C4"),
            ("brightCyan", "#93A1A1"),
            ("brightWhite", "#FDF6E3"),
        ],
        "tango dark" => &[
            ("foreground", "#D3D7CF"),
            ("background", "#000000"),
            ("black", "#000000"),
            ("red", "#CC0000"),
            ("green", "#4E9A06"),
            ("yellow", "#C4A000"),
            ("blue", "#3465A4"),
            ("magenta", "#75507B"),
            ("cyan", "#06989A"),
            ("white", "#D3D7CF"),
            ("brightBlack", "#555753"),
            ("brightRed", "#EF2929"),
            ("brightGreen", "#8AE234"),
            ("brightYellow", "#FCE94F"),
            ("brightBlue", "#729FCF"),
            ("brightMagenta", "#AD7FA8"),
            ("brightCyan", "#34E2E2"),
            ("brightWhite", "#EEEEEC"),
        ],
        "tango light" => &[
            ("foreground", "#555753"),
            ("background", "#FFFFFF"),
            ("black", "#000000"),
            ("red", "#CC0000"),
            ("green", "#4E9A06"),
            ("yellow", "#C4A000"),
            ("blue", "#3465A4"),
            ("magenta", "#75507B"),
            ("cyan", "#06989A"),
            ("white", "#D3D7CF"),
            ("brightBlack", "#555753"),
            ("brightRed", "#EF2929"),
            ("brightGreen", "#8AE234"),
            ("brightYellow", "#FCE94F"),
            ("brightBlue", "#729FCF"),
            ("brightMagenta", "#AD7FA8"),
            ("brightCyan", "#34E2E2"),
            ("brightWhite", "#EEEEEC"),
        ],
        "vintage" => &[
            ("foreground", "#C0C0C0"),
            ("background", "#000000"),
            ("black", "#000000"),
            ("red", "#800000"),
            ("green", "#008000"),
            ("yellow", "#808000"),
            ("blue", "#000080"),
            ("magenta", "#800080"),
            ("cyan", "#008080"),
            ("white", "#C0C0C0"),
            ("brightBlack", "#808080"),
            ("brightRed", "#FF0000"),
            ("brightGreen", "#00FF00"),
            ("brightYellow", "#FFFF00"),
            ("brightBlue", "#0000FF"),
            ("brightMagenta", "#FF00FF"),
            ("brightCyan", "#00FFFF"),
            ("brightWhite", "#FFFFFF"),
        ],
        _ => return None,
    };

    let mut theme = TerminalColorTheme::default();
    for (key, color) in colors {
        set_theme_color(&mut theme, key, (*color).to_owned());
    }
    Some(theme)
}

fn apply_color_overrides(theme: &mut TerminalColorTheme, source: Option<&Map<String, Value>>) {
    let Some(source) = source else {
        return;
    };

    apply_color_map(
        theme,
        source,
        &[
            ("background", "background"),
            ("foreground", "foreground"),
            ("cursorColor", "cursor"),
            ("selectionBackground", "selectionBackground"),
        ],
    );
}

fn apply_color_map(
    theme: &mut TerminalColorTheme,
    source: &Map<String, Value>,
    mappings: &[(&str, &str)],
) {
    for (source_key, theme_key) in mappings {
        if let Some(color) = string_field(source, source_key) {
            set_theme_color(theme, theme_key, color);
        }
    }
}

fn set_theme_color(theme: &mut TerminalColorTheme, key: &str, value: String) {
    match key {
        "background" => theme.background = Some(value),
        "foreground" => theme.foreground = Some(value),
        "cursor" => theme.cursor = Some(value),
        "selectionBackground" => theme.selection_background = Some(value),
        "black" => theme.black = Some(value),
        "red" => theme.red = Some(value),
        "green" => theme.green = Some(value),
        "yellow" => theme.yellow = Some(value),
        "blue" => theme.blue = Some(value),
        "magenta" => theme.magenta = Some(value),
        "cyan" => theme.cyan = Some(value),
        "white" => theme.white = Some(value),
        "brightBlack" => theme.bright_black = Some(value),
        "brightRed" => theme.bright_red = Some(value),
        "brightGreen" => theme.bright_green = Some(value),
        "brightYellow" => theme.bright_yellow = Some(value),
        "brightBlue" => theme.bright_blue = Some(value),
        "brightMagenta" => theme.bright_magenta = Some(value),
        "brightCyan" => theme.bright_cyan = Some(value),
        "brightWhite" => theme.bright_white = Some(value),
        _ => {}
    }
}

fn terminal_font_size(font_size: Option<f64>) -> Option<f64> {
    font_size.filter(|value| (MIN_FONT_SIZE..=MAX_FONT_SIZE).contains(value))
}

fn terminal_line_height(line_height: Option<f64>) -> Option<f64> {
    line_height.filter(|value| (MIN_LINE_HEIGHT..=MAX_LINE_HEIGHT).contains(value))
}

fn merged_color_scheme(
    settings: &Value,
    profile: &Map<String, Value>,
    defaults: Option<&Map<String, Value>>,
) -> Option<String> {
    color_scheme_field(profile, "colorScheme", settings).or_else(|| {
        defaults.and_then(|defaults| color_scheme_field(defaults, "colorScheme", settings))
    })
}

fn color_scheme_field(source: &Map<String, Value>, key: &str, settings: &Value) -> Option<String> {
    match source.get(key)? {
        Value::String(value) => trimmed_string(value),
        Value::Object(schemes) => color_scheme_from_theme_object(settings, schemes),
        _ => None,
    }
}

fn color_scheme_from_theme_object(
    settings: &Value,
    schemes: &Map<String, Value>,
) -> Option<String> {
    let preferred_theme = settings
        .get("theme")
        .and_then(Value::as_str)
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    let preferred_key = if preferred_theme == "light" {
        "light"
    } else {
        "dark"
    };

    schemes
        .get(preferred_key)
        .and_then(Value::as_str)
        .and_then(trimmed_string)
        .or_else(|| {
            schemes
                .get("dark")
                .and_then(Value::as_str)
                .and_then(trimmed_string)
        })
        .or_else(|| {
            schemes
                .get("light")
                .and_then(Value::as_str)
                .and_then(trimmed_string)
        })
}

fn merged_string(
    profile: &Map<String, Value>,
    defaults: Option<&Map<String, Value>>,
    key: &str,
) -> Option<String> {
    string_field(profile, key).or_else(|| defaults.and_then(|defaults| string_field(defaults, key)))
}

fn merged_number(
    profile: &Map<String, Value>,
    defaults: Option<&Map<String, Value>>,
    key: &str,
) -> Option<f64> {
    number_field(profile, key).or_else(|| defaults.and_then(|defaults| number_field(defaults, key)))
}

fn merged_font_string(
    profile: &Map<String, Value>,
    defaults: Option<&Map<String, Value>>,
    font_key: &str,
    legacy_key: &str,
) -> Option<String> {
    nested_string_field(profile, "font", font_key)
        .or_else(|| defaults.and_then(|defaults| nested_string_field(defaults, "font", font_key)))
        .or_else(|| merged_string(profile, defaults, legacy_key))
}

fn merged_font_number(
    profile: &Map<String, Value>,
    defaults: Option<&Map<String, Value>>,
    font_key: &str,
    legacy_key: &str,
) -> Option<f64> {
    nested_number_field(profile, "font", font_key)
        .or_else(|| defaults.and_then(|defaults| nested_number_field(defaults, "font", font_key)))
        .or_else(|| merged_number(profile, defaults, legacy_key))
}

fn merged_font_value(
    profile: &Map<String, Value>,
    defaults: Option<&Map<String, Value>>,
    font_key: &str,
    legacy_key: &str,
) -> Option<String> {
    nested_value_field(profile, "font", font_key)
        .or_else(|| defaults.and_then(|defaults| nested_value_field(defaults, "font", font_key)))
        .or_else(|| value_field(profile, legacy_key))
        .or_else(|| defaults.and_then(|defaults| value_field(defaults, legacy_key)))
}

fn string_field(source: &Map<String, Value>, key: &str) -> Option<String> {
    source
        .get(key)
        .and_then(Value::as_str)
        .and_then(trimmed_string)
}

fn trimmed_string(value: &str) -> Option<String> {
    Some(value.trim().to_owned()).filter(|value| !value.is_empty())
}

fn number_field(source: &Map<String, Value>, key: &str) -> Option<f64> {
    source
        .get(key)
        .and_then(value_as_number)
        .filter(|value| value.is_finite())
}

fn nested_string_field(source: &Map<String, Value>, parent: &str, key: &str) -> Option<String> {
    source
        .get(parent)
        .and_then(Value::as_object)
        .and_then(|parent| string_field(parent, key))
}

fn nested_number_field(source: &Map<String, Value>, parent: &str, key: &str) -> Option<f64> {
    source
        .get(parent)
        .and_then(Value::as_object)
        .and_then(|parent| number_field(parent, key))
}

fn nested_value_field(source: &Map<String, Value>, parent: &str, key: &str) -> Option<String> {
    source
        .get(parent)
        .and_then(Value::as_object)
        .and_then(|parent| value_field(parent, key))
}

fn value_field(source: &Map<String, Value>, key: &str) -> Option<String> {
    let value = source.get(key)?;
    match value {
        Value::Number(number) => Some(number.to_string()),
        Value::String(value) => Some(value.trim().to_string()).filter(|value| !value.is_empty()),
        _ => None,
    }
}

fn value_as_number(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|value| value.parse::<f64>().ok()))
}

fn strip_jsonc(input: &str) -> String {
    strip_trailing_commas(&strip_comments(input))
}

fn strip_comments(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;

    while let Some(character) = chars.next() {
        if in_string {
            output.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
            output.push(character);
            continue;
        }

        if character == '/' {
            match chars.peek().copied() {
                Some('/') => {
                    chars.next();
                    for next in chars.by_ref() {
                        if next == '\n' {
                            output.push('\n');
                            break;
                        }
                    }
                    continue;
                }
                Some('*') => {
                    chars.next();
                    let mut previous = '\0';
                    for next in chars.by_ref() {
                        if previous == '*' && next == '/' {
                            break;
                        }
                        previous = next;
                    }
                    continue;
                }
                _ => {}
            }
        }

        output.push(character);
    }

    output
}

fn strip_trailing_commas(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;

    while let Some(character) = chars.next() {
        if in_string {
            output.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
            output.push(character);
            continue;
        }

        if character == ',' {
            let mut lookahead = chars.clone();
            while matches!(lookahead.peek().copied(), Some(next) if next.is_whitespace()) {
                lookahead.next();
            }
            if matches!(lookahead.peek().copied(), Some('}' | ']')) {
                continue;
            }
        }

        output.push(character);
    }

    output
}
