import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import squirrelStartup from "electron-squirrel-startup";
import * as dl from "./services/downloader";

let mainWindow: BrowserWindow;

if (squirrelStartup) {
  app.quit();
}

const createWindow = () => {
  const preloadPath = path.join(app.getAppPath(), "dist", "main", "preload.js");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, "out", "index.html"));
  }
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("batch:init", (_, data) => dl.initBatch(data));
ipcMain.handle("batch:resume", (_, id) => dl.processJob(mainWindow, id));
ipcMain.handle("batch:pause", (_, id) => dl.pauseBatch(id));
ipcMain.handle("batch:status", (_, id) => dl.batchStatus(id));
ipcMain.handle("batch:list", (_, limit) => dl.getAllJobs(limit));
ipcMain.handle("batch:delete", (_, id, deleteFiles) =>
  dl.deleteJob(id, deleteFiles)
);
ipcMain.handle("batch:openFolder", (_, id) => dl.openBatchFolder(id));
ipcMain.handle("app:openDownloads", () => dl.openDownloadsFolder());
ipcMain.handle("settings:cookies", (_, c) => dl.saveCookies(c));
ipcMain.handle("video:info", (_, url) => dl.videoInfo(url));
