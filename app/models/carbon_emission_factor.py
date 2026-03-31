"""
Static emission factor lookup — kg CO2 emitted per ₹100 spent in each category.
These are approximate values for India; category names match the default Category seeds.
"""

# kg CO2 per ₹100 spent
EMISSION_FACTORS = {
    "food":          0.45,
    "dining":        0.50,
    "groceries":     0.30,
    "transport":     0.80,
    "travel":        1.20,
    "flight":        2.50,
    "utilities":     0.60,
    "electricity":   0.70,
    "entertainment": 0.20,
    "shopping":      0.35,
    "clothing":      0.40,
    "electronics":   0.55,
    "healthcare":    0.15,
    "education":     0.10,
    "personal care": 0.25,
    "rent":          0.05,
    "subscriptions": 0.08,
    "other":         0.30,
}

DEFAULT_FACTOR = 0.30  # fallback for unknown categories


def get_factor(category_name: str) -> float:
    """Return kg CO2 per ₹100 for the given category (case-insensitive)."""
    key = category_name.lower().strip()
    return EMISSION_FACTORS.get(key, DEFAULT_FACTOR)
