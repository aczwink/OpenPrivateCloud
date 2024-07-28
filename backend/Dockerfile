FROM node

WORKDIR /app
RUN npm install ssh2

COPY ./dist/bundle.js ./
CMD [ "node", "bundle.js" ]