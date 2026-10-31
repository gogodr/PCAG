"""Small local OpenPencil MCP client; reads the desktop server token at runtime."""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path


DISCOVERY = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local")) / "OpenPencil/mcp.json"


class Client:
    def __init__(self):
        info = json.loads(DISCOVERY.read_text(encoding="utf-8"))
        self.url = f"http://127.0.0.1:{info['httpPort']}/rpc"
        self.token = info["authToken"]
    def request(self, command, args):
        payload = {"command": command, "args": args}
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.token}"}
        req = urllib.request.Request(self.url, json.dumps(payload).encode(), headers)
        try:
            response = urllib.request.urlopen(req, timeout=120)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"OpenPencil HTTP {error.code}: {error.read().decode()[:500]}") from error
        with response:
            body = response.read().decode()
            if not body:
                return None
            result = json.loads(body)
            if result.get("ok") is False:
                raise RuntimeError(result.get("error", result))
            return result

    def tool(self, tool_name, **arguments):
        if tool_name in ("list_documents", "new_document", "save_file", "open_file"):
            result = self.request(tool_name, arguments)
        else:
            target = {key: arguments.pop(key) for key in ("document_id", "page_id") if key in arguments}
            result = self.request("tool", {**target, "name": tool_name, "args": arguments})
        return {"content": [{"type": "text", "text": json.dumps({**(result.get("result") or {}), **({"target": result["target"]} if result.get("target") else {})})}]}


if __name__ == "__main__":
    client = Client()
    print(json.dumps(client.tool(sys.argv[1], **json.loads(sys.argv[2] if len(sys.argv) > 2 else "{}")), indent=2))
