// BlockElement — base for all block-level elements.
// Port of charmbracelet/glamour/ansi/blockelement.go

import type { StyleBlock } from './style.js';
import { toStylePrimitive } from './style.js';
import type { RenderContext } from './context.js';
import { renderText, wordWrap } from './baseelement.js';
import { MarginWriter } from './writers.js';

/**
 * BlockElement provides a render buffer for children of a block element.
 * After all children have been rendered into it, it applies indentation and
 * margins around them and writes everything to the parent rendering buffer.
 */
export class BlockElement {
  style: StyleBlock;
  marginEnabled: boolean;
  newline: boolean;
  private rootBlockPrefix = '';

  constructor(style: StyleBlock, marginEnabled: boolean = false, newline: boolean = false) {
    this.style = style;
    this.marginEnabled = marginEnabled;
    this.newline = newline;
  }

  /**
   * Render is called when entering the block — pushes onto the block stack.
   */
  render(ctx: RenderContext): void {
    const bs = ctx.blockStack;
    bs.push({
      block: '',
      style: this.style,
      margin: this.marginEnabled,
      newline: this.newline,
    });

    // Write block prefix to parent's output
    if (this.style.block_prefix) {
      const prefixText = renderText(
        this.style.block_prefix,
        toStylePrimitive(bs.parent().style),
        ctx.options.colorProfile,
      );
      if (bs.len() > 1) {
        bs.writeToParentBlock(prefixText);
      } else {
        this.rootBlockPrefix = prefixText;
      }
    }

    // Write prefix to current block's buffer
    if (this.style.prefix) {
      const currentPrim = toStylePrimitive(bs.current().style);
      const prefixText = renderText(
        this.style.prefix,
        currentPrim,
        ctx.options.colorProfile,
      );
      bs.writeToCurrentBlock(prefixText);
    }
  }

  /**
   * Finish is called when leaving the block — word-wraps, applies margin/indent, pops stack.
   */
  finish(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const currentStyle = bs.current().style;
    let result = bs.current().block;

    if (this.marginEnabled) {
      const width = bs.width(ctx.options.wordWrap);
      if (width > 0) result = wordWrap(result, width, ctx.protectedSegments);

      const writer = new MarginWriter(currentStyle.margin || 0);
      writer.write(result);
      result = writer.flush();
      if (this.newline) result += '\n';
    }

    const suffix = currentStyle.suffix
      ? renderText(
          currentStyle.suffix,
          toStylePrimitive(currentStyle),
          ctx.options.colorProfile,
        )
      : '';
    const blockSuffix = currentStyle.block_suffix
      ? renderText(
          currentStyle.block_suffix,
          toStylePrimitive(bs.parent().style),
          ctx.options.colorProfile,
        )
      : '';

    bs.resetCurrentBlock();
    bs.pop();
    const output = this.rootBlockPrefix + result + suffix + blockSuffix;
    this.rootBlockPrefix = '';

    if (bs.len() > 0) {
      bs.writeToCurrentBlock(output);
      return '';
    }
    return ctx.unprotectSegments(output);
  }
}
