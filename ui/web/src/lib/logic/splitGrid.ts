// Editor groups placed by fractions of the editor area (from the app's split tree), with half a panel gap kept on
// every inner edge so rounded panels sit apart, and the splitters' lines between them.

export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridSplitter {
  id: string;
  direction: "right" | "down";
  rect: GridRect;
  ratio: number;
}

export interface GridBox {
  left: string;
  top: string;
  width: string;
  height: string;
}

const EPSILON = 0.0001;
const GAP = "var(--split-grid-gap-half)";

/** Whether each edge of a group touches another group (inner) or the area's edge. */
export function innerEdges(rect: GridRect): { left: boolean; top: boolean; right: boolean; bottom: boolean } {
  return {
    left: rect.x > EPSILON,
    top: rect.y > EPSILON,
    right: rect.x + rect.width < 1 - EPSILON,
    bottom: rect.y + rect.height < 1 - EPSILON,
  };
}

/** A group's box as CSS lengths, kept half a gap away from its neighbors. */
export function groupBox(rect: GridRect): GridBox {
  const edges = innerEdges(rect);
  const edge = (inner: boolean) => (inner ? GAP : "0px");
  return {
    left: `calc(${rect.x * 100}% + ${edge(edges.left)})`,
    top: `calc(${rect.y * 100}% + ${edge(edges.top)})`,
    width: `calc(${rect.width * 100}% - ${edge(edges.left)} - ${edge(edges.right)})`,
    height: `calc(${rect.height * 100}% - ${edge(edges.top)} - ${edge(edges.bottom)})`,
  };
}

/** Where a splitter's line runs: across its split at the ratio. */
export function splitterBox(splitter: GridSplitter): Partial<GridBox> {
  const { rect, ratio } = splitter;
  if (splitter.direction === "right") {
    const left = `${(rect.x + rect.width * ratio) * 100}%`;
    return { left, top: `${rect.y * 100}%`, height: `${rect.height * 100}%` };
  }
  return { top: `${(rect.y + rect.height * ratio) * 100}%`, left: `${rect.x * 100}%`, width: `${rect.width * 100}%` };
}
