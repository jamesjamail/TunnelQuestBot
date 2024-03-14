##########################
##  Create build image  ##
##########################
FROM node:alpine AS BUILD_IMAGE

# Set our working directory to /app
WORKDIR /app

# Copy only the package.json files to utilize layer cache
COPY package*.json /app/

# Install node dependencies
RUN npm install

# Copy over necessary source/configs
COPY tsconfig.json /app/
COPY src/ /app/src/

# Generate the prisma interface
RUN npx prisma generate

# Compile our code from TS to JS
RUN npm run build

# Remove development/buildtime modules
RUN npm prune --omit=dev

##########################
## Create runtime image ##
##########################
FROM node:alpine AS RUNTIME_IMAGE

# Set our working directory to /app
WORKDIR /app

COPY --from=BUILD_IMAGE /app/package*.json /app/
COPY --from=BUILD_IMAGE /app/node_modules /app/node_modules
COPY --from=BUILD_IMAGE /app/build /app/build
COPY --from=BUILD_IMAGE /app/src/prisma /app/src/prisma
COPY --from=BUILD_IMAGE /app/src/lib/gameData/*.json /app/src/lib/gameData/

# Use the FAKE_LOGS to decide whether to start in dev mode or start mode
CMD if [[ "$FAKE_LOGS" =~ ^[tT] ]]; then npm run dev; elif [[ "$DEBUG_MODE" =~ ^[tT] ]]; then npm run debug; else npm start; fi
