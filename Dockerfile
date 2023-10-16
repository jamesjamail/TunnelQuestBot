FROM node:alpine

# Set our working directory to /app
WORKDIR /app

# Copy only the package.json files to utilize layer cache
COPY package*.json /app/

# Install node dependencies
RUN npm install

# Copy over necessary source/configs
COPY .env tsconfig.json /app/
COPY src/ /app/src/

# Generate the prisma interface
RUN npx prisma generate

# Compile our code from TS to JS
RUN npm run build

# Use the FAKE_LOGS to decide whether to start in dev mode or start mode
CMD if [[ "$FAKE_LOGS" =~ ^[tT] ]]; then npm run dev; else npm start; fi
