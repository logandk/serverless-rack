# frozen_string_literal: true

require 'rubygems'
require 'bundler/setup'
require 'rack'

require_relative './serverless_rack'

$app ||= Rack::Builder.parse_file('config.ru').first

def handler(event:, context:)
  handle_request(app: $app, event: event, context: context)
end
