// Renderer — AST walker that produces ANSI-styled terminal output.
// Port of charmbracelet/glamour/ansi/renderer.go

import type { Node } from './parser.js';
import { RenderContext, type RenderOptions } from './context.js';
import { newElement, isChildNode, type Element } from './elements.js';


/**
 * Walk the AST depth-first and render each node using its element.
 * This follows the same two-pass (entering/exiting) pattern as the Go version.
 */
function walkNode(
  node: Node,
  ctx: RenderContext,
  result: { output: string },
): void {
  const bs = ctx.blockStack;

  // Children nodes are rendered by their parent element — skip them
  if (isChildNode(node)) {
    return;
  }

  const element = newElement(node, ctx);

  // ── Entering phase ──
  {
    const useBlock = bs.len() > 0;

    if (element.entering) {
      if (useBlock) {
        bs.writeToCurrentBlock(element.entering);
      }
    }

    if (element.renderer) {
      const depthBeforeRender = bs.len();
      const output = element.renderer.render(ctx);
      if (output && bs.len() > 0) {
        if (bs.len() > depthBeforeRender && depthBeforeRender > 0) {
          bs.writeToParentBlock(output);
        } else {
          bs.writeToCurrentBlock(output);
        }
      }
    }
  }

  // ── Recurse into children ──
  if (node.children) {
    for (const child of node.children) {
      walkNode(child, ctx, result);
    }
  }

  // ── Exiting phase ──
  {
    const isDocument = node.kind === 'document';
    if (element.finisher) {
      const output = element.finisher.finish(ctx);
      if (output) {
        if (bs.len() > 0) {
          bs.writeToCurrentBlock(output);
        } else if (isDocument) {
          result.output += output;
        }
      }
    }

    if (element.exiting) {
      if (bs.len() > 0) {
        bs.writeToCurrentBlock(element.exiting);
      }
    }
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
  const result = { output: '' };
  walkNode(root, ctx, result);
  if (bs_hasContent(ctx)) return ctx.blockStack.current().block;
  return result.output;
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

function bs_hasContent(ctx: RenderContext): boolean {
  return ctx.blockStack.len() > 0 && ctx.blockStack.current().block.length > 0;
}

/**
 * Convenience function: create a RenderContext and render nodes.
 */
export function render(root: Node, options: RenderOptions): string {
  const ctx = new RenderContext(options);
  return renderNodes(root, ctx);
}
