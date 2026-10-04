// Asks for a commit identity before committing in a repository that has none, instead of
// letting git fail with "Please tell me who you are" (or quietly make one up from the
// computer's name).

import { api } from "$lib/api";
import type { Identity } from "$lib/types";
import { gitDialogs } from "../git/gitDialogs.svelte";

/** True when the commit can go ahead: git has an identity, or the user just saved one. */
export async function ensureIdentity(repoRoot: string): Promise<boolean> {
  let identity: Identity;
  try {
    identity = await api.getIdentity(repoRoot);
  } catch {
    // Reading failed: let git itself report what is wrong.
    return true;
  }
  if (identity.complete) {
    return true;
  }
  return new Promise<boolean>((resolve) => {
    gitDialogs.open({ kind: "identity", repoRoot, identity, resolve });
  });
}
