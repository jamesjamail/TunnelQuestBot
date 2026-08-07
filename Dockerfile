##########################
##  Create build image  ##
##########################
FROM node:24-alpine AS build_image

# Set our working directory to /app
WORKDIR /app

# Install openssl for prisma
RUN apk add --no-cache openssl

# Copy only the package.json files to utilize layer cache
COPY package*.json /app/

# Install node dependencies. `npm ci` rather than `npm install` so the image is
# built from the same dependency tree CI tested against; `npm install` is free to
# resolve differently, which would let a green CI ship an image nobody has run.
RUN npm ci

# Copy over necessary source/configs
COPY tsconfig.json prisma.config.ts /app/
COPY src/ /app/src/

# Generate the prisma interface, then compile our code from TS to JS
RUN npm run build

# Remove development/buildtime modules
RUN npm prune --omit=dev

##########################
## Create runtime image ##
##########################
FROM node:24-alpine AS runtime_image

# Set our working directory to /app
WORKDIR /app

# Install openssl for prisma
RUN apk add --no-cache openssl

COPY --from=build_image /app/package*.json /app/
COPY --from=build_image /app/node_modules /app/node_modules
COPY --from=build_image /app/build /app/build
# `prisma migrate deploy` runs on every container start and reads exactly these
# three paths. The rest of src/prisma is TypeScript that only matters at build
# time; the container runs its compiled form from /app/build.
COPY --from=build_image /app/prisma.config.ts /app/
COPY --from=build_image /app/src/prisma/schema.prisma /app/src/prisma/
COPY --from=build_image /app/src/prisma/migrations /app/src/prisma/migrations
COPY --from=build_image /app/src/lib/gameData/*.json /app/src/lib/gameData/

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
CMD ["/app/docker-entrypoint.sh"]
