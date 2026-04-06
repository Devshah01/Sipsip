const express      = require('express');
const cors         = require('cors');
const dotenv       = require('dotenv');
const passport     = require('passport');
const cookieParser = require('cookie-parser');

// Load env vars
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

// Connect DB
const connectDB    = require('./config/db');
connectDB();

// Passport config
require('./config/passport');

// Push scheduler
const { startScheduler } = require('./utils/pushScheduler');

const app = express();

// ── Middleware ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${duration}ms`);
  });
  next();
});
app.use(cors({
  origin:      process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(passport.initialize());

// ── Routes ──
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/profile',       require('./routes/profile'));
app.use('/api/water',         require('./routes/water'));
app.use('/api/stats',         require('./routes/stats'));
app.use('/api/vessels',       require('./routes/vessels'));
app.use('/api/notifications', require('./routes/notifications'));


// ── Health check ──
app.get('/', (req, res) => {
  res.json({ success: true, message: '💧 SipSip API is running' });
});

// ── Error handler (must be last) ──
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// ── Start server ──
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startScheduler();
});
