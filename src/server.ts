import { createServer, Server as HTTPServer } from 'http';
import app from './app';
import seedSuperAdmin from './app/DB';
import config from './config';
import { customConsole } from './app/utils/customConsole';
import { setupWebSocketServer } from './app/modules/Socket/socket.service';
const port = config.port || 5000;

async function main() {
  const server: HTTPServer = createServer(app).listen(port, () => {
    customConsole(port, 'Initial Project (Server)')
    seedSuperAdmin();
  });

  setupWebSocketServer(server);


  const exitHandler = () => {
    if (server) {
      server.close(() => {
        console.info('Server closed!');
      });
    }
    process.exit(1);
  };

  process.on('uncaughtException', error => {
    console.log(error);
    exitHandler();
  });

  process.on('unhandledRejection', error => {
    console.log(error);
    exitHandler();
  });
}

main();
