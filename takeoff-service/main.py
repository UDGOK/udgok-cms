"""
FastAPI wrapper for the IFC takeoff extractor.

Auth: one shared secret in the `X-Takeoff-Key` header. The service
is not user-facing — it only ever receives blob URLs from the CMS.

Deploy: Fly.io, `fly launch --name udgok-takeoff` then
`fly secrets set TAKEOFF_API_KEY=<...>` then `fly deploy`.
Smoke test: see README.md.
"""
import os
import tempfile

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, HttpUrl

from extractor import run_takeoff

app = FastAPI(title="udgok-takeoff")
API_KEY = os.environ["TAKEOFF_API_KEY"]
MAX_BYTES = 500 * 1024 * 1024  # 500 MB hard cap


class TakeoffRequest(BaseModel):
    url: HttpUrl  # Vercel Blob URL of the .ifc


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/takeoff")
async def takeoff(req: TakeoffRequest, x_takeoff_key: str = Header(None)):
    if x_takeoff_key != API_KEY:
        raise HTTPException(401, "bad key")

    with tempfile.NamedTemporaryFile(suffix=".ifc") as tmp:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("GET", str(req.url)) as r:
                if r.status_code != 200:
                    raise HTTPException(422, f"could not fetch IFC ({r.status_code})")
                total = 0
                async for chunk in r.aiter_bytes():
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise HTTPException(413, "IFC file exceeds 500MB cap")
                    tmp.write(chunk)
        tmp.flush()
        try:
            result = run_takeoff(tmp.name)
        except Exception as e:  # corrupt/non-IFC file
            raise HTTPException(422, f"IFC parse failed: {e}")

    return result
