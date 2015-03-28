'use strict';

process.env.SUPPRESS_NO_CONFIG_WARNING = 'y';

var _ = require('lodash'),
	Config = require('Config'),
	cluster = require('cluster'),
	Logger = require('./utils/Logger');

var BootDefaultConfigs = {
	cooldown: 25,
	retries: 5,
	processes: 4
};

module.exports = function(configs) {

	Config.util.extendDeep(BootDefaultConfigs, configs);
	Config.util.setModuleDefaults('Boot', BootDefaultConfigs);

	function Moraine(){
		return;
	}

	Moraine.Injector = require('./utils/Injector');

	Moraine.Injector.register('Logger', Logger);
	Moraine.Injector.register('Config', Config);

	var cooldown = Config.get('Boot.cooldown'),
		processes = Config.get('Boot.processes'),
		_processes = [],
		restarts = [],
		retries = Config.get('Boot.retries');

	function restart() {
		var now = new Date().getTime();

		restarts = restarts.filter(function (restartTime) {
			return restartTime > (now - cooldown * 60 * 1000);
		});

		restarts.push(now);

		if (restarts.length < retries) {
			cluster.fork();
			return true;
		}

		return false;
	}

	function launch() {

		var domain = require('domain');

		var d = domain.create();
		d.on('error', function (er) {
			Logger.error('Process %s has failed', process.pid);
			Logger.error('error', er.stack);

			try {
				// make sure we close down within 30 seconds
				var killtimer = setTimeout(function () {
					process.exit(1);
				}, 30000);

				// But don't keep the process open just for that!
				killtimer.unref();

				// trigger a 'disconnect' in the cluster master
				if (cluster) {
					cluster.worker.disconnect();
				}

			} catch (er2) {
				// oh well, not much we can do at this point.
				Logger.error('Error handling gracefully', er2.stack);
			}
		});

		// Now run the handler function in the domain.
		d.run(function () {
			Logger.info('starting cluster with pid: ' + process.pid);
			_.each(_processes, function(_process){
				Moraine.Injector.process(_process);
			});
		});
	}

	Moraine.start = function start() {
		if (cluster.isMaster) {

			Logger.info('started master with pid: ' + process.pid);

			for (var i = 0; i < processes; i++) {
				cluster.fork();
			}

			cluster.on('disconnect', function (worker) {
				if (!restart()) {

					Logger.info('too many restarts within the last %s minutes...', cooldown);

					var chillout = setTimeout(function () {
						restart();
					}, cooldown * 60 * 1000);

					chillout.unref();
				}
			});

			process.on('exit', function (code) {
				Logger.info('Master process died with code: ' + code);
			});

		} else {
			launch();
		}
	};

	Moraine.register = function (func){
		_processes.push(func);
	}

	return new Promise(function (resolve, reject) {
		resolve(Moraine);
	});
}
