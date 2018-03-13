const HTTPStatus = require('http-status');
const { authPackage } = require('./auth');
const { createError, checkString } = require('./helpers');

/**
 * Create and save a token with a user.
 */
async function createToken({ Token, user, secret } = {}) {
  const item = new Token({});
  const pack = authPackage({
    id: item.id,
    userId: user.id,
    email: user.email,
  }, secret);
  return Object.assign(item, pack).save();
}
module.exports.createToken = createToken;

/**
 * Login a user with the provided credentials.
 */
function login({ Token, secret } = {}) {
  checkString(secret, { method: 'login' });
  if (!Token) {
    throw createError({ message: 'Parameters missing to login function; needs token model or secret.' });
  }
  return async ({ Model, body: { email, password } }) => {
    const user = await Model.findOne({ email });
    if (!user) {
      throw createError({
        message: 'No user was found for the given email.',
        code: HTTPStatus.NOT_FOUND,
      });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      throw createError({
        message: 'Password is incorrect.',
        code: HTTPStatus.BAD_REQUEST,
      });
    }
    const auth = await createToken({ Token, user, secret });
    return { auth };
  };
}
module.exports.login = login;

/**
 * Register (sign up) a new user.
 */
function register({ Token, secret } = {}) {
  checkString(secret, { method: 'login' });
  if (!Token) {
    throw createError({ message: 'Parameters missing to login function; needs token model or secret.' });
  }
  return async ({ Model, body }) => {
    const user = await Model.create(body);
    if (!user) {
      throw createError({ message: 'Error occurred while creating user.' });
    }
    const auth = await createToken({ Token, user, secret });
    return {
      user,
      auth,
    };
  };
}
module.exports.register = register;

/**
 * Logout a user from the application.
 */
function logout() {
  return async ({ auth }) => {
    if (auth) {
      await Object.assign(auth, { active: false }).save();
    }
    return { auth: null };
  };
}
module.exports.logout = logout;
