// The signed-in GitHub account, as Rust reports it. The token is sent once to Rust, which
// verifies it and keeps it in the keychain; nothing here ever holds or reads it back.

import { api } from "$lib/api";
import type { GhCliStatus, GitHubAccount } from "$lib/types";

class GitHubAccountStore {
  account = $state<GitHubAccount | null>(null);
  /** Whether `gh` is installed and signed in; null until asked. */
  cli = $state<GhCliStatus | null>(null);

  /** Re-reads ~/.gitmanager/github.json (cheap: no network, no keychain). */
  async load(): Promise<GitHubAccount | null> {
    try {
      this.account = (await api.githubAccount()) ?? null;
    } catch {
      this.account = null;
    }
    return this.account;
  }

  async loadCli(): Promise<GhCliStatus> {
    try {
      this.cli = await api.githubCliStatus();
    } catch {
      this.cli = { installed: false, signedIn: false };
    }
    return this.cli;
  }

  async signInWithToken(token: string): Promise<GitHubAccount> {
    this.account = await api.githubSignInWithToken(token);
    return this.account;
  }

  async signInWithCli(): Promise<GitHubAccount> {
    this.account = await api.githubSignInWithCli();
    return this.account;
  }

  async signOut(): Promise<void> {
    await api.githubSignOut();
    this.account = null;
  }
}

export const githubAccount = new GitHubAccountStore();
