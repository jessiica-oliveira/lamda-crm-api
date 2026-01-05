'use strict'

const { getUserById } = require('../rdUsers')

const enrichDealsWithOwnerInfo = async ({ accessToken, dealsByContactId }) => {
  const ownerIds = new Set()

  for (const deals of Object.values(dealsByContactId)) {
    if (!Array.isArray(deals)) continue
    for (const d of deals) if (d?.owner_id) ownerIds.add(d.owner_id)
  }

  const ownersById = {}

  await Promise.all(
    [...ownerIds].map(async ownerId => {
      const userRes = await getUserById(accessToken, ownerId)
      if (userRes.error) {
        ownersById[ownerId] = { name: null, email: null }
        return
      }
      const u = userRes.user || {}
      ownersById[ownerId] = {
        name: u?.data?.name ?? null,
        email: u?.data?.email ?? null,
      }
    })
  )

  for (const [contactId, deals] of Object.entries(dealsByContactId)) {
    if (!Array.isArray(deals)) continue
    dealsByContactId[contactId] = deals.map(d => {
      const owner = d?.owner_id ? ownersById[d.owner_id] : null
      return {
        ...d,
        owner_name: owner?.name ?? null,
        owner_email: owner?.email ?? null,
      }
    })
  }

  return dealsByContactId
}

module.exports = { enrichDealsWithOwnerInfo }
