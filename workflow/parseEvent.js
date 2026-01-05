'use strict'

const parseEventBody = event => {
  let bodyStr

  if (typeof event === 'string') {
    bodyStr = event
  } else if (event && typeof event === 'object') {
    bodyStr = event.body ? event.body : JSON.stringify(event)
  } else {
    bodyStr = JSON.stringify(event)
  }

  if (event?.isBase64Encoded) {
    bodyStr = Buffer.from(bodyStr, 'base64').toString('utf8')
  }

  return typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr
}

module.exports = { parseEventBody }
