import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Inbox, Store, Megaphone, Columns3, Plus, Check,
  Circle, CalendarDays, Zap, TrendingUp, AlertTriangle, Search,
  MoreHorizontal, Trash2, Edit3, X, ChevronRight, Download, Upload,
  Cloud, CloudOff, CheckCircle2, Clock3, Target, WalletCards, BarChart3
} from 'lucide-react';
import {
  Campaign, CampaignStage, InboxItem, Platform, Priority, Site, Task, Workspace
} from './types';
import {
  exportWorkspace, importWorkspace, loadLocalWorkspace, saveCloudWorkspace,
  saveLocalWorkspace, subscribeWorkspace
} from './dataService';

type Tab = 'today' | 'inbox' | 'sites' | 'campaigns' | 'board' | 'settings';

const stages: { id: CampaignStage; label: string }[] = [
  { id: 'idea', label: 'Idei' },
  { id: 'prep', label: 'De pregătit' },
  { id: 'ready', label: 'Ready' },
  { id: 'testing', label: 'Testing' },
  { id: 'winner', label: 'Winner' },
  { id: 'scale', label: 'Scale' },
  { id: 'stopped', label: 'Stopped' },
];

const stageLabel = (stage: CampaignStage) => stages.find((s) => s.id === stage)?.label || stage;
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (value?: string) => {
  if (!value) return 'Fără termen';
  const d = new Date(value + 'T12:00:00');
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
};

function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => loadLocalWorkspace());
  const [tab, setTab] = useState<Tab>('today');
  const [online, setOnline] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaignQuery, setCampaignQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all');
  const [campaignModal, setCampaignModal] = useState<Campaign | 'new' | null>(null);
  const [siteModal, setSiteModal] = useState<Site | 'new' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeWorkspace(
      (next) => setWorkspace(next),
      setOnline
    );
    return unsub;
  }, []);

  const persist = async (next: Workspace) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setWorkspace(stamped);
    saveLocalWorkspace(stamped);
    setSaving(true);
    await saveCloudWorkspace(stamped);
    setSaving(false);
  };

  const sitesById = useMemo(() => {
    const map = new Map<string, Site>();
    workspace.sites.forEach((site) => map.set(site.id, site));
    return map;
  }, [workspace.sites]);

  const openTasks = workspace.tasks.filter((t) => !t.done);
  const todayTasks = openTasks
    .filter((t) => !t.dueDate || t.dueDate <= today())
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });

  const dueCampaigns = workspace.campaigns.filter((c) => c.nextAction && c.dueDate && c.dueDate <= today() && c.stage !== 'stopped');

  const activeCampaigns = workspace.campaigns.filter((c) => !['stopped', 'idea'].includes(c.stage));
  const testing = workspace.campaigns.filter((c) => c.stage === 'testing');
  const winners = workspace.campaigns.filter((c) => ['winner', 'scale'].includes(c.stage));
  const totalSpend = workspace.campaigns.reduce((sum, c) => sum + Number(c.metrics.spend || 0), 0);
  const totalRevenue = workspace.campaigns.reduce((sum, c) => sum + Number(c.metrics.revenue || 0), 0);
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const filteredCampaigns = useMemo(() => workspace.campaigns.filter((c) => {
    const q = campaignQuery.trim().toLowerCase();
    if (q && ![c.name, c.product, c.notes, c.nextAction].some((v) => (v || '').toLowerCase().includes(q))) return false;
    if (siteFilter !== 'all' && c.siteId !== siteFilter) return false;
    if (platformFilter !== 'all' && c.platform !== platformFilter) return false;
    return true;
  }), [workspace.campaigns, campaignQuery, siteFilter, platformFilter]);

  const addInbox = (text: string) => {
    const value = text.trim();
    if (!value) return;
    const item: InboxItem = { id: uid('inbox'), text: value, createdAt: new Date().toISOString() };
    persist({ ...workspace, inbox: [item, ...workspace.inbox] });
  };

  const convertInboxToTask = (item: InboxItem) => {
    const task: Task = {
      id: uid('task'), title: item.text, done: false, priority: 'medium',
      dueDate: today(), createdAt: new Date().toISOString()
    };
    persist({
      ...workspace,
      inbox: workspace.inbox.filter((i) => i.id !== item.id),
      tasks: [task, ...workspace.tasks],
    });
  };

  const toggleTask = (id: string) => {
    persist({ ...workspace, tasks: workspace.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) });
  };

  const deleteTask = (id: string) => persist({ ...workspace, tasks: workspace.tasks.filter((t) => t.id !== id) });

  const createQuickTask = (title: string, priority: Priority = 'medium') => {
    const clean = title.trim();
    if (!clean) return;
    const task: Task = { id: uid('task'), title: clean, done: false, priority, dueDate: today(), createdAt: new Date().toISOString() };
    persist({ ...workspace, tasks: [task, ...workspace.tasks] });
  };

  const saveSite = (site: Site) => {
    const exists = workspace.sites.some((s) => s.id === site.id);
    persist({ ...workspace, sites: exists ? workspace.sites.map((s) => s.id === site.id ? site : s) : [...workspace.sites, site] });
    setSiteModal(null);
  };

  const deleteSite = (siteId: string) => {
    if (!confirm('Ștergi magazinul? Campaniile lui vor rămâne, dar fără magazin asociat.')) return;
    persist({ ...workspace, sites: workspace.sites.filter((s) => s.id !== siteId) });
  };

  const saveCampaign = (campaign: Campaign) => {
    const exists = workspace.campaigns.some((c) => c.id === campaign.id);
    persist({
      ...workspace,
      campaigns: exists
        ? workspace.campaigns.map((c) => c.id === campaign.id ? { ...campaign, updatedAt: new Date().toISOString() } : c)
        : [{ ...campaign, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...workspace.campaigns]
    });
    setCampaignModal(null);
  };

  const deleteCampaign = (id: string) => {
    if (!confirm('Ștergi campania?')) return;
    persist({
      ...workspace,
      campaigns: workspace.campaigns.filter((c) => c.id !== id),
      tasks: workspace.tasks.filter((t) => t.campaignId !== id)
    });
  };

  const moveCampaign = (id: string, stage: CampaignStage) => {
    persist({
      ...workspace,
      campaigns: workspace.campaigns.map((c) => c.id === id ? { ...c, stage, updatedAt: new Date().toISOString() } : c)
    });
  };

  const nav = [
    { id: 'today' as Tab, label: 'Today', icon: LayoutDashboard, count: todayTasks.length + dueCampaigns.length },
    { id: 'inbox' as Tab, label: 'Inbox', icon: Inbox, count: workspace.inbox.length },
    { id: 'sites' as Tab, label: 'Magazine', icon: Store, count: workspace.sites.length },
    { id: 'campaigns' as Tab, label: 'Campanii', icon: Megaphone, count: activeCampaigns.length },
    { id: 'board' as Tab, label: 'Kanban', icon: Columns3, count: 0 },
    { id: 'settings' as Tab, label: 'Backup & setări', icon: MoreHorizontal, count: 0 },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Target size={18} /></div>
          <div><strong>Campaign HQ</strong><span>Command center</span></div>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
                <Icon size={17} />
                <span>{item.label}</span>
                {item.count > 0 && <b>{item.count}</b>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sync-card">
            {online ? <Cloud size={16} /> : <CloudOff size={16} />}
            <div><strong>{saving ? 'Se salvează…' : online ? 'Sincronizat' : 'Offline'}</strong><span>Firestore + backup local</span></div>
          </div>
        </div>
      </aside>

      <main className="main">
        {tab === 'today' && (
          <TodayView
            sites={workspace.sites}
            tasks={todayTasks}
            dueCampaigns={dueCampaigns}
            allCampaigns={workspace.campaigns}
            activeCampaigns={activeCampaigns.length}
            testing={testing.length}
            winners={winners.length}
            roas={roas}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            onQuickTask={createQuickTask}
            onEditCampaign={(c) => setCampaignModal(c)}
            onNewCampaign={() => setCampaignModal('new')}
          />
        )}

        {tab === 'inbox' && (
          <InboxView
            items={workspace.inbox}
            onAdd={addInbox}
            onConvert={convertInboxToTask}
            onDelete={(id) => persist({ ...workspace, inbox: workspace.inbox.filter((i) => i.id !== id) })}
          />
        )}

        {tab === 'sites' && (
          <SitesView
            sites={workspace.sites}
            campaigns={workspace.campaigns}
            onNew={() => setSiteModal('new')}
            onEdit={(site) => setSiteModal(site)}
            onDelete={deleteSite}
            onOpenCampaigns={(id) => { setSiteFilter(id); setTab('campaigns'); }}
          />
        )}

        {tab === 'campaigns' && (
          <CampaignsView
            campaigns={filteredCampaigns}
            sites={workspace.sites}
            query={campaignQuery}
            setQuery={setCampaignQuery}
            siteFilter={siteFilter}
            setSiteFilter={setSiteFilter}
            platformFilter={platformFilter}
            setPlatformFilter={setPlatformFilter}
            onNew={() => setCampaignModal('new')}
            onEdit={(c) => setCampaignModal(c)}
            onDelete={deleteCampaign}
          />
        )}

        {tab === 'board' && (
          <BoardView
            campaigns={workspace.campaigns}
            sitesById={sitesById}
            onMove={moveCampaign}
            onEdit={(c) => setCampaignModal(c)}
            onNew={() => setCampaignModal('new')}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            workspace={workspace}
            onExport={() => exportWorkspace(workspace)}
            onImport={async (file) => {
              const imported = await importWorkspace(file);
              await persist(imported);
            }}
            onReset={() => {
              if (!confirm('Golești complet Campaign HQ?')) return;
              persist({ sites: [], campaigns: [], tasks: [], inbox: [], updatedAt: new Date().toISOString() });
            }}
            fileInput={fileInput}
          />
        )}
      </main>

      {campaignModal && (
        <CampaignModal
          value={campaignModal === 'new' ? null : campaignModal}
          sites={workspace.sites}
          onClose={() => setCampaignModal(null)}
          onSave={saveCampaign}
        />
      )}

      {siteModal && (
        <SiteModal
          value={siteModal === 'new' ? null : siteModal}
          onClose={() => setSiteModal(null)}
          onSave={saveSite}
        />
      )}
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

function TodayView(props: {
  sites: Site[]; tasks: Task[]; dueCampaigns: Campaign[]; allCampaigns: Campaign[];
  activeCampaigns: number; testing: number; winners: number; roas: number;
  onToggleTask: (id: string) => void; onDeleteTask: (id: string) => void;
  onQuickTask: (title: string) => void; onEditCampaign: (c: Campaign) => void; onNewCampaign: () => void;
}) {
  const [taskText, setTaskText] = useState('');
  const siteMap = new Map(props.sites.map((s) => [s.id, s]));
  const attention = props.dueCampaigns;

  return (
    <>
      <PageHeader
        eyebrow="TODAY"
        title="Ce trebuie să miști azi"
        subtitle="O singură listă. Fără să ții totul în cap."
        action={<button className="primary" onClick={props.onNewCampaign}><Plus size={16}/> Campanie nouă</button>}
      />

      <section className="stats-grid">
        <StatCard icon={<Megaphone size={18}/>} label="Campanii active" value={props.activeCampaigns} />
        <StatCard icon={<Zap size={18}/>} label="În testing" value={props.testing} />
        <StatCard icon={<TrendingUp size={18}/>} label="Winner / Scale" value={props.winners} />
        <StatCard icon={<BarChart3 size={18}/>} label="ROAS total" value={props.roas > 0 ? props.roas.toFixed(2) + 'x' : '—'} />
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><div><span className="kicker">PRIORITĂȚI</span><h2>Lista de azi</h2></div><span className="soft-count">{props.tasks.length}</span></div>
          <form className="quick-add" onSubmit={(e) => { e.preventDefault(); props.onQuickTask(taskText); setTaskText(''); }}>
            <Plus size={16}/><input value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="Adaugă rapid ceva de făcut…" /><button>Adaugă</button>
          </form>
          <div className="list">
            {props.tasks.length === 0 && <Empty icon={<CheckCircle2/>} title="Ești la zi" text="Nu ai task-uri restante pentru astăzi." />}
            {props.tasks.map((task) => (
              <div className="task-row" key={task.id}>
                <button className="check-btn" onClick={() => props.onToggleTask(task.id)}><Circle size={20}/></button>
                <div className="task-main">
                  <strong>{task.title}</strong>
                  <div className="meta-row">
                    <PriorityDot priority={task.priority}/>
                    {task.siteId && <span>{siteMap.get(task.siteId)?.name || 'Magazin'}</span>}
                    {task.platform && <PlatformBadge platform={task.platform}/>}
                    {task.dueDate && <span><CalendarDays size={12}/> {fmtDate(task.dueDate)}</span>}
                  </div>
                </div>
                <button className="icon-btn danger-hover" onClick={() => props.onDeleteTask(task.id)}><Trash2 size={15}/></button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><span className="kicker">NECESITĂ ATENȚIE</span><h2>Următoarea acțiune</h2></div><span className="soft-count">{attention.length}</span></div>
          <div className="list">
            {attention.length === 0 && <Empty icon={<Clock3/>} title="Nimic urgent" text="Campaniile nu au acțiuni scadente astăzi." />}
            {attention.map((c) => (
              <button className="attention-row" key={c.id} onClick={() => props.onEditCampaign(c)}>
                <div className="attention-icon"><AlertTriangle size={16}/></div>
                <div>
                  <strong>{c.nextAction}</strong>
                  <span>{siteMap.get(c.siteId)?.name || 'Fără magazin'} · {c.product || c.name}</span>
                </div>
                <PlatformBadge platform={c.platform}/>
                <ChevronRight size={16}/>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><span className="kicker">OVERVIEW</span><h2>Pe magazine</h2></div></div>
        <div className="site-overview-grid">
          {props.sites.length === 0 && <Empty icon={<Store/>} title="Adaugă cele 4 magazine" text="După aceea Campaign HQ îți separă automat Meta și TikTok pentru fiecare." />}
          {props.sites.map((site) => {
            const list = props.allCampaigns.filter((c) => c.siteId === site.id);
            return (
              <div className="overview-card" key={site.id}>
                <div className="overview-title"><div className="site-avatar">{site.name.slice(0, 2).toUpperCase()}</div><strong>{site.name}</strong></div>
                <div className="platform-split">
                  <div><span>Meta</span><b>{list.filter((c) => c.platform === 'Meta' && c.stage !== 'stopped').length}</b></div>
                  <div><span>TikTok</span><b>{list.filter((c) => c.platform === 'TikTok' && c.stage !== 'stopped').length}</b></div>
                  <div><span>De făcut</span><b>{props.tasks.filter((t) => !t.done && t.siteId === site.id).length}</b></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function InboxView({ items, onAdd, onConvert, onDelete }: { items: InboxItem[]; onAdd: (v: string) => void; onConvert: (i: InboxItem) => void; onDelete: (id: string) => void }) {
  const [text, setText] = useState('');
  return (
    <>
      <PageHeader eyebrow="CAPTURE" title="Inbox" subtitle="Aruncă aici orice idee, task sau lucru de ținut minte. Organizezi mai târziu." />
      <section className="capture-box">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex: Testează produsul X cu hook-ul «Nu mai face asta…» pe TikTok" />
        <div><span>Nu trebuie să alegi acum magazinul sau platforma.</span><button className="primary" onClick={() => { onAdd(text); setText(''); }}><Plus size={16}/> Salvează în Inbox</button></div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">NEPROCESATE</span><h2>{items.length} idei / lucruri</h2></div></div>
        <div className="inbox-list">
          {items.length === 0 && <Empty icon={<Inbox/>} title="Inbox gol" text="Când îți vine ceva în minte, îl pui aici în câteva secunde." />}
          {items.map((item) => (
            <div className="inbox-row" key={item.id}>
              <div className="inbox-dot"/>
              <div className="inbox-text"><strong>{item.text}</strong><span>{new Date(item.createdAt).toLocaleString('ro-RO')}</span></div>
              <button className="secondary" onClick={() => onConvert(item)}>Transformă în task</button>
              <button className="icon-btn danger-hover" onClick={() => onDelete(item.id)}><Trash2 size={15}/></button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function SitesView({ sites, campaigns, onNew, onEdit, onDelete, onOpenCampaigns }: {
  sites: Site[]; campaigns: Campaign[]; onNew: () => void; onEdit: (s: Site) => void; onDelete: (id: string) => void; onOpenCampaigns: (id: string) => void;
}) {
  return (
    <>
      <PageHeader eyebrow="STRUCTURĂ" title="Magazinele tale" subtitle="Fiecare magazin are separat Meta și TikTok, fără să amesteci campaniile." action={<button className="primary" onClick={onNew}><Plus size={16}/> Adaugă magazin</button>} />
      <div className="sites-grid">
        {sites.length === 0 && <div className="panel span-all"><Empty icon={<Store/>} title="Începe cu magazinele" text="Adaugă cele 4 site-uri. Numele și linkurile se pot schimba oricând." action={<button className="primary" onClick={onNew}><Plus size={16}/> Primul magazin</button>} /></div>}
        {sites.map((site) => {
          const list = campaigns.filter((c) => c.siteId === site.id);
          const meta = list.filter((c) => c.platform === 'Meta' && c.stage !== 'stopped');
          const tt = list.filter((c) => c.platform === 'TikTok' && c.stage !== 'stopped');
          return (
            <article className="site-card" key={site.id}>
              <div className="site-card-head">
                <div className="site-avatar large">{site.name.slice(0, 2).toUpperCase()}</div>
                <div><h3>{site.name}</h3><span>{site.url || 'Fără URL setat'}</span></div>
                <div className="row-actions"><button className="icon-btn" onClick={() => onEdit(site)}><Edit3 size={15}/></button><button className="icon-btn danger-hover" onClick={() => onDelete(site.id)}><Trash2 size={15}/></button></div>
              </div>
              <div className="site-channel-grid">
                <div className="channel-card meta"><span>Meta</span><b>{meta.length}</b><small>campanii active</small></div>
                <div className="channel-card tiktok"><span>TikTok</span><b>{tt.length}</b><small>campanii active</small></div>
              </div>
              <button className="site-link" onClick={() => onOpenCampaigns(site.id)}>Vezi campaniile <ChevronRight size={15}/></button>
            </article>
          );
        })}
      </div>
    </>
  );
}

function CampaignsView(props: {
  campaigns: Campaign[]; sites: Site[]; query: string; setQuery: (v: string) => void;
  siteFilter: string; setSiteFilter: (v: string) => void; platformFilter: 'all' | Platform; setPlatformFilter: (v: 'all' | Platform) => void;
  onNew: () => void; onEdit: (c: Campaign) => void; onDelete: (id: string) => void;
}) {
  const siteMap = new Map(props.sites.map((s) => [s.id, s]));
  return (
    <>
      <PageHeader eyebrow="CONTROL" title="Toate campaniile" subtitle="Un singur loc pentru cele 4 magazine, Meta și TikTok." action={<button className="primary" onClick={props.onNew}><Plus size={16}/> Campanie nouă</button>} />
      <div className="filter-bar">
        <div className="search"><Search size={16}/><input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Caută produs, campanie, idee…" /></div>
        <select value={props.siteFilter} onChange={(e) => props.setSiteFilter(e.target.value)}><option value="all">Toate magazinele</option>{props.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select value={props.platformFilter} onChange={(e) => props.setPlatformFilter(e.target.value as any)}><option value="all">Meta + TikTok</option><option value="Meta">Meta</option><option value="TikTok">TikTok</option></select>
      </div>
      <section className="panel table-panel">
        <div className="campaign-table">
          <div className="campaign-row head"><span>Campanie / produs</span><span>Magazin</span><span>Platformă</span><span>Status</span><span>Buget</span><span>Următorul pas</span><span></span></div>
          {props.campaigns.length === 0 && <Empty icon={<Megaphone/>} title="Nicio campanie" text="Adaugă prima campanie sau schimbă filtrele." />}
          {props.campaigns.map((c) => (
            <div className="campaign-row" key={c.id} onClick={() => props.onEdit(c)}>
              <div className="campaign-name"><strong>{c.name || c.product}</strong><span>{c.product}</span></div>
              <span>{siteMap.get(c.siteId)?.name || '—'}</span>
              <PlatformBadge platform={c.platform}/>
              <StageBadge stage={c.stage}/>
              <span className="money">{c.budget ? c.budget.toLocaleString('ro-RO') + ' lei' : '—'}</span>
              <div className="next-action"><strong>{c.nextAction || '—'}</strong>{c.dueDate && <span>{fmtDate(c.dueDate)}</span>}</div>
              <button className="icon-btn danger-hover" onClick={(e) => { e.stopPropagation(); props.onDelete(c.id); }}><Trash2 size={15}/></button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function BoardView({ campaigns, sitesById, onMove, onEdit, onNew }: { campaigns: Campaign[]; sitesById: Map<string, Site>; onMove: (id: string, stage: CampaignStage) => void; onEdit: (c: Campaign) => void; onNew: () => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="FLOW" title="Kanban campanii" subtitle="Vezi imediat unde este fiecare produs și ce trebuie mutat mai departe." action={<button className="primary" onClick={onNew}><Plus size={16}/> Adaugă</button>} />
      <div className="board">
        {stages.map((stage) => {
          const list = campaigns.filter((c) => c.stage === stage.id);
          return (
            <section
              className="board-column"
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) onMove(dragId, stage.id); setDragId(null); }}
            >
              <div className="board-head"><strong>{stage.label}</strong><span>{list.length}</span></div>
              <div className="board-cards">
                {list.map((c) => (
                  <article className="board-card" draggable key={c.id} onDragStart={() => setDragId(c.id)} onClick={() => onEdit(c)}>
                    <div className="board-card-top"><PlatformBadge platform={c.platform}/><span>{sitesById.get(c.siteId)?.name || '—'}</span></div>
                    <h3>{c.product || c.name}</h3>
                    <p>{c.nextAction || c.notes || 'Fără următoarea acțiune setată.'}</p>
                    {c.dueDate && <div className="board-date"><CalendarDays size={13}/>{fmtDate(c.dueDate)}</div>}
                  </article>
                ))}
                {list.length === 0 && <div className="board-empty">Trage aici</div>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function SettingsView({ workspace, onExport, onImport, onReset, fileInput }: {
  workspace: Workspace; onExport: () => void; onImport: (f: File) => void; onReset: () => void; fileInput: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <PageHeader eyebrow="SIGURANȚĂ" title="Backup & setări" subtitle="Datele sunt sincronizate în Firestore și păstrate și local." />
      <div className="settings-grid">
        <section className="panel">
          <div className="settings-icon"><Download/></div><h2>Backup complet</h2><p>Descarcă magazinele, campaniile, task-urile și Inbox-ul într-un singur JSON.</p>
          <button className="secondary wide" onClick={onExport}>Descarcă backup</button>
        </section>
        <section className="panel">
          <div className="settings-icon"><Upload/></div><h2>Import backup</h2><p>Restaurează un backup Campaign HQ. Înlocuiește workspace-ul curent.</p>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); }} />
          <button className="secondary wide" onClick={() => fileInput.current?.click()}>Alege fișier</button>
        </section>
        <section className="panel danger-panel">
          <div className="settings-icon"><Trash2/></div><h2>Reset complet</h2><p>Șterge tot workspace-ul. Folosește doar după ce ai un backup.</p>
          <button className="danger wide" onClick={onReset}>Golește Campaign HQ</button>
        </section>
        <section className="panel">
          <div className="settings-icon"><Cloud/></div><h2>Stare workspace</h2>
          <div className="settings-stats"><span><b>{workspace.sites.length}</b> magazine</span><span><b>{workspace.campaigns.length}</b> campanii</span><span><b>{workspace.tasks.length}</b> task-uri</span><span><b>{workspace.inbox.length}</b> inbox</span></div>
        </section>
      </div>
    </>
  );
}

function CampaignModal({ value, sites, onClose, onSave }: { value: Campaign | null; sites: Site[]; onClose: () => void; onSave: (c: Campaign) => void }) {
  const [form, setForm] = useState<Campaign>(() => value || ({
    id: uid('camp'), siteId: sites[0]?.id || '', platform: 'Meta', product: '', name: '', stage: 'idea',
    objective: 'Purchase', budget: 0, notes: '', nextAction: '', dueDate: today(), creatives: [],
    metrics: { spend: 0, revenue: 0, orders: 0 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }));
  const [creativeUrl, setCreativeUrl] = useState('');
  const set = (key: keyof Campaign, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const roas = form.metrics.spend > 0 ? form.metrics.revenue / form.metrics.spend : 0;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal large-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><div><span className="kicker">{value ? 'EDITARE' : 'NOU'}</span><h2>{value ? 'Editează campania' : 'Campanie nouă'}</h2></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
        <div className="form-grid">
          <label className="span-2">Nume campanie<input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: TEST 01 – Hook Problem/Solution"/></label>
          <label>Produs<input value={form.product} onChange={(e) => set('product', e.target.value)} placeholder="Produsul testat"/></label>
          <label>Magazin<select value={form.siteId} onChange={(e) => set('siteId', e.target.value)}><option value="">Alege magazin</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Platformă<select value={form.platform} onChange={(e) => set('platform', e.target.value as Platform)}><option>Meta</option><option>TikTok</option></select></label>
          <label>Status<select value={form.stage} onChange={(e) => set('stage', e.target.value as CampaignStage)}>{stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label>Obiectiv<input value={form.objective} onChange={(e) => set('objective', e.target.value)} /></label>
          <label>Buget / zi<input type="number" value={form.budget} onChange={(e) => set('budget', Number(e.target.value))}/></label>
          <label className="span-2 emphasis-label">Următoarea acțiune<input value={form.nextAction} onChange={(e) => set('nextAction', e.target.value)} placeholder="Ex: Verifică CPA mâine la 11:00"/></label>
          <label>Termen<input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)}/></label>
          <label>Spend<input type="number" value={form.metrics.spend} onChange={(e) => setForm((f) => ({ ...f, metrics: { ...f.metrics, spend: Number(e.target.value) }}))}/></label>
          <label>Revenue<input type="number" value={form.metrics.revenue} onChange={(e) => setForm((f) => ({ ...f, metrics: { ...f.metrics, revenue: Number(e.target.value) }}))}/></label>
          <label>Comenzi<input type="number" value={form.metrics.orders} onChange={(e) => setForm((f) => ({ ...f, metrics: { ...f.metrics, orders: Number(e.target.value) }}))}/></label>
          <div className="metric-preview"><span>ROAS</span><b>{roas ? roas.toFixed(2) + 'x' : '—'}</b></div>
          <label className="span-2">Note<textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Idei, observații, ce ai testat…"/></label>
          <div className="span-2 creative-box">
            <div className="creative-head"><div><strong>Creative / link-uri reclame</strong><span>TikTok, Instagram, Ads Library, Drive etc.</span></div></div>
            <div className="creative-add"><input value={creativeUrl} onChange={(e) => setCreativeUrl(e.target.value)} placeholder="Lipește linkul aici…" /><button type="button" className="secondary" onClick={() => {
              const url = creativeUrl.trim(); if (!url) return;
              setForm((f) => ({ ...f, creatives: [...f.creatives, { id: uid('creative'), label: `Creative ${f.creatives.length + 1}`, url }] }));
              setCreativeUrl('');
            }}><Plus size={15}/> Adaugă</button></div>
            {form.creatives.map((c) => <div className="creative-row" key={c.id}><span>{c.label}</span><a href={c.url} target="_blank" rel="noreferrer">{c.url}</a><button type="button" className="icon-btn" onClick={() => setForm((f) => ({ ...f, creatives: f.creatives.filter((x) => x.id !== c.id) }))}><X size={14}/></button></div>)}
          </div>
        </div>
        <div className="modal-foot"><button className="secondary" onClick={onClose}>Anulează</button><button className="primary" onClick={() => onSave(form)} disabled={!form.product.trim() || !form.siteId}><Check size={16}/> Salvează campania</button></div>
      </div>
    </div>
  );
}

function SiteModal({ value, onClose, onSave }: { value: Site | null; onClose: () => void; onSave: (s: Site) => void }) {
  const [name, setName] = useState(value?.name || '');
  const [url, setUrl] = useState(value?.url || '');
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><div><span className="kicker">{value ? 'EDITARE' : 'NOU'}</span><h2>{value ? 'Editează magazinul' : 'Adaugă magazin'}</h2></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
        <div className="form-stack"><label>Nume magazin<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Magazin 1"/></label><label>URL site<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."/></label></div>
        <div className="modal-foot"><button className="secondary" onClick={onClose}>Anulează</button><button className="primary" onClick={() => onSave({ id: value?.id || uid('site'), name: name.trim(), url: url.trim(), active: true, createdAt: value?.createdAt || new Date().toISOString() })} disabled={!name.trim()}><Check size={16}/> Salvează</button></div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><b>{value}</b></div></div>;
}
function PlatformBadge({ platform }: { platform: Platform }) { return <span className={`platform-badge ${platform === 'Meta' ? 'meta' : 'tiktok'}`}>{platform}</span>; }
function StageBadge({ stage }: { stage: CampaignStage }) { return <span className={`stage-badge stage-${stage}`}>{stageLabel(stage)}</span>; }
function PriorityDot({ priority }: { priority: Priority }) { return <span className={`priority-dot ${priority}`} title={priority}/>; }
function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty"><div className="empty-icon">{icon}</div><strong>{title}</strong><span>{text}</span>{action}</div>;
}

export default App;
