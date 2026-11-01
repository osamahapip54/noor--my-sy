const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mixDeck', {
  selectAudioFiles: (language) => ipcRenderer.invoke('audio:select', language),
  selectAudioFolder: (language) => ipcRenderer.invoke('audio:select-folder', language),
  listAudioFiles: () => ipcRenderer.invoke('audio:list'),
  readAudioMetadata: (audioId) => ipcRenderer.invoke('audio:metadata', audioId),
  toggleFullScreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  onFullScreenChanged: (callback) => {
    const listener = (_event, isFullScreen) => callback(isFullScreen);
    ipcRenderer.on('window:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('window:fullscreen-changed', listener);
  },
  ensureStemModel: () => ipcRenderer.invoke('stems:model:ensure'),
  onStemModelProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('stems:model-progress', listener);
    return () => ipcRenderer.removeListener('stems:model-progress', listener);
  }
});
