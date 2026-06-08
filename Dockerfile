# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite variables are embedded at build time.
ARG VITE_FHIR_BASE_URL=/fhir-proxy/
ARG VITE_SCHEMA_BASE_URL=/schema-proxy/R5
ENV VITE_FHIR_BASE_URL=$VITE_FHIR_BASE_URL
ENV VITE_SCHEMA_BASE_URL=$VITE_SCHEMA_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
