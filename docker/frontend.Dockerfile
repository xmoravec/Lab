FROM node:22-alpine3.22 AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

FROM base AS development
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]

FROM base AS production
RUN npm run build
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
