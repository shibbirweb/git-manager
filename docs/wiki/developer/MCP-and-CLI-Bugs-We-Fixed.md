# MCP and CLI Bugs We Fixed

The bugs we found in the MCP server and the command line tool, why they happened and how we fixed them. How they work is in [How MCP and the CLI Work](How-MCP-and-CLI-Work.md); the user side is in [MCP Server and Command Line Tool](../usage/MCP-and-CLI.md).

**The clash check missed `inspect_elements`.**
- **The issue:** a backend tool could have taken the name `inspect_elements` without a test failing.
- **Why it happened:** `FRONTEND_TOOLS`, the list the Rust clash test checks, was typed by hand with a fixed length of 23, and nobody added the 24th UI tool to it.
- **The fix and why we chose it:** the list is now a slice with every UI tool, and a Vitest test in `toolDefs.test.ts` reads `registry.rs` and compares it with the real `UI_TOOLS` names. Reading the Rust file from TypeScript checks the list the app actually registers, not a parse of `toolDefs.ts`.
