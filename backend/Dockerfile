# Use the official Node.js image as the base (alpine = lightweight Linux)
FROM node:20-alpine
# Set the working directory inside the container
WORKDIR /app

# Copy package files first (before the rest of the code)
# This lets Docker cache the npm install step separately
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code into the container
COPY . .
# Tell Docker this container listens on port 3000
EXPOSE 3000

# Command to start the server when the container runs
CMD ["node", "server.js"]
