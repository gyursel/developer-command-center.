import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
type News = { title: string; url: string; source: string; published: string };
const domains = [
  ['Kaldata', 'kaldata.com'],
  ['Tech OFFNews', 'tech.offnews.bg'],
  ['TechNews', 'technews.bg'],
  ['Digital.bg', 'digital.bg'],
  ['HiComm', 'hicomm.bg'],
  ['Dnes.bg', 'dnes.bg'],
  ['Investor.bg', 'investor.bg'],
  ['Manager.bg', 'manager.bg'],
] as const;
const keywords = /(?:\bAI\b|\bOpenAI\b|\bChatGPT\b|\bGemini\b|\bClaude\b|\bGPT\b|\bCopilot\b|\bAnthropic\b|\bDeepSeek\b|\bNvidia\b|\bробот|изкуствен.{0,3}интелект|невронн|машинно обучение|генеративн)/iu;
const decode = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27);/g, match => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'"}[match] || match)).trim();
function valueOf(xml: string, tag: string) { return decode(xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'))?.[1] || ''); }
async function fetchSource(source: string, domain: string): Promise<News[]> {
  const query = encodeURIComponent('site:' + domain + ' ("изкуствен интелект" OR AI OR ChatGPT OR OpenAI OR Gemini OR Claude)');
  const url = 'https://news.google.com/rss/search?q=' + query + '&hl=bg&gl=BG&ceid=BG:bg';
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6500), next: { revalidate: 300 } });
    if (!response.ok) return [];
    const xml = await response.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map((match) => {
      const item = match[1];
      const title = valueOf(item, 'title').replace(/\s+-\s+[^-]+$/, '').trim();
      const link = valueOf(item, 'link');
      const published = valueOf(item, 'pubDate');
      return { title, url: link, source, published };
    }).filter(item => item.title && keywords.test(item.title) && /^https:\/\/news\.google\.com\//.test(item.url));
  } catch { return []; }
}
export async function GET() {
  const results = await Promise.all(domains.map(([source, domain]) => fetchSource(source, domain)));
  const items = results.flat();
  const unique = [...new Map(items.map(item => [item.title.toLocaleLowerCase('bg'), item])).values()]
    .sort((a, b) => Date.parse(b.published || '') - Date.parse(a.published || ''))
    .slice(0, 36);
  return NextResponse.json({ items: unique, sources: domains.length, availableSources: results.filter(group => group.length).length }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
  });
}
