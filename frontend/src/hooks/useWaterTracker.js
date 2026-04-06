import { useRef, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addToGlass, pourToJar, setVesselCapacities } from '@/store/slices/waterSlice';
import {
  selectGlassVolume,
  selectJarVolume,
  selectSelectedGlassIdx,
  selectSelectedJarIdx,
  GLASSES,
  JARS,
} from '@/store/slices/collectionSlice';
import { logSip } from '@/services/waterService';

export default function useWaterTracker() {
  const dispatch  = useDispatch();
  const { glassVol, jarVol, gMax, jMax } = useSelector(s => s.water);
  const glassIdx    = useSelector(selectSelectedGlassIdx);
  const jarIdx      = useSelector(selectSelectedJarIdx);
  const glassVolume = useSelector(selectGlassVolume);
  const jarVolume   = useSelector(selectJarVolume);

  // ✅ THE FIX — sync collection vessel volumes into waterSlice whenever they change
  useEffect(() => {
    dispatch(setVesselCapacities({ gMax: glassVolume, jMax: jarVolume }));
  }, [glassVolume, jarVolume, dispatch]);

  const fillRafRef = useRef(null);
  const holdTimer  = useRef(null);
  const isFilling  = useRef(false);

  const HOLD_THRESHOLD = 180;
  const HOLD_RATE      = 1.8;

  const startFill = useCallback((e) => {
    e?.preventDefault();
    if (glassVol >= gMax) return; // ✅ dynamic gMax instead of hardcoded 250
    isFilling.current = true;

    holdTimer.current = setTimeout(() => {
      function flowLoop() {
        if (!isFilling.current) return;
        dispatch(addToGlass(HOLD_RATE));
        fillRafRef.current = requestAnimationFrame(flowLoop);
      }
      fillRafRef.current = requestAnimationFrame(flowLoop);
    }, HOLD_THRESHOLD);
  }, [glassVol, gMax, dispatch]); // ✅ gMax added to deps

  const stopFill = useCallback(() => {
    if (!isFilling.current) return;

    // Single tap
    if (fillRafRef.current === null && holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      dispatch(addToGlass(1));
    }

    // Stop hold flow
    if (fillRafRef.current !== null) {
      cancelAnimationFrame(fillRafRef.current);
      fillRafRef.current = null;
    }
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    isFilling.current = false;
  }, [dispatch]);

  const pourGlassToJar = useCallback(async () => {
    if (glassVol < 10) return;

    const amount = Math.floor(glassVol);
    const gDef = GLASSES[glassIdx] || GLASSES[0];
    const jDef = JARS[jarIdx]      || JARS[0];
    const glassSnap = { id: gDef.id, name: gDef.label, volumeMl: glassVolume };
    const jarSnap   = { id: jDef.id, name: jDef.label, volumeMl: jarVolume };

    // Optimistic update
    dispatch(pourToJar({
      amount,
      sipData: {
        amount,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit'
        }),
      }
    }));

    // Save to backend
    try {
      await logSip(amount, glassSnap, jarSnap);
    } catch (err) {
      console.error('Failed to log sip:', err);
    }
  }, [glassVol, glassIdx, jarIdx, glassVolume, jarVolume, dispatch]);

  return { startFill, stopFill, pourGlassToJar };
}