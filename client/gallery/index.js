/* Copyright (c) 2012, Ben Trask
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY BEN TRASK ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL BEN TRASK BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/*global Index config DOM bt*/
if(!config.windowState) config.windowState = function() {
	var state = {};
	state.path = window.location.pathname || "/";
	state.components = decodeURI(state.path).slice(1).split("/");
	state.id = state.components.shift();
	state.hash = state.components.shift();
	if("id" !== state.id) return null;
	return state;
};
if(!config.rootIndexURLFromHash) config.rootIndexURLFromHash = function(hash) {
	return "/id/"+hash+"?type=index&format=json";
};
if(!config.rootIndexURL) config.rootIndexURL = function() {
	var state = config.windowState();
	return state ? config.rootIndexURLFromHash(state.hash) : null;
};
if(!config.init) config.init = function() {
	var indexURL = config.rootIndexURL();
	if(indexURL) {
		var index = new Index(indexURL);
		document.body.appendChild(index.element);
		index.load();
		DOM.addListener(window, "popstate", function(event) {
			if(event && null !== event.state) index.load();
		});
	} else {
		// TODO: Some sort of blank page thing?
	}
};
if(!config.components) config.components = function() {
	var state = config.windowState();
	if(!state) return [];
	var components = state.components;
	if("" === components[components.length - 1]) components.pop();
	return components;
};
if(!config.path) config.path = function(node) {
	var state = config.windowState();
	if(!state) return null;
	var components = bt.map(node.ancestors().slice(1), function(ancestor) {
		return ancestor.name;
	});
	return encodeURI(["", state.id, state.hash].concat(components).join("/"));
};
if(!config.thumbErrorURL) config.thumbErrorURL = "/gallery/error.png";

config.init();
