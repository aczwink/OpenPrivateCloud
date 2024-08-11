FROM node

WORKDIR /app
RUN npm install ssh2
RUN apt update && apt install --no-install-recommends -y mariadb-client && apt clean autoclean && apt autoremove --yes && rm -rf /var/lib/{apt,dpkg,cache,log}/ && rm -rf /tmp/* /var/tmp/*

COPY ./dist/bundle.js ./
CMD [ "node", "bundle.js" ]