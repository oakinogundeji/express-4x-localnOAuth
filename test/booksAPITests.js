'use strict';
/*
To run these tests comment out 'router.all('*', isLoggedIn)' in
/routes/books
*/
/**
*Module Dependencies
*/
var
  should = require('should'),
  request = require('supertest'),
  faker = require('faker'),
  app = require('../app'),
  Books = require('../models/books'),
  bookUtils = require('../models/bookUtilities');
//==============================================================================
/**
*Module variables
*/
var books = [
    {title: faker.hacker.phrase(), author: faker.name.findName()},
    {title: faker.hacker.phrase(), author: faker.name.findName()},
    {title: faker.hacker.phrase(), author: faker.name.findName()},
    {title: faker.hacker.phrase(), author: faker.name.findName()}
  ];
request = request(app);
//==============================================================================
/**
*Tests
*/
describe('Books API', function () {
  after(function (done) {
    Books.remove({}, done);
  });
  describe('Book API tests', function () {
    describe('Create books', function () {
      it('should create new books in the collection', function (done) {
        books.forEach(function (book) {
          request
          .post('/books')
          .send(book)
          .expect(200)
          .end()
        })
        done();
      });
    });
    describe('View all books', function () {
      it('should return all books in the collection', function (done) {
        request
        .get('/books')
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .end(function (err, res) {
          var
            content = res.body,
            compareBk = [];
          content.map(function (bk) {
            compareBk.push({title: bk.title, author: bk.author});
          });
          books.forEach(function (bk) {
            compareBk.should.containEql(bk);
          });
          done(err);
        })
      });
    });
    describe('View book(s) when title is supplied', function () {
      it('should return the book(s) with the supplied title', function (done) {
        var testbk = books[0];
        request
        .get('/books/' + testbk.title)
        .expect(200)
        .end(function (err, res) {
          var
            content = res.body,
            compareTitle = [];
          content.map(function (bk) {
            compareTitle.push({title: bk.title, author: bk.author});
          });
          compareTitle.forEach(function (bk) {
            bk.title.should.containEql(testbk.title);
          });
          done(err);
        });
      });
    });
    describe('Modify one particular book when title and author is supplied', function () {
      describe('failing test', function () {
        it('should fail to update book due to invalid author', function (done) {
          var
            testbk = books[0],
            title = testbk.title,
            author = 'test';
          request
          .put('/books/' + title +'/' + author)
          .send({
            title: title,
            author: author
          })
          .expect(409)
          .end(function (err, res) {
            res.text.should.containEql('Both book title and author required');
            done(err);
          });
        });
      });
      describe('failing test', function () {
        it('should fail to update book due to invalid title', function (done) {
          var
            testbk = books[0],
            title = 'test',
            author = testbk.author;
          request
          .put('/books/' + title +'/' + author)
          .send({
            title: title,
            author: author
          })
          .expect(409)
          .end(function (err, res) {
            res.text.should.containEql('Both book title and author required');
            done(err);
          });
        });
      });
      describe('passing test', function () {
        it('should update book given valid title and author', function (done) {
          var
            testbk = books[0],
            title = testbk.title,
            author = testbk.author,
            payload = {
              title: 'Just a test',
              author: 'Someone New'
            };
          request
          .put('/books/' + title +'/' + author)
          .send(payload)
          .expect(200)
          .end(function (err, res) {
            res.body.should.containEql(payload);
            done(err);
          });
        });
      });
    });
    describe('Delete one particular book when title and author is supplied', function () {
      describe('failing test', function () {
        it('should fail to delete book due to invalid author', function (done) {
          var
            testbk = books[0],
            title = testbk.title,
            author = 'test';
          request
          .delete('/books/' + title +'/' + author)
          .expect(409)
          .end(function (err, res) {
            res.text.should.containEql('Both book title and author required');
            done(err);
          });
        });
      });
      describe('failing test', function () {
        it('should fail to delete book due to invalid title', function (done) {
          var
            testbk = books[0],
            title = 'test',
            author = testbk.author;
          request
          .delete('/books/' + title +'/' + author)
          .expect(409)
          .end(function (err, res) {
            res.text.should.containEql('Both book title and author required');
            done(err);
          });
        });
      });
      describe('passing test', function () {
        it('should delete book given valid title and author', function (done) {
          var
            testbk = books[1],
            title = testbk.title,
            author = testbk.author;
          request
          .delete('/books/' + title +'/' + author)
          .expect(200)
          .end(function (err, res) {
            res.body.should.containEql(testbk);
            done(err);
          });
        });
      });
    });
  });
})
//==============================================================================
