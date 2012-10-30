// Based on <http://dbaron.org/log/20100309-faster-timeouts>
var setZeroTimeout = (function() {
	if(!window.postMessage || !window.addEventListener) {
		return function(fn) {
			setTimeout(fn, 0);
		};
	}

	var timeouts = [];
	var messageName = "zero-timeout-message";

	// Like setTimeout, but only takes a function argument.  There's
	// no time argument (always zero) and no arguments (you have to
	// use a closure).
	function setZeroTimeout(fn) {
		timeouts.push(fn);
		window.postMessage(messageName, "*");
	}

	function handleMessage(event) {
		if (event.source == window && event.data == messageName) {
			event.stopPropagation();
			if (timeouts.length > 0) {
				var fn = timeouts.shift();
				fn();
			}
		}
	}

	window.addEventListener("message", handleMessage, true);

	return setZeroTimeout;
})();
