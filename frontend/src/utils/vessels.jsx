// src/utils/vessels.jsx
// ─────────────────────────────────────────────────────────────────
// GLASSES[idx] / JARS[idx]  — JSX SVGs for Collection grid (60×90)
// GLASS_PATHS[idx] / JAR_PATHS[idx] — plain body path strings (60×90)
//   used by Dashboard + Statistics via scaleVesselPath()
//
// Shapes ported from water_system.html
//   18 glass shapes,  18 jar shapes
//
// DEFAULT indexes (also update in collectionSlice.js initialState):
//   selectedGlassIdx = 0  (Hex Facet)
//   selectedJarIdx   = 0  (Amphora)
//
// scaleVesselPath(path, targetX, targetY, targetW, targetH)
//   Scales any 60×90 path into any target bounding box.
//   Dashboard glass:  scaleVesselPath(p, 110, 280, 100, 160)
//   Dashboard jar:    scaleVesselPath(p, 270, 200, 160, 240)
//   Stats cell:       scaleVesselPath(p, 4,   4,   36,  44)
//   Stats detail:     scaleVesselPath(p, 6,   8,   98,  136)
// ─────────────────────────────────────────────────────────────────

const SRC_W = 60;
const SRC_H = 90;

export function fitPathToSourceBox(path, boxW = SRC_W, boxH = SRC_H) {
  const nums = [...path.matchAll(/-?\d*\.?\d+/g)].map(m => Number(m[0]));
  if (nums.length < 4) return path;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < nums.length - 1; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return path;

  let isX = true;
  return path.replace(/([MmLlQqCcAaZzTtSs])|(-?\d*\.?\d+)/g, (token, letter, num) => {
    if (letter) {
      isX = true;
      return letter;
    }
    const n = Number(num);
    const out = isX ? ((n - minX) * (boxW / w)) : ((n - minY) * (boxH / h));
    isX = !isX;
    return out.toFixed(2);
  });
}

export function scaleVesselPath(path, targetX, targetY, targetW, targetH) {
  const sx = targetW / SRC_W;
  const sy = targetH / SRC_H;
  let isX = true;
  let cmd  = '';
  return path.replace(/([MmLlQqCcAaZzTtSs])|(-?\d*\.?\d+)/g, (token, letter, num) => {
    if (letter) {
      cmd  = letter.toUpperCase();
      isX  = true;
      return letter;
    }
    const n      = parseFloat(num);
    const scaled = isX ? targetX + n * sx : targetY + n * sy;
    isX = !isX;
    return scaled.toFixed(2);
  });
}

// ── Body path strings (60×90 space) — 27 glass shapes ──────────
export const GLASS_PATHS = [
  'M9.1,8 L50.9,8 L53.1,30.2 L52,58.3 L45.4,82 L14.6,82 L8,58.3 L6.9,30.2 Z',      // 0  Hex Facet
  'M16.4,8 L43.6,8 L52,36.1 L52,61.3 L45.8,82 L14.2,82 L8,61.3 L8,36.1 Z',           // 1  Geo Cup
  'M9.1,8 L50.9,8 Q45.4,45 41.4,45 Q45.8,82 49.8,82 L10.2,82 Q14.2,82 18.6,45 Q14.6,45 9.1,8 Z', // 2  Lantern
  'M12,8 L48,8 Q53.8,45 48,82 L12,82 Q6.2,45 12,8 Z',                                  // 3  Barrel Top
  'M12.4,8 L47.6,8 L50.9,26.5 L50.9,59.8 L45,82 L15,82 L9.1,59.8 L9.1,26.5 Z',       // 4  Hex Tall
  'M6.9,8 L53.1,8 L43.6,82 L16.4,82 Z',                                                // 5  Wide Top
  'M18.6,8 L41.4,8 L52,41.3 L41.4,82 L18.6,82 L8,41.3 Z',                             // 6  Geo Diamond
  'M14.6,8 L45.4,8 Q42.8,24.3 42.8,24.3 Q52,50.9 43.2,82 L16.8,82 Q8,50.9 17.2,24.3 Q17.2,24.3 14.6,8 Z', // 7  Tulip
  'M10.6,8 L49.4,8 L49.4,82 L10.6,82 Z',                                               // 8  Highball
  'M9.1,8 L50.9,8 L52,68.7 Q43.6,82 38.2,82 L21.8,82 Q16.4,82 8,68.7 Z',             // 9  Tumbler
  'M15,8 Q4,46.5 17.9,82 L42.1,82 Q56,46.5 45,8 Z',                                    // 10 Balloon
  'M6.9,8 Q6.9,53.9 17.2,82 L42.8,82 Q53.1,53.9 53.1,8 Z',                            // 11 Snifter S
  'M14.2,8 L45.8,8 L42.8,82 L17.2,82 Z',                                               // 12 Slim Taper
  'M15.7,8 L44.3,8 L44.3,82 L15.7,82 Z',                                               // 13 Cylinder
  'M18.6,8 L41.4,8 Q44.3,52.4 49.4,82 L10.6,82 Q15.7,52.4 18.6,8 Z',                 // 14 Teardrop
  'M17.9,8 L42.1,8 L48,31.7 L50.9,52.4 L50.9,82 L9.1,82 L9.1,52.4 L12,31.7 Z',       // 15 Facet Pear
  'M16.8,8 L43.2,8 Q55.3,37.6 49.8,82 L10.2,82 Q4.7,37.6 16.8,8 Z',                   // 16 Bubble
  'M20.8,8 L39.2,8 L39.2,24.3 Q53.1,48.7 41.4,82 L18.6,82 Q6.9,48.7 20.8,24.3 Z',    // 17 Decanter
  'M7.6,8 L52.4,8 L47.2,82 L12.8,82 Z',                                                // 18 Rock Glass
  'M8,8 L52,8 Q40.2,43.5 39.2,43.5 Q47.4,82 49.4,82 L10.6,82 Q12.6,82 20.8,43.5 Q19.8,43.5 8,8 Z', // 19 Hourglass
  'M6.2,8 Q7.4,48.7 20.1,82 L39.9,82 Q52.6,48.7 53.8,8 Z',                            // 20 Snifter
  'M8,8 L52,8 L47.6,82 L12.4,82 Z',                                                    // 21 Trapeze
  'M14.6,8 L45.4,8 L53.1,50.9 L52,74.6 L41.4,82 L18.6,82 L8,74.6 L6.9,50.9 Z',       // 22 Diamond Base
  'M16.8,8 L43.2,8 Q47.2,45 42.1,82 L17.9,82 Q12.8,45 16.8,8 Z',                      // 23 Slim Facet
  'M12,8 L48,8 L50.9,73.1 L45.8,82 L14.2,82 L9.1,73.1 Z',                             // 24 Wide Facet
  'M11.3,8 L48.7,8 L48.7,73.1 L44.3,82 L15.7,82 L11.3,73.1 Z',                        // 25 Barrel Base
  'M10.6,8 L49.4,8 L40.6,39.1 L48,70.9 L43.2,82 L16.8,82 L12,70.9 L19.4,39.1 Z',     // 26 Geo Vase
];

// ── Body path strings (60×90 space) — 39 jar shapes ────────────
export const JAR_PATHS = [
  'M28.8,5 L41.2,5 L41.2,18.9 Q57,26.6 57,49.7 Q55.9,82 48.6,82 L21.4,82 Q14.1,82 13,49.7 Q13,26.6 28.8,18.9 Z',  // 0  Amphora
  'M30.2,5 L39.8,5 L39.8,21.9 L57,45 L50.8,82 L19.2,82 L13,45 L30.2,21.9 Z',          // 1  Decanter
  'M28.4,5 L41.6,5 L41.6,20.4 Q57.4,29.6 57,47.4 Q54.4,82 50,82 L20,82 Q15.6,82 13,47.4 Q12.6,29.6 28.4,20.4 Z', // 2  Jug Slim
  'M28,5 L42,5 L42,18.9 Q58.1,28.1 57.4,45 Q55.9,82 52.2,82 L17.8,82 Q14.1,82 12.6,45 Q11.9,28.1 28,18.9 Z', // 3  Wide Jug
  'M28.8,5 L41.2,5 L41.2,20.4 L57,29.6 L57,52.7 L50.8,82 L19.2,82 L13,52.7 L13,29.6 L28.8,20.4 Z', // 4  Geo Bottle
  'M28.4,5 L41.6,5 L41.6,17.3 L48.2,21.9 L48.2,82 L21.8,82 L21.8,21.9 L28.4,17.3 Z', // 5  Tall Bottle
  'M28,5 L42,5 L42,18.9 L53,23.5 L53,82 L17,82 L17,23.5 L28,18.9 Z',                  // 6  Square Jug
  'M29.5,5 L40.5,5 L40.5,21.9 Q57,31.9 57,51.2 Q55.2,82 50.4,82 L19.6,82 Q14.8,82 13,51.2 Q13,31.9 29.5,21.9 Z', // 7  Classic Jug
  'M28.8,5 L41.2,5 L41.2,20.4 Q59.2,42 49.3,82 L20.7,82 Q10.8,42 28.8,20.4 Z',        // 8  Fat Belly
  'M28.4,5 L41.6,5 L41.6,20.4 L57,43.5 L47.1,82 L22.9,82 L13,43.5 L28.4,20.4 Z',     // 9  Diamond Jug
  'M28,5 L42,5 L42,17.3 Q58.1,45 50.4,82 L19.6,82 Q11.9,45 28,17.3 Z',                // 10 Oval Flask
  'M29.3,5 L40.7,5 L40.7,26.6 Q58.8,47.4 52.2,82 L17.8,82 Q11.2,47.4 29.3,26.6 Z',   // 11 Teardrop Jug
  'M27.3,5 L42.7,5 L42.7,17.3 Q54.4,23.5 54.4,82 L15.6,82 Q15.6,23.5 27.3,17.3 Z',   // 12 Pitcher
  'M28.8,5 L41.2,5 L41.2,18.9 Q49.3,47.4 48.6,82 L21.4,82 Q20.7,47.4 28.8,18.9 Z',   // 13 Slim Vase
  'M29.3,5 L40.7,5 L40.7,17.3 Q59.6,39.6 50,82 L20,82 Q10.4,39.6 29.3,17.3 Z',       // 14 Bubble Jug
  'M28.4,5 L41.6,5 L41.6,18.9 L57,31.9 L57,55.1 L49.3,82 L20.7,82 L13,55.1 L13,31.9 L28.4,18.9 Z', // 15 Facet Vase
  'M28.8,5 L41.2,5 L41.2,18.9 L54.8,28.1 L57,45 L54.8,58.9 L48.6,82 L21.4,82 L15.2,58.9 L13,45 L15.2,28.1 L28.8,18.9 Z', // 16 Hex Vase
  'M28,5 L42,5 L42,15.8 L50.8,20.4 L50.8,82 L19.2,82 L19.2,20.4 L28,15.8 Z',          // 17 Milk Bottle
  'M28.8,5 L41.2,5 L41.2,17.3 L57,26.6 L57,57.4 L51.5,82 L18.5,82 L13,57.4 L13,26.6 L28.8,17.3 Z', // 18 Facet Bottle
  'M28.4,5 L41.6,5 L41.6,18.9 Q58.3,43.5 50.8,82 L19.2,82 Q11.7,43.5 28.4,18.9 Z',   // 19 Round Jug
  'M28.4,5 L41.6,5 L41.6,17.3 Q57,31.9 50.8,45 Q57,58.9 49.3,82 L20.7,82 Q13,58.9 19.2,45 Q13,31.9 28.4,17.3 Z', // 20 Waist Bottle
  'M28,5 L42,5 L42,18.9 Q58.1,43.5 52.2,82 L17.8,82 Q11.9,43.5 28,18.9 Z',            // 21 Oval Jug
  'M28.8,5 L41.2,5 L41.2,18.9 Q47.4,47.4 46.4,82 L23.6,82 Q22.6,47.4 28.8,18.9 Z',   // 22 Flask Tall
  'M27.3,5 L42.7,5 L42.7,14.2 L50,17.3 L50,82 L20,82 L20,17.3 L27.3,14.2 Z',          // 23 Straight Bottle
  'M27.3,5 L42.7,5 L42.7,15.8 L54.4,19.6 L54.4,82 L15.6,82 L15.6,19.6 L27.3,15.8 Z', // 24 Wide Pitcher
  'M28,5 L42,5 L42,17.3 L52.6,23.5 L52.6,82 L17.4,82 L17.4,23.5 L28,17.3 Z',          // 25 Handle Jug
  'M28.4,5 L41.6,5 L41.6,15.8 L55.2,20.4 L55.2,82 L14.8,82 L14.8,20.4 L28.4,15.8 Z', // 26 Wide Handle
  'M30.2,5 L39.8,5 L39.8,28.1 Q57,35.8 57,49.7 Q55.2,82 50.8,82 L19.2,82 Q14.8,82 13,49.7 Q13,35.8 30.2,28.1 Z', // 27 Handled Flask
  'M28.4,5 L41.6,5 L41.6,15.8 L47.8,19.6 L47.8,82 L22.2,82 L22.2,19.6 L28.4,15.8 Z', // 28 Slim Flask
  'M28.8,5 L41.2,5 L41.2,20.4 Q57.4,45 48.2,82 L21.8,82 Q12.6,45 28.8,20.4 Z',       // 29 Egg Flask
  'M28,5 L42,5 L42,15.8 L53.7,19.6 L47.1,82 L22.9,82 L16.3,19.6 L28,15.8 Z',          // 30 Taper Jug
  'M29.7,5 L40.3,5 L40.3,24.3 Q48.9,49.7 48.2,82 L21.8,82 Q21.1,49.7 29.7,24.3 Z',   // 31 Carafe
  'M28.8,5 L41.2,5 L41.2,18.9 Q44.2,42 46.4,82 L23.6,82 Q25.8,42 28.8,18.9 Z',       // 32 Skinny Bottle
  'M28.4,5 L41.6,5 L41.6,17.3 Q53.7,23.5 53.7,82 L16.3,82 Q16.3,23.5 28.4,17.3 Z',   // 33 Squat Jug
  'M29.3,5 L40.7,5 L40.7,20.4 L49.3,25 L49.3,82 L20.7,82 L20.7,25 L29.3,20.4 Z',     // 34 Tall Handle
  'M28.4,5 L41.6,5 L41.6,18.9 Q52.6,28.1 52.6,82 L17.4,82 Q17.4,28.1 28.4,18.9 Z',   // 35 Syrup Bottle
  'M27.3,5 L42.7,5 L42.7,17.3 L57,26.6 Q57.4,47.4 52.2,82 L17.8,82 Q12.6,47.4 13,26.6 L27.3,17.3 Z', // 36 Double Handle
  'M28,5 L42,5 L42,15 L51.5,17.3 L51.5,82 L18.5,82 L18.5,17.3 L28,15 Z',              // 37 Rect Bottle
  'M30.2,5 L39.8,5 L39.8,21.9 Q47.8,29.6 47.8,51.2 Q47.1,82 45.2,82 L24.8,82 Q22.9,82 22.2,51.2 Q22.2,29.6 30.2,21.9 Z', // 38 Slim Carafe
];

export function getGlassPath(idx) { return GLASS_PATHS[idx] ?? GLASS_PATHS[0]; }
export function getJarPath(idx)   { return JAR_PATHS[idx]   ?? JAR_PATHS[0];   }

// ─── Collection grid JSX SVGs (60×90) ────────────────────────────
// Each glass entry uses its body path with a subtle fill + stroke outline
export const GLASSES = [
  { id: 0,  name: 'Hex Facet',     svg: <><path d={GLASS_PATHS[0]} fill="rgba(116,185,255,.10)"/></> },
  { id: 1,  name: 'Geo Cup',       svg: <><path d={GLASS_PATHS[1]} fill="rgba(116,185,255,.10)"/></> },
  { id: 2,  name: 'Lantern',       svg: <><path d={GLASS_PATHS[2]} fill="rgba(116,185,255,.10)"/></> },
  { id: 3,  name: 'Barrel Top',    svg: <><path d={GLASS_PATHS[3]} fill="rgba(116,185,255,.10)"/></> },
  { id: 4,  name: 'Hex Tall',      svg: <><path d={GLASS_PATHS[4]} fill="rgba(116,185,255,.10)"/></> },
  { id: 5,  name: 'Wide Top',      svg: <><path d={GLASS_PATHS[5]} fill="rgba(116,185,255,.10)"/></> },
  { id: 6,  name: 'Geo Diamond',   svg: <><path d={GLASS_PATHS[6]} fill="rgba(116,185,255,.10)"/></> },
  { id: 7,  name: 'Tulip',         svg: <><path d={GLASS_PATHS[7]} fill="rgba(116,185,255,.10)"/></> },
  { id: 8,  name: 'Highball',      svg: <><path d={GLASS_PATHS[8]} fill="rgba(116,185,255,.10)"/></> },
  { id: 9,  name: 'Tumbler',       svg: <><path d={GLASS_PATHS[9]} fill="rgba(116,185,255,.10)"/></> },
  { id: 10, name: 'Balloon',       svg: <><path d={GLASS_PATHS[10]} fill="rgba(116,185,255,.10)"/></> },
  { id: 11, name: 'Snifter S',     svg: <><path d={GLASS_PATHS[11]} fill="rgba(116,185,255,.10)"/></> },
  { id: 12, name: 'Slim Taper',    svg: <><path d={GLASS_PATHS[12]} fill="rgba(116,185,255,.10)"/></> },
  { id: 13, name: 'Cylinder',      svg: <><path d={GLASS_PATHS[13]} fill="rgba(116,185,255,.10)"/></> },
  { id: 14, name: 'Teardrop',      svg: <><path d={GLASS_PATHS[14]} fill="rgba(116,185,255,.10)"/></> },
  { id: 15, name: 'Facet Pear',    svg: <><path d={GLASS_PATHS[15]} fill="rgba(116,185,255,.10)"/></> },
  { id: 16, name: 'Bubble',        svg: <><path d={GLASS_PATHS[16]} fill="rgba(116,185,255,.10)"/></> },
  { id: 17, name: 'Decanter',      svg: <><path d={GLASS_PATHS[17]} fill="rgba(116,185,255,.10)"/></> },
];

// Each jar entry uses its body path with a subtle fill + neck cap rectangle
export const JARS = [
  { id: 0,  name: 'Amphora',        svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[0]} fill="rgba(116,185,255,.10)"/></> },
  { id: 1,  name: 'Decanter',       svg: <><rect x="31" y="1" width="8" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[1]} fill="rgba(116,185,255,.10)"/></> },
  { id: 2,  name: 'Jug Slim',       svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[2]} fill="rgba(116,185,255,.10)"/></> },
  { id: 3,  name: 'Wide Jug',       svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[3]} fill="rgba(116,185,255,.10)"/></> },
  { id: 4,  name: 'Geo Bottle',     svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[4]} fill="rgba(116,185,255,.10)"/></> },
  { id: 5,  name: 'Tall Bottle',    svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[5]} fill="rgba(116,185,255,.10)"/></> },
  { id: 6,  name: 'Square Jug',     svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[6]} fill="rgba(116,185,255,.10)"/></> },
  { id: 7,  name: 'Classic Jug',    svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[7]} fill="rgba(116,185,255,.10)"/></> },
  { id: 8,  name: 'Fat Belly',      svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[8]} fill="rgba(116,185,255,.10)"/></> },
  { id: 9,  name: 'Diamond Jug',    svg: <><rect x="31" y="1" width="8" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[9]} fill="rgba(116,185,255,.10)"/></> },
  { id: 10, name: 'Oval Flask',     svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[10]} fill="rgba(116,185,255,.10)"/></> },
  { id: 11, name: 'Teardrop Jug',   svg: <><rect x="31" y="1" width="8" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[11]} fill="rgba(116,185,255,.10)"/></> },
  { id: 12, name: 'Pitcher',        svg: <><rect x="29" y="1" width="12" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[12]} fill="rgba(116,185,255,.10)"/></> },
  { id: 13, name: 'Slim Vase',      svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[13]} fill="rgba(116,185,255,.10)"/></> },
  { id: 14, name: 'Bubble Jug',     svg: <><rect x="31" y="1" width="8" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[14]} fill="rgba(116,185,255,.10)"/></> },
  { id: 15, name: 'Facet Vase',     svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[15]} fill="rgba(116,185,255,.10)"/></> },
  { id: 16, name: 'Hex Vase',       svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[16]} fill="rgba(116,185,255,.10)"/></> },
  { id: 17, name: 'Milk Bottle',    svg: <><rect x="30" y="1" width="10" height="4" rx="1.5" fill="none"/><path d={JAR_PATHS[17]} fill="rgba(116,185,255,.10)"/></> },
];
