// @ts-expect-error - ACE module doesn't export types correctly
import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';

console.log('Initializing test editor...');

const element = document.getElementById('editor');
if (element) {
  const editor = ace.edit(element);
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode('ace/mode/text');
  editor.setValue('Hello World from Test Page\nLine 2\nLine 3');
  editor.clearSelection();
  console.log('Editor initialized');
} else {
  console.error('Editor element not found');
}
