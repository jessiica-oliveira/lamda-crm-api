'use strict'

const { normalizePhone, mask } = require('./utils')
const { getAccessTokenFromRefresh } = require('./rdAuth')
const { getContactsByPhone } = require('./rdContacts')
const { getDealsByContactId } = require('./rdDeals')

exports.handler = async (event, context) => {
  try {
    const debug = !!process.env.RD_DEBUG
    if (debug) {
      console.log('🔎 DEBUG ativo')
      console.log('Event recebido:', JSON.stringify(event))
    }
    /* ------------------------------------------------------------------
     * 1) Normalização do body (string / object / base64)
     * ------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------
     * 2) Extrair e normalizar telefone
     * ------------------------------------------------------------------ */
    const phoneRaw = body?.contact?.phone
    const email = body?.contact?.email

    if (!phoneRaw) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'contact.phone not found' }),
      }
    }

    const phone = normalizePhone(phoneRaw)

    /* ------------------------------------------------------------------
     * 3) Resolver access_token (env → refresh → fallback)
     * ------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------
     * 4) Buscar contatos pelo telefone
     * ------------------------------------------------------------------ */
    let contactsResult = null

    if (accessToken) {
      contactsResult = await getContactsByPhone(accessToken, phone, email)

      // Token expirado → tenta refresh fallback
      if (
        contactsResult?.error &&
        contactsResult?.status === 401 &&
        process.env.RD_CRM_REFRESH_TOKEN
      ) {
        const newTokenInfo = await getAccessTokenFromRefresh()

        accessToken = newTokenInfo.access_token
        tokenInfo.access_token_source = 'refresh_fallback'
        tokenInfo.access_token_preview = mask(accessToken)
        tokenInfo.refresh_token_rotated = newTokenInfo.refresh_token_rotated
        tokenInfo.refresh_token_persist_status = newTokenInfo.persist_status

        contactsResult = await getContactsByPhone(accessToken, phone, email)
      }
    } else {
      // Não tem token env → refresh direto
      const newTokenInfo = await getAccessTokenFromRefresh()

      accessToken = newTokenInfo.access_token
      tokenInfo.access_token_source = 'refresh'
      tokenInfo.access_token_preview = mask(accessToken)
      tokenInfo.refresh_token_rotated = newTokenInfo.refresh_token_rotated
      tokenInfo.refresh_token_persist_status = newTokenInfo.persist_status

      contactsResult = await getContactsByPhone(accessToken, phone, email)
    }

    if (!contactsResult) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'contacts lookup not performed' }),
      }
    }

    /* ------------------------------------------------------------------
     * 5) Montar resposta base
     * ------------------------------------------------------------------ */
    const responseBody = { phone_normalized: phone, ...tokenInfo }

    if (contactsResult.error) {
      responseBody.error = contactsResult.message || 'contacts error'
      if (contactsResult.status)
        responseBody.error_status = contactsResult.status
      if (contactsResult.details)
        responseBody.error_details = contactsResult.details

      return {
        statusCode: 200,
        body: JSON.stringify(responseBody),
      }
    }

    /* ------------------------------------------------------------------
     * 6) Buscar deals para TODOS os contact_ids (IDs únicos)
     * ------------------------------------------------------------------ */
    responseBody.contacts_found = contactsResult.total
    responseBody.contacts = contactsResult.contacts

    const contacts = contactsResult.contacts || []
    const contactIds = [...new Set(contacts.map(c => c?.id).filter(Boolean))]

    const dealsByContactId = {}

    await Promise.all(
      contactIds.map(async contactId => {
        const dealsRes = await getDealsByContactId(accessToken, contactId)

        // Mapa { contact_id -> deals[] | erro }
        if (dealsRes.error) {
          dealsByContactId[contactId] = {
            error: true,
            message: dealsRes.message,
            status: dealsRes.status,
            details: dealsRes.details,
          }
        }

        if (Array.isArray(dealsRes.deals) && dealsRes.deals.length > 0) {
          dealsByContactId[contactId] = dealsRes.deals
        }
      })
    )

    responseBody.deals_by_contact_id = dealsByContactId
    responseBody.deals_contacts_checked = contactIds.length

    /* ------------------------------------------------------------------
     * 7) Retorno final
     * ------------------------------------------------------------------ */
    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
    }
  } catch (err) {
    console.error('❌ Unhandled exception:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

//EXECUÇÃO LOCAL
if (require.main === module) {
  require('dotenv').config()

  const sampleEvent = {
    body: JSON.stringify({
      contact: { phone: '11984196634', email: 'sabrina.honorato19@gmail.com' },
    }),
  }

  console.log('▶️ Rodando localmente...')
  exports
    .handler(sampleEvent)
    .then(res => console.dir(JSON.parse(res.body), { depth: null }))
    .catch(console.error)
}
