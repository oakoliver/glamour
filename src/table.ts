// table.ts — the subset of lipgloss/v2 table glamour renders with.
// Port of charm.land/lipgloss/v2 table (table.go, resizing.go, rows.go) and
// the parts of Style.Render, alignment and JoinHorizontal a table cell uses.

import { AnsiStyle, colorSGR, stringWidth, truncate, wrap } from './ansi.js';

/** Horizontal alignment of a cell (lipgloss.Position). */
export type Align = 'left' | 'center' | 'right';

/** The cell style properties glamour sets (a lipgloss.Style subset). */
export interface CellStyle {
  align?: Align;
  paddingLeft?: number;
  paddingRight?: number;
  marginLeft?: number;
  marginRight?: number;
  /** Background color inherited from the table's base style. */
  background?: string;
}

/** lipgloss.Border (only the parts a table uses). */
export interface TableBorder {
  top: string;
  bottom: string;
  left: string;
  right: string;
  middle: string;
  middleLeft: string;
  middleRight: string;
  middleTop: string;
  middleBottom: string;
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}

/** lipgloss.NormalBorder() */
export function normalBorder(): TableBorder {
  return {
    top: '─',
    bottom: '─',
    left: '│',
    right: '│',
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    middleLeft: '├',
    middleRight: '┤',
    middle: '┼',
    middleTop: '┬',
    middleBottom: '┴',
  };
}

/** table.HeaderRow */
export const HEADER_ROW = -1;

export type StyleFunc = (row: number, col: number) => CellStyle;

// ─── Style.Render subset ────────────────────────────────────────────────────

interface RenderProps extends CellStyle {
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/** getLines: split into lines (tabs as 4 spaces) and report the widest. */
function getLines(s: string): [string[], number] {
  const lines = s.replace(/\t/g, '    ').replace(/\r\n/g, '\n').split('\n');
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, stringWidth(line));
  return [lines, widest];
}

/** lipgloss.Width */
export function blockWidth(s: string): number {
  return getLines(s)[1];
}

function pad(str: string, n: number, style: AnsiStyle | null): string {
  if (n === 0) return str;
  let sp = ' '.repeat(Math.abs(n));
  if (style) sp = style.styled(sp);
  return str.split('\n').map((line) => (n > 0 ? line + sp : sp + line)).join('\n');
}

function alignTextHorizontal(str: string, pos: Align, width: number, style: AnsiStyle | null): string {
  const [lines, widest] = getLines(str);
  return lines.map((l) => {
    const lineWidth = stringWidth(l);
    let shortAmount = widest - lineWidth;
    shortAmount += Math.max(0, width - (shortAmount + lineWidth));
    if (shortAmount <= 0) return l;
    const spaces = (n: number): string => {
      const s = ' '.repeat(n);
      return style ? style.styled(s) : s;
    };
    if (pos === 'right') return spaces(shortAmount) + l;
    if (pos === 'center') {
      const left = Math.floor(shortAmount / 2);
      const right = left + (shortAmount % 2);
      return spaces(left) + l + spaces(right);
    }
    return l + spaces(shortAmount);
  }).join('\n');
}

function alignTextVerticalTop(str: string, height: number): string {
  const strHeight = str.split('\n').length;
  if (height < strHeight) return str;
  return str + '\n'.repeat(height - strHeight);
}

/** lipgloss Style.Render for the (non-inline) properties a table uses. */
function renderStyle(props: RenderProps, input: string, profile: number): string {
  const te = new AnsiStyle();
  const teWhitespace = new AnsiStyle();
  if (props.background !== undefined) {
    te.add(colorSGR(props.background, true, profile));
    teWhitespace.add(colorSGR(props.background, true, profile));
  }

  const width = props.width ?? 0;
  const height = props.height ?? 0;
  const leftPadding = props.paddingLeft ?? 0;
  const rightPadding = props.paddingRight ?? 0;

  let str = input.replace(/\t/g, '    ').replace(/\r\n/g, '\n');
  if (width > 0) str = wrap(str, width - leftPadding - rightPadding, '');
  str = str.split('\n').map((line) => te.styled(line)).join('\n');

  if (leftPadding > 0) str = pad(str, -leftPadding, teWhitespace);
  if (rightPadding > 0) str = pad(str, rightPadding, teWhitespace);

  if (height > 0) str = alignTextVerticalTop(str, height);

  if (str.includes('\n') || width !== 0) {
    str = alignTextHorizontal(str, props.align ?? 'left', width, teWhitespace);
  }

  // Margins inherit the background color (Style.Inherit sets marginBackground).
  str = pad(str, -(props.marginLeft ?? 0), teWhitespace);
  str = pad(str, props.marginRight ?? 0, teWhitespace);

  if ((props.maxWidth ?? 0) > 0) {
    str = str.split('\n').map((line) => truncate(line, props.maxWidth ?? 0, '')).join('\n');
  }
  if ((props.maxHeight ?? 0) > 0) {
    const lines = str.split('\n');
    str = lines.slice(0, Math.min(props.maxHeight ?? 0, lines.length)).join('\n');
  }
  return str;
}

/** lipgloss.JoinHorizontal(lipgloss.Top, ...) */
function joinHorizontalTop(strs: string[]): string {
  if (strs.length === 0) return '';
  if (strs.length === 1) return strs[0];
  const blocks: string[][] = [];
  const maxWidths: number[] = [];
  let maxHeight = 0;
  for (const str of strs) {
    const [lines, widest] = getLines(str);
    blocks.push(lines);
    maxWidths.push(widest);
    maxHeight = Math.max(maxHeight, lines.length);
  }
  for (const block of blocks) {
    while (block.length < maxHeight) block.push('');
  }
  let out = '';
  for (let i = 0; i < maxHeight; i++) {
    for (let j = 0; j < blocks.length; j++) {
      const line = blocks[j][i];
      out += line + ' '.repeat(Math.max(0, maxWidths[j] - stringWidth(line)));
    }
    if (i < maxHeight - 1) out += '\n';
  }
  return out;
}

// ─── Resizer ────────────────────────────────────────────────────────────────

interface ResizerColumn {
  index: number;
  min: number;
  max: number;
  median: number;
  rows: string[][];
  xPadding: number;
  fixedWidth: number;
}

function median(n: number[]): number {
  n.sort((a, b) => a - b);
  if (n.length <= 0) return 0;
  if (n.length % 2 === 0) {
    const h = n.length / 2;
    return Math.trunc((n[h - 1] + n[h]) / 2);
  }
  return n[Math.floor(n.length / 2)];
}

const sum = (n: number[]): number => n.reduce((a, b) => a + b, 0);
const btoi = (b: boolean): number => (b ? 1 : 0);

class Resizer {
  columns: ResizerColumn[] = [];
  allRows: string[][];
  rowHeights: number[] = [];
  yPaddings: number[][] = [];
  wrap = true;
  borderColumn = true;
  borderLeft = true;
  borderRight = true;

  constructor(public tableWidth: number, public headers: string[], rows: string[][]) {
    this.allRows = headers.length > 0 ? [headers, ...rows] : rows;
    for (const row of this.allRows) {
      row.forEach((cell, i) => {
        const cellLen = blockWidth(cell);
        if (this.columns.length <= i) {
          this.columns.push({
            index: i, min: cellLen, max: cellLen, median: cellLen, rows: [], xPadding: 0, fixedWidth: 0,
          });
          return;
        }
        const column = this.columns[i];
        column.rows.push(row);
        column.min = Math.min(column.min, cellLen);
        column.max = Math.max(column.max, cellLen);
      });
    }
    this.columns.forEach((column, j) => {
      column.median = median(column.rows.map((row) => blockWidth(row[j])));
    });
  }

  optimizedWidths(): [number[], number[]] {
    if (this.maxTotal() <= this.tableWidth) return [this.expandTableWidth(), this.rowHeights];
    return [this.shrinkTableWidth(), this.rowHeights];
  }

  detectTableWidth(): number {
    return this.maxCharCount() + this.totalHorizontalPadding() + this.totalHorizontalBorder();
  }

  expandTableWidth(): number[] {
    const colWidths = this.maxColumnWidths();
    for (;;) {
      const totalWidth = sum(colWidths) + this.totalHorizontalBorder();
      if (totalWidth >= this.tableWidth) break;
      let shorterColumnIndex = 0;
      let shorterColumnWidth = 2 ** 31 - 1;
      colWidths.forEach((width, j) => {
        if (width === this.columns[j].fixedWidth) return;
        if (width < shorterColumnWidth) {
          shorterColumnWidth = width;
          shorterColumnIndex = j;
        }
      });
      colWidths[shorterColumnIndex]++;
    }
    this.expandRowHeights(colWidths);
    return colWidths;
  }

  shrinkTableWidth(): number[] {
    const colWidths = this.maxColumnWidths();
    const shrinkBiggestColumns = (veryBigOnly: boolean): void => {
      for (;;) {
        const totalWidth = sum(colWidths) + this.totalHorizontalBorder();
        if (totalWidth <= this.tableWidth) break;
        let bigColumnIndex = -(2 ** 31 - 1);
        let bigColumnWidth = -(2 ** 31 - 1);
        colWidths.forEach((width, j) => {
          if (width === this.columns[j].fixedWidth) return;
          if (veryBigOnly) {
            if (width >= Math.trunc(this.tableWidth / 2) && width > bigColumnWidth) {
              bigColumnWidth = width;
              bigColumnIndex = j;
            }
          } else if (width > bigColumnWidth) {
            bigColumnWidth = width;
            bigColumnIndex = j;
          }
        });
        if (bigColumnIndex < 0 || colWidths[bigColumnIndex] === 0) break;
        colWidths[bigColumnIndex]--;
      }
    };
    const shrinkToMedian = (): void => {
      for (;;) {
        const totalWidth = sum(colWidths) + this.totalHorizontalBorder();
        if (totalWidth <= this.tableWidth) break;
        let biggestDiffToMedian = -(2 ** 31 - 1);
        let biggestDiffToMedianIndex = -(2 ** 31 - 1);
        colWidths.forEach((width, j) => {
          if (width === this.columns[j].fixedWidth) return;
          const diffToMedian = width - this.columns[j].median;
          if (diffToMedian > 0 && diffToMedian > biggestDiffToMedian) {
            biggestDiffToMedian = diffToMedian;
            biggestDiffToMedianIndex = j;
          }
        });
        if (biggestDiffToMedianIndex <= 0 || colWidths[biggestDiffToMedianIndex] === 0) break;
        colWidths[biggestDiffToMedianIndex]--;
      }
    };
    shrinkBiggestColumns(true);
    shrinkToMedian();
    shrinkBiggestColumns(false);
    this.expandRowHeights(colWidths);
    return colWidths;
  }

  expandRowHeights(colWidths: number[]): void {
    this.rowHeights = this.defaultRowHeights();
    if (!this.wrap) return;
    const hasHeaders = this.headers.length > 0;
    this.allRows.forEach((row, i) => {
      row.forEach((cell, j) => {
        if (hasHeaders && i === 0) {
          this.rowHeights[i] = 1 + this.yPaddingForCell(i, j);
          return;
        }
        const height = this.detectContentHeight(cell, colWidths[j] - this.xPaddingForCol(j)) +
          this.yPaddingForCell(i, j);
        this.rowHeights[i] = Math.max(this.rowHeights[i], height);
      });
    });
  }

  defaultRowHeights(): number[] {
    return this.allRows.map((_, i) => Math.max(i < this.rowHeights.length ? this.rowHeights[i] : 0, 1));
  }

  maxColumnWidths(): number[] {
    return this.columns.map((col) =>
      col.fixedWidth > 0 ? col.fixedWidth : col.max + this.xPaddingForCol(col.index));
  }

  maxCharCount(): number {
    let count = 0;
    for (const col of this.columns) {
      count += col.fixedWidth > 0 ? col.fixedWidth - this.xPaddingForCol(col.index) : col.max;
    }
    return count;
  }

  maxTotal(): number {
    let maxTotal = 0;
    this.columns.forEach((column, j) => {
      maxTotal += column.fixedWidth > 0 ? column.fixedWidth : column.max + this.xPaddingForCol(j);
    });
    return maxTotal;
  }

  totalHorizontalPadding(): number {
    return sum(this.columns.map((col) => col.xPadding));
  }

  xPaddingForCol(j: number): number {
    return j >= this.columns.length ? 0 : this.columns[j].xPadding;
  }

  yPaddingForCell(i: number, j: number): number {
    if (i >= this.yPaddings.length || j >= this.yPaddings[i].length) return 0;
    return this.yPaddings[i][j];
  }

  totalHorizontalBorder(): number {
    return btoi(this.borderLeft) + btoi(this.borderRight) +
      (this.columns.length - 1) * btoi(this.borderColumn);
  }

  detectContentHeight(content: string, width: number): number {
    if (width === 0) return 1;
    let height = 0;
    for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
      height += (wrap(line, width, '').match(/\n/g)?.length ?? 0) + 1;
    }
    return height;
  }
}

// ─── Table ──────────────────────────────────────────────────────────────────

/** lipgloss table.Table, as configured by glamour's TableElement. */
export class Table {
  private styleFunc: StyleFunc = () => ({});
  private baseBackground?: string;
  private border: TableBorder = normalBorder();
  private borderTop = true;
  private borderBottom = true;
  private borderLeft = true;
  private borderRight = true;
  private borderHeader = true;
  private borderColumn = true;
  private borderRow = false;
  private headers: string[] = [];
  private readonly rows: string[][] = [];
  private columns = 0;
  private tableWidth = 0;
  private wrapCells = true;
  private widths: number[] = [];
  private heights: number[] = [];

  constructor(private readonly profile: number = 3) {}

  width(w: number): this {
    this.tableWidth = w;
    return this;
  }

  wrap(w: boolean): this {
    this.wrapCells = w;
    return this;
  }

  /** BaseStyle with a background color (the only base property glamour sets). */
  baseStyle(background: string): this {
    this.baseBackground = background;
    return this;
  }

  setStyleFunc(fn: StyleFunc): this {
    this.styleFunc = fn;
    return this;
  }

  setBorder(border: TableBorder): this {
    this.border = border;
    return this;
  }

  setBorderTop(v: boolean): this { this.borderTop = v; return this; }
  setBorderBottom(v: boolean): this { this.borderBottom = v; return this; }
  setBorderLeft(v: boolean): this { this.borderLeft = v; return this; }
  setBorderRight(v: boolean): this { this.borderRight = v; return this; }

  setHeaders(...headers: string[]): this {
    this.headers = headers;
    return this;
  }

  row(...cells: string[]): this {
    this.columns = Math.max(this.columns, cells.length);
    this.rows.push(cells);
    return this;
  }

  private at(row: number, cell: number): string {
    if (row >= this.rows.length || cell >= this.rows[row].length) return '';
    return this.rows[row][cell];
  }

  private style(row: number, col: number): CellStyle {
    const style = this.styleFunc(row, col);
    if (this.baseBackground !== undefined && style.background === undefined) {
      return { ...style, background: this.baseBackground };
    }
    return style;
  }

  /** borderStyle.Render: borders inherit the base style's background. */
  private b(s: string): string {
    if (this.baseBackground === undefined) return s;
    return new AnsiStyle().add(colorSGR(this.baseBackground, true, this.profile)).styled(s);
  }

  private static horizontalMargins(s: CellStyle): number {
    return (s.marginLeft ?? 0) + (s.marginRight ?? 0);
  }

  private static horizontalPadding(s: CellStyle): number {
    return (s.paddingLeft ?? 0) + (s.paddingRight ?? 0);
  }

  private resize(): void {
    const hasHeaders = this.headers.length > 0;
    const rows = this.rows.map((_, r) => Array.from({ length: this.columns }, (_c, c) => this.at(r, c)));
    const r = new Resizer(this.tableWidth, this.headers, rows);
    r.wrap = this.wrapCells;
    r.borderColumn = this.borderColumn;
    r.borderLeft = this.borderLeft;
    r.borderRight = this.borderRight;
    r.yPaddings = r.allRows.map(() => []);
    r.rowHeights = r.defaultRowHeights();

    r.allRows.forEach((row, i) => {
      r.yPaddings[i] = row.map(() => 0);
      row.forEach((_cell, j) => {
        const style = this.styleFunc(hasHeaders ? i - 1 : i, j);
        const column = r.columns[j];
        column.xPadding = Math.max(column.xPadding, Table.horizontalMargins(style) + Table.horizontalPadding(style));
      });
    });

    if (r.tableWidth <= 0) r.tableWidth = r.detectTableWidth();
    [this.widths, this.heights] = r.optimizedWidths();
  }

  private truncateCell(cell: string, rowIndex: number, colIndex: number): string {
    const hasHeaders = this.headers.length > 0;
    let height = this.heights[rowIndex + btoi(hasHeaders)];
    const cellWidth = this.widths[colIndex];
    const cellStyle = this.style(rowIndex, colIndex);
    if (rowIndex === HEADER_ROW) height = 1;
    const length = cellWidth * height - Table.horizontalPadding(cellStyle) - Table.horizontalMargins(cellStyle);
    return truncate(cell, length, '…');
  }

  private constructHeaders(): string {
    const height = this.heights[0];
    const left = (this.b(this.border.left) + '\n').repeat(height);
    const cells: string[] = [];
    if (this.borderLeft) cells.push(left);
    this.headers.forEach((header, j) => {
      const cellStyle = this.style(HEADER_ROW, j);
      const truncated = this.truncateCell(header, HEADER_ROW, j);
      cells.push(renderStyle({
        ...cellStyle,
        height,
        width: this.widths[j] - Table.horizontalMargins(cellStyle),
      }, truncated, this.profile));
      if (j < this.headers.length - 1 && this.borderColumn) cells.push(left);
    });
    if (this.borderRight) cells.push((this.b(this.border.right) + '\n').repeat(height));

    let s = joinHorizontalTop(cells.map((cell) => cell.replace(/\n+$/, ''))) + '\n';
    if (this.borderHeader) {
      if (this.borderLeft) s += this.b(this.border.middleLeft);
      this.headers.forEach((_h, i) => {
        s += this.b(this.border.top.repeat(this.widths[i]));
        if (i < this.headers.length - 1 && this.borderColumn) s += this.b(this.border.middle);
      });
      if (this.borderRight) s += this.b(this.border.middleRight);
      s += '\n';
    }
    return s;
  }

  private constructRow(index: number): string {
    const hasHeaders = this.headers.length > 0;
    const height = this.heights[index + btoi(hasHeaders)];
    const left = (this.b(this.border.left) + '\n').repeat(height);
    const cells: string[] = [];
    if (this.borderLeft) cells.push(left);
    for (let c = 0; c < this.columns; c++) {
      let cell = this.at(index, c);
      const cellStyle = this.style(index, c);
      if (!this.wrapCells) cell = this.truncateCell(cell, index, c);
      cells.push(renderStyle({
        ...cellStyle,
        height,
        maxHeight: height,
        width: this.widths[c] - Table.horizontalMargins(cellStyle),
        maxWidth: this.widths[c],
      }, cell, this.profile));
      if (c < this.columns - 1 && this.borderColumn) cells.push(left);
    }
    if (this.borderRight) cells.push((this.b(this.border.right) + '\n').repeat(height));

    let s = joinHorizontalTop(cells.map((cell) => cell.replace(/\n+$/, ''))) + '\n';
    if (this.borderRow && index < this.rows.length - 1) {
      if (this.borderLeft) s += this.b(this.border.middleLeft);
      this.widths.forEach((w, i) => {
        s += this.b(this.border.bottom.repeat(w));
        if (i < this.widths.length - 1 && this.borderColumn) s += this.b(this.border.middle);
      });
      if (this.borderRight) s += this.b(this.border.middleRight);
      s += '\n';
    }
    return s;
  }

  private constructTopBorder(): string {
    let s = this.borderLeft ? this.b(this.border.topLeft) : '';
    this.widths.forEach((w, i) => {
      s += this.b(this.border.top.repeat(w));
      if (i < this.widths.length - 1 && this.borderColumn) s += this.b(this.border.middleTop);
    });
    if (this.borderRight) s += this.b(this.border.topRight);
    return s;
  }

  private constructBottomBorder(): string {
    let s = this.borderLeft ? this.b(this.border.bottomLeft) : '';
    this.widths.forEach((w, i) => {
      s += this.b(this.border.bottom.repeat(w));
      if (i < this.widths.length - 1 && this.borderColumn) s += this.b(this.border.middleBottom);
    });
    if (this.borderRight) s += this.b(this.border.bottomRight);
    return s;
  }

  /** Table.String */
  toString(): string {
    const hasHeaders = this.headers.length > 0;
    const hasRows = this.rows.length > 0;
    if (!hasHeaders && !hasRows) return '';
    if (hasHeaders) {
      while (this.headers.length < this.columns) this.headers.push('');
    }
    this.resize();

    let s = '';
    if (this.borderTop) s += this.constructTopBorder() + '\n';
    if (hasHeaders) s += this.constructHeaders();
    const bottom = this.borderBottom ? this.constructBottomBorder() : '';
    for (let r = 0; r < this.rows.length; r++) s += this.constructRow(r);
    s += bottom;

    return renderStyle({ maxWidth: this.tableWidth }, s.replace(/\n$/, ''), this.profile);
  }
}
