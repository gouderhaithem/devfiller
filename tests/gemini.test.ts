import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TTL, DEFAULT_MODEL, MODELS, PROVIDER_SPECS, generateSuggestions, listModels, liveBatch, parseSuggestions, validateGemini } from '../src/gemini';
import type { UnknownField } from '../src/fill';
const fields:UnknownField[]=[{id:'field_1',label:'Project code',name:'project',placeholder:'',type:'text',min:'',max:'',step:'',minLength:-1,maxLength:20}];
afterEach(()=>vi.unstubAllGlobals());
describe('Gemini client and expiry',()=>{
  it('keeps existing installations at five minutes and validates saved cache durations',()=>{
    expect(validateGemini({enabled:true,apiKey:' key ',model:DEFAULT_MODEL})).toEqual({enabled:true,provider:'gemini',apiKey:'key',model:DEFAULT_MODEL,cacheMinutes:5,autoPrepare:false});
    expect(validateGemini({})).toEqual({enabled:false,provider:'groq',apiKey:'',model:PROVIDER_SPECS.groq.defaultModel,cacheMinutes:5,autoPrepare:false});
    // Preparing ahead of the click spends quota on forms the user may never fill, so it must be opt in.
    for(const value of [undefined,null,0,1,'true','yes',{}]) expect(validateGemini({autoPrepare:value}).autoPrepare).toBe(false);
    expect(validateGemini({autoPrepare:true}).autoPrepare).toBe(true);
    for(const cacheMinutes of [1,12,60]) expect(validateGemini({cacheMinutes}).cacheMinutes).toBe(cacheMinutes);
    for(const cacheMinutes of [0,-1,61,1.5,NaN,Infinity,'12',null]) expect(validateGemini({cacheMinutes}).cacheMinutes).toBe(5);
  });
  it('requests structured suggestions using metadata only and the key in a header',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({fields:[{id:'field_1',values:['Cedar','Maple','Cedar']}]})}]}}]})));
    vi.stubGlobal('fetch',fetch);
    const result=await generateSuggestions({provider:'gemini',apiKey:'fake-test-key',model:'gemini-3.8-flash'},fields,'en');
    expect(result).toEqual({field_1:['Cedar','Maple']});
    const [url,options]=fetch.mock.calls[0];expect(url).not.toContain('fake-test-key');expect(options.headers['x-goog-api-key']).toBe('fake-test-key');
    expect(options.body).not.toContain('fake-test-key');expect(JSON.parse(options.body).generationConfig.responseMimeType).toBe('application/json');
    expect(JSON.parse(JSON.parse(options.body).contents[0].parts[0].text)).toEqual({language:'en',fields});
  });
  it('rejects unknown IDs, duplicate strings, oversized values, and nonstrings',()=>{
    expect(parseSuggestions({fields:[{id:'field_1',values:[' Cedar ','Cedar',123,'x'.repeat(21)]},{id:'unknown',values:['Ignored']}]},fields)).toEqual({field_1:['Cedar']});
    expect(()=>parseSuggestions({fields:[]},fields)).toThrow('no usable');
  });
  it('rejects ID fragments in generated suggestions while retaining readable words',()=>{
    expect(parseSuggestions({fields:[{id:'field_1',values:['Garden-efe02541','Cedar','efe02541-Maple','Studio efe02541','Meadow']} ]},fields)).toEqual({field_1:['Cedar','Meadow']});
  });
  it('expires at exactly five minutes',()=>{
    const created=1000,batch={expiresAt:created+CACHE_TTL,values:{field_1:['Cedar']}};
    expect(liveBatch(batch,created+CACHE_TTL-1)).toEqual(batch);
    expect(liveBatch(batch,created+CACHE_TTL)).toBeUndefined();
  });
  it('reports quota failures without returning sensitive provider error bodies',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('sensitive provider response',{status:429})));
    await expect(generateSuggestions({provider:'gemini',apiKey:'fake',model:'gemini-test'},fields,'en')).rejects.toThrow('quota');
  });
  it('offers only the supported models the key can actually use',async()=>{
    const models=[...MODELS.map(name=>({name:`models/${name}`,supportedGenerationMethods:['generateContent']})),{name:'models/gemini-9-experimental',supportedGenerationMethods:['generateContent']},{name:'models/embedding',supportedGenerationMethods:['embedContent']}];
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({models}))));
    expect(await listModels('gemini','fake')).toEqual([...MODELS]);
  });
  it('hides supported models the key cannot reach',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({models:[{name:`models/${MODELS[1]}`,supportedGenerationMethods:['generateContent']}]}))));
    expect(await listModels('gemini','fake')).toEqual([MODELS[1]]);
  });
  it('rejects a key with no supported model',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({models:[{name:'models/gemini-9-experimental',supportedGenerationMethods:['generateContent']}]}))));
    await expect(listModels('gemini','fake')).rejects.toThrow('supported');
  });
  it('falls back to the default model for unsupported or unsafe names',()=>{
    expect(validateGemini({apiKey:' key ',model:'../../other'}).model).toBe(DEFAULT_MODEL);
    expect(validateGemini({apiKey:'key',model:'gemini-9-experimental'}).model).toBe(DEFAULT_MODEL);
    expect(validateGemini({apiKey:'key',model:MODELS[2]}).model).toBe(MODELS[2]);
  });
  it('offers Groq its own models and authenticates with a bearer token',async()=>{
    const groq=PROVIDER_SPECS.groq;
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:groq.models.map(id=>({id}))})));
    vi.stubGlobal('fetch',fetch);
    expect(await listModels('groq','groq-key')).toEqual([...groq.models]);
    const [url,options]=fetch.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/models');
    expect(options.headers.Authorization).toBe('Bearer groq-key');
    expect(url).not.toContain('groq-key');
  });
  it('reads Groq chat completions and keeps the key out of the URL and body',async()=>{
    const content=JSON.stringify({fields:[{id:'field_1',values:['Cedar','Maple']}]});
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content}}]})));
    vi.stubGlobal('fetch',fetch);
    const model=PROVIDER_SPECS.groq.defaultModel;
    await expect(generateSuggestions({provider:'groq',apiKey:'groq-key',model},fields,'en')).resolves.toEqual({field_1:['Cedar','Maple']});
    const [url,options]=fetch.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(options.body).not.toContain('groq-key');
    const body=JSON.parse(options.body);
    expect(body.model).toBe(model);
    expect(body.response_format.type).toBe('json_schema');
    expect(JSON.parse(body.messages[1].content)).toEqual({language:'en',fields});
  });
  it('sends a model to the provider that owns it',()=>{
    expect(validateGemini({provider:'groq'}).model).toBe(PROVIDER_SPECS.groq.defaultModel);
    expect(validateGemini({provider:'groq',model:DEFAULT_MODEL}).model).toBe(PROVIDER_SPECS.groq.defaultModel);
    expect(validateGemini({provider:'gemini',model:PROVIDER_SPECS.groq.defaultModel}).model).toBe(DEFAULT_MODEL);
    expect(validateGemini({provider:'nope'}).provider).toBe('groq');
    // A fresh install starts on Groq, but settings saved before providers existed were Gemini.
    expect(validateGemini({}).provider).toBe('groq');
    expect(validateGemini({apiKey:'legacy-gemini-key'}).provider).toBe('gemini');
    expect(validateGemini({model:DEFAULT_MODEL}).provider).toBe('gemini');
    expect(validateGemini({apiKey:'k',model:MODELS[2]})).toMatchObject({provider:'gemini',model:MODELS[2]});
  });
  it('retries an overloaded model and succeeds without bothering the user',async()=>{
    const ok=new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({fields:[{id:'field_1',values:['Cedar']}]})}]}}]}));
    const fetch=vi.fn().mockResolvedValueOnce(new Response('overloaded',{status:503})).mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch',fetch);
    await expect(generateSuggestions({provider:'gemini',apiKey:'fake',model:DEFAULT_MODEL},fields,'en')).resolves.toEqual({field_1:['Cedar']});
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('gives up after exhausting retries and never retries a rejected key',async()=>{
    const overloaded=vi.fn().mockResolvedValue(new Response('overloaded',{status:503}));
    vi.stubGlobal('fetch',overloaded);
    await expect(generateSuggestions({provider:'gemini',apiKey:'fake',model:DEFAULT_MODEL},fields,'en')).rejects.toThrow('503');
    expect(overloaded.mock.calls.length).toBeGreaterThan(1);
    const rejected=vi.fn().mockResolvedValue(new Response('bad key',{status:403}));
    vi.stubGlobal('fetch',rejected);
    await expect(generateSuggestions({provider:'gemini',apiKey:'fake',model:DEFAULT_MODEL},fields,'en')).rejects.toThrow('rejected');
    expect(rejected).toHaveBeenCalledTimes(1);
  });
});
