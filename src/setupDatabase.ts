import mongoose from 'mongoose';
import { config } from './config';
import Logger from 'bunyan';

const log: Logger = config.createLogger('setupDatabase');

export default () => {
  const connect = () => {
    mongoose
      .connect(`${config.DATABASE_URL}`)
      .then(() => {
        log.info('Successfully connected to database');
      })
      .catch((e) => {
        log.error('this is error to connection app to database :', e);
        return process.exit(1);
      });
  };
  connect();

  mongoose.connection.on('disconnected', connect);
};
