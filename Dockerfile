FROM node:20-bullseye as bot

WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y ffmpeg
RUN apt-get install -y poppler-utils
RUN npm i
RUN npm i @ffmpeg-installer/ffmpeg
COPY . . 

ARG RAILWAY_STATIC_URL
ARG PUBLIC_URL
ARG PORT
CMD ["npm","start"]