import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const src=resolve(process.argv[2]), out=resolve(process.argv[3]);
const browser=await chromium.launch();
const page=await browser.newPage();
await page.goto(pathToFileURL(src).href,{waitUntil:'networkidle'});
await page.pdf({path:out,format:'A4',printBackground:true,
  displayHeaderFooter:true,
  headerTemplate:'<div></div>',
  footerTemplate:'<div style="width:100%;font-size:7pt;color:#767c94;font-family:Helvetica,Arial,sans-serif;padding:0 15mm;display:flex;justify-content:space-between;"><span>DevFiller &mdash; Chrome Web Store Readiness</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
  margin:{top:'16mm',bottom:'18mm',left:'15mm',right:'15mm'}});
await browser.close();
console.log('written',out);
