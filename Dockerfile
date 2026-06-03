# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite variables are embedded at build time.
ARG VITE_FHIR_BASE_URL=https://google-fhir.fhir-aggregator.org/
ARG VITE_SCHEMA_BASE_URL=https://hl7.org/fhir/R5
ENV VITE_FHIR_BASE_URL=$VITE_FHIR_BASE_URL
ENV VITE_SCHEMA_BASE_URL=$VITE_SCHEMA_BASE_URL

RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

RUN npm install -g serve
COPY --from=build /app/dist ./dist

EXPOSE 4173
CMD ["sh", "-c", "serve -s dist -l ${PORT:-4173}"]
