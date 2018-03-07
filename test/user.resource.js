require('dotenv').config();

const { expect } = require('chai');
const request = require('supertest');
const HTTPStatus = require('http-status');
const faker = require('faker');
const app = require('../use/app');
const userResource = require('../use/user/user.resource');

userResource.attach(app);
const User = userResource.model;
const server = request(app);

describe('User resource', () => {

  let users;
  let password;

  before(async () => {
    await User.remove({});
    password = faker.internet.password();
    const tasks = [{
      email: faker.internet.email(),
      password,
    }, {
      email: faker.internet.email(),
      password: faker.internet.password(),
    }].map(data => User.create(data));
    users = await Promise.all(tasks);
  });

  it('should have the correct resource name', () => expect(userResource.resourceName).to.equal('user'));
  it('should have the correct address', () => expect(userResource.address).to.equal('/users'));
  it('should have the correct model name', () => expect(userResource.modelName).to.equal('User'));

  it('should fail getting all users', () => server.get('/users')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.UNAUTHORIZED));

  it('should fail getting one user', () => server.get(`/users/${String(users[0].id)}`)
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.UNAUTHORIZED));

  it('should fail to update a user', () => server.patch(`/users/${String(users[0].id)}`)
    .set('Accept', 'application/json')
    .send({})
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.UNAUTHORIZED));

  it('should fail to delete a user', () => server.delete(`/users/${String(users[1].id)}`)
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.UNAUTHORIZED));

  it('should register a new user', () => server.post('/users/register')
    .set('Accept', 'application/json')
    .send({
      email: faker.internet.email(),
      password: faker.internet.password(),
    })
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.OK)
    .expect(({ body: { data, status, code } }) => {
      expect(status).to.equal('success');
      expect(code).to.equal(HTTPStatus.OK);
      expect(data.user).to.have.property('email');
      expect(data.auth).to.have.property('token');
    }));

  it('should fail to register with missing credentials', () => server.post('/users/register')
    .set('Accept', 'application/json')
    .send({
      email: faker.internet.email(),
    })
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.BAD_REQUEST)
    .expect(({ body: { data, status, code } }) => {
      expect(status).to.equal('fail');
      expect(code).to.equal(HTTPStatus.BAD_REQUEST);
      expect(data).to.have.property('password');
    }));

  it('should login a user', () => server.post('/users/login')
    .set('Accept', 'application/json')
    .send({
      email: users[0].email,
      password,
    })
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.OK)
    .expect(({ body: { data, status, code } }) => {
      expect(status).to.equal('success');
      expect(code).to.equal(HTTPStatus.OK);
      expect(data.auth).to.have.property('token');
    }));

  it('should fail if a users email is incorrect', () => server.post('/users/login')
    .set('Accept', 'application/json')
    .send({
      email: 'random.email@example.com',
      password,
    })
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.NOT_FOUND)
    .expect(({ body: { message, status, code } }) => {
      expect(status).to.equal('fail');
      expect(code).to.equal(HTTPStatus.NOT_FOUND);
      expect(message).to.equal('No user was found for the given email.');
    }));

  it('should fail a login on bad credentials', () => server.post('/users/login')
    .set('Accept', 'application/json')
    .send({
      email: users[0].email,
      password: 'wrong password',
    })
    .expect('Content-Type', /json/)
    .expect(HTTPStatus.BAD_REQUEST)
    .expect(({ body: { message, status, code } }) => {
      expect(status).to.equal('fail');
      expect(code).to.equal(HTTPStatus.BAD_REQUEST);
      expect(message).to.equal('Password is incorrect.');
    }));

});