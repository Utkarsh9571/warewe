import "server-only";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { env } from "@/lib/env";
import type { Article, Draft, SearchResult } from "./types";

const timeoutFetch = async (url:string, ms=9000) => {
  const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),ms);
  try { return await fetch(url,{signal:controller.signal,headers:{"User-Agent":"NewsletterAgent/1.0 (+assignment demo)"},redirect:"follow"}); }
  finally { clearTimeout(timer); }
};
const clean = (text:string) => text.replace(/\s+/g," ").trim();

export async function searchNews(query:string):Promise<SearchResult[]> {
  if (env.newsProvider === "newsapi" && env.newsKey) {
    const url=`https://newsapi.org/v2/everything?language=en&sortBy=publishedAt&pageSize=20&q=${encodeURIComponent(query)}`;
    const res=await timeoutFetch(url); if(!res.ok) throw new Error(`NewsAPI returned ${res.status}`);
    const data=await res.json() as {articles?:Array<{title?:string;url?:string;description?:string;publishedAt?:string;source?:{name?:string}}>};
    return (data.articles||[]).filter(a=>a.title&&a.url&&a.publishedAt).map(a=>({title:a.title!,url:a.url!,snippet:a.description||"",publishedAt:a.publishedAt!,source:a.source?.name||"Unknown source"}));
  }
  const parser=new Parser(); const feed=await parser.parseURL(`https://news.google.com/rss/search?q=${encodeURIComponent(query+" when:7d")}&hl=en-US&gl=US&ceid=US:en`);
  return (feed.items||[]).filter(i=>i.link&&i.title).map(i=>({title:clean(i.title!),url:i.link!,snippet:clean(i.contentSnippet||i.content||""),publishedAt:i.isoDate||i.pubDate||new Date().toISOString(),source:i.creator||"Google News"}));
}

export function dedupeSources(results:SearchResult[]) {
  const seen=new Set<string>(); return results.filter(r=>{ const key=(r.title.toLowerCase().replace(/\W/g,""))||r.url; if(seen.has(key)) return false; seen.add(key); return true; });
}

export async function fetchArticle(source:SearchResult):Promise<Article> {
  try {
    const res=await timeoutFetch(source.url); if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const html=await res.text(); const $=cheerio.load(html); $("script,style,nav,footer,header,aside,form,noscript").remove();
    const candidates=["article","main","[role=main]",".article-body",".article-content"].map(s=>clean($(s).text())).sort((a,b)=>b.length-a.length);
    const content=(candidates[0]||clean($("body").text())).slice(0,12000);
    if(content.length<300) throw new Error("Publisher page did not expose enough readable article text");
    return {...source,content,evidenceType:"article"};
  } catch(error) {
    if(source.snippet.length>=80) return {...source,content:source.snippet,evidenceType:"snippet",fetchError:error instanceof Error?error.message:"Article fetch failed"};
    return {...source,content:"",evidenceType:"snippet",fetchError:error instanceof Error?error.message:"Article fetch failed"};
  }
}

const escapeHtml=(v:string)=>v.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]!));
export function renderNewsletter(draft:Draft) {
  const items=draft.items.map((item,i)=>`<article><p class="number">${String(i+1).padStart(2,"0")}</p><h2><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h2><p class="meta">${escapeHtml(item.source)} · ${escapeHtml(new Date(item.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}))}${item.evidenceType==="snippet"?" · Search-snippet evidence":""}</p><p>${escapeHtml(item.summary)}</p><p class="why"><strong>Why it matters:</strong> ${escapeHtml(item.whyItMatters)}</p></article>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(draft.subject)}</title><style>body{margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033}.wrap{max-width:720px;margin:0 auto;background:#fff;padding:40px}h1{font-size:30px;margin:0 0 12px}h2{font-size:19px;margin:0 0 6px}a{color:#3c4fe0;text-decoration:none}.eyebrow,.number{color:#667085;font-size:12px;font-weight:bold;letter-spacing:.08em}.meta{color:#667085;font-size:13px}.why{background:#f2f4ff;padding:12px;border-radius:8px}article{border-top:1px solid #e5e7eb;padding:22px 0}footer{border-top:1px solid #e5e7eb;margin-top:28px;padding-top:20px;color:#667085}</style></head><body><main class="wrap"><p class="eyebrow">WEEKLY INTELLIGENCE BRIEF</p><h1>${escapeHtml(draft.subject)}</h1><p>${escapeHtml(draft.intro)}</p>${items}<footer>${escapeHtml(draft.closing)}</footer></main></body></html>`;
}
