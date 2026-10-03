// Commit identity checks for Settings > Git and the identity dialog. The same light rules as
// src-tauri/src/git/identity.rs, so a value is refused before it is sent.

import type { Identity, IdentityScope } from "$lib/types";

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;

/** Why `name` cannot be user.name, or null; `required` refuses an empty one. */
export function validateIdentityName(name: string, required: boolean): string | null {
  const clean = name.trim();
  if (clean === "") {
    return required ? "Enter your name" : null;
  }
  if ([...clean].length > MAX_NAME_LENGTH) {
    return "The name is too long";
  }
  if (/[<>\r\n\0]/.test(clean)) {
    return "The name cannot contain < > or line breaks";
  }
  return null;
}

/** Why `email` cannot be user.email, or null: a light something@something check. */
export function validateIdentityEmail(email: string, required: boolean): string | null {
  const clean = email.trim();
  if (clean === "") {
    return required ? "Enter your email" : null;
  }
  if ([...clean].length > MAX_EMAIL_LENGTH) {
    return "The email is too long";
  }
  const at = clean.lastIndexOf("@");
  if (at <= 0 || at === clean.length - 1 || /[\s<>\0]/.test(clean)) {
    return "Not a valid email address";
  }
  return null;
}

/** The values the identity dialog starts with: what is set already, the repository's first. */
export function identityPrefill(identity: Identity | null): { name: string; email: string; scope: IdentityScope } {
  const local = identity?.local ?? { name: null, email: null };
  const global = identity?.global ?? { name: null, email: null };
  const hasLocal = local.name !== null || local.email !== null;
  return {
    name: local.name ?? global.name ?? "",
    email: local.email ?? global.email ?? "",
    scope: hasLocal ? "local" : "global",
  };
}

/** "Ann Lee <ann@example.com>", or what is missing. */
export function identityLabel(name: string | null, email: string | null): string {
  if (name && email) {
    return `${name} <${email}>`;
  }
  if (name) {
    return `${name}, no email`;
  }
  if (email) {
    return `<${email}>, no name`;
  }
  return "Not set";
}
