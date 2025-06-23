import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Send, AlertCircle } from 'lucide-react';
import Button from './ui/Button';

interface VoiceRecorderProps {
  onSendAudio: (audioBlob: Blob, duration: number) => void;
  disabled?: boolean;
  className?: string;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

interface PermissionState {
  status: 'unknown' | 'granted' | 'denied' | 'prompt';
  error: string | null;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onSendAudio, 
  disabled = false, 
  className = '' 
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null
  });

  const [permissionState, setPermissionState] = useState<PermissionState>({
    status: 'unknown',
    error: null
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Refs for managing recording resources
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>();
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const permissionCheckRef = useRef<boolean>(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      audioStreamRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
      audioElementRef.current = null;
    }

    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
  }, []);

  // Check microphone permission on mount
  useEffect(() => {
    let mounted = true;

    const checkPermission = async () => {
      if (permissionCheckRef.current) return;
      permissionCheckRef.current = true;

      try {
        // First check if APIs are available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (mounted) {
            setPermissionState({
              status: 'denied',
              error: 'Audio recording not supported in this browser'
            });
          }
          return;
        }

        // Check permission API if available
        if (navigator.permissions) {
          try {
            const permission = await navigator.permissions.query({ 
              name: 'microphone' as PermissionName 
            });
            
            if (mounted) {
              setPermissionState({
                status: permission.state as any,
                error: null
              });
            }

            permission.onchange = () => {
              if (mounted) {
                setPermissionState(prev => ({
                  ...prev,
                  status: permission.state as any
                }));
              }
            };
          } catch (permError) {
            // Permission API not supported, try direct access
            console.log('Permission API not supported, will check on first use');
          }
        }
      } catch (error) {
        console.error('Permission check failed:', error);
        if (mounted) {
          setPermissionState({
            status: 'unknown',
            error: null
          });
        }
      }
    };

    checkPermission();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [cleanup]);

  // Timer effect for recording duration
  useEffect(() => {
    if (recordingState.isRecording && !recordingState.isPaused) {
      timerRef.current = window.setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: prev.duration + 1
        }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [recordingState.isRecording, recordingState.isPaused]);

  /**
   * Get the best supported audio MIME type with comprehensive fallbacks
   */
  const getBestSupportedMimeType = (): string => {
    const supportedTypes = [
      'audio/webm;codecs=opus',
      'audio/webm;codecs=vp8,opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
      'audio/mpeg'
    ];
    
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        console.log('Selected audio format:', type);
        return type;
      }
    }
    
    console.warn('No explicitly supported format found, using default');
    return 'audio/webm'; // Ultimate fallback
  };

  /**
   * Request microphone permission with comprehensive error handling
   */
  const requestMicrophonePermission = async (): Promise<boolean> => {
    if (isInitializing) return false;
    
    setIsInitializing(true);
    setPermissionState(prev => ({ ...prev, error: null }));
    
    try {
      // Test microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 44100, min: 8000, max: 48000 },
          channelCount: { ideal: 1 }
        } 
      });
      
      // Verify we actually got audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available');
      }

      // Check if tracks are enabled and ready
      const track = audioTracks[0];
      if (track.readyState !== 'live') {
        throw new Error('Microphone not ready');
      }
      
      setPermissionState({
        status: 'granted',
        error: null
      });
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      return true;
      
    } catch (error) {
      console.error('Microphone permission/access failed:', error);
      
      let errorMessage = 'Microphone access failed. ';
      let status: PermissionState['status'] = 'denied';
      
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            status = 'denied';
            errorMessage += 'Please allow microphone access in your browser settings and refresh the page.';
            break;
          case 'NotFoundError':
            errorMessage += 'No microphone found. Please connect a microphone and try again.';
            break;
          case 'NotSupportedError':
            errorMessage += 'Audio recording is not supported in this browser.';
            break;
          case 'NotReadableError':
            errorMessage += 'Microphone is already in use by another application.';
            break;
          case 'OverconstrainedError':
            errorMessage += 'Microphone does not meet the required specifications.';
            break;
          case 'SecurityError':
            errorMessage += 'Microphone access blocked due to security restrictions.';
            break;
          default:
            errorMessage += `${error.message || 'Please check your microphone settings.'}`;
        }
      }
      
      setPermissionState({
        status,
        error: errorMessage
      });
      
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Start audio recording with robust error handling
   */
  const startRecording = async () => {
    // Check permission first
    if (permissionState.status !== 'granted') {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) return;
    }

    try {
      setPermissionState(prev => ({ ...prev, error: null }));
      
      // Get fresh audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 44100, min: 8000, max: 48000 },
          channelCount: { ideal: 1 }
        } 
      });
      
      // Verify stream is valid
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || audioTracks[0].readyState !== 'live') {
        throw new Error('Invalid audio stream');
      }
      
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      
      // Determine best MIME type
      const mimeType = getBestSupportedMimeType();

      // Create MediaRecorder with error handling
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { 
          mimeType,
          audioBitsPerSecond: 128000
        });
      } catch (mimeError) {
        console.warn('Failed with preferred MIME type, trying default:', mimeError);
        recorder = new MediaRecorder(stream);
      }
      
      mediaRecorderRef.current = recorder;

      // Set up comprehensive event handlers
      recorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes');
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped, chunks:', audioChunksRef.current.length);
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: recorder.mimeType || mimeType 
          });
          
          if (audioBlob.size > 0) {
            const audioUrl = URL.createObjectURL(audioBlob);
            
            setRecordingState(prev => ({
              ...prev,
              audioBlob,
              audioUrl,
              isRecording: false,
              isPaused: false
            }));
          } else {
            setPermissionState(prev => ({
              ...prev,
              error: 'Recording failed - no audio data captured'
            }));
          }
        }
        
        cleanup();
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setPermissionState(prev => ({
          ...prev,
          error: 'Recording failed. Please try again.'
        }));
        stopRecording();
      };

      recorder.onstart = () => {
        console.log('Recording started successfully');
      };

      // Start recording with data collection interval
      recorder.start(1000); // Collect data every second
      
      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        audioUrl: null
      }));
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setPermissionState(prev => ({
        ...prev,
        error: 'Failed to start recording. Please check your microphone and try again.'
      }));
      cleanup();
    }
  };

  /**
   * Stop audio recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      const state = mediaRecorderRef.current.state;
      console.log('Stopping recording, current state:', state);
      
      if (state === 'recording' || state === 'paused') {
        mediaRecorderRef.current.stop();
      }
    }
  };

  /**
   * Play recorded audio
   */
  const playAudio = () => {
    if (recordingState.audioUrl) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      
      const audio = new Audio(recordingState.audioUrl);
      audioElementRef.current = audio;
      
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
      };
      
      audio.play().catch(error => {
        console.error('Failed to play audio:', error);
        setIsPlaying(false);
      });
    }
  };

  /**
   * Pause audio playback
   */
  const pauseAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
  };

  /**
   * Delete recorded audio
   */
  const deleteRecording = () => {
    if (recordingState.audioUrl) {
      URL.revokeObjectURL(recordingState.audioUrl);
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    
    setRecordingState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null
    });
    
    setIsPlaying(false);
  };

  /**
   * Send recorded audio
   */
  const sendAudio = () => {
    if (recordingState.audioBlob) {
      onSendAudio(recordingState.audioBlob, recordingState.duration);
      deleteRecording();
    }
  };

  /**
   * Format duration in MM:SS format
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render permission error dialog
  if (permissionState.error) {
    return (
      <div className={`bg-red-900/20 border border-red-700 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 mb-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400 font-medium">Microphone Error</span>
        </div>
        <p className="text-red-300 text-sm mb-3">{permissionState.error}</p>
        <div className="flex space-x-2">
          <Button
            onClick={requestMicrophonePermission}
            variant="secondary"
            size="sm"
            disabled={isInitializing}
            isLoading={isInitializing}
          >
            Try Again
          </Button>
          <Button
            onClick={() => setPermissionState({ status: 'unknown', error: null })}
            variant="secondary"
            size="sm"
          >
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Recording Controls */}
      {!recordingState.audioBlob && (
        <div className="flex items-center space-x-3">
          {!recordingState.isRecording ? (
            <Button
              onClick={startRecording}
              disabled={disabled || isInitializing}
              isLoading={isInitializing}
              className="flex items-center space-x-2"
            >
              <Mic className="w-4 h-4" />
              <span>{isInitializing ? 'Initializing...' : 'Record'}</span>
            </Button>
          ) : (
            <>
              <Button
                onClick={stopRecording}
                variant="danger"
                className="flex items-center space-x-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </Button>
              <div className="flex items-center space-x-2 text-red-400">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-mono text-sm">
                  {formatDuration(recordingState.duration)}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Playback Controls */}
      {recordingState.audioBlob && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              Recorded Audio ({formatDuration(recordingState.duration)})
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              onClick={isPlaying ? pauseAudio : playAudio}
              variant="secondary"
              size="sm"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            
            <Button
              onClick={deleteRecording}
              variant="danger"
              size="sm"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={sendAudio}
              disabled={disabled}
              className="flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;