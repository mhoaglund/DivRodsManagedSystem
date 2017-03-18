//Status Code Canon:
//410 ~ Not yet implemented or feature removed.
//204 ~ Successful DELETE or PATCH
//422 ~ Something wrong with a remote resource (device/file/blob) used by this resource
//200 ~ B.A.U. and intact response from a GET
//201 ~ B.A.U. and intact responde from a PUT

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var nconf = require('nconf');
var passport = require('passport');
var Particle = require('particle-api-js');
particle = new Particle(), p_token = ""; //TODO: move the token to nconf.

nconf.file('../resources/config.json');

var index = require('./routes/index'),
users = require('./routes/users'),
generate = require('./routes/generate'),
setup = require('./routes/setup'),
onboard = require('./routes/onboard');

//Guess who forgets this? Me.
//Start command on win: set DEBUG=myapp:* & npm start
var app = express();

particle.login({username: nconf.get('email'), password: nconf.get('pass')}).then(
  function(data){
    console.log('Login succeeded. Token: ', data.body.access_token);
    p_token = data.body.access_token;
  },
  function(err) {
    console.log('Login failed: ', err);
  }
);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
app.use(passport.session());

app.use('/', index);
app.use('/users', users);
app.use('/generate', generate);
app.use('/setup', setup);
app.use('/onboard', onboard);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
