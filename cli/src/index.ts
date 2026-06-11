import { Command } from 'commander';
import { auth } from './commands/auth.js';
import { tickets } from './commands/tickets.js';

const brand = process.env.SUPPUO ?? 'suppuo';

const program = new Command()
  .name(brand)
  .description(`CLI for ${brand} — part of the Forjio commerce suite.`)
  .version('0.1.0');

program.addCommand(auth);
program.addCommand(tickets);

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
