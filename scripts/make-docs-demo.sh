#!/usr/bin/env bash
# Builds the workspace the wiki screenshots are taken in (scripts/screenshots.ts):
#
#   <target>/acme/                     the workspace folder (not itself a repository)
#     storefront/                      history by four people over six weeks: branches, a merge,
#                                      tags, a stash, one commit not pushed, and everyday changes
#     payments-api/                    stopped in a merge with conflicts (make-conflict-repo.sh)
#     notes/                           plain folder, no git, with an image and a PDF for the preview
#   <target>/design-system/            a second folder to add to the workspace (its own repository)
#   <target>/remotes/storefront.git    storefront's "origin"
#   <target>/extras/shop-app/          a submodule themes/acme with new commits and changes
#   <target>/extras/media-site/        images stored with Git LFS (pointer files)
#   <target>/extras/brand-kit/         a logo changed in the work tree (binary image diff)
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
  "private": true,
  "packageManager": "bun@1.2.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "lint": "eslint src"
  }
}
EOF
printf '20\n' >"$repo/.nvmrc"
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
mkdir -p "$repo/docs/images"
cat >"$repo/docs/checkout.md" <<'EOF'
# Checkout

Checkout turns a cart into an order. It reads the totals from [the cart API](cart-api.md) and asks for an address.

## Steps

- [x] Cart totals rounded to cents
- [ ] Discount codes
- [ ] Free shipping from 50

## Prices

| Item | Price | Note |
| --- | --- | --- |
| Acme Mug | 12.50 | Ceramic |
| Acme T-shirt | 24.00 | Organic cotton |
| Acme Cap | 18.00 | One size |

```ts
export function shippingCost(subtotal: number): number {
  const freeFrom = 50;
  return subtotal >= freeFrom ? 0 : 4.95;
}
```

## Flow

```mermaid
flowchart LR
  Cart --> Checkout --> Payment --> Done
```

![Checkout screen](images/checkout.svg)
EOF
cat >"$repo/docs/images/checkout.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200">
  <rect x="1" y="1" width="358" height="198" rx="12" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
  <rect x="1" y="1" width="358" height="40" rx="12" fill="#2563eb"/>
  <rect x="1" y="28" width="358" height="13" fill="#2563eb"/>
  <text x="20" y="27" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#ffffff">Checkout</text>
  <rect x="20" y="60" width="200" height="16" rx="4" fill="#e2e8f0"/>
  <rect x="20" y="88" width="160" height="16" rx="4" fill="#e2e8f0"/>
  <rect x="20" y="116" width="180" height="16" rx="4" fill="#e2e8f0"/>
  <text x="240" y="74" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#334155">Total 54.50</text>
  <rect x="220" y="150" width="120" height="32" rx="8" fill="#16a34a"/>
  <text x="248" y="171" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#ffffff">Pay now</text>
</svg>
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
# An image and a PDF for the image and PDF preview, outside git so no other shot changes.
cp "$script_dir/../src-tauri/icons/icon.png" "$workspace/notes/logo.png"
bun "$script_dir/make-demo-pdf.ts" "$workspace/notes/lorem-ipsum.pdf"

design="$target/design-system"
mkdir -p "$design/tokens"
git -C "$design" init -q -b main
git -C "$design" config user.name "Demo User"
git -C "$design" config user.email "demo@example.com"
git -C "$design" config commit.gpgsign false
git -C "$design" config core.hooksPath /dev/null
printf ':root {\n  --acme-blue: #2563eb;\n  --acme-radius: 8px;\n}\n' >"$design/tokens/colors.css"
printf '# Design system\n\nShared colors and spacing for Acme apps.\n' >"$design/README.md"
# Recipes are indented with tabs, the rest with spaces (the render whitespace shot shows both).
cat >"$design/Makefile" <<'EOF'
# Builds and checks the design tokens.
TOKENS = tokens/colors.css

.PHONY: tokens check

tokens:
	@echo "Building tokens"

check:
	@echo "Checking tokens..."
	@echo "All 12 tokens are valid."
EOF
git -C "$design" add -A
git -C "$design" commit -q -m "Design tokens"
printf ':root {\n  --acme-blue: #1d4ed8;\n  --acme-radius: 8px;\n  --acme-gap: 12px;\n}\n' >"$design/tokens/colors.css"

# Extras, each opened on its own by the submodule and Git LFS shots so the shop workspace stays as it is.
extras="$target/extras"
# extra_repo <dir>: a new repository with the demo identity.
extra_repo() {
  mkdir -p "$1"
  git -C "$1" init -q -b main
  git -C "$1" config user.name "Demo User"
  git -C "$1" config user.email "demo@example.com"
  git -C "$1" config commit.gpgsign false
  git -C "$1" config core.hooksPath /dev/null
}
# extra_commit <dir> <author> <days ago> <message>
extra_commit() {
  local dir="$1" author="$2" days="$3" message="$4"
  local email
  email="$(printf '%s' "$author" | tr 'A-Z ' 'a-z.')@acme.example"
  local when="$((now - days * 86400)) +0000"
  git -C "$dir" add -A
  GIT_AUTHOR_NAME="$author" GIT_AUTHOR_EMAIL="$email" GIT_AUTHOR_DATE="$when" \
    GIT_COMMITTER_NAME="$author" GIT_COMMITTER_EMAIL="$email" GIT_COMMITTER_DATE="$when" \
    git -C "$dir" commit -q -m "$message"
}

# extras/shop-app: a submodule themes/acme with new commits and modified content.
theme_src="$target/remotes/acme-theme-src"
extra_repo "$theme_src"
printf ':root {\n  --theme-accent: #2563eb;\n}\n' >"$theme_src/theme.css"
extra_commit "$theme_src" "Leo Park" 20 "Theme: accent color"
first_theme="$(git -C "$theme_src" rev-parse HEAD)"
printf ':root {\n  --theme-accent: #1d4ed8;\n  --theme-radius: 6px;\n}\n' >"$theme_src/theme.css"
extra_commit "$theme_src" "Leo Park" 10 "Theme: rounder corners"
git clone -q --bare "$theme_src" "$target/remotes/acme-theme.git"
rm -rf "$theme_src"

shop="$extras/shop-app"
extra_repo "$shop"
printf '# Shop app\n\nThe Acme shop, themed by the acme theme.\n' >"$shop/README.md"
extra_commit "$shop" "Maya Chen" 15 "Shop app skeleton"
# A local path as the URL needs file transport, which git turns off for submodules by default.
git -C "$shop" -c protocol.file.allow=always submodule add -q "$target/remotes/acme-theme.git" themes/acme >/dev/null 2>&1
extra_commit "$shop" "Maya Chen" 9 "Add the acme theme as a submodule"
git -C "$shop/themes/acme" checkout -q "$first_theme"
printf '\nbody {\n  margin: 0;\n}\n' >>"$shop/themes/acme/theme.css"

# extras/media-site: images stored with Git LFS as pointer files, so git-lfs need not be installed.
media="$extras/media-site"
extra_repo "$media"
mkdir -p "$media/assets"
printf '*.png filter=lfs diff=lfs merge=lfs -text\n' >"$media/.gitattributes"
printf '# Media site\n\nBig images live in Git LFS.\n' >"$media/README.md"
printf 'version https://git-lfs.github.com/spec/v1\noid sha256:%s\nsize 1536\n' \
  "4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393" >"$media/assets/hero.png"
extra_commit "$media" "Priya Nair" 5 "Hero image in LFS"
printf 'version https://git-lfs.github.com/spec/v1\noid sha256:%s\nsize 2097152\n' \
  "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" >"$media/assets/hero.png"
git -C "$media" add assets/hero.png

# extras/brand-kit: a committed logo replaced by a bigger one in the work tree, for the binary diff preview.
brand="$extras/brand-kit"
extra_repo "$brand"
mkdir -p "$brand/assets"
printf '# Brand kit\n\nLogos and icons.\n' >"$brand/README.md"
cp "$script_dir/../src-tauri/icons/128x128.png" "$brand/assets/logo.png"
extra_commit "$brand" "Maya Chen" 7 "Add the logo"
cp "$script_dir/../src-tauri/icons/128x128@2x.png" "$brand/assets/logo.png"

cat <<EOF

Created $workspace:
  storefront     $(g rev-list --count HEAD) commits, 1 ahead of origin, $(g status --short | wc -l | tr -d ' ') changes, 1 stash
  payments-api   stopped in a merge with conflicts
  notes          no git
Also $design, a separate repository to add as a second workspace folder,
and $extras: shop-app (with a submodule), media-site (Git LFS) and brand-kit (a changed image).
EOF
