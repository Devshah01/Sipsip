const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getVapidKey,
  subscribe,
  unsubscribe,
  getSettings,
  updateSettings,
  sendTest,
} = require('../controllers/notificationController');

// Public — frontend needs the public key before the user logs in (to register SW)
router.get('/vapid-public-key', getVapidKey);

// All routes below require a logged-in user
router.use(protect);

router.post('/subscribe',   subscribe);
router.post('/unsubscribe', unsubscribe);
router.get('/settings',     getSettings);
router.patch('/settings',   updateSettings);
router.post('/send-test',   sendTest);

module.exports = router;