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
  .option("--onSuccess <script>")
  .action((options) => {
    watch({
      project: options.project,
      onSuccess: options.onSuccess,
      args: program.args,
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program.parse(process.argv);
