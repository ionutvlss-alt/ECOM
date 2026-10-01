import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Workspace, emptyWorkspace } from './types';

const STORAGE_KEY = 'campaign_hq_workspace_v1';
const workspaceRef = doc(db, 'campaign_hq', 'workspace');

function normalizeWorkspace(raw: any): Workspace {
  const base = emptyWorkspace();
  if (!raw || typeof raw !== 'object') return base;
  return {
    sites: Array.isArray(raw.sites) ? raw.sites : [],
    campaigns: Array.isArray(raw.campaigns) ? raw.campaigns : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    inbox: Array.isArray(raw.inbox) ? raw.inbox : [],
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

export function loadLocalWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyWorkspace();
    return normalizeWorkspace(JSON.parse(raw));
  } catch {
    return emptyWorkspace();
  }
}

export function saveLocalWorkspace(workspace: Workspace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {}
}

export async function saveCloudWorkspace(workspace: Workspace): Promise<boolean> {
  try {
    const payload = { ...workspace, updatedAt: new Date().toISOString() };
    saveLocalWorkspace(payload);
    await setDoc(workspaceRef, payload, { merge: false });
    return true;
  } catch (error) {
    console.error('Campaign HQ cloud save failed', error);
    return false;
  }
}

export function subscribeWorkspace(
  onData: (workspace: Workspace) => void,
  onStatus?: (online: boolean) => void
) {
  return onSnapshot(
    workspaceRef,
    (snap) => {
      onStatus?.(true);
      if (!snap.exists()) return;
      const cloud = normalizeWorkspace(snap.data());
      const local = loadLocalWorkspace();

      // Single-user conflict rule: keep the most recently updated full workspace.
      const cloudTime = Date.parse(cloud.updatedAt || '') || 0;
      const localTime = Date.parse(local.updatedAt || '') || 0;
      const winner = localTime > cloudTime ? local : cloud;

      saveLocalWorkspace(winner);
      onData(winner);

      if (localTime > cloudTime) {
        setDoc(workspaceRef, local, { merge: false }).catch(() => {});
      }
    },
    () => onStatus?.(false)
  );
}

export function exportWorkspace(workspace: Workspace) {
  const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `campaign-hq-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importWorkspace(file: File): Promise<Workspace> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const normalized = normalizeWorkspace(parsed);
  normalized.updatedAt = new Date().toISOString();
  saveLocalWorkspace(normalized);
  return normalized;
}
