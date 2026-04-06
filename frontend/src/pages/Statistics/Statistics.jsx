import { useEffect, useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchBestDay, fetchSummary, fetchWeekly, fetchOverview, fetchDayLogs,
  navigatePrev, navigateNext, goToToday, setPeriod,
  openDayDetail, closeDayDetail,
  selectStatsPeriod, selectWeekStart, selectMonthView,
  selectYearView, selectBestDay, selectSummaryMap,
  selectSelectedDate, selectDayDetail, selectStatsLoading,
} from '../../store/slices/statsSlice';
import { selectProfile }        from '../../store/slices/profileSlice';
import { selectJMax }           from '../../store/slices/waterSlice';
import { selectJarVolume, selectSelectedJarIdx, fetchVesselSettings } from '../../store/slices/collectionSlice';
import { getJarPath, scaleVesselPath } from '@/utils/vessels.jsx';
import Navbar                   from '../../components/layout/Navbar/Navbar';
import MenuDrawer               from '../../components/layout/MenuDrawer/MenuDrawer';
import BackButton               from '../../components/layout/BackButton/BackButton';
import SEO                      from '../../components/SEO/SEO';
import styles                   from './Statistics.module.css';

// ─── Constants ──────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TODAY  = new Date(); TODAY.setHours(0,0,0,0);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sameDay(a, b) {
  if (!a || !b) return false;
  const da = a instanceof Date ? a : new Date(a + 'T00:00:00');
  const db = b instanceof Date ? b : new Date(b + 'T00:00:00');
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth()    === db.getMonth()    &&
         da.getDate()     === db.getDate();
}
function toDateObj(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  return new Date(v + 'T00:00:00');
}
function toISO(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function getMondayISO() {
  const d   = new Date(TODAY);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toISO(d);
}
function getMonthCells(year, month) {
  const first = new Date(year, month, 1);
  let off = first.getDay() - 1;
  if (off < 0) off = 6;
  const tot   = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((off + tot) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const dn = i - off + 1;
    return (dn >= 1 && dn <= tot) ? new Date(year, month, dn) : null;
  });
}
function formatNavLabel(period, weekStart, monthView, yearView) {
  if (period === 'weekly') {
    const ws = toDateObj(weekStart) || new Date(TODAY);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const fmt = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    return `${fmt(ws)} – ${fmt(we)}`;
  }
  if (period === 'monthly') return `${MONTHS[monthView.month]} ${monthView.year}`;
  return `${yearView}`;
}

// ─── Jar SVG ──────────────────────────────────────────────────────────────────

// CellJar — small calendar cell jar (viewBox 0 0 44 52)
// Uses the selected jar shape scaled to fit the cell bounding box
function CellJar({ pct, isToday, isFuture, uid, small, jarIdx }) {
  const W = 44, H = 52;
  const bx = 4, by = 4, bw = 36, bh = 44;

  const jf = isToday ? 'var(--jBodyT)' : 'var(--jBody)';
  const js = isToday ? 'var(--jStrokeT)' : 'var(--jStroke)';

  if (isFuture) {
    const rawPath = getJarPath(jarIdx ?? 0);
    const p       = scaleVesselPath(rawPath, bx, by, bw, bh);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} fill="none">
        <path d={p} stroke="var(--b)"
              strokeWidth=".9" strokeDasharray="3 2" opacity=".4"/>
      </svg>
    );
  }

  const rawPath = getJarPath(jarIdx ?? 0);
  const p       = scaleVesselPath(rawPath, bx, by, bw, bh);
  const wH      = bh * pct;
  const wY      = by + bh - wH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} fill="none" overflow="visible">
      <defs>
        <clipPath id={uid}><path d={p}/></clipPath>
      </defs>
      <path d={p} fill={jf} stroke={js} strokeWidth=".8"/>
      <g clipPath={`url(#${uid})`}>
        {pct > 0 && (
          <rect x={bx} y={wY} width={bw} height={wH + 1}
                fill="var(--blue)" opacity=".88"/>
        )}
        {pct > 0.1 && (
          <rect x={bx + 3} y={wY + 2} width={bw * 0.28}
                height={small ? 0.7 : 0.9} rx=".4" fill="var(--shimmer)"/>
        )}
      </g>
      <path d={p} fill="none" stroke="var(--bhi)" strokeWidth=".8"/>
    </svg>
  );
}

// DetailJar — day detail modal jar (110×150)
// Uses the exact chamfered-rectangle shape from Statistic.html reference
function detailJarPath(x, y, w, h, ch) {
  return `M${x+ch},${y} L${x+w-ch},${y} L${x+w},${y+ch} L${x+w},${y+h} L${x},${y+h} L${x},${y+ch} Z`;
}

function DetailJar({ ml, goal, jarIdx }) {
  const pct = Math.min(ml / goal, 1);
  const W = 110, H = 150;

  // Stats detail bounds (matches `scaleVesselPath` comment).
  const bx = 6, by = 8, bw = 98, bh = 136;

  // Use the user's selected jar shape for the modal jar.
  const rawPath = getJarPath(jarIdx ?? 0);
  const p = scaleVesselPath(rawPath, bx, by, bw, bh);

  // Stable IDs to avoid SVG defs flicker when selecting different days.
  const uid = `dj-${jarIdx ?? 0}-${Math.round(pct * 1000)}`;

  const wH = bh * pct;
  const wY = by + bh - wH;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <clipPath id={uid}><path d={p}/></clipPath>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--blue)" stopOpacity=".95"/>
          <stop offset="100%" stopColor="#2980b9" stopOpacity=".9"/>
        </linearGradient>
      </defs>

      <path d={p} fill="var(--jBody)" stroke="var(--jStroke)" strokeWidth="1.5"/>
      <g clipPath={`url(#${uid})`}>
        {pct > 0 && (
          <rect x={bx} y={wY} width={bw} height={wH + 3}
                fill={`url(#${uid}g)`} opacity=".93"/>
        )}
        {pct > 0.1 && (
          <rect x={bx + 10} y={wY + 5} width={bw * 0.25}
                height="2" rx="1" fill="rgba(255,255,255,.25)"/>
        )}
      </g>

      <path d={p} fill="none" stroke="var(--bhi)" strokeWidth="1.5"/>
      {pct > 0.15 && (
        <text x={W / 2} y={wY + Math.min(wH / 2 + 7, bh - 8)}
              textAnchor="middle" fontSize="13"
              fontFamily="DM Sans,sans-serif" fontWeight="700"
              fill="rgba(255,255,255,.92)">
          {Math.round(pct * 100)}%
        </text>
      )}
    </svg>
  );
}

// ─── Calendar Cell ────────────────────────────────────────────────────────────
function CalendarCell({ date, summaryMap, goal, small, onSelect, jarIdx }) {
  if (!date) {
    return (
      <div className={`${styles.cell} ${small?styles.sm:''} ${styles.fut}`}
           style={{ background:'var(--bg)' }}/>
    );
  }
  const iso      = toISO(date);
  const isToday  = sameDay(date, TODAY);
  const isFuture = date > TODAY;
  const summary  = summaryMap[iso];
  const ml       = isFuture ? 0 : (summary?.totalMl ?? 0);
  const dayGoal  = isFuture ? goal : (summary?.goalMl ?? goal);
  const pct      = isFuture ? 0 : (dayGoal > 0 ? Math.min(ml / dayGoal, 1) : 0);
  const uid      = `c${date.getTime()}`;

  const bgStyle = isToday
    ? 'linear-gradient(180deg,var(--todayG) 0%,var(--todayGm) 45%,var(--surface) 100%)'
    : isFuture ? 'var(--bg)' : 'var(--surface)';

  return (
    <div
      className={[
        styles.cell,
        small    && styles.sm,
        isToday  && styles.tod,
        isFuture && styles.fut,
      ].filter(Boolean).join(' ')}
      style={{ background: bgStyle }}
      onClick={() => onSelect(iso)}
    >
      <span className={[
        styles.cdn,
        small    && styles.cdnSm,
        isToday  && styles.cdnT,
        isFuture && styles.cdnF,
      ].filter(Boolean).join(' ')}>
        {date.getDate()}
      </span>
      <div className={styles.jw}>
        <CellJar pct={pct} isToday={isToday} isFuture={isFuture}
                 uid={uid} small={small} jarIdx={jarIdx}/>
        {!isFuture && (
          <span className={`${styles.jarLbl} ${small?styles.jarLblSm:''}`}>
            {ml > 0 ? `${Math.round(pct*100)}%` : '0%'}
          </span>
        )}
      </div>
    </div>
  );
}

function DayHeaders() {
  return (
    <div className={styles.dhRow}>
      {DAYS.map(d => <div key={d} className={styles.dh}>{d}</div>)}
    </div>
  );
}

function WeeklyGrid({ weekStart, summaryMap, goal, onSelect, jarIdx }) {
  const ws   = toDateObj(weekStart) || new Date(TODAY);
  const days = Array.from({ length:7 }, (_, i) => {
    const d = new Date(ws); d.setDate(d.getDate() + i); return d;
  });
  return (
    <div className={styles.gridWrap}>
      <DayHeaders/>
      <div className={styles.cells}>
        {days.map((d,i) => (
          <CalendarCell key={i} date={d} summaryMap={summaryMap}
                        goal={goal} small={false} onSelect={onSelect}
                        jarIdx={jarIdx}/>
        ))}
      </div>
    </div>
  );
}

function MonthlyGrid({ year, month, summaryMap, goal, onSelect, jarIdx }) {
  const cells = getMonthCells(year, month);
  return (
    <div className={styles.gridWrap}>
      <DayHeaders/>
      <div className={styles.cells}>
        {cells.map((d,i) => (
          <CalendarCell key={i} date={d} summaryMap={summaryMap}
                        goal={goal} small={false} onSelect={onSelect}
                        jarIdx={jarIdx}/>
        ))}
      </div>
    </div>
  );
}

function YearlyGrid({ year, summaryMap, goal, onSelect, jarIdx }) {
  return (
    <div className={styles.ygrid}>
      {MONTHS.map((mname,mi) => {
        const cells = getMonthCells(year, mi);
        return (
          <div key={mi} className={styles.mblk}>
            <p className={styles.mblkLbl}>{mname}</p>
            <div className={styles.gridWrap}>
              <DayHeaders/>
              <div className={styles.cells}>
                {cells.map((d,i) => (
                  <CalendarCell key={i} date={d} summaryMap={summaryMap}
                                goal={goal} small={true} onSelect={onSelect}
                                jarIdx={jarIdx}/>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function useConfetti(canvasRef, active) {
  const rafRef = useRef(null);
  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const cv  = canvasRef.current;
    const ctx = cv.getContext('2d');
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    const W = cv.width, H = cv.height;
    const C = ['#74b9ff','#a29bfe','#fd79a8','#ffeaa7','#55efc4',
               '#fdcb6e','#e17055','#00cec9','#ff7675','#6c5ce7','#81ecec','#fab1a0'];
    const S = ['rect','circle','ribbon','triangle'];
    const ps = Array.from({ length:120 }, (_,i) => {
      const a=Math.random()*Math.PI*2, sp=3+Math.random()*7, o=i%3;
      return { x:o===0?W*.2:o===1?W*.5:W*.8, y:H*.15,
               vx:Math.cos(a)*sp, vy:-7-Math.random()*7, g:.2+Math.random()*.1,
               col:C[~~(Math.random()*C.length)], sh:S[~~(Math.random()*S.length)],
               w:5+Math.random()*8, h:3+Math.random()*6,
               r:Math.random()*Math.PI*2, rv:(Math.random()-.5)*.22,
               al:1, dc:.010+Math.random()*.008,
               wb:Math.random()*Math.PI*2, ws:.04+Math.random()*.06 };
    });
    let fr=0;
    const draw = () => {
      ctx.clearRect(0,0,W,H); fr++;
      let alive=false;
      ps.forEach(p => {
        if(p.al<=0) return; alive=true;
        p.vy+=p.g; p.x+=p.vx+Math.sin(p.wb)*.8; p.y+=p.vy;
        p.r+=p.rv; p.wb+=p.ws; if(fr>40) p.al-=p.dc;
        ctx.save(); ctx.globalAlpha=Math.max(0,p.al);
        ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.fillStyle=p.col;
        if(p.sh==='rect')     ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        else if(p.sh==='circle')   { ctx.beginPath();ctx.arc(0,0,p.w/2,0,Math.PI*2);ctx.fill(); }
        else if(p.sh==='triangle') { ctx.beginPath();ctx.moveTo(0,-p.w/2);ctx.lineTo(p.w/2,p.w/2);ctx.lineTo(-p.w/2,p.w/2);ctx.closePath();ctx.fill(); }
        else ctx.fillRect(-p.w*2,-p.h*.4,p.w*4,p.h*.8);
        ctx.restore();
      });
      if(alive) rafRef.current=requestAnimationFrame(draw);
      else ctx.clearRect(0,0,W,H);
    };
    const t = setTimeout(()=>{ rafRef.current=requestAnimationFrame(draw); },320);
    return ()=>{ clearTimeout(t); if(rafRef.current) cancelAnimationFrame(rafRef.current); };
  },[active,canvasRef]);
}

// ─── Day Detail Modal ─────────────────────────────────────────────────────────
function DayDetailModal({ dateISO, dayDetail, summaryMap, goal, onClose, jarIdx }) {
  const canvasRef = useRef(null);
  const date      = toDateObj(dateISO);
  const isToday   = sameDay(date, TODAY);
  const isFuture  = date > TODAY;
  // Fallback to summaryMap so the modal jar reflects the selected calendar cell
  // immediately (even before fetchDayLogs finishes / if dayDetail is null).
  const summaryFromMap = summaryMap?.[dateISO] || {};
  const summary        = dayDetail || summaryFromMap;
  const ml        = isFuture ? 0 : (summary.totalMl ?? 0);
  // Use the backend-provided goal for this day (falls back to the UI goal).
  // This keeps jar fill/label pixel-consistent across different selected dates.
  const dayGoal   = isFuture ? goal : (summary.goalMl ?? goal);
  const pct       = dayGoal > 0 ? Math.min(ml / dayGoal, 1) : 0;
  const goalHit   = pct >= 1;
  const logs      = summary.logs || [];

  useConfetti(canvasRef, goalHit && !isFuture);

  const dl = date ? date.toLocaleDateString('en-US',
    { weekday:'long', month:'long', day:'numeric' }) : '';

  let cum = 0;

  return (
    <div className={`${styles.backdrop} ${styles.detailBd}`}
         onClick={e => e.target===e.currentTarget && onClose()}>
      <div className={styles.dsheet}>
        <canvas ref={canvasRef} id="cv"
                style={{ display: goalHit&&!isFuture?'block':'none',
                         position:'absolute', inset:0, width:'100%', height:'100%',
                         pointerEvents:'none', zIndex:10,
                         borderRadius:'24px 24px 0 0' }}/>
        <div className={styles.ddragRow}><div className={styles.ddrag}/></div>
        <div className={styles.dhdr}>
          <div>
            {isToday  && <><span className={`${styles.dtag} ${styles.dtagT}`}>Today</span><br/></>}
            {isFuture && <><span className={`${styles.dtag} ${styles.dtagF}`}>Upcoming</span><br/></>}
            <span className={styles.dlbl}>{dl}</span>
          </div>
          <button className={styles.dclose} onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor"
                    strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className={styles.dbody}>
          {goalHit && !isFuture && (
            <div className={styles.gbanner}>
              <div className={styles.gshimmer}/>
              <span style={{ fontSize:24, flexShrink:0 }}>🏆</span>
              <div style={{ flex:1 }}>
                <p className={styles.gtitle}>Goal Reached!</p>
                <p className={styles.gsub}>You crushed your hydration goal today</p>
              </div>
              <span className={styles.gpill}>
                <span className={styles.wstar} style={{ top:'-8px',left:'2px',fontSize:'10px',animationDelay:'.2s',animationName:'sPop,sw1' }}>★</span>
                <span className={styles.wstar} style={{ top:'-7px',left:'18px',fontSize:'8px',animationDelay:'.32s',animationName:'sPop,sw2' }}>★</span>
                <span className={styles.wstar} style={{ top:'-9px',right:'4px',fontSize:'11px',animationDelay:'.45s',animationName:'sPop,sw3' }}>★</span>
                <span className={styles.wstar} style={{ bottom:'-8px',left:'6px',fontSize:'8px',animationDelay:'.57s',animationName:'sPop,sw1' }}>★</span>
                <span className={styles.wstar} style={{ bottom:'-9px',right:'2px',fontSize:'9px',animationDelay:'.5s',animationName:'sPop,sw2' }}>★</span>
                <span className={styles.wstar} style={{ top:'-6px',right:'20px',fontSize:'7px',animationDelay:'.65s',animationName:'sPop,sw3' }}>★</span>
                Achieved
              </span>
            </div>
          )}
          <div className={styles.jcard}>
            <div style={{ flexShrink:0 }}>
              <DetailJar ml={ml} goal={dayGoal} jarIdx={jarIdx}/>
            </div>
            <div className={styles.jstats}>
              <div>
                <p className={styles.slbl}>Total consumed</p>
                <p className={styles.sbig}>
                  {isFuture ? '—'
                    : <>{(ml/1000).toFixed(2)}<span className={styles.su}>L</span></>}
                </p>
              </div>
              {!isFuture && (
                <div>
                  <div className={styles.pbarRow}>
                    <span>0</span>
                    <span>{(dayGoal/1000).toFixed(1)}L goal</span>
                  </div>
                  <div className={styles.ptrack}>
                    <div className={styles.pfill} style={{ width:`${pct*100}%` }}/>
                  </div>
                </div>
              )}
              {!isFuture && (
                <div className={styles.mstats}>
                  <div>
                    <p className={styles.mslbl}>Drinks</p>
                    <p className={styles.msval}>{logs.length || summary.sipCount || 0}</p>
                  </div>
                  <div>
                    <p className={styles.mslbl}>Goal</p>
                    <p className={`${styles.msval} ${goalHit?styles.msvalAch:''}`}>
                      {goalHit ? 'Achieved' : `${Math.round(pct*100)}%`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          {isFuture && (
            <div className={styles.fempty}>No data yet — this day is in the future</div>
          )}
          {!isFuture && logs.length > 0 && (
            <>
              <div className={styles.lhdr}>
                <span className={styles.llbl}>Drink log</span>
                <span className={styles.lcnt}>{logs.length} entries</span>
              </div>
              <div className={styles.llist}>
                {logs.map((entry,idx) => {
                  cum += entry.amount;
                      const cp = dayGoal > 0 ? Math.min(cum/dayGoal,1) : 0;
                  const fc = cp>=1?'var(--blue)':'rgba(116,185,255,.5)';
                  const ts = entry.at
                    ? new Date(entry.at).toLocaleTimeString('en-US',
                        { hour:'2-digit', minute:'2-digit', hour12:false })
                    : (typeof entry.timestamp === 'string' ? entry.timestamp : '—');
                  return (
                    <div key={idx} className={styles.lrow} style={{ animationDelay: `${idx * 45}ms` }}>
                      <span className={styles.ltime}>{ts}</span>
                      <div className={styles.ldiv}/>
                      <svg className={styles.logDrop} width="11" height="13" viewBox="0 0 12 14" fill="none">
                        <path d="M6 1C6 1 1 6.5 1 9a5 5 0 0010 0c0-2.5-5-8-5-8z"
                              fill="var(--blue)" opacity=".7"
                              stroke="var(--blue)" strokeWidth=".6"/>
                      </svg>
                      <span className={styles.lamt}>
                        {entry.amount}<span className={styles.lml}>ml</span>
                      </span>
                      <div className={styles.lcum}>
                        <span className={styles.lcuml}>{(cum/1000).toFixed(1)}L</span>
                        <div className={styles.lcumt}>
                          <div className={styles.lcumf}
                               style={{ width:`${cp*100}%`,background:fc }}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!isFuture && !logs.length && !summary.totalMl && (
            <div className={styles.fempty}>No drinks logged for this day</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Statistics Page ─────────────────────────────────────────────────────
export default function Statistics() {
  const dispatch     = useDispatch();
  const navigate     = useNavigate();

  // ═══ REVEAL ANIMATIONS ═══
  const [backShow, setBackShow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const period       = useSelector(selectStatsPeriod);
  const weekStart    = useSelector(selectWeekStart);
  const monthView    = useSelector(selectMonthView);
  const yearView     = useSelector(selectYearView);
  const bestDay      = useSelector(selectBestDay);
  const summaryMap   = useSelector(selectSummaryMap);
  const selectedDate = useSelector(selectSelectedDate);
  const dayDetail   = useSelector(selectDayDetail);
  const loading      = useSelector(selectStatsLoading);
  const profile      = useSelector(selectProfile);
  const jarVolume    = useSelector(selectJarVolume);
  const jarIdx       = useSelector(selectSelectedJarIdx);
  const jMax         = useSelector(selectJMax);
  const isDark       = useSelector(s => s.ui.theme === 'dark');
  const goal         = profile?.dailyGoal ?? jarVolume ?? jMax ?? 2000;

  useEffect(() => {
    if (isDark) document.body.classList.add('dark');
    else        document.body.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    const t = setTimeout(() => setBackShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    dispatch(fetchVesselSettings());
  }, [dispatch]);

  useEffect(() => {
    if (!weekStart) {
      dispatch({ type:'stats/setWeekStart', payload: getMondayISO() });
    }
  }, [weekStart, dispatch]);

  useEffect(() => {
    dispatch(fetchBestDay());
    dispatch(fetchSummary(365));
    dispatch(fetchOverview());
  }, [dispatch]);

  useEffect(() => {
    if (weekStart) dispatch(fetchWeekly(weekStart));
  }, [weekStart, dispatch]);

  useEffect(() => {
    if (selectedDate) dispatch(fetchDayLogs(selectedDate));
  }, [selectedDate, dispatch]);

  const handleSelect      = useCallback(iso => dispatch(openDayDetail(iso)), [dispatch]);
  const handleCloseDetail = useCallback(()  => dispatch(closeDayDetail()),   [dispatch]);

  const todayISO = toISO(TODAY);
  const allDates = Object.keys(summaryMap).filter(d => d <= todayISO);
  const mls      = allDates.map(d => summaryMap[d]?.totalMl ?? 0);
  const avg      = mls.length ? Math.round(mls.reduce((a,b)=>a+b,0)/mls.length) : 0;
  const hit      = mls.filter(v => v >= goal).length;
  const bestMl   = mls.length ? Math.max(...mls) : 0;
  const bdPct    = bestDay ? Math.min(bestDay.totalMl/goal,1) : 0;
  const navLabel = formatNavLabel(period, weekStart, monthView, yearView);

  return (
    <>
      <SEO
        title="Statistics"
        description="View your hydration history, weekly trends, and best days with detailed statistics."
        path="/statistics"
      />
      <Navbar animateIn={true} onMenuClick={() => setMenuOpen(true)} />
      <MenuDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div id="app" className={styles.app}>
        <div className={styles.wrap}>

          <BackButton revealed={backShow} delay={100} />

          <div className={`${styles.titleRow} ${styles.reveal}`}
               style={{ animationDelay:'0.15s' }}>
            <h1 className={styles.title}>Statistics</h1>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <span className={styles.titleSub}>
                {TODAY.toLocaleDateString('en-US',{ month:'long',year:'numeric' })}
              </span>
              <span className={styles.goalPill}>{(goal/1000).toFixed(1)}L</span>
            </div>
          </div>

          <div className={`${styles.bdc} ${styles.reveal}`}
               style={{ animationDelay:'0.2s' }}>
            {loading.bestDay ? (
              <div style={{ height:72, background:'var(--hi)', borderRadius:8 }}/>
            ) : bestDay ? (
              <>
                <div className={styles.bdcRow}>
                  <span className={styles.bdcLbl}>Best Day · Last 90 days</span>
                  <span className={styles.bdcPct}>{Math.round(bdPct*100)}%</span>
                </div>
                <div>
                  <span className={styles.bdcNum}>
                    {(bestDay.totalMl/1000).toFixed(2)}
                  </span>
                  <span className={styles.bdcU}>L</span>
                </div>
                <p className={styles.bdcDate}>
                  {toDateObj(bestDay.date)?.toLocaleDateString('en-US',
                    { weekday:'long',month:'long',day:'numeric' })}
                </p>
                <div className={styles.bdcTrack}>
                  <div className={styles.bdcFill} style={{ width:`${bdPct*100}%` }}/>
                </div>
              </>
            ) : (
              <p className={styles.bdcLbl}>No data yet — start tracking!</p>
            )}
          </div>

          <div className={`${styles.strip} ${styles.reveal}`}
               style={{ animationDelay:'0.25s' }}>
            {[
              { l:'Avg / day', v:`${(avg/1000).toFixed(1)}L`,   m:false },
              { l:'Goal hit',  v:`${hit}/${allDates.length}`,    m:true  },
              { l:'Best day',  v:`${(bestMl/1000).toFixed(1)}L`, m:false },
            ].map(it => (
              <div key={it.l} className={`${styles.chip} ${it.m?styles.chipM:''}`}>
                <div className={`${styles.chipV} ${it.m?styles.chipVM:''}`}>{it.v}</div>
                <div className={styles.chipL}>{it.l}</div>
              </div>
            ))}
          </div>

          <div className={`${styles.divider} ${styles.reveal}`}
               style={{ animationDelay:'0.3s' }}/>

          <div className={`${styles.tabs} ${styles.reveal}`}
               style={{ animationDelay:'0.35s' }}>
            {['weekly','monthly','yearly'].map(p => (
              <button key={p}
                      className={`${styles.tab} ${period===p?styles.tabOn:''}`}
                      onClick={() => dispatch(setPeriod(p))}
                      data-p={p}>
                {p.charAt(0).toUpperCase()+p.slice(1)}
              </button>
            ))}
          </div>

          <div className={`${styles.navRow} ${styles.reveal}`}
               style={{ animationDelay:'0.4s' }}>
            <button className={styles.navToday}
                    onClick={() => dispatch(goToToday())}>
              Today
            </button>
            <div className={styles.navC}>
              <button className={styles.navArr}
                      onClick={() => dispatch(navigatePrev())}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M8 2L3 6L8 10" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span className={styles.navLbl}>{navLabel}</span>
              <button className={styles.navArr}
                      onClick={() => dispatch(navigateNext())}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2L9 6L4 10" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.reveal} style={{ animationDelay:'0.45s' }}>
            {period==='weekly' && weekStart && (
              <WeeklyGrid weekStart={weekStart} summaryMap={summaryMap}
                          goal={goal} onSelect={handleSelect} jarIdx={jarIdx}/>
            )}
            {period==='monthly' && (
              <MonthlyGrid year={monthView.year} month={monthView.month}
                           summaryMap={summaryMap} goal={goal}
                           onSelect={handleSelect} jarIdx={jarIdx}/>
            )}
            {period==='yearly' && (
              <YearlyGrid year={yearView} summaryMap={summaryMap}
                           goal={goal} onSelect={handleSelect} jarIdx={jarIdx}/>
            )}
          </div>

          <div className={`${styles.gfooter} ${styles.reveal}`}
               style={{ animationDelay:'0.5s' }}>
            <span className={styles.ft}>
              Blue fill = water consumed · Goal {(goal/1000).toFixed(1)}L / day
            </span>
            <div className={styles.fl}>
              <div className={styles.fswatch}/>
              <span className={styles.ft}>Gradient top = today</span>
            </div>
          </div>

        </div>
        {selectedDate && (
          <DayDetailModal
            dateISO={selectedDate}
            dayDetail={dayDetail}
            summaryMap={summaryMap}
            goal={goal} onClose={handleCloseDetail} jarIdx={jarIdx}
          />
        )}
      </div>
    </>
  );
}
