import { createApp } from './app.ts';

const port = Number(process.env.PORT || 3000);
const app = createApp();
const server = app.listen(port, () => {
  console.log(`listening on :${port}`);
});

const shutdown = (signal: string) => {
  console.log(`received ${signal}, shutting down`);
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exitCode = 1;
    }
    process.exit();
  });
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}
