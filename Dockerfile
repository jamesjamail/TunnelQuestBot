FROM node:latest

WORKDIR /app

# Copy over necessary source/configs
COPY package*.json ./
COPY .env ./
COPY tsconfig.json ./
COPY src/ ./src/

# Install node dependencies
RUN npm install

# Generate the prisma interface
RUN npx prisma generate

# Compile our code from TS to JS
RUN npm run build

# Start the app
CMD npm start