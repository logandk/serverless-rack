Gem::Specification.new do |s|
  s.name        = 'serverless-rack'
  s.version     = '1.0.1'
  s.summary     =
    'Serverless plugin to deploy Ruby Rack applications (Sinatra/Padrino/Cuba etc.) '\
    'and bundle gems'
  s.description =
    'A Serverless v1.x plugin to build your deploy Ruby Rack applications using '\
    'Serverless. Compatible Rack application frameworks include Sinatra, '\
    'Cuba and Padrino.'
  s.authors     = ['Logan Raarup']
  s.email       = 'logan@logan.dk'
  s.files       = [
    'lib/serverless_rack.rb',
    'CHANGELOG.md',
    'Gemfile',
    'LICENSE',
    'README.md',
    'serverless-rack.gemspec'
  ]
  s.homepage = 'https://github.com/logandk/serverless-rack'
  s.license = 'MIT'

  s.required_ruby_version = '>= 2.2.0'
  s.add_dependency 'rack', '~> 2.0'
end
