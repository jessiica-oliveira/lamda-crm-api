'use strict'

const axios = require('axios')

const CONTACTS_URL =
  process.env.RD_API_URL || 'https://api.rd.services/crm/v2/contacts'

const pickFirst = (arr, key) => {
  if (!Array.isArray(arr) || arr.length === 0) return null

  const first = arr[0]
  if (first && typeof first === 'object' && key) {
    return first[key] ?? null
  }
  return first ?? null
}

const getContactsByPhone = async (access_token, phone, email) => {
  const headers = {
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
  }

  const params = {
    filter: `phone:${phone} AND email:${email}`,
    'page[number]': 1,
    'page[size]': 25,
  }

  try {
    const response = await axios.get(CONTACTS_URL, {
      headers,
      params,
      timeout: 10000,
    })

    const payload = response.data || {}

    const rawContacts = Array.isArray(payload.contacts)
      ? payload.contacts
      : Array.isArray(payload.data)
      ? payload.data
      : []

    const contacts = rawContacts
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        id: item.id ?? null,
        name: item.name ?? null,
        email: pickFirst(item.emails, 'email'),
        phone: pickFirst(item.phones, 'phone'),
      }))

    return { error: false, contacts, total: contacts.length }
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
  getContactsByPhone,
}
