import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  className?: string;
  autoPlay?: boolean;
}

/**
 * AudioPlayer Component
 * 
 * A robust audio player for voice messages with:
 * - Play/pause controls
 * - Progress bar with seeking
 * - Volume control
 * - Duration display
 * - Download functionality
 * - Error handling
 */
const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioUrl, 
  className = '',
  autoPlay = false 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    // Set up event listeners
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoadingMeta(false);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setError('Failed to load audio');
      setIsLoading(false);
      setIsLoadingMeta(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      if (autoPlay) {
        audio.play().catch(error => {
          console.error('Auto-play failed:', error);
          setError('Auto-play failed');
        });
      }
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleCanPlayThrough = () => {
      setIsLoading(false);
    };

    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);

    // Set initial volume and source
    audio.volume = volume;
    audio.preload = 'metadata';
    audio.src = audioUrl;

    // Cleanup
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl, autoPlay, volume]);

  const togglePlayPause = () => {
    if (!audioRef.current || error) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(error => {
        console.error('Failed to play audio:', error);
        setError('Failed to play audio');
      });
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current || error || isLoadingMeta) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    audioRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
  };

  const toggleMute = () => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const downloadAudio = () => {
    try {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `voice-message-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const formatTime = (time: number): string => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  if (error) {
    return (
      <div className={`bg-red-900/20 border border-red-700 rounded-lg p-3 ${className}`}>
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={downloadAudio}
          className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
        >
          Try downloading instead
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-700 rounded-lg p-3 space-y-3 border border-gray-600 ${className}`}>
      {/* Main Controls */}
      <div className="flex items-center space-x-3">
        <button
          onClick={togglePlayPause}
          disabled={isLoadingMeta || error}
          className="flex items-center justify-center w-8 h-8 bg-indigo-600 hover:bg-indigo-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" />
          )}
        </button>

        {/* Progress Bar */}
        <div className="flex-1">
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="h-2 bg-gray-600 rounded-full cursor-pointer relative group"
          >
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            />
            {!isLoadingMeta && (
              <div
                className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-indigo-400 rounded-full shadow-lg transition-all duration-100 opacity-0 group-hover:opacity-100"
                style={{ left: `calc(${progressPercentage}% - 6px)` }}
              />
            )}
          </div>
        </div>

        {/* Time Display */}
        <div className="text-xs text-gray-400 font-mono min-w-[80px] text-right">
          {isLoadingMeta ? (
            <span>Loading...</span>
          ) : (
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          )}
        </div>

        {/* Download Button */}
        <button
          onClick={downloadAudio}
          className="text-gray-400 hover:text-white transition-colors p-1"
          title="Download audio"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Volume Controls */}
      <div className="flex items-center space-x-2">
        <button
          onClick={toggleMute}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
        />
        
        <span className="text-xs text-gray-500 min-w-[30px]">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
};

export default AudioPlayer;