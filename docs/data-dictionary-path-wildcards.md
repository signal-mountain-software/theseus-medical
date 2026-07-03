# Data Dictionary Path Wildcards

Saved: 2026-07-02

## Purpose

This note documents wildcard path behavior used by dictionary resolution in `resolveData`.

## Supported behavior

1. Literal-first lookup for paths containing `*`
- If a path containing `*` can be resolved literally as written, that literal value is used.
- Wildcard expansion only happens when literal lookup does not resolve.

2. Wildcard to array expansion
- A path segment containing `*` matches sibling keys at that level.
- Matching values are returned as an ordered array.
- Values are sorted by key with numeric suffix awareness (`_2` before `_10`).
- Empty values are filtered for terminal wildcard results.
- Wildcard matching is numeric-only in this implementation: `*` expands to one or more digits.
- That means `food_allergy_*` matches `food_allergy_1` and `food_allergy_12`, but not `food_allergy_extra`.

3. Wildcard-derived indexing
- A path such as `food_allergies_*.0` means:
  - resolve `food_allergies_*` to an array
  - return index `0` from that array
- If index is out of range, resolution is treated as missing and normal fallback can continue.

4. Existing fallback semantics are unchanged
- Outer `path` arrays still work as first-good-value-wins.
- Example:

```json
"path": [
  "preferred_methods.0",
  "preferred_method"
]
```

This tries `preferred_methods.0` first, then falls back to `preferred_method`.

5. Composite array path entries can now include wildcard outputs
- Nested path arrays still concatenate non-empty resolved parts.
- If a sub-entry resolves to an array (including wildcard output), each element is included.

## Examples

### Example A: Numbered allergies as one list

```json
"path": "field_values.food_allergy_*"
```

If source contains:

```json
{
  "field_values": {
    "food_allergy_1": "Oranges",
    "food_allergy_2": "Tomatoes",
    "food_allergy_3": null
  }
}
```

Resolved value behaves as an ordered array: `["Oranges", "Tomatoes"]`.

### Example B: Pick first allergy with fallback

```json
"path": [
  "field_values.food_allergy_*.0",
  "field_values.food_allergy_1"
]
```

This returns the first wildcard-derived item when present; otherwise falls back to explicit field 1.

### Example C: Address fallback plus composed line

```json
"path": [
  "resolved_address",
  "address",
  "location",
  [
    "address1",
    "address2",
    "city",
    "state",
    "zip",
    "zip_code"
  ]
]
```

Behavior:
- try `resolved_address`
- else `address`
- else `location`
- else build one string from available nested values

## Notes

- Wildcard support is opt-in by using `*` in the path.
- Non-wildcard path behavior is unchanged.
- Literal key names containing `*` are still supported because literal lookup runs first.
