const num = (v) => (v === null || v === undefined ? null : Number(v));

export function toItem(r) {
  return {
    id: Number(r.id),
    name: r.name,
    location: r.location,
    supplier: r.supplier ?? null,
    unitCost: num(r.unit_cost),
    quantity: r.quantity,
    minQuantity: r.min_quantity,
    isLow: r.quantity <= r.min_quantity,
    photoId: num(r.photo_id),
    deletedAt: r.deleted_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toMovement(r) {
  return {
    id: Number(r.id),
    itemId: Number(r.item_id),
    userId: r.user_id,
    userName: r.user_name ?? null,
    delta: r.delta,
    usagePlace: r.usage_place,
    memo: r.memo,
    unitPrice: num(r.unit_price),
    photoId: num(r.photo_id),
    createdAt: r.created_at,
  };
}
