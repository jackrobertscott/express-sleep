require('dotenv').config();
const { expect } = require('chai');
const request = require('supertest');
const app = require('../use/app');
const exampleResource = require('../use/example/example.resource');
const Example = require('../use/example/example.model');

exampleResource.attach(app);
const server = request(app);

describe('Standard routes', () => {

  let examples;

  before(async () => {
    await Example.remove({});
    const tasks = [{
      title: 'Example title one.',
      comments: 5,
    }, {
      title: 'Example title two.',
      comments: 10,
    }].map(data => Example.create(data));
    const items = await Promise.all(tasks);
    examples = items;
  });

  it('should get all examples', () => server.get('/examples')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200)
    .expect(({ body: { data } }) => expect(data.examples).to.have.lengthOf(2)));

  it('should get one example', () => server.get(`/examples/${String(examples[0].id)}`)
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200)
    .expect(({ body: { data } }) => expect(data.example).to.have.property('comments', 5)));

  it('should create an example', () => server.post('/examples')
    .set('Accept', 'application/json')
    .send({
      title: 'Hello title',
      comments: 15,
    })
    .expect('Content-Type', /json/)
    .expect(200)
    .expect(({ body: { data } }) => expect(data.example).to.have.property('comments', 15)));

  it('should update an example', () => server.patch(`/examples/${String(examples[0].id)}`)
    .set('Accept', 'application/json')
    .send({
      comments: 25,
    })
    .expect('Content-Type', /json/)
    .expect(200)
    .expect(({ body: { data } }) => expect(data.example).to.have.property('comments', 25)));

  it('should get delete an example', () => server.delete(`/examples/${String(examples[1].id)}`)
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200)
    .expect(({ body: { data } }) => expect(data.example).to.equal(null))
    .then(async () => {
      const count = await Example.count({});
      expect(count).to.equal(2);
    }));

});