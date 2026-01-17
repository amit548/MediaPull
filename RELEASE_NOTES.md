# Release Notes - v1.1.0

## What's New

- **Never-Break Downloads**: The downloader is now much smarter. If you select a specific format that turns out to be invalid or broken on YouTube's side, the app will automatically fall back to the best available quality instead of showing an error.
- **Enhanced Format Selection**:
  - **Auto-Merge Audio**: Selecting a video-only format (e.g., 1080p video stream) now automatically merges it with the best available audio, ensuring you don't get silent video files.
  - **Cleaner UI**: Duplicate format options (e.g., multiple "1920x1080 (MP4)" entries) have been removed. The app now picks the highest quality one and hides the rest.
- **MP4 by Default**: "Highest Quality (Auto)" now defaults to generating **.mp4** files (by merging best video/audio streams into an MP4 container) instead of .mkv.

## Fixes

- **Fixed "Downloaded File is Empty" Error**: Resolved an issue where legacy or invalid streams caused downloads to fail with an empty file error.
- **Fixed False Success Reporting**: The app now strictly reports errors if the download fails, rather than incorrectly marking it as "Success" if a stale file was found on disk.
- **Stale File Cleanup**: The downloader now ensures the staging directory is clean before starting, preventing old files from interfering with new downloads.
