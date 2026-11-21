'use strict';

// Clinic times are plain local wall-clock times, stored as DATETIME and never converted.
const pad = (n) => String(n).padStart(2, '0');

function toSqlDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toSqlDatetime(date) {
  return `${toSqlDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseSqlDatetime(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(value));
  if (!m) throw new TypeError(`Not a SQL datetime: ${value}`);
  const [year, month, day, hour, minute, second] = m.slice(1).map((v) => (v === undefined ? 0 : Number(v)));
  return new Date(year, month - 1, day, hour, minute, second);
}

module.exports = { toSqlDate, toSqlDatetime, parseSqlDatetime };