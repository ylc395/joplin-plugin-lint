import type { Editor, Position } from 'codemirror';
import ExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg';
import XCircle from 'bootstrap-icons/icons/x-circle.svg';
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

const PANEL_CLASS_NAME = 'textlint-panel';
const PANEL_ITEM_CLASS_NAME = 'textlint-panel-item';
const ERROR_COUNTER_CLASS_NAME = 'textlint-panel-error-counter';
const WARNING_COUNTER_CLASS_NAME = 'textlint-panel-warning-counter';

export class Linter {
  constructor(private readonly context: Context, private readonly cm: ExtendedEditor) {
    this.initPanel();
  }

  private panelEl?: HTMLElement;

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

    this.updateCounters(results);
    return results;
  }

  private initPanel() {
    this.panelEl = document.createElement('div');
    this.panelEl.classList.add(PANEL_CLASS_NAME);
    this.panelEl.innerHTML = `
        <div class="${PANEL_ITEM_CLASS_NAME}">
          ${XCircle}
          <span class=${ERROR_COUNTER_CLASS_NAME}>
        </div>
        <div class="${PANEL_ITEM_CLASS_NAME}">
          ${ExclamationTriangle}
          <span class=${WARNING_COUNTER_CLASS_NAME}>
        </div>
    `;

    this.cm.addPanel(this.panelEl, { position: 'bottom', stable: true });
  }

  private updateCounters(messages: CodeMirrorLintMessage[]) {
    if (!this.panelEl) {
      throw new Error('no els');
    }

    const errorCount = messages.filter(({ severity }) => severity === 'error').length;
    const warningCount = messages.length - errorCount;
    const errorEl = this.panelEl.querySelector(`.${ERROR_COUNTER_CLASS_NAME}`)!;
    const warningEl = this.panelEl.querySelector(`.${WARNING_COUNTER_CLASS_NAME}`)!;

    errorEl.textContent = String(errorCount);
    warningEl.textContent = String(warningCount);
  }
}
