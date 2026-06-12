import type {
  AudioAdapter,
  AudioDevice,
  RecordingOptions,
  RecordingSession,
  AudioBlob,
  AudioPlayback,
} from '../adapters/AudioAdapter'

interface ActiveRecording {
  session: RecordingSession
  mediaRecorder: MediaRecorder
  chunks: Blob[]
  analyser: AnalyserNode
  audioContext: AudioContext
  resolve: (blob: AudioBlob) => void
  reject: (err: Error) => void
}

/**
 * Web / PWA implementation of AudioAdapter.
 * Uses MediaRecorder API and Web Audio API.
 */
export class WebAudioAdapter implements AudioAdapter {
  private _recordings = new Map<string, ActiveRecording>()
  private _sessionCounter = 0

  async startRecording(options?: RecordingOptions): Promise<RecordingSession> {
    const constraints: MediaStreamConstraints = {
      audio: options?.deviceId
        ? { deviceId: { exact: options.deviceId } }
        : true,
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const session: RecordingSession = {
      id: `rec-${++this._sessionCounter}-${Date.now()}`,
      startedAt: new Date(),
      isPaused: false,
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const mediaRecorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    let resolveRecording!: (blob: AudioBlob) => void
    let rejectRecording!: (err: Error) => void

    const promise = new Promise<AudioBlob>((res, rej) => {
      resolveRecording = res
      rejectRecording = rej
    })

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      stream.getTracks().forEach(t => t.stop())
      audioContext.close()
      
      const duration = (Date.now() - session.startedAt.getTime()) / 1000
      resolveRecording({ blob, duration, mimeType })
    }

    mediaRecorder.onerror = (e) => {
      rejectRecording(new Error(`Recording error: ${e.toString()}`))
    }

    mediaRecorder.start(1000) // Collect chunks every second

    this._recordings.set(session.id, {
      session,
      mediaRecorder,
      chunks,
      analyser,
      audioContext,
      resolve: resolveRecording,
      reject: rejectRecording,
    })

    // Store the promise for stopRecording to await
    void promise
    this._recordings.get(session.id)!['promise' as keyof ActiveRecording] = promise as never

    return session
  }

  async pauseRecording(session: RecordingSession): Promise<void> {
    const rec = this._recordings.get(session.id)
    if (!rec) throw new Error(`Recording session not found: ${session.id}`)
    rec.mediaRecorder.pause()
    rec.session.isPaused = true
  }

  async resumeRecording(session: RecordingSession): Promise<void> {
    const rec = this._recordings.get(session.id)
    if (!rec) throw new Error(`Recording session not found: ${session.id}`)
    rec.mediaRecorder.resume()
    rec.session.isPaused = false
  }

  async stopRecording(session: RecordingSession): Promise<AudioBlob> {
    const rec = this._recordings.get(session.id)
    if (!rec) throw new Error(`Recording session not found: ${session.id}`)

    return new Promise((resolve, reject) => {
      rec.resolve = resolve
      rec.reject = reject
      rec.mediaRecorder.stop()
      this._recordings.delete(session.id)
    })
  }

  getAmplitude(session: RecordingSession): number {
    const rec = this._recordings.get(session.id)
    if (!rec) return 0
    
    const dataArray = new Uint8Array(rec.analyser.frequencyBinCount)
    rec.analyser.getByteFrequencyData(dataArray)
    const sum = dataArray.reduce((a, b) => a + b, 0)
    return sum / (dataArray.length * 255)
  }

  async playAudio(src: string | Blob): Promise<AudioPlayback> {
    const audio = new Audio()
    audio.src = src instanceof Blob ? URL.createObjectURL(src) : src
    
    const timeUpdateCallbacks: Array<(time: number) => void> = []
    audio.ontimeupdate = () => {
      timeUpdateCallbacks.forEach(cb => cb(audio.currentTime))
    }

    return {
      play: () => void audio.play(),
      pause: () => audio.pause(),
      stop: () => { audio.pause(); audio.currentTime = 0 },
      seek: (seconds: number) => { audio.currentTime = seconds },
      onTimeUpdate: (callback) => { timeUpdateCallbacks.push(callback) },
      duration: audio.duration,
    }
  }

  async getInputDevices(): Promise<AudioDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter(d => d.kind === 'audioinput')
      .map(d => ({ id: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 6)}`, kind: 'audioinput' as const }))
  }

  async getOutputDevices(): Promise<AudioDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter(d => d.kind === 'audiooutput')
      .map(d => ({ id: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 6)}`, kind: 'audiooutput' as const }))
  }

  isRecordingSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices !== 'undefined'
  }
}
