// C side of swiftui/bridge/src/lib.rs. Keep the two in sync.

#ifndef GM_BRIDGE_H
#define GM_BRIDGE_H

/// Runs a backend command with camelCase JSON arguments. Returns
/// {"ok":true,"value":...} or {"ok":false,"error":{"kind":...,"message":...}};
/// free it with gm_free_string.
char *gm_call(const char *command, const char *args_json);

/// Frees a string returned by gm_call.
void gm_free_string(char *text);

/// Answers the control server's UI requests ({"action":...,"args":{...}}) with
/// {"ok":bool,"text":...,"structured":{...}} in a malloc'd string (strdup); the server frees it.
typedef char *(*gm_ui_handler)(const char *request_json);

/// Keeps the handler for the control (MCP) server's UI requests. The server starts when the app applies its
/// settings (gm_call "mcp_configure"), and writes ~/.gitmanager-native/.gitmanager/mcp.json while it listens.
void gm_control_install(gm_ui_handler ui_handler);

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/// Gets a terminal's output (exited false), then its exit once (exited true; exit_code INT32_MIN when killed).
typedef void (*gm_terminal_output)(void *context, uint32_t terminal_id, const uint8_t *bytes, size_t length,
                                   int32_t exit_code, bool exited);

/// Starts a shell ({"shellId","cwd","cols","rows"}) like the Tauri terminal_spawn; answers like gm_call with its
/// TerminalInfo. The callback runs on a background thread until the exit message.
char *gm_terminal_spawn(const char *args_json, gm_terminal_output callback, void *context);

#endif
