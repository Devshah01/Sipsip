import { useEffect, useRef } from 'react';
import { useSelector }       from 'react-redux';
import styles                from './ActivityCard.module.css';

const NS      = 'http://www.w3.org/2000/svg';
const SVG_W   = 500;
const SVG_H   = 500;
const PADDING = 10;
const Y_START = 66;

const PALETTES = {
  light: [
    { fill: '#dbeeff', stroke: '#93c5fd', text: '#2563eb' },
    { fill: '#e0f2fe', stroke: '#7dd3fc', text: '#0369a1' },
    { fill: '#eff6ff', stroke: '#bfdbfe', text: '#3b82f6' },
  ],
  dark: [
    { fill: '#1e3a5f', stroke: '#3b82f6', text: '#93c5fd' },
    { fill: '#172d4a', stroke: '#2563eb', text: '#7dd3fc' },
    { fill: '#1a3350', stroke: '#60a5fa', text: '#bfdbfe' },
  ],
};

function volToRadius(vol) {
  const MIN_R = 22, MAX_R = 56, MAX_V = 250;
  const c = Math.min(Math.max(vol, 10), MAX_V);
  return MIN_R + ((c - 10) / (MAX_V - 10)) * (MAX_R - MIN_R);
}

export default function ActivityCard() {
  const svgRef   = useRef(null);
  const sipsRef  = useRef([]);

  const sips  = useSelector(s => s.water.sips);
  const isDark = useSelector(s => s.ui.theme) === 'dark';

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clear existing bubbles
    const bubblesGroup = svg.querySelector('#bubblesGroup');
    const emptyState   = svg.querySelector('#emptyState');
    if (!bubblesGroup) return;

    // Only add new sips
    const existingCount = sipsRef.current.length;
    const newSips       = sips.slice(existingCount);
    sipsRef.current     = sips;

    if (sips.length === 0) {
      bubblesGroup.innerHTML = '';
      if (emptyState) emptyState.setAttribute('display', 'block');
      return;
    }

    if (emptyState) emptyState.setAttribute('display', 'none');

    newSips.forEach(sip => {
      const r   = volToRadius(sip.amount);
      const pos = placeBubble(r, sipsRef.current.slice(0, -1));
      if (!pos) return;

      const pal = PALETTES[isDark ? 'dark' : 'light'][
        Math.floor(Math.random() * 3)
      ];

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('style', 'opacity:0');

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', pal.fill);
      circle.setAttribute('stroke', pal.stroke);
      circle.setAttribute('stroke-width', '1.5');
      g.appendChild(circle);

      const volText = document.createElementNS(NS, 'text');
      volText.setAttribute('x', pos.x);
      volText.setAttribute('y', pos.y + 5);
      volText.setAttribute('text-anchor', 'middle');
      volText.setAttribute('font-family', 'DM Sans,sans-serif');
      volText.setAttribute('font-size', Math.max(12, r * 0.42));
      volText.setAttribute('font-weight', '600');
      volText.setAttribute('fill', pal.text);
      volText.setAttribute('pointer-events', 'none');
      volText.textContent = `${sip.amount}ml`;
      g.appendChild(volText);

      const timeText = document.createElementNS(NS, 'text');
      timeText.setAttribute('x', pos.x);
      timeText.setAttribute('y', pos.y + r + 18);
      timeText.setAttribute('text-anchor', 'middle');
      timeText.setAttribute('font-family', 'DM Sans,sans-serif');
      timeText.setAttribute('font-size', '12');
      timeText.setAttribute('fill', isDark ? '#4a5a7a' : '#999');
      timeText.setAttribute('pointer-events', 'none');
      timeText.textContent = sip.timestamp || '';
      g.appendChild(timeText);

      bubblesGroup.appendChild(g);

      // Pop-in animation
      let sc = 0;
      function popIn() {
        sc += 0.07;
        if (sc >= 1) { g.setAttribute('style', 'opacity:1'); return; }
        g.setAttribute('style',
          `opacity:${sc};transform-origin:${pos.x}px ${pos.y}px;transform:scale(${sc})`
        );
        requestAnimationFrame(popIn);
      }
      requestAnimationFrame(popIn);
    });

  }, [sips, isDark]);

  function placeBubble(r, existing) {
    const mg = 14;
    const yMin = Y_START + r + mg, yMax = SVG_H - r - mg;
    const xMin = mg + r,           xMax = SVG_W - mg - r;

    for (let i = 0; i < 300; i++) {
      const x = xMin + Math.random() * (xMax - xMin);
      const y = yMin + Math.random() * (yMax - yMin);
      let ok = true;
      for (const s of existing) {
        const sr = volToRadius(s.amount);
        if (Math.hypot(x - (s.x || 250), y - (s.y || 250)) < r + sr + PADDING) {
          ok = false; break;
        }
      }
      if (ok) return { x, y };
    }
    return null;
  }

  const sipCount = sips.length;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 500 500"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <filter id="bubbleShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="4"
            floodColor="#a0bcd8" floodOpacity="0.3"/>
        </filter>
      </defs>

      <text x="36" y="44"
        fontFamily="DM Sans,sans-serif" fontSize="21" fontWeight="600"
        fill={isDark ? '#e8ecf4' : '#1a1a1a'}>
        Activity
      </text>
      <text x="464" y="44" textAnchor="end"
        fontFamily="DM Sans,sans-serif" fontSize="15"
        fill={isDark ? '#3d4560' : '#bbb'}>
        {sipCount} Sip{sipCount !== 1 ? 's' : ''}
      </text>
      <line x1="36" y1="58" x2="464" y2="58"
        stroke={isDark ? '#262b3d' : '#eee'} strokeWidth="1"/>

      <g id="emptyState">
        <text x="250" y="290" textAnchor="middle"
          fontFamily="DM Sans,sans-serif" fontSize="17"
          fill={isDark ? '#2a3450' : '#ccc'}>
          Take a sip 💧
        </text>
      </g>

      <g id="bubblesGroup"/>
    </svg>
  );
}