'use client';
import {useEffect,useRef,useState} from 'react';

/** Progressive-enhancement motion sequence; never blocks the functional dashboard. */
export default function CinematicSignal({attention=false}:{attention?:boolean}){
 const root=useRef<HTMLElement>(null);
 const [motion,setMotion]=useState(false);
 useEffect(()=>{
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setMotion(!reduced.matches);
  update();reduced.addEventListener('change',update);
  return()=>reduced.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  if(!motion||!root.current)return;
  const target=root.current;let raf=0;
  const update=()=>{
   cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
    const rect=target.getBoundingClientRect(),height=window.innerHeight||1;
    const progress=Math.min(1,Math.max(0,(height-rect.top)/(height+rect.height)));
    target.style.setProperty('--story-progress',String(progress));
   });
  };
  update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
  return()=>{cancelAnimationFrame(raf);window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
 },[motion]);
 return <section ref={root} className={'cinema-signal '+(motion?'is-animated':'is-still')+(attention?' has-update':'')} aria-label="Визуална карта на командния център">
  <div className="cinema-scene" aria-hidden="true">
   <div className="cinema-grid"/>
   <span className="cinema-trace trace-one"/><span className="cinema-trace trace-two"/>
   <div className="cinema-center">
    <span className="cinema-ring ring-outside"/><span className="cinema-ring ring-middle"/><span className="cinema-ring ring-inside"/>
    <span className="cinema-core">DCC<span className="cinema-core-sub">SYSTEM</span></span>
    <span className="cinema-satellite satellite-one"/><span className="cinema-satellite satellite-two"/>
   </div>
   <div className="cinema-scanline"/>
   <div className="cinema-coordinate top-left">01 / OBSERVE</div>
   <div className="cinema-coordinate top-right">02 / DEPLOY</div>
   <div className="cinema-coordinate bottom-right">03 / RESPOND</div>
  </div>
  <div className="cinema-story" aria-hidden="true">
   <span>MONITOR</span><i/><span>DEPLOY</span><i/><span>RESPOND</span>
  </div>
 </section>;
}
