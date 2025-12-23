'use strict'

const axios = require('axios')

const DEALS_URL =
  process.env.RD_API_URL_DEALS || 'https://api.rd.services/crm/v2/deals'

const extractDealEssentials = deal => {
  return {
    id: deal?.id ?? null,
    name: deal?.name ?? null,
    total_price: deal?.total_price ?? deal?.amount ?? null,
    status: deal?.status ?? null,
    owner_id: deal?.owner_id ?? deal?.owner?.id ?? null,
    contacts_id: deal.contact_ids,
  }
}

const getDealsByContactId = async (access_token, contactId) => {
  const headers = {
    Authorization: `Bearer ${access_token}`,
    Accept: 'application/json',
  }

  const params = {
    filter: `contact_id:${contactId} AND (status:ongoing OR status:paused)`,
    'page[number]': 1,
    'page[size]': 25,
  }

  try {
    const response = await axios.get(DEALS_URL, {
      headers,
      params,
      timeout: 10000,
    })

    const payload = response.data || {}
    const rawDeals = Array.isArray(payload.data) ? payload.data : []

    // 🔹 só campos essenciais
    const deals = rawDeals.map(extractDealEssentials)

    return {
      error: false,
      deals,
      total: deals.length,
    }
  } catch (error) {
    if (error.response) {
      return {
        error: true,
        message: `API returned ${error.response.status}`,
        status: error.response.status,
        details: error.response.data,
      }
    }

    return { error: true, message: error.message }
  }
}

module.exports = {
  getDealsByContactId,
}
