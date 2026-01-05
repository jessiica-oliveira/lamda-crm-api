'use strict'

const { getDealsByContactId } = require('../rdDeals')

const findDealsByContacts = async ({ accessToken, contacts }) => {
  const contactIds = [
    ...new Set((contacts || []).map(c => c?.id).filter(Boolean)),
  ]
  const dealsByContactId = {}

  await Promise.all(
    contactIds.map(async contactId => {
      const dealsRes = await getDealsByContactId(accessToken, contactId)

      if (dealsRes.error) {
        dealsByContactId[contactId] = {
          error: true,
          message: dealsRes.message,
          status: dealsRes.status,
          details: dealsRes.details,
        }
        return
      }

      if (Array.isArray(dealsRes.deals) && dealsRes.deals.length > 0) {
        dealsByContactId[contactId] = dealsRes.deals
      }
    })
  )

  return {
    dealsByContactId,
    deals_contacts_checked: contactIds.length,
    deals_contacts_with_deals: Object.keys(dealsByContactId).length,
  }
}

module.exports = { findDealsByContacts }
