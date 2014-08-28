/* Copyright 2014 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 *	@oadaLogin
 *
 *	Client side Javascript library for logging in to an OADA service provider.
 *
 *	@author Alex Layton
 *	@copyright Purdue University 2014
 *	@license Apache Version 2.0 http://www.apache.org/licenses/LICENSE-2.0
 */

var oadaLogin = (function() {
	"use strict";

	// Object for the instance of this module
	var mod = {};

	var options = {
		// TODO: Handle a "default" redirect to self
		response_type: "token id_token",
		display: "popup",
	};

	var state, conf;

	var loginCallback = function(){};

	mod.init = function(opts) {
		for (var opt in opts) {
			options[opt] = opts[opt];
		}
	};

	mod.login = function(domain, callback, opts) {
		state = Math.random();

		// Override options
		opts = typeof opts !== 'undefined' ? opts : {};
		for (var opt in options) {
			if (typeof opts[opt] === 'undefined') {
				opts[opt] = options[opt];
			}
		}

		// Can't open windows in callbacks lest we anger the popup blockers
		var loginWindow = window.open("", "_blank", "width=500,height=400");

		// Get OADA configuration
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = receiveConfig;
		xmlhttp.open("GET", "http://" + domain +
				"/.well-known/oada-configuration", true);
		xmlhttp.send();

		// Called with GET result
		function receiveConfig() {
			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
				conf = JSON.parse(xmlhttp.responseText);

				// Construct URL
				var url = conf.authorization_endpoint +
					"?state=" + encodeURIComponent(state);
				for (var opt in opts) {
					url += "&" + opt + "=" + encodeURIComponent(opts[opt]);
				}

				loginCallback = typeof callback !== 'undefined' ?
						callback : function(){};

				// Use window opened before callback
				loginWindow.location.assign(url);
			}
		}
	};

	mod.setParameters = function(params) {
		if (params.state === state.toString()) {
			loginCallback(conf, params);
		}
	};

	mod.handleRedirect = function() {
		var REGEX = /([^&=]+)=([^&]*)/g;

		var hash = window.location.hash;
		var params = {};
		var m;
		while ((m = REGEX.exec(hash.substr(1))) !== null) {
			var key = decodeURIComponent(m[1]);
			var value = decodeURIComponent(m[2]);
			params[key] = value;
		}

		// Gross?
		window.opener.oadaLogin.setParameters(params);
		window.close();
	};

	return mod;

}());

