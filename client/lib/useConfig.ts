import { useEffect, useState } from 'react';
import { PROTOCOL_VERSION, type ConfigResponse } from '../../shared/protocol';
import { useGameStore } from '../store/gameStore';
import { api } from './api';

export interface ConfigState {
  config: ConfigResponse | null;
  loading: boolean;
  failed: boolean;
  reload(): void;
}

export function useConfig(): ConfigState {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    api
      .config()
      .then((response) => {
        if (cancelled) return;
        if (response.protocolVersion !== PROTOCOL_VERSION) {
          useGameStore.getState().setProtocolMismatch();
        }
        setConfig(response);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { config, loading, failed, reload: () => setAttempt((value) => value + 1) };
}
