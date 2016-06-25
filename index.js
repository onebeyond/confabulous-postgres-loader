var debug = require('debug')('confabulous:loaders:postgres')
var EventEmitter = require('events').EventEmitter
var pg = require('pg');
var async = require('async')
var merge = require('lodash.merge')
var duration = require('parse-duration')

module.exports = function(_options, postProcessors) {

    var options = merge({}, { mandatory: true, watch: false }, _options)
    var etag
    var emitter = new EventEmitter()

    return function(confabulous, cb) {
        debug('running')
        setImmediate(function() {
            async.waterfall([validate, init, watch, load], function(err, result) {
                if (err) return cb(err)
                async.seq.apply(async, postProcessors)(result, cb)
            })
        })
        return emitter

        function validate(cb) {
            debug('validate: %s', JSON.stringify(options))
            if (options.mandatory && !options.url) return cb(new Error('url is required'))
            if (options.mandatory && !options.query) return cb(new Error('query is required'))
            if (options.watch && !options.watch.interval) return cb(new Error('watch interval is required'))
            if (options.watch && !options.watch.query) return cb(new Error('watch query is required'))
            cb(!options.query || !options.url)
        }

        function init(cb) {
            debug('init: %s', options.url)
            if (!options.watch) return cb()

            var client = new pg.Client(options.url)
            client.connect(function(err) {
                if (err) return cb(err)
                client.query(options.watch.query, options.watch.params || [], function(err, result) {
                    client.end()
                    if (err) return cb(err)
                    etag = JSON.stringify(result.rows[0])
                    cb()
                })
            })
        }

        function watch(cb) {
            if (!options.watch) return cb()
            debug('watch: %s, interval:%s', options.watch.query, options.watch.interval)
            var watcher = setInterval(function() {
                debug('checking for changes to: %s', options.watch.query)
                var client = new pg.Client(options.url)
                client.connect(function(err) {
                    if (err) return emitter.emit('error', err)
                    client.query(options.watch.query, options.watch.params || [], function(err, result) {
                        client.end()
                        if (err) return emitter.emit('error', err)
                        if (isModified(result)) emitter.emit('change')
                    })
                })
            }, duration(options.watch.interval))
            watcher.unref()
            confabulous.on('reloading', function() {
                clearInterval(watcher)
                watcher = null
            })
            return cb()
        }

        function load(cb) {
            debug('load: %s', options.query)
            var client = new pg.Client(options.url)
            client.connect(function(err) {
                if (err) return cb(err)
                client.query(options.query, options.params || [], function(err, result) {
                    client.end()
                    cb(err, result && result.rows)
                })
            })
        }

        function isModified(result) {
            var newEtag = JSON.stringify(result.rows[0])
            var modified = etag !== newEtag
            etag = newEtag
            return modified
        }
    }
}