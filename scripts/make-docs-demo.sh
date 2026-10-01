#!/usr/bin/env bash
# Builds the workspace the wiki screenshots are taken in (scripts/screenshots.ts):
#
#   <target>/acme/                     the workspace folder (not itself a repository)
#     storefront/                      history by four people over six weeks: branches, a merge,
#                                      tags, a stash, one commit not pushed, and everyday changes
#     payments-api/                    stopped in a merge with conflicts (make-conflict-repo.sh)
#     notes/                           plain folder, no git
#   <target>/design-system/            a second folder to add to the workspace (its own repository)
#   <target>/remotes/storefront.git    storefront's "origin"
#
# Dates are relative to now, so blame and the log read "2 days ago" whenever it is run.
#
# Usage: scripts/make-docs-demo.sh <target-dir>

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <target-dir>" >&2
  exit 2
fi

target="$1"
if [ -e "$target" ] && [ -n "$(ls -A "$target" 2>/dev/null)" ]; then
  echo "Refusing to use non-empty directory: $target" >&2
  exit 1
fi
mkdir -p "$target"
target="$(cd "$target" && pwd -P)"
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
workspace="$target/acme"
repo="$workspace/storefront"
remote="$target/remotes/storefront.git"
now="$(date +%s)"

g() {
  git -C "$repo" "$@"
}

# commit_as <author> <days ago> <message>: commits everything as that person, at that time.
commit_as() {
  local author="$1" days="$2" message="$3"
  local email
  email="$(printf '%s' "$author" | tr 'A-Z ' 'a-z.')@acme.example"
  local when="$((now - days * 86400)) +0000"
  g add -A
  GIT_AUTHOR_NAME="$author" GIT_AUTHOR_EMAIL="$email" GIT_AUTHOR_DATE="$when" \
    GIT_COMMITTER_NAME="$author" GIT_COMMITTER_EMAIL="$email" GIT_COMMITTER_DATE="$when" \
    g commit -q -m "$message"
}

mkdir -p "$repo/src" "$repo/docs"
git -C "$repo" init -q -b main
g config user.name "Demo User"
g config user.email "demo@example.com"
g config commit.gpgsign false
g config tag.gpgsign false
g config core.hooksPath /dev/null

cat >"$repo/README.md" <<'EOF'
# Storefront

The Acme web shop: catalog, cart and checkout.

```sh
bun install
bun run dev
```
EOF
cat >"$repo/package.json" <<'EOF'
{
  "name": "storefront",
  "version": "1.0.0",
  "private": true
}
EOF
cat >"$repo/src/cart.ts" <<'EOF'
import type { Product } from "./catalog";

export interface CartLine {
  product: Product;
  quantity: number;
}

export class Cart {
  private lines: CartLine[] = [];

  add(product: Product): void {
    this.lines.push({ product, quantity: 1 });
  }

  remove(productId: string): void {
    this.lines = this.lines.filter((line) => line.product.id !== productId);
  }

  get items(): readonly CartLine[] {
    return this.lines;
  }
}
EOF
printf 'export { Cart } from "./cart";\n' >"$repo/src/index.ts"
commit_as "Maya Chen" 42 "Initial storefront skeleton"

cat >"$repo/src/catalog.ts" <<'EOF'
export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

const products: Product[] = [
  { id: "mug", name: "Acme Mug", price: 12.5, image: "/img/mug.webp" },
  { id: "tee", name: "Acme T-shirt", price: 24, image: "/img/tee.webp" },
  { id: "cap", name: "Acme Cap", price: 18, image: "/img/cap.webp" },
];

export function allProducts(): Product[] {
  return products;
}
EOF
commit_as "Leo Park" 38 "Add the product catalog"

cat >"$repo/src/cart.ts" <<'EOF'
import type { Product } from "./catalog";

export interface CartLine {
  product: Product;
  quantity: number;
}

export class Cart {
  private lines: CartLine[] = [];

  /** Adds one more of a product, or a new line for it. */
  add(product: Product, quantity = 1): void {
    const line = this.lines.find((entry) => entry.product.id === product.id);
    if (line) {
      line.quantity += quantity;
      return;
    }
    this.lines.push({ product, quantity });
  }

  remove(productId: string): void {
    this.lines = this.lines.filter((line) => line.product.id !== productId);
  }

  get items(): readonly CartLine[] {
    return this.lines;
  }

  get count(): number {
    return this.lines.reduce((sum, line) => sum + line.quantity, 0);
  }

  subtotal(): number {
    return this.lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  }
}
EOF
commit_as "Maya Chen" 34 "Cart: support quantities and a subtotal"
g tag v1.0.0

g checkout -q -b feature/checkout
cat >"$repo/src/checkout.ts" <<'EOF'
import type { Cart } from "./cart";

export interface Address {
  name: string;
  street: string;
  city: string;
  postcode: string;
  country: string;
}

export function placeOrder(cart: Cart, address: Address): { total: number; address: Address } {
  return { total: cart.subtotal(), address };
}
EOF
commit_as "Priya Nair" 30 "Checkout: address form"
cat >>"$repo/src/checkout.ts" <<'EOF'

const POSTCODE = /^[A-Z0-9][A-Z0-9 -]{2,9}$/i;

export function validPostcode(postcode: string): boolean {
  return POSTCODE.test(postcode.trim());
}
EOF
commit_as "Priya Nair" 27 "Checkout: validate the postcode"

g checkout -q main
cat >>"$repo/src/catalog.ts" <<'EOF'

export function search(query: string): Product[] {
  const needle = query.trim().toLowerCase();
  return products.filter((product) => product.name.toLowerCase().includes(needle));
}
EOF
commit_as "Leo Park" 28 "Catalog: search by name"

when="$((now - 24 * 86400)) +0000"
GIT_AUTHOR_NAME="Maya Chen" GIT_AUTHOR_EMAIL="maya.chen@acme.example" GIT_AUTHOR_DATE="$when" \
  GIT_COMMITTER_NAME="Maya Chen" GIT_COMMITTER_EMAIL="maya.chen@acme.example" GIT_COMMITTER_DATE="$when" \
  g merge -q --no-ff -m "Merge branch 'feature/checkout'" feature/checkout
g branch -q -d feature/checkout

cat >"$repo/src/pricing.ts" <<'EOF'
const DISCOUNT_CODES: Record<string, number> = {
  WELCOME10: 0.1,
  SUMMER20: 0.2,
};

/** The price after a discount code; unknown codes change nothing. */
export function applyDiscount(amount: number, code: string | null): number {
  const rate = code ? (DISCOUNT_CODES[code.toUpperCase()] ?? 0) : 0;
  return amount * (1 - rate);
}
EOF
printf '// Old coupon format, kept until every client sends discount codes.\nexport const LEGACY_COUPONS = ["SPRING5"];\n' >"$repo/src/legacy-coupons.ts"
commit_as "Sam Rivera" 19 "Pricing: add discount codes"
sed -i.bak 's/"version": "1.0.0"/"version": "1.1.0"/' "$repo/package.json" && rm "$repo/package.json.bak"
commit_as "Sam Rivera" 18 "Release 1.1.0"
g tag v1.1.0

cat >"$repo/src/cart.ts" <<'EOF'
import type { Product } from "./catalog";
import { applyDiscount } from "./pricing";

export interface CartLine {
  product: Product;
  quantity: number;
}

export class Cart {
  private lines: CartLine[] = [];
  private discountCode: string | null = null;

  /** Adds one more of a product, or a new line for it. */
  add(product: Product, quantity = 1): void {
    const line = this.lines.find((entry) => entry.product.id === product.id);
    if (line) {
      line.quantity += quantity;
      return;
    }
    this.lines.push({ product, quantity });
  }

  remove(productId: string): void {
    this.lines = this.lines.filter((line) => line.product.id !== productId);
  }

  useDiscount(code: string): void {
    this.discountCode = code;
  }

  get items(): readonly CartLine[] {
    return this.lines;
  }

  get count(): number {
    return this.lines.reduce((sum, line) => sum + line.quantity, 0);
  }

  subtotal(): number {
    return this.lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  }

  /** What the customer pays, rounded to whole cents. */
  total(): number {
    const discounted = applyDiscount(this.subtotal(), this.discountCode);
    return Math.round(discounted * 100) / 100;
  }
}
EOF
commit_as "Leo Park" 12 "Cart: discount codes and totals rounded to cents"

g checkout -q -b fix/tax-rates
cat >"$repo/src/tax.ts" <<'EOF'
export const VAT: Record<string, number> = {
  DE: 0.19,
  FR: 0.2,
  NL: 0.21,
};
EOF
commit_as "Sam Rivera" 9 "Tax: EU VAT rates"
g checkout -q main

cat >"$repo/docs/cart-api.md" <<'EOF'
# Cart API

- `add(product, quantity)` adds a product, merging with an existing line.
- `remove(productId)` removes a line.
- `useDiscount(code)` applies a discount code to the total.
- `total()` is what the customer pays, rounded to cents.
EOF
commit_as "Maya Chen" 6 "Docs: explain the cart API"

# The remote has everything so far; the next commit is only local (1 ahead).
git init -q --bare "$remote"
g remote add origin "$remote"
g push -q origin main fix/tax-rates --tags
g branch -q --set-upstream-to=origin/main main

sed -i.bak 's#image: string;#image: string;\n  /** Loaded when the product scrolls into view. */\n  lazy?: boolean;#' "$repo/src/catalog.ts" && rm "$repo/src/catalog.ts.bak"
commit_as "Priya Nair" 2 "Catalog: lazy load product images"

# A stash, then everyday changes in the work tree: one of each status.
printf 'export const FREE_SHIPPING_FROM = 50;\n' >"$repo/src/shipping.ts"
g add src/shipping.ts
g stash push -q -m "WIP: free shipping threshold"

python3 - "$repo/src/cart.ts" <<'EOF'
import sys
path = sys.argv[1]
text = open(path).read()
text = text.replace(
    "  remove(productId: string): void {\n    this.lines = this.lines.filter((line) => line.product.id !== productId);\n  }\n",
    "  remove(productId: string): void {\n    this.lines = this.lines.filter((line) => line.product.id !== productId);\n  }\n\n  /** Sets the quantity of a line; zero removes it. */\n  setQuantity(productId: string, quantity: number): void {\n    if (quantity <= 0) {\n      this.remove(productId);\n      return;\n    }\n    const line = this.lines.find((entry) => entry.product.id === productId);\n    if (line) {\n      line.quantity = quantity;\n    }\n  }\n",
)
text = text.replace("    return Math.round(discounted * 100) / 100;", "    return Math.max(0, Math.round(discounted * 100) / 100);")
open(path, "w").write(text)
EOF
cat >"$repo/src/shipping.ts" <<'EOF'
/** Orders from this subtotal ship free. */
export const FREE_SHIPPING_FROM = 50;

export function shippingCost(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_FROM ? 0 : 4.95;
}
EOF
g add src/shipping.ts
cat >"$repo/src/wishlist.ts" <<'EOF'
export const wishlist = new Set<string>();
EOF
rm "$repo/src/legacy-coupons.ts"

"$script_dir/make-conflict-repo.sh" "$workspace/payments-api" >/dev/null

mkdir -p "$workspace/notes"
printf '# Team notes\n\nThis folder is not a git repository.\n' >"$workspace/notes/meeting.md"

design="$target/design-system"
mkdir -p "$design/tokens"
git -C "$design" init -q -b main
git -C "$design" config user.name "Demo User"
git -C "$design" config user.email "demo@example.com"
git -C "$design" config commit.gpgsign false
git -C "$design" config core.hooksPath /dev/null
printf ':root {\n  --acme-blue: #2563eb;\n  --acme-radius: 8px;\n}\n' >"$design/tokens/colors.css"
printf '# Design system\n\nShared colors and spacing for Acme apps.\n' >"$design/README.md"
git -C "$design" add -A
git -C "$design" commit -q -m "Design tokens"
printf ':root {\n  --acme-blue: #1d4ed8;\n  --acme-radius: 8px;\n  --acme-gap: 12px;\n}\n' >"$design/tokens/colors.css"

cat <<EOF

Created $workspace:
  storefront     $(g rev-list --count HEAD) commits, 1 ahead of origin, $(g status --short | wc -l | tr -d ' ') changes, 1 stash
  payments-api   stopped in a merge with conflicts
  notes          no git
Also $design, a separate repository to add as a second workspace folder.
EOF
