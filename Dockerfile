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

# Don't fake logs by default
ENV FAKE_LOGS false

# Use the RUN_MODE to decide whether to start in dev mode or start mode
CMD if [ "$FAKE_LOGS" ]; then npm run dev; else npm start; fi
