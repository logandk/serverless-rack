"use strict";

const BbPromise = require("bluebird");
const _ = require("lodash");
const path = require("path");
const fse = BbPromise.promisifyAll(require("fs-extra"));
const child_process = require("child_process");
const stringArgv = require("string-argv");
const emptyDir = require("empty-dir");
const crypto = require("crypto");

class ServerlessRack {
  validate() {
    return new BbPromise((resolve) => {
      this.backupDir = ".serverless-rack-temp";
      this.cacheBundleDir = ".serverless-rack-bundle";
      this.enableBundler = fse.existsSync(
        path.join(this.serverless.config.servicePath, "Gemfile")
      );
      this.dockerizeBundler = false;
      this.dockerImage = null;
      this.dockerArgs = [];
      this.bundlerArgs = null;

      if (
        this.serverless.service.custom &&
        this.serverless.service.custom.rack
      ) {
        if (_.isBoolean(this.serverless.service.custom.rack.enableBundler)) {
          this.enableBundler = this.serverless.service.custom.rack.enableBundler;
        }

        if (_.isBoolean(this.serverless.service.custom.rack.dockerizeBundler)) {
          this.dockerizeBundler = this.serverless.service.custom.rack.dockerizeBundler;
        }

        this.bundlerArgs = this.serverless.service.custom.rack.bundlerArgs;

        if (this.serverless.service.custom.rack.dockerImage) {
          this.dockerImage = this.serverless.service.custom.rack.dockerImage;
          this.dockerArgs = [
            "bundle",
            "install",
            "--standalone",
            "--path",
            "vendor/bundle",
          ];
        } else {
          this.dockerImage = `logandk/serverless-rack-bundler:${this.serverless.service.provider.runtime}`;
        }
      }

      resolve();
    });
  }

  configurePackaging() {
    return new BbPromise((resolve) => {
      this.serverless.service.package = this.serverless.service.package || {};
      this.serverless.service.package.include =
        this.serverless.service.package.include || [];
      this.serverless.service.package.exclude =
        this.serverless.service.package.exclude || [];

      this.serverless.service.package.include = _.union(
        this.serverless.service.package.include,
        ["rack_adapter.rb", "serverless_rack.rb", ".serverless-rack"]
      );

      this.serverless.service.package.exclude.push(`${this.backupDir}/**`);

      resolve();
    });
  }

  locateBundler() {
    return new BbPromise((resolve) => {
      if (
        this.serverless.service.custom &&
        this.serverless.service.custom.rack &&
        this.serverless.service.custom.rack.bundlerBin
      ) {
        this.serverless.cli.log(
          `Using Bundler specified in "bundlerBin": ${this.serverless.service.custom.rack.bundlerBin}`
        );

        this.bundlerBin = this.serverless.service.custom.rack.bundlerBin;
        return resolve();
      }

      this.bundlerBin = "bundle";
      resolve();
    });
  }

  getRackHandlerConfiguration() {
    const config = {};

    if (
      this.serverless.service.custom &&
      this.serverless.service.custom.rack &&
      _.isArray(this.serverless.service.custom.rack.textMimeTypes)
    ) {
      config.text_mime_types = this.serverless.service.custom.rack.textMimeTypes;
    }
    if (
      this.serverless.service.custom &&
      this.serverless.service.custom.rack &&
      _.isString(this.serverless.service.custom.rack.configPath)
    ) {
      config.config_path = this.serverless.service.custom.rack.configPath;
    }

    return config;
  }

  packRackHandler(verbose = true) {
    if (!this.findHandler()) {
      this.serverless.cli.log(
        "Warning: No functions with Rack handler, omitting Rack handler from package"
      );
      return BbPromise.resolve();
    }

    if (verbose) {
      this.serverless.cli.log("Packaging Ruby Rack handler...");
    }

    return BbPromise.all([
      fse.copyAsync(
        path.resolve(__dirname, "lib", "rack_adapter.rb"),
        path.join(this.serverless.config.servicePath, "rack_adapter.rb")
      ),
      fse.copyAsync(
        path.resolve(__dirname, "lib", "serverless_rack.rb"),
        path.join(this.serverless.config.servicePath, "serverless_rack.rb")
      ),
      fse.writeFileAsync(
        path.join(this.serverless.config.servicePath, ".serverless-rack"),
        JSON.stringify(this.getRackHandlerConfiguration())
      ),
    ]);
  }

  backupBundle() {
    return new BbPromise((resolve) => {
      if (!this.enableBundler) {
        return resolve();
      }

      const backupPath = path.join(
        this.serverless.config.servicePath,
        this.backupDir
      );

      const bundlePath = path.join(
        this.serverless.config.servicePath,
        "vendor",
        "bundle"
      );

      const backupBundlePath = path.join(backupPath, "bundle");

      const configPath = path.join(
        this.serverless.config.servicePath,
        ".bundle",
        "config"
      );

      const backupConfigPath = path.join(backupPath, "config");

      const lockFilePath = path.join(
        this.serverless.config.servicePath,
        "Gemfile.lock"
      );

      const backupLockFilePath = path.join(backupPath, "Gemfile.lock");

      if (
        fse.existsSync(bundlePath) ||
        fse.existsSync(configPath) ||
        fse.existsSync(lockFilePath)
      ) {
        this.serverless.cli.log("Backing up current bundle...");
      }

      if (fse.existsSync(bundlePath)) {
        if (fse.existsSync(backupBundlePath)) {
          fse.removeSync(bundlePath);
        } else {
          fse.ensureDirSync(backupPath);
          fse.renameSync(bundlePath, backupBundlePath);
        }
      }

      if (fse.existsSync(configPath)) {
        if (fse.existsSync(backupConfigPath)) {
          fse.removeSync(configPath);
        } else {
          fse.ensureDirSync(backupPath);
          fse.renameSync(configPath, backupConfigPath);
        }
      }

      if (fse.existsSync(lockFilePath)) {
        if (!fse.existsSync(backupLockFilePath)) {
          fse.ensureDirSync(backupPath);
          fse.copySync(lockFilePath, backupLockFilePath);
        }
      }

      resolve();
    });
  }

  restoreBundle() {
    return new BbPromise((resolve) => {
      if (!this.enableBundler) {
        return resolve();
      }

      const backupPath = path.join(
        this.serverless.config.servicePath,
        this.backupDir
      );

      const bundlePath = path.join(
        this.serverless.config.servicePath,
        "vendor",
        "bundle"
      );

      const backupBundlePath = path.join(backupPath, "bundle");

      const configPath = path.join(
        this.serverless.config.servicePath,
        ".bundle",
        "config"
      );

      const backupConfigPath = path.join(backupPath, "config");

      const lockFilePath = path.join(
        this.serverless.config.servicePath,
        "Gemfile.lock"
      );

      const backupLockFilePath = path.join(backupPath, "Gemfile.lock");

      if (fse.existsSync(bundlePath)) {
        fse.removeSync(bundlePath);
      }

      if (emptyDir.sync(path.dirname(bundlePath))) {
        fse.removeSync(path.dirname(bundlePath));
      }

      if (fse.existsSync(configPath)) {
        fse.removeSync(configPath);
      }

      if (emptyDir.sync(path.dirname(configPath))) {
        fse.removeSync(path.dirname(configPath));
      }

      if (!fse.existsSync(backupPath)) {
        return resolve();
      }

      this.serverless.cli.log("Restoring backed up bundle...");

      if (fse.existsSync(backupBundlePath)) {
        fse.ensureDirSync(path.dirname(bundlePath));
        fse.renameSync(backupBundlePath, bundlePath);
      }

      if (fse.existsSync(backupConfigPath)) {
        fse.ensureDirSync(path.dirname(configPath));
        fse.renameSync(backupConfigPath, configPath);
      }

      if (fse.existsSync(backupLockFilePath)) {
        fse.removeSync(lockFilePath);
        fse.renameSync(backupLockFilePath, lockFilePath);
      }

      fse.removeSync(backupPath);

      resolve();
    });
  }

  configureDockerCache() {
    return new BbPromise((resolve) => {
      if (!this.enableBundler || !this.dockerizeBundler) {
        return resolve();
      }

      this.serverless.service.package.exclude.push(`${this.cacheBundleDir}/**`);

      let lockFileHash = crypto
        .createHash("md5")
        .update(fse.readFileSync("Gemfile.lock") + this.dockerImage, "utf8")
        .digest("hex");

      this.dockerBundleCache = {
        cachePath: path.join(
          this.serverless.config.servicePath,
          this.cacheBundleDir
        ),
        hashPath: path.join(
          this.serverless.config.servicePath,
          this.cacheBundleDir,
          lockFileHash
        ),
        bundlePath: path.join(
          this.serverless.config.servicePath,
          "vendor",
          "bundle"
        ),
      };

      resolve();
    });
  }

  saveDockerCache() {
    return new BbPromise((resolve) => {
      if (!this.enableBundler || !this.dockerizeBundler) {
        return resolve();
      }

      this.serverless.cli.log("Caching gem dependencies...");
      fse.ensureDirSync(this.dockerBundleCache.cachePath);
      fse.renameSync(
        this.dockerBundleCache.bundlePath,
        this.dockerBundleCache.hashPath
      );

      resolve();
    });
  }

  runBundler() {
    return new BbPromise((resolve, reject) => {
      if (!this.enableBundler) {
        return resolve();
      }

      if (this.dockerizeBundler) {
        if (fse.existsSync(this.dockerBundleCache.hashPath)) {
          this.serverless.cli.log("Using cached gem dependencies...");
          fse.renameSync(
            this.dockerBundleCache.hashPath,
            this.dockerBundleCache.bundlePath
          );
        } else {
          this.serverless.cli.log("Packaging gem dependencies using docker...");

          // Remove old caches
          if (fse.pathExistsSync(this.dockerBundleCache.cachePath)) {
            fse.rmdirSync(this.dockerBundleCache.cachePath, {
              recursive: true,
            });
          }

          let args = [
            "run",
            "--rm",
            "-v",
            `${this.serverless.config.servicePath}:/var/task`,
          ];

          if (this.bundlerArgs) {
            args.push("-e", `BUNDLER_ARGS=${this.bundlerArgs}`);
          }

          args.push(this.dockerImage);
          args.push(...this.dockerArgs);

          const res = child_process.spawnSync("docker", args, {
            stdio: "inherit"
          });
          if (res.error) {
            if (res.error.code == "ENOENT") {
              return reject(
                "Unable to run Docker. Please make sure that the docker executable exists in $PATH."
              );
            } else {
              return reject(res.error);
            }
          }

          if (res.status != 0) {
            return reject(res.stdout.toString() || res.stderr.toString());
          }
        }
      } else {
        this.serverless.cli.log("Packaging gem dependencies...");

        let args = ["install", "--path", "vendor/bundle"];

        if (this.bundlerArgs) {
          args.push(...stringArgv.parseArgsStringToArgv(this.bundlerArgs));
        }

        const res = child_process.spawnSync(this.bundlerBin, args);
        if (res.error) {
          if (res.error.code == "ENOENT") {
            return reject(
              `Unable to run Bundler executable: ${this.bundlerBin}. Use the "bundlerBin" option to set your Bundler executable explicitly.`
            );
          } else {
            return reject(res.error);
          }
        }

        if (res.status != 0) {
          return reject(res.stdout);
        }
      }

      resolve();
    });
  }

  unpinGemfile() {
    return new BbPromise((resolve) => {
      if (!this.enableBundler) {
        return resolve();
      }

      const lockFilePath = path.join(
        this.serverless.config.servicePath,
        "Gemfile.lock"
      );

      if (fse.existsSync(lockFilePath)) {
        const contents = fse.readFileSync(lockFilePath, "utf8");
        fse.writeFileSync(
          lockFilePath,
          contents.replace(/^BUNDLED WITH[\S\s]+[\d.]+$/m, "")
        );
      }

      resolve();
    });
  }

  checkRackPresent() {
    return new BbPromise((resolve) => {
      if (!this.findHandler()) {
        return resolve();
      }

      const bundlePath = path.join(
        this.serverless.config.servicePath,
        "vendor",
        "bundle",
        "ruby"
      );

      if (!fse.existsSync(bundlePath)) {
        return resolve();
      }

      const rubyVersion = _.find(fse.readdirSync(bundlePath), (p) =>
        fse.statSync(path.join(bundlePath, p)).isDirectory()
      );

      const gemPath = path.join(bundlePath, rubyVersion, "gems");

      const hasRack = _.find(fse.readdirSync(gemPath), (p) =>
        p.startsWith("rack-")
      );

      if (!hasRack) {
        this.serverless.cli.log(
          "WARNING: Could not find rack in bundle, please add it to your Gemfile"
        );
      }

      resolve();
    });
  }

  cleanup() {
    const artifacts = [
      "rack_adapter.rb",
      "serverless_rack.rb",
      ".serverless-rack",
    ];

    return BbPromise.all(
      _.map(artifacts, (artifact) =>
        fse.removeAsync(path.join(this.serverless.config.servicePath, artifact))
      )
    );
  }

  loadEnvVars() {
    return new BbPromise((resolve) => {
      const providerEnvVars = _.omitBy(
        this.serverless.service.provider.environment || {},
        _.isObject
      );
      _.merge(process.env, providerEnvVars);

      _.each(this.serverless.service.functions, (func) => {
        if (func.handler == "rack_adapter.handler") {
          const functionEnvVars = _.omitBy(func.environment || {}, _.isObject);
          _.merge(process.env, functionEnvVars);
        }
      });

      process.env["IS_OFFLINE"] = "true";

      resolve();
    });
  }

  serve() {
    return new BbPromise((resolve, reject) => {
      const port = this.options.port || "5000";
      const host = this.options.host || "localhost";

      var bundlerArgs = ["exec", "rackup", "--port", port, "--host", host];

      var rackConfig = this.getRackHandlerConfiguration();
      if (rackConfig.config_path) {
        bundlerArgs.push(rackConfig.config_path);
      }

      var status = child_process.spawnSync(this.bundlerBin, bundlerArgs, {
        stdio: "inherit",
        cwd: this.serverless.config.servicePath,
      });
      if (status.error) {
        if (status.error.code == "ENOENT") {
          reject(
            `Unable to run Bundler executable: ${this.bundlerBin}. Use the "bundlerBin" option to set your Bundler executable explicitly.`
          );
        } else {
          reject(status.error);
        }
      } else {
        resolve();
      }
    });
  }

  findHandler() {
    return _.findKey(
      this.serverless.service.functions,
      (fun) => fun.handler == "rack_adapter.handler"
    );
  }

  invokeHandler(command, data) {
    const handlerFunction = this.findHandler();

    if (!handlerFunction) {
      return BbPromise.reject(
        "No functions were found with handler: rack_adapter.handler"
      );
    }

    // We're going to call the provider-agnostic invoke plugin, which has
    // no proper plugin-facing API. Instead, the current CLI options are modified
    // to match those of an invoke call.
    this.serverless.pluginManager.cliOptions.function = handlerFunction;
    this.serverless.pluginManager.cliOptions.data = JSON.stringify({
      "_serverless-rack": {
        command: command,
        data: data,
      },
    });
    this.serverless.pluginManager.cliOptions.type = null;
    this.serverless.pluginManager.cliOptions.f = this.serverless.pluginManager.cliOptions.function;
    this.serverless.pluginManager.cliOptions.d = this.serverless.pluginManager.cliOptions.data;
    this.serverless.pluginManager.cliOptions.t = this.serverless.pluginManager.cliOptions.type;

    // The invoke plugin prints the response to the console as JSON. When invoking commands
    // remotely, we get a string back and we want it to appear in the console as it would have
    // if it was invoked locally.
    //
    // Thus, console.log is temporarily hijacked to capture the output and parse it as JSON. This
    // hack is needed to avoid having to call the provider-specific invoke plugins.
    return new BbPromise((resolve) => {
      let output = "";

      /* eslint-disable no-console */
      const native_log = console.log;
      console.log = (msg) => (output += msg + "\n");

      resolve(
        this.serverless.pluginManager
          .run(["invoke"])
          .then(() => {
            output = _.trimEnd(output, "\n");
            try {
              const output_data = JSON.parse(output);
              if (_.isString(output_data)) {
                native_log(_.trimEnd(output_data, "\n"));
              } else {
                native_log(output);
              }
            } catch (e) {
              native_log(output);
            }
          })
          .finally(() => {
            console.log = native_log;
          })
      );
      /* eslint-enable no-console */
    });
  }

  command() {
    let data = null;

    if (this.options.command) {
      data = this.options.command;
    } else if (this.options.file) {
      data = fse.readFileSync(this.options.file, "utf8");
    } else {
      return BbPromise.reject(
        "Please provide either a command (-c) or a file (-f)"
      );
    }

    return this.invokeHandler("command", data);
  }

  exec() {
    let data = null;

    if (this.options.command) {
      data = this.options.command;
    } else if (this.options.file) {
      data = fse.readFileSync(this.options.file, "utf8");
    } else {
      return BbPromise.reject(
        "Please provide either a command (-c) or a file (-f)"
      );
    }

    return this.invokeHandler("exec", data);
  }

  rake() {
    return this.invokeHandler("rake", this.options.task);
  }

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      rack: {
        usage: "Deploy Ruby Rack applications",
        lifecycleEvents: ["rack"],

        commands: {
          serve: {
            usage: "Serve the Rack application locally",
            lifecycleEvents: ["serve"],
            options: {
              port: {
                usage: "Local server port, defaults to 5000",
                shortcut: "p",
              },
              host: {
                usage: "Server host, defaults to 'localhost'",
              },
            },
          },
          install: {
            usage: "Install Rack handler and bundle for local use",
            lifecycleEvents: ["install"],
          },
          clean: {
            usage: "Remove bundle",
            lifecycleEvents: ["clean"],
          },
          command: {
            usage: "Execute shell commands or scripts remotely",
            lifecycleEvents: ["command"],
            options: {
              command: {
                usage: "Command to execute",
                shortcut: "c",
              },
              file: {
                usage: "Path to a shell script to execute",
                shortcut: "f",
              },
            },
          },
          exec: {
            usage: "Evaluate Ruby code remotely",
            lifecycleEvents: ["exec"],
            options: {
              command: {
                usage: "Ruby code to execute",
                shortcut: "c",
              },
              file: {
                usage: "Path to a Ruby script to execute",
                shortcut: "f",
              },
            },
          },
          rake: {
            usage: "Run Rake tasks remotely",
            lifecycleEvents: ["rake"],
            options: {
              task: {
                usage: "Rake task",
                shortcut: "t",
                required: true,
              },
            },
          },
        },
      },
    };

    const deployBeforeHook = () =>
      BbPromise.bind(this)
        .then(this.validate)
        .then(this.configurePackaging)
        .then(this.locateBundler)
        .then(this.packRackHandler)
        .then(this.backupBundle)
        .then(this.unpinGemfile)
        .then(this.configureDockerCache)
        .then(this.runBundler)
        .then(this.checkRackPresent);

    const deployBeforeHookWithoutHandler = () =>
      BbPromise.bind(this)
        .then(this.validate)
        .then(this.configurePackaging)
        .then(this.locateBundler)
        .then(this.backupBundle)
        .then(this.unpinGemfile)
        .then(this.configureDockerCache)
        .then(this.runBundler);

    const deployAfterHook = () =>
      BbPromise.bind(this)
        .then(this.validate)
        .then(this.saveDockerCache)
        .then(this.restoreBundle)
        .then(this.cleanup);

    this.hooks = {
      "rack:rack": () => {
        this.serverless.cli.generateCommandsHelp(["rack"]);
        return BbPromise.resolve();
      },

      "rack:serve:serve": () =>
        BbPromise.bind(this)
          .then(this.validate)
          .then(this.locateBundler)
          .then(this.loadEnvVars)
          .then(this.serve),

      "rack:install:install": deployBeforeHook,

      "rack:command:command": () => BbPromise.bind(this).then(this.command),
      "rack:exec:exec": () => BbPromise.bind(this).then(this.exec),
      "rack:rake:rake": () => BbPromise.bind(this).then(this.rake),

      "rack:clean:clean": deployAfterHook,

      "before:package:createDeploymentArtifacts": deployBeforeHook,
      "after:package:createDeploymentArtifacts": deployAfterHook,

      "before:deploy:function:packageFunction": () => {
        if (this.options.functionObj.handler == "rack_adapter.handler") {
          return deployBeforeHook();
        } else {
          return deployBeforeHookWithoutHandler();
        }
      },
      "after:deploy:function:packageFunction": deployAfterHook,

      "before:offline:start:init": deployBeforeHook,
      "after:offline:start:end": deployAfterHook,

      "before:invoke:local:invoke": () => {
        const functionObj = this.serverless.service.getFunction(
          this.options.function
        );

        if (functionObj.handler == "rack_adapter.handler") {
          return BbPromise.bind(this)
            .then(this.validate)
            .then(() => {
              return this.packRackHandler(false);
            });
        } else {
          return BbPromise.resolve();
        }
      },
      "after:invoke:local:invoke": () =>
        BbPromise.bind(this).then(this.cleanup),
    };
  }
}

module.exports = ServerlessRack;
