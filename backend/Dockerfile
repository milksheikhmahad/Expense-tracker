# One image, two roles:
#   API    → default CMD (node src/server.js)
#   Worker → command overridden to: node src/worker.js
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
