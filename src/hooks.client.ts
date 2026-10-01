export async function init(): Promise<void> {
  if (import.meta.env.DEV) {
    const { startIpcBridge } = await import("$lib/dev/ipcBridge");
    startIpcBridge();
  }
}
