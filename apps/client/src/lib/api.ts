export interface VideoFormat {
  format_id: string;
  format_note?: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
}

export interface VideoData {
  title: string;
  thumbnail: string;
  duration_string?: string;
  uploader?: string;
  formats?: VideoFormat[];
  entries?: VideoData[];
  webpage_url?: string;
  url?: string;
  id?: string;
}

export interface JobStatus {
  id: string;
  playlistName: string;
  status: "idle" | "downloading" | "paused" | "completed" | "error" | "zipping";
  error?: string;
  progress: {
    total: number;
    completed: number;
    currentFileIndex: number;
    currentSpeed?: string;
    currentFileSize?: string;
    currentFileTotalSize?: string;
    currentFilePercent?: number;
  };
  files: { filename: string; status: string }[];
}

export interface BatchInitPayload {
  urls: string[];
  titles: string[];
  format: string;
  playlistName: string;
  addPrefix: boolean;
  concurrentFragments: number;
}

export interface VideoService {
  getInfo: (url: string) => Promise<VideoData>;
}

export interface BatchService {
  init: (payload: BatchInitPayload) => Promise<{ jobId: string }>;
  resume: (id: string) => Promise<{ status: string }>;
  pause: (id: string) => Promise<{ status: string }>;
  getStatus: (id: string) => Promise<JobStatus>;
  list: (limit?: number) => Promise<JobStatus[]>;
  delete: (id: string, deleteFiles: boolean) => Promise<void>;
  openFolder: (id: string) => Promise<void>;
  openDownloadsFolder: () => Promise<void>;
}

export interface SettingsService {
  saveCookies: (content: string) => Promise<{ success: boolean }>;
}

export interface IElectronAPI {
  initBatch: (data: BatchInitPayload) => Promise<{ jobId: string }>;
  resumeBatch: (id: string) => Promise<void>;
  pauseBatch: (id: string) => Promise<void>;
  batchStatus: (id: string) => Promise<JobStatus>;
  listBatches: (limit?: number) => Promise<JobStatus[]>;
  deleteBatch: (id: string, deleteFiles: boolean) => Promise<void>;
  openBatchFolder: (id: string) => Promise<void>;
  openDownloadsFolder: () => Promise<void>;
  saveCookies: (content: string) => Promise<void>;
  updateEngine: () => Promise<string>;
  saveSetting: (key: string, val: string) => Promise<void>;
  getSetting: (key: string) => Promise<string | undefined>;
  videoInfo: (url: string) => Promise<VideoData>;
  onProgress: (callback: (data: JobStatus) => void) => () => void;
}

declare global {
  interface Window {
    api?: IElectronAPI;
  }
}

const getApi = () => {
  if (typeof window === "undefined") return null;
  return window.api;
};

export const api = {
  video: {
    getInfo: async (url: string) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.videoInfo(url);
    },
  },
  batch: {
    init: async (payload: BatchInitPayload) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.initBatch(payload);
    },
    resume: async (id: string) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.resumeBatch(id);
    },
    pause: async (id: string) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.pauseBatch(id);
    },
    getStatus: async (id: string) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.batchStatus(id);
    },
    list: async (limit?: number) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.listBatches(limit);
    },
    delete: async (id: string, deleteFiles: boolean) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.deleteBatch(id, deleteFiles);
    },
    openFolder: async (id: string) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.openBatchFolder(id);
    },
    openDownloadsFolder: async () => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.openDownloadsFolder();
    },
    onProgress: (cb: (data: JobStatus) => void) => {
      const electronApi = getApi();
      if (electronApi) return electronApi.onProgress(cb);
      return () => {};
    },
  },
  settings: {
    saveCookies: async (content: string) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.saveCookies(content);
    },
    save: async (key: string, val: string) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.saveSetting(key, val);
    },
    get: async (key: string) => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.getSetting(key);
    },
    updateEngine: async () => {
      const electronApi = getApi();
      if (!electronApi) throw new Error("IPC not available");
      return electronApi.updateEngine();
    },
  },
};
