'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Radio, RefreshCw } from 'lucide-react';
import './ai-news-ticker.css';

type News = { title: string; url: string; source: string; published: string };
export default function AiNewsTicker() {
  const [items, setItems] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/ai-news', { cache: 'no-store' });
        if (!response.ok) throw new Error('News unavailable');
        const data: { items?: News[] } = await response.json();
        if (!active) return;
        const valid = Array.isArray(data.items) ? data.items : [];
        setItems(valid);
        setFailed(valid.length === 0);
        setUpdated(new Date());
      } catch { if (active) setFailed(true); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 300000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return <section className="ai-news" aria-label="Актуални AI технологични новини на български">
    <div className="ai-news-heading"><Radio size={14} aria-hidden="true" /><span>AI НОВИНИ</span><span className="ai-news-live">BG · 8 ИЗТОЧНИКА</span></div>
    <div className="ai-news-viewport">
      {items.length ? <div className="ai-news-track">
        {[0, 1].map(copy => <div className="ai-news-group" key={copy} aria-hidden={copy === 1}>
          {items.map((item, index) => <a key={item.url + index} href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={copy === 1 ? -1 : 0} title={item.title}>
            <span className="ai-news-source">{item.source}</span><span>{item.title}</span><ExternalLink size={12} aria-hidden="true" />
          </a>)}
        </div>)}
      </div> : <span className="ai-news-empty">{loading ? 'Зареждане на новините…' : failed ? 'Няма достъпни AI новини в момента.' : 'Няма нови публикации.'}</span>}
    </div>
    <div className="ai-news-meta"><RefreshCw size={12} aria-hidden="true"/><span title={updated?.toLocaleString('bg-BG')}>5 МИН</span></div>
  </section>;
}
