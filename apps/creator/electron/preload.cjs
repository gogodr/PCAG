const { contextBridge, ipcRenderer } = require('electron');
const channels = new Set(['pick-folder', 'pick-background', 'pick-character-file', 'recent-folder', 'remember-folder', 'forget-folder', 'entries', 'mkdir', 'read', 'write', 'remove', 'exists', 'player-template', 'animation-pick-source', 'animation-import-selection', 'animation-inspect', 'animation-confirm', 'animation-transfer-work', 'animation-frame', 'animation-target', 'animation-suggest-palette', 'animation-export', 'animation-regenerate-gif', 'animation-reveal-export']);
contextBridge.exposeInMainWorld('pcagDesktop', {
  invoke(channel, ...args) {
    if (!channels.has(channel)) throw new Error('Unsupported desktop operation.');
    return ipcRenderer.invoke(`pcag:${channel}`, ...args);
  },
});
