import {
  CustumerError,
  IErrorResponse
} from './shared/globals/helpers/error-handler';
import {
  Application,
  json,
  urlencoded,
  Response,
  Request,
  NextFunction
} from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import cookierSession from 'cookie-session';
import HTTP_STATUS from 'http-status-codes';
import 'express-async-errors';
import { config } from './config';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import applicationRoutes from './route';
import Logger from 'bunyan';

const SERVER_PORT = 5000;
const log: Logger = config.createLogger('server');

export class ChattyServer {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public start(): void {
    this.sercurityMiddleware(this.app);
    this.standerMiddleware(this.app);
    this.globalErroeHandler(this.app);
    this.startServer(this.app);
    this.routeMiddleware(this.app);
  }

  private sercurityMiddleware(app: Application): void {
    app.use(
      cookierSession({
        name: 'session',
        keys: [config.SECRET_KEY_ONE!, config.SECRET_KEY_TWO!],
        maxAge: 24 * 7 * 3600000,
        secure: config.NODE_ENV !== 'development'
      })
    );
    app.use(hpp());
    app.use(helmet());
    app.use(
      cors({
        origin: 'dev.chatapp.com',
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      })
    );
  }

  private standerMiddleware(app: Application): void {
    app.use(compression());
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));
  }

  private routeMiddleware(app: Application): void {
    applicationRoutes(app);
  }

  private globalErroeHandler(app: Application): void {
    app.all('*', (req: Request, res: Response) => {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        message: `${req.originalUrl} not found`
      });
    });

    app.use(
      (
        error: IErrorResponse,
        req: Request,
        res: Response,
        next: NextFunction
      ) => {
        log.error(error);
        if (error instanceof CustumerError) {
          return res.status(error.statusCode).json(error.serializeError());
        }
        next();
      }
    );
  }

  private async startServer(app: Application): Promise<void> {
    try {
      const httpServier: http.Server = new http.Server(app);
      const socketIO: Server = await this.createSocketIO(httpServier);
      this.startHttpServer(httpServier);
      this.socketIOConnections(socketIO);
    } catch (e) {
      log.error('this startServer error :', e);
    }
  }

  private async createSocketIO(httpServer: http.Server): Promise<Server> {
    const io: Server = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      }
    });
    const pubClient = createClient({ url: config.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    return io;
  }

  private startHttpServer(httpServer: http.Server): void {
    log.info('server has started withe process :', process.pid);
    httpServer.listen(SERVER_PORT, () => {
      log.info('Server log port : ', SERVER_PORT);
    });
  }

  private socketIOConnections(io: Server): void {}
}
