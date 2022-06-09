FROM node:16

WORKDIR /app
COPY ./package.json /app/
RUN yarn
COPY . /app/
RUN yarn build

CMD [ "node", "app.js" ]