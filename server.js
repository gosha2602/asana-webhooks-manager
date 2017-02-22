const express = require('express');
const config = require('./config/index');
const hbs = require('hbs');
const routes = require('./routes');
const cookieParser = require('cookie-parser')

var app = express();

hbs.registerPartials(__dirname+'/views/partials');

app.set('view engine','hbs');
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());
//app.use(restResponse);
app.use('/',routes);



app.listen(3000);
console.log('App running...!');