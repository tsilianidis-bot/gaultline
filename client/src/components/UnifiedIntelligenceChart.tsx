import { useMemo } from "react";

export type IntelligenceBar = { timestamp:number; open:number; high:number; low:number; close:number; volume:number };
export type IntelligenceMarker = { eventAt:number; type:string; headline:string; detail?:string; color?:string };
export type IntelligenceLevel = { label:string; value:number; color?:string; dashed?:boolean };

export function UnifiedIntelligenceChart({ bars, markers=[], levels=[], mode="candle", ariaLabel="FAULTLINE visual intelligence chart" }: { bars: IntelligenceBar[]; markers?: IntelligenceMarker[]; levels?: IntelligenceLevel[]; mode?:"candle"|"line"; ariaLabel?:string }) {
  const width=1040,height=460,volumeTop=365;
  const domain=useMemo(()=>{ const lows=bars.map(b=>b.low), highs=bars.map(b=>b.high); return {min:Math.min(...lows)*.995,max:Math.max(...highs)*1.005};},[bars]);
  if(!bars.length) return <div style={{padding:26,border:"1px solid rgba(0,212,255,.2)",borderRadius:8,color:"#A6B6C7",fontSize:11}}>CHART HISTORY IS TEMPORARILY UNAVAILABLE.</div>;
  const x=(i:number)=>52+(i/(Math.max(1,bars.length-1)))*930, y=(p:number)=>18+((domain.max-p)/(domain.max-domain.min))*285, maxVol=Math.max(...bars.map(b=>b.volume),1);
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} style={{width:"100%",minWidth:600,display:"block",background:"#060A10"}}>
    {[0,1,2,3,4].map(i=><line key={i} x1="52" x2="982" y1={18+i*71} y2={18+i*71} stroke="rgba(148,163,184,.13)"/>)}
    {levels.filter(l=>Number.isFinite(l.value)).map(level=><g key={level.label}><line x1="52" x2="982" y1={y(level.value)} y2={y(level.value)} stroke={level.color??"#FACC15"} strokeDasharray={level.dashed===false?undefined:"5 4"} opacity=".75"/><text x="986" y={y(level.value)+4} fill={level.color??"#FACC15"} fontSize="10">{level.label}</text></g>)}
    {mode==="line"?<polyline fill="none" stroke="#00D4FF" strokeWidth="2.5" points={bars.map((b,i)=>`${x(i)},${y(b.close)}`).join(" ")}/>:bars.map((b,i)=>{const c=b.close>=b.open?"#00FF88":"#FF4D6A",w=Math.max(3,700/bars.length);return <g key={b.timestamp}><line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={c}/><rect x={x(i)-w/2} y={y(Math.max(b.open,b.close))} width={w} height={Math.max(2,Math.abs(y(b.open)-y(b.close)))} fill={c}/></g>})}
    {bars.map((b,i)=><rect key={`v${b.timestamp}`} x={x(i)-Math.max(2,650/bars.length)/2} y={volumeTop+(1-b.volume/maxVol)*56} width={Math.max(2,650/bars.length)} height={(b.volume/maxVol)*56} fill={b.close>=b.open?"rgba(0,255,136,.42)":"rgba(255,77,106,.42)"}/>) }
    <text x="52" y="355" fill="rgba(180,201,224,.5)" fontSize="10">VOLUME · COMPLETED SOURCE BARS</text>
    {markers.map(marker=>{const index=bars.reduce((best,b,i)=>Math.abs(b.timestamp-marker.eventAt)<Math.abs(bars[best].timestamp-marker.eventAt)?i:best,0);return <g key={`${marker.type}${marker.eventAt}`}><line x1={x(index)} x2={x(index)} y1="10" y2="347" stroke={marker.color??"#FACC15"} strokeDasharray="4 4"/><circle cx={x(index)} cy="18" r="7" fill={marker.color??"#FACC15"}/><title>{marker.headline}{marker.detail?` — ${marker.detail}`:""}</title></g>})}
  </svg>;
}
