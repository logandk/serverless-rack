A Serverless v1.x plugin to build your deploy Ruby Rack applications using Serverless. Compatible
Rack application frameworks include Sinatra and Padrino.

### Features

- Transparently converts API Gateway and ALB requests to and from standard Rack requests
- Supports anything you'd expect from Rack such as redirects, cookies, file uploads etc.

### Coming soon

- Bundler integration, including dockerized bundling
- Convenient `rack serve` command for serving your application locally during development
- CLI commands for remote execution of Ruby code (`rack exec`) and shell commands (`rack command`)

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
```
