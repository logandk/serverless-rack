# frozen_string_literal: true

require 'rack'
require 'rake'
require_relative './mock_app'

RSpec.describe 'Rack adapter' do
  let(:app) { MockApp.new }

  before(:example) do
    @app = app
    allow(Rack::Builder).to receive(:parse_file).with('config.ru').and_return([@app])

    allow(File).to receive(:read).and_call_original
    allow(File).to receive(:read).with('.serverless-rack').and_return('{}')

    $app = nil
    $config = nil
    load 'rack_adapter.rb'

    @event = {
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
  end

  it 'handles a simple request' do
    @app.verbose = true

    expect do
      @response = handler(
        event: @event,
        context: { 'memory_limit_in_mb' => '128' }
      )
    end.to output("application debug #1\n").to_stderr

    expect(@response).to eq(
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

    expect(@app.last_environ).to eq(
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
      'HTTP_COOKIE' => 'CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001',
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
      'rack.errors' => @app.last_environ['rack.errors'],
      'rack.input' => @app.last_environ['rack.input'],
      'rack.multiprocess' => false,
      'rack.multithread' => false,
      'rack.run_once' => false,
      'rack.url_scheme' => 'https',
      'rack.version' => [1, 3],
      'serverless.authorizer' => { 'principalId' => 'wile_e_coyote' },
      'serverless.context' => { 'memory_limit_in_mb' => '128' },
      'serverless.event' => @event
    )
  end

  it 'handles multi-value query string parameters and headers' do
    @event['multiValueQueryStringParameters'] = {
      'param1' => ['value1'],
      'param2' => %w[value2 value3]
    }

    # Convert regular headers request to multiValueHeaders
    @event['multiValueHeaders'] = {}
    @event['headers'].each do |key, value|
      @event['multiValueHeaders'][key] ||= []
      @event['multiValueHeaders'][key] << value
    end

    response = handler(
      event: @event,
      context: { 'memory_limit_in_mb' => '128' }
    )

    expect(@app.last_environ['QUERY_STRING']).to eq(
      Rack::Utils.build_query(@event['multiValueQueryStringParameters'])
    )

    expect(response).to eq(
      'body' => 'Hello World ☃!',
      'multiValueHeaders' => {
        'Content-Length' => ['16'],
        'Content-Type' => ['text/plain'],
        'Set-Cookie' => [
          'CUSTOMER=WILE_E_COYOTE',
          'PART_NUMBER=ROCKET_LAUNCHER_0002',
          'LOT_NUMBER=42'
        ]
      },
      'statusCode' => 200,
      'isBase64Encoded' => false
    )
  end

  it 'handles escaped characters in parameters' do
    @event['queryStringParameters'] = { 'param1' => 'value%231', 'param2' => 'value%232' }

    handler(
      event: @event,
      context: { 'memory_limit_in_mb' => '128' }
    )

    expect(@app.last_environ['QUERY_STRING']).to eq('param1=value%231&param2=value%232')
  end

  it 'handles escaped characters in multi-value query string parameters' do
    @event['multiValueQueryStringParameters'] = {
      'param1' => ['value%231'],
      'param2' => %w[value%232 value%233]
    }

    handler(
      event: @event,
      context: { 'memory_limit_in_mb' => '128' }
    )

    expect(@app.last_environ['QUERY_STRING']).to eq(
      'param1=value%231&param2=value%232&param2=value%233'
    )
  end

  it 'handles a request in china region' do
    @event['headers']['Host'] = 'x.amazonaws.com.cn'

    handler(
      event: @event,
      context: { 'memory_limit_in_mb' => '128' }
    )

    expect(@app.last_environ['SCRIPT_NAME']).to eq('/dev')
  end

  it 'responds with a single cookie' do
    @app.cookie_count = 1
    response = handler(event: @event, context: {})

    expect(response).to eq(
      'body' => 'Hello World ☃!',
      'headers' => {
        'Set-Cookie' => 'CUSTOMER=WILE_E_COYOTE',
        'Content-Length' => '16',
        'Content-Type' => 'text/plain'
      },
      'statusCode' => 200,
      'isBase64Encoded' => false
    )
  end

  it 'responds without cookies' do
    @app.cookie_count = 0

    response = handler(event: @event, context: {})

    expect(response).to eq(
      'body' => 'Hello World ☃!',
      'headers' => {
        'Content-Length' => '16',
        'Content-Type' => 'text/plain'
      },
      'statusCode' => 200,
      'isBase64Encoded' => false
    )
  end

  it 'ignores schedule events' do
    @event = { 'source' => 'aws.events' }
    response = handler(event: @event, context: {})
    expect(response).to eq({})
  end

  it 'ignores warmup plugin events' do
    @event = { 'source' => 'serverless-plugin-warmup' }
    response = handler(event: @event, context: {})
    expect(response).to eq({})
  end

  it 'handles request on custom domain' do
    @event['headers']['Host'] = 'custom.domain.com'
    handler(event: @event, context: {})

    expect(@app.last_environ).to eq(
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
      'HTTP_COOKIE' => 'CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001',
      'HTTP_HOST' => 'custom.domain.com',
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
      'SCRIPT_NAME' => '',
      'SERVER_NAME' => 'custom.domain.com',
      'SERVER_PORT' => '443',
      'SERVER_PROTOCOL' => 'HTTP/1.1',
      'rack.errors' => @app.last_environ['rack.errors'],
      'rack.input' => @app.last_environ['rack.input'],
      'rack.multiprocess' => false,
      'rack.multithread' => false,
      'rack.run_once' => false,
      'rack.url_scheme' => 'https',
      'rack.version' => [1, 3],
      'serverless.authorizer' => { 'principalId' => 'wile_e_coyote' },
      'serverless.context' => {},
      'serverless.event' => @event
    )
  end

  it 'handles request with API Gateway base path' do
    @event['headers']['Host'] = 'custom.domain.com'
    @event['path'] = '/prod/some/path'
    ENV['API_GATEWAY_BASE_PATH'] = 'prod'

    handler(event: @event, context: {})

    expect(@app.last_environ).to eq(
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
      'HTTP_COOKIE' => 'CUSTOMER=WILE_E_COYOTE; PART_NUMBER=ROCKET_LAUNCHER_0001',
      'HTTP_HOST' => 'custom.domain.com',
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
      'SCRIPT_NAME' => '/prod',
      'SERVER_NAME' => 'custom.domain.com',
      'SERVER_PORT' => '443',
      'SERVER_PROTOCOL' => 'HTTP/1.1',
      'rack.errors' => @app.last_environ['rack.errors'],
      'rack.input' => @app.last_environ['rack.input'],
      'rack.multiprocess' => false,
      'rack.multithread' => false,
      'rack.run_once' => false,
      'rack.url_scheme' => 'https',
      'rack.version' => [1, 3],
      'serverless.authorizer' => { 'principalId' => 'wile_e_coyote' },
      'serverless.context' => {},
      'serverless.event' => @event
    )
  end

  it 'encodes with base64 for binary response' do
    @app.cookie_count = 1
    @app.response_mimetype = 'image/jpeg'

    response = handler(event: @event, context: {})

    expect(response).to eq(
      'body' => 'SGVsbG8gV29ybGQg4piDIQ==',
      'headers' => {
        'Set-Cookie' => 'CUSTOMER=WILE_E_COYOTE',
        'Content-Length' => '16',
        'Content-Type' => 'image/jpeg'
      },
      'statusCode' => 200,
      'isBase64Encoded' => true
    )
  end

  it 'skips encoding for non-binary response' do
    @app.cookie_count = 1

    plain_mimetypes = [
      'application/vnd.api+json',
      'application/javascript',
      'image/svg+xml'
    ]

    plain_mimetypes.each do |mimetype|
      @app.response_mimetype = mimetype
      response = handler(event: @event, context: {})

      expect(response).to eq(
        'body' => 'Hello World ☃!',
        'headers' => {
          'Set-Cookie' => 'CUSTOMER=WILE_E_COYOTE',
          'Content-Length' => '16',
          'Content-Type' => mimetype
        },
        'statusCode' => 200,
        'isBase64Encoded' => false
      )
    end
  end

  it 'handles base64 encoded request' do
    @event['body'] = 'SGVsbG8gd29ybGQ='
    @event['headers']['Content-Type'] = 'text/plain'
    @event['isBase64Encoded'] = true
    @event['httpMethod'] = 'PUT'

    handler(event: @event, context: {})

    expect(@app.last_environ['CONTENT_TYPE']).to eq('text/plain')
    expect(@app.last_environ['CONTENT_LENGTH']).to eq('11')
    expect(@app.last_environ['REQUEST_METHOD']).to eq('PUT')
    expect(@app.last_environ['rack.input'].read).to eq('Hello world')
  end

  it 'handles base64 encoded binary request' do
    @event['body'] =
      'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5VTRDZE5CRWVLQWxIaGRRcQ0KQ29udGVu'\
      'dC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJ3YXQiDQoNCmhleW9vb3Bw'\
      'cHBwDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENkTkJFZUtBbEhoZFFxDQpD'\
      'b250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZpbGVUb1VwbG9h'\
      'ZCI7IGZpbGVuYW1lPSJGRjREMDAtMC44LnBuZyINCkNvbnRlbnQtVHlwZTogaW1h'\
      'Z2UvcG5nDQoNColQTkcNChoKAAAADUlIRFIAAAABAAAAAQEDAAAAJdtWygAAAANQ'\
      'TFRF/00AXDU4fwAAAAF0Uk5TzNI0Vv0AAAAKSURBVHicY2IAAAAGAAM2N3yoAAAA'\
      'AElFTkSuQmCCDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENkTkJFZUtBbEho'\
      'ZFFxDQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9InN1Ym1p'\
      'dCINCg0KVXBsb2FkIEltYWdlDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlVNENk'\
      'TkJFZUtBbEhoZFFxLS0NCg=='
    @event['headers']['Content-Type'] =
      'multipart/form-data; boundary=----WebKitFormBoundaryU4CdNBEeKAlHhdQq'
    @event['isBase64Encoded'] = true
    @event['httpMethod'] = 'POST'

    handler(event: @event, context: {})

    expect(@app.last_environ['CONTENT_LENGTH']).to eq('496')
    expect(Rack::Request.new(@app.last_environ).params['submit']).to eq(
      'Upload Image'
    )
  end

  it 'handles request with non-latin1 characters' do
    @event['body'] =
      "------WebKitFormBoundary3vA72kRLuq9D3NdL\r\n"\
      "Content-Disposition: form-data; name=\"text\"\r\n\r\n"\
      "テスト 테스트 测试\r\n"\
      '------WebKitFormBoundary3vA72kRLuq9D3NdL--'
    @event['headers']['Content-Type'] =
      'multipart/form-data; boundary=----WebKitFormBoundary3vA72kRLuq9D3NdL'
    @event['httpMethod'] = 'POST'

    handler(event: @event, context: {})

    expect(Rack::Request.new(@app.last_environ).params['text']).to eq(
      'テスト 테스트 测试'
    )
  end

  it 'allows specifying additional text mime types' do
    allow(File).to receive(:read).with('.serverless-rack').and_return(
      '{"text_mime_types": ["application/custom+json"]}'
    )

    $app = nil
    $config = nil
    load 'rack_adapter.rb'

    @app.cookie_count = 1
    @app.response_mimetype = 'application/custom+json'

    response = handler(event: @event, context: {})

    expect(response).to eq(
      'body' => 'Hello World ☃!',
      'headers' => {
        'Set-Cookie' => 'CUSTOMER=WILE_E_COYOTE',
        'Content-Length' => '16',
        'Content-Type' => 'application/custom+json'
      },
      'statusCode' => 200,
      'isBase64Encoded' => false
    )
  end

  it 'handles ALB requests' do
    event = {
      'requestContext' => {
        'elb' => {
          'targetGroupArn' =>
            'arn:aws:elasticloadbalancing:us-east-1:12345:targetgroup/xxxx'\
            '/5e43816d76759862'
        }
      },
      'httpMethod' => 'GET',
      'path' => '/cats',
      'queryStringParameters' => {},
      'headers' => {
        'accept' =>
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp'\
          ',image/apng,*/*;q=0.8',
        'accept-encoding' => 'gzip, deflate',
        'accept-language' => 'en-US,en;q=0.9,da;q=0.8',
        'cache-control' => 'max-age=0',
        'connection' => 'keep-alive',
        'host' => 'xxxx-203391234.us-east-1.elb.amazonaws.com',
        'upgrade-insecure-requests' => '1',
        'user-agent' =>
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '\
          '(KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36',
        'x-amzn-trace-id' => 'Root=1-5f05949b-77e2b0f9434e2acbf5ad8ce8',
        'x-forwarded-for' => '95.181.37.218',
        'x-forwarded-port' => '80',
        'x-forwarded-proto' => 'http'
      },
      'body' => '',
      'isBase64Encoded' => false
    }

    response = handler(event: event, context: {})

    expect(response).to eq(
      'body' => 'Hello World ☃!',
      'headers' => {
        'set-cookie' => 'CUSTOMER=WILE_E_COYOTE',
        'Content-Length' => '16',
        'Content-Type' => 'text/plain',
        'sEt-cookie' => 'LOT_NUMBER=42',
        'Set-cookie' => 'PART_NUMBER=ROCKET_LAUNCHER_0002'
      },
      'statusDescription' => '200 OK',
      'statusCode' => 200,
      'isBase64Encoded' => false
    )
  end

  it 'evaluates Ruby code remotely' do
    response = handler(
      event: { '_serverless-rack' => {
        'command' => 'exec',
        'data' => 'puts 1+4'
      } },
      context: {}
    )

    expect(response).to eq("5\n")

    response = handler(
      event: { '_serverless-rack' => {
        'command' => 'exec',
        'data' => 'invalid code'
      } },
      context: {}
    )

    expect(response).to include("undefined local variable or method `code'")
  end

  it 'executes shell commands remotely' do
    response = handler(
      event: { '_serverless-rack' => {
        'command' => 'command',
        'data' => 'echo "hello world"'
      } },
      context: {}
    )

    expect(response).to eq("hello world\n")
  end

  it 'executes rake commands remotely' do
    allow(Rake.application).to receive(:run) { puts 'hello world' }

    response = handler(
      event: { '_serverless-rack' => {
        'command' => 'rake',
        'data' => 'db:rollback STEP=3'
      } },
      context: {}
    )

    expect(response).to eq("hello world\n")
  end

  it 'fails when invoked with unknown comand' do
    response = handler(
      event: { '_serverless-rack' => {
        'command' => 'unknown',
        'data' => 'echo "hello world"'
      } },
      context: {}
    )

    expect(response).to include('Unknown command')
  end

  it 'loads custom Rack config' do
    allow(Rack::Builder).to receive(:parse_file).with(
      'path/to/config.ru'
    ).and_return(['custom config'])

    allow(File).to receive(:read).and_call_original
    allow(File).to receive(:read).with('.serverless-rack').and_return(
      '{"config_path": "path/to/config.ru"}'
    )

    $app = nil
    $config = nil
    load 'rack_adapter.rb'
    expect($app).to eq('custom config')
  end

  context 'when the response body can be closed' do
    let(:buffer) { StringIO.new('Hello World!') }
    let(:app) { ->(_env) { [200, { 'Content-Type' => 'text/plain' }, buffer] } }

    it 'closes the response body after formatting' do
      handler(event: @event, context: {})

      expect(buffer).to be_closed
    end
  end
end
