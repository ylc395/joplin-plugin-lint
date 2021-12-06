import { join } from 'path';
import { TextlintKernel, TextlintResult } from '@textlint/kernel';
import markdownlint, { LintError as MarkdownlintResult } from 'markdownlint';
import MarkdownPlugin from '@textlint/textlint-plugin-markdown';
import { PluginManager } from 'live-plugin-manager';
import compact from 'lodash.compact';
import joplin from 'api';

interface TextlintConfig {
  // @see https://textlint.github.io/docs/configuring.html#rule
  rules?: Record<string, boolean | Record<string, unknown>>;
  // @see https://textlint.github.io/docs/configuring.html#filter-rule
  filters?: Record<string, boolean | Record<string, unknown>>;
}

interface MarkdownlintConfig {
  // @see https://github.com/DavidAnson/markdownlint#optionsconfig
  rules?: Record<string, boolean | Record<string, unknown>>;
  // @see https://github.com/DavidAnson/markdownlint#optionscustomrules
  customRules?: Record<string, boolean | Record<string, unknown>>;
}

const textlintKernel = new TextlintKernel();

const fs = joplin.require('fs-extra');

export class Linter {
  private config = this.install();
  private failedPackages: string[] = [];
  private pluginManager?: PluginManager;

  async install() {
    const dataDir = await joplin.plugins.dataDir();

    let textlintConfig: TextlintConfig;
    let markdownlintConfig: MarkdownlintConfig;

    try {
      textlintConfig = await fs.readJson(join(dataDir, '.textlintrc.json'));
    } catch {
      textlintConfig = { filters: {}, rules: {} };
    }

    try {
      markdownlintConfig = await fs.readJson(join(dataDir, '.markdownlint.json'));
    } catch {
      markdownlintConfig = {};
    }

    this.pluginManager = new PluginManager({
      pluginsPath: join(dataDir, 'node_modules'),
    });

    const textlint = await this.installTextlint(textlintConfig);

    return {
      textlint,
      markdownlint: markdownlintConfig,
    };
  }

  private async installTextlint(config: TextlintConfig) {
    const ruleNames = Object.keys(config.rules || {}).map((name) => ({
      name:
        name.startsWith('textlint-rule-') || name.startsWith('@') ? name : `textlint-rule-${name}`,
      shortName: name,
    }));
    const filterNames = Object.keys(config.filters || {}).map((name) => ({
      name: `textlint-filter-rule-${name}`,
      shortName: name,
    }));

    const packageNames = [...ruleNames, ...filterNames];
    const installations = await Promise.allSettled(
      packageNames.map(({ name }) => this.pluginManager!.installFromNpm(name)),
    );

    this.failedPackages.push(
      ...compact(
        installations.map(({ status }, index) =>
          status === 'rejected' ? packageNames[index].name : undefined,
        ),
      ),
    );

    const successRuleNames = compact(
      installations
        .slice(0, ruleNames.length)
        .map(({ status }, index) => (status === 'fulfilled' ? ruleNames[index] : undefined)),
    );

    const successFiltersNames = compact(
      installations
        .slice(ruleNames.length)
        .map(({ status }, index) => (status === 'fulfilled' ? filterNames[index] : undefined)),
    );

    const toRule =
      (type: keyof TextlintConfig) =>
      ({ name, shortName }: { name: string; shortName: string }) => ({
        ruleId: shortName,
        rule: this.pluginManager!.require(name).default,
        options: config[type]?.[shortName],
      });

    const finalConfig = {
      rules: successRuleNames.map(toRule('rules')),
      filters: successFiltersNames.map(toRule('filters')),
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(this.failedPackages);
      console.log(finalConfig);
    }

    return finalConfig;
  }

  async lint(
    text: string,
  ): Promise<{ textlint: TextlintResult['messages']; markdownlint: MarkdownlintResult[] }> {
    const { textlint: textlintConfig, markdownlint: markdownlintConfig } = await this.config;
    const textlintResultPromise = textlintKernel.lintText(text, {
      ext: '.md',
      plugins: [{ pluginId: 'markdown', plugin: MarkdownPlugin }],
      rules: textlintConfig.rules,
      filterRules: textlintConfig.filters,
    });
    const markdownlintResultPromise = markdownlint.promises.markdownlint({
      strings: { text },
      config: markdownlintConfig,
    });
    const [textlintResult, markdownlintResult] = await Promise.all([
      textlintResultPromise,
      markdownlintResultPromise,
    ]);

    return {
      textlint: textlintResult.messages,
      markdownlint: markdownlintResult.text,
    };
  }
}
