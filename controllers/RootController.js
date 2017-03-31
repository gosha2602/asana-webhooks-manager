'use strict';

const AWMController = require('./AWMController');
const path = require("path");

class RootController extends AWMController{

	constructor(req,res){
		super(req,res);
	}

	getApp(){
		return this._response.sendFile(path.join(__dirname,'../public/client/views','index.html'));}
	}



module.exports = RootController;