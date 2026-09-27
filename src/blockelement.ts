// BlockElement — base for all block-level elements.
// Port of charmbracelet/glamour/ansi/blockelement.go

import type { StyleBlock } from './style.js';
import { toStylePrimitive } from './style.js';
import type { RenderContext } from './context.js';
import { renderText } from './baseelement.js';
import { StringWriter, wrap } from './ansi.js';
import { frameWriter } from './blockstack.js';
import { MarginWriter } from './writers.js';

/**
 * BlockElement provides a render buffer for children of a block element.
 * After all children have been rendered into it, it applies indentation and
 * margins around them and writes everything to the parent rendering buffer.
 *
 * `render` and `finish` return what upstream writes to the `w` writer it is
 * handed (the enclosing block's buffer, or the final output for the document).
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

  /** Render is called when entering the block — pushes it onto the block stack. */
  render(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const profile = ctx.options.colorProfile;
    bs.push({ block: '', style: this.style, margin: this.marginEnabled, newline: this.newline });

    const out = renderText(this.style.block_prefix ?? '', toStylePrimitive(bs.parent().style), profile);
    bs.writeToCurrentBlock(
      renderText(this.style.prefix ?? '', toStylePrimitive(bs.current().style), profile),
    );
    return out;
  }

  /**
   * Finish is called when leaving the block: wraps the buffered children to
   * the available width, applies indentation (indent + margin, drawn with the
   * block's indent_token) and padding, then pops the block.
   */
  finish(ctx: RenderContext): string {
    const bs = ctx.blockStack;
    const profile = ctx.options.colorProfile;
    const w = new StringWriter();
    const current = bs.current();

    let mw: MarginWriter | undefined;
    if (this.marginEnabled) {
      const s = wrap(current.block, bs.width(ctx.options.wordWrap), ' ,.;-+|');
      mw = new MarginWriter(ctx, w, current.style);
      mw.write(s);
      if (this.newline) mw.write('\n');
    } else {
      frameWriter(bs.parent()).write(current.block);
    }

    w.write(renderText(this.style.suffix ?? '', toStylePrimitive(current.style), profile));
    w.write(renderText(this.style.block_suffix ?? '', toStylePrimitive(bs.parent().style), profile));

    bs.resetCurrentBlock();
    bs.pop();
    mw?.close(); // deferred upstream: runs after the suffixes are written
    return w.value;
  }
}
