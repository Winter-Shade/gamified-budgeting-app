import json, pathlib
path = pathlib.Path("./pending_trade.json")
data = json.loads(path.read_text())
data["decision"] = "yes"
path.write_text(json.dumps(data, indent=2))
print("Approved")
