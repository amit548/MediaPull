import { app, BrowserWindow, ipcMain, protocol, net } from "electron";
import path from "path";
import squirrelStartup from "electron-squirrel-startup";
import * as dl from "./services/downloader";
import { dbStore } from "./services/Database";

let mainWindow: BrowserWindow;

if (squirrelStartup) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      stream: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

const createWindow = () => {
  const preloadPath = path.join(app.getAppPath(), "dist", "main", "preload.js");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    titleBarStyle: "hidden",
    titleBarOverlay: false,
    frame: false,
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
ipcMain.handle("app:relaunch", () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("window:minimize", () => {
  mainWindow.minimize();
});

ipcMain.handle("window:maximize", () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle("window:close", () => {
  mainWindow.close();
});

ipcMain.handle("window:isMaximized", () => {
  return mainWindow.isMaximized();
});
ipcMain.handle("settings:cookies", (_, c) => dl.saveCookies(c));
ipcMain.handle("settings:save", (_, key, val) => dbStore.saveSetting(key, val));
ipcMain.handle("settings:get", (_, key) => dbStore.getSettings(key));
ipcMain.handle("settings:updateEngine", () => dl.updateEngine());
ipcMain.handle("video:info", (_, url) => dl.videoInfo(mainWindow, url));
