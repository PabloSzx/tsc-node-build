#!/usr/bin/env node

const { program } = require("commander");
const { watch } = require("../src/main.js");

program
  .allowUnknownOption()
  .version(require("../package.json").version)
  .option(
    "-p, --project <path>",
    "path of tsconfig.json or directory containing tsconfig.json"
  )
  .option("--clean", "Clean dist folder before building", false)
  .option("--onSuccess <script>")
  .action((options) => {
    watch(options).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program.parse(process.argv);
