'use strict'

const { normalizePhone, mask, pickRandomExcluding } = require('./utils')
const { getAccessTokenFromRefresh } = require('./rdAuth')
const { getContactsByPhone } = require('./rdContacts')
const { getDealsByContactId, updateDealOwner } = require('./rdDeals')
const { getUserById, listVisibleUsers } = require('./rdUsers')
const { parseEventBody } = require('./workflow/parseEvent')

exports.handler = async (event, context) => {
  try {
    const debug = !!process.env.RD_DEBUG

    if (debug) {
      console.log('🔎 DEBUG ativo')
      console.log('Event recebido:', JSON.stringify(event))
    }

    //  1) Normalização do body (string / object / base64)
    const body = parseEventBody(event)

    //  2) Extrair e normalizar telefone (email é opcional)
    const phoneRaw = body?.contact?.phone
    const emailRaw = body?.contact?.email || null

    if (!phoneRaw) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'contact.phone not found' }),
      }
    }

    const phone = normalizePhone(phoneRaw)

    //  3) Resolver access_token (env → refresh → fallback)
    const { accessToken: token0, tokenInfo } = await resolveAccessToken()

    /* ------------------------------------------------------------------
     * 4) Buscar contatos pelo telefone (OU telefone+email se vier)
     * ------------------------------------------------------------------ */
    const { accessToken, contactsResult, tokenInfoPatch } = await findContacts({
      accessToken: token0,
      phone,
      emailRaw,
    })

    const responseBody = {
      phone_normalized: phone,
      input_email: emailRaw,
      search_mode: emailRaw ? 'phone+email' : 'phone_only',
      ...tokenInfo,
      ...(tokenInfoPatch || {}),
    }

    if (!contactsResult) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ...responseBody,
          error: 'Não foi possível realizar a busca de contatos.',
        }),
      }
    }

    if (contactsResult.error) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ...responseBody,
          error: contactsResult.message || 'contacts error',
          error_status: contactsResult.status ?? null,
          error_details: contactsResult.details ?? null,
        }),
      }
    }

    responseBody.contacts_found = contactsResult.total
    responseBody.contacts = contactsResult.contacts

    /* ------------------------------------------------------------------
     * 6) Buscar deals para TODOS os contact_ids (IDs únicos)
     * ------------------------------------------------------------------ */
    const dealsInfo = await findDealsByContacts({
      accessToken,
      contacts: contactsResult.contacts,
    })

    const dealsByContactId = dealsInfo.dealsByContactId
    responseBody.deals_contacts_checked = dealsInfo.deals_contacts_checked
    responseBody.deals_contacts_with_deals = dealsInfo.deals_contacts_with_deals

    /* ------------------------------------------------------------------
     * 7) (OPCIONAL) Reatribuir owner aleatoriamente com base em users visíveis
     *    - escolhe um user visível aleatório diferente do owner atual
     *    - atualiza deal via /crm/v2/deals/{id}
     * ------------------------------------------------------------------ */

    // reatribuição opcional
    const rotation = await rotateDealOwnersIfEnabled({
      accessToken,
      dealsByContactId,
    })
    responseBody.owner_rotation_enabled = rotation.enabled
    if (rotation.enabled) responseBody.owner_changes = rotation.owner_changes

    // enriquece deals com owner_name/owner_email e devolve
    responseBody.deals_by_contact_id = await enrichDealsWithOwnerInfo({
      accessToken,
      dealsByContactId,
    })

    return { statusCode: 200, body: JSON.stringify(responseBody) }
  } catch (err) {
    console.error('❌ Unhandled exception:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    }
  }
}

// EXECUÇÃO LOCAL
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
