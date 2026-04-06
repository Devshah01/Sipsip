const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const {
  logSip,
  getTodayLogs,
  getLogsByDate,
  deleteSip,
  syncGuestSips,
} = require('../controllers/waterController');

router.use(protect); // all water routes are protected

router.post('/log',         logSip);
router.post('/sync-guest',  syncGuestSips);
router.get('/logs/today',   getTodayLogs);
router.get('/logs',         getLogsByDate);
router.delete('/log/:id',   deleteSip);

module.exports = router;