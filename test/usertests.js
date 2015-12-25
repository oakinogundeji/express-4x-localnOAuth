'use strict';
/**
*Module Dependencies
*/
var
  should = require('should'),
  request = require('supertest'),
  faker = require('faker'),
  app = require('../app'),
  User = require('../models/users');
//==============================================================================
/**
*Module variables
*/
var
  userDetails = User.schema.paths;
request = request(app);
//==============================================================================
/**
*Tests
*/
describe('Users', function () {
  before(function (done) {
    User.remove({}, done);
  });
  after(function (done) {
    User.remove({}, done);
  });
  describe('Schema tests', function () {
    it('should have model name field which is equal to User', function () {
      User.modelName.should.exist;
      User.modelName.should.equal('User');
    });
    it('should have local username field which is a String', function () {
      userDetails['local.username'].should.exist;
      userDetails['local.username'].instance.should.equal('String');
    });
    it('should have local email field which is a String', function () {
      userDetails['local.email'].should.exist;
      userDetails['local.email'].instance.should.equal('String');
    });
    it('should have local password field which is a String', function () {
      userDetails['local.password'].should.exist;
      userDetails['local.password'].instance.should.equal('String');
    });
  });
  describe('New local user tests', function () {
    it('should not create a new local user if email missing and should return 409 error', function (done) {
      request
      .post('/signup')
      .send({
        username: faker.internet.userName(),
        //email: faker.internet.email(),
        password: faker.internet.password()
      })
      .expect(409)
      .end(function (err, res) {
        done(err);
      })
    });
    it('should create a new local user if all valid fields are filled and should return 302 status', function (done) {
      request
      .post('/signup')
      .send({
        username: faker.internet.userName(),
        email: faker.internet.email(),
        password: faker.internet.password()
      })
      .expect(302)
      .end(function (err, res) {
        done();
      })
    });
  });
})
//==============================================================================
