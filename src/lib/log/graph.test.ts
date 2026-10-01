import { describe, expect, it } from "vitest";
import { GraphBuilder, rowSegments, type GraphCommit, type GraphRow } from "./graph";

function commit(id: string, ...parents: string[]): GraphCommit {
  return { id, parents };
}

function layout(commits: GraphCommit[]): GraphRow[] {
  return new GraphBuilder().push(commits);
}

function describeRow(row: GraphRow): string[] {
  return rowSegments(row)
    .map((segment) => `${segment.kind}:${segment.from}-${segment.to}`)
    .sort();
}

describe("GraphBuilder", () => {
  it("keeps linear history in a single lane", () => {
    const rows = layout([commit("c", "b"), commit("b", "a"), commit("a")]);
    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(rows.map((row) => row.width)).toEqual([1, 1, 1]);
    expect(new Set(rows.map((row) => row.color)).size).toBe(1);
    expect(describeRow(rows[0])).toEqual(["out:0-0"]);
    expect(describeRow(rows[1])).toEqual(["in:0-0", "out:0-0"]);
    expect(describeRow(rows[2])).toEqual(["in:0-0"]);
  });

  it("lays out a branch and its merge", () => {
    const rows = layout([commit("m", "b", "d"), commit("d", "a"), commit("b", "a"), commit("a")]);
    expect(rows.map((row) => row.lane)).toEqual([0, 1, 0, 0]);
    expect(describeRow(rows[0])).toEqual(["out:0-0", "out:0-1"]);
    expect(describeRow(rows[1])).toEqual(["in:1-1", "out:1-1", "pass:0-0"]);
    expect(describeRow(rows[2])).toEqual(["in:0-0", "out:0-0", "pass:1-1"]);
    expect(describeRow(rows[3])).toEqual(["in:0-0", "in:1-0"]);
    expect(rows[1].color).not.toBe(rows[0].color);
    expect(rows[3].color).toBe(rows[0].color);
    const converge = rowSegments(rows[3]).find((segment) => segment.from === 1);
    expect(converge?.color).toBe(rows[1].color);
    expect(Math.max(...rows.map((row) => row.width))).toBe(2);
  });

  it("handles two branches merged in sequence and reuses freed lanes", () => {
    const rows = layout([
      commit("m2", "c", "f"),
      commit("f", "b"),
      commit("c", "m1"),
      commit("m1", "b", "d"),
      commit("d", "a"),
      commit("b", "a"),
      commit("a"),
      commit("tip", "x"),
    ]);
    expect(rows.map((row) => row.lane)).toEqual([0, 1, 0, 0, 2, 0, 0, 0]);
    expect(describeRow(rows[3])).toEqual(["in:0-0", "out:0-0", "out:0-2", "pass:1-1"]);
    expect(describeRow(rows[5])).toEqual(["in:0-0", "in:1-0", "out:0-0", "pass:2-2"]);
    expect(describeRow(rows[6])).toEqual(["in:0-0", "in:2-0"]);
    expect(rows[6].width).toBe(3);
    expect(describeRow(rows[7])).toEqual(["out:0-0"]);
    expect(rows[7].width).toBe(1);
  });

  it("fans out an octopus merge", () => {
    const rows = layout([
      commit("m", "p1", "p2", "p3", "p4"),
      commit("p1", "r"),
      commit("p2", "r"),
      commit("p3", "r"),
      commit("p4", "r"),
      commit("r"),
    ]);
    expect(describeRow(rows[0])).toEqual(["out:0-0", "out:0-1", "out:0-2", "out:0-3"]);
    expect(rows.map((row) => row.lane)).toEqual([0, 0, 1, 2, 3, 0]);
    expect(describeRow(rows[5])).toEqual(["in:0-0", "in:1-0", "in:2-0", "in:3-0"]);
    expect(new Set(rows.slice(1, 5).map((row) => row.color)).size).toBe(4);
  });

  it("supports multiple roots", () => {
    const rows = layout([commit("a2", "a1"), commit("b2", "b1"), commit("a1"), commit("b1")]);
    expect(rows.map((row) => row.lane)).toEqual([0, 1, 0, 1]);
    expect(describeRow(rows[2])).toEqual(["in:0-0", "pass:1-1"]);
    expect(describeRow(rows[3])).toEqual(["in:1-1"]);
    expect(rows[3].width).toBe(2);

    const merged = layout([commit("m", "x", "y"), commit("x"), commit("y")]);
    expect(merged.map((row) => row.lane)).toEqual([0, 0, 1]);
    expect(describeRow(merged[1])).toEqual(["in:0-0", "pass:1-1"]);
    expect(describeRow(merged[2])).toEqual(["in:1-1"]);
  });

  it("ignores duplicate parents", () => {
    const rows = layout([commit("m", "a", "a"), commit("a")]);
    expect(describeRow(rows[0])).toEqual(["out:0-0"]);
  });

  it("gives the same result when fed page by page", () => {
    const history = randomHistory(400, 7);
    const batch = layout(history);
    for (const split of [1, 37, 150, 399]) {
      const builder = new GraphBuilder();
      const paged = [...builder.push(history.slice(0, split)), ...builder.push(history.slice(split))];
      expect(paged).toEqual(batch);
    }
    const twoPages = new GraphBuilder();
    const first = twoPages.push(history.slice(0, 200));
    const second = twoPages.push(history.slice(200));
    expect([...first, ...second]).toEqual(batch);
    expect(twoPages.maxWidth).toBe(Math.max(...batch.map((row) => row.width)));
  });

  it("only references lanes inside the row width", () => {
    for (const row of layout(randomHistory(300, 3))) {
      expect(row.lane).toBeLessThan(row.width);
      for (const segment of rowSegments(row)) {
        expect(segment.from).toBeLessThan(row.width);
        expect(segment.to).toBeLessThan(row.width);
      }
    }
  });
});

// Deterministic random DAG, emitted newest first like `git log --topo-order`.
function randomHistory(count: number, seed: number): GraphCommit[] {
  let state = seed;
  const random = (): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const oldestFirst: GraphCommit[] = [];
  for (let index = 0; index < count; index++) {
    const parents: string[] = [];
    if (index > 0 && random() > 0.03) {
      parents.push(`c${Math.max(0, index - 1 - Math.floor(random() * 4))}`);
      if (index > 2 && random() < 0.2) {
        parents.push(`c${Math.floor(random() * (index - 1))}`);
      }
    }
    oldestFirst.push({ id: `c${index}`, parents });
  }
  return oldestFirst.reverse();
}
