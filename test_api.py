"""End-to-end API test suite for BudgetQuest v2."""
import requests
import sys

BASE = "http://127.0.0.1:5000"  # IPv4 explicit (macOS localhost → IPv6 hangs)
TIMEOUT = 5
PASS = "✅"
FAIL = "❌"
results = []


def req(method, path, **kwargs):
    """Wrapper with timeout on every request."""
    kwargs.setdefault("timeout", TIMEOUT)
    return getattr(requests, method)(f"{BASE}{path}", **kwargs)


def test(name, passed, detail=""):
    status = PASS if passed else FAIL
    results.append((name, passed))
    print(f"  {status} {name}" + (f" — {detail}" if detail else ""))


def main():
    print("🧪 BudgetQuest v2 API Test Suite\n")

    # ── 1. Login with seed user ────────────────────────────────
    print("── Auth ──")
    r = req("post", "/auth/login", json={
        "email": "hero@budgetquest.com", "password": "password123"
    })
    test("Login (seed user)", r.status_code == 200, f"status={r.status_code}")
    token = r.json().get("token", "")
    headers = {"Authorization": f"Bearer {token}"}

    # ── 2. Register new user ──────────────────────────────────
    r = req("post", "/auth/register", json={
        "username": "player2", "email": "p2@test.com", "password": "pass123"
    })
    test("Register new user", r.status_code == 201, f"status={r.status_code}")

    # ── 3. Duplicate registration ─────────────────────────────
    r = req("post", "/auth/register", json={
        "username": "player2", "email": "p2@test.com", "password": "pass123"
    })
    test("Duplicate register blocked", r.status_code == 409, f"status={r.status_code}")

    # ── 4. List accounts ──────────────────────────────────────
    print("\n── Accounts ──")
    r = req("get", "/accounts", headers=headers)
    test("List accounts", r.status_code == 200 and len(r.json()) == 3,
         f"count={len(r.json())}")

    # ── 5. Add expense (NO XP should be awarded) ─────────────
    print("\n── Expenses (NO XP) ──")
    r = req("post", "/expenses", headers=headers, json={
        "account_id": 2, "category_id": 1, "amount": 10, "description": "Test snack"
    })
    data = r.json()
    test("Add expense ₹10", r.status_code == 201, f"status={r.status_code}")
    test("No rewards in response", "rewards" not in data,
         f"keys={list(data.keys())}")

    # ── 6. Update expense ─────────────────────────────────────
    expense_id = data.get("expense", {}).get("id")
    if expense_id:
        r = req("put", f"/expenses/{expense_id}", headers=headers, json={
            "amount": 15, "description": "Updated test snack"
        })
        test("Update expense", r.status_code == 200, f"status={r.status_code}")

    # ── 7. Delete expense ─────────────────────────────────────
    if expense_id:
        r = req("delete", f"/expenses/{expense_id}", headers=headers)
        test("Delete expense", r.status_code == 200,
             f"refunded={r.json().get('refunded')}")

    # ── 8. List expenses (should have seed expenses) ──────────
    r = req("get", "/expenses", headers=headers)
    test("List expenses", r.status_code == 200 and len(r.json()) >= 5,
         f"count={len(r.json())}")

    # ── 9. Negative balance guard ─────────────────────────────
    print("\n── Constraints ──")
    r = req("post", "/expenses", headers=headers, json={
        "account_id": 3, "category_id": 2, "amount": 9999
    })
    test("Negative balance blocked", r.status_code == 400,
         f"msg={r.json().get('error', '')[:50]}")

    # ── 10. Dashboard ─────────────────────────────────────────
    print("\n── Dashboard ──")
    r = req("get", "/dashboard", headers=headers)
    d = r.json()
    test("Dashboard loads", r.status_code == 200)
    test("Has recent_transactions", "recent_transactions" in d,
         f"count={len(d.get('recent_transactions', []))}")
    test("Has weekly_summary", "weekly_summary" in d,
         f"count={len(d.get('weekly_summary', []))}")

    # ── 11. Analytics ─────────────────────────────────────────
    print("\n── Analytics ──")
    r = req("get", "/analytics", headers=headers)
    a = r.json()
    test("Analytics loads", r.status_code == 200)
    test("Has category_breakdown", "category_breakdown" in a and len(a["category_breakdown"]) > 0,
         f"categories={len(a.get('category_breakdown', []))}")
    test("Has daily_trend", "daily_trend" in a,
         f"days={len(a.get('daily_trend', []))}")
    test("Has budget_vs_actual", "budget_vs_actual" in a)

    # ── 12. Calendar ──────────────────────────────────────────
    print("\n── Calendar ──")
    r = req("get", "/calendar", headers=headers)
    cal = r.json()
    test("Calendar loads", r.status_code == 200)
    test("Has days data", "days" in cal and len(cal["days"]) > 0,
         f"days={len(cal.get('days', []))}")

    # ── 13. Challenges ────────────────────────────────────────
    print("\n── Challenges ──")
    r = req("get", "/challenges", headers=headers)
    ch = r.json()
    test("List challenges", r.status_code == 200 and len(ch) >= 3,
         f"count={len(ch)}")

    # Create a new challenge
    r = req("post", "/challenges", headers=headers, json={
        "title": "Test Challenge",
        "type": "no_spend",
        "target_value": 0,
        "start_date": "2026-03-20",
        "end_date": "2026-04-20",
        "reward_xp": 25,
    })
    test("Create challenge", r.status_code == 201)
    new_challenge_id = r.json().get("id")

    # Join the challenge
    if new_challenge_id:
        r = req("post", f"/challenges/{new_challenge_id}/join", headers=headers)
        test("Join challenge", r.status_code == 201)

    # ── 14. Friends ───────────────────────────────────────────
    print("\n── Friends ──")
    r = req("post", "/friends", headers=headers, json={"username": "player2"})
    test("Add friend", r.status_code == 201)

    r = req("get", "/friends", headers=headers)
    test("List friends", r.status_code == 200 and len(r.json()) >= 1,
         f"count={len(r.json())}")

    # ── 15. Leaderboard ───────────────────────────────────────
    print("\n── Leaderboard ──")
    r = req("get", "/leaderboard")
    lb = r.json()
    test("Leaderboard loads", r.status_code == 200 and len(lb) >= 1)
    test("Top user is hero", lb[0].get("username") == "hero",
         f"top={lb[0].get('username')}")

    # ── Summary ───────────────────────────────────────────────
    passed = sum(1 for _, p in results if p)
    total = len(results)
    print(f"\n{'='*40}")
    print(f"{'🎉 ALL PASSED' if passed == total else '⚠️  SOME FAILED'}: {passed}/{total}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
