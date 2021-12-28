export interface TextlintConfig {
  // @see https://textlint.github.io/docs/configuring.html#rule
  rules?: Record<string, boolean | Record<string, unknown>>;
  // @see https://textlint.github.io/docs/configuring.html#filter-rule
  filters?: Record<string, boolean | Record<string, unknown>>;
}

export interface MarkdownlintConfig {
  // @see https://github.com/DavidAnson/markdownlint#optionsconfig
  rules?: Record<string, boolean | Record<string, unknown>>;
  // @see https://github.com/DavidAnson/markdownlint#optionscustomrules
  customRules?: Record<string, boolean | Record<string, unknown>>;
}
