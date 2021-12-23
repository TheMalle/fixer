import Config

# General

## Logger
config :logger,
  utc_log: true,
  console: [
    format: "$dateT$timeZ $metadata[$level] $levelpad$message\n",
    metadata: [:shard, :guild, :channel]
  ]

# Nostrum

config :nostrum,
  token:
    System.get_env(
      "FIXER_NOSTRUM_BOT_TOKEN",
      "abcdefghijklmmopqrstuvwx.abcdef.abcdefghijklmnopqrstuvwxyza"
    )

import_config "#{Mix.env()}.exs"
