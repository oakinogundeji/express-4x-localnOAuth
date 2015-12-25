'use strict';
/**
*Module Dependencies
*/
var
  app = require('./app'),
  http = require('http');
//==============================================================================
/**
*Server instance
*/
var server = http.createServer(app);
//==============================================================================
/**
*Module variables
*/
var
  port = app.get('port'),
  env = app.get('env');
//==============================================================================
/**
*Bind to port
*/
server.listen(port, function () {
  return console.log('Server listening on port ' + port +' in ' + env +' mode.');
});
//==============================================================================
/**
*Conditionally export Module
*/
if(require.main != module) {
  module.exports = server;
}
//==============================================================================
