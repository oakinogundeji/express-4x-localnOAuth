'use strict';
/**
*Module dependencies
*/
var BookModel = require('./books');
//==============================================================================
/**
*Book Model Utility functions
*/
function errHandler(err) {
  console.error('There was an error performing the operation');
  console.log(err);
  console.log(err.code);
  return console.error(err.message);
}

function validationErr(err, res) {
  Object.keys(err.errors).forEach(function (k) {
    var msg = err.errors[k].message;
    console.error('Validation error for \'%s' +': %s', k, msg);
    return res.status(404).json({
      msg: 'Please ensure required fields are filled'});
  });
}

function cr8NewBook(req, res, next) {
  return BookModel.create({
    title: req.body.title,
    author: req.body.author,
  }, function (err, book, next) {
      if(err) {
        if(err.name == 'ValidationError') {
          return validationErr(err, res);
        }
        else {
          errHandler(err);
          return next(err);
        }
      }
      return res.status(200).json({
        msg: 'book created!',
        id: book._id,
        title: book.title
    });
  })
}

function findBook(req, res, next) {
  return BookModel.find({title: req.params.title || req.query.title}, 'title author',
    function (err, book, next) {
      if(err) {
        errHandler(err);
        return next(err)
      }
      if(book == null) {
        return res.status(404).json({msg: 'book does not exist in the dBase, please' +
        ' create the book'});
      }
      return res.status(200).json(book);
  });
}

function viewAllBooks(req, res) {
  return BookModel.find({},
  function (err, books, next) {
    if(err) {
      errHandler(err);
      return next(err);
    }
    return res.status(200).json(books);
  });
}

function updateBook(req, res) {
  return BookModel.findOne({title: req.params.title, author: req.params.author},
  function (err, book, next) {
    if(err) {
      errHandler(err);
      return next(err);
    }
    if(book == null) {
      return res.status(409).json('Both book title and author required');
    }
    book.title = req.body.title || book.title;
    book.author = req.body.author || book.author;
    book.save(function (err, book) {
      if(err) {
        errHandler(err);
        return next(err);
      }
      return res.status(200).json(book);
    });
  });
}

function deleteBook(req, res) {
  return BookModel.findOneAndRemove({title: req.params.title, author: req.params.author},
 function (err, book, next) {
   if(err) {
     errHandler(err);
     return next(err);
   }
   if(book == null) {
     return res.status(409).json('Both book title and author required');
   }
   return res.status(200).json(book);
 });
}
//==============================================================================
/**
* Export module
*/
module.exports = {
  errHandler: errHandler,
  validationErr: validationErr,
  cr8NewBook: cr8NewBook,
  findBook: findBook,
  viewAllBooks: viewAllBooks,
  updateBook: updateBook,
  deleteBook: deleteBook
};
//==============================================================================
