require 'opal'
require 'tilt'
require 'opal/erb'
require 'sprockets'

module Opal
  module ERB
    class Processor < Tilt::Template
      # vvv BOILERPLATE vvv
      self.default_mime_type = 'application/javascript'

      def self.engine_initialized?
        true
      end

      def self.version
        ::Opal::VERSION
      end

      def initialize_engine
        require_template_library 'opal'
      end

      def prepare
      end
      # ^^^ BOILERPLATE ^^^


      def evaluate(context, locals, &block)
        context.require_asset 'erb'
        Opal::ERB.compile data, context.logical_path.sub(/^templates\//, '')
      end
    end
  end
end

Tilt.register 'opalerb', Opal::ERB::Processor

if Sprockets.respond_to? :register_transformer
  Sprockets.register_engine '.opalerb', Opal::ERB::Processor, mime_type: 'application/javascript', silence_deprecation: true
else
  Sprockets.register_engine '.opalerb', Opal::ERB::Processor
end
