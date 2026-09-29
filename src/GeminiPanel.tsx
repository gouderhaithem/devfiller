import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import { PROVIDERS, PROVIDER_SPECS, MIN_CACHE_MINUTES, MAX_CACHE_MINUTES, defaultGemini, validCacheMinutes, type GeminiConfig, type Provider } from './gemini';
import { isExtension } from './storage';

interface CacheStatus { batches:number; suggestions:number; expiresAt:number|null; lastMessage:string }
const emptyStatus:CacheStatus={batches:0,suggestions:0,expiresAt:null,lastMessage:''};
interface Reply { ok:boolean; error?:string; config?:GeminiConfig; status?:CacheStatus; models?:string[] }
async function send(message:object):Promise<Reply> {
  const reply:Reply=await chrome.runtime.sendMessage(message);
  if(!reply?.ok) throw new Error(reply?.error || 'The extension did not respond. Reload Formly and try again.');
  return reply;
}

export function GeminiPanel() {
  const [config,setConfig]=useState<GeminiConfig>(defaultGemini);
  const [cache,setCache]=useState<CacheStatus>(emptyStatus);
  const [models,setModels]=useState<string[]>([...PROVIDER_SPECS[defaultGemini.provider].models]);
  const [visible,setVisible]=useState(false);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [now,setNow]=useState(Date.now());
  const [cacheMinutes,setCacheMinutes]=useState(String(defaultGemini.cacheMinutes));
  const installed=isExtension();
  useEffect(()=>{
    let active=true;
    if(!installed){setReady(true);return;}
    send({type:'gemini:get'}).then(reply=>{if(active){setConfig(reply.config!);setModels([...PROVIDER_SPECS[reply.config!.provider].models]);setCacheMinutes(String(reply.config!.cacheMinutes));setCache(reply.status!);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setReady(true);});
    const timer=setInterval(()=>{setNow(Date.now());},1000);
    const refresh=setInterval(()=>{void send({type:'gemini:status'}).then(reply=>{if(active)setCache(reply.status!);}).catch(()=>{});},15000);
    return()=>{active=false;clearInterval(timer);clearInterval(refresh);};
  },[installed]);
  useEffect(()=>{
    if(ready && window.location.hash==='#cache') document.getElementById('cache')?.scrollIntoView();
  },[ready]);
  async function action(name:string,work:()=>Promise<void>) {
    setBusy(name);setError('');setMessage('');
    try{await work();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy('');}
  }
  function save() {
    void action('save',async()=>{
      if(config.enabled) {
        if(!config.apiKey.trim()) throw new Error('Enter your API key first.');
        // Only the background watcher needs standing site access. Clicking Fill uses activeTab.
        if(config.autoPrepare) {
          const granted=await chrome.permissions.request({origins:['http://*/*','https://*/*']});
          if(!granted) throw new Error('Website access is needed to prepare data as forms appear. Allow access, or turn off preparing ahead of the click.');
        }
      }
      const reply=await send({type:'gemini:save',config});setConfig(reply.config!);setCache(reply.status!);
      const provider=`${PROVIDER_SPECS[config.provider].label} (${config.model})`;
      setMessage(!config.enabled?'Saved. Local generation is active.':config.autoPrepare?`Saved. ${provider} prepares suggestions automatically as forms appear, including on open pages.`:`Saved. ${provider} runs when you click Fill.`);
    });
  }
  const disabled=!installed||!ready||!!busy;
  const seconds=Math.max(0,Math.ceil(((cache.expiresAt || now)-now)/1000));
  const durationValid=validCacheMinutes(Number(cacheMinutes));
  return <section className="gemini-panel" aria-label="Gemini settings">
    <div className="section-heading"><h2>Context for unfamiliar fields</h2><span className="gemini-tag">GEMINI</span></div>
    <p className="helper">Your chosen provider reads field labels and writes relevant words and phrases for fields the local generator does not recognize. Suggestions are requested when you click Fill, then reused from the cache until they expire. A quota or rate-limit error switches to local data.</p>
    {!installed&&<div className="gemini-info">Open Formly’s extension <strong>Options</strong> to connect your key. This webpage is a local UI preview.</div>}
    <label className="toggle-row"><span><strong>Use AI for unknown fields</strong><small>Requested when you click Fill, so nothing is generated for forms you never fill.</small></span><input type="checkbox" checked={config.enabled} disabled={disabled} onChange={e=>setConfig({...config,enabled:e.target.checked})}/></label>
    <label className="toggle-row"><span><strong>Prepare ahead of the click</strong><small>Generate as soon as a form appears, so Fill is instant. Uses your quota on every page with a form, including ones you never fill.</small></span><input type="checkbox" checked={config.autoPrepare} disabled={disabled||!config.enabled} onChange={e=>setConfig({...config,autoPrepare:e.target.checked})}/></label>
    <div className="gemini-field"><label htmlFor="gemini-provider">Provider</label><select id="gemini-provider" value={config.provider} disabled={disabled} onChange={e=>{const provider=e.target.value as Provider;setModels([...PROVIDER_SPECS[provider].models]);setConfig({...config,provider,model:PROVIDER_SPECS[provider].defaultModel});setMessage('');setError('');}}>{PROVIDERS.map(provider=><option key={provider} value={provider}>{PROVIDER_SPECS[provider].label}</option>)}</select><small>Each provider needs its own key and its own models. Paste the key for the provider you pick.</small></div>
    <div className="gemini-field"><label htmlFor="gemini-key"><KeyRound size={13}/> API key</label><div className="key-input"><input id="gemini-key" type={visible?'text':'password'} value={config.apiKey} autoComplete="off" spellCheck={false} disabled={disabled} placeholder="Paste your Gemini API key" onChange={e=>setConfig({...config,apiKey:e.target.value})}/><button className="icon" aria-label={visible?'Hide API key':'Show API key'} disabled={disabled} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><a href={PROVIDER_SPECS[config.provider].keyUrl} target="_blank" rel="noreferrer">{PROVIDER_SPECS[config.provider].keyHint} ↗</a></div>
    <div className="gemini-field"><label htmlFor="gemini-model">Model</label><select id="gemini-model" value={config.model} disabled={disabled} onChange={e=>setConfig({...config,model:e.target.value})}>{[...new Set([config.model,...models])].map(model=><option key={model}>{model}</option>)}</select><small>Test your key to confirm which of these it can reach. Requests use your provider quota.</small></div>
    <div className="gemini-buttons"><button className="secondary" disabled={disabled||!config.apiKey.trim()} onClick={()=>void action('test',async()=>{const reply=await send({type:'gemini:test',apiKey:config.apiKey,provider:config.provider});setModels(reply.models!);if(!reply.models!.includes(config.model))setConfig({...config,model:reply.models![0]});setMessage('Key accepted. Choose a model, then save.');})}><RefreshCw size={14}/>{busy==='test'?'Testing…':'Test key'}</button><button className="primary" disabled={disabled} onClick={save}><Check size={14}/>{busy==='save'?'Saving…':'Save settings'}</button></div>
    {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
    <section id="cache" className="cache-controls" aria-labelledby="cache-heading">
      <div className="section-heading"><h2 id="cache-heading">Suggestion cache</h2><span className="cache-duration">{config.cacheMinutes} min</span></div>
      <p className="helper">Keep a batch ready for your next click. Choose how long suggestions stay available.</p>
      <form onSubmit={event=>{event.preventDefault();if(!durationValid)return;void action('cache',async()=>{
        const reply=await send({type:'gemini:cache',cacheMinutes:Number(cacheMinutes)});
        setConfig(current=>({...current,cacheMinutes:reply.config!.cacheMinutes}));setCache(reply.status!);
        setMessage(`Cache expiry saved: ${reply.config!.cacheMinutes} ${reply.config!.cacheMinutes===1?'minute':'minutes'}. Previous suggestions cleared.`);
      });}}>
        <label htmlFor="cache-minutes">Cache expiry (minutes)</label>
        <div className="cache-input-row"><input id="cache-minutes" type="number" min={MIN_CACHE_MINUTES} max={MAX_CACHE_MINUTES} step="1" required value={cacheMinutes} disabled={disabled} aria-describedby="cache-hint" aria-invalid={!durationValid} onChange={event=>setCacheMinutes(event.target.value)}/><button type="submit" className="secondary" disabled={disabled||!durationValid||Number(cacheMinutes)===config.cacheMinutes}>{busy==='cache'?'Saving…':'Save expiry'}</button></div>
        <p id="cache-hint" className={`cache-hint${durationValid?'':' invalid'}`}>1–60 minutes. Saving clears existing suggestions and applies the new duration to fresh batches.</p>
      </form>
      <div className="cache-summary"><div><strong>{cache.batches&&seconds?`${cache.suggestions} suggestions ready`:'Cache is empty'}</strong><small>{cache.batches&&seconds?`${cache.batches} ${cache.batches===1?'batch':'batches'} · next expiry ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'New suggestions are prepared when needed.'}</small></div><button className="cache-clear" aria-label="Clear AI cache" disabled={disabled} onClick={()=>void action('clear',async()=>{const reply=await send({type:'gemini:clear'});setCache(reply.status!);setMessage('Cached suggestions cleared.');})}><Trash2 size={14}/> Clear cache</button></div>
    </section>
    {cache.lastMessage&&<p className="helper" role="status">{cache.lastMessage}</p>}
    <p className="gemini-privacy">Only field labels, names, placeholders, and constraints go to your chosen provider. Entered values are excluded. Your key stays in local extension storage, which is not encrypted. Suggestions expire after your chosen duration; local words remain the fallback.</p>
    <button className="text-button" disabled={disabled||!config.apiKey} onClick={()=>void action('forget',async()=>{const reply=await send({type:'gemini:save',config:{...config,apiKey:'',enabled:false}});setConfig(reply.config!);setCache(reply.status!);setMessage('Key removed and cache cleared.');})}>Remove saved key</button>
  </section>;
}
