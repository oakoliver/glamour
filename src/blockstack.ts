// BlockStack — manages a stack of block-level elements during rendering.
// Port of charmbracelet/glamour/ansi/blockstack.go

import type { StyleBlock, StylePrimitive } from './style.js';
import { cascadeStyle } from './style.js';

/**
 * BlockFrame represents a single frame on the block stack.
 * Each block-level element (document, heading, paragraph, etc.) pushes a frame.
 */
export interface BlockFrame {
  block: string;         // accumulated output buffer for this block
  style: StyleBlock;
  margin: boolean;
  newline: boolean;
}

/**
 * BlockStack is a stack of block frames, used to calculate the current
 * indentation & margin level during the rendering process.
 */
export class BlockStack {
  private stack: BlockFrame[] = [];

  /** Returns the length of the stack. */
  len(): number {
    return this.stack.length;
  }

  /** Push appends a frame to the stack. */
  push(frame: BlockFrame): void {
    this.stack.push(frame);
  }

  /** Pop removes the last frame on the stack. */
  pop(): void {
    if (this.stack.length === 0) return;
    this.stack.pop();
  }

  /** Returns the current (top) frame. If empty, returns a default frame. */
  current(): BlockFrame {
    if (this.stack.length === 0) {
      return { block: '', style: {}, margin: false, newline: false };
    }
    return this.stack[this.stack.length - 1];
  }

  /** Returns the parent frame (one below top). If only one, returns default. */
  parent(): BlockFrame {
    if (this.stack.length <= 1) {
      return { block: '', style: {}, margin: false, newline: false };
    }
    return this.stack[this.stack.length - 2];
  }

  /** Returns the current indentation level of all elements in the stack. */
  indent(): number {
    let i = 0;
    for (const frame of this.stack) {
      if (frame.style.indent !== undefined) {
        i += frame.style.indent;
      }
    }
    return i;
  }

  /** Returns the current margin level of all elements in the stack. */
  margin(): number {
    let i = 0;
    for (const frame of this.stack) {
      if (frame.style.margin !== undefined) {
        i += frame.style.margin;
      }
    }
    return i;
  }

  /** Returns the available rendering width. */
  width(wordWrap: number): number {
    const totalUsed = this.indent() + this.margin() * 2;
    if (totalUsed > wordWrap) return 0;
    return wordWrap - totalUsed;
  }

  /**
   * With returns a StylePrimitive that inherits the current frame's style,
   * cascaded with a child StylePrimitive.
   */
  withStyle(child: StylePrimitive): StylePrimitive {
    const sb: StyleBlock = { ...child };
    return cascadeStyle(this.current().style, sb, false);
  }

  /** Write text to the current block's buffer. */
  writeToCurrentBlock(text: string): void {
    if (this.stack.length === 0) return;
    this.stack[this.stack.length - 1].block += text;
  }

  /** Write text to the parent block's buffer. */
  writeToParentBlock(text: string): void {
    if (this.stack.length <= 1) {
      // no parent — this shouldn't happen in normal usage
      return;
    }
    this.stack[this.stack.length - 2].block += text;
  }

  /** Reset the current block's buffer. */
  resetCurrentBlock(): void {
    if (this.stack.length === 0) return;
    this.stack[this.stack.length - 1].block = '';
  }
}
