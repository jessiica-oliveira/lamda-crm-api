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

module.exports = { getUserById }
