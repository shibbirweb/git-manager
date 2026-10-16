<!--
  The old (left) and new (right) version of a binary image or PDF in a diff, loaded lazily by
  DiffView while the diff is on screen, on the UI library's MediaCompare (one zoom, synced scrolling). Both come
  from the gmpreview scheme, so no bytes enter JavaScript; MediaCompare blanks its frames and images on unmount, so
  WebKit frees what they held.
-->
<script lang="ts">
  import MediaCompare from "@git-manager/ui/components/MediaCompare.svelte";
  import { onDestroy, untrack } from "svelte";
  import { errorMessage } from "$lib/api";
  import { previewOf } from "$lib/views/files/mediaPreview";
  import { type OpenedPreview, openPreview } from "$lib/views/files/previewScheme";
  import { compareSide, type PreviewSides, type SideRole, sideState } from "./binaryPreview";

  interface Props {
    sides: PreviewSides;
    leftLabel: string;
    rightLabel: string;
    /** The diff's path, for the kind when a side has none of its own. */
    path: string;
  }

  let { sides, leftLabel, rightLabel, path }: Props = $props();

  type Loaded = OpenedPreview | { error: string } | null;

  const ROLES: SideRole[] = ["original", "modified"];
  const IMAGE_ERROR = "This image could not be shown. The file may be damaged or in a format WebKit does not support.";

  let loaded = $state.raw<Loaded[]>([null, null]);
  let zoom = $state<number | null>(null);
  let request = 0;

  const sources = $derived([sides.original, sides.modified]);
  const labels = $derived([leftLabel, rightLabel]);
  // A string, so a new but equal `sides` object does not load the files again.
  const loadKey = $derived(JSON.stringify([sides.original, sides.modified, sides.version ?? 0]));
  const shown = $derived(
    ROLES.map((role, index) => {
      const kind = previewOf(sources[index]?.filePath ?? path)?.kind ?? previewOf(path)?.kind ?? null;
      return compareSide(sideState(role, labels[index], sources[index], loaded[index]), kind, labels[index]);
    }) as [ReturnType<typeof compareSide>, ReturnType<typeof compareSide>],
  );

  async function load(version: number): Promise<void> {
    const current = ++request;
    const results = await Promise.all(
      [sides.original, sides.modified].map(async (source): Promise<Loaded> => {
        if (!source) {
          return null;
        }
        try {
          return await openPreview(source, version);
        } catch (cause) {
          return { error: errorMessage(cause) };
        }
      }),
    );
    if (current === request) {
      loaded = results;
    }
  }

  $effect(() => {
    void loadKey;
    untrack(() => void load(sides.version ?? 0));
  });

  onDestroy(() => {
    request++;
  });

  function imageFailed(index: number): void {
    loaded = loaded.map((value, at) => (at === index ? { error: IMAGE_ERROR } : value));
  }
</script>

<MediaCompare sides={shown} bind:zoom onerror={imageFailed} />
