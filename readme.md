# DPR

Served in production at `iitg.ac.in/listing-ccd`. One container: the Express
backend serves the built React (Vite) frontend itself under `/listing-ccd`,
and the API under `/listing-ccd/api` — same process, same port, no reverse
proxy needed.

## Local development (one command)

```bash
npm install          # installs root, backend and Frontend deps
npm run dev           # runs backend + frontend (vite) concurrently
```

Backend dev server: http://localhost:8081/listing-ccd
Frontend dev server: http://localhost:5173/listing-ccd/ (calls the backend directly, cross-port)

Copy `backend/env.sample` to `backend/.env` and `Frontend/env.sample` to
`Frontend/.env` first, and fill in real secrets (Mongo URI, Azure app
credentials, Firebase config). `BASE_PATH` (backend) and `VITE_BASE_URL`
(frontend) must always match.

## Deploying on the server (SSH)

```bash
ssh you@server
git clone https://github.com/laladwesh/dpr.git
cd dpr

cp .env.sample .env
nano .env                      # BASE_PATH_NAME (default listing-ccd), PORT (default 6026),
                                # VITE_* build args (Firebase config, VITE_API_BASE_URI blank)

cp backend/env.sample backend/.env
nano backend/.env              # MONGODB_URI, Azure app creds, admin creds, session secret, etc.

docker compose up -d --build
```

That's it — the app is reachable at `http://<server>:6026/listing-ccd`
(API at `.../listing-ccd/api`, admin at `.../listing-ccd/admin`). The
container uses `network_mode: host` (see `docker-compose.yml`), so it binds
directly to the host's port and can reach a MongoDB already running on the
host at `127.0.0.1:27017` — no extra networking setup required. If you'd
rather run Mongo in a container instead, start it with:

```bash
docker compose --profile with-mongo up -d
```
(and point `MONGODB_URI` in `backend/.env` at `mongodb://127.0.0.1:27017/<db>`).

To publish under `iitg.ac.in/listing-ccd`, point IITG's reverse proxy at
this server's port 6026.

**Azure AD note:** changing `BASE_PATH` changes the OAuth redirect URI
(`.../listing-ccd/api/auth/azure/callback`). Update the redirect URI
registered in the Azure App registration to match whatever
`AZURE_REDIRECT_URI` is set to in `backend/.env`.

**Redeploying after a code change:**

```bash
git pull
docker compose up -d --build
```

## Adding sample users

```bash
cd backend/src/db
node addUsers.js
```
