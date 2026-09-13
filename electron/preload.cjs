const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('planner', {
  getState: () => invoke('state:get'),
  openManager: view => invoke('manager:open', view),
  hide: () => invoke('widget:hide'),
  show: () => invoke('widget:show'),
  settings: settings => invoke('settings:save', settings),
  resetPosition: () => invoke('widget:reset'),
  resizeStart: () => invoke('widget:resize-start'),
  resize: (bounds, finish = false) => invoke('widget:resize', bounds, finish),
  saveSchedule: schedule => invoke('schedule:save', schedule),
  undoImport: () => invoke('schedule:undo'),
  chooseImport: () => invoke('import:choose'),
  exportSchedule: () => invoke('schedule:export'),
  complete: key => invoke('entry:complete', key),
  lockIn: () => invoke('lock:enter'),
  lockReady: () => invoke('lock:ready'),
  lockFailed: () => invoke('lock:failed'),
  unlock: () => invoke('lock:exit'),
  spotify: action => invoke('spotify:action', action),
  onUpdate: callback => { const listener = (_, state) => callback(state); ipcRenderer.on('state:update', listener); return () => ipcRenderer.removeListener('state:update', listener); },
  onNavigate: callback => { const listener = (_, view) => callback(view); ipcRenderer.on('manager:navigate', listener); return () => ipcRenderer.removeListener('manager:navigate', listener); }
});
