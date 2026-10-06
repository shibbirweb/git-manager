// What git and ssh ask through askpass (src-tauri/src/askpass.rs), read from their prompt text
// so the dialog can say who asks for what: a username, a password, an SSH key passphrase or a
// yes/no question about a new host. Pure, so every prompt shape is tested.

export type PromptKind = "username" | "password" | "passphrase" | "confirm" | "other";

export interface ParsedPrompt {
  kind: PromptKind;
  /** The server, such as "github.com" or "gitlab.example.com:8443"; null when the prompt names none. */
  host: string | null;
  /** The user named in the prompt ("Password for 'https://octocat@github.com'"). */
  user: string | null;
  /** The SSH key a passphrase unlocks. */
  keyPath: string | null;
  /** The field hides what is typed. */
  secret: boolean;
  /** The prompt as git or ssh wrote it, trimmed. */
  text: string;
}

/** "https://octocat@github.com/path" -> user and host. */
function splitUrl(url: string): { host: string | null; user: string | null } {
  const match = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:([^@/]+)@)?([^/]+)/i.exec(url.trim());
  if (!match) {
    return { host: null, user: null };
  }
  return { host: match[2] || null, user: match[1] ? decodeURIComponent(match[1]) : null };
}

const SECRET_WORDS = /password|passphrase|passcode|token|\bpin\b|secret/i;

export function parsePrompt(prompt: string): ParsedPrompt {
  const text = prompt.trim();
  const base: ParsedPrompt = { kind: "other", host: null, user: null, keyPath: null, secret: SECRET_WORDS.test(text), text };

  // Git: "Username for 'https://github.com': " and "Password for 'https://octocat@github.com': ".
  const gitAsk = /^(Username|Password) for '([^']*)'/i.exec(text);
  if (gitAsk) {
    const { host, user } = splitUrl(gitAsk[2]);
    const kind = gitAsk[1].toLowerCase() === "username" ? "username" : "password";
    return { ...base, kind, host, user, secret: kind === "password" };
  }
  // ssh: "Enter passphrase for key '/Users/me/.ssh/id_ed25519': ".
  const passphrase = /passphrase for (?:key )?'([^']*)'/i.exec(text);
  if (passphrase) {
    return { ...base, kind: "passphrase", keyPath: passphrase[1], secret: true };
  }
  // ssh: "Are you sure you want to continue connecting (yes/no/[fingerprint])?" after the host key.
  if (/\(yes\/no/i.test(text)) {
    const host = /authenticity of host '([^' (]+)/i.exec(text)?.[1] ?? null;
    return { ...base, kind: "confirm", host, secret: false };
  }
  // ssh: "git@example.com's password: ".
  const sshPassword = /^([^@\s]+)@([^'\s]+)'s password/i.exec(text);
  if (sshPassword) {
    return { ...base, kind: "password", user: sshPassword[1], host: sshPassword[2], secret: true };
  }
  return base;
}

/** The last part of a path, for "storefront" in the dialog. */
export function folderLabel(folderPath: string): string {
  return folderPath.split(/[\\/]/).filter(Boolean).pop() ?? folderPath;
}

/** A password typed together with the username, kept briefly for git's next question. */
export interface RememberedPassword {
  host: string;
  user: string;
  password: string;
  /** Milliseconds since the epoch after which it is forgotten. */
  until: number;
}

/** How long a password typed with the username waits for git's password question. */
export const REMEMBER_MS = 60_000;

/**
 * Git asks for the username and the password in two steps; the sign-in dialog asks both at
 * once. The password answers git's second question when it is for the same server and user.
 */
export function rememberedPassword(remembered: RememberedPassword | null, prompt: ParsedPrompt, now: number): string | null {
  if (!remembered || prompt.kind !== "password" || now > remembered.until) {
    return null;
  }
  return prompt.host === remembered.host && prompt.user === remembered.user ? remembered.password : null;
}
