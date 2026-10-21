// "LinkedIn profile", "Profil LinkedIn", "حساب فيسبوك": a link field that names a network gets a profile
// on that network for the form's own fictional person ("jane.doe" → https://github.com/jane-doe).
// Words are matched as normalize() writes them, so "GitHub" is "git hub" and "إنستغرام" is "انستغرام".
const NETWORKS: ReadonlyArray<readonly [RegExp, (handle: string) => string]> = [
  [/linked ?in|لينكد ?ان/, handle => `https://www.linkedin.com/in/${handle}`],
  [/git ?hub|جيت ?هب/, handle => `https://github.com/${handle}`],
  [/git ?lab/, handle => `https://gitlab.com/${handle}`],
  [/face ?book|فيس ?بوك/, handle => `https://www.facebook.com/${handle}`],
  [/insta ?gram|انستغرام|انستقرام/, handle => `https://www.instagram.com/${handle}`],
  [/twitter|(?:^| )x(?: |$)|تويتر/, handle => `https://x.com/${handle}`],
  [/you ?tube|يوتيوب/, handle => `https://www.youtube.com/@${handle}`],
  [/tik ?tok|تيك ?توك/, handle => `https://www.tiktok.com/@${handle}`],
  [/behance/, handle => `https://www.behance.net/${handle}`],
  [/dribbble/, handle => `https://dribbble.com/${handle}`],
];
// A profile link on the network the field's own words name (its label, name, id, placeholder:
// controlSignals), or undefined for any other website.
export function profileLink(said: readonly string[], username: string): string | undefined {
  const handle = username.replace(/[._]+/g, '-');
  return NETWORKS.find(([words]) => said.some(text => words.test(text)))?.[1](handle);
}
