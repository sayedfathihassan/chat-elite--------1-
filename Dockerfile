# Use Node.js 20 LTS (required for better-sqlite3 and other packages)
FROM node:20-slim

# Install Python and build tools (required for better-sqlite3 native compilation)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the frontend (Vite)
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Start the server
CMD ["npx", "tsx", "server.ts"]
