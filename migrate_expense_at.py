"""
Add expense_at column to expenses table.
Run this script once after updating the Expense model.
"""
from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    # Check if column already exists
    result = db.session.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='expenses' AND column_name='expense_at'"
    ))
    if result.fetchone():
        print("✅ expense_at column already exists. Skipping.")
    else:
        # Add the column
        db.session.execute(text(
            "ALTER TABLE expenses ADD COLUMN expense_at TIMESTAMP NOT NULL DEFAULT NOW()"
        ))
        # Backfill from created_at
        db.session.execute(text(
            "UPDATE expenses SET expense_at = created_at WHERE expense_at = (SELECT expense_at FROM expenses LIMIT 1) OR TRUE"
        ))
        db.session.commit()
        print("✅ Added expense_at column and backfilled from created_at.")
