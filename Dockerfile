# ==============================================================================
# Dockerfile - Realtime Orders System Backend
# ==============================================================================

# Use Node.js 18 on Alpine Linux for a lightweight, secure, and minimal footprint
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker layer caching.
# This prevents reinstalling dependencies on every source code change.
COPY package*.json ./

# Install dependencies (including devDependencies like nodemon for active development)
# Use 'npm install' or 'npm ci' to install precisely what is in the lockfile.
RUN npm ci

# Copy the rest of the application source code into the container
COPY . .

# Expose the API and WebSocket server port (default 3000)
EXPOSE 3000

# Set default environment variables (overridden by docker-compose)
ENV PORT=3000
ENV NODE_ENV=development

# Startup command. In development, we use 'npm run dev' to allow nodemon 
# to watch for file changes mounted via docker-compose volumes.
CMD ["npm", "run", "dev"]
