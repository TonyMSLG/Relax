import React, { useCallback, useEffect, useRef, useState } from 'react';
import Slider from '@mui/material/Slider';
import './AudioPlayer.css';

const CROSSFADE_DURATION_SECONDS = 2.8;
const CROSSFADE_MIN_DURATION_SECONDS = 1.2;
const OSCILLATION_INTENSITY_MAP = {
  'very-low': 0.05,
  low: 0.1,
  medium: 0.2,
  high: 0.3,
  'very-high': 0.5,
};

const createAudioInstance = (audioUrl) => {
  const audio = new Audio(audioUrl);
  audio.preload = 'auto';
  return audio;
};

const AudioPlayer = ({ audioUrl, settings, masterVolume }) => {
  const audioRefs = useRef([]);
  const activeAudioIndexRef = useRef(0);
  const isCrossfadingRef = useRef(false);
  const crossfadeAnimationFrameRef = useRef(null);
  const oscillationAnimationFrameRef = useRef(null);
  const isPlayingRef = useRef(false);
  const resumeAfterGlobalPauseRef = useRef(false);
  const volumeRef = useRef(50);
  const oscillationFactorRef = useRef(1);
  const targetOscillationFactorRef = useRef(1);
  const nextOscillationChangeRef = useRef(0);
  const audioGainRef = useRef([1, 0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);

  if (audioRefs.current.length === 0) {
    audioRefs.current = [createAudioInstance(audioUrl), createAudioInstance(audioUrl)];
  }

  const getNormalizedVolume = useCallback(() => volumeRef.current / 100, []);

  const getMasterVolumeFactor = useCallback(() => masterVolume / 100, [masterVolume]);

  const applyEffectiveVolumes = useCallback(() => {
    const normalizedVolume = getNormalizedVolume();
    const masterVolumeFactor = getMasterVolumeFactor();
    const oscillationFactor = oscillationFactorRef.current;

    audioRefs.current.forEach((audioElement, index) => {
      const nextVolume = normalizedVolume * masterVolumeFactor * oscillationFactor * audioGainRef.current[index];
      audioElement.volume = Math.max(0, Math.min(1, nextVolume));
    });
  }, [getMasterVolumeFactor, getNormalizedVolume]);

  const dispatchAudioState = useCallback((nextIsPlaying = isPlaying) => {
    window.dispatchEvent(
      new CustomEvent('audioStateChange', {
        detail: { isPlaying: nextIsPlaying, audioUrl, volume },
      })
    );
  }, [audioUrl, isPlaying, volume]);

  const resetAudioGains = useCallback(() => {
    audioGainRef.current = [0, 0];
    audioGainRef.current[activeAudioIndexRef.current] = 1;
    applyEffectiveVolumes();
  }, [applyEffectiveVolumes]);

  const syncLoopMode = useCallback(() => {
    audioRefs.current.forEach((audioElement) => {
      audioElement.loop = !settings.crossfadeEnabled;
    });
  }, [settings.crossfadeEnabled]);

  const playAudio = useCallback(() => {
    syncLoopMode();
    resetAudioGains();
    applyEffectiveVolumes();
    const activeAudio = audioRefs.current[activeAudioIndexRef.current];
    const playPromise = activeAudio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    resumeAfterGlobalPauseRef.current = false;
    isPlayingRef.current = true;
    setIsPlaying(true);
    window.dispatchEvent(new CustomEvent('audioPlaying', { detail: { isPlaying: true, audioUrl } }));
    dispatchAudioState(true);
  }, [applyEffectiveVolumes, audioUrl, dispatchAudioState, resetAudioGains, syncLoopMode]);

  const pauseAudio = useCallback((preserveForGlobalResume = false) => {
    cancelCrossfade();
    audioRefs.current.forEach((audioElement) => {
      audioElement.pause();
    });
    resetAudioGains();
    resumeAfterGlobalPauseRef.current = preserveForGlobalResume;
    isPlayingRef.current = false;
    setIsPlaying(false);
    window.dispatchEvent(new CustomEvent('audioPlaying', { detail: { isPlaying: false, audioUrl } }));
    dispatchAudioState(false);
  }, [audioUrl, dispatchAudioState, resetAudioGains]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const cancelCrossfade = () => {
    if (crossfadeAnimationFrameRef.current) {
      window.cancelAnimationFrame(crossfadeAnimationFrameRef.current);
      crossfadeAnimationFrameRef.current = null;
    }

    isCrossfadingRef.current = false;
  };

  const cancelOscillation = () => {
    if (oscillationAnimationFrameRef.current) {
      window.cancelAnimationFrame(oscillationAnimationFrameRef.current);
      oscillationAnimationFrameRef.current = null;
    }
  };

  const getOscillationSpread = useCallback(() => {
    const selectedIntensity = settings.oscillationIntensity || 'medium';
    return OSCILLATION_INTENSITY_MAP[selectedIntensity] ?? OSCILLATION_INTENSITY_MAP.medium;
  }, [settings.oscillationIntensity]);

  const pickOscillationTarget = useCallback(() => {
    const spread = getOscillationSpread();
    const minFactor = Math.max(0, 1 - spread);
    const maxFactor = 1 + spread;
    return minFactor + Math.random() * (maxFactor - minFactor);
  }, [getOscillationSpread]);

  const startCrossfade = useCallback(() => {
    if (!settings.crossfadeEnabled || !isPlaying || isCrossfadingRef.current) {
      return;
    }

    const currentAudio = audioRefs.current[activeAudioIndexRef.current];
    const nextIndex = activeAudioIndexRef.current === 0 ? 1 : 0;
    const nextAudio = audioRefs.current[nextIndex];

    if (!Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) {
      return;
    }

    const remainingDuration = currentAudio.duration - currentAudio.currentTime;
    const crossfadeDuration = Math.min(
      CROSSFADE_DURATION_SECONDS,
      Math.max(CROSSFADE_MIN_DURATION_SECONDS, remainingDuration)
    );

    nextAudio.currentTime = 0;
    nextAudio.loop = false;
    audioGainRef.current[nextIndex] = 0;
    applyEffectiveVolumes();

    const startSecondaryPlayback = nextAudio.play();
    if (startSecondaryPlayback && typeof startSecondaryPlayback.catch === 'function') {
      startSecondaryPlayback.catch(() => {});
    }

    cancelCrossfade();
    isCrossfadingRef.current = true;

    const crossfadeStartTime = performance.now();
    const crossfadeStep = (timestamp) => {
      const progress = Math.min((timestamp - crossfadeStartTime) / (crossfadeDuration * 1000), 1);
      const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      audioGainRef.current[activeAudioIndexRef.current] = 1 - easedProgress;
      audioGainRef.current[nextIndex] = easedProgress;
      applyEffectiveVolumes();

      if (progress < 1 && isPlaying) {
        crossfadeAnimationFrameRef.current = window.requestAnimationFrame(crossfadeStep);
        return;
      }

      currentAudio.pause();
      currentAudio.currentTime = 0;
      activeAudioIndexRef.current = nextIndex;
      audioGainRef.current = nextIndex === 0 ? [1, 0] : [0, 1];
      applyEffectiveVolumes();
      isCrossfadingRef.current = false;
      crossfadeAnimationFrameRef.current = null;
    };

    crossfadeAnimationFrameRef.current = window.requestAnimationFrame(crossfadeStep);
  }, [applyEffectiveVolumes, isPlaying, settings.crossfadeEnabled]);

  useEffect(() => {
    const previousAudioElements = audioRefs.current;
    const nextAudioElements = [createAudioInstance(audioUrl), createAudioInstance(audioUrl)];

    cancelCrossfade();
    cancelOscillation();
    previousAudioElements.forEach((audioElement) => {
      audioElement.pause();
      audioElement.currentTime = 0;
    });

    audioRefs.current = nextAudioElements;
    activeAudioIndexRef.current = 0;
    oscillationFactorRef.current = 1;
    targetOscillationFactorRef.current = 1;
    audioGainRef.current = [1, 0];

    return () => {
      cancelCrossfade();
      cancelOscillation();
      nextAudioElements.forEach((audioElement) => {
        audioElement.pause();
        audioElement.currentTime = 0;
      });
      window.dispatchEvent(
        new CustomEvent('audioPlaying', { detail: { isPlaying: false, audioUrl } })
      );
      window.dispatchEvent(
        new CustomEvent('audioStateChange', {
          detail: { isPlaying: false, audioUrl, volume: volumeRef.current },
        })
      );
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!settings.crossfadeEnabled) {
      cancelCrossfade();
      const inactiveIndex = activeAudioIndexRef.current === 0 ? 1 : 0;
      audioRefs.current[inactiveIndex].pause();
      audioRefs.current[inactiveIndex].currentTime = 0;
      resetAudioGains();
    }

    syncLoopMode();
    applyEffectiveVolumes();
    dispatchAudioState();
  }, [
    audioUrl,
    applyEffectiveVolumes,
    dispatchAudioState,
    isPlaying,
    masterVolume,
    resetAudioGains,
    settings.crossfadeEnabled,
    syncLoopMode,
    volume,
  ]);

  useEffect(() => {
    const handleGlobalAudioControl = (event) => {
      const { action } = event.detail;

      if (action === 'pause' && isPlayingRef.current) {
        pauseAudio(true);
      }

      if (action === 'play' && resumeAfterGlobalPauseRef.current) {
        playAudio();
      }
    };

    const handleCardToggle = (event) => {
      if (event.detail.audioUrl !== audioUrl) {
        return;
      }

      if (isPlayingRef.current) {
        pauseAudio(false);
        return;
      }

      playAudio();
    };

    const handlePresetLoad = (event) => {
      const { sounds } = event.detail;
      if (audioUrl in sounds) {
        const newVolume = sounds[audioUrl];
        volumeRef.current = newVolume;
        setVolume(newVolume);
        if (!isPlayingRef.current) {
          playAudio();
        }
      } else {
        if (isPlayingRef.current) {
          pauseAudio(false);
        }
      }
    };

    window.addEventListener('globalAudioControl', handleGlobalAudioControl);
    window.addEventListener('audioCardToggle', handleCardToggle);
    window.addEventListener('presetLoad', handlePresetLoad);

    return () => {
      window.removeEventListener('globalAudioControl', handleGlobalAudioControl);
      window.removeEventListener('audioCardToggle', handleCardToggle);
      window.removeEventListener('presetLoad', handlePresetLoad);
    };
  }, [audioUrl, pauseAudio, playAudio]);

  useEffect(() => {
    const handleTimeUpdate = (event) => {
      if (!settings.crossfadeEnabled || !isPlaying || isCrossfadingRef.current) {
        return;
      }

      const activeAudio = audioRefs.current[activeAudioIndexRef.current];
      if (event.currentTarget !== activeAudio || !Number.isFinite(activeAudio.duration)) {
        return;
      }

      const remainingDuration = activeAudio.duration - activeAudio.currentTime;
      if (remainingDuration <= CROSSFADE_DURATION_SECONDS) {
        startCrossfade();
      }
    };

    const handleEnded = (event) => {
      const activeAudio = audioRefs.current[activeAudioIndexRef.current];
      if (event.currentTarget !== activeAudio || !isPlaying) {
        return;
      }

      if (settings.crossfadeEnabled) {
        activeAudio.currentTime = 0;
        const replayPromise = activeAudio.play();
        if (replayPromise && typeof replayPromise.catch === 'function') {
          replayPromise.catch(() => {});
        }
      }
    };

    const managedAudioElements = [...audioRefs.current];

    managedAudioElements.forEach((audioElement) => {
      audioElement.addEventListener('timeupdate', handleTimeUpdate);
      audioElement.addEventListener('ended', handleEnded);
    });

    return () => {
      managedAudioElements.forEach((audioElement) => {
        audioElement.removeEventListener('timeupdate', handleTimeUpdate);
        audioElement.removeEventListener('ended', handleEnded);
      });
    };
  }, [isPlaying, settings.crossfadeEnabled, startCrossfade]);

  useEffect(() => {
    cancelOscillation();

    if (!settings.oscillationEnabled || !isPlaying) {
      oscillationFactorRef.current = 1;
      targetOscillationFactorRef.current = 1;
      applyEffectiveVolumes();
      return undefined;
    }

    targetOscillationFactorRef.current = pickOscillationTarget();
    nextOscillationChangeRef.current = performance.now() + 1200 + Math.random() * 1800;

    const oscillationStep = (timestamp) => {
      if (timestamp >= nextOscillationChangeRef.current) {
        targetOscillationFactorRef.current = pickOscillationTarget();
        nextOscillationChangeRef.current = timestamp + 1200 + Math.random() * 1800;
      }

      oscillationFactorRef.current +=
        (targetOscillationFactorRef.current - oscillationFactorRef.current) * 0.02;
      applyEffectiveVolumes();
      oscillationAnimationFrameRef.current = window.requestAnimationFrame(oscillationStep);
    };

    oscillationAnimationFrameRef.current = window.requestAnimationFrame(oscillationStep);

    return () => {
      cancelOscillation();
    };
  }, [
    applyEffectiveVolumes,
    isPlaying,
    pickOscillationTarget,
    settings.oscillationEnabled,
    settings.oscillationIntensity,
    volume,
  ]);

  const togglePlayPause = () => {
    setIsPlaying((prevIsPlaying) => {
      const isNowPlaying = !prevIsPlaying;
      if (isNowPlaying) {
        playAudio();
      } else {
        pauseAudio(false);
      }
      return isNowPlaying;
    });
  };

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
  };

  return (
    <div className="audio-player" onClick={(event) => event.stopPropagation()}>
      <button onClick={togglePlayPause} className="play-pause-btn" type="button">
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <Slider
        value={volume}
        onChange={handleVolumeChange}
        className="audio-player-slider"
        aria-labelledby="input-slider"
        valueLabelDisplay="auto"
        min={0}
        max={100}
        sx={{
          width: 100,
          color: '#474747',
          '& .MuiSlider-thumb': {
            '&:hover, &.Mui-focusVisible': {
              boxShadow: `0px 0px 0px 6px rgba(47, 47, 47, 0.3)`, 
            },
            '&.Mui-active': { 
              boxShadow: `0px 0px 0px 12px rgba(47, 47, 47, 0.3)`,
            }
          },
          '& .MuiSlider-track': {
            backgroundColor: '#474747', 
          },
          '& .MuiSlider-rail': {
            opacity: 0.5,
          },
        }}
      />
    </div>
  );
};

export default AudioPlayer;
