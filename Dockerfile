# Single-container build: React (Vite) frontend + Express backend.
# The backend serves the built frontend itself under BASE_PATH, so the
# whole app is reachable on one port (see backend/src/index.js).

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/. .

# Vite bakes these in at build time, so they must be supplied as build args.
ARG VITE_BASE_URL=listing-ccd/
ARG VITE_API_BASE_URI=
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ENV VITE_BASE_URL=$VITE_BASE_URL \
    VITE_API_BASE_URI=$VITE_API_BASE_URI \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID

RUN npm run build

FROM node:20-alpine AS backend-deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/. .
COPY --from=frontend-build /app/frontend/dist ./public

# Path segment the whole app is served under, and the port it listens on.
ENV BASE_PATH=/listing-ccd
ENV PORT=6026
EXPOSE 6026

CMD ["npm", "start"]
