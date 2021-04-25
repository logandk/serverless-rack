# 1.0.7

- Improved error handling for Docker processes (#20 and #21)

  _Shalvah_

# 1.0.6

- Upgrade dependencies
- Add a dockerImage config option to override the docker image to be used for compiling gems (defaults to the lambci ruby images) (#17)

  _Benjamin Curtis_

- Cache the bundle that is created by docker to avoid recompiling gems (#17)

  _Benjamin Curtis_

- Handle empty `API_GATEWAY_BASE_PATH` (#14)

  _Joel Van Horn_

# 1.0.5

- Upgrade dependencies

# 1.0.4

- Support `configPath` option when invoking `sls rack serve` (#5)

# 1.0.3

- Upgrade dependencies

# 1.0.2

- Remove `BUNDLED WITH` from Gemfile to allow using different version of
  Bundler from the one provided by AWS Lambda (#3)
- Add `configPath` option for setting path to `config.ru` (#4)

  _Yousaf Nabi_

# 1.0.1

- Support additional bundler arguments to be passed when using docker (#2)
- Support multi-value query string parameters
- Support multi-value headers in request and response

# 1.0.0

- Feature parity with `serverless-wsgi`.

# 0.0.1

- Initial release.
