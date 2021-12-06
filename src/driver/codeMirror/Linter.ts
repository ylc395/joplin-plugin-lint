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

interface LintMessage extends CodeMirrorLintMessage {
  ruleId: string;
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
const PANEL_CONTAINER_CLASS_NAME = 'textlint-panel-container';
const PANEL_ITEM_CLASS_NAME = 'textlint-panel-item';
const PANEL_ERROR_ITEM_CLASS_NAME = 'textlint-panel-item-error';
const PANEL_WARNING_ITEM_CLASS_NAME = 'textlint-panel-item-warning';
const COUNTER_CLASS_NAME = 'textlint-panel-counter';
const MESSAGE_LIST_CLASS_NAME = 'textlint-panel-message-list';

export class Linter {
  constructor(private readonly context: Context, private readonly cm: ExtendedEditor) {}

  private panelEl?: HTMLElement;
  private messageListEL?: HTMLElement;
  private messages: LintMessage[] = [];

  async lint(text: string): Promise<CodeMirrorLintMessage[]> {
    const { textlint: textlintResults, markdownlint: markdownlintResults } =
      await this.context.postMessage<ReturnType<TextLinter['lint']>>({
        event: 'lint',
        payload: { text },
      });

    const textlintMessages: LintMessage[] = textlintResults.map(
      ({ severity, message, ruleId, line, column }) => ({
        ruleId,
        severity: convertSeverity(severity),
        message,
        from: { line: line - 1, ch: column - 1 },
        to: { line: line - 1, ch: column },
      }),
    );

    const markdownlintMessages: LintMessage[] = markdownlintResults.map(
      ({ lineNumber, ruleDescription, ruleNames, errorRange }) => ({
        message: ruleDescription,
        severity: 'error',
        ruleId: ruleNames[0],
        from: { line: lineNumber - 1, ch: (errorRange?.[0] || 1) - 1 },
        to: { line: lineNumber - 1, ch: (errorRange?.[0] || 1) + (errorRange?.[1] || 1) - 1 },
      }),
    );

    this.messages = [...markdownlintMessages, ...textlintMessages].sort(
      ({ from: { line: line1 } }, { from: { line: line2 } }) => line1 - line2,
    );
    this.initPanel();
    this.updateCounters();
    this.updateMessageList();

    return this.messages.map((message) => ({
      ...message,
      message: `${message.message} [${message.ruleId}]`,
    }));
  }

  private initPanel() {
    if (this.panelEl) {
      return;
    }

    this.panelEl = document.createElement('div');
    this.panelEl.classList.add(PANEL_CLASS_NAME);
    this.panelEl.innerHTML = `
        <div class="${PANEL_CONTAINER_CLASS_NAME}">
          <div class="${PANEL_ITEM_CLASS_NAME} ${PANEL_ERROR_ITEM_CLASS_NAME}">
            ${XCircle}
            <span class=${COUNTER_CLASS_NAME}>
          </div>
          <div class="${PANEL_ITEM_CLASS_NAME} ${PANEL_WARNING_ITEM_CLASS_NAME}">
            ${ExclamationTriangle}
            <span class=${COUNTER_CLASS_NAME}>
          </div>
        </div>
    `;

    const panelContainerEl = this.panelEl.querySelector(`.${PANEL_CONTAINER_CLASS_NAME}`)!;
    panelContainerEl.addEventListener('click', () => {
      this.messageListEL ? this.removeMessageList() : this.showMessageList();
    });

    this.cm.addPanel(this.panelEl, { position: 'bottom', stable: true });
  }

  private updateMessageList() {
    if (!this.messageListEL) {
      return;
    }

    const html = this.messages
      .map(
        ({ message, from: { line, ch }, severity, ruleId }) =>
          `<li data-textlint-line="${line}" data-textlint-ch="${ch}">${
            severity === 'error' ? XCircle : ExclamationTriangle
          }<span>${message}</span><span>${ruleId}</span><span>Ln ${line + 1} Col ${
            ch + 1
          }</span></li>`,
      )
      .join('');

    this.messageListEL.innerHTML = html || '<p>No Problems.</p>';
  }

  private showMessageList() {
    if (!this.panelEl) {
      throw new Error('no panel el');
    }

    if (this.messages.length === 0) {
      return;
    }

    this.messageListEL = document.createElement('ol');
    this.messageListEL.classList.add(MESSAGE_LIST_CLASS_NAME);
    this.messageListEL.addEventListener('click', (e) => {
      this.handleMessageClick(e.target as HTMLElement);
    });
    this.messageListEL.style.height = `${this.cm.getWrapperElement().clientHeight / 4}px`;
    this.panelEl.appendChild(this.messageListEL);
    this.updateMessageList();
  }

  private handleMessageClick(target: HTMLElement) {
    let liEl: HTMLElement | null = target;

    while (liEl && !liEl.matches(`[data-textlint-line][data-textlint-ch]`)) {
      liEl = liEl.parentElement;
    }

    if (!liEl) {
      return;
    }

    const { textlintLine: line, textlintCh: ch } = liEl.dataset;
    this.cm.setCursor(Number(line), Number(ch), { scroll: false });
    this.cm.scrollIntoView(
      null,
      this.messageListEL!.clientHeight + this.panelEl!.clientHeight + 30,
    );
    this.cm.focus();
  }

  private removeMessageList() {
    if (!this.messageListEL) {
      throw new Error('no message list el');
    }

    this.messageListEL.remove();
    this.messageListEL = undefined;
  }

  private updateCounters() {
    if (!this.panelEl) {
      throw new Error('no els');
    }

    const errorCount = this.messages.filter(({ severity }) => severity === 'error').length;
    const warningCount = this.messages.length - errorCount;
    const errorEl = this.panelEl.querySelector(
      `.${PANEL_ERROR_ITEM_CLASS_NAME} .${COUNTER_CLASS_NAME}`,
    )!;
    const warningEl = this.panelEl.querySelector(
      `.${PANEL_WARNING_ITEM_CLASS_NAME} .${COUNTER_CLASS_NAME}`,
    )!;

    errorEl.textContent = String(errorCount);
    warningEl.textContent = String(warningCount);
  }
}
