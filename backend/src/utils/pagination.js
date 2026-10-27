/**
 * Parse ?page=1&limit=20 from query string.
 * Returns { limit, offset, page }.
 */
function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Build a standard pagination meta object.
 */
function paginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { parsePagination, paginationMeta };
