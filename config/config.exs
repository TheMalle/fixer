import Config

## Runtime configuration folder
config :configurer,
  folder: "config/runtime"

import_config "#{Mix.env()}.exs"
