// Renderer — AST walker that produces ANSI-styled terminal output.
// Port of charmbracelet/glamour/ansi/renderer.go

import type { Node } from './parser.js';
import { RenderContext, type RenderOptions } from './context.js';
import { newElement, isChildNode, type Element } from './elements.js';

/** Internal result holder — captures final output when the document block finishes. */
let _finalOutput = '';

/**
 * Walk the AST depth-first and render each node using its element.
 * This follows the same two-pass (entering/exiting) pattern as the Go version.
 */
function walkNode(node: Node, ctx: RenderContext): void {
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
      const output = element.renderer.render(ctx);
      if (output && bs.len() > 0) {
        bs.writeToCurrentBlock(output);
      }
    }
  }

  // ── Recurse into children ──
  if (node.children) {
    for (const child of node.children) {
      walkNode(child, ctx);
    }
  }

  // ── Exiting phase ──
  {
    // For the document node: capture block content before finisher pops the stack
    const isDocument = node.kind === 'document';
    if (isDocument && bs.len() > 0) {
      _finalOutput = bs.current().block;
    }

    if (element.finisher) {
      const output = element.finisher.finish(ctx);
      if (output) {
        if (bs.len() > 0) {
          bs.writeToCurrentBlock(output);
        } else if (isDocument) {
          // The finisher returned content after popping — append to final output
          _finalOutput += output;
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
  _finalOutput = '';
  walkNode(root, ctx);

  // If the stack still has content (document didn't finish properly), grab it
  if (bs_hasContent(ctx)) {
    return ctx.blockStack.current().block;
  }

  return _finalOutput;
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
