'use strict'

const axios = require('axios')

const USERS_URL =
  process.env.RD_API_URL_USERS || 'https://api.rd.services/crm/v2/users'

const getUserById = async (access_token, userId) => {
  const headers = {
    Authorization: `Bearer ${access_token}`,
    Accept: 'application/json',
  }
  try {
    const response = await axios.get(`${USERS_URL}/${userId}`, {
      headers,
      timeout: 10000,
    })

    return { error: false, user: response.data }
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

const listVisibleUsers = async access_token => {
  const headers = {
    Authorization: `Bearer ${access_token}`,
    Accept: 'application/json',
  }

  const params = {
    filter: 'is:visible:true',
    'page[number]': 1,
    'page[size]': 200,
  }

  try {
    const response = await axios.get(USERS_URL, {
      headers,
      params,
      timeout: 10000,
    })

    const payload = response.data || {}

    const raw = Array.isArray(payload.data) ? payload.data : []

    const users = raw
      .map(item => {
        return {
          id: item?.id ?? null,
          name: item?.name ?? null,
          email: item?.email ?? null,
        }
      })
      .filter(u => u.id)

    return { error: false, users }
  } catch {
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

module.exports = { getUserById, listVisibleUsers }
