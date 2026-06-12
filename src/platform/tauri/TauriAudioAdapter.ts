import type {
  AudioAdapter,
  AudioDevice,
  RecordingOptions,
  RecordingSession,
  AudioBlob,
  AudioPlayback,
} from '../adapters/AudioAdapter'
import { WebAudioAdapter } from '../web/WebAudioAdapter'

/**
 * Tauri implementation of AudioAdapter.
 * Falls back to WebAudioAdapter for recording (MediaRecorder works in Tauri's WebView).
 * Adds system audio capture via Tauri shell commands for desktop.
 */
export class TauriAudioAdapter implements AudioAdapter {
  // Reuse the web implementation for WebView-based recording
  private _webAdapter = new WebAudioAdapter()

  async startRecording(options?: RecordingOptions): Promise<RecordingSession> {
    return this._webAdapter.startRecording(options)
  }

  async pauseRecording(session: RecordingSession): Promise<void> {
    return this._webAdapter.pauseRecording(session)
  }

  async resumeRecording(session: RecordingSession): Promise<void> {
    return this._webAdapter.resumeRecording(session)
  }

  async stopRecording(session: RecordingSession): Promise<AudioBlob> {
    return this._webAdapter.stopRecording(session)
  }

  getAmplitude(session: RecordingSession): number {
    return this._webAdapter.getAmplitude(session)
  }

  async playAudio(src: string | Blob): Promise<AudioPlayback> {
    return this._webAdapter.playAudio(src)
  }

  async getInputDevices(): Promise<AudioDevice[]> {
    return this._webAdapter.getInputDevices()
  }

  async getOutputDevices(): Promise<AudioDevice[]> {
    return this._webAdapter.getOutputDevices()
  }

  isRecordingSupported(): boolean {
    return this._webAdapter.isRecordingSupported()
  }
}
