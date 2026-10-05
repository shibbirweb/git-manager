# Terminal, GitHub and Automation Settings

This page lists the options in three sections of [Settings](Settings.md): **Terminal**, **GitHub** and **Automation**. Open Settings with Cmd+, and pick the section on the left. Every change applies right away.

## Terminal

![Settings, Terminal section](../images/terminal-settings.png)

*The Terminal section: the shell, the font with a live preview, the cursor and the behavior options.*

The section has five groups. A preview under the font box shows a prompt, a commit line and tricky characters (`0O 1lI`) with your choices. Open terminals pick up the changes at once. How the terminal itself works is in [Terminal](Terminal.md).

**Shell**

| Setting | What it does | Default |
| --- | --- | --- |
| Default shell | The shell new terminals start: **Login shell** (your account's own shell, the one Terminal.app uses) or any shell found on your computer, shown with its path. On Windows the first choice is **Default**: PowerShell 7, else Windows PowerShell. | Login shell, shown with its name, such as **Login shell (zsh)** |

A saved shell that is gone says **(not found, the login shell is used)**. The arrow next to + in the terminal panel starts any other shell once.

**Font**

| Setting | What it does | Default |
| --- | --- | --- |
| Font family | A comma-separated list, like VS Code's `terminal.integrated.fontFamily`. Leave it empty to use the editor font. **Use the Editor Font** clears it. Click a font name below the box to use it. | Empty (the editor font) |
| Font size | 9 to 24 px in half steps. | 13 px (a size you saved earlier stays) |
| Line height | A multiple of the font's own line height, 1.0 to 2.0. | 1.2 |
| Letter spacing | Extra pixels between characters, 0 to 5. | 0 px |
| Font weight | **Normal**, **Medium** or **Bold**. Medium needs a font that has it, such as SF Mono or JetBrains Mono. | Normal |
| Bold text weight | The weight of text that programs print in bold. | Bold |
| Font ligatures | Draws `=>` and `!=` as single symbols with fonts such as Fira Code. A ligature splits where colors change or under the cursor. Ligatures draw without GPU acceleration. | Off |
| Icons from patched fonts | Patched fonts (Nerd Fonts, Powerline fonts) are fonts with extra icon symbols added. This adds them as fallbacks, for prompts like Powerlevel10k, Starship and oh-my-posh. Install a Nerd Font such as MesloLGS NF, or Symbols Nerd Font Mono to keep your own font. | On |

**Cursor**

| Setting | What it does | Default |
| --- | --- | --- |
| Cursor style | **Block**, **Bar** or **Underline**. | Block |
| Cursor blink | Blinks while the terminal has focus. | On |

**Behavior**

| Setting | What it does | Default |
| --- | --- | --- |
| Scrollback | Lines kept for scrolling back, 1,000 to 100,000. A full terminal uses about 2 KB per line in a wide window: about 10 MB at 5,000 lines and 200 MB at 100,000. Type a number and press Enter. | 5,000 |
| Copy on selection | Selecting text copies it to the clipboard. | Off |
| Find in terminal | Cmd+F searches the output. Off, the search code is never loaded. | On |
| Clickable file paths | Cmd+click a path such as `src/app.ts:12:5` to open it at that line. Only files inside an open folder become links. | On |
| Drop files to type their paths | Dropping files on a terminal types their paths, quoted for the shell. | On |
| Visual bell | A short flash when the shell rings the bell, or a dot on a terminal that is out of sight. | On |
| Smooth scrolling | Animates scrolling with the mouse wheel. | Off |
| Option as Meta key | Option+B, Option+F and other emacs keys work in the shell. Off, Option types characters such as å. | Off |

The **Keyboard** row is a reminder: Ctrl+` shows or hides the terminal, Ctrl+Shift+` opens a new one, and in a terminal Cmd+C copies, Cmd+V pastes, Cmd+K clears, Cmd+F finds and Cmd+\\ splits.

**Rendering**

| Setting | What it does | Default |
| --- | --- | --- |
| GPU acceleration | Draws with WebGL (the graphics card), which keeps busy output smooth, and falls back to normal drawing when WebGL is missing or fails. It uses about 70 MB for the first terminal and 10 MB for each other one; off saves that. | On |
| Unicode 11 widths | Emoji and wide characters take the right number of columns. Applies to output printed after the change. | On |

Every switch applies to open terminals at once. What each part does is on [Terminal Features](Terminal-Features.md).

## GitHub

The **GitHub account** is used by **Git > GitHub**: Share Project on GitHub, Sync Fork and Create Gist. Pushing and pulling keep using git's own credentials. You can sign in in two ways:

- **Sign in with a token**: paste a classic personal access token with the `repo` and `gist` scopes and click **Sign In**. It is checked with GitHub, then kept only in the system keychain, never in `settings.json`.
- **Use GitHub CLI**: if the `gh` tool is installed and signed in, Git Manager asks it for its login each time and stores nothing.

Once signed in, the section shows your account and a **Sign Out** button. See [GitHub](GitHub.md).

## Automation

Automation lets other programs use Git Manager. Everything here is off by default.

**MCP server**

MCP (Model Context Protocol) lets AI tools such as Claude Code or Cursor read what Git Manager shows and use its features.

| Setting | What it does | Default |
| --- | --- | --- |
| MCP server | Starts a server that only listens on this Mac. Every request needs the secret token. | Off |
| Status | **Off**, **Starting...**, **Running at** and the address, or an error. **Available MCP Tools...** opens the list of tools, where each one can be switched on or off. | |
| Port | The port on 127.0.0.1 (the address that means this Mac), shared with the command line tool, 1024 to 65535. A change restarts the server. | 48731 |

While the server runs you also see the **Secret token** (**Show**, **Copy**, **New Token**), a command to **Connect Claude Code**, and a config to copy for **Other MCP clients**.

**Command line tool**

| Setting | What it does | Default |
| --- | --- | --- |
| Command line tool | Lets scripts and AI agents in a terminal use the same tools, for example `git-manager cli tools`. Git Manager must be running. | Off |
| Install | **Install in ~/.local/bin** (**Install** on Windows) adds the `git-manager` command; **Remove** takes it away. If that folder is not on your PATH, a line to add to `~/.zshrc` is shown (on Windows, the folder to add to your PATH). | |

The tool switches in **Help > Available MCP Tools...** apply here too. See [MCP and CLI](MCP-and-CLI.md).

**Memory log**

A debugging aid: it writes a line whenever the app's memory changes, next to what was on screen and when scrolling started and stopped.

| Setting | What it does | Default |
| --- | --- | --- |
| Log memory changes | Turns the log on. AI tools can read it with `read_memory_log`. | Off |
| Read memory every | **250 ms**, **500 ms**, **1 s** or **2 s**. | 500 ms |
| Write a line when it changes by | **0 MB** (every reading), **1 MB**, **5 MB** or **20 MB**. | 5 MB |
| Log file | Where the log is, `~/.gitmanager/logs/memory.log`, with **Reveal in Finder** (**Reveal in File Explorer** on Windows). | |

The log starts over when it passes 5 MB, and the previous one is kept as `memory.log.1`. See [Debugging](../developer/Debugging.md).

## Related

- [Settings](Settings.md)
- [Settings Files](Settings-Files.md)
- [Terminal](Terminal.md)
- [MCP and CLI](MCP-and-CLI.md)
