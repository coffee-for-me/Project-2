/**
 * Audio Utilities
 * 
 * Utility functions for audio processing, format detection,
 * and codec management for the voice messaging system.
 */

/**
 * Supported audio MIME types in order of preference
 */
export const SUPPORTED_AUDIO_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/wav'
] as const;

/**
 * Audio recording configuration
 */
export const AUDIO_CONFIG = {
  sampleRate: 44100,
  audioBitsPerSecond: 128000, // 128 kbps
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
} as const;

/**
 * Get the best supported audio MIME type for recording
 */
export function getBestSupportedMimeType(): string {
  for (const type of SUPPORTED_AUDIO_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  // Fallback to basic WebM if nothing else is supported
  return 'audio/webm';
}

/**
 * Check if the browser supports audio recording
 */
export function isAudioRecordingSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.MediaRecorder
  );
}

/**
 * Get audio constraints for getUserMedia
 */
export function getAudioConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: AUDIO_CONFIG.echoCancellation,
      noiseSuppression: AUDIO_CONFIG.noiseSuppression,
      autoGainControl: AUDIO_CONFIG.autoGainControl,
      sampleRate: AUDIO_CONFIG.sampleRate
    }
  };
}

/**
 * Format duration in MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert audio blob to data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get audio file extension from MIME type
 */
export function getAudioExtension(mimeType: string): string {
  const typeMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav'
  };
  
  // Extract base type (remove codecs)
  const baseType = mimeType.split(';')[0];
  return typeMap[baseType] || 'webm';
}

/**
 * Validate audio file size
 */
export function validateAudioSize(blob: Blob, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return blob.size <= maxSizeBytes;
}

/**
 * Create audio element for playback testing
 */
export function createAudioElement(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.preload = 'metadata';
  return audio;
}

/**
 * Check if audio can be played in the browser
 */
export function canPlayAudioType(mimeType: string): boolean {
  const audio = document.createElement('audio');
  return audio.canPlayType(mimeType) !== '';
}

/**
 * Audio permission states
 */
export type AudioPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Check microphone permission status
 */
export async function checkMicrophonePermission(): Promise<AudioPermissionState> {
  try {
    if (navigator.permissions) {
      const permission = await navigator.permissions.query({ 
        name: 'microphone' as PermissionName 
      });
      return permission.state as AudioPermissionState;
    }
    return 'unknown';
  } catch (error) {
    console.log('Permission API not supported');
    return 'unknown';
  }
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(getAudioConstraints());
    // Stop the stream immediately as we just wanted permission
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return false;
  }
}

/**
 * Audio error types and messages
 */
export const AUDIO_ERRORS = {
  NOT_ALLOWED: 'Microphone access denied. Please allow microphone access in your browser settings.',
  NOT_FOUND: 'No microphone found. Please connect a microphone and try again.',
  NOT_SUPPORTED: 'Audio recording is not supported in this browser.',
  NOT_READABLE: 'Microphone is already in use by another application.',
  RECORDING_FAILED: 'Recording failed. Please try again.',
  PLAYBACK_FAILED: 'Audio playback failed. The audio format may not be supported.',
  FILE_TOO_LARGE: 'Audio file is too large. Please record a shorter message.',
  UNKNOWN: 'An unknown audio error occurred. Please try again.'
} as const;

/**
 * Get user-friendly error message from MediaRecorder error
 */
export function getAudioErrorMessage(error: Error): string {
  switch (error.name) {
    case 'NotAllowedError':
      return AUDIO_ERRORS.NOT_ALLOWED;
    case 'NotFoundError':
      return AUDIO_ERRORS.NOT_FOUND;
    case 'NotSupportedError':
      return AUDIO_ERRORS.NOT_SUPPORTED;
    case 'NotReadableError':
      return AUDIO_ERRORS.NOT_READABLE;
    default:
      return AUDIO_ERRORS.UNKNOWN;
  }
}