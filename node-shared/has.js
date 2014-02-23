// Public domain, obviously.

module.exports = function(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
};

