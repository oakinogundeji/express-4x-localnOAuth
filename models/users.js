'use strict';
/**
*Module Dependencies
*/
var
  mongoose = require('mongoose'),
  bcrypt = require('bcrypt-nodejs');
//==============================================================================
/**
*Create user schema
*/
var UserSchema = mongoose.Schema({
  local: {
    username: String,
    email: {
      type: String,
      unique: true
      },
    password: String
    },
  social: {
    fb: {
      id: String,
      token: String,
      displayName: String,
      email: String,
      photo: String
      },
    twitter: {
      id: String,
      token: String,
      displayName: String,
      handle: String,
      photo: String,
      metaData: {
        location: String,
        description: String
        }
      }
    }
  });
//==============================================================================
/**
*Create schema methods
*/
UserSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
};

UserSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};
//==============================================================================
/**
*Create user model
*/
var UserModel = mongoose.model('User', UserSchema);
//==============================================================================
/**
*Export user model
*/
module.exports = UserModel;
//==============================================================================
