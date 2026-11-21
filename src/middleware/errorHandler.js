'use strict';
const { AppError } = require('../lib/errors');

function notFound(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'MALFORMED_JSON';
    message = 'Request body is not valid JSON';
  } else if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    code = 'DUPLICATE';
    message = 'A record with the same unique value already exists';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    status = 409;
    code = 'STILL_REFERENCED';
    message = 'This record still has appointments and cannot be deleted';
  } else {
    console.error(err);
  }

  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

module.exports = { notFound, errorHandler };