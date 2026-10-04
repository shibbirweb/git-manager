// Moves an element to the end of <body>, so a fixed popup is not clipped by an ancestor
// that contains it (overflow, or a size container such as the editor's path bar).

export function portal(node: HTMLElement): { destroy(): void } {
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}
