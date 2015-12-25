'use strict';
/**
*Module dependencies
*/
var UserModel = require('./users');
//==============================================================================
/**
*User Model Utility functions
*/
function findUser(req, res, next) {
  return UserModel.findOne({'local.email': req.params.email}, 'email username',
    function (err, user) {
      if(err) {
        return next(err);
      }
      if(user == null) {
        return res.status(404).json('User does not exist in the dBase');
      }
      return res.status(200).json(user);
  });
}

function viewAllUsers(req, res, next) {
  return UserModel.find({},
  function (err, users) {
    if(err) {
      return next(err);
    }
    if(users == null) {
      return res.status(404).json('No users in the dBase');
    }
    return res.json(users);
  });
}

function updateUser(req, res, next) {
  return UserModel.findOne({'local.email': req.params.email}, 'email username password',
  function (err, user) {
    if(err) {
      return next(err);
    }
    if(user == null) {
      return res.status(404).json('User not found in the dBase');
    }
    user.email = req.body.email || user.email;
    user.username = req.body.username || user.username;
    user.password = user.generateHash(req.body.password) || user.password;
    user.save(function (err, user) {
      if(err) {
        return next(err);
      }
      return res.json(user);
    });
  });
}

function deleteUser(req, res, next) {
  return UserModel.findOneAndRemove({'local.email': req.params.email}, 'email username password',
 function (err, user) {
   if(err) {
     return next(err);
   }
   if(user == null) {
     return res.status(404).json('User not found in the dBase');
   }
   return res.json(user);
 });
}
//==============================================================================
/**
* Export module
*/
module.exports = {
  findUser: findUser,
  viewAllUsers: viewAllUsers,
  updateUser: updateUser,
  deleteUser: deleteUser
};
//==============================================================================
