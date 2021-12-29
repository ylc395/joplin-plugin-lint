import { join } from 'path';
import { TextlintKernel, TextlintResult } from '@textlint/kernel';
import markdownlint, { LintError as MarkdownlintResult } from 'markdownlint';
import MarkdownPlugin from '@textlint/textlint-plugin-markdown';
import { PluginManager } from 'live-plugin-manager';
import compact from 'lodash.compact';
import joplin from 'api';
import type { TextlintConfig, MarkdownlintConfig } from '../../domain/config';

const textlintKernel = new TextlintKernel();

const fs = joplin.require('fs-extra');

export class Linter {
  private config = this.install();
  private pluginManager?: PluginManager;
  private dataDir?: string;
  get textlintFile() {
    if (!this.dataDir) {
      throw new Error('no dataDir');
    }
    return join(this.dataDir, '.textlintrc.json');
  }

  get markdownlintFile() {
    if (!this.dataDir) {
      throw new Error('no dataDir');
    }
    return join(this.dataDir, '.markdownlint.json');
  }

  async loadConfigs(configsText?: { textlintConfigText: string; markdownlintConfigText: string }) {
    if (!this.dataDir) {
      this.dataDir = await joplin.plugins.dataDir();
    }
    let textlintConfigText = configsText?.textlintConfigText;
    let markdownlintConfigText = configsText?.markdownlintConfigText;
    let textlintConfig: TextlintConfig;
    let markdownlintConfig: MarkdownlintConfig;

    if (typeof textlintConfigText === 'undefined') {
      try {
        textlintConfigText = await fs.readFile(this.textlintFile, 'utf-8');
      } catch {
        textlintConfigText = '{"rules": {}, "filters": {}}';
      }
    }

    if (typeof markdownlintConfigText === 'undefined') {
      try {
        markdownlintConfigText = await fs.readFile(this.markdownlintFile, 'utf-8');
      } catch {
        markdownlintConfigText = '{"rules": {}}';
      }
    }

    try {
      textlintConfig = JSON.parse(textlintConfigText!);
    } catch {
      textlintConfig = { rules: {} };
    }

    try {
      markdownlintConfig = JSON.parse(markdownlintConfigText!);
    } catch {
      markdownlintConfig = { rules: {} };
    }

    return { textlintConfig, markdownlintConfig, markdownlintConfigText, textlintConfigText };
  }

  async saveConfigs(configsText: { textlintConfigText: string; markdownlintConfigText: string }) {
    await Promise.all([
      fs.writeFile(this.markdownlintFile, configsText.markdownlintConfigText),
      fs.writeFile(this.textlintFile, configsText.textlintConfigText),
    ]);

    this.config = this.install(configsText);
  }

  private async install(configsText?: {
    textlintConfigText: string;
    markdownlintConfigText: string;
  }) {
    const { textlintConfig, markdownlintConfig } = await this.loadConfigs(configsText);

    if (!this.pluginManager) {
      const dataDir = await joplin.plugins.dataDir();
      this.pluginManager = new PluginManager({
        pluginsPath: join(dataDir, 'node_modules'),
      });
    }

    // @see https://github.com/textlint/textlint-rule-helper/blob/8697eddc8671b63ac6639094935d72b76a698f8a/package.json#L45
    await Promise.all([
      this.pluginManager.installFromNpm('@textlint/types'),
      this.pluginManager.installFromNpm('@textlint/ast-node-types'),
    ]);
    const textlint = await this.installTextlint(textlintConfig);

    return {
      textlint,
      markdownlint: markdownlintConfig,
    };
  }

  private async installTextlint(config: TextlintConfig) {
    const { ruleNames, filterNames } = getPackageNames(config);
    const toInstallation = ({ name }: { name: string }) => this.pluginManager!.installFromNpm(name);
    const [ruleInstallations, filterInstallations] = await Promise.all([
      Promise.allSettled(ruleNames.map(toInstallation)),
      Promise.allSettled(filterNames.map(toInstallation)),
    ]);

    const successRuleNames = compact(
      ruleInstallations.map(({ status }, index) =>
        status === 'fulfilled' ? ruleNames[index] : undefined,
      ),
    );

    const successFiltersNames = compact(
      filterInstallations.map(({ status }, index) =>
        status === 'fulfilled' ? filterNames[index] : undefined,
      ),
    );

    const toRule =
      (type: keyof TextlintConfig) =>
      ({ name, shortName }: { name: string; shortName: string }) => {
        try {
          return {
            ruleId: shortName,
            rule: this.pluginManager!.require(name).default,
            options: config[type]?.[shortName],
          };
        } catch (error) {
          return;
        }
      };

    const finalConfig = {
      rules: compact(successRuleNames.map(toRule('rules'))),
      filters: compact(successFiltersNames.map(toRule('filters'))),
    };

    if (process.env.NODE_ENV === 'development') {
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

function getPackageNames(config: TextlintConfig) {
  return {
    ruleNames: Object.keys(config.rules || {}).map((name) => ({
      name:
        name.startsWith('textlint-rule-') || name.startsWith('@') ? name : `textlint-rule-${name}`,
      shortName: name,
    })),
    filterNames: Object.keys(config.filters || {}).map((name) => ({
      name: `textlint-filter-rule-${name}`,
      shortName: name,
    })),
  };
}
