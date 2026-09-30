import {chromium,expect,type BrowserContext} from '@playwright/test';

// Launches Chromium with the extension. A fresh profile installs it, and installing opens the
// welcome tab, sometimes late enough to become the active tab after a test has opened its own
// pages. Toolbar clicks then land on the welcome page, so close it before the test starts.
export async function launchExtension(profile:string,extension:string):Promise<BrowserContext> {
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  await expect.poll(()=>context.pages().some(page=>page.url().endsWith('/welcome.html')),{timeout:15000}).toBe(true);
  await Promise.all(context.pages().filter(page=>page.url().endsWith('/welcome.html')).map(page=>page.close()));
  return context;
}
