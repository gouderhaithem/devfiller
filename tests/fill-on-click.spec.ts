import {launchExtension} from './helpers/extension';
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdtemp, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Preparing on every render spends Gemini quota on forms nobody fills, so preparation is opt in and
// Gemini runs when the user clicks Fill.
test('by default the AI runs only when Fill is clicked',async()=>{
  test.setTimeout(120000);
  const root=await mkdtemp(resolve(tmpdir(),'devfiller-click-'));
  const path=resolve(root,'extension'),profile=resolve(root,'profile');
  await cp(resolve('dist'),path,{recursive:true});
  // Headless Chrome cannot operate its native permission bubble. Pregrant site access in this copy only.
  const manifest=JSON.parse(await readFile(resolve(path,'manifest.json'),'utf8'));
  manifest.host_permissions.push('http://*/*','https://*/*');
  await writeFile(resolve(path,'manifest.json'),JSON.stringify(manifest));
  const context=await launchExtension(profile,path);
  try {
    const id=createHash('sha256').update(path).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(()=>{
      const state=globalThis as typeof globalThis & {generations:number};
      state.generations=0;
      globalThis.fetch=async(input,init)=>{
        if(!String(input).startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Unexpected request');
        if(!init?.body) return new Response(JSON.stringify({models:[{name:'models/gemini-3.6-flash',supportedGenerationMethods:['generateContent']}]}));
        state.generations++;
        const metadata=JSON.parse(JSON.parse(String(init.body)).contents[0].parts[0].text) as {fields:{id:string}[]};
        const values=Array.from({length:10},(_,index)=>`Gemini suggestion ${index+1}`);
        return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({fields:metadata.fields.map(field=>({id:field.id,values}))})}]}}]}));
      };
    });
    const generations=()=>worker.evaluate(()=>(globalThis as typeof globalThis & {generations:number}).generations);

    const options=await context.newPage();
    await options.goto(`chrome-extension://${id}/index.html`);
    await options.getByLabel('Provider',{exact:true}).selectOption('gemini');
    await options.getByLabel('API key',{exact:true}).fill('fake-key-for-local-tests');
    await options.getByLabel('Use AI for unknown fields').check();
    await expect(options.getByLabel('Prepare ahead of the click')).not.toBeChecked();
    await options.getByRole('button',{name:'Save settings',exact:true}).click();
    await expect(options.getByRole('status')).toContainText('runs when you click Fill');
    // With preparation off there is no page watcher to register.
    expect(await worker.evaluate(()=>chrome.scripting.getRegisteredContentScripts())).toEqual([]);

    const website=await context.newPage();
    await website.goto('http://127.0.0.1:5188/demo.html');
    await website.waitForTimeout(2500);
    await website.reload();
    await website.waitForTimeout(2500);
    // Two full page loads with a form on screen must not have spent any quota.
    expect(await generations()).toBe(0);
    await expect(website.locator('#project-code')).toHaveValue('');

    const cdp=await context.browser()!.newBrowserCDPSession();
    const {targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false},{exclude:true}]});
    const target=targetInfos.find(t=>t.url===website.url())!;
    await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
    await expect(website.locator('#project-code')).toHaveValue('Gemini suggestion 1');
    expect(await generations()).toBe(1);

    // The cache still serves later clicks, so a second fill costs nothing extra.
    await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
    await expect(website.locator('#project-code')).toHaveValue('Gemini suggestion 2');
    expect(await generations()).toBe(1);
  } finally {
    await context.close();
    await rm(root,{recursive:true,force:true});
  }
});
