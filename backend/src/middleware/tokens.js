const { loadConfig } = require('../services/config');

function getProvidedToken(req) {
  const headerToken = req.headers['x-access-token'];
  const bodyToken = req.body?.token;
  const queryToken = req.query?.token;
  return String(headerToken || bodyToken || queryToken || '').trim();
}

function validateToken(req, res, expectedToken, tokenType) {
  const configuredToken = String(expectedToken || '').trim();
  if (!configuredToken) {
    return res.status(500).json({
      error: `${tokenType} token is not configured on server`
    });
  }

  const providedToken = getProvidedToken(req);
  if (!providedToken || providedToken !== configuredToken) {
    return res.status(401).json({
      error: `Invalid ${tokenType} token`
    });
  }

  return null;
}

function requireUploadToken(req, res, next) {
  const config = loadConfig();
  const errorResponse = validateToken(req, res, config.uploadToken, 'upload');
  if (errorResponse) {
    return;
  }
  next();
}

function requireTestToken(req, res, next) {
  const config = loadConfig();
  const errorResponse = validateToken(req, res, config.testToken, 'test');
  if (errorResponse) {
    return;
  }
  next();
}

module.exports = {
  requireUploadToken,
  requireTestToken
};
