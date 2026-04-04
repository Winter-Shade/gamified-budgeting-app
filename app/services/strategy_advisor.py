"""
Strategy Advisor — AI-powered strategy analysis for traders.
Uses Gemini via LiteLLM to analyze portfolio performance and suggest improvements.
"""
import os
import json
from dotenv import load_dotenv

_here = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_here, "..", ".."))
load_dotenv(os.path.join(_project_root, ".env"), override=True)

os.environ.setdefault("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))


def get_strategy_advice(analysis: dict, user_question: str = "") -> dict:
    """Generate strategy advice using Gemini."""
    import litellm

    holdings_text = ""
    for h in analysis.get("holdings", []):
        pnl = h.get("unrealized_pnl", 0)
        holdings_text += (
            f"  {h['symbol']}: {h['quantity']} shares, "
            f"avg cost ${h['avg_cost']:.2f}, "
            f"current ${h.get('current_price', 0):.2f}, "
            f"P&L ${pnl:+,.2f}\n"
        )

    txns_text = ""
    for t in analysis.get("recent_transactions", [])[:10]:
        txns_text += f"  {t['side'].upper()} {t['quantity']} {t['symbol']} @ ${t['price']:.2f} ({t.get('rationale', 'N/A')})\n"

    prompt = f"""You are a senior investment strategist analyzing a simulated trading portfolio.

Trader: {analysis['trader_name']}
Current Strategy: {analysis['strategy']}
{f"Persona: {analysis['identity']}" if analysis.get('identity') else ""}

Portfolio Summary:
- Cash: ${analysis['cash_balance']:,.2f}
- Holdings Value: ${analysis['portfolio_value']:,.2f}
- Total Value: ${analysis['total_value']:,.2f}
- P&L: ${analysis['pnl']:+,.2f} ({analysis['pnl_pct']:+.1f}%)
- Total Runs: {analysis['run_count']}

Current Holdings:
{holdings_text or "  None"}

Recent Transactions:
{txns_text or "  None"}

{f"User Question: {user_question}" if user_question else ""}

Provide a JSON response with:
1. "performance_summary": Brief assessment of current performance (2-3 sentences)
2. "strengths": List of 2-3 things the strategy is doing well
3. "weaknesses": List of 2-3 areas for improvement
4. "recommendations": List of 3-5 actionable recommendations to improve the strategy
5. "suggested_strategy": An improved strategy text the user could adopt (if applicable)

Respond ONLY with valid JSON, no markdown.
"""

    response = litellm.completion(
        model="gemini/gemini-2.0-flash",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )

    content = response.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    try:
        advice = json.loads(content)
    except json.JSONDecodeError:
        advice = {
            "performance_summary": content,
            "strengths": [],
            "weaknesses": [],
            "recommendations": [],
            "suggested_strategy": None,
        }

    return advice
