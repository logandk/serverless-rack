<p align="center">
  <img src="https://logandk.github.io/serverless-rack/assets/header.svg">
</p>

[![npm package](https://nodei.co/npm/serverless-rack.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/serverless-rack/)

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/logandk/serverless-rack.png?branch=master)](https://travis-ci.org/logandk/serverless-rack)
[![Coverage Status](https://codecov.io/gh/logandk/serverless-rack/branch/master/graph/badge.svg)](https://codecov.io/gh/logandk/serverless-rack)
[![Dependency Status](https://david-dm.org/logandk/serverless-rack.png)](https://david-dm.org/logandk/serverless-rack)
[![Dev Dependency Status](https://david-dm.org/logandk/serverless-rack/dev-status.png)](https://david-dm.org/logandk/serverless-rack?type=dev)

A Serverless v1.x plugin to build your deploy Ruby Rack applications using Serverless. Compatible
Rack application frameworks include Sinatra, Cuba and Padrino.

### Features

- Transparently converts API Gateway and ALB requests to and from standard Rack requests
- Supports anything you'd expect from Rack such as redirects, cookies, file uploads etc.
- Bundler integration, including dockerized bundling of binary dependencies
- Convenient `rack serve` command for serving your application locally during development
- CLI commands for remote execution of Ruby code (`rack exec`), rake tasks ('rack rake') and shell commands (`rack command`)

## Install

```
sls plugin install -n serverless-rack
```

This will automatically add the plugin to `package.json` and the plugins section of `serverless.yml`.

## Sinatra configuration example

```
project
├── api.rb
├── config.ru
├── Gemfile
└── serverless.yml
```

### api.rb

A regular Sinatra application.

```ruby
require 'sinatra'

get '/cats' do
  'Cats'
end

get '/dogs/:id' do
  'Dog'
end
```

### config.ru

```
require './api'
run Sinatra::Application
```

### serverless.yml

All functions that will use Rack need to have `rack_adapter.handler` set as the Lambda handler and
use the default `lambda-proxy` integration for API Gateway. This configuration example treats
API Gateway as a transparent proxy, passing all requests directly to your Sinatra application,
and letting the application handle errors, 404s etc.

```yaml
service: example

provider:
  name: aws
  runtime: ruby2.5

plugins:
  - serverless-rack

functions:
  api:
    handler: rack_adapter.handler
    events:
      - http: ANY /
      - http: ANY {proxy+}
```

### Gemfile

Add Sinatra to the application bundle.

```
source 'https://rubygems.org'

gem 'sinatra'
```

## Deployment

Simply run the serverless deploy command as usual:

```
$ bundle install --path vendor/bundle
$ sls deploy
Serverless: Packaging Ruby Rack handler...
Serverless: Packaging gem dependencies using docker...
Serverless: Packaging service...
Serverless: Excluding development dependencies...
Serverless: Uploading CloudFormation file to S3...
Serverless: Uploading artifacts...
Serverless: Uploading service .zip file to S3 (1.64 MB)...
Serverless: Validating template...
Serverless: Updating Stack...
Serverless: Checking Stack update progress...
..............
Serverless: Stack update finished...
```

## Usage

### Automatic bundling of gems

You'll need to include any gems that your application uses in the bundle
that's deployed to AWS Lambda. This plugin helps you out by doing this automatically,
as long as you specify your required gems in a [Gemfile](https://bundler.io/gemfile.html):

```
source 'https://rubygems.org'

gem 'rake'
gem 'sinatra'
```

For more information, see https://bundler.io/docs.html.

### Dockerized bundling

If your application depends on any gems that include compiled binaries, these
must be compiled for the lambda execution environment. Enabling the `dockerizeBundler` configuration
option will fetch and build the gems using a docker image that emulates the lambda environment:

```yaml
custom:
  rack:
    dockerizeBundler: true
```

The default docker image that will be used will match the runtime you are using.
That is, if you are using the `ruby2.7` runtime, then the docker image will be
`logandk/serverless-rack-bundler:ruby2.7`. You can override the docker image with the
`dockerImage` configuration option:

```yaml
custom:
  rack:
    dockerImage: lambci/lambda:build-ruby2.5
```

### Bundler configuration

You can use the automatic bundling functionality of _serverless-rack_ without the Rack request
handler itself by including the plugin in your `serverless.yml` configuration, without specifying
`rack_adapter.handler` as the handler for any of your lambda functions.
This will omit the Rack handler from the package, but include any gems specified in the `Gemfile`.

If you don't want to use automatic gem bundling you can set `custom.rack.enableBundler` to `false`:

```yaml
custom:
  rack:
    enableBundler: false
```

In order to pass additional arguments to `bundler` when installing requirements, the `bundlerArgs`
configuration option is available:

```yaml
custom:
  rack:
    bundlerArgs: --no-cache
```

If your `bundler` executable is not in `$PATH`, set the path explicitly using the `bundlerBin`
configuration option:

```yaml
custom:
  rack:
    bundlerBin: /path/to/bundler
```

### Rack configuration file

If your Rack configuration file (`config.ru`) is not in `./`, set the path explicitly using the `configPath`
configuration option:

```yaml
custom:
  rack:
    configPath: path/to/config.ru
```

### Local server

For convenience, a `sls rack serve` command is provided to run your Rack application
locally. This command requires the `rack` gem to be installed, and acts as a simple
wrapper for `rackup`.

By default, the server will start on port 5000.

```
$ sls rack serve
[2019-01-03 18:13:21] INFO  WEBrick 1.4.2
[2019-01-03 18:13:21] INFO  ruby 2.5.1 (2018-03-29) [x86_64-linux-gnu]
[2019-01-03 18:13:21] INFO  WEBrick::HTTPServer#start: pid=25678 port=5000
```

Configure the port using the `-p` parameter:

```
$ sls rack serve -p 8000
[2019-01-03 18:13:21] INFO  WEBrick 1.4.2
[2019-01-03 18:13:21] INFO  ruby 2.5.1 (2018-03-29) [x86_64-linux-gnu]
[2019-01-03 18:13:21] INFO  WEBrick::HTTPServer#start: pid=25678 port=8000
```

When running locally, an environment variable named `IS_OFFLINE` will be set to `True`.
So, if you want to know when the application is running locally, check `ENV["IS_OFFLINE"]`.

For use with the `serverless-offline` plugin, run `sls rack install` prior to `sls offline`.

### Remote command execution

The `rack exec` command lets you execute ruby code remotely:

```
$ sls rack exec -c "puts (1 + Math.sqrt(5)) / 2"
1.618033988749895

$ cat count.rb
3.times do |i|
  puts i
end

$ sls rack exec -f count.rb
0
1
2
```

The `rack command` command lets you execute shell commands remotely:

```
$ sls rack command -c "pwd"
/var/task

$ cat script.sh
#!/bin/bash
echo "dlrow olleh" | rev

$ sls rack command -f script.sh
hello world
```

The `rack rake` command lets you execute Rake tasks remotely:

```
$ sls rack rake -t "db:rollback STEP=3"
```

### Explicit routes

If you'd like to be explicit about which routes and HTTP methods should pass through to your
application, see the following example:

```yaml
service: example

provider:
  name: aws
  runtime: ruby2.5

plugins:
  - serverless-rack

functions:
  api:
    handler: rack_adapter.handler
    events:
      - http:
          path: cats
          method: get
          integration: lambda-proxy
      - http:
          path: dogs/{id}
          method: get
          integration: lambda-proxy
```

### Custom domain names

If you use custom domain names with API Gateway, you might have a base path that is
at the beginning of your path, such as the stage (`/dev`, `/stage`, `/prod`). In this case, set
the `API_GATEWAY_BASE_PATH` environment variable to let `serverless-rack` know.

The example below uses the [serverless-domain-manager](https://github.com/amplify-education/serverless-domain-manager)
plugin to handle custom domains in API Gateway:

```yaml
service: example

provider:
  name: aws
  runtime: ruby2.5
  environment:
    API_GATEWAY_BASE_PATH: ${self:custom.customDomain.basePath}

plugins:
  - serverless-rack
  - serverless-domain-manager

functions:
  api:
    handler: rack_adapter.handler
    events:
      - http: ANY /
      - http: ANY {proxy+}

custom:
  customDomain:
    basePath: ${opt:stage}
    domainName: mydomain.name.com
    stage: ${opt:stage}
    createRoute53Record: true
```

### File uploads

In order to accept file uploads from HTML forms, make sure to add `multipart/form-data` to
the list of content types with _Binary Support_ in your API Gateway API. The
[serverless-apigw-binary](https://github.com/maciejtreder/serverless-apigw-binary)
Serverless plugin can be used to automate this process.

Keep in mind that, when building Serverless applications, uploading
[directly to S3](http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingHTTPPOST.html)
from the browser is usually the preferred approach.

### Raw context and event

The raw context and event from AWS Lambda are both accessible through the Rack
request. The following example shows how to access them when using Sinatra:

```ruby
require 'sinatra'

get '/' do
  puts request.env['serverless.event']
  puts request.env['serverless.context']
end
```

### Text MIME types

By default, all MIME types starting with `text/` and the following whitelist are sent
through API Gateway in plain text. All other MIME types will have their response body
base64 encoded (and the `isBase64Encoded` API Gateway flag set) in order to be
delivered by API Gateway as binary data (remember to add any binary MIME types that
you're using to the _Binary Support_ list in API Gateway).

This is the default whitelist of plain text MIME types:

- `application/json`
- `application/javascript`
- `application/xml`
- `application/vnd.api+json`
- `image/svg+xml`

In order to add additional plain text MIME types to this whitelist, use the
`textMimeTypes` configuration option:

```yaml
custom:
  rack:
    textMimeTypes:
      - application/custom+json
      - application/vnd.company+json
```

## Usage without Serverless

The AWS API Gateway to Rack mapping module is available as a gem.

Use this gem if you need to deploy Ruby functions to handle
API Gateway events directly, without using the Serverless framework.

```
gem install --install-dir vendor/bundle serverless-rack
```

Initialize your Rack application and in your Lambda event handler, call
the request mapper:

```ruby
require 'serverless_rack'

$app ||= Proc.new do |env|
  ['200', {'Content-Type' => 'text/html'}, ['A barebones rack app.']]
end

def handler(event:, context:)
  handle_request(app: $app, event: event, context: context)
end
```
