import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain, Check, ChevronRight, CirclePause, Download, Edit3, Lightbulb,
  ListTodo, Play, Plus, Settings, Store, Trash2, Upload, X, Zap
} from 'lucide-react';
import { Campaign, Platform, Site, Workspace, WorkStatus } from './types';
import {
  exportWorkspace, importWorkspace, loadLocalWorkspace, saveCloudWorkspace,
  saveLocalWorkspace, subscribeWorkspace
} from './dataService';

type Tab = 'work' | 'ideas' | 'done' | 'settings';
const uid = (p:string)=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const now = ()=>new Date().toISOString();

function App(){
  const [workspace,setWorkspace]=useState<Workspace>(()=>loadLocalWorkspace());
  const [tab,setTab]=useState<Tab>('work');
  const [activeId,setActiveId]=useState<string>(()=>localStorage.getItem('campaign_hq_active_v2')||'');
  const [itemModal,setItemModal]=useState<Campaign|'new'|null>(null);
  const [newContext,setNewContext]=useState<{siteId?:string;platform?:Platform;idea?:boolean}>({});
  const [siteModal,setSiteModal]=useState<Site|'new'|null>(null);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>subscribeWorkspace(setWorkspace),[]);
  const persist=async(next:Workspace)=>{
    const stamped={...next,updatedAt:now()};
    setWorkspace(stamped); saveLocalWorkspace(stamped); await saveCloudWorkspace(stamped);
  };

  const siteMap=useMemo(()=>new Map(workspace.sites.map(s=>[s.id,s])),[workspace.sites]);

  const normalizeStatus=(c:Campaign):WorkStatus=>{
    if(c.workStatus) return c.workStatus;
    if(c.stage==='stopped') return 'done';
    if(c.stage==='testing') return 'doing';
    return 'todo';
  };

  const campaigns=workspace.campaigns.map(c=>({...c,workStatus:normalizeStatus(c)}));
  const active=campaigns.find(c=>c.id===activeId && c.workStatus==='doing');

  const setWorkStatus=(id:string,status:WorkStatus)=>{
    if(status==='doing'){
      localStorage.setItem('campaign_hq_active_v2',id); setActiveId(id);
    } else if(activeId===id){
      localStorage.removeItem('campaign_hq_active_v2'); setActiveId('');
    }
    persist({...workspace,campaigns:workspace.campaigns.map(c=>c.id===id?{...c,workStatus:status,updatedAt:now()}:c)});
  };

  const saveCampaign=(c:Campaign)=>{
    const exists=workspace.campaigns.some(x=>x.id===c.id);
    persist({...workspace,campaigns:exists
      ?workspace.campaigns.map(x=>x.id===c.id?{...c,updatedAt:now()}:x)
      :[{...c,createdAt:now(),updatedAt:now()},...workspace.campaigns]});
    setItemModal(null); setNewContext({});
  };

  const deleteCampaign=(id:string)=>{
    if(!confirm('Ștergi acest element?'))return;
    if(activeId===id){localStorage.removeItem('campaign_hq_active_v2');setActiveId('');}
    persist({...workspace,campaigns:workspace.campaigns.filter(c=>c.id!==id)});
  };

  const saveSite=(site:Site)=>{
    const exists=workspace.sites.some(s=>s.id===site.id);
    persist({...workspace,sites:exists?workspace.sites.map(s=>s.id===site.id?site:s):[...workspace.sites,site]});
    setSiteModal(null);
  };

  const openNew=(siteId?:string,platform?:Platform,idea=false)=>{
    setNewContext({siteId,platform,idea}); setItemModal('new');
  };

  const todoCount=campaigns.filter(c=>c.workStatus!=='done' && c.stage!=='idea').length;
  const ideasCount=campaigns.filter(c=>c.stage==='idea' && c.workStatus!=='done').length;

  return <div className="hq-shell">
    <aside className="hq-sidebar">
      <div className="hq-brand"><div className="hq-logo"><Zap size={18}/></div><div><b>Campaign HQ</b><span>Ce fac mai departe?</span></div></div>
      <nav>
        <Nav active={tab==='work'} icon={<ListTodo size={18}/>} label="De făcut" count={todoCount} onClick={()=>setTab('work')}/>
        <Nav active={tab==='ideas'} icon={<Lightbulb size={18}/>} label="Idei" count={ideasCount} onClick={()=>setTab('ideas')}/>
        <Nav active={tab==='done'} icon={<Check size={18}/>} label="Gata" onClick={()=>setTab('done')}/>
        <Nav active={tab==='settings'} icon={<Settings size={18}/>} label="Setări" onClick={()=>setTab('settings')}/>
      </nav>
      <div className="hq-tip">Regula platformei:<br/><b>un singur lucru „În lucru”</b> la un moment dat.</div>
    </aside>

    <main className="hq-main">
      {tab==='work' && <WorkView
        sites={workspace.sites} campaigns={campaigns} active={active}
        siteMap={siteMap} onNew={openNew} onEdit={c=>setItemModal(c)}
        onStatus={setWorkStatus} onDelete={deleteCampaign}
      />}
      {tab==='ideas' && <IdeasView
        sites={workspace.sites} campaigns={campaigns.filter(c=>c.stage==='idea'&&c.workStatus!=='done')}
        onNew={(s,p)=>openNew(s,p,true)} onEdit={c=>setItemModal(c)}
        onPromote={id=>persist({...workspace,campaigns:workspace.campaigns.map(c=>c.id===id?{...c,stage:'prep',workStatus:'todo',updatedAt:now()}:c)})}
        onDelete={deleteCampaign}
      />}
      {tab==='done' && <DoneView campaigns={campaigns.filter(c=>c.workStatus==='done')} siteMap={siteMap} onRestore={id=>setWorkStatus(id,'todo')}/>}
      {tab==='settings' && <SettingsView
        workspace={workspace} fileRef={fileRef}
        onNewSite={()=>setSiteModal('new')} onEditSite={s=>setSiteModal(s)}
        onDeleteSite={id=>persist({...workspace,sites:workspace.sites.filter(s=>s.id!==id)})}
        onExport={()=>exportWorkspace(workspace)}
        onImport={async file=>persist(await importWorkspace(file))}
      />}
    </main>

    {itemModal && <CampaignModal
      value={itemModal==='new'?null:itemModal}
      sites={workspace.sites}
      preset={newContext}
      onClose={()=>{setItemModal(null);setNewContext({});}}
      onSave={saveCampaign}
    />}
    {siteModal && <SiteModal value={siteModal==='new'?null:siteModal} onClose={()=>setSiteModal(null)} onSave={saveSite}/>}
  </div>;
}

function Nav({active,icon,label,count,onClick}:{active:boolean;icon:React.ReactNode;label:string;count?:number;onClick:()=>void}){
  return <button className={'hq-nav '+(active?'active':'')} onClick={onClick}>{icon}<span>{label}</span>{!!count&&<b>{count}</b>}</button>
}

function WorkView({sites,campaigns,active,siteMap,onNew,onEdit,onStatus,onDelete}:{
  sites:Site[];campaigns:Campaign[];active?:Campaign;siteMap:Map<string,Site>;
  onNew:(s?:string,p?:Platform,idea?:boolean)=>void;onEdit:(c:Campaign)=>void;
  onStatus:(id:string,s:WorkStatus)=>void;onDelete:(id:string)=>void;
}){
  const work=campaigns.filter(c=>c.stage!=='idea'&&c.workStatus!=='done');
  return <>
    <header className="hero-head">
      <div><span>PLANUL TĂU DE LUCRU</span><h1>Ce ai de făcut acum</h1><p>Vezi fiecare site separat. Intri pe o campanie, o termini sau o pui pe pauză și treci la următoarea.</p></div>
      <button className="btn primary" onClick={()=>onNew()}><Plus size={16}/> Adaugă campanie</button>
    </header>

    <section className={'focus-box '+(active?'has-focus':'')}>
      {active ? <>
        <div className="focus-badge">LUCREZI ACUM</div>
        <div className="focus-main">
          <div><small>{siteMap.get(active.siteId)?.name||'Fără site'} · {active.platform}</small><h2>{active.product}</h2><p>{active.name||active.nextAction||'Campanie în lucru'}</p></div>
          <div className="focus-actions">
            <button className="btn soft" onClick={()=>onEdit(active)}><Edit3 size={15}/> Deschide</button>
            <button className="btn soft" onClick={()=>onStatus(active.id,'todo')}><CirclePause size={15}/> Pauză</button>
            <button className="btn success" onClick={()=>onStatus(active.id,'done')}><Check size={15}/> Gata</button>
          </div>
        </div>
      </> : <div className="no-focus"><Play size={20}/><div><b>Nu lucrezi la nicio campanie acum.</b><span>Alege „Începe” la una de mai jos și platforma îți păstrează contextul.</span></div></div>}
    </section>

    {sites.length===0 && <EmptyState title="Adaugă mai întâi magazinele" text="Intră la Setări și adaugă Fotbal, Husero și celelalte site-uri."/ >}

    <div className="site-work-list">
      {sites.map(site=>{
        const list=work.filter(c=>c.siteId===site.id);
        return <section className="site-work" key={site.id}>
          <div className="site-work-head">
            <div className="site-letter">{site.name.slice(0,2).toUpperCase()}</div>
            <div><h2>{site.name}</h2><span>{list.length} campanii de făcut / în lucru</span></div>
          </div>
          <div className="platform-columns">
            {(['TikTok','Meta'] as Platform[]).map(platform=>{
              const lane=list.filter(c=>c.platform===platform);
              return <div className="platform-lane" key={platform}>
                <div className="lane-head"><div><b>{platform}</b><span>{lane.length} de făcut</span></div><button onClick={()=>onNew(site.id,platform)}><Plus size={14}/> Campanie</button></div>
                <div className="lane-list">
                  {lane.length===0&&<div className="lane-empty">Nimic de făcut aici momentan.</div>}
                  {lane.map(c=><WorkCard key={c.id} campaign={c} onEdit={()=>onEdit(c)} onStart={()=>onStatus(c.id,'doing')} onPause={()=>onStatus(c.id,'todo')} onDone={()=>onStatus(c.id,'done')} onDelete={()=>onDelete(c.id)}/>)}
                </div>
              </div>
            })}
          </div>
        </section>
      })}
    </div>
  </>;
}

function WorkCard({campaign,onEdit,onStart,onPause,onDone,onDelete}:{campaign:Campaign;onEdit:()=>void;onStart:()=>void;onPause:()=>void;onDone:()=>void;onDelete:()=>void}){
  const doing=campaign.workStatus==='doing';
  return <article className={'work-card '+(doing?'doing':'')}>
    <div className="work-card-top"><span className={doing?'status doing':'status todo'}>{doing?'ÎN LUCRU':'DE FĂCUT'}</span><div><button onClick={onEdit}><Edit3 size={14}/></button><button onClick={onDelete}><Trash2 size={14}/></button></div></div>
    <h3>{campaign.product||'Fără produs'}</h3>
    <p>{campaign.name||campaign.nextAction||campaign.notes||'Fără descriere'}</p>
    {campaign.notes&&<div className="idea-note"><Brain size={13}/>{campaign.notes}</div>}
    <div className="card-actions">
      {doing?<button className="btn soft" onClick={onPause}><CirclePause size={14}/> Pauză</button>:<button className="btn primary" onClick={onStart}><Play size={14}/> Începe</button>}
      <button className="btn success ghost" onClick={onDone}><Check size={14}/> Gata</button>
    </div>
  </article>;
}

function IdeasView({sites,campaigns,onNew,onEdit,onPromote,onDelete}:{
  sites:Site[];campaigns:Campaign[];onNew:(s?:string,p?:Platform)=>void;onEdit:(c:Campaign)=>void;onPromote:(id:string)=>void;onDelete:(id:string)=>void
}){
  return <>
    <header className="hero-head"><div><span>BRAIN DUMP ORGANIZAT</span><h1>Ideile tale</h1><p>Nu mai ții ideile în cap. Le pui direct sub site-ul și platforma la care se referă.</p></div></header>
    <div className="site-work-list">
      {sites.map(site=><section className="site-work" key={site.id}>
        <div className="site-work-head"><div className="site-letter">{site.name.slice(0,2).toUpperCase()}</div><div><h2>{site.name}</h2><span>Idei salvate pentru mai târziu</span></div></div>
        <div className="platform-columns">
          {(['TikTok','Meta'] as Platform[]).map(platform=>{
            const lane=campaigns.filter(c=>c.siteId===site.id&&c.platform===platform);
            return <div className="platform-lane" key={platform}>
              <div className="lane-head"><div><b>{platform}</b><span>{lane.length} idei</span></div><button onClick={()=>onNew(site.id,platform)}><Plus size={14}/> Idee</button></div>
              <div className="lane-list">
                {lane.length===0&&<div className="lane-empty">Nicio idee salvată.</div>}
                {lane.map(c=><article className="idea-card" key={c.id}>
                  <div><small>{c.product||'Fără produs'}</small><h3>{c.name||c.notes||'Idee nouă'}</h3>{c.notes&&c.name&&<p>{c.notes}</p>}</div>
                  <div className="idea-actions"><button className="btn primary" onClick={()=>onPromote(c.id)}>Transformă în campanie <ChevronRight size={14}/></button><button onClick={()=>onEdit(c)}><Edit3 size={14}/></button><button onClick={()=>onDelete(c.id)}><Trash2 size={14}/></button></div>
                </article>)}
              </div>
            </div>
          })}
        </div>
      </section>)}
    </div>
  </>;
}

function DoneView({campaigns,siteMap,onRestore}:{campaigns:Campaign[];siteMap:Map<string,Site>;onRestore:(id:string)=>void}){
  return <>
    <header className="hero-head"><div><span>ARHIVĂ</span><h1>Ce ai terminat</h1><p>Tot ce ai bifat „Gata” rămâne aici și poate fi readus în listă.</p></div></header>
    <section className="simple-list">
      {campaigns.length===0&&<EmptyState title="Nimic terminat încă" text="Când bifezi o campanie ca gata, o vei găsi aici."/>}
      {campaigns.map(c=><div className="done-row" key={c.id}><Check size={16}/><div><b>{c.product}</b><span>{siteMap.get(c.siteId)?.name||'Fără site'} · {c.platform} · {c.name}</span></div><button className="btn soft" onClick={()=>onRestore(c.id)}>Pune înapoi</button></div>)}
    </section>
  </>;
}

function SettingsView({workspace,fileRef,onNewSite,onEditSite,onDeleteSite,onExport,onImport}:{
  workspace:Workspace;fileRef:React.RefObject<HTMLInputElement|null>;onNewSite:()=>void;onEditSite:(s:Site)=>void;onDeleteSite:(id:string)=>void;onExport:()=>void;onImport:(f:File)=>void
}){
  return <>
    <header className="hero-head"><div><span>CONFIGURARE</span><h1>Magazine & backup</h1><p>Aici setezi o singură dată cele 4 site-uri.</p></div><button className="btn primary" onClick={onNewSite}><Plus size={16}/> Adaugă site</button></header>
    <section className="settings-sites">
      {workspace.sites.map(s=><div className="settings-site" key={s.id}><div className="site-letter">{s.name.slice(0,2).toUpperCase()}</div><div><b>{s.name}</b><span>{s.url||'Fără URL'}</span></div><button onClick={()=>onEditSite(s)}><Edit3 size={15}/></button><button onClick={()=>onDeleteSite(s.id)}><Trash2 size={15}/></button></div>)}
    </section>
    <div className="backup-grid">
      <button className="backup-card" onClick={onExport}><Download/><b>Descarcă backup</b><span>Salvează toate datele într-un JSON.</span></button>
      <button className="backup-card" onClick={()=>fileRef.current?.click()}><Upload/><b>Importă backup</b><span>Restaurează un workspace existent.</span></button>
      <input hidden ref={fileRef} type="file" accept=".json" onChange={e=>{const f=e.target.files?.[0];if(f)onImport(f)}}/>
    </div>
  </>;
}

function CampaignModal({value,sites,preset,onClose,onSave}:{value:Campaign|null;sites:Site[];preset:{siteId?:string;platform?:Platform;idea?:boolean};onClose:()=>void;onSave:(c:Campaign)=>void}){
  const [form,setForm]=useState<Campaign>(()=>value||{
    id:uid('camp'),siteId:preset.siteId||sites[0]?.id||'',platform:preset.platform||'TikTok',
    product:'',name:'',stage:preset.idea?'idea':'prep',workStatus:'todo',objective:'',budget:0,
    notes:'',nextAction:'',dueDate:'',creatives:[],metrics:{spend:0,revenue:0,orders:0},createdAt:now(),updatedAt:now()
  });
  const idea=form.stage==='idea';
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal practical-modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><small>{idea?'IDEE':'CAMPANIE'}</small><h2>{idea?'Salvează ideea':'Ce ai de făcut?'}</h2></div><button onClick={onClose}><X size={18}/></button></div>
    <div className="practical-form">
      <label>Site<select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}><option value="">Alege site</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Platformă<div className="segmented">{(['TikTok','Meta'] as Platform[]).map(p=><button type="button" className={form.platform===p?'active':''} onClick={()=>setForm({...form,platform:p})} key={p}>{p}</button>)}</div></label>
      <label>Produs / categorie<input autoFocus value={form.product} onChange={e=>setForm({...form,product:e.target.value})} placeholder="Ex: Tricou fotbal, Aparat masaj..."/></label>
      <label>{idea?'Ideea':'Campania / ce trebuie făcut'}<textarea value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder={idea?'Ex: UGC cu unghiul „cadoul perfect pentru fan...”':'Ex: Campanie TikTok - 3 creative UGC pentru produsul X'}/></label>
      <label>Notițe / idei suplimentare<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Hook-uri, reclame de copiat, idei de ofertă, ce să nu uiți..."/></label>
      {!idea&&<label>Următorul pas<input value={form.nextAction} onChange={e=>setForm({...form,nextAction:e.target.value})} placeholder="Ex: filmează creativele, setează ad set-ul..."/></label>}
      <label className="checkbox-line"><input type="checkbox" checked={idea} onChange={e=>setForm({...form,stage:e.target.checked?'idea':'prep'})}/> Este doar o idee pentru mai târziu</label>
    </div>
    <div className="modal-foot"><button className="btn soft" onClick={onClose}>Anulează</button><button className="btn primary" disabled={!form.siteId||!form.product.trim()||!form.name.trim()} onClick={()=>onSave(form)}><Check size={15}/> Salvează</button></div>
  </div></div>;
}

function SiteModal({value,onClose,onSave}:{value:Site|null;onClose:()=>void;onSave:(s:Site)=>void}){
  const [name,setName]=useState(value?.name||'');const [url,setUrl]=useState(value?.url||'');
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><small>SITE</small><h2>{value?'Editează site':'Adaugă site'}</h2></div><button onClick={onClose}><X size={18}/></button></div>
    <div className="practical-form"><label>Nume<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Husero"/></label><label>URL<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label></div>
    <div className="modal-foot"><button className="btn soft" onClick={onClose}>Anulează</button><button className="btn primary" disabled={!name.trim()} onClick={()=>onSave({id:value?.id||uid('site'),name:name.trim(),url:url.trim(),active:true,createdAt:value?.createdAt||now()})}>Salvează</button></div>
  </div></div>
}

function EmptyState({title,text}:{title:string;text:string}){return <div className="empty-state"><Store size={24}/><b>{title}</b><span>{text}</span></div>}
export default App;