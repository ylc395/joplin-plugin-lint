import type { Editor, Position } from 'codemirror';
import type { LintRequest } from '../joplin/request';
import type { Linter as TextLinter } from '../joplin/Linter';

// @see https://codemirror.net/doc/manual.html#addon_panel
interface Panel {
  clear(): void;
  changed(): void;
}

export interface ExtendedEditor extends Editor {
  addPanel(
    node: HTMLElement,
    config?: {
      position?: 'top' | 'after-top' | 'bottom' | 'before-bottom';
      before?: Panel;
      after?: Panel;
      replace?: Panel;
      stable?: boolean;
    },
  ): Panel;
}

export interface Context {
  postMessage: <T>(request: LintRequest) => Promise<T>;
}

//@see https://codemirror.net/doc/manual.html#addon_lint
interface CodeMirrorLintMessage {
  message: string;
  severity: 'warning' | 'error';
  from: Position;
  to: Position;
}

function convertSeverity(severity: number): CodeMirrorLintMessage['severity'] {
  switch (severity) {
    case 1:
      return 'warning';
    case 2:
      return 'error';
    default:
      return 'error';
  }
}

export class Linter {
  constructor(private readonly context: Context, private readonly cm: ExtendedEditor) {}
  async lint(text: string): Promise<CodeMirrorLintMessage[]> {
    const lintResults = await this.context.postMessage<ReturnType<TextLinter['lint']>>({
      event: 'lint',
      payload: { text },
    });

    const results = lintResults.messages.map(({ severity, message, ruleId, line, column }) => ({
      severity: convertSeverity(severity),
      message: `[${ruleId}] ${message}`,
      from: { line: line - 1, ch: column - 1 },
      to: { line: line - 1, ch: column },
    }));

    return results;
  }
}
