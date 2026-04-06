import api from './api';

function getLocalVessels() {
  try {
    const raw = localStorage.getItem('sipsip_vessels');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getVesselSettings() {
  try {
    const { data } = await api.get(`/vessels/settings`);
    // Unwrap: backend returns { success, vessels: { selectedGlass, selectedJar } }
    const serverData = data.vessels ?? data;

    // If server returns default (id:0) but localStorage has a non-default selection,
    // prefer localStorage — it reflects the user's last confirmed choice.
    const local = getLocalVessels();
    if (local && serverData) {
      const serverGlassId = serverData.selectedGlass?.id ?? 0;
      const serverJarId   = serverData.selectedJar?.id   ?? 0;
      const localGlassId  = local.selectedGlass?.id      ?? 0;
      const localJarId    = local.selectedJar?.id        ?? 0;

      // If server has defaults (id=0) but local has a real selection, trust local
      const useLocal =
        (serverGlassId === 0 && localGlassId !== 0) ||
        (serverJarId   === 0 && localJarId   !== 0);
      if (useLocal) return local;
    }

    return serverData;
  } catch (err) {
    // Fall back to localStorage for ANY error (401, 404, 500, network failure, proxy ECONNREFUSED, etc.)
    const local = getLocalVessels();
    if (local) return local;
    // For auth/not-found errors or network failures, return null silently — don't crash
    return null;
  }
}

export async function saveVesselSettings(selectedGlass, selectedJar) {
  try {
    localStorage.setItem('sipsip_vessels', JSON.stringify({ selectedGlass, selectedJar }));
  } catch (e) {
    // ignore
  }

  try {
    const { data } = await api.post(
      `/vessels/settings`,
      { selectedGlass, selectedJar }
    );
    // Unwrap: backend returns { success, vessels: { selectedGlass, selectedJar } }
    return data.vessels ?? data;
  } catch (err) {
    // Auth failure or network error — return values anyway so Redux still updates locally
    return { selectedGlass, selectedJar };
  }
}
