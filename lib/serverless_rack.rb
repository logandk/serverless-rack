# frozen_string_literal: true

# This module handles conversion between API Gateway/ALB and Rack requests/responses.
#
# Author: Logan Raarup <logan@logan.dk>

require 'rack'
require 'base64'
require 'stringio'

TEXT_MIME_TYPES = [
  'application/json',
  'application/javascript',
  'application/xml',
  'application/vnd.api+json',
  'image/svg+xml'
].freeze

def base_path
  return if ENV.fetch('API_GATEWAY_BASE_PATH', '').empty?

  "/#{ENV.fetch('API_GATEWAY_BASE_PATH')}"
end

def keepalive_event?(event)
  ['aws.events', 'serverless-plugin-warmup'].include?(event['source'])
end

def parse_script_name(event, headers)
  if base_path.nil? && (headers['Host'] || '').include?('amazonaws.com')
    "/#{event['requestContext']['stage']}"
  else
    base_path.to_s
  end
end

def parse_path_info(event)
  # If a user is using a custom domain on API Gateway, they may have a base
  # path in their URL. This allows us to strip it out via an optional
  # environment variable.
  if base_path && event['path'].start_with?(base_path)
    event['path'][base_path.length..-1]
  else
    event['path']
  end
end

def parse_query_string(event)
  if event.include? 'multiValueQueryStringParameters'
    Rack::Utils.unescape(
      Rack::Utils.build_query(event['multiValueQueryStringParameters'] || {})
    )
  else
    Rack::Utils.unescape(Rack::Utils.build_query(event['queryStringParameters'] || {}))
  end
end

def parse_body(event)
  if event['isBase64Encoded']
    Base64.decode64(event['body'])
  else
    event['body'] || ''
  end
end

def parse_headers(event)
  if event.include? 'multiValueHeaders'
    Rack::Headers[
      (event['multiValueHeaders'] || {}).transform_values do |value|
        value.join("\n")
      end
    ]
  else
    Rack::Headers[event['headers'] || {}]
  end
end

def parse_http_headers(headers)
  headers = headers.map do |key, value|
    ["HTTP_#{key.upcase.tr('-', '_')}", value]
  end

  headers = headers.reject do |key, _value|
    %w[HTTP_CONTENT_TYPE HTTP_CONTENT_LENGTH].include?(key)
  end

  headers.to_h
end

def build_environ(event:, context:, headers:, body:)
  {
    'REQUEST_METHOD' => event['httpMethod'],
    'SCRIPT_NAME' => parse_script_name(event, headers),
    'PATH_INFO' => parse_path_info(event),
    'QUERY_STRING' => parse_query_string(event),
    'SERVER_NAME' => headers['Host'] || 'lambda',
    'SERVER_PORT' => headers['X-Forwarded-Port'] || '80',
    'CONTENT_LENGTH' => body.bytesize.to_s,
    'CONTENT_TYPE' => headers['Content-Type'] || '',
    'SERVER_PROTOCOL' => 'HTTP/1.1',
    'REMOTE_ADDR' => (event['requestContext']['identity'] || {})['sourceIp'] || '',
    'REMOTE_USER' => (event['requestContext']['authorizer'] || {})['principalId'] || '',
    'rack.version' => Rack::VERSION,
    'rack.url_scheme' => headers['X-Forwarded-Proto'] || 'http',
    'rack.input' => StringIO.new(body),
    'rack.errors' => $stderr,
    'rack.multithread' => false,
    'rack.multiprocess' => false,
    'rack.run_once' => false,
    'serverless.event' => event,
    'serverless.context' => context,
    'serverless.authorizer' => event['requestContext']['authorizer']
  }.merge(parse_http_headers(headers))
end

def format_status_description(event:, status:)
  return {} unless event['requestContext']['elb']

  # If the request comes from ALB we need to add a status description
  description = Rack::Utils::HTTP_STATUS_CODES[status]

  { 'statusDescription' => "#{status} #{description}" }
end

def text_mime_type?(headers:, text_mime_types:)
  mime_type = headers['Content-Type'] || 'text/plain'

  return false if headers['Content-Encoding']
  return true if mime_type.start_with?('text/')
  return true if text_mime_types.include?(mime_type)

  false
end

# Class to buffer a streaming response body
class ResponseInputStream
  attr_reader :buffer

  def initialize
    @buffer = ''
  end

  def self.[](streaming_body)
    stream = new
    streaming_body.call(stream)
    stream.buffer
  end

  def write(chunk)
    @buffer += chunk
  end

  def <<(chunk)
    write(chunk)
  end

  def close; end

  alias read buffer

  def flush
    @buffer = ''
  end
end

def format_body(body:, headers:, text_mime_types:)
  response_data = ''
  begin
    if body.respond_to?(:each)
      body.each { |part| response_data += part }
    elsif body.respond_to?(:to_ary)
      body.to_ary.each { |part| response_data += part }
    elsif body.respond_to?(:call)
      response_data = ResponseInputStream[body]
    end
  ensure
    body.close if body.respond_to?(:close)
  end

  return {} if response_data.empty?

  if text_mime_type?(headers: headers, text_mime_types: text_mime_types)
    {
      'body' => response_data,
      'isBase64Encoded' => false
    }
  else
    {
      'body' => Base64.strict_encode64(response_data),
      'isBase64Encoded' => true
    }
  end
end

def all_casings(input_string)
  # Permute all casings of a given string.
  # A pretty algoritm, via @Amber
  # http://stackoverflow.com/questions/6792803/finding-all-possible-case-permutations-in-python
  return enum_for(__method__, input_string) unless block_given?

  if input_string.empty?
    yield ''
  else
    first = input_string[0]
    if first.downcase == first.upcase
      all_casings(input_string[1..-1]) do |sub_casing|
        yield first + sub_casing
      end
    else
      all_casings(input_string[1..-1]) do |sub_casing|
        yield first.downcase + sub_casing
        yield first.upcase + sub_casing
      end
    end
  end
end

def format_split_headers(headers:)
  # Rack::Headers will automatically lower-case new keys
  # Use (and return) a regular hash literal instead
  headers_hash = {}

  # If there are headers multiple occurrences, e.g. Set-Cookie, create
  # case-mutated variations in order to pass them through APIGW.
  # This is a hack that's currently needed.
  headers.each do |key, value|
    if value.is_a?(Array)
      value.zip(all_casings(key)).each { |v, casing| headers_hash[casing] = v }
    else
      headers_hash[key] = value
    end
  end

  { 'headers' => headers_hash }
end

def format_grouped_headers(headers:)
  { 'multiValueHeaders' => headers.transform_values { |v| v.is_a?(Array) ? v : [v] } }
end

def format_response(event:, status:, headers:, body:, text_mime_types:)
  response = { 'statusCode' => status }

  if event.include? 'multiValueHeaders'
    response.merge!(format_grouped_headers(headers: headers))
  else
    response.merge!(format_split_headers(headers: headers))
  end

  response.merge!(
    format_status_description(event: event, status: status)
  )

  response.merge!(
    format_body(
      body: body,
      headers: headers,
      text_mime_types: text_mime_types
    )
  )

  response
end

def handle_request(app:, event:, context:, config: {})
  return {} if keepalive_event?(event)

  status, headers, body = app.call(
    build_environ(
      event: event,
      context: context,
      headers: parse_headers(event),
      body: parse_body(event)
    )
  )

  format_response(
    event: event,
    status: status,
    headers: headers,
    body: body,
    text_mime_types: TEXT_MIME_TYPES + config['text_mime_types'].to_a
  )
end
