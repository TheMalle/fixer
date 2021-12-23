import Config

# General

## Logger
config :logger,
  utc_log: true,
  console: [
    format: "$dateT$timeZ $metadata[$level] $levelpad$message\n"
  ]

import_config "#{Mix.env()}.exs"
