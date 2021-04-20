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
   * @type {string | undefined}
   */
  project,
  /**
   * @type {string[] | undefined}
   */
  args = []
) {
  const timeStart = Date.now();
  const distPath = resolvePath(project, "dist");
  await rimrafPromise(distPath);

  const tscProject = "tsc" + (project ? " -p " + project : "");

  const cjs = concurrently([
    tscProject + ` --outDir ${distPath}/cjs -m commonjs`,
    ...args,
  ]);
  const esm = concurrently(
    [tscProject + ` --outDir ${distPath}/esm -m es2020`, ...args],
    {
      //@ts-ignore
      outputStream: {
        write() {
          return true;
        },
      },
    }
  );

  await Promise.all([cjs, esm, writeModuleType()]);

  console.log("Done in " + (Date.now() - timeStart + "ms"));
};

async function writeModuleType(
  /**
   * @type {string | undefined}
   */
  project
) {
  const distPath = resolvePath(project, "dist");

  try {
    const packageJsonString = await promises.readFile(
      resolve(resolvePath(project), "./package.json"),
      {
        encoding: "utf-8",
      }
    );

    const packageJson = JSON.parse(packageJsonString);

    if (packageJson.type === "module") {
      await mkdirp(distPath + "/cjs");
      await promises.writeFile(
        distPath + "/cjs/package.json",
        JSON.stringify({ type: "commonjs" })
      );
    } else {
      await mkdirp(distPath + "/esm");
      await promises.writeFile(
        distPath + "/esm/package.json",
        JSON.stringify({ type: "module" })
      );
    }
  } catch (err) {
    await mkdirp(distPath + "/esm");
    await promises.writeFile(
      distPath + "/esm/package.json",
      JSON.stringify({ type: "module" })
    );
  }
}

exports.watch = async function watch(
  /**
   * @type {{project?: string;onSuccess?: string;args?:string[]}}
   */
  options = {}
) {
  const distPath = resolvePath(options.project, "dist");

  await rimrafPromise(distPath);

  await writeModuleType(options.project);

  const tscWatchJs = require.resolve("../tsc-watch/tsc-watch.js");

  const project = options.project
    ? ["--noClear", "-p", options.project]
    : ["--noClear"];

  const watcher = fork(
    tscWatchJs,
    [
      ...project,
      "--outDir",
      distPath + "/cjs",
      "-m",
      "commonjs",
      ...(options.args || []),
    ],
    {
      stdio: "inherit",
    }
  );
  const watcherEsm = fork(
    tscWatchJs,
    [
      ...project,
      "--outDir",
      distPath + "/esm",
      "-m",
      "es2020",
      ...(options.args || []),
    ],
    {
      stdio: "ignore",
    }
  );

  /**
   * @type {number}
   */
  let prevProcess;

  let cjsReady = false;
  let esmReady = false;

  async function startProcess() {
    if (prevProcess) await killPromise(prevProcess);
    if (typeof options.onSuccess === "string") {
      prevProcess = shelljs.exec(options.onSuccess, {
        async: true,
      }).pid;
    }
  }

  watcherEsm.on("message", async (message) => {
    switch (message) {
      case "new_compilation": {
        esmReady = false;
        break;
      }
      case "success": {
        esmReady = true;
        if (cjsReady) startProcess();
        break;
      }
    }
  });

  watcher.on("message", async (message) => {
    switch (message) {
      case "new_compilation": {
        cjsReady = false;
        break;
      }
      case "success": {
        cjsReady = true;
        if (esmReady) startProcess();
        break;
      }
    }
  });
};
