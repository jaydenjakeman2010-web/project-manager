import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import db from '../db/index.js';

function upsertUser(profile, provider) {
  const providerIdKey = provider === 'google' ? 'google_id' : 'github_id';
  const providerId = profile.id;
  const name = profile.displayName || profile.username || 'Unknown';
  const email = profile.emails?.[0]?.value || null;
  const photo = profile.photos?.[0]?.value || null;

  return db.transaction(async (client) => {
    const { rows: existing } = await client.query(
      `SELECT id, name, email, photo_url FROM users WHERE ${providerIdKey} = $1 LIMIT 1`,
      [providerId]
    );

    if (existing.length > 0) {
      const user = existing[0];
      const updates = [];
      const params = [];
      let idx = 1;

      if (name && name !== user.name) { updates.push(`name = $${idx++}`); params.push(name); }
      if (email && email !== user.email) { updates.push(`email = $${idx++}`); params.push(email); }
      if (photo && photo !== user.photo_url) { updates.push(`photo_url = $${idx++}`); params.push(photo); }

      if (updates.length > 0) {
        params.push(user.id);
        await client.query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
          params
        );
      }
      return user.id;
    }

    const { rows: [newUser] } = await client.query(
      `INSERT INTO users (name, email, photo_url, ${providerIdKey})
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, email, photo, providerId]
    );
    return newUser.id;
  });
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email'],
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const userId = await upsertUser(profile, 'google');
      done(null, { id: userId });
    } catch (err) {
      done(err, null);
    }
  }));
} else {
  console.log('Google OAuth not configured — sign-in button will be hidden.');
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL,
    scope: ['user:email'],
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const userId = await upsertUser(profile, 'github');
      done(null, { id: userId });
    } catch (err) {
      done(err, null);
    }
  }));
} else {
  console.log('GitHub OAuth not configured — sign-in button will be hidden.');
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id }));

export default passport;
