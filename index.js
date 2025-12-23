'use strict'

const { normalizePhone, mask } = require('./utils')
const { getAccessTokenFromRefresh } = require('./rdAuth')
const { getContactsByPhone } = require('./rdContacts')

/**
 * Lambda Handler
 */
exports.handler = async (event, context) => {
  try {
    const debug = !!process.env.RD_DEBUG
    if (debug) {
      console.log('🔎 DEBUG ativo')
      console.log('Event recebido:', JSON.stringify(event))
    }

    /* ===============================
       NORMALIZA BODY
       Aceita:
       - event.body (API Gateway)
       - event direto (execução local)
       - string JSON
    =============================== */
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

    const body = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr

    // VALIDA PHONE
    const phoneRaw = body?.contact?.phone
    if (!phoneRaw)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'contact.phone not found' }),
      }

    const phone = normalizePhone(phoneRaw)

    // TOKEN: ENV OU REFRESH
    const envAccess =
      process.env.access_token || process.env.RD_CRM_ACCESS_TOKEN

    let accessToken = null

    const tokenInfo = {
      access_token_source: null,
      access_token_preview: null,
      refresh_token_rotated: false,
      refresh_token_persist_status: null,
    }

    if (envAccess) {
      accessToken = envAccess
      tokenInfo.access_token_source = 'env'
      tokenInfo.access_token_preview = mask(accessToken)
    }

    let contactsResult = null

    // BUSCA CONTATOS
    if (accessToken) {
      contactsResult = await getContactsByPhone(accessToken, phone)

      // Token inválido → tenta refresh
      if (
        contactsResult?.error &&
        contactsResult?.status === 401 &&
        process.env.RD_CRM_REFRESH_TOKEN
      ) {
        try {
          const newTokenInfo = await getAccessTokenFromRefresh()

          accessToken = newTokenInfo.access_token
          tokenInfo.access_token_source = 'refresh_fallback'
          tokenInfo.access_token_preview = mask(accessToken)
          tokenInfo.refresh_token_rotated = newTokenInfo.refresh_token_rotated
          tokenInfo.refresh_token_persist_status = newTokenInfo.persist_status

          contactsResult = await getContactsByPhone(accessToken, phone)
        } catch (err) {
          contactsResult.refresh_error = err.message
        }
      }
    } else {
      // Sem token no env → refresh direto
      try {
        const newTokenInfo = await getAccessTokenFromRefresh()

        accessToken = newTokenInfo.access_token
        tokenInfo.access_token_source = 'refresh'
        tokenInfo.access_token_preview = mask(accessToken)
        tokenInfo.refresh_token_rotated = newTokenInfo.refresh_token_rotated
        tokenInfo.refresh_token_persist_status = newTokenInfo.persist_status

        contactsResult = await getContactsByPhone(accessToken, phone)
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
      }
    }

    if (!contactsResult) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'contacts lookup not performed' }),
      }
    }

    const responseBody = { phone_normalized: phone, ...tokenInfo }

    if (contactsResult.error) {
      responseBody.error = contactsResult.message || 'request failed'
      if (contactsResult.status)
        responseBody.error_status = contactsResult.status
      if (contactsResult.details)
        responseBody.error_details = contactsResult.details
      if (contactsResult.refresh_error)
        responseBody.refresh_error = contactsResult.refresh_error
    } else {
      responseBody.contacts_found = contactsResult.total
      responseBody.contacts = contactsResult.contacts
    }

    return { statusCode: 200, body: JSON.stringify(responseBody) }
  } catch (err) {
    console.error('❌ Unhandled exception', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

//EXECUÇÃO LOCAL
if (require.main === module) {
  require('dotenv').config()

  const sampleEvent = {
    body: JSON.stringify({ contact: { phone: '11984196634' } }),
  }

  console.log('▶️ Rodando localmente...')
  exports
    .handler(sampleEvent)
    .then(res => console.log(JSON.parse(res.body)))
    .catch(console.error)
}
