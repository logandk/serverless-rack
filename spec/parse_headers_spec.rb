# frozen_string_literal: true

require_relative '../lib/serverless_rack'

RSpec.describe 'parse_headers' do
  let(:event) do
    {
      'headers' => {
        'Header1' => 'value1',
        'HEADER2' => 'value2'
      }
    }
  end

  it 'responds to lower-case keys', :aggregate_failures do
    parsed_headers = parse_headers(event)

    expect(parsed_headers['header1']).to eq 'value1'
    expect(parsed_headers['Header2']).to eq 'value2'
  end

  context 'with multiValuedHeaders' do
    let(:event) do
      {
        'multiValueHeaders' => {
          'Header1' => %w[value1 value2],
          'HEADER2' => ['value3']
        }
      }
    end

    it 'joins the multi-value headers into a string' do
      expect(parse_headers(event)['Header1']).to eq "value1\nvalue2"
    end

    it 'responds to lower-case keys' do
      expect(parse_headers(event)['header2']).to eq 'value3'
    end
  end
end
