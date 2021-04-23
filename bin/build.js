#!/usr/bin/env node

const { program, option } = require("commander");
const { build } = require("../src/main.js");

program
  .allowUnknownOption()
  .version(require("../package.json").version)
  .option(
    "-p, --project <path>",
    "path of tsconfig.json or directory containing tsconfig.json"
  );
option("--clean", "Clean dist folder before building", true).action(
  (options) => {
    build(options.project, program.args).catch(() => {
      process.exit(1);
    });
  }
);

program.parse(process.argv);
