[![Build Status](https://travis-ci.org/guidesmiths/confabulous-postgres-loader.png)](https://travis-ci.org/guidesmiths/confabulous-postgres-loader)
# Confabulous Postgres Loader
Confabulous-Postgres-Loader is an PostgreSQL Loader for [Confabulous](https://github.com/guidesmiths/confabulous) - a hierarchical, asynchronous config loader and post processor.

## TL;DR
```
const confabulous = require('confabulous')
const postgres = require('confabulous-postgres-loader')
const Confabulous = confabulous.Confabulous
const processors = confabulous.processors

new Confabulous()
    .add((config) => postgres({ url: 'postgres://user:secret@localhost:5432/config', key: 'config' }, [
      (rows, cb) => {
          cb(null, rows[0].data)
      }
    ]))
    .on('loaded', (config) => console.log('Loaded', JSON.stringify(config, null, 2)))
    .on('reloaded', (config) => console.log('Reloaded', JSON.stringify(config, null, 2)))
    .on('error', (err) => console.error('Error', err))
    .on('reload_error', (err) => console.error('Reload Error', err))
    .end()
```

### Options
|  Option  |  Type  |  Default  |  Notes  |
|----------|--------|-----------|---------|
| url      | string    |        | Postgres connection url |
| query    | string    |        | Query for selecting config |
| params   | array     | []     | Parameters to be passed to query |
| mandatory | boolean  | true   | Causes an error/reload_error to be emitted if the configuration does not exist |
| watch     | object   |        | Configures the watcher ```{ query: 'SELECT last_modified FROM config WHERE key=$1', params: ['my-app']}```, interval: '5m' } |



