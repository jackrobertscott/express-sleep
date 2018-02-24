const HTTPStatus = require('http-status');

const { generateToken } = require('./auth');

function login({ model, body: { email, password } }) {
  return async () => {
    const user = await model.findOne({ email });
    if (!user) {
      const error = new Error('No user was found for the given email.');
      error.code = HTTPStatus.NOT_FOUND;
      throw error;
    }
    const match = await user.comparePassword(password);
    if (!match) {
      const error = new Error('Password is incorrect.');
      error.code = HTTPStatus.NOT_FOUND;
      throw error;
    }
    return {
      auth: {
        token: generateToken(user),
        id: user.id,
        email: user.email,
        user,
      },
    };
  };
}
module.exports.login = login;

function register({ model, body }) {
  return async () => {
    const user = await model.create(body);
    if (!user) {
      const error = new Error('Failed to create new user.');
      error.code = HTTPStatus.INTERNAL_SERVER_ERROR;
      throw error;
    }
    return {
      auth: {
        token: generateToken(user),
        id: user.id,
        email: user.email,
        user,
      },
    };
  };
}
module.exports.register = register;

function logout() {
  return async () => ({
    auth: null,
  });
}
module.exports.logout = logout;