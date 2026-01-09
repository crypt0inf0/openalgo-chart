# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

# Create config.js that sets localStorage defaults for Docker environment
RUN echo "if (!localStorage.getItem('oa_host_url')) { localStorage.setItem('oa_host_url', 'http://localhost:5555'); } if (!localStorage.getItem('oa_ws_url')) { localStorage.setItem('oa_ws_url', 'localhost:8765'); }" > /app/dist/config.js

# Inject config.js into index.html
RUN sed -i 's|</head>|<script src="/config.js"></script></head>|' /app/dist/index.html

EXPOSE 5001

CMD ["serve", "-s", "dist", "-l", "5001"]
