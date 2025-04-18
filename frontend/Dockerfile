FROM node:16-slim

WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Set environment variables for React
ENV NODE_ENV=development
ENV REACT_APP_API_URL=http://localhost:8000

EXPOSE 3000

CMD ["npm", "start"]
