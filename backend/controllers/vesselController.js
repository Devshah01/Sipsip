const VesselSettings = require('../models/VesselSettings');

function normalizeVessel(input, fallbackName, fallbackVolume) {
  if (!input || typeof input !== 'object') return null;
  const id = Number(input.id);
  const volumeMl = Number(input.volumeMl);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!Number.isFinite(id) || id < 0) return null;
  if (!Number.isFinite(volumeMl) || volumeMl <= 0) return null;
  return {
    id,
    name: name || fallbackName,
    volumeMl,
  };
}

// ─────────────────────────────────────
// @route  GET /api/vessels/settings
// @access Private
// ─────────────────────────────────────
const getVesselSettings = async (req, res, next) => {
  try {
    const userId = req.user._id;

    let settings = await VesselSettings.findOne({ userId });

    // Create defaults if not exists
    if (!settings) {
      settings = await VesselSettings.create({ userId });
    }

    res.status(200).json({
      success: true,
      vessels: {
        selectedGlass: settings.selectedGlass,
        selectedJar:   settings.selectedJar,
      }
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route  POST /api/vessels/settings
// @access Private
// ─────────────────────────────────────
const saveVesselSettings = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { selectedGlass, selectedJar } = req.body;
    const glass = normalizeVessel(selectedGlass, 'Hex Facet', 250);
    const jar   = normalizeVessel(selectedJar, 'Amphora', 2000);

    if (!glass || !jar) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vessel payload. Expected { id, name, volumeMl } for both selectedGlass and selectedJar.',
      });
    }

    const settings = await VesselSettings.findOneAndUpdate(
      { userId },
      { selectedGlass: glass, selectedJar: jar },
      { returnDocument: 'after', upsert: true }
    );

    res.status(200).json({
      success: true,
      vessels: {
        selectedGlass: settings.selectedGlass,
        selectedJar:   settings.selectedJar,
      }
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { getVesselSettings, saveVesselSettings };