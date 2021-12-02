import { join } from 'path';
import {
  TextlintKernel,
  TextlintKernelRule,
  TextlintKernelFilterRule,
  TextlintResult,
} from '@textlint/kernel';
import MarkdownPlugin from '@textlint/textlint-plugin-markdown';
import { PluginManager } from 'live-plugin-manager';
import compact from 'lodash.compact';
import joplin from 'api';

const fs = joplin.require('fs-extra');

interface Installations {
  rules: {
    [index: string]: boolean;
  };

  filters: {
    [index: string]: boolean;
  };
}

export class Linter {
  installations?: Installations;
  private textlintKernel = new TextlintKernel();
  private config?: {
    rules: TextlintKernelRule[];
    filters: TextlintKernelFilterRule[];
  };

  constructor() {
    this.install();
  }

  async install() {
    const dataDir = await joplin.plugins.dataDir();

    let config: Record<string, any>;

    try {
      config = await fs.readJson(join(dataDir, '.textlintrc.json'));
    } catch {
      return;
    }

    const pluginManager = new PluginManager({
      pluginsPath: join(dataDir, 'node_modules'),
    });
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
      packageNames.map(({ name }) => pluginManager.installFromNpm(name)),
    );

    this.installations = packageNames.reduce(
      (result, { name }, i) => {
        result[i < ruleNames.length ? 'rules' : 'filters'][name] =
          installations[i].status === 'fulfilled';
        return result;
      },
      { rules: {}, filters: {} } as Installations,
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

    const toRule = ({ name, shortName }: { name: string; shortName: string }) => ({
      ruleId: shortName,
      rule: pluginManager.require(name).default,
      options: config.rules[shortName],
    });

    this.config = {
      rules: successRuleNames.map(toRule),
      filters: successFiltersNames.map(toRule),
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(this.installations);
      console.log(this.config);
    }
  }

  lint(text: string): Promise<TextlintResult> {
    if (!this.config) {
      return Promise.resolve({ filePath: '', messages: [] });
    }

    return this.textlintKernel.lintText(text, {
      ext: '.md',
      plugins: [{ pluginId: 'markdown', plugin: MarkdownPlugin }],
      rules: this.config.rules,
      filterRules: this.config.filters,
    });
  }
}
