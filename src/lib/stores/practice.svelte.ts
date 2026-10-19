import type { PlanItem, PracticeData, Session } from '../types';
import { validateData } from '../utils/backup';
export { validateData } from '../utils/backup';

const STORAGE_KEY = 'pocket.practice.v1';
const emptyData = (): PracticeData => ({ version: 1, sessions: [], plan: [], weeklyGoal: 60 });
let unreadableSavedData = false;

function load(): PracticeData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: unknown = JSON.parse(saved);
        if (validateData(data)) return data;
      } catch {
        /* Do not overwrite an unreadable history. */
      }
      unreadableSavedData = true;
    }
  } catch {
    /* Keep the saved value intact; the UI reports the issue below. */
  }
  return emptyData();
}

function initialWarning() {
  if (unreadableSavedData)
    return 'Existing history is unreadable and has been left untouched. New work stays in memory; export it before closing, or restore a valid backup.';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && !validateData(JSON.parse(saved))
      ? 'Saved data could not be read. Export a backup before saving new sessions.'
      : '';
  } catch {
    return 'Browser storage is unavailable or unreadable. Export your sessions before closing this page.';
  }
}

export const practice = $state({ data: load(), warning: initialWarning() });

function persist() {
  if (unreadableSavedData) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(practice.data));
    practice.warning = '';
  } catch {
    practice.warning = 'Could not save to this browser. Export a backup before closing the page.';
  }
}

export function addSession(session: Session) {
  practice.data.sessions.unshift(session);
  persist();
}
export function updateNotes(id: string, notes: string) {
  const session = practice.data.sessions.find((item) => item.id === id);
  if (session) {
    session.notes = notes;
    persist();
  }
}
export function removeSession(id: string) {
  practice.data.sessions = practice.data.sessions.filter((s) => s.id !== id);
  persist();
}
export function addPlan(item: PlanItem) {
  practice.data.plan.push(item);
  persist();
}
export function removePlan(id: string) {
  practice.data.plan = practice.data.plan.filter((p) => p.id !== id);
  persist();
}
export function setGoal(minutes: number) {
  practice.data.weeklyGoal = Math.min(1000, Math.max(10, minutes));
  persist();
}
export function importData(data: unknown) {
  if (!validateData(data))
    throw new Error('This file is not a valid Pocket backup. Your existing data is unchanged.');
  practice.data = data;
  unreadableSavedData = false; // Import is an explicitly confirmed replacement.
  persist();
}
export function exportData() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(practice.data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `pocket-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
