# udgok-takeoff

IFC/BIM → per-trade quantity takeoff service. Called by the UDGOK CMS when a user uploads an `.ifc` file to a project.

## Deploy (Fly.io)

```bash
# One-time
fly launch --name udgok-takeoff --no-deploy
fly secrets set TAKEOFF_API_KEY=<generate a long random string>
fly deploy

# 1 shared-cpu-1x / 1GB RAM is enough for ~200MB IFC files.
# Bump to 2GB if parse OOMs on big models:
#   fly scale memory 2048
```

## Smoke test

```bash
curl -s -X POST https://udgok-takeoff.fly.dev/takeoff \
  -H "Content-Type: application/json" \
  -H "X-Takeoff-Key: $KEY" \
  -d '{"url": "https://<some-public-ifc-url>"}' | jq .
```

## Why IFC and not PDF

PDF takeoff requires manual measurement or AI vision — either way it's
an estimate. IFC/BIM is a database: every wall, pipe, fixture is a
typed object with declared dimensions. Extraction is a deterministic
query. The CMS keeps the PDF/AI takeoff path for projects that
don't ship an IFC (separate, future).

## Revit export gotcha (THE #1 support question)

In Revit's IFC export dialog, **Export Base Quantities must be ON**.
Without it, every element comes through with `elementsMissingQuantity`
in the result and the totals look weirdly low. The CMS surfaces this
in the UI; users will still email support about it.

## License

This service uses `ifcopenshell` (LGPL). We use it as a dynamically
linked Python library; no source is copied. We're good.
