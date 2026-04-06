import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  selectSelectedGlassIdx,
  selectSelectedJarIdx,
} from '@/store/slices/collectionSlice';
import { scaleVesselPath, getGlassPath, getJarPath } from '@/utils/vessels.jsx';

const DEFAULT_G_MAX = 250;
const DEFAULT_J_MAX = 2000;

export default function WaterTracker({ pGroupRef, glassGrpRef, onPour, onGoalReached }) {
  const isDark  = useSelector(s => s.ui.theme) === 'dark';
  const { glassVol, jarVol, gMax, jMax } = useSelector(s => s.water);

  // ✅ Read selected vessel indices from Redux
  const glassIdx = useSelector(selectSelectedGlassIdx);
  const jarIdx   = useSelector(selectSelectedJarIdx);

  const G_MAX = gMax || DEFAULT_G_MAX;
  const J_MAX = jMax || DEFAULT_J_MAX;

  // ✅ Get the correct path strings from vessels.jsx
  const rawGlassPath = getGlassPath(glassIdx);
  const rawJarPath   = getJarPath(jarIdx);

  // ✅ Scale paths into the SVG coordinate space
  // Dashboard glass:  scaleVesselPath(p, 110, 280, 100, 160)
  // Dashboard jar:    scaleVesselPath(p, 270, 200, 160, 240)
  const glassPath = scaleVesselPath(rawGlassPath, 110, 280, 100, 160);
  const jarPath   = scaleVesselPath(rawJarPath,   270, 200, 160, 240);

  const svgRef     = useRef(null);
  const wavePhase  = useRef(0);
  const waveRaf    = useRef(null);
  const tickRaf    = useRef(null);
  const displayG   = useRef(0);
  const displayJ   = useRef(0);
  const gVolRef    = useRef(glassVol);
  const jVolRef    = useRef(jarVol);
  const gMaxRef    = useRef(G_MAX);
  const jMaxRef    = useRef(J_MAX);

  useEffect(() => { gVolRef.current = glassVol; }, [glassVol]);
  useEffect(() => { jVolRef.current = jarVol;   }, [jarVol]);
  useEffect(() => { gMaxRef.current = G_MAX;    }, [G_MAX]);
  useEffect(() => { jMaxRef.current = J_MAX;    }, [J_MAX]);

  // ── Wave + water rect loop ──
  useEffect(() => {
    function drawWave(backEl, frontEl, waterY, x0, x1, amplitude) {
      if (!backEl || !frontEl) return;
      if (waterY >= 440) { backEl.setAttribute('d',''); frontEl.setAttribute('d',''); return; }
      const w=x1-x0, a=amplitude, p=wavePhase.current;
      const b0=waterY+a*0.6*Math.sin(p), b1=waterY-a*0.8*Math.sin(p+1.2), b2=waterY+a*0.5*Math.sin(p+2.4);
      const back=`M ${x0} ${b0} C ${x0+w*0.2} ${b0-a*1.1}, ${x0+w*0.35} ${b1+a*0.9}, ${x0+w*0.5} ${b1} C ${x0+w*0.65} ${b1-a*0.8}, ${x0+w*0.8} ${b2+a}, ${x1} ${b2} L ${x1} 445 L ${x0} 445 Z`;
      const f0=waterY+a*0.3*Math.sin(p+0.8), f1=waterY-a*0.6*Math.sin(p+2.0), f2=waterY+a*0.4*Math.sin(p+3.2);
      const front=`M ${x0} ${f0} C ${x0+w*0.25} ${f0-a*1.3}, ${x0+w*0.45} ${f1+a*1.1}, ${x0+w*0.6} ${f1} C ${x0+w*0.75} ${f1-a*0.9}, ${x0+w*0.88} ${f2+a*0.7}, ${x1} ${f2} L ${x1} 445 L ${x0} 445 Z`;
      backEl.setAttribute('d', back);
      frontEl.setAttribute('d', front);
    }

    function waveLoop() {
      wavePhase.current += 0.04;
      const svg = svgRef.current;
      if (!svg) { waveRaf.current = requestAnimationFrame(waveLoop); return; }

      const gY = 440 - (gVolRef.current / gMaxRef.current) * 140;
      const jY = 440 - (jVolRef.current / jMaxRef.current) * 220;

      // ✅ Wave bounds now match scaled vessel positions
      drawWave(svg.querySelector('#gWave'), svg.querySelector('#gWaveFront'), gY, 110, 210, 7);
      drawWave(svg.querySelector('#jWave'), svg.querySelector('#jWaveFront'), jY, 270, 430, 9);

      const gh = (gVolRef.current / gMaxRef.current) * 140;
      const jh = (jVolRef.current / jMaxRef.current) * 220;
      const gW = svg.querySelector('#gWater');
      const jW = svg.querySelector('#jWater');
      if (gW) { gW.setAttribute('height', gh); gW.setAttribute('y', 440-gh); }
      if (jW) { jW.setAttribute('height', jh); jW.setAttribute('y', 440-jh); }

      waveRaf.current = requestAnimationFrame(waveLoop);
    }
    waveRaf.current = requestAnimationFrame(waveLoop);
    return () => cancelAnimationFrame(waveRaf.current);
  }, []);

  // ── Ticker ──
  useEffect(() => {
    function ticker() {
      const svg = svgRef.current;
      if (!svg) { tickRaf.current = requestAnimationFrame(ticker); return; }

      const tG = Math.floor(gVolRef.current);
      const tJ = Math.floor(jVolRef.current);
      const stepG = Math.max(1, Math.ceil(Math.abs(tG - displayG.current) / 4));
      const stepJ = Math.max(1, Math.ceil(Math.abs(tJ - displayJ.current) / 4));

      if (displayG.current < tG) displayG.current = Math.min(tG, displayG.current + stepG);
      else if (displayG.current > tG) displayG.current = Math.max(0, displayG.current - stepG);
      if (displayJ.current < tJ) displayJ.current = Math.min(tJ, displayJ.current + stepJ);
      else if (displayJ.current > tJ) displayJ.current = Math.max(0, displayJ.current - stepJ);

      const gTxt = svg.querySelector('#gTxt');
      const jTxt = svg.querySelector('#jTxt');
      if (gTxt) gTxt.textContent = `${displayG.current}ml`;
      if (jTxt) {
        const jMaxVal = jMaxRef.current;
        if (displayJ.current >= jMaxVal) {
          jTxt.innerHTML = `<tspan font-weight="800" fill="#3b82f6" font-size="15">${displayJ.current}ml</tspan><tspan fill="#aaa" font-weight="400" font-size="13"> / ${jMaxVal}ml</tspan>`;
        } else {
          jTxt.textContent = `${displayJ.current} / ${jMaxVal}ml`;
        }
      }
      tickRaf.current = requestAnimationFrame(ticker);
    }
    tickRaf.current = requestAnimationFrame(ticker);
    return () => cancelAnimationFrame(tickRaf.current);
  }, []);

  // ── Goal reached ──
  useEffect(() => {
    if (jarVol >= J_MAX && onGoalReached) onGoalReached();
  }, [jarVol]);

  // ── Expose pGroup ──
  useEffect(() => {
    if (pGroupRef && svgRef.current) {
      pGroupRef.current = svgRef.current.querySelector('#pGroup');
    }
  }, [pGroupRef]);

  const stroke = isDark ? 'rgba(255,255,255,0.6)' : '#2d2d2d';
  const label  = isDark ? '#6a7a94' : '#444';

  return (
    <svg ref={svgRef} viewBox="0 0 500 500"
         style={{ width:'100%', height:'100%', display:'block', outline:'none' }}>
      <defs>
        <filter id="goo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"/>
        </filter>
        {/* ✅ ClipPaths now use the dynamic scaled vessel paths */}
        <clipPath id="glassClip"><path d={glassPath}/></clipPath>
        <clipPath id="jarClip"><path d={jarPath}/></clipPath>
      </defs>

      <g id="pGroup" filter="url(#goo)" pointerEvents="none"/>

      {/* ✅ Glass — dynamic shape from vessels.jsx */}
      <g id="glassGroup" ref={glassGrpRef} style={{ cursor:'pointer' }} onPointerDown={onPour}>
        <rect id="gWater" x="110" y="440" width="100" height="0"
              fill="#3b82f6" opacity="0.9" clipPath="url(#glassClip)"/>
        <path id="gWave"      d="" fill="rgba(59,130,246,0.35)" clipPath="url(#glassClip)"/>
        <path id="gWaveFront" d="" fill="rgba(37,99,235,0.55)"  clipPath="url(#glassClip)"/>
        {/* ✅ Vessel outline uses dynamic path */}
        <path d={glassPath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
        <text x="160" y="475" id="gTxt" fill={label} fontSize="13" textAnchor="middle"
              fontWeight="600" fontFamily="DM Sans,sans-serif" pointerEvents="none">0ml</text>
      </g>

      {/* ✅ Jar — dynamic shape from vessels.jsx */}
      <g id="jarGroup">
        <rect id="jWater" x="270" y="440" width="160" height="0"
              fill="#3b82f6" opacity="0.9" clipPath="url(#jarClip)"/>
        <path id="jWave"      d="" fill="rgba(59,130,246,0.35)" clipPath="url(#jarClip)"/>
        <path id="jWaveFront" d="" fill="rgba(37,99,235,0.55)"  clipPath="url(#jarClip)"/>
        {/* ✅ Vessel outline uses dynamic path */}
        <path d={jarPath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
        <text x="350" y="475" id="jTxt" fill={label} fontSize="13" textAnchor="middle"
              fontWeight="600" fontFamily="DM Sans,sans-serif" pointerEvents="none">
          0 / {J_MAX}ml
        </text>
      </g>
    </svg>
  );
}