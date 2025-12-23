'use strict'

const normalizePhone = phone => String(phone).replace(/\D/g, '')

const mask = (value, keep = 6) => {
  if (!value) return ''

  const s = String(value)

  if (s.length <= keep) return '***'

  return s.slice(0, keep) + '***'
}

module.exports = {
  normalizePhone,
  mask,
}
