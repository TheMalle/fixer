import Config

config :logger, level: :debug

config :logger, :console, truncate: :infinity

config :nostrum,
  log_full_events: true,
  log_dispatch_events: true
