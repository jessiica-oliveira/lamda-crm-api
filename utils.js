'use strict'

const normalizePhone = phone => String(phone).replace(/\D/g, '')

const mask = (value, keep = 6) => {
  if (!value) return ''

  const s = String(value)

  if (s.length <= keep) return '***'

  return s.slice(0, keep) + '***'
}

const pickRandomExcluding = (ids, excludeId) => {
  const pool = ids.filter(id => id && id !== excludeId)

  if (pool.length === 0) return null

  const idx = Math.floor(Math.random() * pool.length)

  return pool[idx]
}

module.exports = {
  normalizePhone,
  mask,
}
