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

/// Starts the control (MCP) server once and writes ~/.gitmanager-native/.gitmanager/mcp.json.
/// Returns the port, or -1.
int gm_control_start(gm_ui_handler ui_handler);

#endif
