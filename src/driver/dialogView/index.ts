import delegate from 'delegate';
import ConfigEditor, { ConfigType } from './ConfigEditor';

const root = document.querySelector('#joplin-plugin-content')!;
root.innerHTML = `
    <div id="app">
        <div class="tabs">
            <button data-type="markdownlint">Markdownlint</button>
            <button data-type="textlint">Textlint</button>
        </div>
        <div class="editor-root"></div>
    </div>
    <form name="config" class="hidden-form">
        <input name="textlintConfigText" />
        <input name="markdownlintConfigText" />
    </form>
`;

const editorRoot = root.querySelector('.editor-root') as HTMLElement;
const textlintInputEl = root.querySelector('input[name="textlintConfigText"]') as HTMLInputElement;
const markdownlintInputEl = root.querySelector(
  'input[name="markdownlintConfigText"]',
) as HTMLInputElement;
const editor = new ConfigEditor(editorRoot, { textlintInputEl, markdownlintInputEl });

delegate('.tabs > button', 'click', (e: any) => {
  const target = e.delegateTarget as HTMLElement;
  editor.changeLintType(target.dataset.type as ConfigType);
});
