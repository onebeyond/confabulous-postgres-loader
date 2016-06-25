var assert = require('chai').assert
var loader = require('..')
var EventEmitter = require('events').EventEmitter
var pg = require('pg')
var fs = require('fs')
var path = require('path')
var SETUP_SQL = fs.readFileSync(path.resolve('tests/postgres/setup.sql')).toString()
var TEARDOWN_SQL = fs.readFileSync(path.resolve('tests/postgres/teardown.sql')).toString()

describe('Postgres Loader', function() {

    var confabulous
    var client

    before(function(done) {
        client = new pg.Client('postgres://postgres@localhost:5000/postgres')
        client.connect(function(err) {
            if (err) return done(err)
            client.query(SETUP_SQL, [], done)
        })
    })

    beforeEach(function(done) {
        confabulous = new EventEmitter()
        client.query('TRUNCATE config', [], done)
    })

    afterEach(function(done) {
        confabulous.emit('reloading')
        confabulous.removeAllListeners()
        done()
    })

    after(function(done) {
        client.query(TEARDOWN_SQL, [], function(err) {
            client.end()
            done(err)
        })
    })

    it('should require url when mandatory', function(done) {
        loader({})(confabulous, function(err, config) {
            assert(err)
            assert.equal(err.message, 'url is required')
            done()
        })
    })

    it('should require query when mandatory', function(done) {
        loader({ url: 'postgres://postgres@localhost:5000/postgres'})(confabulous, function(err, config) {
            assert(err)
            assert.equal(err.message, 'query is required')
            done()
        })
    })

    it('should require watch interval when watching', function(done) {
        loader({ url: 'postgres://postgres@localhost:5000/postgres', query: 'SELECT data from config', watch: { }})(confabulous, function(err, config) {
            assert(err)
            assert.equal(err.message, 'watch interval is required')
            done()
        })
    })

    it('should require watch query when watching', function(done) {
        loader({ url: 'postgres://postgres@localhost:5000/postgres', query: 'SELECT data from config', watch: { interval: '1m' }})(confabulous, function(err, config) {
            assert(err)
            assert.equal(err.message, 'watch query is required')
            done()
        })
    })

    it('should load configuration', function(done) {
        client.query('INSERT INTO config (KEY, DATA) VALUES ($1, $2)', ['test', { loaded: 'loaded' }], function(err) {
            assert.ifError(err)

            loader({
                url: 'postgres://postgres@localhost:5000/postgres',
                query: 'SELECT data FROM config WHERE key=$1',
                params: ['test']
            })(confabulous, function(err, config) {
                assert.ifError(err)
                assert.equal(config[0].data.loaded, 'loaded')
                done()
            })
        })
    })

    it('should report connection errors', function(done) {
        loader({ url: 'postgres://postgres@localhost:9999/postgres', query: 'SELECT data FROM missing' })(confabulous, function(err, config) {
            assert(err)
            assert(/ECONNREFUSED/.test(err.message), err.message)
            done()
        })
    })

    it('should report query errors', function(done) {
        loader({ url: 'postgres://postgres@localhost:5000/postgres', query: 'BAD SQL' })(confabulous, function(err, config) {
            assert(err)
            assert(/syntax error at or near "BAD"/.test(err.message), err.message)
            done()
        })
    })

    it('should emit change event when config is updated', function(done) {

        client.query('INSERT INTO config (KEY, DATA) VALUES ($1, $2)', ['test', { loaded: 'loaded' }], function(err) {
            assert.ifError(err)

            loader({
                url: 'postgres://postgres@localhost:5000/postgres',
                query: 'SELECT data FROM config WHERE key=$1',
                params: ['test'],
                watch: {
                    query: 'SELECT last_modified FROM config WHERE key=$1',
                    params: ['test'],
                    interval: '1s'
                }
            })(confabulous, function(err, config) {
                assert.ifError(err)
                assert.equal(config[0].data.loaded, 'loaded')

                client.query('UPDATE config SET DATA=$2 WHERE key=$1', ['test', { loaded: 'reloaded' }], assert.ifError)
            }).on('change', done)
        })
    })

    it('should emit change event when a previously existing key is deleted', function(done) {

        client.query('INSERT INTO config (KEY, DATA) VALUES ($1, $2)', ['test', { loaded: 'loaded' }], function(err) {
            assert.ifError(err)

            loader({
                url: 'postgres://postgres@localhost:5000/postgres',
                query: 'SELECT data FROM config WHERE key=$1',
                params: ['test'],
                watch: {
                    query: 'SELECT last_modified FROM config WHERE key=$1',
                    params: ['test'],
                    interval: '1s'
                }
            })(confabulous, function(err, config) {
                assert.ifError(err)
                assert.equal(config[0].data.loaded, 'loaded')
                client.query('DELETE FROM config WHERE key=$1', ['test'], assert.ifError)
            }).on('change', done)
        })
    })

    it('should emit change event when a previously missing key is created', function(done) {

        loader({
            url: 'postgres://postgres@localhost:5000/postgres',
            query: 'SELECT data FROM config WHERE key=$1',
            params: ['test'],
            watch: {
                query: 'SELECT last_modified FROM config WHERE key=$1',
                params: ['test'],
                interval: '1s'
            }
        })(confabulous, function(err, config) {
            assert.ifError(err)
            client.query('INSERT INTO config (KEY, DATA) VALUES ($1, $2)', ['test', { loaded: 'loaded' }], assert.ifError)
        }).on('change', done)
    })

    it('should not emit change event when config is not updated', function(done) {

        client.query('INSERT INTO config (KEY, DATA) VALUES ($1, $2)', ['test', { loaded: 'loaded' }], function(err) {
            assert.ifError(err)

            loader({
                url: 'postgres://postgres@localhost:5000/postgres',
                query: 'SELECT data FROM config WHERE key=$1',
                params: ['test'],
                watch: {
                    query: 'SELECT last_modified FROM config WHERE key=$1',
                    params: ['test'],
                    interval: '1s'
                }
            })(confabulous, function(err, config) {
                assert.ifError(err)
                assert.equal(config[0].data.loaded, 'loaded')
                setTimeout(done, 1500)
            }).on('change', function() {
                assert(false, 'Config was not updated')
            })
        })
    })

    it('should post-process', function(done) {

        client.query('INSERT INTO config (KEY, DATA) VALUES ($1, $2)', ['test', { loaded: 'loaded' }], function(err) {
            assert.ifError(err)

            loader({
                url: 'postgres://postgres@localhost:5000/postgres',
                query: 'SELECT data FROM config WHERE key=$1',
                params: ['test']
            }, [
              function(config, cb) {
                  cb(null, config[0].data)
              }
            ])(confabulous, function(err, config) {
                assert.ifError(err)
                assert.equal(config.loaded, 'loaded')
                done()
            })
        })
    })
})