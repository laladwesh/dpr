FROM node:20-alpine AS base
WORKDIR /app
FROM base AS dependencies
COPY package*.json ./
# Install app dependencies using 'npm ci' which is faster and more reliable for builds
RUN npm ci
FROM dependencies AS build
WORKDIR /app
COPY . .
FROM base AS production
WORKDIR /app
# Set NODE_ENV to production
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/ .

ENV PORT=8081
EXPOSE 8081

CMD [ "npm", "start" ]