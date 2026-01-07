import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  initBatch: (d: any) => ipcRenderer.invoke("batch:init", d),
  resumeBatch: (id: string) => ipcRenderer.invoke("batch:resume", id),
  pauseBatch: (id: string) => ipcRenderer.invoke("batch:pause", id),
  batchStatus: (id: string) => ipcRenderer.invoke("batch:status", id),
  listBatches: (limit?: number) => ipcRenderer.invoke("batch:list", limit),
  deleteBatch: (id: string, deleteFiles: boolean) =>
    ipcRenderer.invoke("batch:delete", id, deleteFiles),
  openBatchFolder: (id: string) => ipcRenderer.invoke("batch:openFolder", id),
  openDownloadsFolder: () => ipcRenderer.invoke("app:openDownloads"),
  saveCookies: (c: string) => ipcRenderer.invoke("settings:cookies", c),
  updateEngine: () => ipcRenderer.invoke("settings:updateEngine"),
  videoInfo: (u: string) => ipcRenderer.invoke("video:info", u),
  saveSetting: (key: string, val: string) =>
    ipcRenderer.invoke("settings:save", key, val),
  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),
  onProgress: (cb: (data: any) => void) => {
    const subscription = (_: any, d: any) => cb(d);
    ipcRenderer.on("batch:progress", subscription);
    return () => {
      ipcRenderer.removeListener("batch:progress", subscription);
    };
  },
});
