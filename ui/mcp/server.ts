// The design-system MCP server (stdio): `bun ui/mcp/server.ts`. Registered for this repository in .mcp.json, so
// AI agents can look up components, props, tokens, icons and rules. Each line on stdin is one JSON-RPC message.
import { handle, type Request } from "./protocol";

const decoder = new TextDecoder();
let buffer = "";

function reply(line: string): void {
  let request: Request;
  try {
    request = JSON.parse(line) as Request;
  } catch {
    const error = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } };
    process.stdout.write(`${JSON.stringify(error)}\n`);
    return;
  }
  const response = handle(request);
  if (response) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

process.stdin.on("data", (chunk: Buffer) => {
  buffer += decoder.decode(chunk, { stream: true });
  let newline = buffer.indexOf("\n");
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) {
      reply(line);
    }
    newline = buffer.indexOf("\n");
  }
});
