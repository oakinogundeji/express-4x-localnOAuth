'use strict';
/**
*Module Dependencies
*/
var mongoose = require('mongoose');
//==============================================================================
/**
*Create user schema
*/
var BookSchema = mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  created_on: {
    type: Date,
    default: Date.now
  }
});
//==============================================================================
/**
*Create book model
*/
var BookModel = mongoose.model('Book', BookSchema);
//==============================================================================
/**
*Export book model
*/
module.exports = BookModel;
//==============================================================================
