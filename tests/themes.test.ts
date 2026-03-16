import { describe, expect, it } from 'bun:test';
import type { StyleConfig } from '../src/style.js';
import {
  DarkStyle,
  LightStyle,
  ASCIIStyle,
  DraculaStyle,
  TokyoNightStyle,
  PinkStyle,
  NoTTYStyle,
  DarkStyleName,
  LightStyleName,
  ASCIIStyleName,
  DraculaStyleName,
  TokyoNightStyleName,
  PinkStyleName,
  NoTTYStyleName,
  AutoStyleName,
  defaultStyles,
  getDefaultStyle,
} from '../src/themes.js';

// Helper: check that a theme has the expected top-level keys of StyleConfig
function hasExpectedKeys(style: StyleConfig) {
  expect(style.document).toBeDefined();
  expect(style.heading).toBeDefined();
  expect(style.h1).toBeDefined();
  expect(style.h2).toBeDefined();
  expect(style.h3).toBeDefined();
  expect(style.h4).toBeDefined();
  expect(style.h5).toBeDefined();
  expect(style.h6).toBeDefined();
  expect(style.text).toBeDefined();
  expect(style.item).toBeDefined();
  expect(style.enumeration).toBeDefined();
  expect(style.task).toBeDefined();
  expect(style.hr).toBeDefined();
}

describe('Theme name constants', () => {
  it('should have correct string values', () => {
    expect(DarkStyleName).toBe('dark');
    expect(LightStyleName).toBe('light');
    expect(ASCIIStyleName).toBe('ascii');
    expect(DraculaStyleName).toBe('dracula');
    expect(TokyoNightStyleName).toBe('tokyo-night');
    expect(PinkStyleName).toBe('pink');
    expect(NoTTYStyleName).toBe('notty');
    expect(AutoStyleName).toBe('auto');
  });
});

describe('DarkStyle', () => {
  it('should have expected keys', () => {
    hasExpectedKeys(DarkStyle);
  });

  it('should have correct document settings', () => {
    expect(DarkStyle.document?.block_prefix).toBe('\n');
    expect(DarkStyle.document?.block_suffix).toBe('\n');
    expect(DarkStyle.document?.color).toBe('252');
    expect(DarkStyle.document?.margin).toBe(2);
  });

  it('should have bold heading with color 39', () => {
    expect(DarkStyle.heading?.bold).toBe(true);
    expect(DarkStyle.heading?.color).toBe('39');
    expect(DarkStyle.heading?.block_suffix).toBe('\n');
  });

  it('should have correct h1 styling', () => {
    expect(DarkStyle.h1?.prefix).toBe(' ');
    expect(DarkStyle.h1?.suffix).toBe(' ');
    expect(DarkStyle.h1?.color).toBe('228');
    expect(DarkStyle.h1?.background_color).toBe('63');
    expect(DarkStyle.h1?.bold).toBe(true);
  });

  it('should have correct h6 styling', () => {
    expect(DarkStyle.h6?.prefix).toBe('###### ');
    expect(DarkStyle.h6?.color).toBe('35');
    expect(DarkStyle.h6?.bold).toBe(false);
  });

  it('should have correct code styling with non-breaking spaces', () => {
    expect(DarkStyle.code?.prefix).toBe('\u00a0');
    expect(DarkStyle.code?.suffix).toBe('\u00a0');
    expect(DarkStyle.code?.color).toBe('203');
    expect(DarkStyle.code?.background_color).toBe('236');
  });

  it('should have correct code_block chroma colors', () => {
    expect(DarkStyle.code_block?.chroma?.text?.color).toBe('#C4C4C4');
    expect(DarkStyle.code_block?.chroma?.keyword?.color).toBe('#00AAFF');
    expect(DarkStyle.code_block?.chroma?.background?.background_color).toBe('#373737');
    expect(DarkStyle.code_block?.chroma?.name_class?.underline).toBe(true);
    expect(DarkStyle.code_block?.chroma?.name_class?.bold).toBe(true);
  });

  it('should have correct link styling', () => {
    expect(DarkStyle.link?.color).toBe('30');
    expect(DarkStyle.link?.underline).toBe(true);
  });

  it('should have correct task styling', () => {
    expect(DarkStyle.task?.ticked).toBe('[✓] ');
    expect(DarkStyle.task?.unticked).toBe('[ ] ');
  });

  it('should have correct hr format', () => {
    expect(DarkStyle.hr?.format).toBe('\n--------\n');
    expect(DarkStyle.hr?.color).toBe('240');
  });
});

describe('LightStyle', () => {
  it('should have expected keys', () => {
    hasExpectedKeys(LightStyle);
  });

  it('should have correct document color', () => {
    expect(LightStyle.document?.color).toBe('234');
    expect(LightStyle.document?.margin).toBe(2);
  });

  it('should have heading color 27', () => {
    expect(LightStyle.heading?.color).toBe('27');
    expect(LightStyle.heading?.bold).toBe(true);
  });

  it('should have correct code_block chroma', () => {
    expect(LightStyle.code_block?.chroma?.text?.color).toBe('#2A2A2A');
    expect(LightStyle.code_block?.chroma?.keyword?.color).toBe('#279EFC');
    expect(LightStyle.code_block?.chroma?.name_constant?.color).toBe('#581290');
  });

  it('should have correct link styling', () => {
    expect(LightStyle.link?.color).toBe('36');
    expect(LightStyle.link_text?.color).toBe('29');
  });

  it('should have code with background_color 254', () => {
    expect(LightStyle.code?.background_color).toBe('254');
  });
});

describe('ASCIIStyle', () => {
  it('should have expected keys', () => {
    hasExpectedKeys(ASCIIStyle);
  });

  it('should use pipe for block_quote indent_token', () => {
    expect(ASCIIStyle.block_quote?.indent_token).toBe('| ');
  });

  it('should have level_indent of 4', () => {
    expect(ASCIIStyle.list?.level_indent).toBe(4);
  });

  it('should use text markers instead of styling', () => {
    expect(ASCIIStyle.strikethrough?.block_prefix).toBe('~~');
    expect(ASCIIStyle.strikethrough?.block_suffix).toBe('~~');
    expect(ASCIIStyle.emph?.block_prefix).toBe('*');
    expect(ASCIIStyle.emph?.block_suffix).toBe('*');
    expect(ASCIIStyle.strong?.block_prefix).toBe('**');
    expect(ASCIIStyle.strong?.block_suffix).toBe('**');
  });

  it('should use backticks for code', () => {
    expect(ASCIIStyle.code?.block_prefix).toBe('`');
    expect(ASCIIStyle.code?.block_suffix).toBe('`');
  });

  it('should have table separators', () => {
    expect(ASCIIStyle.table?.center_separator).toBe('|');
    expect(ASCIIStyle.table?.column_separator).toBe('|');
    expect(ASCIIStyle.table?.row_separator).toBe('-');
  });

  it('should use [x] for ticked tasks', () => {
    expect(ASCIIStyle.task?.ticked).toBe('[x] ');
    expect(ASCIIStyle.task?.unticked).toBe('[ ] ');
  });

  it('should have h1 prefix # ', () => {
    expect(ASCIIStyle.h1?.prefix).toBe('# ');
  });

  it('should use * for definition_description', () => {
    expect(ASCIIStyle.definition_description?.block_prefix).toBe('\n* ');
  });
});

describe('DraculaStyle', () => {
  it('should have expected keys', () => {
    hasExpectedKeys(DraculaStyle);
  });

  it('should have correct document color', () => {
    expect(DraculaStyle.document?.color).toBe('#f8f8f2');
    expect(DraculaStyle.document?.margin).toBe(2);
  });

  it('should have purple heading', () => {
    expect(DraculaStyle.heading?.color).toBe('#bd93f9');
    expect(DraculaStyle.heading?.bold).toBe(true);
  });

  it('should have italic yellow block_quote', () => {
    expect(DraculaStyle.block_quote?.color).toBe('#f1fa8c');
    expect(DraculaStyle.block_quote?.italic).toBe(true);
    expect(DraculaStyle.block_quote?.indent).toBe(2);
  });

  it('should have green code', () => {
    expect(DraculaStyle.code?.color).toBe('#50fa7b');
  });

  it('should have cyan enumeration', () => {
    expect(DraculaStyle.enumeration?.color).toBe('#8be9fd');
  });

  it('should have correct chroma', () => {
    expect(DraculaStyle.code_block?.chroma?.keyword?.color).toBe('#ff79c6');
    expect(DraculaStyle.code_block?.chroma?.literal_string?.color).toBe('#f1fa8c');
    expect(DraculaStyle.code_block?.chroma?.background?.background_color).toBe('#282a36');
    expect(DraculaStyle.code_block?.chroma?.generic_strong?.color).toBe('#ffb86c');
    expect(DraculaStyle.code_block?.chroma?.generic_strong?.bold).toBe(true);
  });

  it('should have correct emph styling', () => {
    expect(DraculaStyle.emph?.color).toBe('#f1fa8c');
    expect(DraculaStyle.emph?.italic).toBe(true);
  });

  it('should have correct strong styling', () => {
    expect(DraculaStyle.strong?.color).toBe('#ffb86c');
    expect(DraculaStyle.strong?.bold).toBe(true);
  });
});

describe('TokyoNightStyle', () => {
  it('should have expected keys', () => {
    hasExpectedKeys(TokyoNightStyle);
  });

  it('should have correct document color', () => {
    expect(TokyoNightStyle.document?.color).toBe('#a9b1d6');
    expect(TokyoNightStyle.document?.margin).toBe(2);
  });

  it('should have purple heading', () => {
    expect(TokyoNightStyle.heading?.color).toBe('#bb9af7');
  });

  it('should have bold h1', () => {
    expect(TokyoNightStyle.h1?.bold).toBe(true);
    expect(TokyoNightStyle.h1?.prefix).toBe('# ');
  });

  it('should have correct link colors', () => {
    expect(TokyoNightStyle.link?.color).toBe('#7aa2f7');
    expect(TokyoNightStyle.link_text?.color).toBe('#2ac3de');
  });

  it('should have green code', () => {
    expect(TokyoNightStyle.code?.color).toBe('#9ece6a');
  });

  it('should have correct chroma', () => {
    expect(TokyoNightStyle.code_block?.chroma?.text?.color).toBe('#a9b1d6');
    expect(TokyoNightStyle.code_block?.chroma?.keyword?.color).toBe('#2ac3de');
    expect(TokyoNightStyle.code_block?.chroma?.literal_string?.color).toBe('#e0af68');
    expect(TokyoNightStyle.code_block?.chroma?.background?.background_color).toBe('#1a1b26');
    expect(TokyoNightStyle.code_block?.chroma?.name_constant?.color).toBe('#bb9af7');
  });

  it('should have blue enumeration', () => {
    expect(TokyoNightStyle.enumeration?.color).toBe('#7aa2f7');
  });

  it('should have empty literal_number in chroma', () => {
    expect(TokyoNightStyle.code_block?.chroma?.literal_number).toBeDefined();
    expect(TokyoNightStyle.code_block?.chroma?.literal_number?.color).toBeUndefined();
  });
});

describe('PinkStyle', () => {
  it('should have expected keys', () => {
    hasExpectedKeys(PinkStyle);
  });

  it('should have document with only margin', () => {
    expect(PinkStyle.document?.margin).toBe(2);
    expect(PinkStyle.document?.block_prefix).toBeUndefined();
    expect(PinkStyle.document?.color).toBeUndefined();
  });

  it('should have color 212 heading', () => {
    expect(PinkStyle.heading?.color).toBe('212');
    expect(PinkStyle.heading?.bold).toBe(true);
  });

  it('should have h1 with block_prefix and block_suffix', () => {
    expect(PinkStyle.h1?.block_prefix).toBe('\n');
    expect(PinkStyle.h1?.block_suffix).toBe('\n');
  });

  it('should have decorative heading prefixes', () => {
    expect(PinkStyle.h2?.prefix).toBe('▌ ');
    expect(PinkStyle.h3?.prefix).toBe('┃ ');
    expect(PinkStyle.h4?.prefix).toBe('│ ');
    expect(PinkStyle.h5?.prefix).toBe('┆ ');
    expect(PinkStyle.h6?.prefix).toBe('┊ ');
  });

  it('should have unicode hr', () => {
    expect(PinkStyle.hr?.format).toBe('\n──────\n');
    expect(PinkStyle.hr?.color).toBe('212');
  });

  it('should have code with non-breaking spaces', () => {
    expect(PinkStyle.code?.prefix).toBe('\u00a0');
    expect(PinkStyle.code?.suffix).toBe('\u00a0');
    expect(PinkStyle.code?.color).toBe('212');
    expect(PinkStyle.code?.background_color).toBe('236');
  });

  it('should have empty code_block', () => {
    expect(PinkStyle.code_block).toBeDefined();
    expect(PinkStyle.code_block?.chroma).toBeUndefined();
  });

  it('should have image_text without arrow', () => {
    expect(PinkStyle.image_text?.format).toBe('Image: {{.text}}');
  });

  it('should have link color 99', () => {
    expect(PinkStyle.link?.color).toBe('99');
    expect(PinkStyle.link?.underline).toBe(true);
  });
});

describe('NoTTYStyle', () => {
  it('should be identical to ASCIIStyle', () => {
    // They are spread-copies, so check structural equality
    expect(NoTTYStyle.document?.block_prefix).toBe(ASCIIStyle.document?.block_prefix);
    expect(NoTTYStyle.document?.margin).toBe(ASCIIStyle.document?.margin);
    expect(NoTTYStyle.list?.level_indent).toBe(ASCIIStyle.list?.level_indent);
    expect(NoTTYStyle.table?.center_separator).toBe(ASCIIStyle.table?.center_separator);
    expect(NoTTYStyle.task?.ticked).toBe(ASCIIStyle.task?.ticked);
    expect(NoTTYStyle.code?.block_prefix).toBe(ASCIIStyle.code?.block_prefix);
  });

  it('should have expected keys', () => {
    hasExpectedKeys(NoTTYStyle);
  });
});

describe('defaultStyles map', () => {
  it('should contain all 7 themes', () => {
    expect(Object.keys(defaultStyles)).toHaveLength(7);
    expect(defaultStyles['dark']).toBe(DarkStyle);
    expect(defaultStyles['light']).toBe(LightStyle);
    expect(defaultStyles['ascii']).toBe(ASCIIStyle);
    expect(defaultStyles['dracula']).toBe(DraculaStyle);
    expect(defaultStyles['tokyo-night']).toBe(TokyoNightStyle);
    expect(defaultStyles['pink']).toBe(PinkStyle);
    expect(defaultStyles['notty']).toBe(NoTTYStyle);
  });
});

describe('getDefaultStyle', () => {
  it('should return DarkStyle for "auto"', () => {
    expect(getDefaultStyle('auto')).toBe(DarkStyle);
  });

  it('should return DarkStyle when no name given', () => {
    expect(getDefaultStyle()).toBe(DarkStyle);
    expect(getDefaultStyle(undefined)).toBe(DarkStyle);
  });

  it('should return correct theme by name', () => {
    expect(getDefaultStyle('dark')).toBe(DarkStyle);
    expect(getDefaultStyle('light')).toBe(LightStyle);
    expect(getDefaultStyle('ascii')).toBe(ASCIIStyle);
    expect(getDefaultStyle('dracula')).toBe(DraculaStyle);
    expect(getDefaultStyle('tokyo-night')).toBe(TokyoNightStyle);
    expect(getDefaultStyle('pink')).toBe(PinkStyle);
    expect(getDefaultStyle('notty')).toBe(NoTTYStyle);
  });

  it('should return DarkStyle for unknown name', () => {
    expect(getDefaultStyle('nonexistent')).toBe(DarkStyle);
  });
});
