import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import HomePage      from "./pages/HomePage";
import RegisterPage  from "./pages/RegisterPage";
import SelectPlanPage from "./pages/SelectPlanPage";
import DashboardPage  from "./pages/DashboardPage";
import AdminPage      from "./pages/AdminPage";

/* ═══════════════════════════ DELIVERY RIDER ═══════════════════════════ */
const DeliveryRider = ({ cls = "" }) => (
  <svg viewBox="0 0 340 220" className={`rider-svg ${cls}`} aria-hidden="true">
    <defs>
      <radialGradient id="bG" cx="50%" cy="35%" r="65%"><stop offset="0%" stopColor="#ff6b6b"/><stop offset="60%" stopColor="#e63946"/><stop offset="100%" stopColor="#9b1b30"/></radialGradient>
      <radialGradient id="wG" cx="40%" cy="35%" r="60%"><stop offset="0%" stopColor="#4a4a4a"/><stop offset="100%" stopColor="#0d0d0d"/></radialGradient>
      <linearGradient id="jG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffb347"/><stop offset="100%" stopColor="#e67e22"/></linearGradient>
      <linearGradient id="xG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#5cd65c"/><stop offset="100%" stopColor="#2d862d"/></linearGradient>
      <radialGradient id="lG"><stop offset="0%" stopColor="rgba(255,230,100,0.95)"/><stop offset="100%" stopColor="rgba(255,200,50,0)"/></radialGradient>
      <filter id="sh"><feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="rgba(0,0,0,0.5)"/></filter>
      <filter id="rGl"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>

    {/* Ground shadow */}
    <ellipse cx="170" cy="217" rx="140" ry="6" fill="rgba(0,0,0,0.3)" filter="url(#sh)"/>

    {/* REAR WHEEL */}
    <circle cx="70"  cy="175" r="40" fill="url(#wG)" filter="url(#sh)"/>
    <circle cx="70"  cy="175" r="27" fill="#1d1d1d"/>
    <circle cx="70"  cy="175" r="13" fill="#444"/>
    <circle cx="70"  cy="175" r="5"  fill="#888"/>
    {[0,45,90,135,180,225,270,315].map(a=>(
      <line key={a}
        x1={70+13*Math.cos(a*Math.PI/180)} y1={175+13*Math.sin(a*Math.PI/180)}
        x2={70+26*Math.cos(a*Math.PI/180)} y2={175+26*Math.sin(a*Math.PI/180)}
        stroke="#555" strokeWidth="2"/>
    ))}
    <circle cx="70"  cy="175" r="40" fill="none" stroke="#111" strokeWidth="5"/>

    {/* FRONT WHEEL */}
    <circle cx="270" cy="175" r="38" fill="url(#wG)" filter="url(#sh)"/>
    <circle cx="270" cy="175" r="25" fill="#1d1d1d"/>
    <circle cx="270" cy="175" r="12" fill="#444"/>
    <circle cx="270" cy="175" r="5"  fill="#888"/>
    {[0,45,90,135,180,225,270,315].map(a=>(
      <line key={a}
        x1={270+12*Math.cos(a*Math.PI/180)} y1={175+12*Math.sin(a*Math.PI/180)}
        x2={270+24*Math.cos(a*Math.PI/180)} y2={175+24*Math.sin(a*Math.PI/180)}
        stroke="#555" strokeWidth="2"/>
    ))}
    <circle cx="270" cy="175" r="38" fill="none" stroke="#111" strokeWidth="5"/>

    {/* SCOOTER BODY */}
    <path d="M78 148 Q95 100 140 95 Q165 92 185 100 L220 110 Q250 115 258 135 L265 155 Q220 145 140 148 Z" fill="url(#bG)" filter="url(#sh)"/>
    {/* 3D side shading on body */}
    <path d="M78 148 Q68 140 65 135 Q68 120 80 115 Q95 108 110 110 L115 130 Q98 136 90 145 Z" fill="#7f0e1a"/>
    <path d="M230 110 Q260 108 275 125 Q278 140 270 155 L265 155 Q258 135 240 128 Z" fill="#7f0e1a"/>
    {/* Body highlight stripe */}
    <path d="M100 130 Q140 110 185 112" fill="none" stroke="rgba(255,150,150,0.25)" strokeWidth="3" strokeLinecap="round"/>
    <rect x="115" y="155" width="105" height="12" rx="5" fill="#6a0000"/>
    {/* Seat with highlight */}
    <path d="M140 115 Q165 108 185 110 L190 125 Q165 128 142 125 Z" fill="#8B6914"/>
    <path d="M145 116 Q165 110 183 112" fill="none" stroke="rgba(255,220,100,0.3)" strokeWidth="2" strokeLinecap="round"/>
    {/* Handlebar */}
    <line x1="240" y1="115" x2="248" y2="90" stroke="#777" strokeWidth="6" strokeLinecap="round"/>
    <line x1="237" y1="90" x2="263" y2="90" stroke="#666" strokeWidth="7" strokeLinecap="round"/>
    {/* Headlight */}
    <ellipse cx="278" cy="128" rx="13" ry="9" fill="#ffe066" stroke="#f9c400" strokeWidth="1.5"/>
    <ellipse cx="278" cy="128" rx="9" ry="6" fill="url(#lG)"/>
    {/* Headlight beam */}
    <path d="M284 132 L330 168 L308 172 Z" fill="rgba(255,230,80,0.06)" filter="url(#rGl)"/>
    <ellipse cx="65" cy="138" rx="7" ry="5" fill="#ff3333" opacity="0.9"/>
    <path d="M78 160 Q55 162 48 168" fill="none" stroke="#888" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="158" cy="138" r="13" fill="#9b0000" stroke="#6a0000" strokeWidth="2"/>

    {/* RIDER LEGS */}
    <path d="M165 150 Q168 168 172 178" fill="none" stroke="#3a7bc8" strokeWidth="13" strokeLinecap="round"/>
    <path d="M172 150 Q175 168 180 178" fill="none" stroke="#2d6ab0" strokeWidth="12" strokeLinecap="round"/>
    <ellipse cx="172" cy="180" rx="12" ry="5" fill="#1a3a98"/>

    {/* RIDER TORSO - orange jacket */}
    <path d="M150 95 Q148 120 150 150 Q162 158 178 152 Q188 142 188 115 Q185 90 170 87 Z" fill="url(#jG)" filter="url(#sh)"/>
    {/* Jacket shading — left side darker */}
    <path d="M150 95 Q148 125 150 150 Q156 155 162 152 Q158 140 158 115 Q158 95 155 90 Z" fill="rgba(0,0,0,0.15)"/>
    {/* Jacket logo patch */}
    <rect x="161" y="108" width="14" height="18" rx="2" fill="rgba(255,255,255,0.18)"/>
    {/* Right arm */}
    <path d="M186 110 Q215 105 240 100" fill="none" stroke="#e67e22" strokeWidth="12" strokeLinecap="round"/>
    <circle cx="243" cy="99" r="8" fill="#1a1a1a"/>
    {/* Left arm */}
    <path d="M182 115 Q210 109 237 105" fill="none" stroke="#ffb347" strokeWidth="10" strokeLinecap="round"/>
    <circle cx="238" cy="104" r="7" fill="#111"/>

    {/* NECK */}
    <rect x="163" y="80" width="15" height="14" rx="4" fill="#c47a50"/>
    {/* HEAD */}
    <circle cx="170" cy="62" r="27" fill="#c47a50"/>
    {/* HELMET */}
    <path d="M143 65 Q143 30 170 27 Q197 30 197 65" fill="#cc2020" stroke="#991010" strokeWidth="1.5"/>
    {/* Helmet ridge highlight */}
    <path d="M146 58 Q170 23 194 58" fill="none" stroke="rgba(255,100,100,0.5)" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Helmet left shading */}
    <path d="M143 65 Q143 32 156 28 Q145 40 143 65 Z" fill="rgba(0,0,0,0.2)"/>
    {/* VISOR */}
    <path d="M146 62 Q149 73 163 79 Q170 82 177 79 Q191 73 194 62 Q184 68 170 69 Q156 68 146 62 Z" fill="rgba(140,200,255,0.5)" stroke="rgba(80,160,255,0.5)" strokeWidth="1"/>
    <path d="M152 63 Q165 59 184 63" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"/>

    {/* DELIVERY BOX — 3D */}
    <rect x="88" y="90" width="57" height="52" rx="4" fill="url(#xG)" filter="url(#sh)" stroke="#1a6b1a" strokeWidth="1.5"/>
    {/* Box top face */}
    <path d="M88 90 L98 76 L155 76 L145 90 Z" fill="#7de87d" stroke="#2d862d" strokeWidth="1"/>
    {/* Box right face (dark) */}
    <path d="M145 90 L155 76 L155 128 L145 142 Z" fill="#1d5c1d"/>
    {/* Box label */}
    <rect x="100" y="105" width="32" height="22" rx="3" fill="rgba(255,255,255,0.22)"/>
    <path d="M107 112 L120 119 L133 112" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <line x1="116" y1="90" x2="116" y2="142" stroke="#1a6b1a" strokeWidth="2.5"/>
    <line x1="88" y1="116" x2="145" y2="116" stroke="#1a6b1a" strokeWidth="2.5"/>
    <rect x="111" y="86" width="10" height="7" rx="2" fill="#1a6b1a"/>
  </svg>
);

/* ═════════════════════ SKY LAYER ═════════════════════ */
const Sky = () => (
  <div className="sky-layer">
    <div className="stars">
      {[...Array(60)].map((_,i) => (
        <div key={i} className={`star s${i%5}`}
          style={{ top:`${(i*137.5)%90}%`, left:`${(i*97.3)%100}%`, animationDelay:`${(i*0.3)%4}s` }}/>
      ))}
    </div>
    <div className="sun-moon"><div className="sun"/><div className="moon"/></div>
    <div className="sky-fog"/>
  </div>
);

/* ═════════════════════ 3D BUILDING HELPER ═════════════════════
   fab = front face, sab = side (right) face, tab = top face    */
const Bld = ({ x, y, w, h, ff="#0e1f3a", sf="#091428", tf="#142040", wf="rgba(255,215,95,", opacity=0.72, wins=[] }) => (
  <g opacity={opacity}>
    {/* Front face */}
    <rect x={x} y={y} width={w} height={h} fill={ff}/>
    {/* Right side face — 3D depth */}
    <polygon points={`${x+w},${y} ${x+w+12},${y-8} ${x+w+12},${y+h-8} ${x+w},${y+h}`} fill={sf}/>
    {/* Top face */}
    <polygon points={`${x},${y} ${x+w},${y} ${x+w+12},${y-8} ${x+12},${y-8}`} fill={tf}/>
    {/* Windows */}
    {wins.map(([wx,wy,ww,wh,op],i) => (
      <rect key={i} x={x+wx} y={y+wy} width={ww} height={wh} rx="1.5"
        fill={`${wf}${op})`} filter="url(#wGlw)"/>
    ))}
  </g>
);

/* ═════════════════════ REALISTIC TREE ═════════════════════ */
const Tree = ({x, y, scale=1}) => {
  const s = scale;
  return (
    <g>
      {/* Trunk with shading */}
      <rect x={x-4*s} y={y-55*s} width={8*s} height={55*s} fill="#5c3a1e"/>
      <rect x={x} y={y-55*s} width={3*s} height={55*s} fill="#3a2410"/>
      {/* Back foliage (darker) */}
      <ellipse cx={x} cy={y-80*s} rx={26*s} ry={30*s} fill="rgba(18,72,18,0.8)"/>
      {/* Main canopy */}
      <ellipse cx={x} cy={y-88*s} rx={22*s} ry={26*s} fill="rgba(22,90,22,0.85)"/>
      {/* Mid highlight */}
      <ellipse cx={x-5*s} cy={y-95*s} rx={14*s} ry={18*s} fill="rgba(28,110,28,0.7)"/>
      {/* Top shine */}
      <ellipse cx={x-4*s} cy={y-102*s} rx={9*s} ry={10*s} fill="rgba(40,140,40,0.5)"/>
      {/* Right shadow */}
      <ellipse cx={x+10*s} cy={y-78*s} rx={12*s} ry={20*s} fill="rgba(8,40,8,0.45)"/>
    </g>
  );
};

/* ═════════════════════ REALISTIC HOUSE ═════════════════════ */
const House = ({ x, y, w=110, h=100, roofColor="#8B4513", wallColor="#d4b896", darkWall="#b89060", winColor="rgba(255,215,100,", chimneyX=null }) => {
  // Roof height fixed to a natural 28px — no more spires
  const rh = 28;
  const rx = chimneyX ?? x + Math.floor(w * 0.38);
  const peakY = y - rh;
  return (
    <g>
      {/* Wall front */}
      <rect x={x} y={y} width={w} height={h} fill={wallColor}/>
      {/* Wall right side — 3D depth panel */}
      <polygon points={`${x+w},${y} ${x+w+14},${y-9} ${x+w+14},${y+h-9} ${x+w},${y+h}`} fill={darkWall}/>
      {/* Roof front — shallow pitch */}
      <polygon points={`${x-3},${y} ${x+w+3},${y} ${x+w/2},${peakY}`} fill={roofColor}/>
      {/* Roof right face (darker 3D) */}
      <polygon points={`${x+w+3},${y} ${x+w+17},${y-9} ${x+w/2+17},${peakY-9} ${x+w/2},${peakY}`}
        fill={roofColor} opacity="0.58"/>
      {/* Eave shadow strip */}
      <rect x={x-3} y={y} width={w+6} height={5} fill="rgba(0,0,0,0.18)" rx="1"/>
      {/* Door */}
      <rect x={x+w/2-12} y={y+h-36} width={24} height={36} rx="2" fill={darkWall}/>
      <rect x={x+w/2-10} y={y+h-34} width={10} height={32} rx="1" fill="rgba(0,0,0,0.22)"/>
      {/* Windows */}
      <rect x={x+7}    y={y+14} width={22} height={20} rx="2" fill={`${winColor}0.2)`} stroke="rgba(100,70,20,0.55)" strokeWidth="1.5" className="win-day"/>
      <rect x={x+w-29} y={y+14} width={22} height={20} rx="2" fill={`${winColor}0.2)`} stroke="rgba(100,70,20,0.55)" strokeWidth="1.5" className="win-day"/>
      <rect x={x+7}    y={y+14} width={22} height={20} rx="2" fill={`${winColor}0.0)`} className="win-night"/>
      <rect x={x+w-29} y={y+14} width={22} height={20} rx="2" fill={`${winColor}0.0)`} className="win-night"/>
      {/* Window muntins */}
      <line x1={x+18}    y1={y+14} x2={x+18}    y2={y+34} stroke="rgba(100,70,20,0.45)" strokeWidth="1"/>
      <line x1={x+7}     y1={y+24} x2={x+29}    y2={y+24} stroke="rgba(100,70,20,0.45)" strokeWidth="1"/>
      <line x1={x+w-18}  y1={y+14} x2={x+w-18}  y2={y+34} stroke="rgba(100,70,20,0.45)" strokeWidth="1"/>
      <line x1={x+w-29}  y1={y+24} x2={x+w-7}   y2={y+24} stroke="rgba(100,70,20,0.45)" strokeWidth="1"/>
      {/* Chimney — positioned on slope */}
      <rect x={rx} y={peakY-22} width={9} height={22} fill="#6b4a2a"/>
      <rect x={rx-3} y={peakY-25} width={15} height={5} rx="1" fill="#855a36"/>
      {/* Smoke puff */}
      <circle cx={rx+4} cy={peakY-33} r={7} fill="rgba(180,180,180,0.12)" className="smoke-puff"/>
      <circle cx={rx+2} cy={peakY-45} r={5} fill="rgba(180,180,180,0.09)"/>
    </g>
  );
};

/* ═════════════════════ 3D CITY SVG ═════════════════════ */
const CityScene = () => (
  <svg className="seg-svg" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax meet">
    <defs>
      <radialGradient id="aGlow" cx="50%" cy="0%" r="80%"><stop offset="0%" stopColor="rgba(255,50,50,0.9)"/><stop offset="100%" stopColor="rgba(255,50,50,0)"/></radialGradient>
      <filter id="wGlw"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="urGlow"><feGaussianBlur stdDeviation="22" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>

    {/* Urban ground glow */}
    <ellipse cx="720" cy="520" rx="750" ry="100" fill="rgba(255,140,60,0.05)" filter="url(#urGlow)"/>

    {/* FAR layer buildings — low opacity, no 3D side needed */}
    {[{x:0,y:100,w:52,h:420},{x:58,y:140,w:44,h:380},{x:108,y:75,w:68,h:445},
      {x:185,y:115,w:55,h:405},{x:248,y:70,w:80,h:450},{x:336,y:145,w:48,h:375},
      {x:392,y:80,w:74,h:440},{x:474,y:110,w:54,h:410},{x:536,y:52,w:85,h:468},
      {x:630,y:115,w:56,h:405},{x:694,y:80,w:76,h:440},{x:778,y:138,w:50,h:382},
      {x:836,y:60,w:84,h:460},{x:928,y:105,w:58,h:415},{x:994,y:74,w:78,h:446},
      {x:1080,y:120,w:52,h:400},{x:1140,y:54,w:86,h:466},{x:1235,y:100,w:60,h:420},
      {x:1303,y:64,w:82,h:456},{x:1392,y:128,w:48,h:392}
    ].map((b,i)=>(
      <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h}
        fill={i%2===0?"#0b1a2e":"#0d1f3a"} opacity="0.42"/>
    ))}

    {/* MID layer — 3D buildings using <Bld> */}
    <Bld x={0}    y={218} w={92}  h={302} ff="#0f2044" sf="#091530" tf="#152448" opacity={0.74}
      wins={[[6,18,14,22,0.16],[6,50,14,22,0.18],[6,82,14,22,0.15],[32,18,14,22,0.14],[32,50,14,22,0.18],[32,82,14,22,0.16],[58,18,14,22,0.15],[58,50,14,22,0.17],[58,82,14,22,0.14]]}/>

    <Bld x={102}  y={148} w={108} h={372} ff="#102244" sf="#09182e" tf="#162a50" opacity={0.76}
      wins={[[8,20,16,24,0.16],[8,56,16,24,0.18],[8,92,16,24,0.15],[8,128,16,24,0.17],[36,20,16,24,0.15],[36,56,16,24,0.17],[36,92,16,24,0.16],[36,128,16,24,0.14],[64,20,16,24,0.16],[64,56,16,24,0.18],[64,92,16,24,0.15],[64,128,16,24,0.17],[88,20,16,24,0.14],[88,56,16,24,0.16],[88,92,16,24,0.15],[88,128,16,24,0.18]]}/>
    {/* Crown on that tower */}
    <polygon points="102,148 210,148 222,136 114,136" fill="#152a50" opacity="0.76"/>
    <polygon points="114,136 210,148 222,136 208,126 124,126" fill="#111f3a" opacity="0.76"/>
    <line x1="158" y1="126" x2="158" y2="106" stroke="#1a3060" strokeWidth="2.5"/>
    <circle cx="158" cy="104" r="5" fill="url(#aGlow)" className="ant-b"/>

    <Bld x={400}  y={182} w={118} h={338} ff="#0f1f42" sf="#091530" tf="#142048" opacity={0.70}
      wins={[[8,18,14,22,0.15],[8,52,14,22,0.17],[8,86,14,22,0.16],[8,120,14,22,0.14],[30,18,14,22,0.16],[30,52,14,22,0.18],[30,86,14,22,0.15],[30,120,14,22,0.17],[56,18,14,22,0.14],[56,52,14,22,0.16],[56,86,14,22,0.17],[56,120,14,22,0.15],[82,18,14,22,0.16],[82,52,14,22,0.15],[82,86,14,22,0.18],[82,120,14,22,0.14]]}/>

    {/* MEGA TOWER */}
    <Bld x={598}  y={28}  w={132} h={492} ff="#102448" sf="#0a1a34" tf="#162d56" opacity={0.82}
      wins={[[8,16,20,22,0.14],[8,50,20,22,0.16],[8,84,20,22,0.15],[8,118,20,22,0.17],[8,152,20,22,0.14],[8,186,20,22,0.16],[8,220,20,22,0.15],[8,254,20,22,0.18],
             [36,16,20,22,0.15],[36,50,20,22,0.17],[36,84,20,22,0.16],[36,118,20,22,0.14],[36,152,20,22,0.15],[36,186,20,22,0.18],[36,220,20,22,0.16],[36,254,20,22,0.14],
             [64,16,20,22,0.16],[64,50,20,22,0.14],[64,84,20,22,0.17],[64,118,20,22,0.15],[64,152,20,22,0.16],[64,186,20,22,0.14],[64,220,20,22,0.17],[64,254,20,22,0.15],
             [100,16,20,22,0.14],[100,50,20,22,0.16],[100,84,20,22,0.15],[100,118,20,22,0.17],[100,152,20,22,0.16],[100,186,20,22,0.14],[100,220,20,22,0.18],[100,254,20,22,0.15]]}/>
    {/* Mega tower stepped crown */}
    <polygon points="598,28 730,28 742,20 610,20" fill="#142c56" opacity="0.82"/>
    <polygon points="610,20 742,20 752,10 622,10" fill="#102448" opacity="0.82"/>
    <polygon points="622,10 752,10 758,4  628,4"  fill="#0e2040" opacity="0.84"/>
    <line x1="665" y1="4" x2="665" y2="-18" stroke="#1c3462" strokeWidth="4"/>
    <circle cx="665" cy="-16" r="7" fill="url(#aGlow)" className="ant-b2"/>
    {/* Glass lines */}
    {[0,1,2,3,4,5].map(c=><line key={c} x1={602+c*28} y1="28" x2={602+c*28} y2="520" stroke="rgba(99,102,241,0.06)" strokeWidth="1"/>)}

    <Bld x={800}  y={158} w={100} h={362} ff="#0f2040" sf="#091530" tf="#142448" opacity={0.68}
      wins={[[6,18,14,26,0.15],[6,56,14,26,0.17],[6,94,14,26,0.16],[6,132,14,26,0.14],[6,170,14,26,0.16],[30,18,14,26,0.16],[30,56,14,26,0.14],[30,94,14,26,0.17],[30,132,14,26,0.15],[30,170,14,26,0.16],[58,18,14,26,0.15],[58,56,14,26,0.17],[58,94,14,26,0.14],[58,132,14,26,0.16],[58,170,14,26,0.15],[82,18,14,26,0.17],[82,56,14,26,0.15],[82,94,14,26,0.16],[82,132,14,26,0.14],[82,170,14,26,0.17]]}/>

    <Bld x={1052} y={125} w={114} h={395} ff="#0f2042" sf="#091530" tf="#14254a" opacity={0.72}
      wins={[[8,18,16,22,0.16],[8,52,16,22,0.14],[8,86,16,22,0.17],[8,120,16,22,0.15],[8,154,16,22,0.16],[36,18,16,22,0.15],[36,52,16,22,0.17],[36,86,16,22,0.14],[36,120,16,22,0.16],[36,154,16,22,0.17],[66,18,16,22,0.16],[66,52,16,22,0.15],[66,86,16,22,0.17],[66,120,16,22,0.14],[66,154,16,22,0.16],[92,18,16,22,0.15],[92,52,16,22,0.17],[92,86,16,22,0.16],[92,120,16,22,0.14],[92,154,16,22,0.17]]}/>
    <polygon points="1052,125 1166,125 1178,115 1064,115" fill="#14254a" opacity="0.72"/>
    <line x1="1110" y1="115" x2="1110" y2="95" stroke="#162e52" strokeWidth="2.5"/>
    <circle cx="1110" cy="93" r="4" fill="url(#aGlow)" className="ant-b"/>

    <Bld x={1292} y={142} w={118} h={378} ff="#0f2040" sf="#091428" tf="#142248" opacity={0.70}
      wins={[[8,18,16,22,0.15],[8,52,16,22,0.17],[8,86,16,22,0.16],[8,120,16,22,0.14],[8,154,16,22,0.17],[36,18,16,22,0.16],[36,52,16,22,0.14],[36,86,16,22,0.17],[36,120,16,22,0.15],[36,154,16,22,0.16],[66,18,16,22,0.17],[66,52,16,22,0.15],[66,86,16,22,0.16],[66,120,16,22,0.14],[66,154,16,22,0.17],[96,18,16,22,0.15],[96,52,16,22,0.17],[96,86,16,22,0.16],[96,120,16,22,0.14],[96,154,16,22,0.15]]}/>
    <polygon points="1292,142 1410,142 1422,132 1304,132" fill="#14254a" opacity="0.70"/>
    <line x1="1357" y1="132" x2="1357" y2="112" stroke="#1a3060" strokeWidth="3"/>
    <circle cx="1357" cy="110" r="5" fill="url(#aGlow)" className="ant-b2"/>

    {/* Road */}
    <rect x="0" y="498" width="1440" height="22" fill="#12182e" opacity="0.95"/>
    <line x1="0" y1="508" x2="1440" y2="508" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeDasharray="40 30"/>
    <rect x="0" y="496" width="1440" height="4" fill="rgba(56,189,248,0.08)"/>
  </svg>
);

/* ═════════════════════ VILLAGE SCENE ═════════════════════ */
const VillageScene = () => (
  <svg className="seg-svg" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax meet">
    <defs>
      <filter id="wGlw"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="hillG" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(28,82,28,0.7)"/><stop offset="100%" stopColor="rgba(14,45,14,0.85)"/>
      </linearGradient>
    </defs>

    {/* Rolling hills — multi-layer depth */}
    <ellipse cx="180"  cy="488" rx="330" ry="100" fill="url(#hillG)" opacity="0.65"/>
    <ellipse cx="580"  cy="492" rx="390" ry="85"  fill="url(#hillG)" opacity="0.6"/>
    <ellipse cx="980"  cy="486" rx="350" ry="95"  fill="url(#hillG)" opacity="0.65"/>
    <ellipse cx="1320" cy="490" rx="290" ry="82"  fill="url(#hillG)" opacity="0.58"/>
    {/* Far hills */}
    <ellipse cx="350"  cy="390" rx="460" ry="75"  fill="rgba(32,85,32,0.22)"/>
    <ellipse cx="900"  cy="382" rx="520" ry="70"  fill="rgba(32,85,32,0.18)"/>

    {/* Village road — worn dirt path */}
    <path d="M-20 520 C 180 505, 500 512, 720 508 S 1100 514, 1460 508"
      fill="none" stroke="#9b8060" strokeWidth="30" strokeLinecap="round" opacity="0.85"/>
    <path d="M-20 520 C 180 505, 500 512, 720 508 S 1100 514, 1460 508"
      fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" strokeLinecap="round" strokeDasharray="28 48"/>
    {/* Road edges — grass */}
    <rect x="0" y="500" width="1440" height="20" fill="rgba(30,70,20,0.28)"/>

    {/* Trees — layered, realistic */}
    {[55,168,312,468,680,850,1010,1175,1320,1405].map((x,i)=>(
      <Tree key={i} x={x} y={492} scale={0.7 + (i%3)*0.1}/>
    ))}
    {/* Closer trees */}
    {[120,390,620,870,1090,1260].map((x,i)=>(
      <Tree key={i} x={x} y={505} scale={0.85 + (i%2)*0.1}/>
    ))}

    {/* HOUSES — using realistic House component */}
    {/* House 1 */}
    <House x={80}  y={398} w={105} h={94}  roofColor="#7b3a10" wallColor="#d4b48c" darkWall="#b49070" chimneyX={130}/>
    {/* House 2 — smaller */}
    <House x={230} y={422} w={72}  h={78}  roofColor="#A0522D" wallColor="#cca882" darkWall="#a88a64" chimneyX={266}/>
    {/* House 3 — big farmhouse */}
    <House x={510} y={392} w={150} h={108} roofColor="#7B3F00" wallColor="#dac09a" darkWall="#b89a72" chimneyX={586} big/>
    {/* House 4 */}
    <House x={760} y={410} w={88}  h={90}  roofColor="#8B4513" wallColor="#ccaa84" darkWall="#aa8862" chimneyX={800}/>
    {/* House 5 — chapel */}
    <House x={970} y={384} w={68}  h={116} roofColor="#6B2D05" wallColor="#d0aa80" darkWall="#a8886a" chimneyX={1000} big/>
    {/* House 6 */}
    <House x={1175} y={408} w={95}  h={92}  roofColor="#7B3F00" wallColor="#caa880" darkWall="#a88862" chimneyX={1218}/>

    {/* Fireflies */}
    <circle cx="360" cy="348" r="2.5" fill="rgba(255,230,80,0.4)" className="firefly"/>
    <circle cx="748" cy="320" r="2"   fill="rgba(255,230,80,0.35)" className="firefly"/>
    <circle cx="1122" cy="338" r="2.5" fill="rgba(255,230,80,0.4)" className="firefly"/>
  </svg>
);

/* ═════════════════════ WORLD STRIP ═════════════════════ */
const WorldLandscape = () => (
  <div className="world-strip">
    <div className="seg seg-city1"><CityScene/></div>
    <div className="seg seg-village"><VillageScene/><div className="village-mist"/></div>
    <div className="seg seg-city2"><CityScene/></div>
  </div>
);

const Particles = () => (
  <div className="ptcl-wrap" aria-hidden="true">
    {[...Array(20)].map((_,i) => <div key={i} className={`ptcl ptcl-${i}`}/>)}
  </div>
);

/* ═════════════════════ APP ═════════════════════ */
function App() {
  const glowRef = useRef(null);
  useEffect(() => {
    let tx = window.innerWidth/2, ty = window.innerHeight/2, cx = tx, cy = ty, raf;
    const onMove = e => { tx = e.clientX; ty = e.clientY; };
    window.addEventListener("mousemove", onMove);
    const tick = () => {
      cx += (tx-cx)*0.07; cy += (ty-cy)*0.07;
      if (glowRef.current) { glowRef.current.style.left = cx+"px"; glowRef.current.style.top = cy+"px"; }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  const basename = process.env.PUBLIC_URL || '';

  return (
    <Router basename={basename}>
      <div className="cursor-glow" ref={glowRef}/>
      <div className="bg-canvas" aria-hidden="true">
        <Sky/>
        <WorldLandscape/>
        <Particles/>
        <div className="rider-journey">
          <div className="depth-track depth-far">
            <DeliveryRider cls="rider-far"/>
          </div>
          <div className="depth-track depth-near">
            <DeliveryRider cls="rider-near"/>
            <div className="rider-shadow"/>
            <div className="speed-lines">
              <div className="spline sl1"/><div className="spline sl2"/>
              <div className="spline sl3"/><div className="spline sl4"/>
            </div>
          </div>
        </div>
        <div className="ground-road"/>
      </div>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/register" element={<RegisterPage/>}/>
          <Route path="/select-plan" element={<SelectPlanPage/>}/>
          <Route path="/dashboard" element={<DashboardPage/>}/>
          <Route path="/admin" element={<AdminPage/>}/>
        </Routes>
      </div>
    </Router>
  );
}

export default App;