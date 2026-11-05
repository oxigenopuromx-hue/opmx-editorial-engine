// Isolated adapter for WordPress Core 0.4.0 category-placement REST metadata.
// NOT wired into active Publisher or MASTER; caller contract must be approved first.
const META_KEY = 'oxpuro_excluded_category_ids';
const validId = (v) => typeof v === 'string' && /^[1-9][0-9]*$/.test(v) && Number.isSafeInteger(Number(v));

export function categoryPlacementMeta({ excludedCategoryIds, assignedCategoryIds }) {
  // An absent setting means "do not write this meta"; never silently reset existing preferences.
  if (excludedCategoryIds === undefined) return {};
  if (!Array.isArray(excludedCategoryIds)) throw new TypeError('Excluded category IDs must be an array');
  if (!Array.isArray(assignedCategoryIds) || !assignedCategoryIds.every(validId)) {
    throw new TypeError('Assigned category IDs must be validated decimal strings');
  }
  if (new Set(assignedCategoryIds).size !== assignedCategoryIds.length) {
    throw new TypeError('Duplicate assigned category IDs');
  }
  if (!excludedCategoryIds.every(validId)) {
    throw new TypeError('Excluded category IDs must be positive decimal strings');
  }
  if (new Set(excludedCategoryIds).size !== excludedCategoryIds.length) {
    throw new TypeError('Duplicate excluded category IDs');
  }
  if (excludedCategoryIds.some(id => !assignedCategoryIds.includes(id))) {
    throw new TypeError('Excluded category ID is not assigned to the post');
  }
  // [] is an explicit clear, not the same as the setting being omitted.
  return { [META_KEY]: [...excludedCategoryIds] };
}

export function verifyCategoryPlacementReadback({ excludedCategoryIds, post }) {
  if (excludedCategoryIds === undefined) return true; // No write requested.
  const actual = post?.meta?.[META_KEY];
  if (!Array.isArray(actual) || !actual.every(validId)) return false;
  return actual.length === excludedCategoryIds.length &&
    new Set(actual).size === actual.length &&
    excludedCategoryIds.every(id => actual.includes(id));
}
