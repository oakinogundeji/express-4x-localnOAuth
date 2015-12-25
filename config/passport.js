'use strict';
/**
*Module dependencies
*/
var
  passport = require('passport'),
  config = require('./config'),
  User = require('../models/users');
//==============================================================================
/**
*Module variables
*/
var
  host = config.host,
  LocalStrategy = require('passport-local').Strategy,
  FBStrategy = require('passport-facebook').Strategy,
  TwitterStrategy = require('passport-twitter').Strategy,
  fbAppId = config.fb.appID,
  fbAppSecret = config.fb.appSecret,
  fbCallbackURL = config.fb.callbackURL,
  consumerKey = config.twitter.consumerKey,
  consumerSecret = config.twitter.consumerSecret,
  twitterCallbackURL = config.twitter.callbackURL;
//==============================================================================
/**
*Configuration and Settings
*/
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    if(err) {
      console.error('There was an error accessing the records of' +
      ' user with id: ' + id);
      return done(err);
    }
    return done(null, user);
  })
});
//==============================================================================
/**
*Strategies
*/
//---------------------------Local Strategy-------------------------------------
passport.use('local-signup', new LocalStrategy({
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true
  },
  function(req, email, password, done) {
    process.nextTick(function() {
      if(!req.user) {
        User.findOne({'local.email': email}, function(err, user) {
        if(err) {
          console.error(err);
          return done(err);
          }
        if(user) {
          return done(null, false, {errMsg: 'email already exists'});
        }
        else {
            var newUser = new User();
            newUser.local.username = req.body.username;
            newUser.local.email = email;
            newUser.local.password = newUser.generateHash(password);
            newUser.save(function(err) {
              if(err) {
                if(err.message == 'User validation failed') {
                  return done(null, false, {errMsg: 'Please fill all fields'});
                }
                console.error(err);
                return done(err);
                }
              return done(null, newUser);
            });
          }
      });
    }
    else {//user exists and is loggedin
      var user = req.user; // pull the user out of the session
      // update the current users local credentials
      user.local.username = req.body.username;
      user.local.email = email;
      user.local.password = user.generateHash(password);
      // save modifications to user
      user.save(function(err) {
        if (err) {
          console.error(err);
          return done(err);
        }
        return done(null, user);
      });
    }
  });
}));
//---------------------------local login----------------------------------------
passport.use('local-login', new LocalStrategy({
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true
  },
  function(req, email, password, done) {
    User.findOne({'local.email': email}, function(err, user) {
        if(err) {
          return done(err);
          }
        if(!user) {
          return done(null, false, {errMsg: 'User does not exist, please' +
          ' <a href="/signup">signup</a>'});
          }
        if(!user.validPassword(password)) {
          return done(null, false, {errMsg: 'Invalid password try again'});
          }
        return done(null, user);
    });
  })
);
//---------------------------Facebook Strategy----------------------------------
passport.use(new FBStrategy({
    clientID: fbAppId,
    clientSecret: fbAppSecret,
    callbackURL: fbCallbackURL,
    profileFields: ['id', 'displayName', 'emails', 'photos'],
    passReqToCallback : true
  },
  function(req, accessToken, refreshToken, profile, done) {
    process.nextTick(function() {
      if(!req.user) {//confirm that user not loggedin
        User.findOne({'social.fb.id': profile.id }, function(err, user) {
          if (err) {
            console.error('There was an error accessing the dbase', err.message);
            return done(err);
            }
          if (user) {
              return done(null, user);
            }
          else {
              var newUser = new User();
              newUser.social.fb.id = profile.id;
              newUser.social.fb.token = accessToken;
              newUser.social.fb.displayName = profile.displayName;
              newUser.social.fb.email = profile.emails[0].value;
              newUser.social.fb.photo = profile.photos[0].value || '';
              newUser.save(function(err) {
                  if (err) {
                    console.error(err);
                    return done(err);
                  }
                  return done(null, newUser);
              });
            }
          }
        );
      }
      else {//user exists and is loggedin
        var user = req.user; // pull the user out of the session
        // update the current users facebook credentials
        user.social.fb.id = profile.id;
        user.social.fb.token = accessToken;
        user.social.fb.displayName = profile.displayName;
        user.social.fb.email = profile.emails[0].value;
        user.social.fb.photo = profile.photos[0].value || '';
        // save modifications to user
        user.save(function(err) {
          if (err) {
            console.error(err);
            return done(err);
          }
          //console.log('user fb', user.social.fb.displayName);
          //console.log('user fb tokens',user.social.fb.token);
          return done(null, user);
        });
      }
    });
  }));
//---------------------------Twitter Strategy-----------------------------------
passport.use(new TwitterStrategy({
  consumerKey: consumerKey,
  consumerSecret: consumerSecret,
  callbackURL: twitterCallbackURL,
  profileFields: ['id', 'displayName', 'username', 'photos', '_json'],
  passReqToCallback : true
    },
  function(req, accessToken, tokenSecret, profile, done) {
  process.nextTick(function() {
    if(!req.user) {//confirm that user not loggedin
      User.findOne({'social.twitter.id': profile.id }, function(err, user) {
        if (err) {
          console.error('There was an error accessing the dbase', err.message);
          return done(err);
          }
        if (user) {
            return done(null, user);
          }
        else {
            var newUser = new User();
            newUser.social.twitter.id = profile.id;
            newUser.social.twitter.token = accessToken;
            newUser.social.twitter.displayName = profile.displayName;
            newUser.social.twitter.handle = profile.username;
            newUser.social.twitter.photo = profile.photos[0].value || '';
            newUser.social.twitter.metaData.location = profile._json.location;
            newUser.social.twitter.metaData.description = profile._json.description;
            newUser.save(function(err) {
                if (err) {
                  console.error(err);
                  return done(err);
                }
                return done(null, newUser);
            });
          }
        }
      )}
      else {
        //user exists and is loggedin
          var user = req.user; // pull the user out of the session
          // update the current users facebook credentials
          user.social.twitter.id = profile.id;
          user.social.twitter.token = accessToken;
          user.social.twitter.displayName = profile.displayName;
          user.social.twitter.handle = profile.username;
          user.social.twitter.photo = profile.photos[0].value || '';
          user.social.twitter.metaData.location = profile._json.location;
          user.social.twitter.metaData.description = profile._json.description;
          // save modifications to user
          user.save(function(err) {
            if (err) {
              console.error(err);
              return done(err);
            }
            return done(null, user);
          });
      }
    });
  })
);
//==============================================================================
/**
*Export Module
*/
module.exports = passport;
//==============================================================================
