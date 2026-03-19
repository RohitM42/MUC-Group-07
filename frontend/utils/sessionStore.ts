import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionRecord } from './mockSessions';

const STORAGE_KEY = 'muc_sessions';

export async function loadRealSessions(): Promise<SessionRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[SessionStore] Failed to load sessions:', e);
    return [];
  }
}

export async function saveSession(session: SessionRecord): Promise<void> {
  try {
    const existing = await loadRealSessions();
    existing.unshift(session); // newest first
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('[SessionStore] Failed to save session:', e);
  }
}
