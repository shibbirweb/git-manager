import { describe, expect, it } from "vitest";
import { fileNamespace, foldLabel, scopeName } from "./foldLabel";

describe("scopeName", () => {
  it("names types and modules", () => {
    expect(scopeName("class DistrictController extends Controller")).toBe("DistrictController");
    expect(scopeName("export interface CartLine {")).toBe("CartLine");
    expect(scopeName("impl Display for Point {")).toBe("Display");
    expect(scopeName("pub struct Repo {")).toBe("Repo");
  });

  it("names functions and methods with parentheses", () => {
    expect(scopeName("    public function store(StoreDistrictRequest $request)")).toBe("store()");
    expect(scopeName("export async function loadLog(repoPath: string) {")).toBe("loadLog()");
    expect(scopeName("pub fn details(repo: &Repository) -> AppResult<()> {")).toBe("details()");
    expect(scopeName("def search(self, query):")).toBe("search()");
    expect(scopeName("func (r *Repo) Open(path string) error {")).toBe("Open()");
    expect(scopeName("  subtotal(): number {")).toBe("subtotal()");
    expect(scopeName("  get count(): number {")).toBe("count()");
    expect(scopeName("const toggle = (open: boolean) => {")).toBe("toggle()");
  });

  it("skips blocks that declare nothing", () => {
    expect(scopeName("    if ($request->filled('id')) {")).toBeNull();
    expect(scopeName("  for (const line of lines) {")).toBeNull();
    expect(scopeName("  } catch (error) {")).toBeNull();
    expect(scopeName("{")).toBeNull();
    expect(scopeName("  return {")).toBeNull();
  });

  it("names markdown sections by their heading", () => {
    expect(scopeName("## Merge commits")).toBe("Merge commits");
  });

  it("cuts very long names", () => {
    expect(scopeName(`class ${"A".repeat(80)} {`)?.length).toBe(60);
  });
});

describe("foldLabel", () => {
  it("joins the names outermost first, after the namespace", () => {
    const headers = ["class DistrictController extends Controller", "    public function store(Request $request)"];
    expect(foldLabel(headers, "\\App\\Http\\Controllers\\Api")).toBe(
      "\\App\\Http\\Controllers\\Api > DistrictController > store()",
    );
    expect(foldLabel(["export class Cart {", "  if (x) {"], null)).toBe("Cart");
  });

  it("gives nothing outside any named block, even with a namespace", () => {
    expect(foldLabel([], "\\App")).toBeNull();
    expect(foldLabel(["  if (x) {"], null)).toBeNull();
  });
});

describe("fileNamespace", () => {
  it("reads PHP namespaces and Java packages", () => {
    expect(fileNamespace("namespace App\\Http\\Controllers\\Api;")).toBe("\\App\\Http\\Controllers\\Api");
    expect(fileNamespace("package com.acme.shop;")).toBe("com.acme.shop");
    expect(fileNamespace("namespace Foo {")).toBeNull();
  });
});
