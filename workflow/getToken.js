'use strict'

const { mask } = require('../utils')
const { getAccessTokenFromRefresh } = require('../rdAuth')

const resolveAccessToken = async () => {
  const envAccess = process.env.access_token || process.env.RD_CRM_ACCESS_TOKEN

  const tokenInfo = {
    access_token_source: null,
    access_token_preview: null,
    refresh_token_rotated: false,
    refresh_token_persist_status: null,
  }

  if (envAccess) {
    return {
      accessToken: envAccess,
      tokenInfo: {
        ...tokenInfo,
        access_token_source: 'env',
        access_token_preview: mask(envAccess),
      },
    }
  }

  const newTokenInfo = await getAccessTokenFromRefresh()

  return {
    accessToken: newTokenInfo.access_token,
    tokenInfo: {
      ...tokenInfo,
      access_token_source: 'refresh',
      access_token_preview: mask(newTokenInfo.access_token),
      refresh_token_rotated: newTokenInfo.refresh_token_rotated,
      refresh_token_persist_status: newTokenInfo.persist_status,
    },
  }
}

module.exports = { resolveAccessToken }
