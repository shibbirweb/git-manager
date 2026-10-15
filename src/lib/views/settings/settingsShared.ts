// Small helpers the Settings sections share.
import { errorMessage } from "$lib/api";
import { type Preferences, settings } from "$lib/stores/settings.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { platformName } from "$lib/update/releases";

/** Every change is applied and saved at once. */
export function set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  settings.setPreference(key, value);
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch (error) {
    toast.error("Could not copy", errorMessage(error));
  }
}

/** Shortcut words in the hints: the click modifier and the Option key differ on Windows and Linux. */
export const onMac = platformName(navigator.userAgent) === "macOS";
export const clickModifier = onMac ? "Cmd" : "Ctrl";
export const optionKey = onMac ? "Option" : "Alt";

/** Choices for a Segmented of numbers, which takes string values. */
export function numberChoices(values: readonly number[], label: (value: number) => string) {
  return values.map((value) => ({ value: String(value), label: label(value) }));
}
