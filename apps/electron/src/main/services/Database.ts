import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import fs from "fs";

function getDbPath() {
  return path.join(app.getPath("userData"), "jobs.db");
}

export class JobDatabase {
  private db: Database.Database;

  constructor() {
    const dbPath = getDbPath();
    console.log("[JobDatabase] Opening DB at", dbPath);
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        playlist_name TEXT,
        format TEXT,
        concurrent_fragments INTEGER,
        add_prefix INTEGER,
        temp_dir TEXT,
        status TEXT,
        created_at INTEGER,
        total_items INTEGER,
        completed_items INTEGER,
        current_file_index INTEGER,
        files_json TEXT
      );
    `);

    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);`
    );
  }

  getAllJobs(limit?: number): any[] {
    let query = `
      SELECT * FROM jobs 
      ORDER BY 
        CASE status 
          WHEN 'downloading' THEN 3
          WHEN 'paused' THEN 2 
          WHEN 'zipping' THEN 2
          WHEN 'error' THEN 1
          ELSE 0 
        END DESC,
        created_at DESC
    `;

    if (limit && limit > 0) {
      query += ` LIMIT ${limit}`;
    }

    const rows = this.db.prepare(query).all();
    return rows.map(this.mapRowToJob);
  }

  getJob(id: string): any | undefined {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
    if (!row) return undefined;
    return this.mapRowToJob(row);
  }

  insertJob(job: any) {
    const stmt = this.db.prepare(`
        INSERT INTO jobs (
            id, playlist_name, format, concurrent_fragments, add_prefix, temp_dir,
            status, created_at, total_items, completed_items, current_file_index, files_json
        ) VALUES (
            @id, @playlistName, @format, @concurrentFragments, @addPrefix, @tempDir,
            @status, @createdAt, @total, @completed, @currentFileIndex, @filesJson
        )
    `);

    const info = stmt.run({
      id: job.id,
      playlistName: job.playlistName,
      format: job.format,
      concurrentFragments: job.concurrentFragments,
      addPrefix: job.addPrefix ? 1 : 0,
      tempDir: job.tempDir,
      status: job.status,
      createdAt: job.createdAt,
      total: job.progress.total,
      completed: job.progress.completed,
      currentFileIndex: job.progress.currentFileIndex,
      filesJson: JSON.stringify(job.files),
    });
    return info.changes;
  }

  updateJob(job: any) {
    const stmt = this.db.prepare(`
        UPDATE jobs SET
            status = @status,
            completed_items = @completed,
            current_file_index = @currentFileIndex,
            files_json = @filesJson
        WHERE id = @id
    `);

    stmt.run({
      id: job.id,
      status: job.status,
      completed: job.progress.completed,
      currentFileIndex: job.progress.currentFileIndex,
      filesJson: JSON.stringify(job.files),
    });
  }

  updateJobStatus(id: string, status: string) {
    const stmt = this.db.prepare("UPDATE jobs SET status = ? WHERE id = ?");
    stmt.run(status, id);
  }

  deleteJob(id: string) {
    this.db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  }

  private mapRowToJob(row: any): any {
    return {
      id: row.id,
      playlistName: row.playlist_name,
      format: row.format,
      concurrentFragments: row.concurrent_fragments,
      addPrefix: !!row.add_prefix,
      tempDir: row.temp_dir,
      status: row.status,
      createdAt: row.created_at,
      files: JSON.parse(row.files_json),
      progress: {
        total: row.total_items,
        completed: row.completed_items,
        currentFileIndex: row.current_file_index,
        currentSpeed: "",
        currentFileSize: "",
        currentFilePercent: 0,
      },
    };
  }
}

export const dbStore = new JobDatabase();
