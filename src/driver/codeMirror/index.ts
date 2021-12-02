import type CodeMirror from 'codemirror';
import { Context, ExtendedEditor, Linter } from './Linter';

export default function (context: Context) {
  return {
    plugin: function (codemirror: typeof CodeMirror) {
      let linter: Linter;
      codemirror.registerHelper(
        'lint',
        'markdown',
        (text: string, options: unknown, editor: ExtendedEditor) => {
          if (!linter) {
            linter = new Linter(context, editor);
          }

          return linter.lint(text);
        },
      );
    },
    codeMirrorOptions: { lint: true },
    codeMirrorResources: ['addon/lint/lint'],
    assets: () => [{ name: './style.css' }],
  };
}
