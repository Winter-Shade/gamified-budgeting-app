"""
Eco Challenge Templates — preset sustainability-themed challenges.
These are static constants; users pick a template and it creates a standard challenge.
"""

ECO_TEMPLATES = [
    {
        "id": "eco_no_dining",
        "title": "No Dining Out for 2 Weeks",
        "description": "Avoid all restaurant and food delivery expenses for 14 days. Cook at home and save money while reducing food packaging waste.",
        "type": "no_spend",
        "target_value": 0,
        "duration_days": 14,
        "reward_xp": 200,
        "icon": "🥗",
        "impact": "Saves ~4 kg CO₂ vs average dining out",
    },
    {
        "id": "eco_public_transport",
        "title": "Public Transport Only — 7 Days",
        "description": "Use only buses, metro, or trains for 7 days. No ride-hailing or personal vehicle.",
        "type": "no_spend",
        "target_value": 0,
        "duration_days": 7,
        "reward_xp": 150,
        "icon": "🚌",
        "impact": "Saves ~3.2 kg CO₂ per day vs private car",
    },
    {
        "id": "eco_budget_shopping",
        "title": "Shopping Budget — ₹500 Cap",
        "description": "Keep all non-essential shopping under ₹500 this week. Think before you buy.",
        "type": "budget_limit",
        "target_value": 500,
        "duration_days": 7,
        "reward_xp": 120,
        "icon": "🛍️",
        "impact": "Reduces impulse purchases and textile waste",
    },
    {
        "id": "eco_no_subscriptions",
        "title": "No New Subscriptions Month",
        "description": "Don't sign up for any new paid subscriptions for 30 days. Audit what you already pay for.",
        "type": "no_spend",
        "target_value": 0,
        "duration_days": 30,
        "reward_xp": 180,
        "icon": "📱",
        "impact": "Reduces digital consumption and energy use",
    },
    {
        "id": "eco_zero_entertainment",
        "title": "Free Entertainment Week",
        "description": "Spend nothing on entertainment for 7 days — parks, libraries, and free events only.",
        "type": "no_spend",
        "target_value": 0,
        "duration_days": 7,
        "reward_xp": 100,
        "icon": "🌳",
        "impact": "Encourages outdoor, low-carbon activities",
    },
    {
        "id": "eco_low_spend_month",
        "title": "Minimal Spending Month",
        "description": "Keep total monthly spending under ₹5,000 (excluding rent/bills). Only essentials.",
        "type": "budget_limit",
        "target_value": 5000,
        "duration_days": 30,
        "reward_xp": 300,
        "icon": "💚",
        "impact": "Lower consumption = lower carbon footprint overall",
    },
]


def get_templates() -> list[dict]:
    return ECO_TEMPLATES
