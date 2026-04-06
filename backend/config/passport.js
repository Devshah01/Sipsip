const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User           = require('../models/User');

// Only load Google strategy if real credentials are provided
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here' &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret_here'
) {
  passport.use(new GoogleStrategy({
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email  = profile.emails[0].value;
        const name   = profile.displayName;
        const avatar = profile.photos[0]?.value || '';

        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        user = await User.findOne({ email });
        if (user) {
          user.googleId     = profile.id;
          user.avatar       = avatar;
          user.authProvider = 'both';
          await user.save();
          return done(null, user);
        }

        user = await User.create({
          name,
          email,
          googleId:     profile.id,
          avatar,
          authProvider: 'google',
          password:     null,
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));

  console.log('✅ Google OAuth strategy loaded');
} else {
  console.log('⚠️  Google OAuth skipped — add real credentials in .env to enable');
}

module.exports = passport;