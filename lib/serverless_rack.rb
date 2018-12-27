# frozen_string_literal: true

require 'rack'
require 'base64'

TEXT_MIME_TYPES = [
  'application/json',
  'application/javascript',
  'application/xml',
  'application/vnd.api+json',
  'image/svg+xml'
].freeze

def keepalive_event?(event)
  ['aws.events', 'serverless-plugin-warmup'].include?(event['source'])
end

def parse_script_name(event, headers)
  if ENV['API_GATEWAY_BASE_PATH']
    "/#{ENV['API_GATEWAY_BASE_PATH']}"
  elsif (headers['Host'] || '').include?('amazonaws.com')
    "/#{event['requestContext']['stage']}"
  else
    ''
  end
end

def parse_path_info(event)
  # If a user is using a custom domain on API Gateway, they may have a base
  # path in their URL. This allows us to strip it out via an optional
  # environment variable.
  if ENV['API_GATEWAY_BASE_PATH']
    if event['path'].start_with?("/#{ENV['API_GATEWAY_BASE_PATH']}")
      return event['path']["/#{ENV['API_GATEWAY_BASE_PATH']}".length..-1]
    end
  end

  event['path']
end

def parse_body(event)
  if event['isBase64Encoded']
    Base64.decode64(event['body'])
  else
    event['body'] || ''
  end
end

def parse_http_headers(headers)
  headers.map do |key, value|
    ["HTTP_#{key.upcase.tr('-', '_')}", value]
  end.reject do |key, _value|
    %w[HTTP_CONTENT_TYPE HTTP_CONTENT_LENGTH].include?(key)
  end.to_h
end

def build_environ(event:, context:, headers:, body:)
  {
    'REQUEST_METHOD' => event['httpMethod'],
    'SCRIPT_NAME' => parse_script_name(event, headers),
    'PATH_INFO' => parse_path_info(event),
    'QUERY_STRING' => Rack::Utils.build_query(
      event['queryStringParameters'] || {}
    ),
    'SERVER_NAME' => headers['Host'] || 'lambda',
    'SERVER_PORT' => headers['X-Forwarded-Port'] || '80',
    'CONTENT_LENGTH' => body.length.to_s,
    'CONTENT_TYPE' => headers['Content-Type'] || '',
    'SERVER_PROTOCOL' => 'HTTP/1.1',
    'REMOTE_ADDR' =>
      (event['requestContext']['identity'] || {})['sourceIp'] || '',
    'REMOTE_USER' =>
      (event['requestContext']['authorizer'] || {})['principalId'] || '',
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

def text_mimetype?(headers:)
  mimetype = headers['Content-Type'] || 'text/plain'

  return false if headers['Content-Encoding']
  return true if mimetype.start_with?('text/')
  return true if TEXT_MIME_TYPES.include?(mimetype)

  false
end

def format_body(body:, headers:)
  response_data = ''
  body.each { |part| response_data += part }

  return {} if response_data.empty?

  if text_mimetype?(headers: headers)
    { 'body' => response_data, 'isBase64Encoded' => false }
  else
    { 'body' => Base64.encode64(response_data), 'isBase64Encoded' => true }
  end
end

def all_casings(input_string)
  # Permute all casings of a given string.
  # A pretty algoritm, via @Amber
  # http://stackoverflow.com/questions/6792803/finding-all-possible-case-permutations-in-python
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

def format_headers(headers:)
  # TODO: Unpack all headers with multiple values

  # If there are multiple Set-Cookie headers, create case-mutated variations
  # in order to pass them through APIGW. This is a hack that's currently
  # needed.
  if headers['Set-Cookie']
    cookies = headers['Set-Cookie'].split("\n")
    if cookies.size > 1
      headers.delete('Set-Cookie')
      headers = headers.to_hash
      all_casings('Set-Cookie') do |casing|
        headers[casing] = cookies.shift
        break if cookies.empty?
      end
    end
  end

  { 'headers' => headers }
end

def format_response(event, status, headers, body)
  response = { 'statusCode' => status }
  response.merge!(format_headers(headers: headers))
  response.merge!(format_status_description(event: event, status: status))
  response.merge!(format_body(body: body, headers: headers))
  response
end

def handle_request(app:, event:, context:)
  return {} if keepalive_event?(event)

  format_response(event, *app.call(
    build_environ(
      event: event,
      context: context,
      headers: Rack::Utils::HeaderHash.new(event['headers'] || {}),
      body: parse_body(event)
    )
  ))
end
