# Runs Set Piece on Hugging Face Spaces (or any Docker host).
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
# Spaces run the container as user 1000 and route traffic to port 7860.
ENV NODE_ENV=production PORT=7860 DATA_DIR=/app/data
RUN mkdir -p /app/data && chown -R 1000:1000 /app
USER 1000
EXPOSE 7860
CMD ["npm", "start"]
