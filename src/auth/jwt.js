import jwt from 'jsonwebtoken';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change-me-to-a-random-128-char-hex-string') {
    throw new Error(
      'JWT_SECRET is not set or still using the default value. ' +
      'Generate a secure random key: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }
  return secret;
}

export function signToken(payload) {
  const secret = getSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn });
}

export function verifyToken(token) {
  const secret = getSecret();
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}
