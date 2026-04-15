import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import './App.css';
import AmbianceCard from './components/AmbianceCard/AmbianceCard';
import AnimatedBackground from './components/AnimatedBackground';
import ambiances from './ambiancesData';

const DEFAULT_AUDIO_SETTINGS = {
  crossfadeEnabled: false,
  oscillationEnabled: false,
  oscillationIntensity: 'medium',
};

const OSCILLATION_OPTIONS = [
  { value: 'very-low', label: 'Tres faible (5%)' },
  { value: 'low', label: 'Faible (10%)' },
  { value: 'medium', label: 'Moyen (20%)' },
  { value: 'high', label: 'Fort (30%)' },
  { value: 'very-high', label: 'Tres fort (50%)' },
];

const DEFAULT_BACKGROUND_PALETTE = {
  glowLight: '#fff2de',
  glowWarm: '#ffc9a3',
  baseStart: '#f8e3d2',
  baseEnd: '#7b9cb5',
  inkWarm: '#d95b61',
  inkCool: '#4e80c7',
};

const COLOR_FIELDS = [
  { key: 'glowLight', label: 'Light glow' },
  { key: 'glowWarm', label: 'Warm glow' },
  { key: 'baseStart', label: 'Gradient start' },
  { key: 'baseEnd', label: 'Gradient end' },
  { key: 'inkWarm', label: 'Warm ink' },
  { key: 'inkCool', label: 'Cool ink' },
];

const encodePresetData = (data) => {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return btoa(String.fromCharCode(...bytes));
};

const decodePresetData = (encoded) => {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

function App() {
  const audioStatesRef = useRef(new Map());
  const cardRefs = useRef(new Map());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [isAnyPlaying, setIsAnyPlaying] = useState(false);
  const [activeAudioUrls, setActiveAudioUrls] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [masterVolume, setMasterVolume] = useState(() => {
    if (typeof window === 'undefined') {
      return 100;
    }

    const savedMasterVolume = window.localStorage.getItem('relax-master-volume');
    return savedMasterVolume ? Number(savedMasterVolume) : 100;
  });
  const [audioSettings, setAudioSettings] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_AUDIO_SETTINGS;
    }

    const savedAudioSettings = window.localStorage.getItem('relax-audio-settings');

    if (!savedAudioSettings) {
      return DEFAULT_AUDIO_SETTINGS;
    }

    try {
      return {
        ...DEFAULT_AUDIO_SETTINGS,
        ...JSON.parse(savedAudioSettings),
      };
    } catch {
      return DEFAULT_AUDIO_SETTINGS;
    }
  });
  const [backgroundPalette, setBackgroundPalette] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_BACKGROUND_PALETTE;
    }

    const savedPalette = window.localStorage.getItem('relax-background-palette');

    if (!savedPalette) {
      return DEFAULT_BACKGROUND_PALETTE;
    }

    try {
      return {
        ...DEFAULT_BACKGROUND_PALETTE,
        ...JSON.parse(savedPalette),
      };
    } catch {
      return DEFAULT_BACKGROUND_PALETTE;
    }
  });
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const presetsRef = useRef(null);
  const [presets, setPresets] = useState(() => {
    if (typeof window === 'undefined') return [];
    const saved = window.localStorage.getItem('nubecula-presets');
    if (!saved) return [];
    try { return JSON.parse(saved); } catch { return []; }
  });
  const [presetName, setPresetName] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [sharedPreset, setSharedPreset] = useState(null);
  const [copiedPresetId, setCopiedPresetId] = useState(null);
  const [activePresetId, setActivePresetId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    window.localStorage.setItem('relax-audio-settings', JSON.stringify(audioSettings));
  }, [audioSettings]);

  useEffect(() => {
    window.localStorage.setItem('relax-master-volume', String(masterVolume));
  }, [masterVolume]);

  useEffect(() => {
    window.localStorage.setItem('relax-background-palette', JSON.stringify(backgroundPalette));
  }, [backgroundPalette]);

  useEffect(() => {
    window.localStorage.setItem('nubecula-presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const presetParam = urlParams.get('p');
    if (presetParam) {
      try {
        const data = decodePresetData(presetParam);
        if (data && data.s && typeof data.s === 'object') {
          setSharedPreset({ name: data.n || 'Shared mix', sounds: data.s });
        }
      } catch { /* invalid preset data */ }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const handleAudioStateChange = (event) => {
      const { audioUrl, isPlaying, volume } = event.detail;
      audioStatesRef.current.set(audioUrl, {
        ...(audioStatesRef.current.get(audioUrl) || {}),
        isPlaying,
        volume: volume !== undefined ? volume : (audioStatesRef.current.get(audioUrl)?.volume ?? 50),
      });

      const nextActiveAudioUrls = Array.from(audioStatesRef.current.entries())
        .filter(([, state]) => state.isPlaying)
        .map(([trackedAudioUrl]) => trackedAudioUrl);

      setActiveAudioUrls(nextActiveAudioUrls);
      setIsAnyPlaying(nextActiveAudioUrls.length > 0);
    };

    window.addEventListener('audioStateChange', handleAudioStateChange);

    return () => {
      window.removeEventListener('audioStateChange', handleAudioStateChange);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 280);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const activeAmbiances = ambiances.filter((ambiance) => activeAudioUrls.includes(ambiance.audioUrl));

  const filteredAmbiances = searchQuery.trim()
    ? ambiances.filter((a) => a.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : ambiances;

  const handleAudioSettingChange = (settingKey) => (event) => {
    setAudioSettings((currentSettings) => ({
      ...currentSettings,
      [settingKey]: event.target.checked,
    }));
  };

  const handleOscillationIntensityChange = (event) => {
    setAudioSettings((currentSettings) => ({
      ...currentSettings,
      oscillationIntensity: event.target.value,
    }));
  };

  const handlePaletteChange = (colorKey, nextColor) => {
    setBackgroundPalette((currentPalette) => ({
      ...currentPalette,
      [colorKey]: nextColor,
    }));
  };

  const handlePaletteReset = () => {
    setBackgroundPalette(DEFAULT_BACKGROUND_PALETTE);
  };

  const handleMasterVolumeChange = (event, newValue) => {
    setMasterVolume(newValue);
  };

  const handleGlobalPlaybackToggle = () => {
    window.dispatchEvent(
      new CustomEvent('globalAudioControl', {
        detail: { action: isAnyPlaying ? 'pause' : 'play' },
      })
    );
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const captureCurrentMix = () => {
    const sounds = {};
    audioStatesRef.current.forEach((state, audioUrl) => {
      if (state.isPlaying) {
        const ambiance = ambiances.find((a) => a.audioUrl === audioUrl);
        if (ambiance) {
          sounds[String(ambiance.id)] = state.volume;
        }
      }
    });
    return sounds;
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const sounds = captureCurrentMix();
    if (Object.keys(sounds).length === 0) return;
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    setPresets((prev) => [...prev, { id, name, sounds }]);
    setPresetName('');
  };

  const handleLoadPreset = (preset) => {
    if (activePresetId === preset.id && isAnyPlaying) {
      window.dispatchEvent(
        new CustomEvent('globalAudioControl', { detail: { action: 'pause' } })
      );
      setActivePresetId(null);
      return;
    }
    const soundsByUrl = {};
    Object.entries(preset.sounds).forEach(([ambianceId, volume]) => {
      const ambiance = ambiances.find((a) => a.id === Number(ambianceId));
      if (ambiance) {
        soundsByUrl[ambiance.audioUrl] = volume;
      }
    });
    window.dispatchEvent(
      new CustomEvent('presetLoad', { detail: { sounds: soundsByUrl } })
    );
    setActivePresetId(preset.id);
  };

  const handleDeletePreset = (presetId) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
  };

  const handleSharePreset = async (preset) => {
    const data = { n: preset.name, s: preset.sounds };
    const encoded = encodePresetData(data);
    const url = `${window.location.origin}${window.location.pathname}?p=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPresetId(preset.id);
      setTimeout(() => setCopiedPresetId(null), 2000);
    } catch { /* clipboard not available */ }
  };

  const handleImportFromUrl = () => {
    const input = importUrl.trim();
    if (!input) return;
    try {
      const parsed = new URL(input);
      const presetParam = parsed.searchParams.get('p');
      if (!presetParam) return;
      const data = decodePresetData(presetParam);
      if (!data || !data.s || typeof data.s !== 'object') return;
      const duplicate = presets.find((p) => {
        const keysA = Object.keys(p.sounds);
        const keysB = Object.keys(data.s);
        if (keysA.length !== keysB.length) return false;
        return keysA.every((k) => p.sounds[k] === data.s[k]);
      });
      if (duplicate) {
        setImportUrl('');
        return;
      }
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
      setPresets((prev) => [...prev, { id, name: data.n || 'Imported mix', sounds: data.s }]);
      setImportUrl('');
    } catch { /* invalid URL or data */ }
  };

  const handleLoadSharedPreset = () => {
    if (!sharedPreset) return;
    handleLoadPreset(sharedPreset);
  };

  const handleSaveSharedPreset = () => {
    if (!sharedPreset) return;
    const duplicate = presets.find((p) => {
      const keysA = Object.keys(p.sounds);
      const keysB = Object.keys(sharedPreset.sounds);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((k) => p.sounds[k] === sharedPreset.sounds[k]);
    });
    if (duplicate) {
      setSharedPreset(null);
      return;
    }
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    setPresets((prev) => [...prev, { id, ...sharedPreset }]);
    setSharedPreset(null);
  };

  const toggleImmersiveMode = async () => {
    const nextImmersiveMode = !isImmersiveMode;
    setIsImmersiveMode(nextImmersiveMode);

    if (nextImmersiveMode) {
      setIsSettingsOpen(false);

      if (document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // Ignore fullscreen failures and still enable the visual focus mode.
        }
      }

      return;
    }

    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore fullscreen exit failures and keep the interface restored.
      }
    }
  };

  const scrollToAmbianceCard = async (audioUrl) => {
    if (isImmersiveMode) {
      await toggleImmersiveMode();
    }

    const cardElement = cardRefs.current.get(audioUrl);

    if (!cardElement) {
      return;
    }

    cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cardElement.focus({ preventScroll: true });
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsImmersiveMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isPresetsOpen) return;
    const handleClickOutside = (e) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target)) {
        setIsPresetsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPresetsOpen]);

  return (
    <div className={`App ${isImmersiveMode ? 'immersive-mode' : ''}`}>
      <AnimatedBackground palette={backgroundPalette} />
      <div className="top-bar-shell">
        <div className="top-bar">
          <div className="brand-lockup">
            <h1 className="app-title">Nubecula</h1>
          </div>
          <div className="master-audio-panel">
            <button
              type="button"
              className="master-play-button"
              onClick={handleGlobalPlaybackToggle}
              aria-label={isAnyPlaying ? 'Pause all playing sounds' : 'Resume paused sounds'}
            >
              {isAnyPlaying ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className="master-volume-block">
              <div className="master-volume-label-row">
                <span className="master-volume-label">Master volume</span>
                <span className="master-volume-value">{masterVolume}%</span>
              </div>
              <Slider
                value={masterVolume}
                onChange={handleMasterVolumeChange}
                min={0}
                max={100}
                className="master-volume-slider"
                aria-label="Master volume"
                sx={{
                  color: '#3d3c42',
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: '0 0 0 8px rgba(61, 60, 66, 0.14)',
                    },
                  },
                }}
              />
            </div>
          </div>
          <div className="top-bar-actions">
            {!isImmersiveMode && (
              <div className={`active-sounds-widget ${activeAmbiances.length > 0 ? 'has-active' : ''}`}>
                <button
                  type="button"
                  className="active-sounds-trigger"
                  aria-label={`${activeAmbiances.length} active sounds`}
                >
                  <span className="active-sounds-count">{activeAmbiances.length}</span>
                  <span className="active-sounds-text">Active</span>
                </button>
                {activeAmbiances.length > 0 && (
                  <div className="active-sounds-popover">
                    <p className="active-sounds-heading">Active sounds</p>
                    <div className="active-sounds-list">
                      {activeAmbiances.map((ambiance) => (
                        <button
                          key={ambiance.id}
                          type="button"
                          className="active-sound-item"
                          onClick={() => scrollToAmbianceCard(ambiance.audioUrl)}
                        >
                          <img src={ambiance.imageUrl} alt="" className="active-sound-icon" />
                          <span>{ambiance.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isImmersiveMode && (
              <div className="presets-widget" ref={presetsRef}>
                <button
                  type="button"
                  className="presets-trigger"
                  onClick={() => setIsPresetsOpen((v) => !v)}
                >
                  <span className="presets-trigger-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm4 5h12v2H8zm-4 5h16v2H4z" /></svg>
                  </span>
                  <span className="presets-trigger-text">Presets</span>
                  {presets.length > 0 && <span className="presets-trigger-count">{presets.length}</span>}
                </button>
                {isPresetsOpen && (
                  <div className="presets-popover">
                    <div className="presets-popover-section">
                      <p className="presets-popover-heading">Save current mix</p>
                      <div className="preset-save-row">
                        <input
                          type="text"
                          className="preset-name-input"
                          placeholder="Name…"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
                        />
                        <button
                          type="button"
                          className="preset-action-btn preset-action-save"
                          onClick={handleSavePreset}
                          disabled={!presetName.trim() || activeAmbiances.length === 0}
                          title="Save"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="presets-popover-divider" />
                    <div className="presets-popover-section">
                      <p className="presets-popover-heading">Import from link</p>
                      <div className="preset-save-row">
                        <input
                          type="text"
                          className="preset-name-input"
                          placeholder="Paste link…"
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleImportFromUrl(); }}
                        />
                        <button
                          type="button"
                          className="preset-action-btn preset-action-save"
                          onClick={handleImportFromUrl}
                          disabled={!importUrl.trim()}
                          title="Import"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
                        </button>
                      </div>
                    </div>
                    {presets.length > 0 && (
                      <>
                        <div className="presets-popover-divider" />
                        <div className="presets-popover-section presets-popover-list-section">
                          <p className="presets-popover-heading">Saved ({presets.length})</p>
                          <div className="preset-list">
                            {presets.map((preset) => {
                              const isActive = activePresetId === preset.id && isAnyPlaying;
                              return (
                                <div key={preset.id} className={`preset-item${isActive ? ' preset-item--active' : ''}`}>
                                  <div className="preset-item-info">
                                    <span className="preset-item-name">{preset.name}</span>
                                    <span className="preset-item-sounds">
                                      <span className="preset-item-sounds-inner">
                                        {Object.entries(preset.sounds).map(([ambianceId, vol]) => {
                                          const a = ambiances.find((x) => x.id === Number(ambianceId));
                                          return a ? `${a.name} ${vol}%` : null;
                                        }).filter(Boolean).join(' · ')}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="preset-item-actions">
                                    <button
                                      type="button"
                                      className={`preset-action-btn${isActive ? ' preset-action-btn--playing' : ''}`}
                                      onClick={() => handleLoadPreset(preset)}
                                      title={isActive ? 'Pause' : 'Play'}
                                    >
                                      {isActive ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                      ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      className="preset-action-btn"
                                      onClick={() => handleSharePreset(preset)}
                                      title={copiedPresetId === preset.id ? 'Copied!' : 'Share'}
                                    >
                                      {copiedPresetId === preset.id ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
                                      ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" /></svg>
                                      )}
                                    </button>
                                    <button type="button" className="preset-action-btn preset-action-delete" onClick={() => handleDeletePreset(preset.id)} title="Delete">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {!isImmersiveMode && (
              <Button
                variant="contained"
                className="app-tool-button"
                onClick={() => setIsSettingsOpen(true)}
              >
                Settings
              </Button>
            )}
            <Button
              variant="contained"
              className="app-tool-button app-tool-button-secondary"
              onClick={toggleImmersiveMode}
            >
              {isImmersiveMode ? 'Exit immersive mode' : 'Immersive mode'}
            </Button>
          </div>
        </div>
      </div>
      <Drawer
        anchor="right"
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        PaperProps={{
          className: 'palette-drawer-paper',
          sx: {
            width: 'min(360px, 100vw)',
            background: 'rgba(250, 244, 239, 0.92)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            boxShadow: '-4px 0 40px rgba(59, 46, 53, 0.12)',
            border: 'none',
          },
        }}
      >
        <Box className="palette-drawer-content">
          <div className="palette-drawer-header">
            <h2>Settings</h2>
            <p>Audio behavior and background palette in one place.</p>
          </div>
          <div className="settings-section">
            <h3>Audio</h3>
            <FormControlLabel
              control={(
                <Switch
                  checked={audioSettings.crossfadeEnabled}
                  onChange={handleAudioSettingChange('crossfadeEnabled')}
                />
              )}
              label="Crossfade looping"
              className="settings-switch"
            />
            <p className="settings-help-text">
              Fade between the end and the restart of each sound loop.
            </p>
            <FormControlLabel
              control={(
                <Switch
                  checked={audioSettings.oscillationEnabled}
                  onChange={handleAudioSettingChange('oscillationEnabled')}
                />
              )}
              label="Volume oscillation"
              className="settings-switch"
            />
            <p className="settings-help-text">
              Add a gentle random volume drift of around plus or minus twenty percent to each sound independently.
            </p>
            <FormControl size="small" className="settings-select-control" disabled={!audioSettings.oscillationEnabled}>
              <InputLabel id="oscillation-intensity-label">Oscillation intensity</InputLabel>
              <Select
                labelId="oscillation-intensity-label"
                value={audioSettings.oscillationIntensity}
                label="Oscillation intensity"
                onChange={handleOscillationIntensityChange}
              >
                {OSCILLATION_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <p className="settings-help-text">
              Choose how far the random drift can move around the base volume.
            </p>
          </div>
          <Divider />
          <div className="settings-section">
            <h3>Background</h3>
            <p className="settings-help-text">
              Six colors drive the full ink animation.
            </p>
          </div>
          <div className="palette-field-list">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="palette-color-field">
                <span>{label}</span>
                <span className="palette-color-input-wrap">
                  <span
                    className="palette-color-swatch"
                    style={{ backgroundColor: backgroundPalette[key] }}
                  ></span>
                  <input
                    type="color"
                    value={backgroundPalette[key]}
                    onChange={(event) => handlePaletteChange(key, event.target.value)}
                    aria-label={label}
                  />
                </span>
              </label>
            ))}
          </div>
          <div className="palette-drawer-actions">
            <Button variant="outlined" onClick={handlePaletteReset}>Reset defaults</Button>
            <Button variant="contained" onClick={() => setIsSettingsOpen(false)}>Done</Button>
          </div>
        </Box>
      </Drawer>
      {sharedPreset && !isImmersiveMode && (
        <div className="shared-preset-banner">
          <div className="shared-preset-info">
            <span className="shared-preset-label">Shared mix</span>
            <span className="shared-preset-name">{sharedPreset.name}</span>
            <span className="shared-preset-detail">
              {Object.entries(sharedPreset.sounds).map(([ambianceId, vol]) => {
                const a = ambiances.find((x) => x.id === Number(ambianceId));
                return a ? `${a.name} ${vol}%` : null;
              }).filter(Boolean).join(' · ')}
            </span>
          </div>
          <div className="shared-preset-actions">
            <Button variant="contained" className="app-tool-button" onClick={handleLoadSharedPreset}>
              Load
            </Button>
            <Button variant="contained" className="app-tool-button" onClick={handleSaveSharedPreset}>
              Save
            </Button>
            <button type="button" className="shared-preset-dismiss" onClick={() => setSharedPreset(null)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </button>
          </div>
        </div>
      )}
      {!isImmersiveMode && (
        <div className="search-bar-wrap">
          <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input
            type="text"
            className="search-bar-input"
            placeholder="Search sounds…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-bar-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          )}
        </div>
      )}
      <main className="App-content">
        {filteredAmbiances.map(ambiance => (
          <div
            key={ambiance.id}
            ref={(node) => {
              if (node) {
                cardRefs.current.set(ambiance.audioUrl, node);
              } else {
                cardRefs.current.delete(ambiance.audioUrl);
              }
            }}
            className="ambiance-card-anchor"
            tabIndex={-1}
          >
            <AmbianceCard
              ambiance={ambiance}
              audioSettings={audioSettings}
              masterVolume={masterVolume}
            />
          </div>
        ))}
      </main>
      <footer className='footer'>
        <p>&copy; tonysalgueiro.com - 2026</p>
      </footer>
      {showScrollTop && !isImmersiveMode && (
        <button
          type="button"
          className="scroll-to-top-button"
          onClick={handleScrollToTop}
          aria-label="Scroll back to top"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5L5 12H9V19H15V12H19L12 5Z" fill="currentColor"/>
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;
