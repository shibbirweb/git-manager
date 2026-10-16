<!-- A moment relative to now: "5 min ago" (ago), "5m" (age) or "in 3h 20m" (until), with the full date as its
     tooltip and digits of one width. A live Time stays current from one shared clock (logic/clock.svelte.ts). Put it
     in a Text for its tone and size. -->
<script lang="ts">
  import { useClock } from "../logic/clock.svelte";
  import { fullDate, timeText, type TimeFormat } from "../logic/timeText";

  interface Props {
    time: number;
    format?: TimeFormat;
    live?: boolean;
  }

  let { time, format = "ago", live = true }: Props = $props();

  const clock = useClock(() => live);
  const text = $derived(timeText(time, live ? clock() : Date.now(), format));
</script>

<time class="time" datetime={new Date(time).toISOString()} title={fullDate(time)}>{text}</time>

<style>
  .time {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
