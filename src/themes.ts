import type { StyleConfig } from './style.js';

// Theme name constants (matching Go)
export const DarkStyleName = 'dark';
export const LightStyleName = 'light';
export const ASCIIStyleName = 'ascii';
export const DraculaStyleName = 'dracula';
export const TokyoNightStyleName = 'tokyo-night';
export const PinkStyleName = 'pink';
export const NoTTYStyleName = 'notty';
export const AutoStyleName = 'auto';

// ─── Dark Theme ─────────────────────────────────────────────────────────────

export const DarkStyle: StyleConfig = {
  document: {
    block_prefix: '\n',
    block_suffix: '\n',
    color: '252',
    margin: 2,
  },
  block_quote: {
    indent: 1,
    indent_token: '│ ',
  },
  paragraph: {},
  list: {
    level_indent: 2,
  },
  heading: {
    block_suffix: '\n',
    color: '39',
    bold: true,
  },
  h1: {
    prefix: ' ',
    suffix: ' ',
    color: '228',
    background_color: '63',
    bold: true,
  },
  h2: {
    prefix: '## ',
  },
  h3: {
    prefix: '### ',
  },
  h4: {
    prefix: '#### ',
  },
  h5: {
    prefix: '##### ',
  },
  h6: {
    prefix: '###### ',
    color: '35',
    bold: false,
  },
  text: {},
  strikethrough: {
    crossed_out: true,
  },
  emph: {
    italic: true,
  },
  strong: {
    bold: true,
  },
  hr: {
    color: '240',
    format: '\n--------\n',
  },
  item: {
    block_prefix: '• ',
  },
  enumeration: {
    block_prefix: '. ',
  },
  task: {
    ticked: '[✓] ',
    unticked: '[ ] ',
  },
  link: {
    color: '30',
    underline: true,
  },
  link_text: {
    color: '35',
    bold: true,
  },
  image: {
    color: '212',
    underline: true,
  },
  image_text: {
    color: '243',
    format: 'Image: {{.text}} →',
  },
  code: {
    prefix: '\u00a0',
    suffix: '\u00a0',
    color: '203',
    background_color: '236',
  },
  code_block: {
    color: '244',
    margin: 2,
    chroma: {
      text: {
        color: '#C4C4C4',
      },
      error: {
        color: '#F1F1F1',
        background_color: '#F05B5B',
      },
      comment: {
        color: '#676767',
      },
      comment_preproc: {
        color: '#FF875F',
      },
      keyword: {
        color: '#00AAFF',
      },
      keyword_reserved: {
        color: '#FF5FD2',
      },
      keyword_namespace: {
        color: '#FF5F87',
      },
      keyword_type: {
        color: '#6E6ED8',
      },
      operator: {
        color: '#EF8080',
      },
      punctuation: {
        color: '#E8E8A8',
      },
      name: {
        color: '#C4C4C4',
      },
      name_builtin: {
        color: '#FF8EC7',
      },
      name_tag: {
        color: '#B083EA',
      },
      name_attribute: {
        color: '#7A7AE6',
      },
      name_class: {
        color: '#F1F1F1',
        underline: true,
        bold: true,
      },
      name_constant: {},
      name_decorator: {
        color: '#FFFF87',
      },
      name_exception: {},
      name_function: {
        color: '#00D787',
      },
      name_other: {},
      literal: {},
      literal_number: {
        color: '#6EEFC0',
      },
      literal_date: {},
      literal_string: {
        color: '#C69669',
      },
      literal_string_escape: {
        color: '#AFFFD7',
      },
      generic_deleted: {
        color: '#FD5B5B',
      },
      generic_emph: {
        italic: true,
      },
      generic_inserted: {
        color: '#00D787',
      },
      generic_strong: {
        bold: true,
      },
      generic_subheading: {
        color: '#777777',
      },
      background: {
        background_color: '#373737',
      },
    },
  },
  table: {},
  definition_list: {},
  definition_term: {},
  definition_description: {
    block_prefix: '\n🠶 ',
  },
  html_block: {},
  html_span: {},
};

// ─── Light Theme ────────────────────────────────────────────────────────────

export const LightStyle: StyleConfig = {
  document: {
    block_prefix: '\n',
    block_suffix: '\n',
    color: '234',
    margin: 2,
  },
  block_quote: {
    indent: 1,
    indent_token: '│ ',
  },
  paragraph: {},
  list: {
    level_indent: 2,
  },
  heading: {
    block_suffix: '\n',
    color: '27',
    bold: true,
  },
  h1: {
    prefix: ' ',
    suffix: ' ',
    color: '228',
    background_color: '63',
    bold: true,
  },
  h2: {
    prefix: '## ',
  },
  h3: {
    prefix: '### ',
  },
  h4: {
    prefix: '#### ',
  },
  h5: {
    prefix: '##### ',
  },
  h6: {
    prefix: '###### ',
    bold: false,
  },
  text: {},
  strikethrough: {
    crossed_out: true,
  },
  emph: {
    italic: true,
  },
  strong: {
    bold: true,
  },
  hr: {
    color: '249',
    format: '\n--------\n',
  },
  item: {
    block_prefix: '• ',
  },
  enumeration: {
    block_prefix: '. ',
  },
  task: {
    ticked: '[✓] ',
    unticked: '[ ] ',
  },
  link: {
    color: '36',
    underline: true,
  },
  link_text: {
    color: '29',
    bold: true,
  },
  image: {
    color: '205',
    underline: true,
  },
  image_text: {
    color: '243',
    format: 'Image: {{.text}} →',
  },
  code: {
    prefix: '\u00a0',
    suffix: '\u00a0',
    color: '203',
    background_color: '254',
  },
  code_block: {
    color: '242',
    margin: 2,
    chroma: {
      text: {
        color: '#2A2A2A',
      },
      error: {
        color: '#F1F1F1',
        background_color: '#FF5555',
      },
      comment: {
        color: '#8D8D8D',
      },
      comment_preproc: {
        color: '#FF875F',
      },
      keyword: {
        color: '#279EFC',
      },
      keyword_reserved: {
        color: '#FF5FD2',
      },
      keyword_namespace: {
        color: '#FB406F',
      },
      keyword_type: {
        color: '#7049C2',
      },
      operator: {
        color: '#FF2626',
      },
      punctuation: {
        color: '#FA7878',
      },
      name: {},
      name_builtin: {
        color: '#0A1BB1',
      },
      name_tag: {
        color: '#581290',
      },
      name_attribute: {
        color: '#8362CB',
      },
      name_class: {
        color: '#212121',
        underline: true,
        bold: true,
      },
      name_constant: {
        color: '#581290',
      },
      name_decorator: {
        color: '#A3A322',
      },
      name_exception: {},
      name_function: {
        color: '#019F57',
      },
      name_other: {},
      literal: {},
      literal_number: {
        color: '#22CCAE',
      },
      literal_date: {},
      literal_string: {
        color: '#7E5B38',
      },
      literal_string_escape: {
        color: '#00AEAE',
      },
      generic_deleted: {
        color: '#FD5B5B',
      },
      generic_emph: {
        italic: true,
      },
      generic_inserted: {
        color: '#00D787',
      },
      generic_strong: {
        bold: true,
      },
      generic_subheading: {
        color: '#777777',
      },
      background: {
        background_color: '#373737',
      },
    },
  },
  table: {},
  definition_list: {},
  definition_term: {},
  definition_description: {
    block_prefix: '\n🠶 ',
  },
  html_block: {},
  html_span: {},
};

// ─── ASCII Theme ────────────────────────────────────────────────────────────

export const ASCIIStyle: StyleConfig = {
  document: {
    block_prefix: '\n',
    block_suffix: '\n',
    margin: 2,
  },
  block_quote: {
    indent: 1,
    indent_token: '| ',
  },
  paragraph: {},
  list: {
    level_indent: 4,
  },
  heading: {
    block_suffix: '\n',
  },
  h1: {
    prefix: '# ',
  },
  h2: {
    prefix: '## ',
  },
  h3: {
    prefix: '### ',
  },
  h4: {
    prefix: '#### ',
  },
  h5: {
    prefix: '##### ',
  },
  h6: {
    prefix: '###### ',
  },
  text: {},
  strikethrough: {
    block_prefix: '~~',
    block_suffix: '~~',
  },
  emph: {
    block_prefix: '*',
    block_suffix: '*',
  },
  strong: {
    block_prefix: '**',
    block_suffix: '**',
  },
  hr: {
    format: '\n--------\n',
  },
  item: {
    block_prefix: '• ',
  },
  enumeration: {
    block_prefix: '. ',
  },
  task: {
    ticked: '[x] ',
    unticked: '[ ] ',
  },
  link: {},
  link_text: {},
  image: {},
  image_text: {
    format: 'Image: {{.text}} →',
  },
  code: {
    block_prefix: '`',
    block_suffix: '`',
  },
  code_block: {
    margin: 2,
  },
  table: {
    center_separator: '|',
    column_separator: '|',
    row_separator: '-',
  },
  definition_list: {},
  definition_term: {},
  definition_description: {
    block_prefix: '\n* ',
  },
  html_block: {},
  html_span: {},
};

// ─── Dracula Theme ──────────────────────────────────────────────────────────

export const DraculaStyle: StyleConfig = {
  document: {
    block_prefix: '\n',
    block_suffix: '\n',
    color: '#f8f8f2',
    margin: 2,
  },
  block_quote: {
    color: '#f1fa8c',
    italic: true,
    indent: 2,
  },
  paragraph: {},
  list: {
    color: '#f8f8f2',
    level_indent: 2,
  },
  heading: {
    block_suffix: '\n',
    color: '#bd93f9',
    bold: true,
  },
  h1: {
    prefix: '# ',
  },
  h2: {
    prefix: '## ',
  },
  h3: {
    prefix: '### ',
  },
  h4: {
    prefix: '#### ',
  },
  h5: {
    prefix: '##### ',
  },
  h6: {
    prefix: '###### ',
  },
  text: {},
  strikethrough: {
    crossed_out: true,
  },
  emph: {
    color: '#f1fa8c',
    italic: true,
  },
  strong: {
    color: '#ffb86c',
    bold: true,
  },
  hr: {
    color: '#6272A4',
    format: '\n--------\n',
  },
  item: {
    block_prefix: '• ',
  },
  enumeration: {
    block_prefix: '. ',
    color: '#8be9fd',
  },
  task: {
    ticked: '[✓] ',
    unticked: '[ ] ',
  },
  link: {
    color: '#8be9fd',
    underline: true,
  },
  link_text: {
    color: '#ff79c6',
  },
  image: {
    color: '#8be9fd',
    underline: true,
  },
  image_text: {
    color: '#ff79c6',
    format: 'Image: {{.text}} →',
  },
  code: {
    color: '#50fa7b',
  },
  code_block: {
    color: '#ffb86c',
    margin: 2,
    chroma: {
      text: {
        color: '#f8f8f2',
      },
      error: {
        color: '#f8f8f2',
        background_color: '#ff5555',
      },
      comment: {
        color: '#6272A4',
      },
      comment_preproc: {
        color: '#ff79c6',
      },
      keyword: {
        color: '#ff79c6',
      },
      keyword_reserved: {
        color: '#ff79c6',
      },
      keyword_namespace: {
        color: '#ff79c6',
      },
      keyword_type: {
        color: '#8be9fd',
      },
      operator: {
        color: '#ff79c6',
      },
      punctuation: {
        color: '#f8f8f2',
      },
      name: {
        color: '#8be9fd',
      },
      name_builtin: {
        color: '#8be9fd',
      },
      name_tag: {
        color: '#ff79c6',
      },
      name_attribute: {
        color: '#50fa7b',
      },
      name_class: {
        color: '#8be9fd',
      },
      name_constant: {
        color: '#bd93f9',
      },
      name_decorator: {
        color: '#50fa7b',
      },
      name_exception: {},
      name_function: {
        color: '#50fa7b',
      },
      name_other: {},
      literal: {},
      literal_number: {
        color: '#6EEFC0',
      },
      literal_date: {},
      literal_string: {
        color: '#f1fa8c',
      },
      literal_string_escape: {
        color: '#ff79c6',
      },
      generic_deleted: {
        color: '#ff5555',
      },
      generic_emph: {
        color: '#f1fa8c',
        italic: true,
      },
      generic_inserted: {
        color: '#50fa7b',
      },
      generic_strong: {
        color: '#ffb86c',
        bold: true,
      },
      generic_subheading: {
        color: '#bd93f9',
      },
      background: {
        background_color: '#282a36',
      },
    },
  },
  table: {},
  definition_list: {},
  definition_term: {},
  definition_description: {
    block_prefix: '\n🠶 ',
  },
  html_block: {},
  html_span: {},
};

// ─── Tokyo Night Theme ──────────────────────────────────────────────────────

export const TokyoNightStyle: StyleConfig = {
  document: {
    block_prefix: '\n',
    block_suffix: '\n',
    color: '#a9b1d6',
    margin: 2,
  },
  block_quote: {
    indent: 1,
    indent_token: '│ ',
  },
  paragraph: {},
  list: {
    color: '#a9b1d6',
    level_indent: 2,
  },
  heading: {
    block_suffix: '\n',
    color: '#bb9af7',
    bold: true,
  },
  h1: {
    prefix: '# ',
    bold: true,
  },
  h2: {
    prefix: '## ',
  },
  h3: {
    prefix: '### ',
  },
  h4: {
    prefix: '#### ',
  },
  h5: {
    prefix: '##### ',
  },
  h6: {
    prefix: '###### ',
  },
  text: {},
  strikethrough: {
    crossed_out: true,
  },
  emph: {
    italic: true,
  },
  strong: {
    bold: true,
  },
  hr: {
    color: '#565f89',
    format: '\n--------\n',
  },
  item: {
    block_prefix: '• ',
  },
  enumeration: {
    block_prefix: '. ',
    color: '#7aa2f7',
  },
  task: {
    ticked: '[✓] ',
    unticked: '[ ] ',
  },
  link: {
    color: '#7aa2f7',
    underline: true,
  },
  link_text: {
    color: '#2ac3de',
  },
  image: {
    color: '#7aa2f7',
    underline: true,
  },
  image_text: {
    color: '#2ac3de',
    format: 'Image: {{.text}} →',
  },
  code: {
    color: '#9ece6a',
  },
  code_block: {
    color: '#ff9e64',
    margin: 2,
    chroma: {
      text: {
        color: '#a9b1d6',
      },
      error: {
        color: '#a9b1d6',
        background_color: '#f7768e',
      },
      comment: {
        color: '#565f89',
      },
      comment_preproc: {
        color: '#2ac3de',
      },
      keyword: {
        color: '#2ac3de',
      },
      keyword_reserved: {
        color: '#2ac3de',
      },
      keyword_namespace: {
        color: '#2ac3de',
      },
      keyword_type: {
        color: '#7aa2f7',
      },
      operator: {
        color: '#2ac3de',
      },
      punctuation: {
        color: '#a9b1d6',
      },
      name: {
        color: '#7aa2f7',
      },
      name_builtin: {
        color: '#7aa2f7',
      },
      name_tag: {
        color: '#2ac3de',
      },
      name_attribute: {
        color: '#9ece6a',
      },
      name_class: {
        color: '#7aa2f7',
      },
      name_constant: {
        color: '#bb9af7',
      },
      name_decorator: {
        color: '#9ece6a',
      },
      name_exception: {},
      name_function: {
        color: '#9ece6a',
      },
      name_other: {},
      literal: {},
      literal_number: {},
      literal_date: {},
      literal_string: {
        color: '#e0af68',
      },
      literal_string_escape: {
        color: '#2ac3de',
      },
      generic_deleted: {
        color: '#f7768e',
      },
      generic_emph: {
        italic: true,
      },
      generic_inserted: {
        color: '#9ece6a',
      },
      generic_strong: {
        bold: true,
      },
      generic_subheading: {
        color: '#bb9af7',
      },
      background: {
        background_color: '#1a1b26',
      },
    },
  },
  table: {},
  definition_list: {},
  definition_term: {},
  definition_description: {
    block_prefix: '\n🠶 ',
  },
  html_block: {},
  html_span: {},
};

// ─── Pink Theme ─────────────────────────────────────────────────────────────

export const PinkStyle: StyleConfig = {
  document: {
    margin: 2,
  },
  block_quote: {
    indent: 1,
    indent_token: '│ ',
  },
  paragraph: {},
  list: {
    level_indent: 2,
  },
  heading: {
    block_suffix: '\n',
    color: '212',
    bold: true,
  },
  h1: {
    block_prefix: '\n',
    block_suffix: '\n',
  },
  h2: {
    prefix: '▌ ',
  },
  h3: {
    prefix: '┃ ',
  },
  h4: {
    prefix: '│ ',
  },
  h5: {
    prefix: '┆ ',
  },
  h6: {
    prefix: '┊ ',
    bold: false,
  },
  text: {},
  strikethrough: {
    crossed_out: true,
  },
  emph: {
    italic: true,
  },
  strong: {
    bold: true,
  },
  hr: {
    color: '212',
    format: '\n──────\n',
  },
  item: {
    block_prefix: '• ',
  },
  enumeration: {
    block_prefix: '. ',
  },
  task: {
    ticked: '[✓] ',
    unticked: '[ ] ',
  },
  link: {
    color: '99',
    underline: true,
  },
  link_text: {
    bold: true,
  },
  image: {
    underline: true,
  },
  image_text: {
    format: 'Image: {{.text}}',
  },
  code: {
    prefix: '\u00a0',
    suffix: '\u00a0',
    color: '212',
    background_color: '236',
  },
  code_block: {},
  table: {},
  definition_list: {},
  definition_term: {},
  definition_description: {
    block_prefix: '\n🠶 ',
  },
  html_block: {},
  html_span: {},
};

// ─── NoTTY Theme (identical to ASCII) ───────────────────────────────────────

export const NoTTYStyle: StyleConfig = { ...ASCIIStyle };

// ─── Default Styles Map ─────────────────────────────────────────────────────

export const defaultStyles: Record<string, StyleConfig> = {
  [DarkStyleName]: DarkStyle,
  [LightStyleName]: LightStyle,
  [ASCIIStyleName]: ASCIIStyle,
  [DraculaStyleName]: DraculaStyle,
  [TokyoNightStyleName]: TokyoNightStyle,
  [PinkStyleName]: PinkStyle,
  [NoTTYStyleName]: NoTTYStyle,
};

/**
 * getDefaultStyle - Returns the appropriate default style.
 * If name is 'auto', detect terminal background (dark/light) and return appropriate theme.
 * For simplicity, default to DarkStyle when auto-detection is not available.
 */
export function getDefaultStyle(name?: string): StyleConfig {
  if (!name || name === AutoStyleName) {
    return DarkStyle;
  }
  const style = defaultStyles[name];
  if (style) {
    return style;
  }
  return DarkStyle;
}
