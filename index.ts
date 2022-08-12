import http, {
  ServerResponse,
  OutgoingHttpHeaders,
  IncomingMessage,
} from "http";

interface Context {
  res: ServerResponse;
  req: IncomingMessage;
  onerror: (err: Error) => void;
  request: {
    url: string;
    pathname: string;
    query: string;
  };
  response: {
    statusCode: number;
    statusMessage: string;
    body: string | Buffer;
    headers: OutgoingHttpHeaders;
  };
}

type MiddleWare = (ctx: Context, next: NextHandler) => Promise<void>;
type NextHandler = () => Promise<void>;
type Controller = (ctx: Context) => Promise<void>;

const METHODS: ("get" | "post" | "put" | "delete")[] = [
  "get",
  "post",
  "put",
  "delete",
];
class Router {
  pathToHandler: Record<string, Record<string, Function>> = {};
  get: (path: string, handler: Controller) => void = () => void 0;
  post: (path: string, handler: Controller) => void = () => void 0;
  put: (path: string, handler: Controller) => void = () => void 0;
  delete: (path: string, handler: Controller) => void = () => void 0;
  constructor() {
    // this.pathToHandler = {};
    METHODS.forEach((method) => {
      this[method] = (path: string, handler: Controller) => {
        this.pathToHandler[method] = {};
        this.pathToHandler[method][path] = handler;
      };
    });
  }

  routes = this._routes.bind(this);

  async _routes(ctx: Context, next: NextHandler) {
    const path = ctx.req.url || "/";

    switch (ctx.req.method?.toLowerCase()) {
      case "get":
        await this.pathToHandler["get"][path](ctx);
        break;
      case "post":
        await this.pathToHandler["post"][path](ctx);
        break;
      case "put":
        await this.pathToHandler["put"][path](ctx);
        break;
      case "delete":
        await this.pathToHandler["delete"][path](ctx);
        break;
      default:
        throw "METHOD Error";
    }
    await next();
  }
}

class MyKoa {
  middlewares: MiddleWare[];
  constructor() {
    this.middlewares = [];
  }

  /**
   *
   * @param {(ctx, next: ) => Promise<undefined>} fn
   */
  use(fn: MiddleWare) {
    this.middlewares.push(fn);
  }

  createContext(request: IncomingMessage, response: ServerResponse): Context {
    const context = {
      req: request,
      res: response,
      onerror: (err: Error) => {
        console.error(err);
      },
      request: {
        url: "",
        pathname: "",
        query: "",
      },
      response: {
        statusCode: 404,
        statusMessage: "not found",
        body: "",
        headers: {
          "content-type": "application/json",
          Connection: "Keep-Alive",
          "Keep-Alive": "timeout=5, max=1000",
        },
      },
    };

    return context;
  }

  compose() {
    return async (ctx: Context, final: MiddleWare) => {
      const run = async () => {
        const current = this.middlewares.shift();

        if (current) {
          await Promise.resolve(current(ctx, run));
        } else {
          final(ctx, async () => {});
        }
      };

      run();
    };
  }

  createlistener() {
    const fn = this.compose();

    return (req: IncomingMessage, res: ServerResponse) => {
      const ctx = this.createContext(req, res);
      return this.handleRequest(ctx, fn);
    };
  }

  async respond(ctx: Context) {
    const res = ctx.res;
    res.writeHead(
      ctx.response.statusCode,
      ctx.response.statusMessage,
      ctx.response.headers || {}
    );
    res.write(
      ctx.response.body,
      "utf-8"
    );
    res.end();
  }

  async handleRequest(ctx: Context, fnMiddleware: MiddleWare) {
    const handleServerResponse = () => this.respond(ctx);
    const onerror = (err: Error) => ctx.onerror(err);

    try {
      await fnMiddleware(ctx, async () => {
        console.log("last one");
      });
      await handleServerResponse();
    } catch (e) {
      onerror(e as Error);
    }
  }

  listen(PORT: number) {
    http.createServer(this.createlistener()).listen(PORT, () => {
      console.log("start success");
    });
  }
}

const app = new MyKoa();
const router = new Router();

router.get("/hello", async (ctx) => {
  ctx.response.statusCode = 200;
  ctx.response.statusMessage = "ok";
  ctx.response.body = "hello world";
});
app.use(router.routes);

app.listen(3000);
