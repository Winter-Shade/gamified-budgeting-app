import os
import http.client
import json
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv

load_dotenv()
mcp = FastMCP("Serper Search MCP Server")

SERPER_API_KEY = os.getenv("SERPER_API_KEY")

if not SERPER_API_KEY:
    raise ValueError("❌ SERPER_API_KEY not found in .env")


@mcp.tool()
async def search(query: str, n_results: int = 5) -> str:
    """
    Perform a Serper.dev Google search.

    Args:
        query: Search query.
        n_results: Max number of results to return.
    """

    try:
        conn = http.client.HTTPSConnection("google.serper.dev")

        payload = json.dumps({"q": query})
        headers = {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json",
        }

        conn.request("POST", "/search", payload, headers)
        res = conn.getresponse()

        data = res.read().decode("utf-8")
        parsed = json.loads(data)

        # Extract the "organic" results
        results = parsed.get("organic", [])

        if not results:
            return "No results found."

        formatted = []
        for r in results[:n_results]:
            title = r.get("title", "No title")
            link = r.get("link", "No link")
            snippet = r.get("snippet", "")

            formatted.append(
                f"Title: {title}\n"
                f"Link: {link}\n"
                f"Snippet: {snippet}\n"
            )

        return "\n".join(formatted)

    except Exception as e:
        return f"Error during Serper search: {str(e)}"


if __name__ == "__main__":
    print("🚀 Serper MCP Server running...")
    mcp.run()