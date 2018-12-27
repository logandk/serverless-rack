"use strict";

const BbPromise = require("bluebird");
const _ = require("lodash");
const path = require("path");
const fse = BbPromise.promisifyAll(require("fs-extra"));
const child_process = require("child_process");

class ServerlessRack {
  configurePackaging() {
    return new BbPromise(resolve => {
      this.serverless.service.package = this.serverless.service.package || {};
      this.serverless.service.package.include =
        this.serverless.service.package.include || [];
      this.serverless.service.package.exclude =
        this.serverless.service.package.exclude || [];

      this.serverless.service.package.include = _.union(
        this.serverless.service.package.include,
        ["rack_adapter.rb", "serverless_rack.rb"]
      );

      resolve();
    });
  }

  packRackHandler(verbose = true) {
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
      )
    ]);
  }

  cleanup() {
    const artifacts = ["rack_adapter.rb", "serverless_rack.rb"];

    return BbPromise.all(
      _.map(artifacts, artifact =>
        fse.removeAsync(path.join(this.serverless.config.servicePath, artifact))
      )
    );
  }

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    const deployBeforeHook = () =>
      BbPromise.bind(this)
        .then(this.configurePackaging)
        .then(this.packRackHandler);

    const deployAfterHook = () => BbPromise.bind(this).then(this.cleanup);

    this.hooks = {
      "rack:rack": () => {
        this.serverless.cli.generateCommandsHelp(["rack"]);
        return BbPromise.resolve();
      },

      "before:package:createDeploymentArtifacts": deployBeforeHook,
      "after:package:createDeploymentArtifacts": deployAfterHook,

      "before:deploy:function:packageFunction": () => {
        if (this.options.functionObj.handler == "rack_adapter.handler") {
          return deployBeforeHook();
        } else {
          return BbPromise.resolve();
        }
      },
      "after:deploy:function:packageFunction": deployAfterHook
    };
  }
}

module.exports = ServerlessRack;
