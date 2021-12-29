import joplin from 'api';
import { ContentScriptType, ViewHandle } from 'api/types';
import { Linter } from './Linter';
import type { LintRequest, LoadConfigsRequest } from './request';

export class Joplin {
  private readonly linter = new Linter();
  private dialog?: ViewHandle;
  private handleRequest(request: LintRequest | LoadConfigsRequest) {
    switch (request.event) {
      case 'lint':
        return this.linter.lint(request.payload.text);
      case 'loadConfigs':
        return this.linter.loadConfigs();
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

  async setupDialog() {
    this.dialog = await joplin.views.dialogs.create('main');
    await joplin.views.dialogs.setButtons(this.dialog, [
      { id: 'confirm', title: 'Confirm' },
      { id: 'cancel', title: 'Cancel' },
    ]);
    await joplin.views.panels.onMessage(this.dialog, this.handleRequest.bind(this));
    joplin.views.dialogs.addScript(this.dialog, './driver/dialogView/index.js');
    joplin.views.dialogs.addScript(this.dialog, './driver/dialogView/style.css');
    joplin.views.dialogs.addScript(this.dialog, './driver/dialogView/jsoneditor.min.css');
  }

  async setupCommand() {
    await joplin.commands.register({
      name: 'openLintConfig',
      label: 'Open Lint Config',
      execute: async () => {
        const {
          id,
          formData: { config },
        } = await joplin.views.dialogs.open(this.dialog!);

        if (id === 'confirm') {
          this.linter.saveConfigs(config);
        }
      },
    });
    await joplin.views.menuItems.create('lint-config', 'openLintConfig');
  }
}
