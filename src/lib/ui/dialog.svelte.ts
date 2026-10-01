// Promise-based modal dialogs rendered by DialogHost.svelte.

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Optional checkbox shown under the input, e.g. "Checkout branch". */
  checkbox?: { label: string; checked: boolean };
  validate?: (value: string) => string | null;
}

export interface PromptResult {
  value: string;
  checked: boolean;
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  danger?: boolean;
}

export interface ChooseOptions<T extends string> {
  title: string;
  message?: string;
  options: ChoiceOption<T>[];
}

type ActiveDialog =
  | { type: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { type: "prompt"; options: PromptOptions; resolve: (result: PromptResult | null) => void }
  | { type: "choose"; options: ChooseOptions<string>; resolve: (value: string | null) => void };

class DialogStore {
  active = $state<ActiveDialog | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.active = { type: "confirm", options, resolve };
    });
  }

  prompt(options: PromptOptions): Promise<PromptResult | null> {
    return new Promise((resolve) => {
      this.active = { type: "prompt", options, resolve };
    });
  }

  choose<T extends string>(options: ChooseOptions<T>): Promise<T | null> {
    return new Promise((resolve) => {
      this.active = {
        type: "choose",
        options: options as ChooseOptions<string>,
        resolve: resolve as (value: string | null) => void,
      };
    });
  }

  close(): void {
    this.active = null;
  }
}

export const dialogs = new DialogStore();
