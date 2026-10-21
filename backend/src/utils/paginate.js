'use strict';

function pageParams(query, { defaultLimit = 12, maxLimit = 50 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(limit, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

/** Run a paginated find and return `{ items, pagination }`. */
async function paginate(model, filter, { page, limit, skip }, { sort = { createdAt: -1 }, populate, select, map } = {}) {
  let q = model.find(filter).sort(sort).skip(skip).limit(limit);
  if (select) q = q.select(select);
  if (populate) for (const p of [].concat(populate)) q = q.populate(p);
  const [docs, total] = await Promise.all([q, model.countDocuments(filter)]);
  return {
    items: map ? docs.map(map) : docs,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = { pageParams, paginate };
