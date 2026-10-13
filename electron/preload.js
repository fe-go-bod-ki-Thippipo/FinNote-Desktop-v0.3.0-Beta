const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('finnoteDesktop', Object.freeze({
  isDesktop: true,
  load: () => ipcRenderer.invoke('db:load'),
  save: data => ipcRenderer.invoke('db:save', data),
  backup: reason => ipcRenderer.invoke('db:backup', reason),
  listBackups: () => ipcRenderer.invoke('db:backups:list'),
  restoreBackup: id => ipcRenderer.invoke('db:backups:restore', id),
  info: () => ipcRenderer.invoke('db:info'),
  securityStatus: () => ipcRenderer.invoke('security:status'),
  securitySetup: data => ipcRenderer.invoke('security:setup', data),
  securityUnlock: password => ipcRenderer.invoke('security:unlock', password),
  securityRecover: data => ipcRenderer.invoke('security:recover', data),
  securityChangePassword: data => ipcRenderer.invoke('security:change-password', data),
  securityNewRecovery: password => ipcRenderer.invoke('security:new-recovery', password),
  securityLock: () => ipcRenderer.invoke('security:lock'),
  onSystemLock: callback => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('app:system-lock', () => callback());
  },
  diagnostics: () => ipcRenderer.invoke('app:diagnostics'),
  legacyStatus: () => ipcRenderer.invoke('legacy:status'),
  legacyMigrate: options => ipcRenderer.invoke('legacy:migrate', options)
}));
