FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
