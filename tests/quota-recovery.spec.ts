import {launchExtension} from './helpers/extension';
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdtemp, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// A single rate-limit reply used to silence AI for a full minute, so every click in that window filled
// unrelated local words even after Gemini recovered. A click the user made must always try AI again.
test('a click retries AI as soon as Gemini recovers from a rate limit',async()=>{
  test.setTimeout(120000);
  const root=await mkdtemp(resolve(tmpdir(),'devfiller-quota-'));
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
      const state=globalThis as typeof globalThis & {rateLimited:boolean};
      state.rateLimited=false;
      globalThis.fetch=async(input,init)=>{
        if(!String(input).startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Unexpected request');
        if(!init?.body) return new Response(JSON.stringify({models:[{name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']}]}));
        if(state.rateLimited) return new Response('rate limited',{status:429});
        const metadata=JSON.parse(JSON.parse(String(init.body)).contents[0].parts[0].text) as {fields:{id:string}[]};
        const values=Array.from({length:10},(_,i)=>`Gemini suggestion ${i+1}`);
        return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({fields:metadata.fields.map(field=>({id:field.id,values}))})}]}}]}));
      };
    });
    const options=await context.newPage();
    await options.goto(`chrome-extension://${id}/index.html`);
    await options.getByLabel('Provider',{exact:true}).selectOption('gemini');
    await options.getByLabel('API key',{exact:true}).fill('fake-key-for-local-tests');
    await options.getByRole('button',{name:'Test key',exact:true}).click();
    await expect(options.getByRole('status')).toContainText('Key accepted');
    await options.getByLabel('Use AI for unknown fields').check();
    await options.getByRole('button',{name:'Save settings',exact:true}).click();
    await expect(options.getByRole('status')).toContainText('Saved');

    const website=await context.newPage();
    const cdp=await context.browser()!.newBrowserCDPSession();
    const trigger=async()=>{
      const {targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false},{exclude:true}]});
      const target=targetInfos.find(t=>t.url===website.url())!;
      await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
    };
    const aiValues=Array.from({length:10},(_,i)=>`Gemini suggestion ${i+1}`);

    // Gemini is rate limited and there is nothing cached, so local words are the correct answer.
    await worker.evaluate(()=>{(globalThis as typeof globalThis & {rateLimited:boolean}).rateLimited=true;});
    await website.goto('http://127.0.0.1:5188/dynamic-form.html');
    await trigger();
    await expect.poll(()=>website.locator('#project-code').inputValue()).not.toBe('');
    expect(aiValues).not.toContain(await website.locator('#project-code').inputValue());
    await expect.poll(()=>worker.evaluate(async()=>(await chrome.storage.session.get('geminiStatus')).geminiStatus)).toContain('quota');

    // Gemini recovers. The very next click must wait for AI instead of serving local words again.
    await worker.evaluate(()=>{(globalThis as typeof globalThis & {rateLimited:boolean}).rateLimited=false;});
    await website.goto('http://127.0.0.1:5188/dynamic-form.html');
    await trigger();
    await expect.poll(()=>website.locator('#project-code').inputValue(),{timeout:25000}).not.toBe('');
    expect(aiValues).toContain(await website.locator('#project-code').inputValue());
    expect(aiValues).toContain(await website.locator('#why').inputValue());
  } finally {
    await context.close();
    await rm(root,{recursive:true,force:true});
  }
});
