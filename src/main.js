const concurrently = require("concurrently");
const { promises } = require("fs");
const { resolve, dirname } = require("path");
const rimraf = require("rimraf");
const kill = require("tree-kill");
const shelljs = require("shelljs");
const mkdirp = require("mkdirp");
const { fork } = require("child_process");

/**
 * @type {(pid: number) => Promise<unknown>}
 */
const killPromise = (pid) => new Promise((resolve) => kill(pid, resolve));

/**
 * @type {(path: string) => Promise<void>}
 */
const rimrafPromise = (path) =>
  new Promise((resolve, reject) =>
    rimraf(path, {}, (err) => (err ? reject(err) : resolve()))
  );

let outputDirectory = "dist";

function resolvePath(
  /**
   * @type {string | undefined}
   */
  project,
  /**
   * @type {string | undefined}
   */
  path = "."
) {
  if (project) {
    if (project.endsWith(".json")) {
      return resolve(dirname(project), path);
    }
    return resolve(project, path);
  }

  return resolve(path);
}

exports.build = async function build(
  /**
   * @type { {project?:string; args?:string[]; clean?:boolean; dir?:string; } | undefined }
   */
  options = {}
) {
  outputDirectory = options.dir || "dist";

  const { project, args = [], clean } = options;
  const timeStart = Date.now();
  const outputPath = resolvePath(project, outputDirectory);

  if (clean) await rimrafPromise(outputPath);

  const tscProject = "tsc" + (project ? " -p " + project : "");

  const cjs = concurrently(
    [
      tscProject + ` --outDir ${outputPath}/cjs -m commonjs --removeComments`,
      ...args,
    ],
    {
      //@ts-ignore
      outputStream: {
        write() {
          return true;
        },
      },
    }
  );
  const esm = concurrently(
    [
      tscProject + ` --outDir ${outputPath}/esm -m es2020 --removeComments`,
      ...args,
    ],
    {
      //@ts-ignore
      outputStream: {
        write() {
          return true;
        },
      },
    }
  );
  const types = concurrently([
    tscProject +
      ` --outDir ${outputPath}/types --declaration --emitDeclarationOnly -m es2020`,
    ...args,
  ]);

  await Promise.all([cjs, esm, types, writeModuleType()]);

  console.log("Done in " + (Date.now() - timeStart + "ms"));
};

async function writeModuleType(
  /**
   * @type {string | undefined}
   */
  project
) {
  const outputPath = resolvePath(project, outputDirectory);

  try {
    const packageJsonString = await promises.readFile(
      resolve(resolvePath(project), "./package.json"),
      {
        encoding: "utf-8",
      }
    );

    const packageJson = JSON.parse(packageJsonString);

    if (packageJson.type === "module") {
      await mkdirp(outputPath + "/cjs");
      await promises.writeFile(
        outputPath + "/cjs/package.json",
        JSON.stringify({ type: "commonjs" })
      );
    } else {
      await mkdirp(outputPath + "/esm");
      await promises.writeFile(
        outputPath + "/esm/package.json",
        JSON.stringify({ type: "module" })
      );
    }
  } catch (err) {
    await mkdirp(outputPath + "/esm");
    await promises.writeFile(
      outputPath + "/esm/package.json",
      JSON.stringify({ type: "module" })
    );
  }
}

exports.watch = async function watch(
  /**
   * @type {{project?: string; onSuccess?: string; args?:string[]; clean?:boolean; dir?:string }}
   */
  options = {}
) {
  outputDirectory = options.dir || "dist";

  const outputPath = resolvePath(options.project, outputDirectory);

  if (options.clean) await rimrafPromise(outputPath);

  await writeModuleType(options.project);

  const tscWatchJs = require.resolve("../tsc-watch/tsc-watch.js");

  const project = options.project
    ? ["--noClear", "-p", options.project]
    : ["--noClear"];

  const watcherCjs = fork(
    tscWatchJs,
    [
      ...project,
      "--outDir",
      outputPath + "/cjs",
      "-m",
      "commonjs",
      "--removeComments",
      ...(options.args || []),
    ],
    {
      stdio: "ignore",
    }
  );
  const watcherEsm = fork(
    tscWatchJs,
    [
      ...project,
      "--outDir",
      outputPath + "/esm",
      "-m",
      "es2020",
      "--removeComments",
      ...(options.args || []),
    ],
    {
      stdio: "ignore",
    }
  );
  const watcherTypes = fork(
    tscWatchJs,
    [
      ...project,
      "--outDir",
      outputPath + "/types",
      "--declaration",
      "--emitDeclarationOnly",
      "-m",
      "es2020",
      ...(options.args || []),
    ],
    {
      stdio: "inherit",
    }
  );

  /**
   * @type {number}
   */
  let prevProcess;

  let cjsReady = false;
  let esmReady = false;
  let typesReady = false;

  async function startProcess() {
    if (prevProcess) await killPromise(prevProcess);
    if (typeof options.onSuccess === "string") {
      prevProcess = shelljs.exec(options.onSuccess, {
        async: true,
      }).pid;
    }
  }

  watcherTypes.on("message", async (message) => {
    switch (message) {
      case "new_compilation": {
        typesReady = false;
        break;
      }
      case "success": {
        typesReady = true;
        if (esmReady && cjsReady) startProcess();
        break;
      }
    }
  });

  watcherEsm.on("message", async (message) => {
    switch (message) {
      case "new_compilation": {
        esmReady = false;
        break;
      }
      case "success": {
        esmReady = true;
        if (cjsReady && typesReady) startProcess();
        break;
      }
    }
  });

  watcherCjs.on("message", async (message) => {
    switch (message) {
      case "new_compilation": {
        cjsReady = false;
        break;
      }
      case "success": {
        cjsReady = true;
        if (esmReady && typesReady) startProcess();
        break;
      }
    }
  });
};
