'use strict'

const { getAccessTokenFromRefresh } = require('../rdAuth')
const { mask } = require('../utils')
const { getContactsByPhone } = require('../rdContacts')

const findContacts = async ({ accessToken, phone, emailRaw }) => {
  let contactsResult = await getContactsByPhone(accessToken, phone, emailRaw)

  // Token expirado → tenta refresh fallback
  if (
    contactsResult?.error &&
    contactsResult?.status === 401 &&
    process.env.RD_CRM_REFRESH_TOKEN
  ) {
    const newTokenInfo = await getAccessTokenFromRefresh()
    const newAccessToken = newTokenInfo.access_token

    const tokenInfoPatch = {
      access_token_source: 'refresh_fallback',
      access_token_preview: mask(newAccessToken),
      refresh_token_rotated: newTokenInfo.refresh_token_rotated,
      refresh_token_persist_status: newTokenInfo.persist_status,
    }

    contactsResult = await getContactsByPhone(newAccessToken, phone, emailRaw)

    return {
      accessToken: newAccessToken,
      contactsResult,
      tokenInfoPatch,
    }
  }

  return { accessToken, contactsResult, tokenInfoPatch: null }
}

module.exports = { findContacts }
