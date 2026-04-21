import chalk from 'chalk';
import os from 'os';

export const customConsole = (port: string | number, name: string): void => {
  const timestamp = new Date().toLocaleTimeString();
  const divider = chalk.gray('━'.repeat(60));

  const getLocalIP = () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return '127.0.0.1';
  };

  const localIP = getLocalIP();

  console.log('\n' + divider);
  console.log(chalk.cyan('  ╭─────────────────────────────────────────────────────╮'));
  console.log(
    chalk.cyan('  │') +
    chalk.bgCyan.black.bold(`  🌟 ${name} APPLICATION SERVER  🌟   `) +
    chalk.cyan('│')
  );
  console.log(chalk.cyan('  ╰─────────────────────────────────────────────────────╯'));

  console.log('');
  console.log(chalk.gray('  ├─ ') + chalk.green.bold('Status: ') + chalk.greenBright('● ONLINE'));
  console.log(chalk.gray('  ├─ ') + chalk.blue.bold('Port: ') + chalk.yellow.bold(port.toString()));
  console.log(chalk.gray('  ├─ ') + chalk.magenta.bold('Started: ') + chalk.white(timestamp));
  console.log(
    chalk.gray('  ├─ ') + chalk.cyan.bold('Environment: ') + chalk.white(process.env.NODE_ENV || 'development')
  );

  console.log('');
  console.log(chalk.gray('  ├─ ') + chalk.green('Server ready at: ') + chalk.underline.blue(`http://localhost:${port}`));
  console.log(chalk.gray('  └─ ') + chalk.green('Accessible on Network: ') + chalk.underline.blue(`http://${localIP}:${port}`));

  console.log(divider);
  console.log(chalk.dim('  Press ') + chalk.yellow.bold('Ctrl+C') + chalk.dim(' to stop the server'));
  console.log('');
};
