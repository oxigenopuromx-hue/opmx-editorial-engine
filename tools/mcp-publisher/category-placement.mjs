// Isolated adapter for WordPress Core 0.4.0 category-placement REST metadata.
// NOT wired into active Publisher or MASTER; caller contract must be approved first.
const META_KEY = 'oxpuro_excluded_category_ids';
const validId = (v) => typeof v === 'string' && /^[1-9][0-9]*$/.test(v) && Number.isSafeInteger(Number(v));

export function categoryPlacementMeta({ excludedCategoryIds, eligibleCategoryIds }) {
  // An absent setting means "do not write this meta"; never silently reset existing preferences.
  if (excludedCategoryIds === undefined) return {};
  if (!Array.isArray(excludedCategoryIds)) throw new TypeError('Excluded category IDs must be an array');
  if (!Array.isArray(eligibleCategoryIds) || !eligibleCategoryIds.every(validId)) {
    throw new TypeError('Eligible category IDs must be validated decimal strings');
  }
  if (new Set(eligibleCategoryIds).size !== eligibleCategoryIds.length) {
    throw new TypeError('Duplicate eligible category IDs');
  }
  if (!excludedCategoryIds.every(validId)) {
    throw new TypeError('Excluded category IDs must be positive decimal strings');
  }
  if (new Set(excludedCategoryIds).size !== excludedCategoryIds.length) {
    throw new TypeError('Duplicate excluded category IDs');
  }
  if (excludedCategoryIds.some(id => !eligibleCategoryIds.includes(id))) {
    throw new TypeError('Excluded category ID is not assigned to the post or an eligible ancestor');
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
