'use strict';

var fs = require('fs'),
	winston = require('winston');

winston.emitErrs = false;

if ( !fs.existsSync( 'logs' ) ) {
	fs.mkdirSync( 'logs' );
}

var logger = new winston.Logger({
	transports: [
		new winston.transports.File({
			level: 'info',
			filename: './logs/app.log',
			handleExceptions: true,
			json: true,
			maxsize: 5242880, //5MB
			maxFiles: 5,
			colorize: false
		}),
		new winston.transports.Console({
			level: 'debug',
			handleExceptions: true,
			json: false,
			colorize: true
		})
	],
	exitOnError: false
});

module.exports = logger;
module.exports.stream = {
	write: function(message, encoding){
		logger.info(message);
	}
};
