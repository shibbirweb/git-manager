// xterm.js and its addons, imported dynamically by TerminalView the first time a
// terminal opens, so the app pays nothing for them until then.

import "@xterm/xterm/css/xterm.css";

export { FitAddon } from "@xterm/addon-fit";
export { WebLinksAddon } from "@xterm/addon-web-links";
export { Terminal } from "@xterm/xterm";
