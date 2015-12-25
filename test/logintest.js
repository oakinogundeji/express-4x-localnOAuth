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
  user = {
    username: 'test',
    email: 'test@test.com',
    password: 'testpwd123'
  };
request = request(app);
//==============================================================================
/**
*Tests
*/
describe('Login', function () {
  before(function (done) {
    User.remove({}, done);
  });
  describe('Local Login tests', function () {
    describe('Access Fail', function () {
      it('should reject an unauthenticated local user', function (done) {
        request
        .get('/dashboard')
        .expect(302)
        .end(function (err, res) {
          res.text.should.containEql('Redirecting to /login');
          done(err);
        })
      });
    });
    describe('Local Login fail', function () {
      it('should reject a nonexisting local user and should return 409 error', function (done) {
        request
        .post('/login')
        .send({
          email: faker.internet.email(),
          password: faker.internet.password()
        })
        .expect(409)
        .end(function (err, res) {
          done(err);
        })
      });
    });
    describe('Local Signup pass', function () {
      it('should create a new local user', function (done) {
        request
        .post('/signup')
        .send(user)
        .expect(302)
        .end(function (err, res) {
          done(err);
        })
      });
    });
    describe('Logout', function () {
      it('should logout the existing user', function (done) {
        request
        .get('/logout')
        .expect(302)
        .end(function (err, res) {
          res.text.should.containEql('Redirecting to /');
          done(err);
        })
      });
    });
    describe('Local Login fail', function () {
      it('should not login the existing local user because of wrong email', function (done) {
        user.email = 'notit@test.com';
        request
        .post('/login')
        .send(user)
        .expect(409)
        .end(function (err, res) {
          done(err);
        })
      });
    });
    describe('Local Login fail', function () {
      it('should not login the existing local user because of wrong password', function (done) {
        user.email = 'test@test.com';
        user.password = 'wrongpwd123';
        request
        .post('/login')
        .send(user)
        .expect(409)
        .end(function (err, res) {
          done(err);
        })
      });
    });
    describe('Local Login pass', function () {
      it('should login the existing local user', function (done) {
        user.email = 'test@test.com';
        user.password = 'testpwd123';
        request
        .post('/login')
        .send(user)
        .expect(302)
        .end(function (err, res) {
          done(err);
        })
      });
    });
  });
})
//==============================================================================
