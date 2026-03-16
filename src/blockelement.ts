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
      const parentPrim = toStylePrimitive(bs.parent().style);
      const prefixText = renderText(this.style.block_prefix, parentPrim);
      if (bs.len() > 1) {
        bs.writeToParentBlock(prefixText);
      }
    }

    // Write prefix to current block's buffer
    if (this.style.prefix) {
      const currentPrim = toStylePrimitive(bs.current().style);
      const prefixText = renderText(this.style.prefix, currentPrim);
      bs.writeToCurrentBlock(prefixText);
    }
  }

  /**
   * Finish is called when leaving the block — word-wraps, applies margin/indent, pops stack.
   */
  finish(ctx: RenderContext): void {
    const bs = ctx.blockStack;

    if (this.marginEnabled) {
      // Word-wrap the buffer content
      const width = bs.width(ctx.options.wordWrap);
      let content = bs.current().block;

      if (width > 0) {
        content = wordWrap(content, width);
      }

      // Apply margin via MarginWriter
      const marginSize = bs.current().style.margin || 0;
      const mw = new MarginWriter(marginSize);
      mw.write(content);
      let result = mw.flush();
      if (this.newline) {
        result += '\n';
      }

      // Capture suffix/block_suffix before popping
      const currentStyle = bs.current().style;
      const suffixText = currentStyle.suffix
        ? renderText(currentStyle.suffix, toStylePrimitive(currentStyle))
        : '';
      const blockSuffixText = currentStyle.block_suffix
        ? renderText(currentStyle.block_suffix, toStylePrimitive(bs.parent().style))
        : '';

      bs.resetCurrentBlock();
      bs.pop();

      // Write result to what is now the current block (was parent)
      bs.writeToCurrentBlock(result);
      if (suffixText) bs.writeToCurrentBlock(suffixText);
      if (blockSuffixText) bs.writeToCurrentBlock(blockSuffixText);
    } else {
      // No margin — just copy buffer to parent
      const content = bs.current().block;
      const currentStyle = bs.current().style;
      const suffixText = currentStyle.suffix
        ? renderText(currentStyle.suffix, toStylePrimitive(currentStyle))
        : '';
      const blockSuffixText = currentStyle.block_suffix
        ? renderText(currentStyle.block_suffix, toStylePrimitive(bs.parent().style))
        : '';

      bs.resetCurrentBlock();
      bs.pop();

      bs.writeToCurrentBlock(content);
      if (suffixText) bs.writeToCurrentBlock(suffixText);
      if (blockSuffixText) bs.writeToCurrentBlock(blockSuffixText);
    }
  }
}
