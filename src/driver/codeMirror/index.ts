import type CodeMirror from 'codemirror';
import type { Position } from 'codemirror';
import type { LintRequest } from '../joplin/request';
import type { Linter } from '../joplin/Linter';

interface Context {
  postMessage: <T>(request: LintRequest) => Promise<T>;
}

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

export default function (context: Context) {
  return {
    plugin: function (codemirror: typeof CodeMirror) {
      codemirror.registerHelper(
        'lint',
        'markdown',
        async (text: string): Promise<CodeMirrorLintMessage[]> => {
          const lintResults = await context.postMessage<ReturnType<Linter['lint']>>({
            event: 'lint',
            payload: { text },
          });

          const results = lintResults.messages.map(
            ({ severity, message, ruleId, line, column }) => ({
              severity: convertSeverity(severity),
              message: `${ruleId}: ${message}`,
              from: { line: line - 1, ch: column - 1 },
              to: { line: line - 1, ch: column },
            }),
          );

          return results;
        },
      );
    },
    codeMirrorOptions: { lint: true },
    codeMirrorResources: ['addon/lint/lint'],
    assets: () => [{ name: './style.css' }],
  };
}
