# Memory Use

Git Manager is built to stay light. The **Memory** item at the right of the [status bar](Status-Bar-and-Help.md) shows how much memory it uses right now, and a debug log can record how that changes over time.

## The readout

The readout lets you see that for yourself. It shows physical memory as Activity Monitor counts it. That includes the helper processes macOS runs for the app's web view, which draws the interface.

Click **Memory** for a breakdown: **Git Manager (app)**, **Web content (UI)**, **Graphics** and **Networking**, each with its size and a bar. Below them, **GPU acceleration** answers two questions. **Terminals use the GPU** says yes (and in how many terminals) or no with the reason: turned off in Settings, font ligatures on, or the GPU failed and the terminal fell back to normal drawing. **WebGL support** says whether the web view can use the GPU for that at all, and names the graphics chip. The window itself always draws with the GPU through macOS; that is the Graphics row. GPU drawing in terminals is smoother and lighter on the CPU with a lot of output, at a few MB of GPU memory per terminal; turn it off in Settings, Terminal if you see drawing glitches or want font ligatures. Opening it measures again at once. Press Esc or click elsewhere to close it.

The number updates every few seconds while the window is visible, and stops while it is hidden. When the app was started from a Terminal, the helpers are matched by their start time, and the breakdown says so.

## The memory log

To find out what makes memory grow, turn on **Settings, Automation, Memory log, Log memory changes**. While it is on, Git Manager reads its memory every **Read memory every** (250 ms, 500 ms, 1 s or 2 s; 500 ms by default) and writes a line whenever the total changed by **Write a line when it changes by** (0, 1, 5 or 20 MB; 5 MB by default; 0 writes every reading). It also notes what was on screen and when scrolling started and stopped.

![Memory log settings](../images/memory-log-settings.png)

*Settings, Automation, Memory log, with the path of the log file.*

The file is `~/.gitmanager/logs/memory.log`. **Reveal in Finder** shows it. A line looks like `2026-10-02T04:20:31.512Z total 400.0 MB (+50.0) | Web content 300.0 | ...`, with times in UTC. Past 5 MB the log starts over and keeps the previous one as `memory.log.1`. AI tools can read it with the `read_memory_log` tool (see [MCP Server and Command Line Tool](MCP-and-CLI.md)). Turn it off when you are done: off, nothing runs.

## Related

- [Status Bar and Help](Status-Bar-and-Help.md)
- [Settings: Terminal and Automation](Settings-Terminal-and-Automation.md)
- [MCP Server and Command Line Tool](MCP-and-CLI.md)
- [How memory is measured (developer)](../developer/How-Memory-Is-Measured.md)
