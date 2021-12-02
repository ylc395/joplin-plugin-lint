import joplin from 'api';
import { Joplin } from './driver/joplin';

const app = new Joplin();

joplin.plugins.register({
  onStart: async function () {
    await app.setupCodeMirror();
  },
});
