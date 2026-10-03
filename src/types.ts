export type Platform = 'Meta' | 'TikTok';
export type CampaignStage = 'idea' | 'prep' | 'ready' | 'testing' | 'winner' | 'scale' | 'stopped';
export type Priority = 'low' | 'medium' | 'high';
export type WorkStatus = 'todo' | 'doing' | 'done';

export interface EncryptedVaultEntry {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface SiteAdAccounts {
  Meta?: EncryptedVaultEntry;
  TikTok?: EncryptedVaultEntry;
}

export interface Site {
  id: string;
  name: string;
  url?: string;
  active: boolean;
  createdAt: string;
  adAccounts?: SiteAdAccounts;
}

export interface CreativeLink {
  id: string;
  label: string;
  url: string;
  hook?: string;
  notes?: string;
}

export interface CampaignMetrics {
  spend: number;
  revenue: number;
  orders: number;
}

export interface Campaign {
  id: string;
  siteId: string;
  platform: Platform;
  product: string;
  name: string;
  stage: CampaignStage;
  workStatus?: WorkStatus;
  objective: string;
  budget: number;
  notes: string;
  nextAction: string;
  dueDate: string;
  creatives: CreativeLink[];
  metrics: CampaignMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  siteId?: string;
  platform?: Platform;
  campaignId?: string;
  dueDate: string;
  createdAt: string;
}

export interface InboxItem {
  id: string;
  text: string;
  createdAt: string;
}

export interface Workspace {
  sites: Site[];
  campaigns: Campaign[];
  tasks: Task[];
  inbox: InboxItem[];
  updatedAt: string;
}

export const emptyWorkspace = (): Workspace => ({
  sites: [],
  campaigns: [],
  tasks: [],
  inbox: [],
  updatedAt: new Date().toISOString(),
});
