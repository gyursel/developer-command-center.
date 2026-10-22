'use client';
import { useEffect, useState } from 'react';
import { storyContent } from '../story-content';
import './style-board.css';

const palettes = [{ id: 'green', name: 'Зелено' }, { id: 'blue', name: 'Синьо' }, { id: 'orange', name: 'Оранжево' }, { id: 'red', name: 'Червено' }];
export default function DesignBoard() {
  const [theme, setTheme] = useState('green');
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return <main className="design-board">
    <header className="design-board-head"><a href="/">← Към командния център</a><span>DESIGN SYSTEM / 01</span></header>
    <div className="design-board-title"><img src="/voicecommand-logo.svg" width="160" height="96" alt="Оригиналното неоново лого"/><div><p>DEVELOPER COMMAND CENTER</p><h1>Сигнал. Пространство. Контрол.</h1><p>Работно дизайн табло с реалните цветове и компоненти на въведението.</p></div></div>
    <div className="design-theme-options" aria-label="Преглед на тема">{palettes.map(p => <button key={p.id} type="button" aria-pressed={theme === p.id} onClick={() => setTheme(p.id)}>{p.name}</button>)}</div>
    <section className="design-swatches" aria-label="Цветове"><div style={{background:'#07121e'}}>Основа<code>#07121E</code></div><div style={{background:'var(--accent)',color:'#04131b'}}>Акцент<code>var(--accent)</code></div><div style={{background:'#eef7fa',color:'#07121e'}}>Заглавия<code>#EEF7FA</code></div><div style={{background:'#adbfcd',color:'#07121e'}}>Поддържащ текст<code>#ADBFCD</code></div></section>
    <div className="design-board-grid"><section className="design-sample"><small>01 / ТИПОГРАФИЯ</small><h2>Всичко под контрол.</h2><p>Orbitron за заглавията. Manrope за четим текст и кирилица. Размерите и отстоянията се адаптират към екрана.</p><a href="/#workspace-panels" className="story-action">Към панелите ↗</a><a href="#design-story" className="design-text-link">Разгледай историята ↓</a></section><section className="design-sample"><small>02 / ВИЗУАЛЕН ЕЗИК</small><div className="design-orbit"><div className="story-poster"><i/><i/><i/></div><img src="/voicecommand-logo.svg" width="100" height="60" alt=""/></div><p>Една непрекъсната мрежа, фини линии и светлина в цвета на темата. Отделна вертикална композиция за телефон.</p></section></div>
    <section id="design-story" className="design-story-list"><small>03 / СЪДЪРЖАНИЕ</small>{storyContent.scenes.map((scene,i)=><article key={scene.label}><span>0{i+1} / {scene.label}</span><h2>{scene.title}</h2><p>{scene.description}</p></article>)}</section>
    <footer>Това е дизайн образец. Изборът на тема тук не променя запазените настройки на dashboard-а.</footer>
  </main>;
}
