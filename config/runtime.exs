import Config

config :nostrum,
  token: System.get_env("FIXER_NOSTRUM_BOT_TOKEN", Application.get_env(:nostrum, :token))
