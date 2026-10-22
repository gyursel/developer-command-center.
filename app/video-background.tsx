'use client';
import {useEffect,useRef,useState} from 'react';
export default function VideoBackground(){
 const ref=useRef<HTMLVideoElement>(null);const [paused,setPaused]=useState(false);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const apply=()=>setPaused(media.matches);apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)},[]);
 useEffect(()=>{const v=ref.current;if(!v)return;const sync=()=>{if(paused||document.hidden)v.pause();else void v.play().catch(()=>{});};sync();document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync)},[paused]);
 return <><div className="tech-background" aria-hidden="true"><video ref={ref} muted loop playsInline autoPlay preload="metadata" poster="/hi-tech-poster.jpg"><source src="/hi-tech-slow.mp4" type="video/mp4"/></video><div className="tech-shade"/></div><button className="video-toggle" onClick={()=>setPaused(p=>!p)} aria-label={paused?'Пусни видеофона':'Спри видеофона'} title={paused?'Пусни видеофона':'Спри видеофона'}>{paused?'▷':'Ⅱ'} Фон</button></>;
}
