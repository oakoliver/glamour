// Renderer — AST walker that produces ANSI-styled terminal output.
// Port of charmbracelet/glamour/ansi/renderer.go

import type { Node } from './parser.js';
import { RenderContext, type RenderOptions } from './context.js';
import { newElement, isChildNode } from './elements.js';
import { StringWriter, type Writer } from './ansi.js';
import { frameWriter } from './blockstack.js';

/** A writer that discards everything (a throwaway bytes.Buffer upstream). */
const discard: Writer = { write: () => undefined };

/**
 * Walk the AST depth-first, rendering each node on entry and finishing it on
 * exit, exactly like ANSIRenderer.renderNode.
 *
 * Everything below the document is rendered into the current block's buffer;
 * the document's finisher writes the final output to `out`.
 */
function walkNode(node: Node, ctx: RenderContext, out: Writer): void {
  const bs = ctx.blockStack;

  // children get rendered by their parent
  if (isChildNode(node)) return;

  const e = newElement(node, ctx);

  // entering
  {
    const writeTo = bs.len() > 0 ? frameWriter(bs.current()) : out;
    writeTo.write(e.entering ?? '');
    if (e.renderer) writeTo.write(e.renderer.render(ctx));
  }

  for (const child of node.children) walkNode(child, ctx, out);

  // exiting
  {
    let writeTo = bs.len() > 0 ? frameWriter(bs.parent()) : out;
    // if we're finished rendering the entire document, flush to the real writer
    if (node.kind === 'document') writeTo = out;
    if (e.finisher) writeTo.write(e.finisher.finish(ctx));
    (bs.len() > 0 ? frameWriter(bs.current()) : discard).write(e.exiting ?? '');
  }
}

/**
 * Render an AST tree to ANSI-styled terminal output.
 *
 * @param root - The root node of the parsed markdown AST
 * @param ctx - The rendering context with styles and options
 * @returns The rendered ANSI string
 */
export function renderNodes(root: Node, ctx: RenderContext): string {
  const out = new StringWriter();
  walkNode(root, ctx, out);
  return out.value;
}

/** Stateful ANSI AST renderer, equivalent to upstream ansi.ANSIRenderer. */
export class ANSIRenderer {
  readonly context: RenderContext;

  constructor(options: RenderOptions) {
    this.context = new RenderContext(options);
  }

  render(root: Node): string {
    return renderNodes(root, this.context);
  }
}

export function newRenderer(options: RenderOptions): ANSIRenderer {
  return new ANSIRenderer(options);
}

/**
 * Convenience function: create a RenderContext and render nodes.
 */
export function render(root: Node, options: RenderOptions): string {
  const ctx = new RenderContext(options);
  return renderNodes(root, ctx);
}
