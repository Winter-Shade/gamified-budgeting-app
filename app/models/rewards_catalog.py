from app.extensions import db


class RewardsCatalog(db.Model):
    __tablename__ = "rewards_catalog"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    gold_cost = db.Column(db.Integer, nullable=False)
    provider = db.Column(db.String(120), nullable=True)
    value = db.Column(db.String(120), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "gold_cost": self.gold_cost,
            "provider": self.provider,
            "value": self.value,
            "is_active": self.is_active,
        }
