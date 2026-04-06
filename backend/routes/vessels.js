const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const {
  getVesselSettings,
  saveVesselSettings,
} = require('../controllers/vesselController');

router.use(protect);

// Preferred endpoints used by frontend
router.get('/settings',  getVesselSettings);
router.post('/settings', saveVesselSettings);

// Backward compatibility (older clients)
router.get('/',  getVesselSettings);
router.post('/', saveVesselSettings);

module.exports = router;