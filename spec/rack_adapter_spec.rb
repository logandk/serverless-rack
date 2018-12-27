require 'rack'

class MockApp
  attr_reader :last_environ

  def initialize
    @cookie_count = 3
    @response_mimetype = 'text/plain'
  end

  def call(environ)
    @last_environ = environ

    response = Rack::Response.new('Hello World ☃!')
    response.set_header('Content-Type', @response_mimetype)

    cookies = [
      %w[CUSTOMER WILE_E_COYOTE],
      %w[PART_NUMBER ROCKET_LAUNCHER_0002],
      %w[LOT_NUMBER 42]
    ]

    @cookie_count.times do |i|
      response.set_cookie(cookies[i][0], cookies[i][1])
    end

    environ['rack.errors'].puts 'application debug #1'

    response.to_a
  end
end

$app = MockApp.new

module Rack
  class Builder
    def self.parse_file(_filename)
      [$app]
    end
  end
end

RSpec.describe 'Rack adapter' do
  it 'transforms a simple request' do
    require 'rack_adapter'

    event = {
      'body' => nil,
      'headers' => {
        'Accept' => '*/*',
        'Accept-Encoding' => 'gzip, deflate',
        'CloudFront-Forwarded-Proto' => 'https',
        'CloudFront-Is-Desktop-Viewer' => 'true',
        'CloudFront-Is-Mobile-Viewer' => 'false',
        'CloudFront-Is-SmartTV-Viewer' => 'false',
        'CloudFront-Is-Tablet-Viewer' => 'false',
        'CloudFront-Viewer-Country' => 'DK',
        'Cookie' => 'CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001',
        'Host' => '3z6kd9fbb1.execute-api.us-east-1.amazonaws.com',
        'Postman-Token' => '778a706e-d6b0-48d5-94dd-9e98c22f12fe',
        'User-Agent' => 'PostmanRuntime/3.0.11-hotfix.2',
        'Via' => '1.1 b8fa.cloudfront.net (CloudFront)',
        'X-Amz-Cf-Id' => 'jx0Bvz9rm--Mz3wAj4i46FdOQQK3RHF4H0moJjBsQ==',
        'X-Amzn-Trace-Id' => 'Root=1-58d534a5-1e7cffe644b086304dce7a1e',
        'X-Forwarded-For' => '76.20.166.147, 205.251.218.72',
        'X-Forwarded-Port' => '443',
        'X-Forwarded-Proto' => 'https',
        'cache-control' => 'no-cache'
      },
      'httpMethod' => 'GET',
      'isBase64Encoded' => false,
      'path' => '/some/path',
      'pathParameters' => { 'proxy' => 'some/path' },
      'queryStringParameters' => { 'param1' => 'value1', 'param2' => 'value2' },
      'requestContext' => {
        'accountId' => '16794',
        'apiId' => '3z6kd9fbb1',
        'httpMethod' => 'GET',
        'identity' => {
          'accessKey' => nil,
          'accountId' => nil,
          'apiKey' => nil,
          'caller' => nil,
          'cognitoAuthenticationProvider' => nil,
          'cognitoAuthenticationType' => nil,
          'cognitoIdentityId' => nil,
          'cognitoIdentityPoolId' => nil,
          'sourceIp' => '76.20.166.147',
          'user' => nil,
          'userAgent' => 'PostmanRuntime/3.0.11-hotfix.2',
          'userArn' => nil
        },
        'authorizer' => { 'principalId' => 'wile_e_coyote' },
        'requestId' => 'ad2db740-10a2-11e7-8ced-35048084babb',
        'resourceId' => 'r4kza9',
        'resourcePath' => '/{proxy+}',
        'stage' => 'dev'
      },
      'resource' => '/{proxy+}',
      'stageVariables' => nil
    }

    response = nil

    expect do
      response = handler(
        event: event,
        context: { 'memory_limit_in_mb' => '128' }
      )
    end.to output("application debug #1\n").to_stderr

    expect(response).to eq(
      'body' => 'Hello World ☃!',
      'headers' => {
        'set-cookie' => 'CUSTOMER=WILE_E_COYOTE',
        'Content-Length' => '16',
        'Content-Type' => 'text/plain',
        'sEt-cookie' => 'LOT_NUMBER=42',
        'Set-cookie' => 'PART_NUMBER=ROCKET_LAUNCHER_0002'
      },
      'statusCode' => 200,
      'isBase64Encoded' => false
    )

    expect($app.last_environ).to eq(
      'CONTENT_LENGTH' => '0',
      'CONTENT_TYPE' => '',
      'HTTP_ACCEPT' => '*/*',
      'HTTP_ACCEPT_ENCODING' => 'gzip, deflate',
      'HTTP_CACHE_CONTROL' => 'no-cache',
      'HTTP_CLOUDFRONT_FORWARDED_PROTO' => 'https',
      'HTTP_CLOUDFRONT_IS_DESKTOP_VIEWER' => 'true',
      'HTTP_CLOUDFRONT_IS_MOBILE_VIEWER' => 'false',
      'HTTP_CLOUDFRONT_IS_SMARTTV_VIEWER' => 'false',
      'HTTP_CLOUDFRONT_IS_TABLET_VIEWER' => 'false',
      'HTTP_CLOUDFRONT_VIEWER_COUNTRY' => 'DK',
      'HTTP_COOKIE' =>
        'CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001',
      'HTTP_HOST' => '3z6kd9fbb1.execute-api.us-east-1.amazonaws.com',
      'HTTP_POSTMAN_TOKEN' => '778a706e-d6b0-48d5-94dd-9e98c22f12fe',
      'HTTP_USER_AGENT' => 'PostmanRuntime/3.0.11-hotfix.2',
      'HTTP_VIA' => '1.1 b8fa.cloudfront.net (CloudFront)',
      'HTTP_X_AMZN_TRACE_ID' => 'Root=1-58d534a5-1e7cffe644b086304dce7a1e',
      'HTTP_X_AMZ_CF_ID' => 'jx0Bvz9rm--Mz3wAj4i46FdOQQK3RHF4H0moJjBsQ==',
      'HTTP_X_FORWARDED_FOR' => '76.20.166.147, 205.251.218.72',
      'HTTP_X_FORWARDED_PORT' => '443',
      'HTTP_X_FORWARDED_PROTO' => 'https',
      'PATH_INFO' => '/some/path',
      'QUERY_STRING' => 'param1=value1&param2=value2',
      'REMOTE_ADDR' => '76.20.166.147',
      'REMOTE_USER' => 'wile_e_coyote',
      'REQUEST_METHOD' => 'GET',
      'SCRIPT_NAME' => '/dev',
      'SERVER_NAME' => '3z6kd9fbb1.execute-api.us-east-1.amazonaws.com',
      'SERVER_PORT' => '443',
      'SERVER_PROTOCOL' => 'HTTP/1.1',
      'rack.errors' => $app.last_environ['rack.errors'],
      'rack.input' => $app.last_environ['rack.input'],
      'rack.multiprocess' => false,
      'rack.multithread' => false,
      'rack.run_once' => false,
      'rack.url_scheme' => 'https',
      'rack.version' => [1, 3],
      'serverless.authorizer' => { 'principalId' => 'wile_e_coyote' },
      'serverless.context' => { 'memory_limit_in_mb' => '128' },
      'serverless.event' => event
    )
  end
end
