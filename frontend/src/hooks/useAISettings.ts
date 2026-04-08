import { useState, useCallback } from 'react';

export interface AISettings {
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'privamed-ai-settings';

const DEFAULT_SETTINGS: AISettings = {
  apiKey: '',
  model: 'minimax/minimax-m2.5:free',
};

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load AI settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [showSettings, setShowSettings] = useState(false);

  const updateSettings = useCallback((newSettings: Partial<AISettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const hasApiKey = settings.apiKey.trim().length > 0;

  return {
    settings,
    updateSettings,
    clearSettings,
    showSettings,
    setShowSettings,
    hasApiKey,
  };
}