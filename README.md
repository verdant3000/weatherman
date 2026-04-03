# Brooks WX Monitor

Weather monitoring dashboard for the **Brooks shoot — June 10–11, 2026**.  
Black Tusk / Garibaldi alpine zone · Field Trip Production

## What it does

- **16-day Open-Meteo forecast** for Brohm Ridge (1,550m), Goat Ridge (~1,900m), and Squamish valley — updated every 6h, **freezing level prominently tracked**
- **Live PWS readings** from Weather Underground stations in Squamish (requires WU API key)
- **Historical baseline** from 2 years of BTSC Brohm Ridge sensor data (2024–2026) — June 10–11 normals baked in
- **Daily camera capture** at 9am PT from BTSC webcam (btsc.ca/NetCamImg/WCSnow.jpg) + Hwy 99 reference cam — building a timelapse to shoot day
- **Daily email digest** at 7am PT with forecast summary, FZL status, and station readings
- **HOBOlink stub** for Sea to Sky Gondola Habrich Ridge station — activates once you get credentials

## Quick start (local)

```bash
cp .env.example .env
# Edit .env — add WU_API_KEY at minimum

npm run install:all
npm run build
npm start
# → http://localhost:3001
```

## Deploy to Railway

```bash
# 1. Create new Railway project
railway new

# 2. Add Postgres (optional — app uses SQLite by default)
# railway add postgresql

# 3. Set env vars in Railway dashboard:
#    WU_API_KEY, SMTP_USER, SMTP_PASS, DIGEST_TO, NODE_ENV=production

# 4. Deploy
railway up
```

**Required Railway env vars:**
| Variable | Description |
|---|---|
| `WU_API_KEY` | Weather Underground API key (free for PWS contributors) |
| `SMTP_USER` | Gmail address for digest emails |
| `SMTP_PASS` | Gmail app password |
| `DIGEST_TO` | Email address to send digest to |
| `NODE_ENV` | Set to `production` |

**Optional:**
| Variable | Description |
|---|---|
| `HOBOLINK_TOKEN` | S2S Gondola HOBOlink API token (pending) |
| `HOBOLINK_LOGGER_ID` | HOBOlink logger ID |
| `CAMERA_CRON` | Cron for camera capture (default: `0 16 * * *` = 9am PT) |
| `DATA_DIR` | Path for SQLite DB + screenshots (default: `./data`) |

## Getting a WU API key

1. Register at wunderground.com
2. Go to **My Profile → My Devices** → Add a PWS device
3. Go to **API Keys** tab → Create key
4. It's free for PWS contributors

## PWS stations monitored

| Station ID | Name | Elevation |
|---|---|---|
| IBCSQUAM12 | Garibaldi Highlands (your neighbourhood) | ~380m |
| ISQUAM29 | S2S Gondola Summit | 885m |
| ISQUAM21 | Squamish North | ~60m |
| ISQUAM23 | Squamish | ~40m |
| IBRITISH490 | Crumpit Woods | ~200m |

## HOBOlink activation (Sea to Sky Gondola)

Email info@seatoskygondola.com requesting API token for the Habrich Ridge (1,550m) station.  
Frame as: "Field Trip Production is monitoring alpine conditions for a June shoot and would like API access to your backcountry weather station data."

Public dashboard: https://www.licor.cloud/dashboards/public/1cbe7853-62cd-4bf0-b844-11c12d633446/true

Once you have credentials, set `HOBOLINK_TOKEN` and `HOBOLINK_LOGGER_ID` in Railway — live data activates automatically on next deploy.

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/status` | App status, config check |
| `GET /api/forecasts` | All location forecasts grouped |
| `GET /api/forecasts/shoot` | June 10–11 specific |
| `GET /api/readings/current` | Latest PWS readings |
| `GET /api/normals` | BTSC historical baseline |
| `GET /api/cameras` | Camera list + latest screenshots |
| `GET /api/cameras/:id/image/latest` | Serve latest screenshot |
| `POST /api/trigger/fetch` | Manually trigger data fetch |
| `POST /api/trigger/capture` | Manually trigger camera capture |
| `POST /api/trigger/digest` | Manually send email digest |

## Shoot target criteria

| FZL Level | Status | Notes |
|---|---|---|
| >2,200m | ✅ Excellent | Solid snow to Black Tusk summit |
| 1,800–2,200m | 🟡 Good | Alpine snow, treeline clear |
| 1,500–1,800m | 🟠 Monitor | Marginal above-treeline coverage |
| <1,500m | 🔴 Concern | Snow line low, reassess locations |

**Historical June 10–11 at 1,550m (2024+2025):**
- June 10: avg 12.1°C, min 7.0°C, max 18.6°C — 100% hours above 0°C
- June 11: avg 8.0°C, min 1.4°C, max 15.6°C — 100% hours above 0°C
