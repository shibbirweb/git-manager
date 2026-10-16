// Open File in a diff's toolbar (two panes or three): the real file in an editor tab.
import { navigation } from "$lib/stores/navigation.svelte";
import { toast } from "$lib/ui/toast.svelte";

/** Opens `filePath` in a pinned tab, at the 0-based `line` when given; says so when the work tree has no such file. */
export async function openWorkingFile(filePath: string, line: number | null): Promise<void> {
  if (!(await navigation.fileExists(filePath))) {
    const fileName = filePath.split("/").pop() ?? filePath;
    toast.info(
      `${fileName} is not in the work tree`,
      "It was deleted or never existed there, so there is no file to open.",
    );
    return;
  }
  await navigation.openFileAt(filePath, line, null, { pin: true });
}
