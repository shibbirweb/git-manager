// The body of a command that takes a large text (see raw_parts in src-tauri/src/commands/mod.rs):
// the arguments as one line of JSON, then the text as UTF-8. The text crosses the bridge as plain
// bytes, without the escaping and parsing a JSON string needs.

const encoder = new TextEncoder();

export function rawBody(args: Record<string, unknown>, text: string): Uint8Array {
  // JSON.stringify never writes a raw newline, so the first one ends the arguments.
  const head = encoder.encode(`${JSON.stringify(args)}\n`);
  // Code is mostly ASCII: one buffer of that size usually holds the text, encoded in place.
  const body = new Uint8Array(head.length + text.length);
  body.set(head);
  const { read, written } = encoder.encodeInto(text, body.subarray(head.length));
  if (read === text.length) {
    return written === text.length ? body : body.slice(0, head.length + written);
  }
  const full = new Uint8Array(head.length + written + text.length * 3);
  full.set(body.subarray(0, head.length + written));
  const rest = encoder.encodeInto(text.slice(read), full.subarray(head.length + written));
  return full.slice(0, head.length + written + rest.written);
}
