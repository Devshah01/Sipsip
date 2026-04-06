const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMyProfile, updateMyProfile } = require('../controllers/profileController');

router.use(protect);

router.get('/', getMyProfile);
router.put('/', updateMyProfile);

module.exports = router;