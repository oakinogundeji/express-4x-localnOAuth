'use strict';
/**
*Module Dependencies
*/
var
  path = require('path'),
  bParser = require('body-parser'),
  logger = require('morgan'),
  config = require('./config/config'),
  express = require('express'),
  ejsLayouts = require('express-ejs-layouts'),
  session = require('express-session'),
  mongoose = require('mongoose'),
  mongoStore = require('connect-mongo')(session);
//==============================================================================
/**
*Create App instance
*/
var app = express();
//==============================================================================
/**
*Module variables
*/
var
  port = process.env.PORT || 3030,
  env = config.env,
  dbURL = config.dbURL,
  sessionSecret = config.sessionSecret,
  sessStore,
  db,
  userRoutes = require('./routes/root'),
  twitterRoutes = require('./routes/twitter'),
  fbRoutes = require('./routes/facebook'),
  app.locals.errMsg = app.locals.errMsg || null;
//==============================================================================
/**
*Config and settings
*/
require('clarify');
app.disable('x-powered-by');
app.set('port', port);
app.set('env', env);
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
//==============================================================================
/**
*dBase connection
*/
mongoose.connect(dbURL);
db = mongoose.connection;
db.on('error', function (err) {
  console.error('There was a db connection error');
  return  console.error(err.message);
});
db.once('connected', function () {
  return console.log('Successfully connected to ' + dbURL);
});
db.once('disconnected', function () {
  return console.error('Successfully disconnected from ' + dbURL);
});
process.on('SIGINT', function () {
  mongoose.connection.close(function () {
    console.error('dBase connection closed due to app termination');
    return process.exit(0);
  });
});
sessStore = new mongoStore({
  mongooseConnection: mongoose.connection,
  touchAfter: 24 * 3600});
//==============================================================================
/**
*Middleware stack
*/
app.use(logger('dev'));
app.use(bParser.json());
app.use(bParser.urlencoded({extended: true}));
app.use(session({
  name: 'simpleLib.sess', store: sessStore, secret: sessionSecret, resave: true,
  saveUninitialized: false, cookie: {maxAge: 1000 * 60 * 15}}));
app.use(ejsLayouts);
app.use(express.static(path.join(__dirname, 'public')));
//==============================================================================
/**
*Routes
*/
app.get('/test', function (req, res) {
  return res.status(200).json('All\'s well!!');
});
app.use('/', userRoutes);
app.use('/twitter', twitterRoutes);
app.use('/facebook', fbRoutes);
//==============================================================================
/**
*Custom Error handler
*/
app.use(function (err, req, res, next) {
  console.error(err.stack);
  return res.status(500).render('pages/errors');
});
//==============================================================================
/**
*Export Module
*/
module.exports = app;
//==============================================================================
