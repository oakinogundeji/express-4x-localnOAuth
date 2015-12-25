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
  users = [
    {username: faker.internet.userName(), email: faker.internet.email(), password: faker.internet.password()},
    {username: faker.internet.userName(), email: faker.internet.email(), password: faker.internet.password()},
    {username: faker.internet.userName(), email: faker.internet.email(), password: faker.internet.password()},
    {username: faker.internet.userName(), email: faker.internet.email(), password: faker.internet.password()}
  ];
request = request(app);
//==============================================================================
/**
*Tests
*/
describe('Users API', function () {
  before(function (done) {
    User.remove({}, done);
  });
  describe('Seed collection with data', function () {
    it('should create a set of new local users', function (done) {
      users.forEach(function (user) {
        request
        .post('/signup')
        .send(user)
        .expect(200)
        .end()
      })
      done();
    });
  });
  describe('View all local users', function () {
    it('should return all local users in the dBase', function (done) {
      request
      .get('/api/users')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .end(function (err, res) {
        done(err);
      })
    });
  });
  describe('Access a specific local user', function () {
    describe('View a specific local user', function () {
      describe('failing test', function () {
        it('should fail because of invalid local user email', function (done) {
          var email = 'test@test.com';
          request
          .get('/api/users/' + email)
          .expect(404)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .end(function (err, res) {
            res.text.should.containEql('User does not exist in the dBase');
            done(err);
          });
        });
      });
      describe('passing test', function () {
        it('should pass because of valid local user email', function (done) {
          var
            user = users[0],
            email = user.email;
          request
          .get('/api/users/' + email)
          .expect(200)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .end(function (err, res) {
            done(err);
          });
        });
      });
    });
    describe('Update a specific local user', function () {
      describe('failing test', function () {
        it('should fail because of invalid local user email', function (done) {
          var
            email = 'test@test.com',
            payload = {
              username: 'someone',
              email: 'test@test.com',
              password: 'qwerty123'
            };
          request
          .put('/api/users/' + email)
          .send(payload)
          .expect(404)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .end(function (err, res) {
            res.text.should.containEql('User not found in the dBase');
            done(err);
          });
        });
      });
      describe('passing test', function () {
        it('should pass because of valid local user email', function (done) {
          var
            user = users[0],
            email = user.email,
            payload = {
              username: 'someone',
              email: 'test@test.com',
              password: 'qwerty123'
            };
          request
          .put('/api/users/' + email)
          .send(payload)
          .expect(200)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .end(function (err, res) {
            done(err);
          });
        });
      });
    });
    describe('Delete a specific local user', function () {
      describe('failing test', function () {
        it('should fail because of invalid local user email', function (done) {
          var email = 'test1@test1.com'
          request
          .delete('/api/users/' + email)
          .expect(404)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .end(function (err, res) {
            res.text.should.containEql('User not found in the dBase');
            done(err);
          });
        });
      });
      describe('passing test', function () {
        it('should pass because of valid local user email', function (done) {
          var
            user = users[1],
            email = user.email;
          request
          .delete('/api/users/' + email)
          .expect(200)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .end(function (err, res) {
            done(err);
          });
        });
      });
    });
  });
})
//==============================================================================
