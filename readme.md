# DPR

Served in production at `iitg.ac.in/listing-ccd`. Frontend and backend both live
under the `/listing-ccd` base path so they can sit behind a single reverse proxy.

## Local development (one command)

```bash
npm install          # installs root, backend and Frontend deps
npm run dev           # runs backend (nodemon-style watch) + frontend (vite) concurrently
```

Backend dev server: http://localhost:8081/listing-ccd
Frontend dev server: http://localhost:5173/listing-ccd/

Copy `backend/env.sample` to `backend/.env` and `Frontend/env.sample` to
`Frontend/.env` first, and fill in real secrets (Mongo URI, Azure app
credentials, Firebase config). `BASE_PATH` (backend) and `VITE_BASE_URL`
(frontend) must always match.

## Docker

Each service has its own Dockerfile; the root `docker-compose.yml` runs both
together.

```bash
cp .env.sample .env          # set BASE_PATH_NAME, ports, VITE_* build vars
# create backend/.env and Frontend/.env from their env.sample files (nano them)
docker compose up -d --build
```

- Frontend container: served at `http://localhost:${FRONTEND_PORT:-6026}/listing-ccd`
- Backend container: served at `http://localhost:${BACKEND_PORT:-8081}/listing-ccd/api`

There is no reverse proxy in this repo. To publish everything under one
public host/path (e.g. `iitg.ac.in/listing-ccd`), point your own reverse
proxy at the two container ports above, forwarding `/listing-ccd/api` and
`/listing-ccd/admin` to the backend and everything else under
`/listing-ccd` to the frontend.

**Azure AD note:** changing `BASE_PATH` changes the OAuth redirect URI
(`.../listing-ccd/api/auth/azure/callback`). Update the redirect URI
registered in the Azure App registration to match whatever `AZURE_REDIRECT_URI`
is set to in `backend/.env`.

## Adding sample users

```bash
cd backend/src/db
node addUsers.js
```
