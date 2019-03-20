"use strict";

/* global describe it */
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const Plugin = require("./index");
const child_process = require("child_process");
const path = require("path");
const fse = require("fs-extra");
const BbPromise = require("bluebird");
const emptyDir = require("empty-dir");

const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

describe("serverless-rack", () => {
  describe("init", () => {
    it("registers commands", () => {
      var plugin = new Plugin();

      expect(plugin.commands.rack.commands.serve.lifecycleEvents).to.include(
        "serve"
      );
    });

    it("registers hooks", () => {
      var plugin = new Plugin();

      expect(plugin.hooks["before:package:createDeploymentArtifacts"]).to.be.a(
        "function"
      );
      expect(plugin.hooks["after:package:createDeploymentArtifacts"]).to.be.a(
        "function"
      );
      expect(plugin.hooks["rack:serve:serve"]).to.be.a("function");
      expect(plugin.hooks["rack:install:install"]).to.be.a("function");
      expect(plugin.hooks["rack:clean:clean"]).to.be.a("function");
      expect(plugin.hooks["before:offline:start:init"]).to.be.a("function");
      expect(plugin.hooks["after:offline:start:end"]).to.be.a("function");
      expect(plugin.hooks["before:invoke:local:invoke"]).to.be.a("function");
      expect(plugin.hooks["after:invoke:local:invoke"]).to.be.a("function");
    });

    it("generates help for default command", () => {
      var plugin = new Plugin(
        {
          cli: {
            generateCommandsHelp: command => {
              expect(command).to.deep.equal(["rack"]);
            }
          }
        },
        {}
      );

      expect(plugin.hooks["rack:rack"]()).to.be.fulfilled;
    });
  });

  describe("rack", () => {
    it("skips packaging for non-rack app", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "ruby2.5" } },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(existsStub.called).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", ["install", "--path", "vendor/bundle"])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("packages rack handler", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "lib", "rack_adapter.rb"),
            "/tmp/rack_adapter.rb"
          )
        ).to.be.true;
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "lib", "serverless_rack.rb"),
            "/tmp/serverless_rack.rb"
          )
        ).to.be.true;
        expect(writeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({});
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", ["install", "--path", "vendor/bundle"])
        ).to.be.true;
        sandbox.restore();
        expect(plugin.serverless.service.package.include).to.have.members([
          "rack_adapter.rb",
          "serverless_rack.rb",
          ".serverless-rack"
        ]);
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".serverless-rack-temp/**"
        ]);
      });
    });

    it("warns when rack is not present", () => {
      let log_messages = [];

      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } },
            package: { include: ["sample.txt"] }
          },
          classes: { Error: Error },
          cli: { log: message => log_messages.push(message) }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      existsStub.withArgs("/tmp/vendor/bundle/ruby").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var readdirStub = sandbox.stub(fse, "readdirSync");
      readdirStub.withArgs("/tmp/vendor/bundle/ruby").returns(["2.5.0"]);
      readdirStub
        .withArgs("/tmp/vendor/bundle/ruby/2.5.0/gems")
        .returns(["somegem-1.2.3"]);
      var statStub = sandbox
        .stub(fse, "statSync")
        .returns({ isDirectory: () => true });
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", ["install", "--path", "vendor/bundle"])
        ).to.be.true;
        expect(readdirStub.calledWith("/tmp/vendor/bundle/ruby")).to.be.true;
        expect(statStub.calledWith("/tmp/vendor/bundle/ruby/2.5.0")).to.be.true;
        expect(readdirStub.calledWith("/tmp/vendor/bundle/ruby/2.5.0/gems")).to
          .be.true;
        expect(log_messages).to.include(
          "WARNING: Could not find rack in bundle, please add it to your Gemfile"
        );
        sandbox.restore();
      });
    });

    it("packages rack handler with additional text mime types", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } },
            custom: {
              rack: {
                textMimeTypes: ["application/custom+json"]
              }
            }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      sandbox.stub(fse, "existsSync");
      sandbox.stub(fse, "removeSync");
      sandbox.stub(fse, "renameSync");
      sandbox.stub(fse, "ensureDirSync");
      sandbox.stub(emptyDir, "sync");
      sandbox.stub(child_process, "spawnSync").returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(writeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({
          text_mime_types: ["application/custom+json"]
        });
        sandbox.restore();
      });
    });

    it("cleans up after deployment", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(fse, "existsSync");
      var removeStub = sandbox.stub(fse, "removeAsync");
      plugin.hooks["after:package:createDeploymentArtifacts"]().then(() => {
        expect(removeStub.calledWith("/tmp/rack_adapter.rb")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_rack.rb")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("bundle", () => {
    it("bundles gems for rack app", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } },
            package: { include: ["sample.txt"] }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      existsStub.withArgs("/tmp/vendor/bundle/ruby").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var readdirStub = sandbox.stub(fse, "readdirSync");
      readdirStub.withArgs("/tmp/vendor/bundle/ruby").returns(["2.5.0"]);
      readdirStub
        .withArgs("/tmp/vendor/bundle/ruby/2.5.0/gems")
        .returns(["rack-2.0.5"]);
      var statStub = sandbox
        .stub(fse, "statSync")
        .returns({ isDirectory: () => true });
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", ["install", "--path", "vendor/bundle"])
        ).to.be.true;
        expect(readdirStub.calledWith("/tmp/vendor/bundle/ruby")).to.be.true;
        expect(statStub.calledWith("/tmp/vendor/bundle/ruby/2.5.0")).to.be.true;
        expect(readdirStub.calledWith("/tmp/vendor/bundle/ruby/2.5.0/gems")).to
          .be.true;
        expect(plugin.serverless.service.package.include).to.have.members([
          "sample.txt",
          "rack_adapter.rb",
          "serverless_rack.rb",
          ".serverless-rack"
        ]);
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".serverless-rack-temp/**"
        ]);
        sandbox.restore();
      });
    });

    it("backs up existing bundle", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } },
            package: { include: ["sample.txt"] }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      existsStub.withArgs("/tmp/vendor/bundle").returns(true);
      existsStub.withArgs("/tmp/.bundle/config").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(
          renameStub.calledWith(
            "/tmp/vendor/bundle",
            "/tmp/.serverless-rack-temp/bundle"
          )
        ).to.be.true;
        expect(ensureDirStub.calledWith("/tmp/.serverless-rack-temp")).to.be
          .true;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", ["install", "--path", "vendor/bundle"])
        ).to.be.true;
        expect(plugin.serverless.service.package.include).to.have.members([
          "sample.txt",
          "rack_adapter.rb",
          "serverless_rack.rb",
          ".serverless-rack"
        ]);
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".serverless-rack-temp/**"
        ]);
        sandbox.restore();
      });
    });

    it("uses existing bundle backup", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } },
            package: { include: ["sample.txt"] }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      existsStub.withArgs("/tmp/vendor/bundle").returns(true);
      existsStub.withArgs("/tmp/.bundle/config").returns(true);
      existsStub.withArgs("/tmp/.serverless-rack-temp/config").returns(true);
      existsStub.withArgs("/tmp/.serverless-rack-temp/bundle").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.calledWith("/tmp/.bundle/config")).to.be.true;
        expect(removeStub.calledWith("/tmp/vendor/bundle")).to.be.true;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", ["install", "--path", "vendor/bundle"])
        ).to.be.true;
        expect(plugin.serverless.service.package.include).to.have.members([
          "sample.txt",
          "rack_adapter.rb",
          "serverless_rack.rb",
          ".serverless-rack"
        ]);
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".serverless-rack-temp/**"
        ]);
        sandbox.restore();
      });
    });

    it("restores bundle backup", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      existsStub.withArgs("/tmp/vendor/bundle").returns(true);
      existsStub.withArgs("/tmp/.bundle/config").returns(true);
      existsStub.withArgs("/tmp/.serverless-rack-temp").returns(true);
      existsStub.withArgs("/tmp/.serverless-rack-temp/config").returns(true);
      existsStub.withArgs("/tmp/.serverless-rack-temp/bundle").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      emptyDirStub.withArgs("/tmp/vendor").returns(true);
      emptyDirStub.withArgs("/tmp/.bundle").returns(true);
      plugin.hooks["after:package:createDeploymentArtifacts"]().then(() => {
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(existsStub.calledWith("/tmp/vendor/bundle")).to.be.true;
        expect(existsStub.calledWith("/tmp/.bundle/config")).to.be.true;
        expect(existsStub.calledWith("/tmp/.serverless-rack-temp")).to.be.true;
        expect(existsStub.calledWith("/tmp/.serverless-rack-temp/config")).to.be
          .true;
        expect(existsStub.calledWith("/tmp/.serverless-rack-temp/bundle")).to.be
          .true;
        expect(removeStub.calledWith("/tmp/.bundle/config")).to.be.true;
        expect(removeStub.calledWith("/tmp/vendor/bundle")).to.be.true;
        expect(removeStub.calledWith("/tmp/.bundle")).to.be.true;
        expect(removeStub.calledWith("/tmp/vendor")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-rack-temp")).to.be.true;
        expect(ensureDirStub.calledWith("/tmp/vendor")).to.be.true;
        expect(ensureDirStub.calledWith("/tmp/.bundle")).to.be.true;
        expect(
          renameStub.calledWith(
            "/tmp/.serverless-rack-temp/config",
            "/tmp/.bundle/config"
          )
        ).to.be.true;
        expect(
          renameStub.calledWith(
            "/tmp/.serverless-rack-temp/bundle",
            "/tmp/vendor/bundle"
          )
        ).to.be.true;
        expect(emptyDirStub.calledWith("/tmp/vendor")).to.be.true;
        expect(emptyDirStub.calledWith("/tmp/.bundle")).to.be.true;
        sandbox.restore();
      });
    });

    it("cleans up bundle when backup directory is empty", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      existsStub.withArgs("/tmp/vendor/bundle").returns(true);
      existsStub.withArgs("/tmp/.bundle/config").returns(true);
      existsStub.withArgs("/tmp/.serverless-rack-temp").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      emptyDirStub.withArgs("/tmp/vendor").returns(true);
      emptyDirStub.withArgs("/tmp/.bundle").returns(true);
      plugin.hooks["after:package:createDeploymentArtifacts"]().then(() => {
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(existsStub.calledWith("/tmp/vendor/bundle")).to.be.true;
        expect(existsStub.calledWith("/tmp/.bundle/config")).to.be.true;
        expect(existsStub.calledWith("/tmp/.serverless-rack-temp")).to.be.true;
        expect(existsStub.calledWith("/tmp/.serverless-rack-temp/config")).to.be
          .true;
        expect(existsStub.calledWith("/tmp/.serverless-rack-temp/bundle")).to.be
          .true;
        expect(removeStub.calledWith("/tmp/.bundle/config")).to.be.true;
        expect(removeStub.calledWith("/tmp/vendor/bundle")).to.be.true;
        expect(removeStub.calledWith("/tmp/.bundle")).to.be.true;
        expect(removeStub.calledWith("/tmp/vendor")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-rack-temp")).to.be.true;
        expect(ensureDirStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(emptyDirStub.calledWith("/tmp/vendor")).to.be.true;
        expect(emptyDirStub.calledWith("/tmp/.bundle")).to.be.true;
        sandbox.restore();
      });
    });

    it("allows setting the bundler binary", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            custom: { rack: { bundlerBin: "my-bundler" } },
            package: { include: ["sample.txt"] }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("my-bundler", [
            "install",
            "--path",
            "vendor/bundle"
          ])
        ).to.be.true;
        expect(plugin.serverless.service.package.include).to.have.members([
          "sample.txt",
          "rack_adapter.rb",
          "serverless_rack.rb",
          ".serverless-rack"
        ]);
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".serverless-rack-temp/**"
        ]);
        sandbox.restore();
      });
    });

    it("bundles with additional bundler args", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            custom: { rack: { bundlerArgs: "--verbose --no-color" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", [
            "install",
            "--path",
            "vendor/bundle",
            "--verbose",
            "--no-color"
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("bundles with docker", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            custom: { rack: { dockerizeBundler: true } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("docker", [
            "run",
            "--rm",
            "-v",
            "/tmp:/var/task",
            "logandk/serverless-rack-bundler:ruby2.5"
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("bundles with docker and additional bundler args", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            custom: {
              rack: {
                dockerizeBundler: true,
                bundlerArgs: "--verbose --no-color"
              }
            }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("docker", [
            "run",
            "--rm",
            "-v",
            "/tmp:/var/task",
            "-e",
            "BUNDLER_ARGS=--verbose --no-color",
            "logandk/serverless-rack-bundler:ruby2.5"
          ])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("skips bundling when no Gemfile exists", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "ruby2.5" } },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(false);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        expect(plugin.serverless.service.package.exclude).to.have.members([
          ".serverless-rack-temp/**"
        ]);
        sandbox.restore();
      });
    });

    it("rejects with non successful bundler exit code", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "ruby2.5" } },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      sandbox.stub(child_process, "spawnSync").returns({ status: 1 });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("rejects with bundler error output", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "ruby2.5" } },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0, error: "fail" });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("handles missing bundler binary error", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: { provider: { runtime: "ruby2.5" } },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: { code: "ENOENT" } });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("rejects with non successful docker exit code", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            custom: { rack: { dockerizeBundler: true } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      sandbox.stub(child_process, "spawnSync").returns({ status: 1 });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("rejects with docker error output", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            custom: { rack: { dockerizeBundler: true } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0, error: "fail" });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("handles missing docker binary error", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            custom: { rack: { dockerizeBundler: true } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: { code: "ENOENT" } });

      expect(
        plugin.hooks["before:package:createDeploymentArtifacts"]()
      ).to.eventually.be.rejected.and.notify(() => {
        sandbox.restore();
      });
    });

    it("skips bundling if disabled", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } },
            custom: { rack: { enableBundler: false } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:package:createDeploymentArtifacts"]().then(() => {
        expect(copyStub.called).to.be.true;
        expect(writeStub.called).to.be.true;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        expect(plugin.serverless.service.package.include).not.to.have.members([
          ".serverless-rack-temp/**"
        ]);
        sandbox.restore();
      });
    });
  });

  describe("function deployment", () => {
    it("skips packaging for non-rack function", () => {
      var functions = {
        app: {}
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: functions
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(false);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:deploy:function:packageFunction"]().then(() => {
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(procStub.called).to.be.false;
        sandbox.restore();
      });
    });

    it("packages rack handler", () => {
      var functions = {
        app: { handler: "rack_adapter.handler" }
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: functions
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["before:deploy:function:packageFunction"]().then(() => {
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "lib", "rack_adapter.rb"),
            "/tmp/rack_adapter.rb"
          )
        ).to.be.true;
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "lib", "serverless_rack.rb"),
            "/tmp/serverless_rack.rb"
          )
        ).to.be.true;
        expect(writeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({});
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", ["install", "--path", "vendor/bundle"])
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("cleans up after deployment", () => {
      var functions = {
        app: { handler: "rack_adapter.handler" }
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: functions
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { functionObj: functions.app }
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      plugin.hooks["after:deploy:function:packageFunction"]().then(() => {
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.calledWith("/tmp/rack_adapter.rb")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_rack.rb")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("serve", () => {
    it("executes rackup", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      plugin.hooks["rack:serve:serve"]().then(() => {
        expect(
          procStub.calledWith(
            "bundle",
            ["exec", "rackup", "--port", "5000", "--host", "localhost"],
            { stdio: "inherit", cwd: "/tmp" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("handles process errors", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: "Something failed" });
      expect(
        plugin.hooks["rack:serve:serve"]()
      ).to.eventually.be.rejected.and.notify(() => {
        expect(
          procStub.calledWith(
            "bundle",
            ["exec", "rackup", "--port", "5000", "--host", "localhost"],
            { stdio: "inherit", cwd: "/tmp" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("handles missing bundler binary error", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ error: { code: "ENOENT" } });
      expect(
        plugin.hooks["rack:serve:serve"]()
      ).to.eventually.be.rejected.and.notify(() => {
        expect(
          procStub.calledWith(
            "bundle",
            ["exec", "rackup", "--port", "5000", "--host", "localhost"],
            { stdio: "inherit", cwd: "/tmp" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("allows changing port", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { port: "8000" }
      );

      var sandbox = sinon.createSandbox();
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      plugin.hooks["rack:serve:serve"]().then(() => {
        expect(
          procStub.calledWith(
            "bundle",
            ["exec", "rackup", "--port", "8000", "--host", "localhost"],
            { stdio: "inherit", cwd: "/tmp" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("allows changing host", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { host: "0.0.0.0" }
      );

      var sandbox = sinon.createSandbox();
      var procStub = sandbox.stub(child_process, "spawnSync").returns({});
      plugin.hooks["rack:serve:serve"]().then(() => {
        expect(
          procStub.calledWith(
            "bundle",
            ["exec", "rackup", "--port", "5000", "--host", "0.0.0.0"],
            { stdio: "inherit", cwd: "/tmp" }
          )
        ).to.be.true;
        sandbox.restore();
      });
    });

    it("loads environment variables", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: {
              runtime: "ruby2.5",
              environment: {
                SOME_ENV_VAR: 42,
                ANOTHER_ONE: { Ref: "AWS::StackId" }
              }
            },
            functions: {
              func1: {
                handler: "rack_adapter.handler",
                environment: { SECOND_VAR: 33 }
              },
              func2: { handler: "x.x", environment: { THIRD_VAR: 66 } },
              func3: { handler: "rack_adapter.handler" }
            }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      sandbox.stub(child_process, "spawnSync").returns({});
      sandbox.stub(process, "env").value({});
      plugin.hooks["rack:serve:serve"]().then(() => {
        expect(process.env.SOME_ENV_VAR).to.equal(42);
        expect(process.env.SECOND_VAR).to.equal(33);
        expect(process.env.THIRD_VAR).to.be.undefined;
        expect(process.env.ANOTHER_ONE).to.be.undefined;
        sandbox.restore();
      });
    });
  });

  describe("install", () => {
    it("installs handler and bundle", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      var removeStub = sandbox.stub(fse, "removeSync");
      var renameStub = sandbox.stub(fse, "renameSync");
      var ensureDirStub = sandbox.stub(fse, "ensureDirSync");
      var emptyDirStub = sandbox.stub(emptyDir, "sync");
      var procStub = sandbox
        .stub(child_process, "spawnSync")
        .returns({ status: 0 });
      plugin.hooks["rack:install:install"]().then(() => {
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "lib", "rack_adapter.rb"),
            "/tmp/rack_adapter.rb"
          )
        ).to.be.true;
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "lib", "serverless_rack.rb"),
            "/tmp/serverless_rack.rb"
          )
        ).to.be.true;
        expect(writeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({});
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.called).to.be.false;
        expect(renameStub.called).to.be.false;
        expect(ensureDirStub.called).to.be.false;
        expect(emptyDirStub.called).to.be.false;
        expect(
          procStub.calledWith("bundle", ["install", "--path", "vendor/bundle"])
        ).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("clean", () => {
    it("cleans up everything", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      var existsStub = sandbox.stub(fse, "existsSync");
      existsStub.withArgs("/tmp/Gemfile").returns(true);
      sandbox.stub(fse, "removeSync");
      sandbox.stub(fse, "renameSync");
      sandbox.stub(fse, "ensureDirSync");
      sandbox.stub(emptyDir, "sync");
      plugin.hooks["rack:clean:clean"]().then(() => {
        expect(existsStub.calledWith("/tmp/Gemfile")).to.be.true;
        expect(removeStub.calledWith("/tmp/rack_adapter.rb")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_rack.rb")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("exec", () => {
    it("fails when invoked without command or file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      expect(plugin.hooks["rack:exec:exec"]()).to.be.rejectedWith(
        "Please provide either a command (-c) or a file (-f)"
      );
    });

    it("calls handler to execute code remotely from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('"5"'); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { command: "puts 1+4" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      plugin.hooks["rack:exec:exec"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-rack":{"command":"exec","data":"puts 1+4"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-rack":{"command":"exec","data":"puts 1+4"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.t).to.be.null;
        expect(plugin.serverless.pluginManager.cliOptions.type).to.be.null;
        expect(consoleSpy.calledWith("5")).to.be.true;
        sandbox.restore();
      });
    });

    it("calls handler to execute code remotely from file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('{"response": "5"}'); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { file: "script.py" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      sandbox.stub(fse, "readFileSync").returns("puts 1+4");
      plugin.hooks["rack:exec:exec"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-rack":{"command":"exec","data":"puts 1+4"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-rack":{"command":"exec","data":"puts 1+4"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.t).to.be.null;
        expect(plugin.serverless.pluginManager.cliOptions.type).to.be.null;
        expect(consoleSpy.calledWith('{"response": "5"}')).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("command", () => {
    it("fails when no rack handler is set", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "other.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { command: "pwd" }
      );

      expect(plugin.hooks["rack:command:command"]()).to.be.rejectedWith(
        "No functions were found with handler: rack_adapter.handler"
      );
    });

    it("fails when invoked without command or file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        {}
      );

      expect(plugin.hooks["rack:command:command"]()).to.be.rejectedWith(
        "Please provide either a command (-c) or a file (-f)"
      );
    });

    it("calls handler to execute commands remotely from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log("non-json output"); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { command: "pwd" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      plugin.hooks["rack:command:command"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-rack":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-rack":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.t).to.be.null;
        expect(plugin.serverless.pluginManager.cliOptions.type).to.be.null;
        expect(consoleSpy.calledWith("non-json output")).to.be.true;
        sandbox.restore();
      });
    });

    it("calls handler to execute commands remotely from file", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('"/var/task"'); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { file: "script.sh" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      sandbox.stub(fse, "readFileSync").returns("pwd");
      plugin.hooks["rack:command:command"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-rack":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-rack":{"command":"command","data":"pwd"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.t).to.be.null;
        expect(plugin.serverless.pluginManager.cliOptions.type).to.be.null;
        expect(consoleSpy.calledWith("/var/task")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("rake", () => {
    it("calls handler to execute rake tasks remotely from argument", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: { app: { handler: "rack_adapter.handler" } }
          },
          classes: { Error: Error },
          cli: { log: () => {} },
          pluginManager: {
            cliOptions: {},
            run: command =>
              new BbPromise(resolve => {
                expect(command).to.deep.equal(["invoke"]);
                console.log('"rake task output"'); // eslint-disable-line no-console
                resolve();
              })
          }
        },
        { task: "db:migrate" }
      );

      var sandbox = sinon.createSandbox();
      let consoleSpy = sandbox.spy(console, "log");
      plugin.hooks["rack:rake:rake"]().then(() => {
        expect(plugin.serverless.pluginManager.cliOptions.f).to.equal("app");
        expect(plugin.serverless.pluginManager.cliOptions.function).to.equal(
          "app"
        );
        expect(plugin.serverless.pluginManager.cliOptions.d).to.equal(
          '{"_serverless-rack":{"command":"rake","data":"db:migrate"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.data).to.equal(
          '{"_serverless-rack":{"command":"rake","data":"db:migrate"}}'
        );
        expect(plugin.serverless.pluginManager.cliOptions.t).to.be.null;
        expect(plugin.serverless.pluginManager.cliOptions.type).to.be.null;
        expect(consoleSpy.calledWith("rake task output")).to.be.true;
        sandbox.restore();
      });
    });
  });

  describe("invoke local", () => {
    it("installs handler before invocation", () => {
      var functions = {
        app: { handler: "rack_adapter.handler" },
        other: { handler: "other.handler" }
      };
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: functions,
            getFunction: name => functions[name]
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { function: "other" }
      );

      var sandbox = sinon.createSandbox();
      var copyStub = sandbox.stub(fse, "copyAsync");
      var writeStub = sandbox.stub(fse, "writeFileAsync");

      // Test invocation for non-rack function, should do nothing
      plugin.hooks["before:invoke:local:invoke"]().then(() => {
        expect(copyStub.called).to.be.false;
        expect(copyStub.called).to.be.false;
        expect(writeStub.called).to.be.false;
      });

      plugin.options.function = "app";

      plugin.hooks["before:invoke:local:invoke"]().then(() => {
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "lib", "rack_adapter.rb"),
            "/tmp/rack_adapter.rb"
          )
        ).to.be.true;
        expect(
          copyStub.calledWith(
            path.resolve(__dirname, "lib", "serverless_rack.rb"),
            "/tmp/serverless_rack.rb"
          )
        ).to.be.true;
        expect(writeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        expect(JSON.parse(writeStub.lastCall.args[1])).to.deep.equal({});
        sandbox.restore();
      });
    });

    it("cleans up after invocation", () => {
      var plugin = new Plugin(
        {
          config: { servicePath: "/tmp" },
          service: {
            provider: { runtime: "ruby2.5" },
            functions: {
              app: { handler: "rack_adapter.handler" }
            }
          },
          classes: { Error: Error },
          cli: { log: () => {} }
        },
        { function: "app" }
      );

      var sandbox = sinon.createSandbox();
      var removeStub = sandbox.stub(fse, "removeAsync");
      plugin.hooks["after:invoke:local:invoke"]().then(() => {
        expect(removeStub.calledWith("/tmp/rack_adapter.rb")).to.be.true;
        expect(removeStub.calledWith("/tmp/serverless_rack.rb")).to.be.true;
        expect(removeStub.calledWith("/tmp/.serverless-rack")).to.be.true;
        sandbox.restore();
      });
    });
  });
});
