// JetBrains' Commit Options, kept pure: the author check, the git arguments each option
// adds (mirroring commands/commit_options.rs) and what the gear shows.

import type { CommitOptions, GpgSign } from "$lib/types";

export const GPG_SIGN_CHOICES: { value: GpgSign; label: string; description: string }[] = [
  { value: "default", label: "Default", description: "commit.gpgSign decides" },
  { value: "sign", label: "Sign", description: "-S" },
  { value: "noSign", label: "Do not sign", description: "--no-gpg-sign" },
];

export const DEFAULT_COMMIT_OPTIONS: CommitOptions = {
  signOff: false,
  author: null,
  gpgSign: "default",
  noVerify: false,
};

/** Why `author` is not "Name <email>", or null; empty means the configured author. */
export function validateAuthor(author: string): string | null {
  const text = author.trim();
  if (text === "") {
    return null;
  }
  const match = /^([^<>]*)<([^<>]*)>$/.exec(text);
  if (!match) {
    return "Write the author as Name <email>";
  }
  const name = match[1].trim();
  const email = match[2].trim();
  if (name === "" || name.startsWith("-")) {
    return "The author needs a name before the email";
  }
  if (email === "" || /\s/.test(email) || !email.includes("@")) {
    return "Not a valid email address";
  }
  return null;
}

/** The options as sent: an empty author is left out. */
export function commitRequest(options: CommitOptions): CommitOptions {
  const author = (options.author ?? "").trim();
  return { ...options, author: author === "" ? null : author };
}

/** The `git commit` arguments the options add, as the backend builds them. */
export function commitOptionArgs(options: CommitOptions): string[] {
  const request = commitRequest(options);
  const args: string[] = [];
  if (request.signOff) {
    args.push("--signoff");
  }
  if (request.author) {
    args.push(`--author=${request.author}`);
  }
  if (request.gpgSign === "sign") {
    args.push("-S");
  } else if (request.gpgSign === "noSign") {
    args.push("--no-gpg-sign");
  }
  if (request.noVerify) {
    args.push("--no-verify");
  }
  return args;
}

/** How many options differ from the defaults, for the gear's badge. */
export function changedOptionCount(options: CommitOptions): number {
  return commitOptionArgs(options).length;
}

/** The gear's tooltip: what the next commit adds. */
export function commitOptionsTooltip(options: CommitOptions): string {
  const args = commitOptionArgs(options);
  return args.length === 0 ? "Commit Options" : `Commit Options: ${args.join(" ")}`;
}
