'use client';
import {useEffect,useRef,useState} from 'react';

/** The mobile layout uses a still poster by default; video is opt-in on small screens. */
export default function VideoBackground(){
 const ref=useRef<HTMLVideoElement>(null);
 const [constrained,setConstrained]=useState(true);
 const [paused,setPaused]=useState(true);
 const [userChoice,setUserChoice]=useState<boolean|null>(null);
 useEffect(()=>{
  const query=window.matchMedia('(max-width: 760px), (prefers-reduced-motion: reduce)');
  const apply=()=>setConstrained(query.matches);
  apply();
  query.addEventListener('change',apply);
  return()=>query.removeEventListener('change',apply);
 },[]);
 const enabled=userChoice===null?!constrained:userChoice;
 useEffect(()=>{
  const video=ref.current;
  if(!video){setPaused(true);return;}
  if(!enabled||document.hidden){video.pause();setPaused(true);return;}
  const play=()=>{void video.play().then(()=>setPaused(false)).catch(()=>setPaused(true));};
  play();
  document.addEventListener('visibilitychange',play);
  return()=>document.removeEventListener('visibilitychange',play);
 },[enabled]);
 return <>
  <div className="tech-background" aria-hidden="true">
   {enabled&&<video ref={ref} muted loop playsInline autoPlay preload="metadata" poster="/hi-tech-poster.jpg"><source src="/hi-tech-slow.mp4" type="video/mp4"/></video>}
   <div className="tech-shade"/>
  </div>
  <button type="button" className="video-toggle" aria-pressed={enabled&&!paused} onClick={()=>setUserChoice(!enabled)} aria-label={enabled?'Спри видеофона':'Пусни видеофона'} title={enabled?'Спри видеофона':'Пусни видеофона'}>{enabled&&!paused?'Ⅱ':'▷'} Фон</button>
 </>;
}
