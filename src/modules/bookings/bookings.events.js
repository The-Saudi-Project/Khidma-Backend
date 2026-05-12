const { EventEmitter } = require('events')

const bookingEmitter = new EventEmitter()
bookingEmitter.setMaxListeners(500)

module.exports = bookingEmitter
