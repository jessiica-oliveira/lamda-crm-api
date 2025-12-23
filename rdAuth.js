'use strict'

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const AWS = require('aws-sdk')

const { mask } = require('./utils')

const RD_AUTH_URL =
  process.env.RD_AUTH_URL || 'https://api.rd.services/oauth2/token'

const getAccessTokenFromRefresh = async () => {
  try {
    const {
      RD_CRM_CLIENT_ID,
      RD_CRM_CLIENT_SECRET,
      RD_CRM_REFRESH_TOKEN,
      RD_DEBUG,
    } = process.env

    const old_refresh_token = RD_CRM_REFRESH_TOKEN

    if (!RD_CRM_CLIENT_ID || !RD_CRM_CLIENT_SECRET || !RD_CRM_REFRESH_TOKEN) {
      throw new Error(
        'Missing RD_CRM_CLIENT_ID / RD_CRM_CLIENT_SECRET / RD_CRM_REFRESH_TOKEN for refresh flow'
      )
    }

    if (RD_DEBUG) {
      console.log('🔄 Gerando access_token via refresh_token')
      console.log('RD_AUTH_URL:', RD_AUTH_URL)
      console.log('Old refresh token:', mask(old_refresh_token, 8))
    }

    const params = new URLSearchParams({
      client_id: RD_CRM_CLIENT_ID,
      client_secret: RD_CRM_CLIENT_SECRET,
      refresh_token: old_refresh_token,
      grant_type: 'refresh_token',
    })

    const response = await axios.post(RD_AUTH_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    })

    const access_token = response.data?.access_token
    const refresh_token = response.data?.refresh_token

    if (!access_token) throw new Error('access_token not returned by RD')

    const rotated = !!(refresh_token && refresh_token !== old_refresh_token)

    let persist_status = {
      env_updated: false,
      lambda_updated: false,
      reason: 'no_rotation',
    }

    if (rotated) {
      if (RD_DEBUG) {
        console.log('♻️ Refresh token rotacionou:', mask(refresh_token, 8))
      }

      persist_status = await persistNewRefreshToken(
        refresh_token,
        old_refresh_token
      )

      // Atualiza variável do processo atual
      process.env.RD_CRM_REFRESH_TOKEN = refresh_token
    }

    return {
      access_token,
      refresh_token,
      refresh_token_rotated: rotated,
      persist_status,
    }
  } catch (error) {
    const details = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message

    throw new Error(`Error requesting access token: ${details}`)
  }
}

const updateRefreshTokenInEnvFile = (newRefreshToken, envFile = '.env') => {
  try {
    const filePath = path.resolve(envFile)
    if (!fs.existsSync(filePath)) return false

    let lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)
    let found = false

    lines = lines.map(line => {
      if (line.trim().startsWith('RD_CRM_REFRESH_TOKEN=')) {
        found = true
        return `RD_CRM_REFRESH_TOKEN=${newRefreshToken}`
      }
      return line
    })

    if (!found) lines.push(`RD_CRM_REFRESH_TOKEN=${newRefreshToken}`)
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8')
    return true
  } catch (err) {
    console.warn('Failed to update .env file:', err.message)
    return false
  }
}

const updateRefreshTokenInLambda = async (
  newRefreshToken,
  functionName = null
) => {
  try {
    const lambdaFunctionName =
      functionName || process.env.AWS_LAMBDA_FUNCTION_NAME

    if (!lambdaFunctionName) return false

    const lambda = new AWS.Lambda()

    const response = await lambda
      .getFunctionConfiguration({ FunctionName: lambdaFunctionName })
      .promise()

    const currentEnv = response.Environment?.Variables || {}
    currentEnv.RD_CRM_REFRESH_TOKEN = newRefreshToken

    await lambda
      .updateFunctionConfiguration({
        FunctionName: lambdaFunctionName,
        Environment: { Variables: currentEnv },
      })
      .promise()

    console.info(
      `Successfully updated refresh token in Lambda: ${lambdaFunctionName}`
    )
    return true
  } catch (error) {
    console.warn(
      'Failed to update Lambda environment:',
      error?.message || error
    )
    return false
  }
}

const persistNewRefreshToken = async (newRefreshToken, oldRefreshToken) => {
  if (!newRefreshToken || newRefreshToken === oldRefreshToken) {
    return { env_updated: false, lambda_updated: false, reason: 'no_rotation' }
  }

  const env_updated = updateRefreshTokenInEnvFile(newRefreshToken)

  let lambda_updated = false
  if (process.env.RD_PERSIST_LAMBDA === '1') {
    lambda_updated = await updateRefreshTokenInLambda(newRefreshToken)
  }

  return { env_updated, lambda_updated, reason: 'attempted' }
}

module.exports = {
  getAccessTokenFromRefresh,
  updateRefreshTokenInEnvFile,
  persistNewRefreshToken,
  updateRefreshTokenInLambda,
}
