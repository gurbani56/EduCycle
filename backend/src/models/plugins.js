'use strict';
/** Shared JSON shape: expose `id`, hide `_id`/`__v`, and drop fields listed in `hidden`. */
function jsonPlugin(schema, { hidden = [] } = {}) {
  const transform = (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    for (const f of hidden) delete ret[f];
    return ret;
  };
  schema.set('toJSON', { virtuals: true, transform });
  schema.set('toObject', { virtuals: true, transform });
}

module.exports = { jsonPlugin };
