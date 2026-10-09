// Settings > Terminal, GitHub, Updates, Settings Files and About, as SettingsDialog.svelte draws them,
// with the defaults of src/lib/stores/settingsData.ts. Keep in step with those files.

import SwiftUI

extension SettingsCatalogData {
    static let terminal: [CatalogItem] = [
        .group("Shell"),
        .field("Default shell", "New terminals start this shell. The arrow next to + in the terminal panel starts "
            + "any other one.", .select, "Login shell"),
        .group("Font"),
        .field("Font family", "A comma-separated list. Leave it empty to use the editor font.", .input, ""),
        .range("Font size", "", fraction: 0.2667, value: "13px"),
        .range("Line height", "A multiple of the font's own line height.", fraction: 0.2, value: "1.2"),
        .range("Letter spacing", "Extra pixels between characters.", fraction: 0, value: "0px"),
        .choice("Font weight", "Medium needs a font that has it, such as SF Mono or JetBrains Mono.",
                labels: ["Normal", "Medium", "Bold"], values: ["normal", "medium", "bold"],
                key: "terminalFontWeight", value: "normal"),
        .choice("Bold text weight", "For text that programs print in bold.", labels: ["Normal", "Medium", "Bold"],
                values: ["normal", "medium", "bold"], key: "terminalFontWeightBold", value: "bold"),
        .toggle("Font ligatures", "Draw =>, != and similar as single glyphs with fonts such as Fira Code or "
            + "JetBrains Mono.", key: "terminalLigatures", on: false),
        .toggle("Icons from patched fonts", "Nerd Font and Powerline symbols used by prompts like Powerlevel10k, "
            + "Starship and oh-my-posh.", key: "terminalNerdFontIcons", on: true),
        .group("Cursor"),
        .choice("Cursor style", "", labels: ["Block", "Bar", "Underline"], values: ["block", "bar", "underline"],
                key: "terminalCursorStyle", value: "block"),
        .toggle("Cursor blink", "Blinks while the terminal has focus.", key: "terminalCursorBlink", on: true),
        .group("Behavior"),
        .field("Scrollback", "Lines kept for scrolling back, 1,000 to 100,000.", .input, "5000"),
        .toggle("Copy on selection", "Selecting text copies it to the clipboard.", key: "terminalCopyOnSelect",
                on: false),
        .toggle("Find in terminal", "Cmd+F searches the output. Off, the search code is never loaded.",
                key: "terminalFind", on: true),
        .toggle("Clickable file paths", "Cmd+click a path such as src/app.ts:12:5 to open it at that line. Only "
            + "files inside an open folder become links.", key: "terminalFileLinks", on: true),
        .toggle("Drop files to type their paths", "Dropping files on a terminal types their paths, quoted for the "
            + "shell.", key: "terminalDropPaths", on: true),
        .toggle("Visual bell", "A short flash when the shell rings the bell, or a dot on a terminal that is out of "
            + "sight.", key: "terminalVisualBell", on: true),
        .toggle("Smooth scrolling", "Animates scrolling with the mouse wheel.", key: "terminalSmoothScrolling",
                on: false),
        .toggle("Option as Meta key", "macOS: Option+B, Option+F and other emacs keys work in the shell. Off, "
            + "Option types characters such as å.", key: "terminalOptionAsMeta", on: false),
        .group("Rendering"),
        .toggle("GPU acceleration", "Recommended. Draws with WebGL, which keeps busy output smooth and uses less "
            + "CPU.", key: "terminalGpuAcceleration", on: true),
        .toggle("Unicode 11 widths", "Emoji and wide characters take the right number of columns. Applies to output "
            + "printed after the change.", key: "terminalUnicode11", on: true),
    ]

    static let github: [CatalogItem] = [
        .githubAccount("GitHub account", "Used by Git > GitHub: Share Project on GitHub, Sync Fork and Create Gist. "
            + "Pushing and pulling keep using git's own credentials."),
    ]

    static let updates: [CatalogItem] = [
        .field("Version", "Not checked yet", .button, "Check Now"),
        .toggle("Check for updates automatically", "Asks GitHub for new releases every few hours. Nothing is "
            + "downloaded or installed without you.", key: "checkForUpdates", on: true),
        .choice("Update channel", "Stable gets finished releases only. Beta also gets pre-releases with new features "
            + "to try early. Automatic follows betas only when this build is a beta.",
            labels: ["Automatic", "Stable", "Beta"], values: ["auto", "stable", "beta"], key: "updateChannel",
            value: "auto"),
        .field("Release notes", "What changed in this version, from the changelog built into the app.", .button,
               "What's New"),
    ]

    static let files: [CatalogItem] = [
        .field("Settings folder", "The native app keeps its files in ~/.gitmanager-native. You can edit "
            + "settings.json by hand.", .button, "Show in Finder"),
    ]

    static let about: [CatalogItem] = [
        .field("Star on GitHub", "Like Git Manager? A star helps other people find it.", .button, "Star"),
        .field("Report a Bug", "Opens a GitHub issue with your version and system filled in.", .button, "Report"),
        .field("Request a Feature", "Suggest an idea or an improvement.", .button, "Request"),
        .field("Release Notes", "What changed in this version.", .button, "Open"),
    ]
}
