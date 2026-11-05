/**
 * Makes everything on the page inert except `kept` and its ancestors: what a
 * modal leaves reachable is only itself. Elements already inert are left as
 * they are (React may own their attribute). Returns how to undo it.
 */
export function inertOutside(kept: Element): () => void {
  const made: Element[] = [];
  const body = kept.ownerDocument.body;
  for (let node = kept; node !== body;) {
    const parent = node.parentElement;
    if (parent === null) break;
    for (const sibling of parent.children) {
      if (sibling !== node && !sibling.hasAttribute("inert")) {
        sibling.setAttribute("inert", "");
        made.push(sibling);
      }
    }
    node = parent;
  }
  return () => {
    for (const element of made) element.removeAttribute("inert");
  };
}
