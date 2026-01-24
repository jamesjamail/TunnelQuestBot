##########################
##  Create build image  ##
##########################
FROM node:20-alpine AS build_image

# Set our working directory to /app
WORKDIR /app

# Install openssl for prisma
RUN apk add --no-cache openssl

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
FROM node:20-alpine AS runtime_image

# Set our working directory to /app
WORKDIR /app

# Install openssl for prisma
RUN apk add --no-cache openssl

COPY --from=build_image /app/package*.json /app/
COPY --from=build_image /app/node_modules /app/node_modules
COPY --from=build_image /app/build /app/build
COPY --from=build_image /app/src/prisma /app/src/prisma
COPY --from=build_image /app/src/lib/gameData/*.json /app/src/lib/gameData/

# Use the FAKE_LOGS to decide whether to start in dev mode or start mode
CMD if [[ "$FAKE_LOGS" =~ ^[tT] ]]; then npm run dev; elif [[ "$DEBUG_MODE" =~ ^[tT] ]]; then npm run debug; else npm start; fi
