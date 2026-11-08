import { seedAll } from "../lib/seed";
seedAll(console.log).catch((e) => {
  console.error(e);
  process.exit(1);
});
