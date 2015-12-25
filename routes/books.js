'use strict';
/**
*Module Dependencies
*/
var
  express = require('express'),
  passport = require('../config/passport'),
  Books = require('../models/books'),
  BookUtils = require('../models/bookUtilities');
//==============================================================================
/**
*Create Router instance
*/
var router = express.Router();
//==============================================================================
/**
*Module variables
*/
var
  isLoggedIn = require('../utils/isLoggedIn'),
  cr8NewBook = BookUtils.cr8NewBook,
  findBook = BookUtils.findBook,
  viewAllBooks = BookUtils.viewAllBooks,
  updateBook = BookUtils.updateBook,
  deleteBook = BookUtils.deleteBook;
//==============================================================================
/**
*Routes
*/
//---------------------------book sub routes------------------------------------
//router.all('*', isLoggedIn);

router.get('/', function (req, res, next) {
  return viewAllBooks(req, res, next);
});

router.post('/', function (req, res, next) {
  return cr8NewBook(req, res, next);
});

router.get('/:title', function (req, res, next) {
    return findBook(req, res, next);
  });

router.route('/:title/:author')
  .put(function (req, res, next) {
    return updateBook(req, res, next);
  })
  .delete(function (req, res, next) {
    return deleteBook(req, res, next);
  });
//==============================================================================
/**
*Export Module
*/
module.exports = router;
//==============================================================================
