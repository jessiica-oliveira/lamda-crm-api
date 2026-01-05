'use strict'

const { pickRandomExcluding } = require('../utils')
const { listVisibleUsers } = require('../rdUsers')
const { updateDealOwner } = require('../rdDeals')

const rotateDealOwnersIfEnabled = async ({ accessToken, dealsByContactId }) => {
  const enable = process.env.RD_ENABLE_OWNER_ROTATION === '1'

  if (!enable) return { enabled: false, owner_changes: [] }

  const owner_changes = []

  const visibleUsersRes = await listVisibleUsers(accessToken)
  if (visibleUsersRes?.error) {
    owner_changes.push({
      changed: false,
      reason: 'list_visible_users_failed',
      error: visibleUsersRes.message,
      error_status: visibleUsersRes.status ?? null,
      error_details: visibleUsersRes.details ?? null,
    })
    return { enabled: true, owner_changes }
  }

  const visibleUserIds = (visibleUsersRes.users || [])
    .map(u => u?.id)
    .filter(Boolean)

  for (const [contactId, deals] of Object.entries(dealsByContactId)) {
    if (!Array.isArray(deals)) continue

    for (const d of deals) {
      const dealId = d?.id
      const currentOwnerId = d?.owner_id

      if (!dealId || !currentOwnerId) {
        owner_changes.push({
          deal_id: dealId ?? null,
          contact_id: contactId,
          changed: false,
          reason: 'missing_deal_id_or_owner_id',
        })
        continue
      }

      const newOwnerId = pickRandomExcluding(visibleUserIds, currentOwnerId)

      if (!newOwnerId) {
        owner_changes.push({
          deal_id: dealId,
          contact_id: contactId,
          changed: false,
          reason: 'no_other_visible_user',
        })
        continue
      }

      // const upd = await updateDealOwner(accessToken, dealId, newOwnerId)

      // owner_changes.push({
      //   deal_id: dealId,
      //   contact_id: contactId,
      //   changed: !upd.error,
      //   from_owner_id: currentOwnerId,
      //   to_owner_id: newOwnerId,
      //   error: upd.error ? upd.message : null,
      //   error_status: upd.status ?? null,
      //   error_details: upd.details ?? null,
      // })

      // if (!upd.error) d.owner_id = newOwnerId
    }
  }

  return { enabled: true, owner_changes }
}

module.exports = { rotateDealOwnersIfEnabled }
