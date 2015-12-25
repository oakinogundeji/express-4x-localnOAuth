'use strict';
/**
*Module Dependencies
*/
var
  express = require('express'),
  Facebook = require('facebook-node-sdk'),
  config = require('../config/config');
//==============================================================================
/**
*Create router instance
*/
var router = express.Router();
//==============================================================================
/**
*Module variables
*/
var
  appId = config.fb.appID,
  secret = config.fb.appSecret;
//==============================================================================
/**
*Middleware
*/
router.use(Facebook.middleware({appId: appId, secret: secret}));
//==============================================================================
/**
*Routes
*/
router.get('/', function (req, res) {
  if(req.user.social.fb.id) {
    var endPt = '/v2.5/' + req.user.social.fb.id + '/feed';
    req.facebook.api(endPt, function (err, data) {
      if(err) {
        console.error(err);
      }
      return res.json(data);
    });
  }
  else {
    return res.status(403).json('you needa facebook account');
  }
});
//==============================================================================
/**
*Export module
*/
module.exports = router;
//==============================================================================
