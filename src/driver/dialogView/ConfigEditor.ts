import JsonEditor from 'jsoneditor';
import type { LoadConfigsRequest } from '../joplin/request';

declare const webviewApi: {
  postMessage: <T>(payload: LoadConfigsRequest) => Promise<T>;
};

export type ConfigType = 'markdownlint' | 'textlint';

const TEXTLINT_SCHEMA = {
  type: 'object',
  properties: {
    rules: { type: 'object' },
    filters: { type: 'object' },
  },
};

const MARKDOWNLINT_SCHEMA = {
  rules: { type: Object },
};

export default class ConfigEditor {
  constructor(
    rootEl: HTMLElement,
    private readonly form: {
      textlintInputEl: HTMLInputElement;
      markdownlintInputEl: HTMLInputElement;
    },
  ) {
    this.editor = new JsonEditor(rootEl, {
      mode: 'code',
      mainMenuBar: false,
      navigationBar: false,
      statusBar: false,
      onChange: this.handleTextChange.bind(this),
    });
    this.init();
  }

  private markdownlintConfigText?: string;
  private textlintConfigText?: string;
  private readonly editor: JsonEditor;
  private configType: ConfigType = 'markdownlint';

  async init() {
    const { markdownlintConfigText, textlintConfigText } = await webviewApi.postMessage<{
      textlintConfigText: string;
      markdownlintConfigText: string;
    }>({ event: 'loadConfigs' });

    this.markdownlintConfigText = markdownlintConfigText;
    this.textlintConfigText = textlintConfigText;

    this.changeLintType(this.configType);
  }

  changeLintType(type: ConfigType) {
    if (
      typeof this.markdownlintConfigText === 'undefined' ||
      typeof this.textlintConfigText === 'undefined'
    ) {
      throw new Error('no config text');
    }

    this.editor.setText(
      type === 'markdownlint' ? this.markdownlintConfigText : this.textlintConfigText,
    );
    this.editor.setSchema(type === 'markdownlint' ? MARKDOWNLINT_SCHEMA : TEXTLINT_SCHEMA);
    this.configType = type;
  }

  private handleTextChange() {
    const currentText = this.editor.getText();

    if (this.configType === 'markdownlint') {
      this.markdownlintConfigText = currentText;
      this.form.markdownlintInputEl.value = currentText;
    } else {
      this.textlintConfigText = currentText;
      this.form.textlintInputEl.value = currentText;
    }
  }
}
