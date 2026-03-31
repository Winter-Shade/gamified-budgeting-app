from app.extensions import db
from app.models.category import Category
from app.models.expense import Expense

# Default categories seeded for every new user
DEFAULT_CATEGORIES = [
    {"name": "Food & Dining",     "icon": "🍔", "color": "#fbbf24"},
    {"name": "Transport",         "icon": "🚌", "color": "#9D85FF"},
    {"name": "Shopping",          "icon": "🛍️", "color": "#10d9a0"},
    {"name": "Entertainment",     "icon": "🎭", "color": "#f472b6"},
    {"name": "Bills & Utilities", "icon": "⚡", "color": "#fb923c"},
    {"name": "Health",            "icon": "🏥", "color": "#34d399"},
    {"name": "Education",         "icon": "📚", "color": "#38bdf8"},
    {"name": "Travel",            "icon": "✈️", "color": "#e879f9"},
    {"name": "Groceries",         "icon": "🛒", "color": "#a3e635"},
    {"name": "Other",             "icon": "📦", "color": "#8888aa"},
]

# Maps old global category names (from seed.py) to new default names
_LEGACY_NAME_MAP = {
    "food":          "Food & Dining",
    "transport":     "Transport",
    "shopping":      "Shopping",
    "entertainment": "Entertainment",
    "bills":         "Bills & Utilities",
    "other":         "Other",
}


def seed_user_categories(user_id: int) -> list:
    """
    Create default personal categories for a user.
    Also migrates any existing expenses that point to global (user_id=NULL)
    categories over to the new personal ones.
    Returns list of created Category objects.
    """
    # Bail out if user already has personal categories
    existing = Category.query.filter_by(user_id=user_id).count()
    if existing:
        return []

    created = []
    for defaults in DEFAULT_CATEGORIES:
        cat = Category(
            name=defaults["name"],
            icon=defaults["icon"],
            color=defaults["color"],
            user_id=user_id,
        )
        db.session.add(cat)
        created.append(cat)

    db.session.flush()  # get IDs before migrating expenses

    # Migrate existing expenses that reference global categories (user_id=NULL)
    global_cats = Category.query.filter_by(user_id=None).all()
    for gc in global_cats:
        mapped_name = _LEGACY_NAME_MAP.get(gc.name.lower())
        if not mapped_name:
            continue
        personal = next((c for c in created if c.name == mapped_name), None)
        if not personal:
            continue
        # Re-point user's expenses from the global category to their personal one
        Expense.query.filter_by(user_id=user_id, category_id=gc.id).update(
            {"category_id": personal.id}
        )

    db.session.commit()
    return created


def get_user_categories(user_id: int) -> list:
    """
    Return the user's personal categories.
    Auto-seeds defaults if the user has none yet.
    """
    cats = Category.query.filter_by(user_id=user_id).order_by(Category.id).all()
    if not cats:
        cats = seed_user_categories(user_id)
    return cats
