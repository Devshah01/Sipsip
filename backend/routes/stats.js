const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const {
  getOverview,
  getWeekly,
  getSummary,
  getBestDay,
} = require('../controllers/statsController');

router.use(protect);

router.get('/overview', getOverview);
router.get('/weekly',   getWeekly);
router.get('/summary',  getSummary);
router.get('/best-day', getBestDay);

module.exports = router;