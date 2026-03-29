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
    const handleAudioStateChange = (event) => {
      const { audioUrl, isPlaying } = event.detail;
      audioStatesRef.current.set(audioUrl, {
        ...(audioStatesRef.current.get(audioUrl) || {}),
        isPlaying,
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
        PaperProps={{ className: 'palette-drawer-paper' }}
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
      <main className="App-content">
        {ambiances.map(ambiance => (
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
