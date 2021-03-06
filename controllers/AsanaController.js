'use strict';

const AWMController = require('./AWMController');
const asanaConfig = require('../helpers/configHelper');
const asana = require('../helpers/asanaClient');

const mongodb = require('../helpers/mongodbHelper');
const AWMWebhook = require('../models/webhook');


class AsanaController extends AWMController {

	constructor(req, res) {

		//Init parent
		super(req, res);

		if (!asanaConfig.isReady()) return this.reply(501, {}, "Please update the AWM with your Asana App credentials configuration file");

		//Verify user access
		if (!req.cookies.token) return this.reply(401, {}, "Unauthorized request, please login with Asana");

		//Init Asana client
		this.client = asana(req.cookies.token);

	}

	/**
	 * getUser - returns the currently logged in user object
	 *
	 * @returns {Object}
	 * */
	getUser(){
		return this.client.users.me()
			.then(function (me) { return this.reply(200, me);}.bind(this))
			.catch(function (err) { return this.reply(400, {}, err);}.bind(this));
	}

	/**
	 * getWorkspaces - returns a list of workspaces for the current user
	 *
	 * @retruns {Array}
	 * */
	getWorkspaces(){
		return this.client.workspaces.findAll()
			.then(function (workspaces) { return this.reply(200,workspaces.data); }.bind(this))
			.catch(function (err) { return this.reply(400,{},err); }.bind(this));
	}

	/**
	 * getProjects - returns a list of projects for a given workspace
	 *
	 * @param {Integer} workspaceId
	 * @returns {Array}
	 * */
	getProjects(workspaceId){
		return this.client.projects.findByWorkspace(workspaceId)
			.then(function(projects){ return this.reply(200,projects.data) }.bind(this))
			.catch(function (err) { return this.reply(400, {}, err);}.bind(this));
	}

	/**
	 * getProjectsWithWebhooks - returns a list of projects for a given workspace along with a webhook object for each project
	 *
	 * @param {Integer} workspaceId
	 * @returns {Array}
	 * */
	getProjectsWithWebhooks(workspaceId){

		var retval = [];

		return this.client.projects.findByWorkspace(workspaceId)
			.then(function(projects){
				retval = projects.data;
				return this.client.webhooks.getAll(workspaceId);
			}.bind(this))
			.then(function(webhooks){

				//Create a map of resourceIds->webhookIds
				var resourceWebhooksMap = {};
				for (var i=0;i<webhooks.data.length;i++)
				{
					resourceWebhooksMap[webhooks.data[i].resource.id] = webhooks.data[i];
				}

				//Append to projects response
				for (var i=0;i<retval.length;i++)
				{
					retval[i].webhook = null;
					if (resourceWebhooksMap.hasOwnProperty(retval[i].id)) {
						retval[i].webhook = resourceWebhooksMap[retval[i].id];
					}
				}

				return this.reply(200, retval);
			}.bind(this))
			.catch(function (err) { return this.reply(400, {}, err);}.bind(this));
	}

	/**
	 * getWebhooks - returns a list of webhooks for a given workspace
	 *
	 * @param {Integer} workspaceId
	 * @returns {Array}
	 * */
	getWebhooks(workspaceId){
		return this.client.webhooks.getAll(workspaceId)
			.then(function (webhooks) { return this.reply(200, webhooks.data);}.bind(this))
			.catch(function (err) { return this.reply(400, {}, err);}.bind(this));
	}

	/**
	 * createWebhook - create a webhook for a given resourceId
	 *
	 * @param {Integer} resourceId - a project/task id
	 * @returns {Object}
	 * */
	createWebhook(resourceId){
		return this.client.webhooks.create(resourceId, "https://" + this.request().get('host') + "/events/incoming/"+resourceId)
			.then(function (response) { return this.reply(200,response); }.bind(this))
			.catch(function (err) { return this.reply(400,{},err); }.bind(this));
	}

	/**
	 * removeWebhook - delete (deregister) an existing webhook
	 *
	 * @param {Integer} webhookId
	 * @param {Integer} resourceId
	 * @param {Function} callback
	 * @returns {Object}
	 * */
	removeWebhook(webhookId,resourceId){

		var returnedResponse = null;

		var removeWebhook = new Promise(function(resolve,reject){
			this._unsubscribeWebhookFromAsana(webhookId)
				.then(function(responseFromAsana){
					returnedResponse = responseFromAsana;
					return this._removeWebhookFromDB(resourceId);
				}.bind(this))
				.then(function(responseFromDB){
					resolve(returnedResponse);
				}.bind(this))
				.catch(function(err){
					reject(err);
				}.bind(this));
		}.bind(this));

		return removeWebhook
			.then(function(response){return this.reply(200,response,"Webhook removed!")}.bind(this))
			.catch(function(err){return this.reply(400,err,"Unable to remove!")}.bind(this));

	}

	/**
	 * (private) _removeWebhookFromDB - removes a webhook record from AWM internal database
	 *
	 * @param {String} resourceId
	 * @returns {Promise}
	 * */
	_removeWebhookFromDB(resourceId){
		mongodb.getConnection();
		return AWMWebhook.find().remove({'resource_id':resourceId}).exec();
	}

	/**
	 * (private) _unsubscribeWebhookFromAsana - removed a webhook from Asana
	 * @returns {Promise}
	 * */
	_unsubscribeWebhookFromAsana(webhookId){
		return this.client.webhooks.deleteById(webhookId);
	}

}

module.exports = AsanaController;