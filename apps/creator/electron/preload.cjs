const { contextBridge, ipcRenderer } = require('electron');
const channels = new Set(['pick-folder', 'pick-background', 'recent-folder', 'remember-folder', 'forget-folder', 'entries', 'mkdir', 'read', 'write', 'remove', 'exists', 'player-template']);
contextBridge.exposeInMainWorld('pcagDesktop', {
  invoke(channel, ...args) {
    if (!channels.has(channel)) throw new Error('Unsupported desktop operation.');
    return ipcRenderer.invoke(`pcag:${channel}`, ...args);
  },
});
