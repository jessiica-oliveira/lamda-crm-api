'use strict'

const axios = require('axios')

const getDealsByContactId = async (access_token, contactId) => {
  const headers = {
    Authorization: `Bearer ${access_token}`,
    Accept: 'application/json',
  }

  const params = {
    filter: `contacts.id:${contactId}`,
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
    const deals = Array.isArray(payload.deals) ? payload.deals : []

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
