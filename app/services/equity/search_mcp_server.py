#!/usr/bin/env python3
"""
Web Search MCP Server — Brave Search API.

Launched as a subprocess by the researcher agent.
Provides web search capability so the researcher can find financial news.
"""
import os
import json
import requests
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

_here = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.join(_here, "..", "..", "..", "..")
load_dotenv(os.path.join(_project_root, ".env"), override=True)

mcp = FastMCP("Brave Search MCP Server")

BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")  # fallback


def _brave_search(query: str, n_results: int) -> list[dict]:
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }
    params = {"q": query, "count": min(n_results, 20), "search_lang": "en"}
    resp = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        headers=headers,
        params=params,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    results = data.get("web", {}).get("results", [])
    return [{"title": r.get("title"), "link": r.get("url"), "snippet": r.get("description", "")} for r in results]


def _serper_search(query: str, n_results: int) -> list[dict]:
    import http.client
    conn = http.client.HTTPSConnection("google.serper.dev")
    payload = json.dumps({"q": query})
    headers = {"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"}
    conn.request("POST", "/search", payload, headers)
    res = conn.getresponse()
    data = json.loads(res.read().decode("utf-8"))
    return data.get("organic", [])[:n_results]


@mcp.tool()
async def search(query: str, n_results: int = 5) -> str:
    """
    Search the web for financial news, stock information, and market data.

    Args:
        query: Search query string.
        n_results: Number of results to return (max 10).

    Returns:
        Formatted search results with title, URL, and snippet.
    """
    n_results = min(n_results, 10)
    results = []

    if BRAVE_API_KEY:
        try:
            results = _brave_search(query, n_results)
        except Exception as e:
            print(f"[search_mcp] Brave error: {e}")

    if not results and SERPER_API_KEY:
        try:
            results = _serper_search(query, n_results)
        except Exception as e:
            print(f"[search_mcp] Serper fallback error: {e}")

    if not results:
        return "No search results found. Try using the fetch tool to access specific URLs directly."

    lines = []
    for r in results:
        lines.append(
            f"Title: {r.get('title', 'N/A')}\n"
            f"URL: {r.get('link', r.get('url', 'N/A'))}\n"
            f"Snippet: {r.get('snippet', r.get('description', ''))}\n"
        )
    return "\n---\n".join(lines)


if __name__ == "__main__":
    mcp.run()
