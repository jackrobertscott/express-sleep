/**
 * Access to anyone.
 */
module.exports.isAnyone = function isAnyone() {
  return () => true;
};

/**
 * Authenticate from an access token.
 */
module.exports.isTokenized = function isTokenized() {
  return ({ req }) => req.auth && req.auth.id;
};

/**
 * Authenticate a user.
 */
module.exports.isUser = function isUser() {
  return ({ req }) => req.user;
};

/**
 * Authenticate an owner of a resource.
 */
module.exports.isOwner = function isOwner({ field = 'user' } = {}) {
  return ({ body, user }) => user && body && body[field] === user.id;
};
