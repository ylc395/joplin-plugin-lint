import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { Linter } from './Linter';
import type { LintRequest } from './request';

export class Joplin {
  private readonly linter = new Linter();
  private handleRequest(request: LintRequest) {
    switch (request.event) {
      case 'lint':
        return this.linter.lint(request.payload.text);
      default:
        break;
    }
  }
  async setupCodeMirror() {
    const SCRIPT_ID = 'textlint-codeMirror-script';
    await joplin.contentScripts.register(
      ContentScriptType.CodeMirrorPlugin,
      SCRIPT_ID,
      './driver/codeMirror/index.js',
    );

    await joplin.contentScripts.onMessage(SCRIPT_ID, this.handleRequest.bind(this));
  }
}
