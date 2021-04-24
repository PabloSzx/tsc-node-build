#!/usr/bin/env node

const { program } = require("commander");
const { build } = require("../src/main.js");

program
  .allowUnknownOption()
  .version(require("../package.json").version)
  .option(
    "-p, --project <path>",
    "path of tsconfig.json or directory containing tsconfig.json"
  )
  .option("--clean", "Clean dist folder before building", false)
  .option("--dir <directory>", "Specify output directory", "dist")
  .action((options) => {
    build(options).catch(() => {
      process.exit(1);
    });
  });

program.parse(process.argv);
