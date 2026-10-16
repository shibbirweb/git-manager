<script lang="ts">
  import Card from "$ui/components/Card.svelte";
  import PatchView from "$ui/components/PatchView.svelte";

  const patch = [
    "diff --git a/src/cart.ts b/src/cart.ts",
    "--- a/src/cart.ts",
    "+++ b/src/cart.ts",
    "@@ -10,5 +10,6 @@ export function total(items: Item[]) {",
    "   const subtotal = sum(items);",
    "-  const tax = subtotal * 0.2;",
    "+  const tax = Math.round(subtotal * 0.2 * 100) / 100;",
    "+  log(tax);",
    "   return subtotal + tax;",
    " }",
  ].join("\n");
</script>

<Card label="Patch">
  <PatchView label="Change to total()" {patch} note="... the diff is cut short; open the commit to see all of it" />
</Card>
