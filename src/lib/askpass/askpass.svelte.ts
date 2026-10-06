// The credential questions of git and ssh (src-tauri/src/askpass.rs), queued and shown one at a
// time by AskpassDialog.svelte. A password typed with the username answers git's next question
// for it, and is kept in memory for a minute at most.

import * as api from "$lib/api";
import type { AskpassQuestion } from "$lib/types";
import { parsePrompt, REMEMBER_MS, rememberedPassword, type RememberedPassword } from "./askpassPrompt";

class AskpassStore {
  queue = $state.raw<AskpassQuestion[]>([]);
  current = $derived(this.queue[0] ?? null);
  private remembered: RememberedPassword | null = null;
  private started = false;

  /** Listens for questions in this window; called once from App.svelte. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    void api.onAskpassRequest((question) => this.receive(question));
    void api.onAskpassDone((id) => this.drop(id));
  }

  private receive(question: AskpassQuestion): void {
    const password = rememberedPassword(this.remembered, parsePrompt(question.prompt), Date.now());
    if (password !== null) {
      this.remembered = null;
      void api.askpassRespond(question.id, password);
      return;
    }
    if (!this.queue.some((queued) => queued.id === question.id)) {
      this.queue = [...this.queue, question];
    }
  }

  /** Answers the question; `password` (from the sign-in dialog) waits for git's next question. */
  answer(id: number, answer: string, password: { host: string; user: string; value: string } | null = null): void {
    this.remembered =
      password && password.value !== ""
        ? { host: password.host, user: password.user, password: password.value, until: Date.now() + REMEMBER_MS }
        : null;
    this.drop(id);
    void api.askpassRespond(id, answer);
  }

  cancel(id: number): void {
    this.remembered = null;
    this.drop(id);
    void api.askpassRespond(id, null);
  }

  private drop(id: number): void {
    if (this.queue.some((queued) => queued.id === id)) {
      this.queue = this.queue.filter((queued) => queued.id !== id);
    }
  }
}

export const askpass = new AskpassStore();
