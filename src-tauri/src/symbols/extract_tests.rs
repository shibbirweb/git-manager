use super::*;

/// `(name, kind, line, container)` of every definition, in order.
fn found(language: Language, text: &str) -> Vec<(String, SymbolKind, u32, Option<String>)> {
    let mut out = Vec::new();
    extract(language, text, &mut |definition| {
        out.push((
            definition.name.to_string(),
            definition.kind,
            definition.line,
            definition.container.map(str::to_string),
        ));
    });
    out
}

fn def(name: &str, kind: SymbolKind, line: u32, container: Option<&str>) -> (String, SymbolKind, u32, Option<String>) {
    (name.to_string(), kind, line, container.map(str::to_string))
}

use SymbolKind::*;

#[test]
fn languages_by_extension() {
    assert_eq!(language_for("src/a.ts"), Some(Language::Script));
    assert_eq!(language_for("src/App.SVELTE"), Some(Language::Markup));
    assert_eq!(language_for("lib/x.rs"), Some(Language::Rust));
    assert_eq!(language_for("include/x.hpp"), Some(Language::C));
    assert_eq!(language_for("dist/app.min.js"), None);
    assert_eq!(language_for("README.md"), None);
    assert_eq!(language_for("Makefile"), None);
}

#[test]
fn typescript() {
    let text = r#"import { x } from "y";
export interface CartItem {
  id: string;
  total(): number;
}
export type Id = string;
export enum Color { Red }
export const MAX_ITEMS = 10;
export const addItem = async (cart: Cart, item: CartItem) => {
  const local = () => 1;
};
export default class Cart extends Base {
  private items: CartItem[] = [];
  static create(): Cart {
    return new Cart();
  }
  constructor() {
    super();
  }
  get size() {
    return this.items.length;
  }
  handleClick = () => {
    this.add();
  };
  async add(item: CartItem): Promise<void> {
    if (item) {
      this.items.push(item);
    }
  }
}
function helper<T>(value: T): T {
  const message = `cart ${value} {`;
  return value;
}
let counter = 0;
"#;
    assert_eq!(
        found(Language::Script, text),
        [
            def("CartItem", Interface, 2, None),
            def("total", Method, 4, Some("CartItem")),
            def("Id", Type, 6, None),
            def("Color", Enum, 7, None),
            def("MAX_ITEMS", Constant, 8, None),
            def("addItem", Function, 9, None),
            def("Cart", Class, 12, None),
            def("create", Method, 14, Some("Cart")),
            def("size", Method, 20, Some("Cart")),
            def("handleClick", Method, 23, Some("Cart")),
            def("add", Method, 26, Some("Cart")),
            def("helper", Function, 32, None),
        ]
    );
}

#[test]
fn svelte_script_blocks_only() {
    let text = r#"<script lang="ts">
  import Icon from "./Icon.svelte";
  let { name }: { name: string } = $props();
  const shown = $derived(name.length > 0);
  function select(index: number): void {
    console.log(index);
  }
</script>

<div class="row">function notCode() {}</div>
"#;
    assert_eq!(
        found(Language::Markup, text),
        [def("shown", Constant, 4, None), def("select", Function, 5, None)]
    );
}

#[test]
fn php() {
    let text = r#"<?php
namespace App\Models;

interface HasTotal {}
trait Countable {}
enum Suit: string {
    case Hearts = 'H';
}
final class Cart extends Model implements HasTotal
{
    const MAX = 10;
    public static function make(): self
    {
        return new self();
    }
    private function &items(): array { return []; }
}
function cart_helper() {}
"#;
    assert_eq!(
        found(Language::Php, text),
        [
            def("HasTotal", Interface, 4, None),
            def("Countable", Trait, 5, None),
            def("Suit", Enum, 6, None),
            def("Cart", Class, 9, None),
            def("MAX", Constant, 11, Some("Cart")),
            def("make", Method, 12, Some("Cart")),
            def("items", Method, 16, Some("Cart")),
            def("cart_helper", Function, 18, None),
        ]
    );
}

#[test]
fn python() {
    let text = r#"MAX_ITEMS = 10
value = 3

class Cart(Base):
    """A cart.

    class NotReal:
    """
    def add(self, item):
        def local():
            pass
        return item

    @property
    async def total(self):
        return 0

def helper(
    cart,
    class_name=None,
):
    pass
"#;
    assert_eq!(
        found(Language::Python, text),
        [
            def("MAX_ITEMS", Constant, 1, None),
            def("Cart", Class, 4, None),
            def("add", Method, 9, Some("Cart")),
            def("total", Method, 15, Some("Cart")),
            def("helper", Function, 18, None),
        ]
    );
}

#[test]
fn rust() {
    let text = r##"use std::fmt;

pub(crate) const MAX: usize = 10;
pub struct Cart<'a> {
    items: Vec<&'a str>,
}
pub enum Kind { A, B }
pub trait Total {
    fn total(&self) -> u32;
}
impl<'a> fmt::Display for Cart<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let brace = '{';
        let text = "a { b";
        let raw = r#"}"#;
        write!(f, "{}", self.items.len())
    }
}
impl Cart<'_>
where
    Self: Sized,
{
    pub const fn new() -> Self {
        Cart { items: Vec::new() }
    }
}
type Id = u64;
static mut COUNT: u32 = 0;
mod tests {
    #[test]
    fn adds() {}
}
pub async unsafe fn helper() {}
"##;
    assert_eq!(
        found(Language::Rust, text),
        [
            def("MAX", Constant, 3, None),
            def("Cart", Struct, 4, None),
            def("Kind", Enum, 7, None),
            def("Total", Trait, 8, None),
            def("total", Method, 9, Some("Total")),
            def("fmt", Method, 12, Some("Cart")),
            def("new", Method, 23, Some("Cart")),
            def("Id", Type, 27, None),
            def("COUNT", Constant, 28, None),
            def("tests", Module, 29, None),
            def("adds", Function, 31, Some("tests")),
            def("helper", Function, 33, None),
        ]
    );
}

#[test]
fn go() {
    let text = r#"package cart

const MaxItems = 10

const (
	Red Color = iota
	Blue
)

type (
	Item struct {
		Name string
	}
	ID string
)

type Cart struct {
	items []Item
}

type Store interface {
	Load() error
}

func (c *Cart) Add(item Item) error {
	return nil
}

func (s Set[T]) Has(value T) bool { return true }

func NewCart(
	size int,
) *Cart {
	return &Cart{}
}
"#;
    assert_eq!(
        found(Language::Go, text),
        [
            def("MaxItems", Constant, 3, None),
            def("Red", Constant, 6, None),
            def("Blue", Constant, 7, None),
            def("Item", Struct, 11, None),
            def("ID", Type, 14, None),
            def("Cart", Struct, 17, None),
            def("Store", Interface, 21, None),
            def("Add", Method, 25, Some("Cart")),
            def("Has", Method, 29, Some("Set")),
            def("NewCart", Function, 31, None),
        ]
    );
}

#[test]
fn java() {
    let text = r#"package shop;

@Entity
public final class Cart extends Base implements Total {
    public static final int MAX = 10;
    private final List<Item> items = new ArrayList<>();

    public Cart() {
        super();
    }

    @Override
    public <T> List<T> add(T item) throws Exception {
        if (item != null) {
            items.add(item);
        }
        return null;
    }

    interface Listener {
        void changed(Cart cart);
    }

    enum State { OPEN, CLOSED }
}

record Point(int x, int y) {}
"#;
    assert_eq!(
        found(Language::Java, text),
        [
            def("Cart", Class, 4, None),
            def("MAX", Constant, 5, Some("Cart")),
            def("add", Method, 13, Some("Cart")),
            def("Listener", Interface, 20, Some("Cart")),
            def("changed", Method, 21, Some("Listener")),
            def("State", Enum, 24, Some("Cart")),
            def("Point", Record, 27, None),
        ]
    );
}

#[test]
fn kotlin() {
    let text = r#"package shop

const val MAX_ITEMS = 10

data class Point(val x: Int, val y: Int)

sealed interface Shape

enum class Color { RED, GREEN }

class Cart(private val items: MutableList<Item>) : Base() {
    fun add(item: Item) {
        items.add(item)
    }

    companion object {
        fun empty(): Cart = Cart(mutableListOf())
    }
}

object Registry {
    suspend fun load() {}
}

fun <T> List<T>.second(): T = this[1]
typealias Items = List<Item>
"#;
    assert_eq!(
        found(Language::Kotlin, text),
        [
            def("MAX_ITEMS", Constant, 3, None),
            def("Point", Class, 5, None),
            def("Shape", Interface, 7, None),
            def("Color", Enum, 9, None),
            def("Cart", Class, 11, None),
            def("add", Method, 12, Some("Cart")),
            def("empty", Method, 17, Some("Cart")),
            def("Registry", Object, 21, None),
            def("load", Method, 22, Some("Registry")),
            def("second", Function, 25, None),
            def("Items", Type, 26, None),
        ]
    );
}

#[test]
fn csharp() {
    let text = r#"using System;

namespace Shop.Models
{
    [Serializable]
    public sealed partial class Cart : ICart
    {
        public const int Max = 10;
        public int Count { get; set; }

        public Cart() { }

        public async Task<int> AddAsync(Item item)
        {
            return 1;
        }
    }

    public interface ICart
    {
        Task<int> AddAsync(Item item);
    }

    public record struct Point(int X, int Y);
    internal enum State { Open }
}
"#;
    assert_eq!(
        found(Language::CSharp, text),
        [
            def("Cart", Class, 6, Some("Shop.Models")),
            def("Max", Constant, 8, Some("Cart")),
            def("AddAsync", Method, 13, Some("Cart")),
            def("ICart", Interface, 19, Some("Shop.Models")),
            def("AddAsync", Method, 21, Some("ICart")),
            def("Point", Record, 24, Some("Shop.Models")),
            def("State", Enum, 25, Some("Shop.Models")),
        ]
    );
}

#[test]
fn ruby() {
    let text = r#"module Shop
  VERSION = "1.0"

  class Cart < Base
    def add(item)
      items << item
    end

    def self.empty?
      true
    end

    private def secret
    end
  end
end

def helper
end
"#;
    assert_eq!(
        found(Language::Ruby, text),
        [
            def("Shop", Module, 1, None),
            def("VERSION", Constant, 2, Some("Shop")),
            def("Cart", Class, 4, Some("Shop")),
            def("add", Method, 5, Some("Cart")),
            def("empty?", Method, 9, Some("Cart")),
            def("secret", Method, 13, Some("Cart")),
            def("helper", Function, 18, None),
        ]
    );
}

#[test]
fn swift() {
    let text = r#"import Foundation

public protocol Totaling {
    func total() -> Int
}

@MainActor
final class Cart: Totaling {
    private(set) var items: [Item] = []

    func total() -> Int {
        return items.count
    }

    class func make() -> Cart { Cart() }
}

struct Point { var x: Int }
enum Color { case red }
extension Cart {
    func clear() {}
}
typealias Items = [Item]
"#;
    assert_eq!(
        found(Language::Swift, text),
        [
            def("Totaling", Protocol, 3, None),
            def("total", Method, 4, Some("Totaling")),
            def("Cart", Class, 8, None),
            def("total", Method, 11, Some("Cart")),
            def("make", Method, 15, Some("Cart")),
            def("Point", Struct, 18, None),
            def("Color", Enum, 19, None),
            def("clear", Method, 21, Some("Cart")),
            def("Items", Type, 23, None),
        ]
    );
}

#[test]
fn c_and_cpp() {
    let text = r#"#include <stdio.h>
#define MAX_ITEMS 10

struct point;
struct point {
    int x;
};

static int helper(int value);

struct point *make_point(int x) {
    return NULL;
}

int main(int argc, char **argv)
{
    if (argc > 1) {
        return 1;
    }
    return 0;
}

namespace shop {
class Cart : public Base {
public:
    Cart();
    virtual ~Cart();
    void add(const Item& item);
    int size() const { return n; }
};

void Cart::add(const Item& item) {
}

Cart::Cart() : n(0) {}
}

enum class Color : int { Red };
"#;
    assert_eq!(
        found(Language::C, text),
        [
            def("MAX_ITEMS", Constant, 2, None),
            def("point", Struct, 5, None),
            def("make_point", Function, 11, None),
            def("main", Function, 15, None),
            def("Cart", Class, 24, Some("shop")),
            def("add", Method, 28, Some("Cart")),
            def("size", Method, 29, Some("Cart")),
            def("add", Method, 32, Some("Cart")),
            def("Color", Enum, 38, None),
        ]
    );
}

#[test]
fn columns_are_utf16_and_long_lines_are_skipped() {
    let text = "fun Café.extension() {}\nfun ok() {}\n";
    let mut columns = Vec::new();
    extract(Language::Kotlin, text, &mut |definition| columns.push((definition.name, definition.column)));
    assert_eq!(columns, [("extension", 9), ("ok", 4)]);

    let long = format!("function {}() {{}}\nfunction after() {{}}\n", "x".repeat(MAX_LINE));
    let names: Vec<String> = found(Language::Script, &long).into_iter().map(|(name, ..)| name).collect();
    assert_eq!(names, ["after"]);
}
