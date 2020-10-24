# frozen_string_literal: true

require 'rack'

class MockApp
  attr_accessor :cookie_count, :response_mimetype, :verbose
  attr_reader :last_environ

  def initialize
    @cookie_count = 3
    @response_mimetype = 'text/plain'
    @verbose = false
  end

  def call(environ)
    @last_environ = environ

    response = Rack::Response.new
    response.write('Hello World ☃!')
    response.set_header('Content-Type', @response_mimetype)

    cookies = [
      %w[CUSTOMER WILE_E_COYOTE],
      %w[PART_NUMBER ROCKET_LAUNCHER_0002],
      %w[LOT_NUMBER 42]
    ]

    @cookie_count.times do |i|
      response.set_cookie(cookies[i][0], cookies[i][1])
    end

    environ['rack.errors'].puts 'application debug #1' if @verbose

    response.to_a
  end
end
