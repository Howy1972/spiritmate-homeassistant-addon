# https://developers.home-assistant.io/docs/add-ons/configuration#add-on-dockerfile
ARG BUILD_FROM
FROM $BUILD_FROM

# Execute during the build of the image
ARG TEMPIO_VERSION BUILD_ARCH
RUN \
    curl -sSLf -o /usr/bin/tempio \
    "https://github.com/home-assistant/tempio/releases/download/${TEMPIO_VERSION}/tempio_${BUILD_ARCH}"

# Install Node.js toolchain for building the worker
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    py3-pip \
    make \
    g++

# Create app directory
WORKDIR /app

# Copy worker package files and install deps first (cache layer)
COPY worker/package*.json ./
RUN npm ci --only=production

# Copy worker sources and build
COPY worker/tsconfig.json ./
COPY worker/src ./src
RUN npm run build

# Copy root filesystem
COPY rootfs /
