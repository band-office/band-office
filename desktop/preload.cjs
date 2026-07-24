/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bandosDesktop", {
  isDesktop: true,
  restoreBackup: (passphrase) => ipcRenderer.invoke("bandos:restore-backup", { passphrase }),
  emailCredentialStatus: () => ipcRenderer.invoke("bandos:email-credential-status"),
  storeEmailCredential: (password) => ipcRenderer.invoke("bandos:store-email-credential", { password }),
  clearEmailCredential: () => ipcRenderer.invoke("bandos:clear-email-credential"),
  restart: () => ipcRenderer.invoke("bandos:restart"),
});
