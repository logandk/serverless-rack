# frozen_string_literal: true

# This is the entrypoint for Lambda function invocations. It is kept
# separate, in order to make the main Rack mapping code available as
# a gem that can be used without Serverless.
#
# Author: Logan Raarup <logan@logan.dk>

require 'rubygems'
require 'bundler/setup'
require 'json'
require 'rack'

require_relative './serverless_rack'

$config ||= JSON.parse(File.read('.serverless-rack'))
$app ||= Rack::Builder.parse_file($config['config_path'] || 'config.ru').first

# For some reason, SimpleCov is unable to profile this file correctly.
# It is covered, though, but you'll need to take my word for it.

# :nocov:
def invoke_command(event)
  native_stdout = $stdout
  native_stderr = $stderr
  output_buffer = StringIO.new

  begin
    $stdout = output_buffer
    $stderr = output_buffer

    meta = event['_serverless-rack']
    case meta['command']
    when 'exec'
      # Evaluate Ruby code
      eval(meta['data'].to_s)
    when 'command'
      # Run shell commands
      require 'open3'
      output_buffer.write(Open3.capture2e(meta['data'].to_s).first)
    when 'rake'
      # Run rake task
      require 'shellwords'
      require 'rake'
      Rake.application.run(Shellwords.shellsplit(meta['data'].to_s))
    else
      raise "Unknown command: #{meta['command']}"
    end
  rescue StandardError => e
    return "#{e.backtrace.first}: #{e.message} (#{e.class})"
  ensure
    $stdout = native_stdout
    $stderr = native_stderr
  end

  output_buffer.string
end

def handler(event:, context:)
  if event['_serverless-rack']
    invoke_command(event)
  else
    handle_request(app: $app, config: $config, event: event, context: context)
  end
end
# :nocov:
